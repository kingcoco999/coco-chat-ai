# Coco Chat AI 💌

AI 伴侣聊天应用，支持多角色、陪伴模式、日记系统、长期记忆、状态管理等功能。

## ✨ 功能特性

- **双主题** — 简约风 / 仿微信风一键切换
- **多角色存档** — 创建多个 AI 角色，独立对话、日记、记忆
- **陪伴模式** — AI 按设定频率主动发消息，支持自定义规则
- **日记系统** — 每次对话结束后 AI 自动生成角色日记
- **长期记忆** — 自动从对话中提取关键信息并持久化
- **状态系统** — 好感度、信任值、自定义状态，AI 自动评估变化
- **AI 生成人设** — 一键生成完整角色（名称、性格、场景等）
- **对话摘要** — 长对话自动压缩，保留关键上下文
- **用量统计** — Token 消耗追踪、费用估算、排行图表
- **兼容 OpenAI API** — 支持 DeepSeek / Kimi / 通义 / 智谱 / Gemini 等

## 🚀 快速开始（本地网页版）

直接用浏览器打开 `index.html` 即可使用。

## 📱 构建 Android APK

### 前置要求

- [Node.js](https://nodejs.org/) >= 18
- [Android Studio](https://developer.android.com/studio)
- JDK 17+

### 步骤

```bash
# 1. 安装依赖
npm install

# 2. 添加 Android 平台（首次）
npx cap add android

# 3. 同步 web 资源到 Android 项目
npx cap sync

# 4. 用 Android Studio 打开项目
npx cap open android
```

在 Android Studio 中：
1. 等待 Gradle 同步完成
2. 菜单 → Build → Build Bundle(s) / APK(s) → Build APK(s)
3. APK 输出路径：`android/app/build/outputs/apk/debug/app-debug.apk`

### GitHub Actions 自动构建

本项目支持通过 GitHub Actions 自动构建 APK。推送到 `main` 分支后会自动触发构建，构建产物在 Actions 的 Artifacts 中下载。

## 📁 项目结构

```
coco-chat-ai/
├── index.html          # 主页面（HTML 结构）
├── style.css           # 样式文件（双主题）
├── app.js              # 核心逻辑（聊天、陪伴、日记等）
├── manifest.json       # PWA 清单
├── capacitor.config.ts # Capacitor 配置
├── package.json        # 项目依赖
├── assets/
│   ├── icon.svg        # 应用图标 SVG
│   ├── icon-192.png    # 192px 图标
│   └── icon-512.png    # 512px 图标
├── android/            # Android 原生项目（自动生成）
└── .github/
    └── workflows/
        └── build.yml   # GitHub Actions 构建配置
```

## ⚙️ 技术栈

- **前端**：原生 HTML + CSS + JavaScript（零框架依赖）
- **打包**：Capacitor 6（将 Web 应用包装为原生 App）
- **存储**：localStorage（Capacitor 环境下自动持久化）
- **API**：兼容 OpenAI Chat Completions 格式

## 📝 注意事项

- 首次使用需要在 ⚙️ 设置中配置 API 地址和 Key
- 数据全部存储在本地，卸载 App 会丢失数据（后续版本将支持备份）
- 支持所有兼容 OpenAI Chat Completions API 的模型

## 📄 License

MIT
