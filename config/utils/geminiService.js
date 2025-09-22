import { GoogleGenerativeAI } from "@google/generative-ai";
import environment from "dotenv";

environment.config();

if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is not set in the environment variables.");
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

/**
 * Generates content based on a given prompt using the Gemini model.
 * @param {string} prompt The text prompt to send to the model.
 * @returns {Promise<string>} The generated text response.
 */
export async function generateText(prompt) {
  try {
    // CORRECTED: Use a current and recommended model name
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" }); 
    
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    return text;
  } catch (error) {
    console.error("Error generating text with Gemini:", error);
    const errorMessage = error.response?.data?.error?.message || error.message;
    throw new Error(`Failed to communicate with the AI model: ${errorMessage}`);
  }
}