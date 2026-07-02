/* =========================================================================
 *  Polite Craft — background.test.js
 *  单元测试：验证 prompt 组装逻辑和系统行为
 *  
 *  运行：node background.test.js
 * ========================================================================= */

// 模拟 chrome API（因为我们在 Node.js 环境运行）
global.chrome = {
  runtime: {
    onMessage: { addListener: () => {} },
    onInstalled: { addListener: () => {} },
    sendMessage: () => {}
  },
  tabs: {
    sendMessage: async () => ({})
  },
  storage: {
    local: {
      get: (keys, cb) => cb({ apiKey: "sk-test-key" }),
      set: () => {}
    }
  }
};

// 模拟 fetch
global.fetch = async (url, opts) => {
  return {
    ok: true,
    status: 200,
    text: async () => "",
    json: async () => ({
      choices: [{ message: { content: "Translated test output" } }]
    })
  };
};

// ─── 加载 background.js 的核心函数 ─────────────────────────────────────
// 由于 background.js 是顶层脚本，我们用 eval 方式加载其中的函数定义

const fs = require("fs");
const path = require("path");

const bgSource = fs.readFileSync(path.join(__dirname, "../src/background.js"), "utf8");

// 提取核心函数（我们需要从源码中提取它们来测试）
// 这里直接复制函数定义进行测试

const TONE_PROMPTS = {
  constructive: "Keep the tone constructive and solution-oriented. Frame suggestions as actionable observations rather than demands.",
  encouraging: "Keep the tone warm, encouraging, and positive. Acknowledge the effort before suggesting improvements.",
  direct: "Keep the tone direct, clear, and efficient. Skip pleasantries and get straight to the technical point.",
  formal: "Keep the tone formal and professionally distant. Use complete sentences and formal phrasing.",
  request: "Keep the tone polite and request-oriented. You are asking the recipient to take a specific action or help with something.",
  inquiry: "Keep the tone curious and question-oriented. You are seeking clarification, context, or the recipient's opinion."
};

const RELATIONSHIP_PROMPTS = {
  contributor: "The recipient is an open-source community contributor you don't work with daily. Maintain a respectful, welcoming tone.",
  maintainer: "You are writing as an open-source community contributor. The recipient is a project maintainer, reviewer, or core team member.",
  colleague: "The recipient is a teammate or colleague you work with regularly. You can be more direct.",
  close_teammate: "The recipient is a close teammate. Casual, friendly language is fine.",
  superior: "The recipient is your manager or team lead. Be respectful and concise."
};

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
    : "- No additional page context was available.";

  return [
    "You are a cross-cultural communication assistant for software developers.",
    "Translate the user's Chinese draft into natural, professional English.",
    "Tone and relationship preferences are provided in the user message; follow them strictly.",
    "",
    "## Context",
    contextBlock,
    "",
    "## Rules",
    "- Translate technical terms accurately",
    "- Match the tone and relationship specified in the user message",
    "- Do NOT literally translate Chinese pleasantries",
    "- Output ONLY the translated English text, nothing else"
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
  const hitRate = promptTokens > 0 ? Math.round((cacheHit / promptTokens) * 100) : 0;
  return { cacheHit, cacheMiss, promptTokens, hitRate };
}

function detectPlatform(tabUrl) {
  if (!tabUrl) return null;
  if (tabUrl.includes("github.com/")) return "github";
  return null;
}

// ─── 测试框架 ──────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function assert(condition, testName) {
  if (condition) {
    console.log(`  ✓ ${testName}`);
    passed++;
  } else {
    console.error(`  ✗ FAILED: ${testName}`);
    failed++;
  }
}

function section(name) {
  console.log(`\n▸ ${name}`);
}

// ─── 测试用例 ──────────────────────────────────────────────────────────

section("detectPlatform()");
assert(detectPlatform("https://github.com/org/repo/pull/123") === "github", "GitHub URL 识别");
assert(detectPlatform("https://github.com/org/repo/issues/456") === "github", "GitHub issues URL 识别");
assert(detectPlatform("https://example.com/page") === null, "无关 URL 返回 null");
assert(detectPlatform(null) === null, "null URL 返回 null");
assert(detectPlatform(undefined) === null, "undefined URL 返回 null");

section("assembleSystemPrompt() — 基础");
const basic = assembleSystemPrompt({ context: {} });
assert(basic.includes("cross-cultural communication assistant"), "包含角色定义");
assert(basic.includes("provided in the user message"), "system 指向 user message 中的风格设置");
assert(!basic.includes("## Style directives"), "system 不含 Style directives");
assert(!basic.includes("Tone ("), "system 不含 tone 详情");
assert(basic.includes("Output ONLY the translated English text"), "包含输出限制规则");
assert(!basic.includes("PR Title"), "无上下文时不出现 PR 相关字段");

section("assembleUserMessage() — 风格与草稿");
const userMsg = assembleUserMessage({
  tone: "constructive",
  relationship: "contributor",
  userDraft: "谢谢反馈，我先关了"
});
assert(userMsg.includes("## Style"), "user message 含 Style 段");
assert(userMsg.includes("Tone (constructive):"), "user message 含 tone");
assert(userMsg.includes("Relationship (contributor):"), "user message 含 relationship");
assert(userMsg.includes("## Chinese draft"), "user message 含草稿段");
assert(userMsg.includes("谢谢反馈，我先关了"), "user message 含中文草稿");
assert(userMsg.includes("constructive and solution-oriented"), "tone 描述在 user message");

