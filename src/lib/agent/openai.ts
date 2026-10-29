import OpenAI from "openai";

export const MODEL = process.env.OPENAI_MODEL || "gpt-5.4";
export const FAST_MODEL = process.env.OPENAI_FAST_MODEL || "gpt-5.4-mini";

let client: OpenAI | null = null;

export function openai(): OpenAI {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not configured on the server.");
  }
  client ??= new OpenAI({ timeout: 180_000, maxRetries: 1 });
  return client;
}

/** Reasoning models accept a reasoning effort; older chat models reject the parameter. */
export function reasoning(model: string, effort: "none" | "low" | "medium" = "low") {
  return /^(gpt-5|gpt-6|o\d)/.test(model) ? { reasoning: { effort } } : {};
}
