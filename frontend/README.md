# NewRAG 前端

`frontend` 是 NewRAG 的单页前端应用，基于 React 18 + TypeScript + Vite 构建，对接 `../backed` 中的 FastAPI 后端。

## 这套前端实际提供什么

- 聊天页：多轮问答、消息归档、回答证据图谱弹窗、模型选择、思考开关、调参开关。
- 问答工作台：面向单次检索问答，调用 `/api/qa/query` 并提交反馈到 `/api/feedback`。
- 文档管理：上传、列表、搜索、删除、归档、恢复、查看文档详情和结构树。
- 索引管理：查看当前索引状态、构建历史，触发索引构建。
- 证据图谱：基于文档结构树生成可视化图谱。
- 思维链管理：基于本地会话和文档状态生成链式可视化视图。
- 评测页：调用后端评测接口运行内置样例数据集，并导出 JSON / CSV 报告。
- 系统状态：展示 `/health`、`/ready`、`/api/index/status`、`/api/tasks` 的状态与延迟。
- 系统设置：配置 LLM 连接参数、思考开关、检索/证据融合权重、头像和本地系统提示词。
- 基础体验：中英文切换、亮暗主题、页面过渡动画、本地缓存。

## 技术栈

- React 18
- TypeScript 5
- Vite 5
- React Router DOM 7
- i18next + react-i18next
- Framer Motion
- lucide-react

## 目录结构

```text
frontend/
├─ src/
│  ├─ api/                 # 后端请求封装
│  ├─ components/          # 布局与通用 UI
│  ├─ contexts/            # 文档、聊天、主题、模型配置等状态
│  ├─ i18n/                # 国际化初始化
│  ├─ locales/             # 中英文文案
│  ├─ pages/               # 页面路由组件
│  ├─ styles/              # 变量与样式
│  ├─ App.tsx              # 路由入口
│  └─ main.tsx             # 应用挂载与 Provider 组合
├─ public/
├─ index.html
├─ package.json
└─ vite.config.ts
```

## 快速开始

### 1. 前置条件

- Node.js 18+（当前仓库验收记录使用过 Node.js 22.17.1）
- 已启动后端服务，默认地址 `http://127.0.0.1:8000`

### 2. 安装依赖

```bash
cd frontend
npm install
```

### 3. 配置后端地址

推荐在 `frontend/.env.local` 中写入：

```env
VITE_API_BASE_URL=http://127.0.0.1:8000
```

实际行为如下：

- 如果设置了 `VITE_API_BASE_URL`，前端请求会直接拼接这个地址。
- 如果没有设置，`src/api/backend.ts` 会走相对路径，例如 `/api/qa/query`。
- 开发模式下，`vite.config.ts` 会把 `/api`、`/health`、`/ready` 代理到 `http://127.0.0.1:8000`。
- 生产构建时建议显式设置 `VITE_API_BASE_URL`，否则静态部署后会依赖同域反向代理。

### 4. 启动开发服务器

```bash
npm run dev
```

默认访问地址通常为：

- `http://127.0.0.1:5173`
- 或 `http://localhost:5173`

### 5. 其他常用命令

```bash
npm run build
npm run preview
npm run lint
```

说明：当前仓库没有配置前端测试框架，前端侧主要依赖 `build` 和 `lint` 做静态校验。

## 页面与路由

| 路由 | 页面 | 实际作用 |
| --- | --- | --- |
| `/chat` | 聊天 | 多轮会话问答，支持查看回答证据图谱 |
| `/qa` | 问答工作台 | 单轮问答与人工反馈提交 |
| `/docs` | 文档管理 | 上传、归档、恢复、删除、搜索文档 |
| `/docs/:id` | 文档详情 | 查看文档元数据、结构树与统计信息 |
| `/index` | 索引管理 | 查看索引状态、历史，触发构建 |
| `/graph` | 证据图谱 | 基于文档结构树做节点图展示 |
| `/chains` | 思维链管理 | 基于本地会话/文档状态生成链式可视化 |
| `/eval` | 评测 | 运行内置评测数据集，导出报告 |
| `/status` | 系统状态 | 查看健康检查、任务队列、版本信息 |
| `/settings` | 系统设置 | 配置 LLM、权重、头像和本地偏好 |

## 前端依赖的后端接口

### 文档与索引

