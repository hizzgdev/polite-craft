# GitHub 得体英文 — 隐私权政策

**最后更新：2026 年 6 月 26 日**

本隐私权政策说明 Chrome 扩展程序 **「GitHub 得体英文」**（以下简称「本扩展」）如何处理与用户相关的信息。安装或使用本扩展，即表示你理解并同意本政策。

---

## 1. 概述

本扩展帮助用户在 GitHub Pull Request / Issue 评论框中，将中文草稿转换为得体、可直接发送的英文回复。

**我们不会运营自己的后端服务器来收集或存储你的数据。** 本扩展在本地浏览器中保存少量配置；在你主动点击「Generate English」时，读取当前 GitHub 页面上的公开信息，并将相关内容发送到你自行配置的 **DeepSeek API** 以生成英文结果。

---

## 2. 我们处理哪些信息

### 2.1 保存在你设备本地的信息

通过 Chrome 的 `chrome.storage.local`，本扩展仅在本地保存以下配置：

| 数据项 | 用途 |
|--------|------|
| DeepSeek API Key | 调用 DeepSeek API 生成英文 |
| 语气偏好（tone） | 记住你选择的写作风格 |
| 关系偏好（relationship） | 记住你与评论对象的关系设定 |

上述数据**仅保存在你的浏览器本地**，不会上传至扩展开发者运营的服务器，也不会通过 `chrome.storage.sync` 同步到其他设备。

### 2.2 在你主动使用时临时读取的信息

仅当你点击 **「Generate English」** 时，本扩展会从当前 GitHub 页面读取与该评论相关的**公开可见**信息，例如：

- PR / Issue 标题
- PR / Issue 描述（截取前 500 字符）
- 你正在回复的评论内容（如有，截取前 300 字符）
- 最近若干条对话摘要（每条截取前 200 字符）

本扩展**不会**在后台持续扫描页面，也**不会**在你未点击生成按钮时自动读取上述内容。

### 2.3 发送给 DeepSeek API 的信息

为生成英文回复，本扩展会将以下信息通过 HTTPS 发送至 **DeepSeek 官方 API**（`https://api.deepseek.com`）：

- 你在评论框中输入的中文草稿
- 上述页面上下文（经处理后用于 Prompt）
- 你选择的语气与关系偏好

**关于对话参与者：** 发送给 AI 的对话上下文中，参与者以 `current user`、`user1`、`user2` 等匿名角色标签表示，**不会**将 GitHub 用户名与真实身份的对应关系一并发送。

此外，在设置页保存 API Key 时，本扩展可能向 DeepSeek 发起一次轻量级请求以校验 Key 是否有效。

---

## 3. 我们不收集、不存储的信息

本扩展**不会**：

- 收集、出售或出租你的个人信息用于广告
- 建立用户画像或进行行为分析、统计追踪
- 持久化保存你的评论内容、翻译结果或页面上下文
- 读取或访问 GitHub 以外的网站
- 代替你自动发送评论
- 在扩展包外加载或执行远程代码

本扩展**不会**保存你的浏览历史、Cookie、密码或其他与核心功能无关的数据。

---

## 4. 数据存储位置与保留期限

| 数据类型 | 存储位置 | 保留期限 |
|----------|----------|----------|
| API Key、语气、关系偏好 | 本地 `chrome.storage.local` | 直至你清除、覆盖或卸载扩展 |
| 页面上下文、中文草稿 | 仅内存中临时使用 | 请求完成后不保留 |
| 翻译结果 | 写回评论框供你编辑 | 不写入本地 storage |

卸载本扩展后，保存在本地的配置将随浏览器扩展数据一并移除（具体行为取决于 Chrome 的扩展数据管理机制）。

---

## 5. 第三方服务

### 5.1 DeepSeek

本扩展依赖你自行申请并配置的 **DeepSeek API**。你向 DeepSeek 发送的数据受其隐私政策与服务条款约束。请在 [DeepSeek 平台](https://platform.deepseek.com) 查阅相关说明。

**重要：** API Key 由你本人提供并保存在本地。扩展开发者无法访问你的 API Key，也不托管任何中转服务。

### 5.2 GitHub

本扩展仅在 `https://github.com/*` 页面注入内容脚本，读取页面上已公开显示的信息。本扩展与 GitHub / Microsoft 无隶属关系。

---

## 6. 权限说明

本扩展声明的权限均用于实现上述功能：

- **`storage`**：在本地保存 API Key 与偏好设置
- **`https://github.com/*`**：在 GitHub 页面注入工具栏并读取评论相关上下文
- **`https://api.deepseek.com/*`**：调用 DeepSeek API 生成英文并校验 API Key

本扩展不请求 `activeTab` 等额外权限。

---

## 7. 你的选择与权利

你可以随时：

- 在扩展设置页修改或清空 DeepSeek API Key
- 修改语气、关系等偏好
- 在发送前编辑或删除生成的英文内容
- 通过 Chrome 扩展管理页（`chrome://extensions`）禁用或卸载本扩展

卸载后，本地保存的配置将不再可用。

---

## 8. 儿童隐私

本扩展面向开发者协作场景，并非面向 13 岁以下儿童。我们不会有意收集儿童个人信息。

---

## 9. 政策变更

我们可能会更新本隐私权政策。更新后会在本页面修改「最后更新」日期。若变更涉及数据处理方式的重要调整，我们会通过 Chrome Web Store 商品页或扩展内适当方式告知。

---

## 10. 联系我们

如对本隐私权政策或数据处理有疑问，请通过 **Chrome Web Store 中本扩展商品页的开发者联系方式** 与我们沟通。

---

## English Summary

**GitHub 得体英文** is a Chrome extension that helps you draft English replies on GitHub PR/Issue comment boxes. We do not operate a backend that collects your data. Your API key and preferences are stored locally via `chrome.storage.local`. When you click "Generate English", the extension reads public GitHub page context and your Chinese draft, then sends that information to **DeepSeek API** (configured by you) to generate English text. We do not sell data, run analytics, persist page content, or auto-post comments. Uninstalling the extension removes locally stored settings.
