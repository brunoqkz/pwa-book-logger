import { GoogleGenerativeAI } from "@google/generative-ai";

const AIModel = new GoogleGenerativeAI(
  process.env.GOOGLE_GENERATIVE_AI_API_KEY,
).getGenerativeModel({ model: "gemini-1.5-flash" });

async function generateResponse(bookData, prompt) {
  try {
    const result = await AIModel.generateContent(
      `Based on my book collection: ${JSON.stringify(bookData)}, ${prompt}`,
    );
    return result.response.text();
  } catch (error) {
    console.error("AI generation error:", error);
    throw error;
  }
}

export { generateResponse };
