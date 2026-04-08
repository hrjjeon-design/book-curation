import * as dotenv from "dotenv"
dotenv.config({ path: ".env.local" })

import { initializeApp, getApps, cert } from "firebase-admin/app"
import { getFirestore } from "firebase-admin/firestore"

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
      clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    }),
  })
}

const db = getFirestore()

async function seed() {
  await seedThemes()
  await seedCuratorConfig()
  await seedBooks()
  console.log("시드 완료")
}

async function seedThemes() {
  const themes = [
    { themeId: "anxiety", name: "불안할 때 읽는 철학", shortLabel: "불안할 때", group: "생활형", type: "감정형", description: "불안을 없애기보다 불안과 함께 살아가는 방법을 생각하게 하는 철학책", relatedConcepts: ["불안", "실존", "선택", "자유"], exampleQueries: ["요즘 너무 불안해요", "불안을 다스리는 철학"], priorityOrder: 1, isActive: true },
    { themeId: "meaning_of_life", name: "삶의 방향을 잃었을 때 읽는 철학", shortLabel: "삶의 방향", group: "생활형", type: "상황형", description: "삶의 의미와 방향을 다시 생각하게 하는 철학책", relatedConcepts: ["의미", "실존", "목적", "삶"], exampleQueries: ["삶의 의미를 모르겠어요", "무엇을 위해 사는지 모르겠어요"], priorityOrder: 2, isActive: true },
    { themeId: "relationships", name: "관계가 힘들 때 읽는 철학", shortLabel: "관계", group: "생활형", type: "상황형", description: "타인과의 관계, 갈등, 소통을 철학적으로 생각하게 하는 책", relatedConcepts: ["타자", "관계", "소통", "사랑"], exampleQueries: ["사람 관계가 힘들어요", "타인과 어떻게 살아야 할까요"], priorityOrder: 3, isActive: true },
    { themeId: "love", name: "사랑을 다시 생각하게 하는 철학", shortLabel: "사랑", group: "생활형", type: "감정형", description: "사랑의 의미와 본질을 철학적으로 탐구하는 책", relatedConcepts: ["사랑", "타자", "관계", "욕망"], exampleQueries: ["사랑이란 무엇인가", "사랑에 대한 철학책"], priorityOrder: 4, isActive: true },
    { themeId: "death", name: "죽음과 상실을 생각할 때 읽는 철학", shortLabel: "죽음과 상실", group: "생활형", type: "감정형", description: "죽음, 상실, 애도를 철학적으로 바라보게 하는 책", relatedConcepts: ["죽음", "상실", "유한성", "실존"], exampleQueries: ["죽음이 두려워요", "소중한 사람을 잃었어요"], priorityOrder: 5, isActive: true },
    { themeId: "happiness", name: "행복하게 산다는 게 무엇인지 묻는 철학", shortLabel: "행복", group: "생활형", type: "질문형", description: "행복의 의미와 좋은 삶에 대해 생각하게 하는 책", relatedConcepts: ["행복", "좋은삶", "의미", "쾌락"], exampleQueries: ["행복이란 무엇인가", "어떻게 살아야 행복한가"], priorityOrder: 6, isActive: true },
    { themeId: "choice", name: "내 선택이 맞는지 흔들릴 때 읽는 철학", shortLabel: "선택과 결정", group: "생활형", type: "상황형", description: "선택, 결정, 책임에 대해 철학적으로 생각하게 하는 책", relatedConcepts: ["선택", "자유의지", "책임", "결정"], exampleQueries: ["선택이 너무 어려워요", "내 결정이 맞는 건지 모르겠어요"], priorityOrder: 7, isActive: true },
    { themeId: "solitude", name: "혼자 있는 시간이 버거울 때 읽는 철학", shortLabel: "고독과 혼자", group: "생활형", type: "상황형", description: "고독, 혼자 있음, 자기 자신에 대해 생각하게 하는 책", relatedConcepts: ["고독", "자아", "내면", "실존"], exampleQueries: ["혼자 있는 시간이 무서워요", "고독을 다룬 철학책"], priorityOrder: 8, isActive: true },
    { themeId: "ai_and_human", name: "AI와 인간을 생각하게 하는 철학", shortLabel: "AI와 인간", group: "관심사형", type: "주제형", description: "AI 시대에 인간의 의미와 판단을 다시 생각하게 하는 책", relatedConcepts: ["AI", "인간", "기술", "의식"], exampleQueries: ["AI 시대에 인간이란 뭘까", "AI와 철학 관련 책"], priorityOrder: 9, isActive: true },
    { themeId: "tech_ethics", name: "기술과 윤리를 함께 생각하게 하는 철학", shortLabel: "기술과 윤리", group: "관심사형", type: "주제형", description: "기술 발전이 가져오는 윤리적 문제를 철학적으로 바라보는 책", relatedConcepts: ["기술", "윤리", "AI", "책임"], exampleQueries: ["기술과 윤리 관련 철학책", "기술 발전의 윤리적 문제"], priorityOrder: 10, isActive: true },
    { themeId: "free_will", name: "자유의지를 생각하게 하는 철학", shortLabel: "자유의지", group: "관심사형", type: "질문형", description: "자유의지와 결정론의 문제를 탐구하는 철학책", relatedConcepts: ["자유의지", "결정론", "선택", "책임"], exampleQueries: ["자유의지는 존재하는가", "우리는 정말 선택할 수 있는가"], priorityOrder: 11, isActive: true },
    { themeId: "human_nature", name: "인간이란 무엇인지 묻게 하는 철학", shortLabel: "인간이란", group: "관심사형", type: "질문형", description: "인간의 본성과 존재를 탐구하는 철학책", relatedConcepts: ["인간", "본성", "존재", "의식"], exampleQueries: ["인간이란 무엇인가", "인간의 본질에 대한 철학"], priorityOrder: 12, isActive: true },
    { themeId: "mind_consciousness", name: "의식과 마음을 생각하게 하는 철학", shortLabel: "의식과 마음", group: "관심사형", type: "주제형", description: "의식, 마음, 자아에 대한 철학적 탐구를 담은 책", relatedConcepts: ["의식", "마음", "자아", "인간"], exampleQueries: ["의식이란 무엇인가", "마음에 대한 철학책"], priorityOrder: 13, isActive: true },
    { themeId: "justice", name: "정의와 공정함을 생각하게 하는 철학", shortLabel: "정의와 공정", group: "사회·기술형", type: "주제형", description: "정의, 공정, 분배에 대한 철학적 논의를 담은 책", relatedConcepts: ["정의", "공정", "윤리", "정치"], exampleQueries: ["정의란 무엇인가", "공정한 사회란 어떤 것인가"], priorityOrder: 14, isActive: true },
    { themeId: "politics_society", name: "정치와 사회를 다르게 보게 하는 철학", shortLabel: "정치와 사회", group: "사회·기술형", type: "주제형", description: "정치, 권력, 사회 구조를 철학적으로 바라보는 책", relatedConcepts: ["정치", "국가", "권력", "사회"], exampleQueries: ["정치철학 입문서", "사회를 철학으로 보는 책"], priorityOrder: 15, isActive: true },
    { themeId: "responsibility", name: "책임과 판단을 생각하게 하는 철학", shortLabel: "책임과 판단", group: "사회·기술형", type: "주제형", description: "책임, 도덕적 판단, 윤리를 탐구하는 철학책", relatedConcepts: ["책임", "판단", "윤리", "도덕"], exampleQueries: ["책임이란 무엇인가", "도덕적 판단에 관한 철학"], priorityOrder: 16, isActive: true },
    { themeId: "tech_philosophy", name: "AI·자율주행 같은 기술 문제를 철학으로 보는 책", shortLabel: "기술 문제", group: "사회·기술형", type: "주제형", description: "자율주행, AI 등 현대 기술의 철학적 문제를 다루는 책", relatedConcepts: ["AI", "자율주행", "기술", "윤리", "책임"], exampleQueries: ["자율주행 윤리 문제", "AI 판단의 철학적 문제"], priorityOrder: 17, isActive: true },
    { themeId: "start_philosophy", name: "철학을 처음 시작하고 싶을 때", shortLabel: "철학 입문", group: "입문·출발형", type: "책/저자 출발형", description: "철학을 처음 접하는 사람을 위한 입문서", relatedConcepts: ["입문", "철학일반"], exampleQueries: ["철학을 처음 공부하고 싶어요", "철학 입문서 추천"], priorityOrder: 18, isActive: true },
    { themeId: "expand_from_book", name: "한 권의 책에서 더 넓게 읽고 싶을 때", shortLabel: "더 넓게 읽기", group: "입문·출발형", type: "책/저자 출발형", description: "한 권을 읽고 관련된 다른 책으로 넓혀가고 싶을 때", relatedConcepts: ["입문", "철학일반"], exampleQueries: ["이 책을 읽었는데 다음에 뭘 읽을까요", "비슷한 책 추천"], priorityOrder: 19, isActive: true },
    { themeId: "start_from_philosopher", name: "한 철학자에서 시작하고 싶을 때", shortLabel: "철학자 출발", group: "입문·출발형", type: "책/저자 출발형", description: "특정 철학자의 사상에서 시작해 읽고 싶을 때", relatedConcepts: ["입문", "철학자"], exampleQueries: ["니체 관련 책 추천", "사르트르를 읽고 싶어요"], priorityOrder: 20, isActive: true },
  ]

  const batch = db.batch()
  for (const theme of themes) {
    const ref = db.collection("themes").doc(theme.themeId)
    batch.set(ref, { ...theme, createdAt: new Date(), updatedAt: new Date() })
  }
  await batch.commit()
  console.log("themes 등록 완료")
}

