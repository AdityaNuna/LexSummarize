import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "10mb" }));

  // API Route for Gemini Summarization
  app.post("/api/summarize", async (req, res) => {
    try {
      const { text, customApiKey, analysisType } = req.body;
      
      if (!text) {
        return res.status(400).json({ error: "No text provided for summarization" });
      }

      // Use the provided custom API key or fallback to environment key
      let apiKey = customApiKey || process.env.GEMINI_API_KEY;
      
      if (!apiKey || apiKey === "MY_GEMINI_API_KEY" || apiKey.trim() === "" || apiKey.includes("YOUR_") || apiKey.includes("MY_")) {
        return res.status(401).json({ 
          error: "Gemini API Key is missing or using a placeholder. Please click the Settings gear icon in the top right corner of LexSummarize and paste your actual Gemini API Key to get started." 
        });
      }

      const ai = new GoogleGenAI({
        apiKey: apiKey,
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build",
          },
        },
      });

      let prompt = "";
      if (analysisType === "filac") {
        prompt = `
          You are an expert Indian Legal Consultant. Analyze the following legal judgment/text using the FILAC method (Facts, Issues, Law, Analysis, Conclusion).
          Please provide a structured response in Markdown.
          
          Requirements:
          - Use professional legal terminology.
          - Structure the response with these exact headers:
            ## 1. Case Name & Court
            ## 2. Parties Involved & Advocates
            ## 3. Facts
            ## 4. Issues
            ## 5. Law / Legal Basis
            ## 6. Analysis
            ## 7. Conclusion
          - Use bullet points (*) for lists of facts, issues, or key provisions.
          - Use bold (**text**) for emphasis on names, precedents, or dates. Use proper markdown.
          - Include names of Advocates/Counsel if mentioned in the text.
          - Ensure clarity, legal depth, and conciseness.

          Legal Text:
          ${text}
        `;
      } else {
        prompt = `
          You are an expert Indian Legal Consultant. Summarize the following court order/legal text in a structured Markdown format suitable for lawyers.
          
          Requirements:
          - Use professional legal terminology.
          - Structure the response with these exact headers:
            ## 1. Case Name & Court
            ## 2. Parties Involved & Advocates
            ## 3. Key Facts
            ## 4. Legal Issues
            ## 5. Court's Decision
            ## 6. Next Steps / Compliance Required
          - Use bullet points (*) for 'Key Facts'.
          - Use bold (**text**) for emphasis on names or dates. Use proper markdown.
          - Include names of Advocates/Counsel if mentioned in the text.
          - Ensure clarity and conciseness.

          Legal Text:
          ${text}
        `;
      }

      // Helper to generate content with exponential backoff retries for transient failures (e.g. 503, 429)
      async function generateWithRetry(modelName: string, contents: string, retries = 3, delayMs = 1000): Promise<any> {
        try {
          return await ai.models.generateContent({
            model: modelName,
            contents: contents,
          });
        } catch (error: any) {
          const errMsg = error.message || "";
          const isTransient = errMsg.includes("503") || 
                              errMsg.includes("UNAVAILABLE") || 
                              errMsg.includes("429") || 
                              errMsg.includes("high demand") ||
                              errMsg.includes("exhausted");

          if (isTransient && retries > 0) {
            console.warn(`Transient error calling ${modelName}. Retrying in ${delayMs}ms... (${retries} attempts left). Error: ${errMsg}`);
            await new Promise((resolve) => setTimeout(resolve, delayMs));
            return generateWithRetry(modelName, contents, retries - 1, delayMs * 2);
          }
          throw error;
        }
      }

      let response;
      try {
        response = await generateWithRetry("gemini-3.5-flash", prompt);
      } catch (geminiError: any) {
        console.warn("Primary model gemini-3.5-flash failed or was overloaded, trying fallback to gemini-flash-latest...");
        try {
          response = await generateWithRetry("gemini-flash-latest", prompt);
        } catch (fallbackError: any) {
          throw geminiError; // Throw the primary error if both fail
        }
      }

      res.json({ summary: response.text });
    } catch (error: any) {
      console.error("Gemini Error:", error);
      let errMsg = "Failed to summarize text";
      if (error && typeof error.message === "string") {
        errMsg = error.message;
      } else if (typeof error === "string") {
        errMsg = error;
      } else if (error && typeof error.toString === "function") {
        errMsg = error.toString();
      }

      // Check for specific issues using a robust regex/substring helper
      let isApiKeyError = false;
      let isRateLimitError = false;
      let isServiceUnavailable = false;

      const checkErrorForIssues = (errObj: any) => {
        if (!errObj) return;
        const str = typeof errObj === "string" ? errObj : JSON.stringify(errObj);
        const lower = str.toLowerCase();
        
        if (lower.includes("api key not valid") || 
            lower.includes("api_key_invalid") || 
            lower.includes("invalid api key") ||
            lower.includes("key is invalid") ||
            lower.includes("invalid key") ||
            lower.includes("api key is invalid")) {
          isApiKeyError = true;
        }
        
        if (lower.includes("429") || 
            lower.includes("resource_exhausted") || 
            lower.includes("quota") || 
            lower.includes("limit")) {
          isRateLimitError = true;
        }

        if (lower.includes("503") || 
            lower.includes("unavailable") || 
            lower.includes("high demand") ||
            lower.includes("temporary spike")) {
          isServiceUnavailable = true;
        }
      };

      // Scan error structure
      checkErrorForIssues(error);
      if (error && error.message) checkErrorForIssues(error.message);
      if (error && error.status) {
        if (error.status === 401) isApiKeyError = true;
        if (error.status === 429) isRateLimitError = true;
        if (error.status === 503) isServiceUnavailable = true;
      }

      if (isApiKeyError) {
        return res.status(401).json({ 
          error: "The provided Gemini API key is invalid or inactive. Please click the Settings gear icon in the top right corner of LexSummarize and enter a valid, active Gemini API Key." 
        });
      }

      if (isServiceUnavailable) {
        return res.status(503).json({
          error: "LexSummarize's AI is currently experiencing unusually high demand. These spikes are usually very temporary. Please wait 5 to 10 seconds and click 'Summarize Case' again."
        });
      }

      if (isRateLimitError) {
        return res.status(429).json({
          error: "The Gemini API rate limits or free-tier quota have been temporarily exceeded (250k input tokens/minute limit). Please wait 10-15 seconds and click 'Summarize Legal Text' again, or click the Settings gear icon in the top right of LexSummarize to add your own personal Gemini API Key for fast, unlimited access."
        });
      }

      res.status(500).json({ error: errMsg });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