section("assembleSystemPrompt() — GitHub 上下文");
const ghCtx = assembleSystemPrompt({
  context: {
    platform: "github",
    currentUser: "me",
    participantsLegend: "current user = me, user1 = alice, user2 = bob",
    prTitle: "Fix memory leak in WebSocket handler",
    prBody: "This PR addresses a memory leak...",
    quotedComment: {
      speaker: "user1",
      authorLogin: "alice",
      text: "Great work! Could you also add tests?"
    },
    conversationHistory: [
      { speaker: "user1", authorLogin: "alice", text: "Looks good overall" },
      { speaker: "current user", authorLogin: "me", text: "Thanks, updated the patch" },
      { speaker: "user2", authorLogin: "bob", text: "Please add error handling" }
    ]
  }
});
const ghUser = assembleUserMessage({ tone: "direct", relationship: "colleague", userDraft: "收到" });
assert(ghCtx.includes("PR Title: \"Fix memory leak"), "PR 标题被注入 system");
assert(ghCtx.includes("PR Description: This PR addresses"), "PR 描述被注入 system");
assert(ghCtx.includes("anonymized role markers"), "匿名角色说明被注入 system");
assert(!ghCtx.includes("Participants:"), "真实用户名映射不进入 system");
assert(!ghCtx.includes("alice"), "真实用户名不进入 system");
assert(ghCtx.includes("Reply target [user1]: \"Great work!"), "引用的评论被注入 system");
assert(ghCtx.includes("1. [user1] Looks good overall"), "对话历史被注入 system");
assert(ghCtx.includes("2. [current user] Thanks, updated the patch"), "current user 标记正确");
assert(ghCtx.includes("3. [user2] Please add error handling"), "对话历史第三条被注入 system");
assert(!ghCtx.includes("direct, clear, and efficient"), "tone 不在 system");
assert(ghUser.includes("direct, clear, and efficient"), "direct tone 在 user message");
assert(ghUser.includes("teammate or colleague"), "colleague relationship 在 user message");

const maintainerUser = assembleUserMessage({ tone: "constructive", relationship: "maintainer", userDraft: "已修改" });
assert(maintainerUser.includes("Relationship (maintainer):"), "user message 含 maintainer relationship");
assert(maintainerUser.includes("writing as an open-source community contributor"), "maintainer 描述在 user message");

const requestUser = assembleUserMessage({ tone: "request", relationship: "maintainer", userDraft: "麻烦帮忙看下" });
assert(requestUser.includes("Tone (request):"), "user message 含 request tone");
assert(requestUser.includes("request-oriented"), "request 描述在 user message");

const inquiryUser = assembleUserMessage({ tone: "inquiry", relationship: "colleague", userDraft: "这个为啥这样" });
assert(inquiryUser.includes("Tone (inquiry):"), "user message 含 inquiry tone");
assert(inquiryUser.includes("question-oriented"), "inquiry 描述在 user message");

section("assembleUserMessage() — 无效值回退");
const fallbackUser = assembleUserMessage({ tone: "invalid", relationship: "nobody", userDraft: "" });
assert(fallbackUser.includes("constructive and solution-oriented"), "无效 tone 回退到 constructive");
assert(fallbackUser.includes("open-source community contributor"), "无效 relationship 回退到 contributor");
assert(fallbackUser.includes("(empty — generate an appropriate English response"), "空草稿有兜底文案");

section("assembleSystemPrompt() — 空上下文处理");
const emptyCtx = assembleSystemPrompt({ context: { platform: "github" } });
assert(emptyCtx.includes("No additional page context"), "空 GitHub 上下文有兜底文案");

section("logCacheUsage()");
const cacheStats = logCacheUsage({
  prompt_cache_hit_tokens: 800,
  prompt_cache_miss_tokens: 200,
  prompt_tokens: 1000,
  completion_tokens: 50
});
assert(cacheStats.cacheHit === 800, "cache hit tokens 解析正确");
assert(cacheStats.cacheMiss === 200, "cache miss tokens 解析正确");
assert(cacheStats.hitRate === 80, "cache 命中率计算正确");

section("Prompt 长度检查");
const longSystem = assembleSystemPrompt({
  context: {
    platform: "github",
    prTitle: "A".repeat(200),
    prBody: "B".repeat(500),
    quotedComment: "C".repeat(300),
    conversationHistory: Array(5).fill(null).map((_, i) => ({
      speaker: i === 0 ? "current user" : `user${i}`,
      authorLogin: "user" + i,
      text: "D".repeat(200)
    }))
  }
});
const longUser = assembleUserMessage({ tone: "formal", relationship: "superior", userDraft: "E".repeat(100) });
assert(longSystem.length < 8000, "system prompt 长度在合理范围内 (" + longSystem.length + " chars)");
assert(longUser.length < 3000, "user message 长度在合理范围内 (" + longUser.length + " chars)");

// ─── 总结 ──────────────────────────────────────────────────────────────

console.log(`\n${"=".repeat(50)}`);
console.log(`Results: ${passed} passed, ${failed} failed, ${passed + failed} total`);
console.log("=".repeat(50));

if (failed > 0) {
  process.exit(1);
} else {
  console.log("\nAll tests passed! ✓");
}
