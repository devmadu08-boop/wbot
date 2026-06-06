import axios from "axios";
import { config } from "../config.js";
import { getSetting } from "../db.js";

function detectLanguage(text) {
  const sinhala = /[\u0D80-\u0DFF]/.test(text);
  const english = /[A-Za-z]/.test(text);
  if (sinhala && english) return "mixed Sinhala-English";
  if (sinhala) return "Sinhala";
  return "English";
}

export async function buildPrompt({ message, contact, context, samples }) {
  const language = detectLanguage(message);
  const examples = samples.length
    ? samples.map((sample, index) => `${index + 1}. ${sample.text}`).join("\n")
    : "No examples yet. Use short, friendly, casual WhatsApp style.";

  const system = [
    "You are replying as Madu.",
    "Reply naturally like Madu, not like a formal assistant.",
    "If the user writes Sinhala, reply in Sinhala. If English, reply in English. If mixed, reply mixed.",
    "Keep it short, friendly, human, and WhatsApp-style.",
    "Do not mention you are AI."
  ].join(" ");

  const user = `
Contact nickname: ${contact?.nickname || contact?.name || contact?.push_name || "friend"}
Detected language: ${language}

Recent chat context:
${context || "No recent context."}

Madu style examples:
${examples}

User message:
${message}

Write only the reply.
`.trim();

  return { system, user, language };
}

export async function generateReply({ message, contact, context, samples, settings }) {
  const apiKey = settings.openrouter_api_key || config.openRouterApiKey || (await getSetting("openrouter_api_key", ""));
  if (!apiKey) throw new Error("OpenRouter API key is missing");

  const prompt = await buildPrompt({ message, contact, context, samples });
  const model = settings.openrouter_model || "openai/gpt-4o-mini";
  const response = await axios.post(
    "https://openrouter.ai/api/v1/chat/completions",
    {
      model,
      messages: [
        { role: "system", content: prompt.system },
        { role: "user", content: prompt.user }
      ],
      temperature: Number(settings.openrouter_temperature || 0.75),
      max_tokens: Number(settings.openrouter_max_tokens || 180)
    },
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "http://localhost",
        "X-Title": "Madu AI WhatsApp Assistant"
      },
      timeout: 30000
    }
  );

  return {
    text: response.data.choices?.[0]?.message?.content?.trim() || settings.fallback_message,
    prompt: `${prompt.system}\n\n${prompt.user}`,
    tokens: response.data.usage?.total_tokens || 0
  };
}
