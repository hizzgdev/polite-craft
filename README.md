# Polite Craft

> Write in Chinese, craft polite English — for GitHub PR reviews and issues.

Chrome 扩展在商店中的显示名为 **「GitHub 得体英文」**；本仓库名称为 **polite-craft**，二者指同一产品。

## 仓库

本项目的源码在两个 Git 仓库中**同步更新**：

| 平台 | 地址 |
|------|------|
| Gitee | https://gitee.com/hizzgdev/polite-craft |
| GitHub | https://github.com/hizzgdev/polite-craft |

## Chrome 网上应用店

**推荐安装方式** — [GitHub 得体英文（Chrome Web Store）](https://chromewebstore.google.com/detail/afckacaoamobjclojcgmjkcionnddhpd)

安装后点击扩展图标，填入 DeepSeek API Key 即可使用（见下方「首次配置」）。

## 这是什么？

Polite Craft 是一个 Chrome 浏览器扩展，解决开发者在国际化协作中的痛点：

1. 在 GitHub PR / Issue 评论框里直接写中文
2. 选择语气（建议/鼓励/直接/正式/请求/询问）和对方关系（贡献者/维护者/同事/熟人/上级）
3. 点击 "Generate English" → 扩展自动抓取页面上下文，调用 DeepSeek API 生成地道英文，**保留中文原文并在下方追加英文**

零复制粘贴。

## 安装

### 通过 Chrome 网上应用店（推荐）

在 [Chrome Web Store](https://chromewebstore.google.com/detail/afckacaoamobjclojcgmjkcionnddhpd) 安装即可，无需手动加载扩展。

### 从源码加载（开发者）

1. 克隆任一仓库并安装依赖：

   ```bash
   git clone https://gitee.com/hizzgdev/polite-craft.git
   # 或 git clone https://github.com/hizzgdev/polite-craft.git
   cd polite-craft
   npm install
   npm run build
   ```

2. 打开 Chrome，地址栏输入 `chrome://extensions/`
3. 右上角打开 **开发者模式（Developer mode）**
4. 点击 **加载已解压的扩展程序（Load unpacked）**
5. 选择本项目的 **`dist/`** 目录（包含 `manifest.json`）
6. 扩展图标出现在浏览器工具栏

修改源码后需重新运行 `npm run build`，并在 `chrome://extensions/` 中点击扩展的刷新按钮。

## 首次配置

1. 点击浏览器工具栏上的 Polite Craft 扩展图标
2. 在弹窗中填入你的 **DeepSeek API Key**（格式 `sk-xxx...`）
3. 设置默认的语气和关系偏好
4. 点击 **Save Settings**

获取 API Key：[platform.deepseek.com](https://platform.deepseek.com)

## 使用

打开 GitHub PR 或 Issue 页面，在评论框下方会出现一个操作栏：

| 元素 | 说明 |
|------|------|
| 语气下拉 | 建议 / 鼓励 / 直接 / 正式 / 请求 / 询问 |
| 关系下拉 | 社区贡献者 / 社区维护者 / 同事 / 熟人/长期合作 / 上级/负责人 |
| Generate English 按钮 | 点击后自动抓取上下文 → 调用 AI → 保留中文原文，在下方追加英文 |

选择会记住你的上次选择，下次自动恢复。

## 开发

```bash
npm install
npm run build    # src/ → dist/
npm test         # 单元测试（Node + jsdom）
npm run test:e2e # 构建后运行 Python headless Chromium 测试（需本机 Chromium）
```

## 项目结构

```
polite-craft/
├── src/               # 扩展源码（编辑这里）
│   ├── manifest.json
│   ├── background.js  # Service Worker：API 调用、Prompt 组装
│   ├── content.js     # 内容脚本：DOM 注入、上下文抓取
│   ├── content.css
│   ├── popup.html/js/css
│   └── icons/
├── dist/              # 构建产物（npm run build，Load unpacked 选此目录）
├── scripts/build.js   # 复制 src/ → dist/
├── tests/             # 单元测试与 E2E 测试
├── docs/              # PRD、隐私政策、商店文案
├── AGENTS.md          # AI 协作者项目说明
└── README.md
```

## 架构说明

- **Manifest V3**：使用 service worker 替代旧版 background page
- **Content Script**：通过 `MutationObserver` 监听 SPA 动态加载的评论框
- **通信**：content.js ↔ background.js 通过 `chrome.runtime.sendMessage`
- **存储**：所有配置（API Key、语气、关系）存在 `chrome.storage.local`，不上传任何数据
- **权限**：仅声明 `storage` 以及 `github.com`/`api.deepseek.com` 的 host 权限

## 隐私

- API Key 仅存在本地 `chrome.storage.local`
- 不收集任何遥测数据、不发送统计信息
- 页面上下文仅在翻译请求时临时读取，不持久化存储

详见 [docs/privacy-policy.md](docs/privacy-policy.md)。

## 后续规划

- [ ] 支持更多平台（GitLab、Jira、Linear）
- [ ] 自定义语气/关系指令
- [ ] 翻译历史回顾
- [ ] 多模型支持（GPT-4、Claude 等）

## 贡献

见 [CONTRIBUTING.md](CONTRIBUTING.md)。

## License

MIT — 见 [LICENSE](LICENSE)。
