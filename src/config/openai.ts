import { OpenAI } from "openai";
import { config } from "./env";

export const openai = new OpenAI({ apiKey: config.OPENAI_KEY });
