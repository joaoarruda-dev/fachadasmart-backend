import dotenv from "dotenv";
dotenv.config();

export const config = {
  OPENAI_KEY: process.env.OPENAI_KEY || "",
  GEMINI_API_KEY: process.env.GEMINI_API_KEY || "",
  OPENAI_MODEL: process.env.OPENAI_MODEL || "gpt-5.6-sol",
  CORS_ORIGIN: process.env.CORS_ORIGIN || "",
  PORT: process.env.PORT || 8080,
};
