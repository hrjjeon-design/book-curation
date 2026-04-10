import { db } from "@/lib/firebase/admin"
import { NextRequest } from "next/server"

export const dynamic = "force-dynamic"

// Simple in-memory cache
let cachedThemes: any[] | null = null
let cacheTimestamp: number = 0
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

async function getAllThemes() {
  const now = Date.now()
  if (cachedThemes && now - cacheTimestamp < CACHE_TTL) {
    return cachedThemes
  }

  const themesSnapshot = await db
    .collection("themes")
    .where("isActive", "==", true)
    .get()

  cachedThemes = themesSnapshot.docs.map((doc: any) => ({
    ...doc.data(),
  }))
  cacheTimestamp = now
  return cachedThemes
}

// mulberry32 based seeded PRNG
function mulberry32(seed: number) {
  return function () {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function hashSeed(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0
  }
  return hash
}

/**
 * Shuffles an array. If a seed is provided, it uses a predictable shuffle.
 */
function shuffleArray<T>(array: T[], randomFunc: () => number): T[] {
  const arr = [...array]
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(randomFunc() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const seed = searchParams.get("seed")
    const countParam = searchParams.get("count")
    const totalTargetCount = countParam ? parseInt(countParam) : 20

    const random = seed ? mulberry32(hashSeed(seed)) : Math.random

    const allThemes = await getAllThemes()
    
    // Group categories
    const groups: Record<string, any[]> = {
      "생활형": allThemes.filter(t => t.group === "생활형"),
      "관심사형": allThemes.filter(t => t.group === "관심사형"),
      "사회·기술형": allThemes.filter(t => t.group === "사회·기술형"),
      "입문·출발형": allThemes.filter(t => t.group === "입문·출발형"),
    }

    // Baseline ratios: 8:5:4:3 = 20
    const BASE_RATIOS = [
      { name: "생활형", ratio: 8 },
      { name: "관심사형", ratio: 5 },
      { name: "사회·기술형", ratio: 4 },
      { name: "입문·출발형", ratio: 3 },
    ]
    const BASE_TOTAL = 20

    const config = BASE_RATIOS.map(({ name, ratio }) => ({
      name,
      target: Math.max(1, Math.round((ratio / BASE_TOTAL) * totalTargetCount)),
    }))

    let selectedThemes: any[] = []

    config.forEach(groupConfig => {
      const groupThemes = groups[groupConfig.name] || []
      if (groupThemes.length === 0) return

      const coreThemes = groupThemes.filter(t => t.tier === "core")
      
      // 1. Ensure at least 1-2 core themes per group (using consistent random)
      const coreLimit = Math.min(coreThemes.length, 2)
      const coreToPickCount = Math.min(coreThemes.length, Math.floor(random() * coreLimit) + 1)
      const shuffledCore = shuffleArray(coreThemes, random)
      const pickedCore = shuffledCore.slice(0, coreToPickCount)
      
      selectedThemes = [...selectedThemes, ...pickedCore]

      // 2. Pick remaining from the pool (excluding already picked)
      const remainingCount = groupConfig.target - pickedCore.length
      const remainingPool = groupThemes.filter(t => !pickedCore.some(p => p.themeId === t.themeId))
      const shuffledOthers = shuffleArray(remainingPool, random)
      const pickedOthers = shuffledOthers.slice(0, Math.max(0, remainingCount))
      
      selectedThemes = [...selectedThemes, ...pickedOthers]
    })

    // Fallback: If for some reason we picked nothing (e.g. encoding issues with keys), 
    // return a default set of 20 themes at least.
    if (selectedThemes.length === 0) {
      console.warn("No themes selected in sampled logic, falling back to simple slice.")
      selectedThemes = allThemes.slice(0, totalTargetCount)
    }

    // Final shuffle to mix groups
    const finalThemes = shuffleArray(selectedThemes, random)

    return Response.json(finalThemes)
  } catch (error) {
    console.error("Error fetching themes:", error)
    return Response.json({ error: "Failed to fetch themes" }, { status: 500 })
  }
}
