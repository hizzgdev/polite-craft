## 任务：帮我创建一个 Chrome 浏览器扩展 “Polite Craft”

### 一、这个扩展是做什么的？

我是一个开发者，经常在 GitHub PR 上用英文回复别人。我的工作流是：

1. 在脑子里理解上下文（这个 PR 是干什么的、别人说了什么、我和对方什么关系）
2. 在心里用中文打好草稿
3. 把中文草稿和上下文手动说给 ChatGPT，让它生成得体英文
4. 把结果贴回来

这个扩展要把步骤 3 和 4 自动化：**我在评论框里写中文 → 点一个按钮 → 扩展自动抓取页面上下文 → 结合我选定的语气和人际关系 → 一键生成地道英文并回填到输入框。**

---

### 二、核心功能需求

#### 1. 目标网站

- GitHub：PR / Issue 的评论框（包括主评论和回复某条评论）

#### 2. 用户交互界面

在评论框下方，扩展注入一个操作栏，包含三个元素（水平排列）：

- 一个下拉列表：**语气**（Tone）
- 一个下拉列表：**关系**（Relationship）
- 一个按钮：**生成英文**（Generate English）

按钮点击后显示加载状态，生成完成后自动替换输入框里的内容。

#### 3. 两个下拉列表的选项

**语气（Tone）：**

| 选项值 | 显示文字 |
|--------|----------|
| `constructive` | 建设性建议 |
| `encouraging` | 温和鼓励 |
| `direct` | 直接反馈 |
| `formal` | 正式汇报 |

**关系（Relationship）：**

| 选项值 | 显示文字 |
|--------|----------|
| `contributor` | 社区贡献者 |
| `colleague` | 同事 |
| `close_teammate` | 熟人/长期合作者 |
| `superior` | 上级/负责人 |

**默认选择：** 语气默认“建设性建议”，关系默认“社区贡献者”。用户修改后，扩展要记住他上次的选择（存在 `chrome.storage.local`），下次打开页面自动恢复。

#### 4. 上下文自动抓取

点击按钮时，扩展需要自动从当前页面抓取以下信息，并作为 Prompt 的一部分发给 AI：

**GitHub PR 页面：**
- PR 标题
- PR 描述（前 500 字符，避免太长）
- 当前用户正在回复的那条评论内容（如果用户点的是某条评论下的回复按钮）
- 最近的 5 条对话历史（如果有）

#### 5. API 调用

- 调用 DeepSeek API（`https://api.deepseek.com/v1/chat/completions`）
- API Key 由用户提供，存在 `chrome.storage.local` 里
- 首次使用没有 Key 时，点击按钮应引导用户去扩展的设置页面输入 Key

#### 6. Prompt 模板（核心）

根据用户选定的语气和关系，动态拼装系统提示词。基本结构如下（你帮我完善成最有效的英文 Prompt）：

```
System prompt:
你是一个帮助开发者在技术协作中进行跨文化沟通的助手。
用户的母语是中文，他/她写好了中文草稿，你需要将其转换成专业、地道的英文。

当前上下文：
- PR 标题：{pr_title}
- PR 描述：{pr_description}
- 对方说：{quoted_comment}
- 最近对话历史：{conversation_history}

用户的语气偏好：{tone}
用户与对方的关系：{relationship}

请根据以上信息，将以下中文转换成英文。要求：
- 技术术语准确
- 语气和称呼符合协作平台的文化习惯
- 不要直译中文客套话（如“辛苦”、“麻烦”），用英文习惯表达
- 直接输出英文，不要任何解释

中文草稿：{user_input}
```

你需要帮我把 `{tone}` 和 `{relationship}` 映射成具体的语气指令，加到 System prompt 里。比如：
- `tone=constructive` → "Keep the tone constructive and polite. Frame suggestions as questions."
- `relationship=contributor` → "The recipient is an open-source community contributor. Maintain a friendly and respectful tone."

其他组合由你根据最佳实践补全。

---

### 三、技术实现要求

#### 1. 项目结构

```
polite-craft/
├── manifest.json
├── content.js          # 注入页面，操作 DOM，管理按钮和下拉框
├── background.js       # Service Worker，接收消息，调用 API
├── popup.html          # 扩展图标点击后的小弹窗（设置 API Key、默认语气）
├── popup.js
├── icons/
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
```

#### 2. 技术栈限制

- 使用 Manifest V3
- 不要引入任何第三方库（原生 JavaScript）
- API 调用必须从 background.js 发起（content.js 通过 `chrome.runtime.sendMessage` 通信）
- 所有用户配置（API Key、语气、关系默认值）使用 `chrome.storage.local`

#### 3. 注入时机和方式

- 使用 `manifest.json` 的 `content_scripts` 自动注入到 `github.com/*`
- 注入后监听评论框的出现（因为 GitHub 是 SPA，DOM 会动态加载），用 `MutationObserver` 监听
- 当检测到输入框出现且尚未添加操作栏时，动态注入操作栏

#### 4. 按钮状态管理

- 点击后立即禁用按钮，显示“翻译中…”，完成后恢复
- 如果 API 返回错误（Key 无效、网络异常等），在按钮旁边临时显示红色错误提示，3 秒后消失
- 生成完成后，用一个细微的视觉反馈（如按钮短暂变绿）提示成功

---

### 四、隐私和安全

- API Key 只存在本地 `chrome.storage.local`，不上传到任何其他服务器
- 扩展不收集任何用户数据，不包含任何遥测或统计代码
- 在 `manifest.json` 中声明最小权限：只访问 `github.com`，以及 `api.deepseek.com`

---

### 五、交付要求

请给我完整、可运行的代码。包括：

1. `manifest.json`（含所有必要字段）
2. `content.js`（含 GitHub 的 DOM 适配逻辑）
3. `background.js`（含 API 调用和 Prompt 组装）
4. `popup.html` 和 `popup.js`（含 API Key 设置和默认语气/关系设置）
5. 简单的图标文件（用 SVG 生成的 16/48/128 像素 PNG 的内嵌 data URI 也可以）

另外请附上：
- 安装说明：如何在不通过 Chrome Web Store 的情况下加载此扩展
- 配置说明：用户首次如何输入 API Key
