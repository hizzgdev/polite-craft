/* =========================================================================
 *  Polite Craft — content.test.js
 *  单元测试：验证 content.js 中的 DOM 检测逻辑和注入行为
 *  
 *  使用 JSDOM 模拟浏览器环境
 *  
 *  运行：npm install jsdom && node content.test.js
 *         或：node content.test.js（如果已安装）
 * ========================================================================= */

const fs = require("fs");
const path = require("path");

// 尝试加载 JSDOM
let JSDOM;
try {
  JSDOM = require("jsdom").JSDOM;
} catch {
  console.log("jsdom 未安装，跳过 DOM 测试。安装: npm install jsdom");
  process.exit(0);
}

const { window } = new JSDOM("<!DOCTYPE html><html><body></body></html>");
global.window = window;
global.document = window.document;
global.Node = window.Node;
global.MutationObserver = window.MutationObserver || class {
  observe() {}
  disconnect() {}
};

// 模拟 chrome.runtime API
global.chrome = {
  runtime: {
    onMessage: { addListener: (fn) => { global._onMessageHandler = fn; } },
    sendMessage: async () => ({ text: "translated" })
  },
  storage: {
    local: {
      get: (keys, cb) => cb({ tone: "constructive", relationship: "contributor" }),
      set: () => {}
    }
  }
};

// ─── 提取 content.js 中的关键函数进行测试 ───────────────────────────────

function isRelevantTextarea(el) {
  if (el.tagName !== "TEXTAREA") return false;
  if (el.closest('[data-testid="comment-composer"], #react-issue-comment-composer, '
    + 'form.js-new-comment-form, form.js-comment-update, '
    + '#discussion_bucket, #all_commit_comments, .review-comment')) return true;
  return false;
}

function isRelevantEditable(el) {
  if (el.getAttribute("contenteditable") !== "true") return false;
  if (el.closest('[data-testid="comment-composer"], #react-issue-comment-composer')) return true;
  return false;
}

// ─── 测试 ──────────────────────────────────────────────────────────────

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

section("isRelevantTextarea() — GitHub");

// New React GitHub comment composer
const reactComposer = document.createElement("div");
reactComposer.setAttribute("data-testid", "comment-composer");
const reactTextarea = document.createElement("textarea");
reactTextarea.className = "prc-Textarea-TextArea-snlco";
reactComposer.appendChild(reactTextarea);
assert(isRelevantTextarea(reactTextarea), "React GitHub comment-composer textarea 识别");

// GitHub PR 评论框（legacy）
const legacyForm = document.createElement("form");
legacyForm.className = "js-new-comment-form";
const ghTextarea = document.createElement("textarea");
ghTextarea.id = "new_comment_field";
legacyForm.appendChild(ghTextarea);
assert(isRelevantTextarea(ghTextarea), "textarea#new_comment_field 识别");

// GitHub review comment（legacy）
const reviewForm = document.createElement("form");
reviewForm.className = "js-comment-update";
const reviewTextarea = document.createElement("textarea");
reviewTextarea.classList.add("js-comment-field");
reviewForm.appendChild(reviewTextarea);
assert(isRelevantTextarea(reviewTextarea), "textarea.js-comment-field 识别");

// 无关 textarea
const randomTextarea = document.createElement("textarea");
randomTextarea.id = "search-input";
assert(!isRelevantTextarea(randomTextarea), "无关 textarea 不匹配");

// 非 textarea 元素
const div = document.createElement("div");
assert(!isRelevantTextarea(div), "非 textarea 元素不匹配");

section("isRelevantEditable()");

const reactComposerEditable = document.createElement("div");
reactComposerEditable.setAttribute("data-testid", "comment-composer");
const editableDiv = document.createElement("div");
editableDiv.setAttribute("contenteditable", "true");
reactComposerEditable.appendChild(editableDiv);
assert(isRelevantEditable(editableDiv), "GitHub comment-composer contenteditable 识别");

const nonEditable = document.createElement("div");
assert(!isRelevantEditable(nonEditable), "非 contenteditable 不匹配");

const randomEditable = document.createElement("div");
randomEditable.setAttribute("contenteditable", "true");
assert(!isRelevantEditable(randomEditable), "无关 contenteditable 不匹配");

section("DOM 注入 — 工具栏创建");