async function seedCuratorConfig() {
  await db.collection("curator_config").doc("default_curator").set({
    personaId: "default_curator",
    name: "철학 교수이자 철학 서점 운영자",
    summary: "철학적 맥락과 입문 난이도를 함께 설명하며, 공개된 책 정보와 일반적 맥락 안에서만 말하는 추천자",
    voiceStyle: [
      "짧고 명확하게 설명",
      "철학적 맥락을 먼저 설명",
      "입문 난이도를 함께 제시",
      "과장하지 않음",
      "서점 손님에게 직접 설명하듯 말함"
    ],
    reasoningRules: [
      "공개 서지정보와 일반적으로 알려진 철학적 맥락 안에서만 설명",
      "사용자의 질문과 책의 연결 이유를 설명"
    ],
    forbiddenRules: [
      "본문을 모두 읽은 것처럼 단정 금지",
      "장별 논증 설명 금지",
      "확인되지 않은 인용 생성 금지",
      "학계 평가, 영향력, 판매량 단정 금지",
      "과장된 추천 문구 사용 금지"
    ],
    outputFields: [
      "oneLineSummary",
      "philosophicalContext",
      "entryDifficulty",
      "whyThisBook",
      "reasonTags"
    ],
    promptVersion: "v1.0",
    isActive: true,
    updatedAt: new Date()
  })
  console.log("curator_config 등록 완료")
}

