# AGENTS.md — Polite Craft

Guide for AI coding assistants working in this repository.

## Product

**Polite Craft** (Chrome Web Store name: **GitHub 得体英文**) is a Manifest V3 Chrome extension for Chinese-speaking developers on GitHub. Users write Chinese drafts in PR/Issue comment areas (or GitHub review comment boxes); the extension scrapes page context, calls the user-configured DeepSeek API, and fills in polite English.

## Architecture

```
GitHub page
  → src/content.js (inject toolbar, scrape context, MutationObserver)
  → chrome.runtime.sendMessage
  → src/background.js (assemble prompts, call DeepSeek API)
  → response back to content.js → append English below Chinese draft
```

Settings (API key, default tone/relationship) live in `chrome.storage.local` via `src/popup.js`. **Never hardcode API keys.**

## Directory layout

| Path | Purpose |
|------|---------|
| `src/` | Extension source — **edit here** |
| `dist/` | Build output — `npm run build`; Chrome Load unpacked target |
| `scripts/build.js` | Copies `src/` → `dist/` (no bundler) |
| `tests/` | Node unit tests + Python headless Chromium checks |
| `docs/` | PRD, privacy policy, store listing copy |

## Commands

```bash
npm install
npm run build      # required after src/ changes
npm test           # node tests/background.test.js && node tests/content.test.js
npm run test:e2e   # build + python3 tests/test_extension.py
```

## Conventions

- Plain JavaScript, no TypeScript or bundler.
- MV3: `background.js` is a service worker — no DOM access.
- GitHub uses React; content script relies on `MutationObserver` and multiple DOM insertion strategies — do not remove compatibility paths without testing on live GitHub.
- Tone/relationship prompt maps live in `background.js`.
- Manifest display name is Chinese; repo/README use "Polite Craft".

## Permissions

Current: `storage`, `https://github.com/*`, `https://api.deepseek.com/*`. Any new permission needs user-visible justification in PRs.

## Sensitive data

- Do not add real API keys, session dumps, or saved authenticated HTML (e.g. full GitHub page snapshots).
- Use `tests/fixtures/mock-github-page.html` for synthetic DOM tests.

## Docs

- Product requirements: `docs/PRD.md`
- Privacy policy: `docs/privacy-policy.md`
- Chrome using Cursor rules: `.cursor/rules/extension-dev.mdc`
