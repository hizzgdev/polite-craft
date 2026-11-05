/* =========================================================================
 *  Polite Craft — popup.js
 *  Settings panel: API Key, default tone, default relationship.
 * ========================================================================= */

(() => {
  "use strict";

  const apiKeyInput = document.getElementById("apiKey");
  const apiBaseUrlInput = document.getElementById("apiBaseUrl");
  const modelInput = document.getElementById("model");
  const toneSelect = document.getElementById("defaultTone");
  const relSelect = document.getElementById("defaultRelationship");
  const saveBtn = document.getElementById("saveBtn");
  const saveStatus = document.getElementById("saveStatus");

  // ─── Load saved settings ──────────────────────────────────────────────

  chrome.storage.local.get(
    ["apiKey", "apiBaseUrl", "model", "tone", "relationship"],
    (items) => {
      if (items.apiKey) apiKeyInput.value = items.apiKey;
      if (items.apiBaseUrl) apiBaseUrlInput.value = items.apiBaseUrl;
      if (items.model) modelInput.value = items.model;
      if (items.tone) toneSelect.value = items.tone;
      if (items.relationship) relSelect.value = items.relationship;
    }
  );

  // ─── Save ─────────────────────────────────────────────────────────────

  saveBtn.addEventListener("click", async () => {
    const apiKey = apiKeyInput.value.trim();
    const apiBaseUrl = apiBaseUrlInput.value.trim().replace(/\/+$/, ""); // strip trailing slash
    const model = modelInput.value.trim() || "deepseek-chat";
    const tone = toneSelect.value;
    const relationship = relSelect.value;

    // Clear previous status
    saveStatus.textContent = "";
    saveStatus.className = "save-status";

    // Validate API Key format
    if (apiKey && !apiKey.startsWith("sk-")) {
      saveStatus.textContent = "⚠ Key should start with 'sk-'";
      saveStatus.className = "save-status error";
      return;
    }

    saveBtn.disabled = true;
    saveBtn.textContent = "Saving…";

    // If there's an API key, validate it with a cheap request
    if (apiKey) {
      try {
        const valid = await validateApiKey(apiKey, apiBaseUrl, model);
        if (!valid) {
          saveStatus.textContent = "⚠ Invalid API Key";
          saveStatus.className = "save-status error";
          saveBtn.disabled = false;
          saveBtn.textContent = "Save Settings";
          return;
        }
      } catch (err) {
        saveStatus.textContent = "⚠ Could not validate: " + err.message;
        saveStatus.className = "save-status error";
        saveBtn.disabled = false;
        saveBtn.textContent = "Save Settings";
        return;
      }
    }

    // Save to storage
    chrome.storage.local.set({ apiKey, apiBaseUrl, model, tone, relationship }, () => {
      saveStatus.textContent = "✓ Saved";
      saveStatus.className = "save-status success";
      saveBtn.disabled = false;
      saveBtn.textContent = "Save Settings";

      setTimeout(() => {
        saveStatus.textContent = "";
      }, 2000);
    });
  });

  // ─── API Key validation ───────────────────────────────────────────────

  function validateApiKey(key, apiBaseUrl, model) {
    const base = apiBaseUrl || "https://api.deepseek.com/v1";
    const url = base.replace(/\/+$/, "") + "/chat/completions";
    const modelName = model || "deepseek-chat";
    return new Promise((resolve, reject) => {
      fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${key}`
        },
        body: JSON.stringify({
          model: modelName,
          messages: [{ role: "user", content: "ping" }],
          max_tokens: 5
        })
      })
        .then((resp) => {
          if (resp.ok) return resolve(true);
          if (resp.status === 401 || resp.status === 403) return resolve(false);
          // Other errors might be transient, treat as OK
          return resolve(true);
        })
        .catch(reject);
    });
  }
})();
