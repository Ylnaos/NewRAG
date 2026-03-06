# NewRAG 后端（`backed`）

`backed` 是 NewRAG 的 FastAPI 后端服务目录。目录名当前就是 `backed`，不是 `backend`。它负责文档上传、解析、分块、索引构建、检索问答、证据融合、答案图谱、反馈收集、评测和 LLM 配置持久化。

## 项目定位

这不是一个依赖数据库和外部向量库的大型 RAG 服务，而是一套偏本地、文件型、可快速联调的实现：

- 文档与索引都持久化到 `DATA_DIR` 下的 JSON / 原始文件目录。
- 检索链路是“BM25 + 本地哈希向量 + 结构先验 + 词项重排”。
- LLM 支持 `mock`、`disabled`、`moonshot` 三种模式。
- 评测支持直接提交一组文档和问题样本，返回 recall / mrr / ndcg 等指标。

## 技术栈

- Python 3.11+
- FastAPI
- Uvicorn
- PyPDF2
- python-docx
- httpx
- pytest（开发依赖）

## 核心处理流程

1. 上传文档到 `/api/documents/upload`
2. 保存原始文件到 `data/raw`
3. 解析为章节树和段落
4. 按章节聚合后做滑窗分块
5. 构建 BM25、向量索引和语料清单
6. 查询时先做粗召回，再做精排
7. 证据融合时标记冗余和冲突
8. 调用 LLM 生成答案，并做轻量一致性校验
9. 持久化答案、证据图谱、反馈和评测报告

## 目录结构

```text
backed/
├─ app/
│  ├─ api/routes/          # FastAPI 路由
│  ├─ answers/             # 答案记录存储
│  ├─ core/                # 配置、日志、中间件、任务队列、权重
│  ├─ documents/           # 文档模型、解析、分块、存储
│  ├─ eval/                # 评测数据集与指标
│  ├─ evidence/            # 证据融合
│  ├─ feedback/            # 反馈存储
│  ├─ index/               # BM25 / 向量索引 / 索引元数据
│  ├─ llm/                 # LLM 客户端和配置持久化
│  ├─ qa/                  # 提示词、结构化输出、问答服务
│  ├─ retriever/           # 混合检索与重排
│  ├─ verify/              # 答案校验
│  └─ main.py              # 应用入口
├─ tests/
├─ requirements.txt
└─ requirements-dev.txt
```

## 快速开始

### 1. 前置条件

- Python 3.11+
- 建议在 `backed` 目录内启动，这样默认 `DATA_DIR=data` 会落到 `backed/data`

### 2. 安装依赖

```bash
cd backed
python -m venv .venv
. .venv/Scripts/activate
pip install -r requirements.txt
pip install -r requirements-dev.txt
```

如果你不使用虚拟环境，也至少要保证 `fastapi`、`uvicorn`、`PyPDF2`、`python-docx`、`httpx` 已安装。

### 3. 启动服务

```bash
cd backed
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

启动后可直接访问：

- `http://127.0.0.1:8000/health`
- `http://127.0.0.1:8000/ready`
- `http://127.0.0.1:8000/docs`（Swagger UI）
- `http://127.0.0.1:8000/redoc`

### 4. 从仓库根目录启动的写法（可选）

如果你想在仓库根目录执行命令，建议显式指定 `DATA_DIR`：

```bash
DATA_DIR=backed/data python -m uvicorn app.main:app --app-dir backed --host 127.0.0.1 --port 8000 --reload
```

因为 `DATA_DIR` 默认值是相对路径 `data`，它相对于进程当前工作目录，而不是相对于 `app/` 文件本身。

### 5. 运行测试

```bash
cd backed
PYTHONPATH=. pytest -q
```

当前测试覆盖的模块包括：

- 健康检查
- 文档上传 / 树结构 / 删除 / 归档 / 恢复
- 索引构建
- 检索与重排
- 证据融合
- QA 与答案图谱
- 请求 ID / 中间件
- 任务队列
- 评测接口

## 环境变量

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `APP_NAME` | `newrag-backend` | 服务名 |
| `APP_VERSION` | `0.1.0` | 版本号 |
| `APP_ENV` | `dev` | 仅允许 `dev` / `test` / `prod` |
| `LOG_LEVEL` | `INFO` | 日志级别 |
| `REQUEST_ID_HEADER` | `X-Request-ID` | 请求 ID 头名 |
| `MAX_TASK_RETRIES` | `2` | 异步任务最大重试次数 |
| `TASK_TIMEOUT_SECONDS` | `60` | 异步任务超时秒数 |
| `DATA_DIR` | `data` | 数据根目录 |
| `MAX_UPLOAD_MB` | `20` | 单文件上传大小限制 |
| `CHUNK_SIZE` | `500` | 分块大小，当前按字符数处理 |
| `CHUNK_OVERLAP` | `50` | 分块重叠长度，当前按字符数处理 |
| `VECTOR_DIM` | `128` | 本地向量维度 |
| `LLM_BASE_URL` | 空 | LLM 服务地址 |
| `LLM_MODEL_ID` | 空 | LLM 模型 ID |
| `LLM_API_KEY` | 空 | LLM API Key |
| `LLM_MODE` | `mock` | `mock` / `disabled` / `moonshot` |
| `LLM_ENABLE_WEB_SEARCH` | `false` | 是否允许 Web 搜索 |
| `LLM_ENABLE_THINKING` | `false` | 是否允许返回 reasoning 内容 |
| `CORS_ALLOW_ORIGINS` | 空 | 逗号分隔的允许来源 |