function createToolbarMock(inputEl) {
  if (inputEl.dataset.politeReplyInjected === "true") return null;
  if (inputEl.nextElementSibling?.classList.contains("polite-craft-toolbar")) return null;

  const toolbar = document.createElement("div");
  toolbar.className = "polite-craft-toolbar";

  const toneSelect = document.createElement("select");
  toneSelect.className = "polite-craft-select polite-craft-tone";
  toneSelect.innerHTML = `
    <option value="constructive">建议</option>
    <option value="encouraging">鼓励</option>
    <option value="direct">直接</option>
    <option value="formal">正式</option>
    <option value="request">请求</option>
    <option value="inquiry">询问</option>
  `;

  const relSelect = document.createElement("select");
  relSelect.className = "polite-craft-select polite-craft-relationship";
  relSelect.innerHTML = `
    <option value="contributor">社区贡献者</option>
    <option value="maintainer">社区维护者</option>
    <option value="colleague">同事</option>
    <option value="close_teammate">熟人/长期合作</option>
    <option value="superior">上级/负责人</option>
  `;

  const generateBtn = document.createElement("button");
  generateBtn.className = "polite-craft-generate";
  generateBtn.textContent = "✨ Generate English";

  toolbar.appendChild(toneSelect);
  toolbar.appendChild(relSelect);
  toolbar.appendChild(generateBtn);

  if (inputEl.parentNode) {
    inputEl.parentNode.insertBefore(toolbar, inputEl.nextSibling);
  }
  inputEl.dataset.politeReplyInjected = "true";
  return toolbar;
}

// 测试注入
const container = document.createElement("div");
const testTextarea = document.createElement("textarea");
testTextarea.id = "new_comment_field";
container.appendChild(testTextarea);

const toolbar = createToolbarMock(testTextarea);
assert(toolbar !== null, "工具栏创建成功");
assert(toolbar.className === "polite-craft-toolbar", "工具栏 class 正确");
assert(testTextarea.nextElementSibling === toolbar, "工具栏插入在 textarea 之后");
assert(testTextarea.dataset.politeReplyInjected === "true", "注入标记已设置");

// 测试重复注入防护
const toolbar2 = createToolbarMock(testTextarea);
assert(toolbar2 === null, "重复注入返回 null（防护生效）");

// 测试工具栏元素
const selects = toolbar.querySelectorAll("select");
assert(selects.length === 2, "工具栏包含 2 个 select 元素");
assert(toolbar.querySelector(".polite-craft-tone") !== null, "tone select 存在");
assert(toolbar.querySelector(".polite-craft-relationship") !== null, "relationship select 存在");
assert(toolbar.querySelector(".polite-craft-generate") !== null, "generate button 存在");
assert(toolbar.querySelector(".polite-craft-generate").textContent === "✨ Generate English", "按钮文本正确");

section("输入框读写 — textarea");

function getUserInput(el) {
  if (el.tagName === "TEXTAREA" || el.tagName === "INPUT") return el.value;
  return el.textContent?.trim() || "";
}

function setUserInput(el, text) {
  if (el.tagName === "TEXTAREA" || el.tagName === "INPUT") {
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
      window.HTMLTextAreaElement.prototype, "value"
    )?.set;
    if (nativeInputValueSetter) {
      nativeInputValueSetter.call(el, text);
    } else {
      el.value = text;
    }
    el.dispatchEvent(new window.Event("input", { bubbles: true }));
    el.dispatchEvent(new window.Event("change", { bubbles: true }));
  } else {
    el.textContent = text;
    el.dispatchEvent(new window.Event("input", { bubbles: true }));
  }
}

const writeTest = document.createElement("textarea");
writeTest.value = "中文测试内容";
assert(getUserInput(writeTest) === "中文测试内容", "读取 textarea 值");

setUserInput(writeTest, "This is the translated English text.");
assert(getUserInput(writeTest) === "This is the translated English text.", "写入 textarea 值");

section("输入框读写 — contenteditable");

const editableEl = document.createElement("div");
editableEl.setAttribute("contenteditable", "true");
editableEl.textContent = "原始中文";
assert(getUserInput(editableEl) === "原始中文", "读取 contenteditable 内容");

setUserInput(editableEl, "Translated content here.");
assert(getUserInput(editableEl) === "Translated content here.", "写入 contenteditable 内容");

// ─── 总结 ──────────────────────────────────────────────────────────────

console.log(`\n${"=".repeat(50)}`);
console.log(`Results: ${passed} passed, ${failed} failed, ${passed + failed} total`);
console.log("=".repeat(50));

if (failed > 0) {
  process.exit(1);
} else {
  console.log("\nAll tests passed! ✓");
}
