/* =========================================================================
 *  Polite Craft — background.js (MV3 Service Worker)
 *  Receives translation requests from content scripts, calls DeepSeek API.
 * ========================================================================= */

// ─── Tone / Relationship prompt fragments ────────────────────────────────

const TONE_PROMPTS = {
  constructive:
    "Keep the tone constructive and solution-oriented. "
    + "Frame suggestions as actionable observations rather than demands. "
    + "Use phrases like \"Consider…\", \"It might help to…\", "
    + "\"One option could be…\" instead of \"You should\".",

  encouraging:
    "Keep the tone warm, encouraging, and positive. "
    + "Acknowledge the effort before suggesting improvements. "
    + "Use phrases like \"Nice start!\", \"This is heading in the right direction, "
    + "and we could…\", \"Great idea, one small tweak could be…\".",

  direct:
    "Keep the tone direct, clear, and efficient. "
    + "Skip pleasantries and get straight to the technical point. "
    + "Use precise, factual language. "
    + "State issues plainly: \"This will cause X\", "
    + "\"We need to change Y to Z\".",

  formal:
    "Keep the tone formal and professionally distant. "
    + "Use complete sentences and formal phrasing. "
    + "Avoid contractions and casual expressions. "
    + "Structure feedback clearly: observation → reasoning → recommendation.",

  request:
    "Keep the tone polite and request-oriented. "
    + "You are asking the recipient to take a specific action or help with something. "
    + "Use phrases like \"Could you…\", \"Would you mind…\", "
    + "\"It would be helpful if…\", \"When you have a moment, could…\". "
    + "State what you need clearly without sounding demanding or entitled.",

  inquiry:
    "Keep the tone curious and question-oriented. "
    + "You are seeking clarification, context, or the recipient's opinion — not assigning work. "
    + "Use phrases like \"Could you clarify…\", \"What do you think about…\", "
    + "\"I'm wondering whether…\", \"Is there a reason why…\". "
    + "Ask one focused question at a time and show you've read the prior context."
};

const RELATIONSHIP_PROMPTS = {
  contributor:
    "The recipient is an open-source community contributor you don't work with daily. "
    + "Maintain a respectful, welcoming tone. "
    + "Assume good intent and explain reasoning clearly, "
    + "since they may not share your team's internal context.",

  maintainer:
    "You are writing as an open-source community contributor. "
    + "The recipient is a project maintainer, reviewer, or core team member. "
    + "Be respectful and concise — acknowledge their time without over-apologizing "
    + "or using excessive pleasantries. "
    + "Explain your reasoning clearly when pushing back or asking questions, "
    + "since they review many contributions and appreciate direct, actionable updates.",

  colleague:
    "The recipient is a teammate or colleague you work with regularly. "
    + "You can be more direct and reference shared context. "
    + "A collegial, trust-based tone is appropriate — "
    + "no need for excessive formality or padding.",

  close_teammate:
    "The recipient is a close teammate or long-time collaborator. "
    + "Casual, friendly language is fine. "
    + "You can use shorthand, be concise, and skip formalities. "
    + "Think casual DM-level casualness, but still professional.",

  superior:
    "The recipient is your manager, team lead, or someone in a senior position. "
    + "Be respectful and concise. "
    + "Focus on actionable takeaways and clear reasoning. "
    + "Avoid overly casual language. "
    + "When suggesting changes, frame them as recommendations backed by evidence."
};

// ─── Context detection helpers ────────────────────────────────────────────

function detectPlatform(tabUrl) {
  if (!tabUrl) return null;
  if (tabUrl.includes("github.com/")) return "github";
  return null;
}

async function buildContext(platform, tab) {
  // Ask the content script to scrape the page
  try {
    const results = await chrome.tabs.sendMessage(tab.id, {
      action: "getContext",
      platform
    });
    return results || {};
  } catch {
    return {};
  }
}

// ─── Prompt assembly ─────────────────────────────────────────────────────

