import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";

dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function listModels() {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" }); // Dummy init to get client
    // We actually need to access the 'modelManager' or just use the API directly for listing
    // Since the SDK wrapper makes this tricky, we will use the fetch API directly for absolute truth.
    
    console.log("Checking available models for your API Key...");
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.GEMINI_API_KEY}`
    );
    
    const data = await response.json();
    
    if (data.models) {
      console.log("\n✅ AVAILABLE MODELS:");
      const names = data.models
        .filter(m => m.supportedGenerationMethods.includes("generateContent"))
        .map(m => m.name.replace("models/", ""));
      
      console.log(names.join("\n"));
      console.log("\n---------------------------------");
      console.log("👉 Please use one of the names above in your geminiService.js");
    } else {
      console.log("❌ No models found. Response:", data);
    }
  } catch (err) {
    console.error("Error:", err);
  }
}

listModels();