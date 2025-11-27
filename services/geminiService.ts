import { GoogleGenAI, Type } from "@google/genai";

// Initialize Gemini
// Note: In a production environment, ensure process.env.API_KEY is defined.
// If running locally without env, this might throw if not configured.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

export const generateMarketingMessage = async (
  topic: string,
  tone: 'formal' | 'casual' | 'urgent',
  maxLength: number
): Promise<string> => {
  if (!process.env.API_KEY) {
    return "Error: Gemini API Key is missing in environment variables.";
  }

  try {
    const prompt = `
      Write a WhatsApp message about "${topic}".
      Tone: ${tone}.
      Maximum length: around ${maxLength} characters.
      Do not include hashtags.
      Include appropriate emojis.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    return response.text || "Failed to generate text.";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "Error generating content. Please check console.";
  }
};

export const analyzeSentiment = async (message: string): Promise<{ sentiment: string; score: number }> => {
  if (!process.env.API_KEY) return { sentiment: 'unknown', score: 0 };

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `Analyze the sentiment of this text: "${message}". Return JSON with keys: sentiment (Positive, Negative, Neutral) and score (1-10).`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            sentiment: { type: Type.STRING },
            score: { type: Type.NUMBER },
          }
        }
      }
    });
    
    const text = response.text;
    if (!text) throw new Error("No text returned");
    return JSON.parse(text);
  } catch (e) {
    console.error(e);
    return { sentiment: 'error', score: 0 };
  }
}
