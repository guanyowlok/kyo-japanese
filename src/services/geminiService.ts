import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function getKanjiExplanation(kanji: string, mandarin: string) {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Explain the Japanese Kanji "${kanji}" and its relationship to the Mandarin word "${mandarin}". 
      Focus on similarities or differences in usage and meaning. 
      Provide the explanation in 2-3 short, clear sentences in English, but mention Mandarin nuances if applicable.`,
    });
    return response.text || "No explanation available.";
  } catch (error) {
    console.error("Error fetching kanji explanation:", error);
    return "Failed to load explanation. Please check your connection.";
  }
}