当 `CORS_ALLOW_ORIGINS` 为空时，服务会自动放行：

- `http://127.0.0.1:5173`
- `http://localhost:5173`

## 数据落盘结构

默认情况下，所有运行数据都会保存在 `DATA_DIR` 下：

| 路径 | 内容 |
| --- | --- |
| `data/raw/` | 原始上传文件 |
| `data/docs/` | 文档元数据 |
| `data/parsed/` | 解析后的章节与段落 |
| `data/chunks/` | 文档分块 |
| `data/index/` | BM25、向量、语料和索引元数据 |
| `data/llm/config.json` | 持久化后的 LLM 配置 |
| `data/llm/api_key.txt` | 持久化 API Key |
| `data/answers/` | 问答记录、证据和图谱 |
| `data/feedback/` | 人工反馈 |
| `data/eval/runs/` | 评测运行过程数据 |
| `data/eval/reports/` | 评测 JSON / CSV 报告 |

## API 概览

### 健康检查

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `GET` | `/health` | 返回服务状态、版本、时间、运行时长 |
| `GET` | `/ready` | 返回配置校验结果和当前索引状态 |

### 文档管理

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `POST` | `/api/documents/upload` | 上传并处理文档，支持同步/异步 |
| `GET` | `/api/documents` | 获取文档列表 |
| `GET` | `/api/documents/{doc_id}` | 获取文档详情、章节数、段落数、chunk 数 |
| `GET` | `/api/documents/{doc_id}/tree` | 获取文档结构树 |
| `DELETE` | `/api/documents/{doc_id}` | 删除文档及其解析/分块结果 |
| `POST` | `/api/documents/{doc_id}/archive` | 归档文档，可附带 `archive_path` |
| `POST` | `/api/documents/{doc_id}/restore` | 恢复归档文档 |

### 索引与任务

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `POST` | `/api/index/build` | 构建索引，支持同步/异步 |
| `GET` | `/api/index/status` | 获取当前索引元数据 |
| `GET` | `/api/index/history` | 获取索引历史 |
| `GET` | `/api/tasks` | 查看当前任务快照 |
| `GET` | `/api/tasks/{task_id}` | 查看单个任务状态 |

### 问答与反馈

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `POST` | `/api/qa/query` | 提交问题并返回答案、证据、图谱、校验状态 |
| `GET` | `/api/qa/weights` | 获取检索/证据融合权重 |
| `POST` | `/api/qa/weights` | 更新检索/证据融合权重 |
| `GET` | `/api/answers/{answer_id}` | 获取完整答案记录 |
| `GET` | `/api/answers/{answer_id}/graph` | 获取答案图谱 |
| `GET` | `/api/answers/{answer_id}/evidence` | 获取答案证据 |
| `POST` | `/api/feedback` | 提交证据或节点反馈 |

### LLM 与评测

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `GET` | `/api/llm/config` | 获取当前 LLM 配置 |
| `POST` | `/api/llm/config` | 更新 LLM 配置并持久化 |
| `GET` | `/api/llm/models` | 列出模型 |
| `POST` | `/api/llm/test` | 测试连接 |
| `POST` | `/api/eval/run` | 运行评测 |
| `GET` | `/api/eval/report/{report_id}` | 获取单次评测报告 |
| `GET` | `/api/eval/reports` | 获取历史评测列表 |

## 常用请求示例

### 1. 上传文档

```bash
curl -X POST "http://127.0.0.1:8000/api/documents/upload" \
  -F "file=@sample.txt" \
  -F "title=Sample" \
  -F "source=sample.txt"
```

### 2. 构建索引

```bash
curl -X POST "http://127.0.0.1:8000/api/index/build" \
  -H "Content-Type: application/json" \
  -d '{"async_process": false}'
```

### 3. 发起问答

```bash
curl -X POST "http://127.0.0.1:8000/api/qa/query" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "detail",
    "top_k": 5,
    "rerank_k": 20,
    "max_evidence": 5,
    "history": []
  }'
```

