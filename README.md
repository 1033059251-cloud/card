# 塔罗牌 · 手势占卜（手势交互原型）

基于 **HTML + JavaScript + MediaPipe Hands** 的本地塔罗牌手势交互网页。摄像头画面在浏览器内本地处理，**不上传、不存储任何影像**。

## 三个原型

| 文件 | 交互模型 | 用途 |
| --- | --- | --- |
| [index.html](index.html) | 基础版：横向牌阵 + 惯性滚动选牌 + 悬停翻牌 | 快速落地 |
| [ritual.html](ritual.html) | 五步仪式版：环形牌阵 + 画圈洗牌 + 单指选牌 + 转腕翻牌 + 握拳抓取 + 置区解读 | TouchDesigner 版的交互逻辑参照 |
| [lite.html](lite.html) | 网页精简版（Three.js）：张开手掌洗牌 + 握拳选牌，选中的牌飞入顶部三格，三张选完自动开牌 | Three.js + 高清纹理 |

> `ritual.html` 的启动方式与 `index.html` 相同（见下）。

## 运行

摄像头调用（`getUserMedia`）需要 **安全上下文**（https 或 localhost），因此不能直接双击 `index.html`（`file://` 会被浏览器拦截）。任选其一：

```bash
# 方式一：Python（macOS 自带）
cd /Users/hetao/Desktop/kiro/card
python3 -m http.server 8000

# 方式二：Node
npx serve .
```

然后浏览器打开 **http://localhost:8000**，点击「开启占卜」授权摄像头。

> 首次加载需联网（从 jsdelivr CDN 拉取 MediaPipe 库、WASM、手部关键点模型，以及 Google Fonts）。运行时摄像头帧只在本机处理，不联网上传。

## 手势说明

| 手势 | 动作 | 效果 |
| --- | --- | --- |
| 🖐 张开手掌左右挥动 | 掌心横向移动 | 牌阵惯性滚动选牌 |
| ☝️ 食指指向 | 对准某张牌悬停 **1 秒** | 翻牌（牌背 → 牌面 + 粒子光效） |
| 🤏 捏合（拇指+食指） | 悬停 1 秒后捏合 | 翻牌 |
| 🤏 捏合后上抬 | 捏合并向上抬掌 | 卡牌脱离牌阵，随指尖移动，**松手消失** |
| ✊ 握拳 | 对准某张牌握拳 | 定契（金色锁定） |

## 可调参数（`index.html` 顶部 `/* 常量 */`）

| 常量 | 默认 | 说明 |
| --- | --- | --- |
| `HOVER_MS` | 500 | 悬停翻牌判定时长 |
| `PINCH_THRESHOLD` | 0.055 | 捏合判定（拇指尖-食指尖归一化距离） |
| `RISE_THRESHOLD` | 0.075 | 上抬取牌判定（掌心 y 上移量） |
| `DISTANCE_MIN_WIDTH` | 0.16 | 手部过远判定：手包围盒宽度低于此值视为 >20cm 无效 |
| `SMOOTH_ALPHA` | 0.35 | 掌心位置平滑（防抖） |
| `SCROLL_SENSITIVITY` | 0.85 | 挥手滚动灵敏度 |
| `FRICTION` | 0.97 | 惯性摩擦（越接近 1 惯性越大、滑动越重越顺） |
| `modelComplexity` | 1 | 模型精度（低端机器可改 `0` 更流畅） |

## 问题输入 + 大模型解牌（DeepSeek）

`card_phone.html` 支持在开牌前输入问题、解牌时调用 DeepSeek 生成个性化解读，需要配合一个极简代理 `server.js`：

```bash
DEEPSEEK_API_KEY=sk-你的key node server.js
```

然后打开 **http://localhost:3000**（Mac 本机摄像头可用）。手机访问需要 https，可用隧道把本地端口暴露出去，例如：

```bash
npx localtunnel --port 3000
```

- 代理只做两件事：托管页面 + 把 `POST /api/read` 转发给 DeepSeek，**API Key 只存在服务端**，不暴露在前端。
- 未配置 Key、或请求失败时，`card_phone.html` 会自动退回内置的静态解读。
- 想改模型 / 提示词：编辑 `server.js` 里的 `MODEL` 与 `buildPrompt()`。

## 说明

- **距离判定是启发式**：用「手包围盒宽度」近似手掌到屏幕的距离（手近则盒大、手远则盒小），并非真实测距。`DISTANCE_MIN_WIDTH` 需根据你的摄像头视场角微调。
- 界面为桌面端设计（手势交互依赖前置摄像头），移动端可用但体验略降。
- 「重置牌阵」按钮可恢复所有已翻/已消散的牌。
