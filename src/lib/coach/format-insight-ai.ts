import OpenAI from "openai";

import type { InsightBundle } from "@/lib/coach/insights";

const SYSTEM =
  "You comply strictly with 'no invented data' rules. You only rephrase what is given.";

function buildUserPrompt(payload: {
  positives: string[];
  warnings: string[];
  recommendation: string;
  metricsShownToUserOnly: Record<string, number | null>;
}): string {
  const FEATURES_JSON = JSON.stringify(
    {
      bulletSummary:
        "Rule engine output for today's workout vs recent training.",
      positives: payload.positives,
      warnings: payload.warnings,
      recommendation: payload.recommendation,
      metricsShownToUserOnly: payload.metricsShownToUserOnly,
    },
    null,
    2
  );

  return `You rewrite coach notes for an athlete.

INPUT JSON:
${FEATURES_JSON}

RULES:
- Do not add injuries, diagnoses, mileage, durations, HR, or advice not present in the JSON.
- You may shorten, reorganize, and smooth language only.

OUTPUT STRUCTURE:
1. One paragraph, at most four short lines summarizing today's session using ONLY the labeled facts.
2. Then exactly these headings and bullet lists:
What went well
Watch out
Tomorrow

If a list would be empty, write "None noted" once under that heading.
Use the SAME meaning as positives/warnings/recommendation; don't contradict them.`;
}

export async function formatInsightWithAI(
  insights: InsightBundle,
  metricsShownToUserOnly: Record<string, number | null>
): Promise<string> {
  const key = process.env.OPENAI_API_KEY;
  if (!key?.trim()) {
    throw new Error("OPENAI_API_KEY is not set");
  }

  const client = new OpenAI({ apiKey: key });
  const user = buildUserPrompt({
    positives: insights.positives,
    warnings: insights.warnings,
    recommendation: insights.recommendation,
    metricsShownToUserOnly,
  });

  const completion = await client.chat.completions.create({
    model: process.env.OPENAI_COACH_MODEL ?? "gpt-4o-mini",
    temperature: 0.35,
    messages: [
      { role: "system", content: SYSTEM },
      { role: "user", content: user },
    ],
  });

  const text = completion.choices[0]?.message?.content?.trim();
  if (!text) {
    throw new Error("OpenAI returned empty content");
  }
  return text;
}