function assembleSystemPrompt({ context = {} }) {
  const ctxLines = [];

  if (context.platform === "github") {
    if (context.prTitle) ctxLines.push(`- PR Title: "${context.prTitle}"`);
    if (context.prBody) ctxLines.push(`- PR Description: ${context.prBody}`);
    const hasConversation = context.quotedComment || context.conversationHistory?.length;
    if (hasConversation) {
      ctxLines.push(
        "- Speaker labels in the conversation are anonymized role markers only. "
        + "\"current user\" is the person you are translating for; "
        + "\"user1\", \"user2\", etc. are other participants."
      );
    }
    if (context.quotedComment) {
      const quoted = typeof context.quotedComment === "string"
        ? { speaker: "unknown user", text: context.quotedComment }
        : context.quotedComment;
      if (quoted.text) {
        ctxLines.push(`- Reply target [${quoted.speaker || "unknown user"}]: "${quoted.text}"`);
      }
    }
    if (context.conversationHistory?.length) {
      ctxLines.push("- Recent conversation:");
      context.conversationHistory.forEach((h, i) => {
        ctxLines.push(`  ${i + 1}. [${h.speaker || "unknown user"}] ${h.text}`);
      });
    }
  }

  const contextBlock = ctxLines.length
    ? ctxLines.join("\n")
    : "- No additional page context was available. Rely on the user's Chinese draft alone.";

  return [
    "You are a cross-cultural communication assistant for software developers.",
    "Translate the user's Chinese draft into natural, professional English",
    "suitable for GitHub pull requests and issues.",
    "Tone and relationship preferences are provided in the user message; follow them strictly.",
    "",
    "## Context",
    contextBlock,
    "",
    "## Rules",
    "- Translate technical terms accurately (keep standard English terms, don't translate them to Chinese pinyin)",
    "- Match the tone and relationship specified in the user message",
    "- Do NOT literally translate Chinese pleasantries (e.g., \"辛苦\", \"麻烦\", \"谢谢\") — use natural English equivalents or omit if unnecessary",
    "- Do NOT output explanations, apologies, or meta-commentary",
    "- Output ONLY the translated English text, nothing else",
    "- If the Chinese draft is empty, generate an appropriate response based on the context alone"
  ].join("\n");
}

function assembleUserMessage({
  tone = "constructive",
  relationship = "contributor",
  userDraft = ""
}) {
  const toneDesc = TONE_PROMPTS[tone] || TONE_PROMPTS.constructive;
  const relDesc = RELATIONSHIP_PROMPTS[relationship] || RELATIONSHIP_PROMPTS.contributor;
  const draft = userDraft.trim();

  return [
    "## Style",
    `Tone (${tone}): ${toneDesc}`,
    "",
    `Relationship (${relationship}): ${relDesc}`,
    "",
    "## Chinese draft",
    draft || "(empty — generate an appropriate English response based on the context)",
    "",
    "Translate the Chinese draft into natural, professional English. Output ONLY the translated English text."
  ].join("\n");
}

function logCacheUsage(usage = {}) {
  const cacheHit = usage.prompt_cache_hit_tokens ?? 0;
  const cacheMiss = usage.prompt_cache_miss_tokens ?? 0;
  const promptTokens = usage.prompt_tokens ?? (cacheHit + cacheMiss);
  const completionTokens = usage.completion_tokens ?? 0;
  const hitRate = promptTokens > 0 ? Math.round((cacheHit / promptTokens) * 100) : 0;

  console.log(
    "[Polite Craft] LLM cache — hit:", cacheHit,
    "miss:", cacheMiss,
    "prompt:", promptTokens,
    "completion:", completionTokens,
    "hit rate:", hitRate + "%"
  );
}

// ─── DeepSeek API ────────────────────────────────────────────────────────

async function callDeepSeek(systemPrompt, userMessage, apiKey) {
  console.log("[Polite Craft] LLM request — system prompt:\n", systemPrompt);
  console.log("[Polite Craft] LLM request — user message:\n", userMessage);

  const resp = await fetch("https://api.deepseek.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: "deepseek-chat",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage }
      ],
      temperature: 0.7,
      max_tokens: 2048
    })
  });

  if (!resp.ok) {
    const errBody = await resp.text().catch(() => "");
    if (resp.status === 401 || resp.status === 403) {
      throw new Error("API Key is invalid or expired. Please update it in settings.");
    }
    throw new Error(`DeepSeek API error (${resp.status}): ${errBody.slice(0, 200)}`);
  }

  const data = await resp.json();
  logCacheUsage(data.usage);
  const text = data.choices?.[0]?.message?.content?.trim();

  if (!text) {
    throw new Error("DeepSeek returned an empty response.");
  }

  return text;
}

// ─── Message handler ─────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action !== "translate") return;

  (async () => {
    let apiKey;
    try {
      apiKey = await new Promise(resolve => {
        chrome.storage.local.get(["apiKey"], r => resolve(r.apiKey || ""));
      });
    } catch {
      sendResponse({ error: "Failed to read API Key from storage." });
      return;
    }

    if (!apiKey) {
      sendResponse({ error: "NO_KEY" });
      return;
    }

    const platform = detectPlatform(sender.tab?.url);
    const context = await buildContext(platform, sender.tab);

    const systemPrompt = assembleSystemPrompt({
      context: { ...context, platform }
    });
    const userMessage = assembleUserMessage({
      tone: msg.tone || "constructive",
      relationship: msg.relationship || "contributor",
      userDraft: msg.userInput || ""
    });

    try {
      const translated = await callDeepSeek(systemPrompt, userMessage, apiKey);
      sendResponse({ text: translated });
    } catch (err) {
      sendResponse({ error: err.message });
    }
  })();

  return true; // keep channel open for async sendResponse
});

// ─── Install hook ────────────────────────────────────────────────────────

chrome.runtime.onInstalled.addListener(({ reason }) => {
  if (reason === "install") {
    chrome.storage.local.set({
      tone: "constructive",
      relationship: "contributor"
    });
  }
});
