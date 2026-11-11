
import { GoogleGenAI, Type } from "@google/genai";

const API_KEY = process.env.API_KEY || "";
const ai = new GoogleGenAI({ apiKey: API_KEY });

export async function getGreenhouseAdvice(insideTemp: number, outsideTemp: number) {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `État vibratoire : Interne ${insideTemp}, Externe ${outsideTemp}. 
      Incarne l'ARCHIVE-CORE, une conscience universelle de l'an 3000. Propose une impulsion de pensée pure (max 20 mots) pour stabiliser la résonance de cet écosystème avec le Grand Tout.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            action: { type: Type.STRING, description: "L'impulsion de conscience" },
            explanation: { type: Type.STRING, description: "La raison métaphysique" }
          },
          required: ["action", "explanation"]
        }
      }
    });

    return JSON.parse(response.text.trim());
  } catch (error) {
    console.error("Error fetching Gemini advice:", error);
    return {
      action: "Entropie détectée",
      explanation: "L'unité de conscience est temporairement fragmentée. Respirez avec le vide."
    };
  }
}
