import { GoogleGenerativeAI } from "@google/generative-ai"
import dotenv from "dotenv"

dotenv.config({ path: ".env.local" })

async function checkModels() {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return
  const genAI = new GoogleGenerativeAI(apiKey)
  
  // Probe common patterns
  const patterns = [
    "gemini-2.5-flash",
    "gemini-3.0-flash",
    "gemini-3-flash",
    "gemini-3-flash-preview",
    "gemini-3.0-flash-preview-001"
  ]
  
  for (const model of patterns) {
    try {
        const result = await genAI.getGenerativeModel({ model }).generateContent("ping")
        console.log(`[AVAILABLE] ${model}`)
    } catch (e: any) {
        console.log(`[UNAVAILABLE] ${model}: ${e.message}`)
    }
  }
}

checkModels()
