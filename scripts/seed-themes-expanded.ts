import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { GoogleGenerativeAI } from "@google/generative-ai";
import * as fs from "fs";
import * as path from "path";

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
      clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    }),
  });
}

const db = getFirestore();
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

const groups = [
  { name: "생활형", targetCount: 80, types: ["감정형", "상황형"] },
  { name: "관심사형", targetCount: 60, types: ["질문형", "주제형"] },
  { name: "사회·기술형", targetCount: 40, types: ["주제형"] },
  { name: "입문·출발형", targetCount: 20, types: ["책/저자 출발형"] },
];

async function callGemini(groupName: string, count: number, types: string[], excludeList: any[]) {
  const existingNames = excludeList.map(t => t.name).slice(-100).join(", "); // limit to last 100 to avoid prompt size bloat
  
  const prompt = `
당신은 한국어 철학 도서 큐레이션 전문가입니다.

"${groupName}" 그룹에 속하는 철학 주제를 ${count}개 생성하세요.
이 그룹은 ${groupName === "생활형" ? "일상의 감정이나 상황에서 출발하는 주제" : 
            groupName === "관심사형" ? "철학적 질문이나 핵심 개념에서 출발하는 주제" :
            groupName === "사회·기술형" ? "사회적 이슈나 기술적 변화를 철학적으로 바라보는 주제" :
            "철학에 입문하거나 특정 철학자/분야에서 시작하는 주제"}입니다.

기존 주제 (중복 금지):
${existingNames}

각 주제는 다음 JSON 형식으로 응답하세요 (순수 JSON 배열만 반환):
[
  {
    "themeId": "영문_snake_case",
    "name": "${groupName === "생활형" ? "~할 때 읽는 철학" : groupName === "관심사형" ? "~이란 무엇인지 묻는 철학" : "~을 생각하게 하는 철학"} 형태의 이름",
    "shortLabel": "2~4글자 키워드",
    "group": "${groupName}",
    "type": "${types.join(" | ")} 중 하나",
    "description": "이 주제에 해당하는 책의 특성을 한 문장으로 설명",
    "relatedConcepts": ["관련 철학 개념 3~5개"],
    "exampleQueries": ["사용자가 검색할 만한 문장 2개"],
    "isActive": true,
    "tier": "extended"
  }
]
`;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    const themes = JSON.parse(jsonMatch ? jsonMatch[0] : text);
    return Array.isArray(themes) ? themes : [];
  } catch (e) {
    console.error(`Gemini call failed for ${groupName}:`, e);
    return [];
  }
}

async function generateThemesForGroup(groupName: string, targetCount: number, types: string[], existingThemes: any[]) {
  console.log(`Generating ${targetCount} themes for group: ${groupName}...`);
  const batchSize = 40;
  let allThemes: any[] = [];

  for (let generated = 0; generated < targetCount; generated += batchSize) {
    const remaining = Math.min(batchSize, targetCount - generated);
    const excludeList = [...existingThemes, ...allThemes];
    const themes = await callGemini(groupName, remaining, types, excludeList);
    allThemes = [...allThemes, ...themes];

    if (generated + batchSize < targetCount) {
      await new Promise(r => setTimeout(r, 2000));
    }
  }

  return allThemes;
}

async function main() {
  const isCommit = process.argv.includes("--commit");
  
  const themesSnapshot = await db.collection("themes").get();
  const existingThemes = themesSnapshot.docs.map(doc => doc.data());
  const existingIds = new Set(existingThemes.map(t => t.themeId));
  
  let allNewThemes: any[] = [];
  
  for (const group of groups) {
    const themes = await generateThemesForGroup(group.name, group.targetCount, group.types, existingThemes);
    allNewThemes = [...allNewThemes, ...themes];
  }

  // Deduplication
  const seenIds = new Set<string>();
  const uniqueNewThemes: any[] = [];

  for (const theme of allNewThemes) {
    if (existingIds.has(theme.themeId)) {
      console.warn(`⚠️ Skipping duplicate core/existing themeId: ${theme.themeId}`);
      continue;
    }
    if (seenIds.has(theme.themeId)) {
      console.warn(`⚠️ Skipping internal duplicate themeId: ${theme.themeId}`);
      continue;
    }
    seenIds.add(theme.themeId);
    uniqueNewThemes.push(theme);
  }

  // Automatic priorityOrder assignment
  const groupCounters: Record<string, number> = {};
  for (const theme of existingThemes) {
    const current = groupCounters[theme.group] ?? 0;
    groupCounters[theme.group] = Math.max(current, theme.priorityOrder ?? 0);
  }

  for (const theme of uniqueNewThemes) {
    const nextOrder = (groupCounters[theme.group] ?? 0) + 1;
    groupCounters[theme.group] = nextOrder;
    theme.priorityOrder = nextOrder;
  }

  // Save to file
  const dataDir = path.join(process.cwd(), "data");
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir);
  
  fs.writeFileSync(
    path.join(dataDir, "themes-candidates.json"),
    JSON.stringify(uniqueNewThemes, null, 2),
    "utf-8"
  );
  
  console.log(`Generated ${uniqueNewThemes.length} unique theme candidates.`);

  if (isCommit) {
    console.log("Committing to Firestore in batches...");
    const BATCH_LIMIT = 499;
    
    for (let i = 0; i < uniqueNewThemes.length; i += BATCH_LIMIT) {
      const batch = db.batch();
      const chunk = uniqueNewThemes.slice(i, i + BATCH_LIMIT);

      for (const theme of chunk) {
        const ref = db.collection("themes").doc(theme.themeId);
        batch.set(ref, {
          ...theme,
          createdAt: new Date(),
          updatedAt: new Date()
        });
      }

      await batch.commit();
      console.log(`Committed batch ${Math.floor(i / BATCH_LIMIT) + 1}: ${chunk.length} themes`);
    }
    console.log("Successfully committed all batches to Firestore.");
  } else {
    console.log("Run with --commit to save to Firestore.");
  }
}

main().catch(console.error);
