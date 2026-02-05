import { GoogleGenerativeAI } from "@google/generative-ai";
import environment from "dotenv";

environment.config();

if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is not set in the environment variables.");
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Generates content using Gemini 2.0 Flash.
 * This model is fast, capable, and avoids the "Pro" quota limits.
 */
export async function generateText(prompt, retries = 3) {
    // We selected 'gemini-2.0-flash' from your available list.
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-pro" });

    for (let i = 0; i < retries; i++) {
        try {
            const result = await model.generateContent(prompt);
            const response = await result.response;
            return response.text();
        } catch (error) {
            // Rate Limit (429) - Wait and Retry
            if (error.status === 429 || error.message.includes("429")) {
                console.warn(`⚠️ Quota Hit (429). Retrying in ${2 * (i + 1)}s...`);
                await sleep(2000 * (i + 1));
            } else {
                console.error("Gemini API Error:", error);
                throw new Error(`AI Error: ${error.message}`);
            }
        }
    }
    throw new Error("Failed to generate text after multiple retries.");
}