### 4. 提交反馈

```bash
curl -X POST "http://127.0.0.1:8000/api/feedback" \
  -H "Content-Type: application/json" \
  -d '{
    "node_id": "chunk-1",
    "score": 4,
    "comment": "useful"
  }'
```

## 真实实现细节（很重要）

### 1. 支持的文档类型

当前后端明确支持：

- `.txt`
- `.md`
- `.markdown`
- `.docx`
- `.pdf`

超出这些扩展名会直接返回 `400 unsupported file type`。

### 2. 解析规则

- Markdown 通过 `#` 标题识别层级。
- 纯文本通过类似 `1 标题`、`1.1 标题` 的编号标题识别层级。
- DOCX 通过 Heading / Title 样式识别标题。
- PDF 通过 `PyPDF2` 提取文本后按行解析。
- 文本文件会按 `utf-8`、`utf-16`、`gb18030` 依次尝试解码。

### 3. 分块逻辑

- 先按 section 聚合段落，再做滑窗切分。
- `CHUNK_SIZE` 和 `CHUNK_OVERLAP` 当前按字符长度处理，不是 tokenizer token 数。
- `Chunk.token_len` 当前存的也是字符串长度，不是真正 token 数。

### 4. 向量索引不是外部 embedding 服务

当前 `app/index/vector.py` 用的是本地哈希向量实现：

- 不依赖外部 embedding API
- 不依赖 FAISS
- 更适合联调和演示，不适合直接视为生产级语义召回方案

### 5. `doc_count` 实际是 chunk 数

索引元数据里的 `doc_count` 当前使用的是 `len(corpus)`，也就是参与索引的语料条目数（chunk 数），不是去重后的文档数。

### 6. 归档不会真正把文档排除出索引

这点非常重要：

- `/api/documents/{doc_id}/archive` 当前只会修改文档状态和 `meta.archive_path`
- `IndexService.build_index()` 目前没有按 `ARCHIVED` 状态过滤文档
- 因此，已归档但仍保留 chunks 的文档，重新构建索引时仍会进入语料

也就是说，当前“归档”更多是状态管理和 UI 语义，不是严格的索引剔除机制。

### 7. 异步任务队列是内存型的

`TaskQueue` 只存在于应用进程内：

- 服务重启后任务状态不会保留
- 适合本地调试或轻量联调
- 不适合代替持久化任务系统

### 8. LLM 配置覆盖规则

服务启动时会先读环境变量；只有当 `data/llm/config.json` 已存在时，持久化配置才会覆盖默认/环境配置。

如果环境变量里没有 `LLM_API_KEY`，后端还会尝试从 `data/llm/api_key.txt` 读取。

### 9. `moonshot` 模式的真实含义

虽然模式名叫 `moonshot`，但当前实现本质上是一个“OpenAI 兼容风格”的聊天接口适配器，要求服务端至少提供：

- `GET /models`
- `POST /chat/completions`

并使用 Bearer Token 认证。

当 `enable_web_search=true` 且本地没有证据时，代码会尝试走 `$web_search` 工具调用循环；这要求上游模型服务本身支持这一机制。

### 10. 问答失败时会回退到证据摘要

如果出现以下情况：

- LLM 调用失败
- LLM 返回空答案
- 答案校验失败

后端会回退为基于证据的摘要回答，并把 `verify_status` 标成 `FALLBACK` 或相关状态，而不是直接抛 500。

## 建议的联调顺序

1. 启动后端服务
2. 打开 Swagger 检查 `/health` 和 `/ready`
3. 上传一份 `.txt` 或 `.md` 测试文档
4. 调用 `/api/index/build`
5. 调用 `/api/qa/query`
6. 如需前端联调，再启动 `frontend`
7. 如需评测，再调用 `/api/eval/run`

## 常见问题

### `/ready` 返回 `ready=false`

优先检查：

- `APP_ENV` 是否为 `dev` / `test` / `prod`
- `LOG_LEVEL` 是否合法
- `CHUNK_OVERLAP` 是否小于 `CHUNK_SIZE`
- `LLM_MODE` 是否为 `mock` / `disabled` / `moonshot`

### `/api/qa/query` 返回 409

通常表示索引还没准备好。先执行：

1. 上传文档
2. 构建索引
3. 再发起问答

### `/api/llm/models` 或 `/api/llm/test` 报错

优先检查：

- `LLM_MODE` 是否已切到 `moonshot`
- `base_url` 是否包含正确的 `/v1` 前缀
- `api_key` 是否已保存
- `model_id` 是否有效
- 上游服务是否真的实现了 `/models` 和 `/chat/completions`

### 前端访问时报跨域错误

请设置 `CORS_ALLOW_ORIGINS`，或使用默认开发地址 `http://127.0.0.1:5173` / `http://localhost:5173`。