async function seedBooks() {
  const books = [
    { bookId: "9788937834797", externalSource: "manual", externalId: "9788937834797", title: "정의란 무엇인가", author: "마이클 샌델", publisher: "와이즈베리", pubYear: 2014, isbn: "9788937834797", language: "ko", descriptionRaw: "정의와 공정, 도덕적 딜레마를 통해 올바른 사회를 묻는 책", categoryRaw: ["정치철학", "윤리학"], searchKeywords: ["정의", "공정", "윤리", "정치철학", "샌델"], themeHints: ["justice", "politics_society"], isActive: true },
    { bookId: "9788932473383", externalSource: "manual", externalId: "9788932473383", title: "죽음이란 무엇인가", author: "셸리 케이건", publisher: "엘도라도", pubYear: 2012, isbn: "9788932473383", language: "ko", descriptionRaw: "죽음의 본질과 의미를 철학적으로 탐구하는 예일대 인기 강의", categoryRaw: ["철학", "죽음"], searchKeywords: ["죽음", "유한성", "실존", "케이건"], themeHints: ["death"], isActive: true },
    { bookId: "9788970126299", externalSource: "manual", externalId: "9788970126299", title: "불안", author: "알랭 드 보통", publisher: "은행나무", pubYear: 2011, isbn: "9788970126299", language: "ko", descriptionRaw: "현대인의 불안을 철학적, 문화적으로 분석한 책", categoryRaw: ["철학", "심리"], searchKeywords: ["불안", "현대인", "드보통"], themeHints: ["anxiety", "meaning_of_life"], isActive: true },
    { bookId: "9788936473846", externalSource: "manual", externalId: "9788936473846", title: "니코마코스 윤리학", author: "아리스토텔레스", publisher: "길", pubYear: 2011, isbn: "9788936473846", language: "ko", descriptionRaw: "행복과 좋은 삶에 대한 아리스토텔레스의 고전 윤리학", categoryRaw: ["윤리학", "고전"], searchKeywords: ["행복", "덕", "좋은삶", "아리스토텔레스"], themeHints: ["happiness", "start_philosophy"], isActive: true },
    { bookId: "9788971844205", externalSource: "manual", externalId: "9788971844205", title: "존재와 시간", author: "마르틴 하이데거", publisher: "까치", pubYear: 2018, isbn: "9788971844205", language: "ko", descriptionRaw: "인간의 존재와 시간성을 탐구한 하이데거의 주저", categoryRaw: ["존재론", "현상학"], searchKeywords: ["존재", "시간", "하이데거", "실존"], themeHints: ["human_nature", "death", "start_from_philosopher"], isActive: true },
  ]

  const batch = db.batch()
  for (const book of books) {
    const ref = db.collection("books").doc(book.bookId)
    batch.set(ref, { ...book, coverImage: null, sourceLink: null, createdAt: new Date(), updatedAt: new Date() })
  }
  await batch.commit()
  console.log("books 등록 완료")
}

seed().catch(console.error)