- `GET /api/documents`
- `POST /api/documents/upload`
- `GET /api/documents/{doc_id}`
- `GET /api/documents/{doc_id}/tree`
- `DELETE /api/documents/{doc_id}`
- `POST /api/documents/{doc_id}/archive`
- `POST /api/documents/{doc_id}/restore`
- `POST /api/index/build`
- `GET /api/index/status`
- `GET /api/index/history`

### 问答与反馈

- `POST /api/qa/query`
- `GET /api/qa/weights`
- `POST /api/qa/weights`
- `POST /api/feedback`
- `GET /api/answers/{answer_id}/graph`
- `GET /api/answers/{answer_id}/evidence`

### LLM / 评测 / 状态

- `GET /api/llm/config`
- `POST /api/llm/config`
- `GET /api/llm/models`
- `POST /api/llm/test`
- `POST /api/eval/run`
- `GET /api/eval/report/{report_id}`
- `GET /api/eval/reports`
- `GET /api/tasks`
- `GET /api/tasks/{task_id}`
- `GET /health`
- `GET /ready`

## 本地状态与缓存

| 存储键 | 用途 |
| --- | --- |
| `chat_sessions` | 聊天会话列表 |
| `chat_current_id` | 当前选中的会话 ID |
| `rag_documents_v2` | 文档列表缓存 |
| `rag_documents_cache_ts_v2` | 文档缓存时间戳，TTL 为 5 分钟 |
| `app_language` | 当前语言 |
| `theme` | 亮/暗主题 |
| `llm_base_url` / `llm_model_id` / `llm_mode` | LLM 本地表单默认值 |
| `llm_enable_web_search` / `llm_enable_thinking` | LLM 开关本地缓存 |
| `system_prompt` | 仅前端保存的系统提示词 |
| `user_avatar` / `ai_avatar` | 聊天头像 |

## 当前实现中需要知道的真实情况

### 1. 聊天页附件不会进入知识库

聊天页支持选择文件，但当前实现只把附件保存在会话消息里，并不会自动上传到后端，也不会参与 `/api/qa/query`。

如果希望文件被检索，请使用“文档管理”页面上传。

### 2. “语音输入”当前只是 UI 状态切换

`Chat.tsx` 里的麦克风按钮目前只切换 `isListening` 状态并显示 `AudioVisualizer`，没有接入浏览器语音识别，也没有把音频转成文本发送给后端。

### 3. “思考过程”是否有内容取决于后端和模型

前端始终提供思考开关，但真正的 `thought_steps` / `reasoning_content` 是否返回，取决于：

- 后端 `/api/llm/config` 的 `enable_thinking`
- 当前模型是否真的返回 reasoning 内容

### 4. 评测页当前跑的是内置样例数据

`/eval` 页面没有提供上传自定义评测集的 UI，当前直接调用前端内置的 `DEFAULT_EVAL_DATASET`。如果需要自定义评测数据，应直接调用后端 `/api/eval/run`。

### 5. 系统提示词当前只存在前端本地

设置页会把 `system_prompt` 存进浏览器 `localStorage`，但当前后端问答请求并不会读取这个字段，因此它还没有真正参与生成链路。

### 6. 索引页显示的“文档数量”来自后端 `doc_count`

后端当前的 `doc_count` 实际上是索引语料条目数（也就是 chunk 数量），不是去重后的文档数。前端展示时沿用了这个字段。

## 与后端联调建议

1. 先启动 `backed` 服务。
2. 进入 `frontend` 执行 `npm run dev`。
3. 打开 `/docs` 上传文档。
4. 打开 `/index` 构建索引。
5. 再去 `/qa` 或 `/chat` 发起问题。
6. 如需检查接口是否正常，优先看 `/status` 页面和浏览器 Network 面板。

## 常见问题

### 页面能打开，但问答返回失败

通常先检查：

- 后端是否已启动
- `/health` 是否返回 200
- 是否已经构建索引
- `VITE_API_BASE_URL` 是否指向了正确后端

### 文档上传成功，但问答查不到内容

优先排查：

- 是否已经在 `/index` 页面重新构建索引
- 文档是否处于 `READY` 状态
- 查询词是否和文档文本有足够重合

### 生产部署后刷新页面 404

这是典型 SPA 路由问题。静态托管环境需要把未知路径回退到 `index.html`。