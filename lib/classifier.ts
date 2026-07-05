import type { SiteId } from "./messaging";

const CODING_KEYWORDS = ["code", "debug", "script", "function", "api", "react", "html", "css", "python", "javascript", "typescript", "bug"];
const CREATIVE_KEYWORDS = ["write", "story", "poem", "essay", "blog", "draft", "creative", "article"];
const FACTUAL_KEYWORDS = ["what is", "who is", "when did", "define", "summarize", "explain", "capital of", "how many"];

/**
 * Very basic client-side classifier.
 * Checks for keyword matches and recommends target AIs based on context.
 * Returns null if no strong signal is detected.
 */
export function classifyPrompt(prompt: string): SiteId[] | null {
  const p = prompt.toLowerCase();
  
  // Count matches to resolve ties
  let codingScore = 0;
  let creativeScore = 0;
  let factualScore = 0;

  for (const kw of CODING_KEYWORDS) {
    if (p.includes(kw)) codingScore++;
  }
  for (const kw of CREATIVE_KEYWORDS) {
    if (p.includes(kw)) creativeScore++;
  }
  for (const kw of FACTUAL_KEYWORDS) {
    if (p.includes(kw)) factualScore++;
  }

  const maxScore = Math.max(codingScore, creativeScore, factualScore);

  if (maxScore === 0) return null;

  // Resolve winner
  if (codingScore === maxScore) {
    return ["chatgpt", "claude"];
  } else if (creativeScore === maxScore) {
    return ["claude", "gemini"];
  } else if (factualScore === maxScore) {
    return ["chatgpt"];
  }

  return null;
}
