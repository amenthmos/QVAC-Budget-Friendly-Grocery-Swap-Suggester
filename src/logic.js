// QVAC Budget-Friendly Grocery Swap Suggester — core logic.
// Suggests 2-3 cheaper alternatives for an expensive grocery item, with a
// brief tradeoff note. Never states specific prices/dollar amounts, since
// the on-device model cannot know real current prices.

import { completion } from "@qvac/sdk";

function looksUnusable(text) {
  if (!text || text.trim().length === 0) return true;
  const bad = ["i cannot", "i can't", "as an ai", "i'm not able", "i am not able"];
  const lower = text.toLowerCase();
  return bad.some((phrase) => lower.includes(phrase));
}

// Deterministically strip any price/dollar-amount mentions the model may
// have hallucinated, since it cannot know real current prices.
function stripPrices(text) {
  return text
    .replace(/[$€£]\s?\d+(\.\d+)?/g, "")
    .replace(/\b\d+(\.\d+)?\s?(dollars|usd|cents|bucks)\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function fallbackSwaps(item) {
  return [
    { name: `store-brand ${item}`, note: "Usually the same quality tier at a lower shelf price than name brands." },
    { name: `frozen or canned ${item}`, note: "Keeps longer and is often cheaper per serving, with a small texture tradeoff." },
    { name: `a seasonal or bulk-bin alternative to ${item}`, note: "Buying what's in season or from bulk bins tends to cost less, though selection varies." },
  ];
}

function parseSwaps(text) {
  const lines = text
    .split("\n")
    .map((l) => l.replace(/^[\s\-*\d.)]+/, "").trim())
    .filter((l) => l.length > 0);

  const swaps = [];
  for (const line of lines) {
    // Require whitespace around the separator so a hyphenated food name
    // (e.g. "store-bought yogurt") doesn't get mis-split mid-word.
    const m = line.match(/^(.+?)\s[-–—:]\s(.+)$/);
    if (m) {
      swaps.push({ name: m[1].trim(), note: m[2].trim() });
    } else if (line.length > 3) {
      swaps.push({ name: line, note: "" });
    }
  }
  return swaps;
}

export async function suggestSwaps(modelId, body) {
  const item = (body.item || "").trim();
  if (!item) {
    const err = new Error("Please enter a grocery item first.");
    err.statusCode = 400;
    throw err;
  }

  const run = completion({
    modelId,
    history: [
      {
        role: "system",
        content:
          "You suggest cheaper grocery alternatives. For the item given, list 2-3 " +
          "cheaper alternative items, one per line, formatted as " +
          '"Alternative — brief tradeoff note". Never mention specific prices, ' +
          "dollar amounts, or percentages, since you do not know real current " +
          "prices. Keep each tradeoff note to one short sentence. Reply with " +
          "ONLY the list, no preamble.",
      },
      { role: "user", content: "Expensive item: salmon fillets" },
      {
        role: "assistant",
        content:
          "Canned or pouched salmon — similar protein and omega-3s, softer texture and less presentation appeal.\n" +
          "Tilapia or other whitefish — much milder flavor and lower cost, but less rich in omega-3s.\n" +
          "Canned tuna — very shelf-stable and cheap, though the flavor and texture differ noticeably from fresh salmon.",
      },
      { role: "user", content: `Expensive item: ${item}` },
    ],
    stream: true,
    completionOpts: { temperature: 0.6, maxTokens: 220 },
  });

  let text = "";
  for await (const token of run.tokenStream) text += token;
  text = stripPrices(text.trim().replace(/^here'?s[^:\n]*:\s*/i, "").trim());

  let swaps = looksUnusable(text) ? [] : parseSwaps(text);
  // Grounding check: a "swap" that is literally the same item as the input
  // isn't a real alternative — drop it.
  swaps = swaps.filter(
    (s) => s.name && s.name.toLowerCase() !== item.toLowerCase()
  );
  // The model sometimes suggests something that defeats the whole point of
  // a BUDGET-friendly suggester by admitting in its own note that the
  // "alternative" costs more (e.g. "smoked salmon — more expensive"). Drop
  // any swap whose own note says it's pricier.
  const COST_INCREASE_PHRASES = [
    "more expensive", "pricier", "costs more", "higher price", "higher cost",
    "less affordable", "less budget", "not as cheap", "not cheaper",
    "extra cost", "added cost", "adds cost", "premium price", "luxurious",
  ];
  swaps = swaps.filter((s) => {
    const combined = `${s.name} ${s.note}`.toLowerCase();
    return !COST_INCREASE_PHRASES.some((p) => combined.includes(p));
  });

  if (swaps.length === 0) swaps = fallbackSwaps(item);
  swaps = swaps.slice(0, 3);

  return { item, swaps };
}
