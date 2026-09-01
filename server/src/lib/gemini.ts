/**
 * Configured Gemini client — constructed once here so chatService (the only current
 * caller) doesn't re-read the API key or re-instantiate the SDK on every request.
 */
import { GoogleGenAI } from "@google/genai";
import { config } from "../config.js";

export const gemini = new GoogleGenAI({ apiKey: config.geminiApiKey });

// Pinned here rather than inlined in chatService so a future model bump is a one-line
// change, same spirit as `activeProvider` in stationsService.
export const CHAT_MODEL = "gemini-3.5-flash";
