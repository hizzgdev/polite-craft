/* =========================================================================
 *  Polite Craft — content.js
 *  Injects a toolbar (tone select + relationship select + generate button)
 *  below comment textareas on GitHub PR pages.
 *
 *  Uses MutationObserver to handle SPA re-renders.
 * ========================================================================= */

(() => {
  "use strict";

  console.log("[Polite Craft] Content script loaded on:", location.href);

  const EXT_RELOAD_MSG = "扩展已重新加载，请刷新此页面后再试 (F5)";

  function isExtensionAlive() {
    try {
      return !!chrome.runtime?.id;
    } catch {
      return false;
    }
  }

  function friendlyExtensionError(err) {
    if (!isExtensionAlive()) return EXT_RELOAD_MSG;
    const msg = err?.message || "";
    if (msg.includes("Extension context invalidated")) return EXT_RELOAD_MSG;
    if (msg.includes("Could not establish connection")) {
      return "扩展后台未响应，请刷新此页面或在 chrome://extensions 检查 Polite Craft";
    }
    return null;
  }

  async function sendExtensionMessage(message) {
    if (!isExtensionAlive()) {
      throw new Error(EXT_RELOAD_MSG);
    }
    try {
      return await chrome.runtime.sendMessage(message);
    } catch (err) {
      throw new Error(friendlyExtensionError(err) || err.message || "请求失败，请重试");
    }
  }

  function safeStorageGet(keys, callback) {
    if (!isExtensionAlive()) {
      callback({});
      return;
    }
    try {
      chrome.storage.local.get(keys, callback);
    } catch {
      callback({});
    }
  }

  function safeStorageSet(values) {
    if (!isExtensionAlive()) return;
    try {
      chrome.storage.local.set(values);
    } catch {
      // ignore after extension reload
    }
  }

  // ─── DOM detection: where to inject ───────────────────────────────────
  // New GitHub (React): [data-testid="comment-composer"] textarea
  // Legacy GitHub: textarea#new_comment_field, textarea.js-comment-field

  const GITHUB_INPUT_SELECTORS = [
    '[data-testid="comment-composer"] textarea',
    '#react-issue-comment-composer textarea',
    'textarea[aria-labelledby*="comment-composer"]',
    'textarea#new_comment_field',
    'textarea.js-comment-field',
    'form.js-new-comment-form textarea',
    'form.js-comment-update textarea',
    '#discussion_bucket textarea',
    '#all_commit_comments textarea',
    '.review-comment textarea'
  ].join(", ");

  function isGitHubCommentInput(el) {
    return !!el.closest(
      '[data-testid="comment-composer"], #react-issue-comment-composer, '
      + 'form.js-new-comment-form, form.js-comment-update, '
      + '#discussion_bucket, #all_commit_comments, .review-comment'
    );
  }

  function isRelevantTextarea(el) {
    if (el.tagName !== "TEXTAREA") return false;

    if (isGitHubCommentInput(el)) return true;

    return false;
  }

  function isRelevantEditable(el) {
    if (el.getAttribute("contenteditable") !== "true") return false;
    if (isGitHubCommentInput(el)) return true;
    return false;
  }

  // ─── Toolbar creation ─────────────────────────────────────────────────

  function findInput(el) {
    // el could be the textarea itself, or a container containing it
    if (el.tagName === "TEXTAREA") return el;
    if (el.getAttribute("contenteditable") === "true") return el;
    return el.querySelector("textarea") || el.querySelector('[contenteditable="true"]');
  }

  function createToolbar(inputEl) {
    const textarea = inputEl; // alias for DOM operations
    // Check if already injected
    if (inputEl.dataset.politeReplyInjected === "true") {
      console.log("[Polite Craft] Skipping already injected textarea");
      return null;
    }
    
    // Check parent for existing toolbar
    const parent = inputEl.parentElement || inputEl.closest('form, .comment-form-holder, .timeline-comment');
    if (parent?.querySelector(".polite-craft-toolbar")) {
      console.log("[Polite Craft] Toolbar already exists in parent");
      return null;
    }
    
    // Also check next sibling
    if (inputEl.nextElementSibling?.classList.contains("polite-craft-toolbar")) {
      console.log("[Polite Craft] Toolbar already exists as next sibling");
      return null;
    }

    console.log("[Polite Craft] Creating toolbar for textarea:", inputEl.id || inputEl.name || "unnamed");
    
    const toolbar = document.createElement("div");
    toolbar.className = "polite-craft-toolbar";
    toolbar.setAttribute("data-polite-craft", "true");

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

    const statusEl = document.createElement("span");
    statusEl.className = "polite-craft-status";

    toolbar.appendChild(toneSelect);
    toolbar.appendChild(relSelect);
    toolbar.appendChild(generateBtn);
    toolbar.appendChild(statusEl);

    // ── Restore saved preferences ───────────────────────────────────────
    safeStorageGet(["tone", "relationship"], (items) => {
      if (items.tone) toneSelect.value = items.tone;
      if (items.relationship) relSelect.value = items.relationship;
    });

    // ── Persist user's choice on change ────────────────────────────────
    toneSelect.addEventListener("change", () => {
      safeStorageSet({ tone: toneSelect.value });
    });
    relSelect.addEventListener("change", () => {
      safeStorageSet({ relationship: relSelect.value });
    });

    // ── Generate button click ──────────────────────────────────────────
    generateBtn.addEventListener("click", async () => {
      const userInput = getUserInput(inputEl);
      const tone = toneSelect.value;
      const relationship = relSelect.value;

      console.log("[Polite Craft] Generate clicked, input length:", userInput?.length || 0);

      // Disable button, show loading
      generateBtn.disabled = true;
      generateBtn.textContent = "⏳ 翻译中…";
      clearStatus(statusEl);

      try {
        const response = await sendExtensionMessage({
          action: "translate",
          userInput,
          tone,
          relationship
        });

        if (!response) {
          showError(statusEl, "扩展无响应，请刷新此页面后重试");
          return;
        }

        if (response.error === "NO_KEY") {
          showStatus(statusEl, "⚙️ 请先在扩展设置中填写 DeepSeek API Key", "warn");
          return;
        }

        if (response.error) {
          showError(statusEl, response.error);
          return;
        }

        // Success: keep original text, append translation below a separator
        const original = userInput.trim();
        const translated = response.text?.trim() || "";
        const merged = original ? `${original}\n=====\n${translated}` : translated;
        setUserInput(inputEl, merged);
        console.log("[Polite Craft] Translation successful, appended below original");

        // Visual feedback: button turns green briefly
        showSuccess(statusEl, "✓ 原文已保留，英文已追加");
        generateBtn.classList.add("polite-craft-success");
        setTimeout(() => {
          generateBtn.classList.remove("polite-craft-success");
        }, 1500);
      } catch (err) {
        console.error("[Polite Craft] Translation error:", err);
        showError(statusEl, err.message || "请求失败，请重试");
      } finally {
        generateBtn.disabled = false;
        generateBtn.textContent = "✨ Generate English";
      }
    });

    // Insert after input - multiple strategies for different DOM structures
    let inserted = false;

    // Strategy 1: New GitHub React composer - insert after composer body, before footer
    const commentComposer = textarea.closest('[data-testid="comment-composer"], #react-issue-comment-composer');
    const markdownInput = textarea.closest('.MarkdownInput-module__inputWrapper__vOI3M, [class*="MarkdownInput"][class*="inputWrapper"]');
    if (commentComposer) {
      const footer = commentComposer.querySelector('[data-testid="markdown-editor-footer"], [class*="Footer-module__footer"]');
      if (footer) {
        footer.before(toolbar);
        inserted = true;
        console.log("[Polite Craft] Inserted before comment composer footer (React GitHub)");
      } else if (markdownInput) {
        markdownInput.after(toolbar);
        inserted = true;
        console.log("[Polite Craft] Inserted after Markdown input wrapper (React GitHub)");
      } else {
        commentComposer.appendChild(toolbar);
        inserted = true;
        console.log("[Polite Craft] Appended to comment composer (React GitHub)");
      }
    } else if (markdownInput) {
      markdownInput.after(toolbar);
      inserted = true;
      console.log("[Polite Craft] Inserted after Markdown input wrapper");
    }

    // Strategy 2: Legacy - insert as next sibling
    if (!inserted && textarea.parentElement) {
      textarea.parentElement.insertBefore(toolbar, textarea.nextSibling);
      inserted = true;
      console.log("[Polite Craft] Inserted as next sibling");
    }

    // Strategy 3: Fallback to parent container
    if (!inserted) {
      const container = textarea.closest("form, [class*='comment-form'], [class*='commentBox']");
      if (container) {
        container.appendChild(toolbar);
        inserted = true;
        console.log("[Polite Craft] Inserted into parent container");
      }
    }

    // Strategy 4: Last resort - parentNode
    if (!inserted) {
      textarea.parentNode.appendChild(toolbar);
      inserted = true;
      console.log("[Polite Craft] Fallback insert at parentNode");
    }

    if (!inserted) {
      console.warn("[Polite Craft] Failed to insert toolbar - no suitable parent");
      return null;
    }
    
    inputEl.dataset.politeReplyInjected = "true";
    return toolbar;
  }

  // ─── Input abstraction (textarea vs contenteditable) ──────────────────

  function getUserInput(el) {
    if (el.tagName === "TEXTAREA" || el.tagName === "INPUT") {
      return el.value;
    }
    return el.textContent?.trim() || "";
  }

  function setUserInput(el, text) {
    if (el.tagName === "TEXTAREA" || el.tagName === "INPUT") {
      // For GitHub, we need to trigger input events so the page knows the value changed
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
        window.HTMLTextAreaElement.prototype, "value"
      )?.set || Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype, "value"
      )?.set;
      if (nativeInputValueSetter) {
        nativeInputValueSetter.call(el, text);
      } else {
        el.value = text;
      }
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
    } else {
      // contenteditable
      el.textContent = text;
      el.dispatchEvent(new Event("input", { bubbles: true }));
    }
  }

  // ─── Status helpers ───────────────────────────────────────────────────

  function showStatus(el, text, type) {
    el.textContent = text;
    el.className = "polite-craft-status polite-craft-status-" + type;
  }

  function showError(el, text) {
    showStatus(el, "❌ " + text, "error");
    // Keep reload hints visible; auto-hide other errors
    if (!text.includes("刷新")) {
      setTimeout(() => clearStatus(el), 4000);
    }
  }

  function showSuccess(el, text) {
    showStatus(el, text, "success");
    // Auto-hide after 3 seconds
    setTimeout(() => clearStatus(el), 3000);
  }

  function clearStatus(el) {
    el.textContent = "";
    el.className = "polite-craft-status";
  }

  // ─── Context scraping (for background.js requests) ────────────────────

  function getGitHubCurrentUser() {
    const metaLogin = document.querySelector('meta[name="user-login"]')?.content?.trim();
    if (metaLogin) return metaLogin;

    try {
      const env = JSON.parse(document.getElementById("client-env")?.textContent || "{}");
      if (env.login) return env.login;
    } catch {
      // ignore malformed client-env
    }

    return document.querySelector('meta[name="octolytics-actor-login"]')?.content?.trim() || "";
  }

  function extractGitHubAuthorLogin(commentEl) {
    const header = commentEl.querySelector("[data-testid='comment-header'], .timeline-comment-header");
    if (!header) return "";

    const userLinks = header.querySelectorAll(
      "a[data-testid='avatar-link'], "
      + "a[class*='AuthorName'], "
      + "a.author, "
      + "a[data-hovercard-type='user']"
    );

    for (const link of userLinks) {
      const hrefLogin = link.getAttribute("href")?.match(/^\/([^/?#]+)/)?.[1];
      if (hrefLogin && !["orgs", "teams", "apps", "marketplace"].includes(hrefLogin)) {
        return hrefLogin;
      }

      const textLogin = link.textContent?.trim().replace(/^@/, "");
      if (textLogin) return textLogin;
    }

    const srOnly = header.querySelector("h3.sr-only")?.textContent || "";
    const srMatch = srOnly.match(/^(\S+)\s+commented\b/i);
    if (srMatch) return srMatch[1];

    return "";
  }

  function createSpeakerLabeler(currentUserLogin) {
    const aliasByLogin = new Map();
    const legendParts = [];
    let otherIndex = 1;

    const normalize = (login) => (login || "").replace(/^@/, "").trim().toLowerCase();

    function speakerFor(rawLogin) {
      const displayLogin = (rawLogin || "").replace(/^@/, "").trim();
      const key = normalize(displayLogin);
      if (!key) return "unknown user";

      if (!aliasByLogin.has(key)) {
        const speaker = key === normalize(currentUserLogin)
          ? "current user"
          : `user${otherIndex++}`;
        aliasByLogin.set(key, speaker);
        legendParts.push(`${speaker} = ${displayLogin}`);
      }

      return aliasByLogin.get(key);
    }

    return {
      speakerFor,
      labelEntries(entries) {
        return entries.map((entry) => {
          const authorLogin = (entry.authorLogin || entry.author || "").replace(/^@/, "").trim();
          return {
            ...entry,
            authorLogin,
            speaker: speakerFor(authorLogin)
          };
        });
      },
      getLegend() {
        return legendParts.join(", ");
      }
    };
  }

  function scrapeGitHubContext() {
    const ctx = {};
    ctx.currentUser = getGitHubCurrentUser();

    // PR/Issue title (React + legacy)
    const titleEl = document.querySelector(
      '[data-testid="issue-header"] h1, '
      + "bdi.js-issue-title, .IssueTitle bdi, h1[class*='IssueTitle'], h1[class*='PageHeader_Title']"
    );
    ctx.prTitle = titleEl?.textContent?.trim() || document.title?.split("·")[0]?.trim() || "";

    // PR/Issue description (first 500 chars)
    const bodyEl = document.querySelector(
      '[data-testid="issue-viewer-container"] .markdown-body, '
      + ".markdown-body.js-comment-body, .js-issue-body .markdown-body"
    );
    ctx.prBody = (bodyEl?.textContent?.trim() || "").slice(0, 500);

    // Active comment input (React + legacy)
    const activeInput = document.querySelector(
      '[data-testid="comment-composer"] textarea:focus, '
      + "textarea#new_comment_field:focus, textarea.js-comment-field:focus"
    ) || document.querySelector(
      '[data-testid="comment-composer"] textarea, '
      + "textarea#new_comment_field, textarea.js-comment-field"
    );

    if (activeInput) {
      const parentForm = activeInput.closest(
        'form, .js-comment-update, [data-testid="comment-composer"], #react-issue-comment-composer'
      );
      const quotedEl = parentForm?.querySelector(".js-comment-body, .markdown-body");
      const quotedContainer = quotedEl?.closest('[data-testid^="comment-viewer"], .js-comment, .timeline-comment');
      const quotedAuthor = quotedContainer ? extractGitHubAuthorLogin(quotedContainer) : "";
      const comments = document.querySelectorAll(
        '[data-testid="issue-viewer-comments-container"] [data-testid^="comment-viewer"], '
        + "#discussion_bucket .js-comment, .timeline-comment"
      );
      const history = [];
      for (const c of Array.from(comments).slice(-5)) {
        const authorLogin = extractGitHubAuthorLogin(c);
        const body = c.querySelector(".markdown-body, .js-comment-body")?.textContent?.trim();
        if (body) history.push({ authorLogin, text: body.slice(0, 200) });
      }

      const labeler = createSpeakerLabeler(ctx.currentUser);
      ctx.conversationHistory = labeler.labelEntries(history);

      if (quotedEl && quotedEl !== bodyEl) {
        ctx.quotedComment = {
          authorLogin: quotedAuthor,
          speaker: labeler.speakerFor(quotedAuthor),
          text: quotedEl.textContent?.trim().slice(0, 300) || ""
        };
      }

      ctx.participantsLegend = labeler.getLegend();
    }

    return ctx;
  }

  // Listen for getContext requests from background
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.action === "getContext") {
      sendResponse(scrapeGitHubContext());
    }
  });

  // ─── Injection via MutationObserver ───────────────────────────────────

  const KNOWN_TEXTAREAS = new WeakSet();

  function tryInject(target) {
    let inputEl = null;

    if (isRelevantTextarea(target)) inputEl = target;
    else if (isRelevantEditable(target)) inputEl = target;
    else {
      inputEl = target.querySelector(GITHUB_INPUT_SELECTORS)
        || target.querySelector('[contenteditable="true"]');
      if (inputEl && inputEl.getAttribute("contenteditable") === "true" && !isRelevantEditable(inputEl)) {
        inputEl = null;
      }
    }

    if (!inputEl) return;
    if (KNOWN_TEXTAREAS.has(inputEl)) return;
    if (inputEl.dataset.politeReplyInjected === "true") {
      KNOWN_TEXTAREAS.add(inputEl);
      return;
    }

    const toolbar = createToolbar(inputEl);
    if (toolbar) {
      console.log("[Polite Craft] Toolbar injected for:", inputEl.id || inputEl.className || "textarea");
      KNOWN_TEXTAREAS.add(inputEl);
    }
  }

  // Initial scan
  function scanAndInject() {
    const candidates = document.querySelectorAll(GITHUB_INPUT_SELECTORS);
    console.log("[Polite Craft] scanAndInject found", candidates.length, "candidate input(s)");
    candidates.forEach(tryInject);
  }

  // Run initial scan after a short delay (let SPA finish rendering)
  setTimeout(scanAndInject, 500);
  setTimeout(scanAndInject, 2000); // second pass for slow SPAs
  setTimeout(scanAndInject, 5000); // third pass for very slow SPAs

  // Observe DOM changes
  const observer = new MutationObserver((mutations) => {
    let shouldScan = false;
    for (const m of mutations) {
      if (m.type === "childList" && m.addedNodes.length > 0) {
        shouldScan = true;
        for (const node of m.addedNodes) {
          if (node.nodeType === Node.ELEMENT_NODE) {
            tryInject(node);
          }
        }
      }
    }
    // Fallback: if nodes were added but none matched, do a full scan
    if (shouldScan) {
      // Debounced full scan
      clearTimeout(scanAndInject._timer);
      scanAndInject._timer = setTimeout(scanAndInject, 300);
    }
  });

  observer.observe(document.body || document.documentElement, {
    childList: true,
    subtree: true
  });
})();
