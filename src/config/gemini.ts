import { GoogleGenAI } from '@google/genai';
import { config } from "./env";

export const gemini = new GoogleGenAI({ apiKey: config.GEMINI_API_KEY });