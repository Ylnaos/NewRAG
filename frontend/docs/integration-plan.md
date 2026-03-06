# NewRAG 前后端对接文档（集成计划）

版本：v1.0
日期：2026-01-05
依据：planning_docs/plan-frontend.md、planning_docs/phase-status-frontend.csv、前端现有页面与 mock 逻辑

---

## 0. 目标与范围
- 目标：明确前后端数据契约、状态机与流程，保证文档上传→索引→问答→证据→评测的可验证闭环。
- 范围：文档管理、索引管理、问答工作台、证据图谱、反馈、评测、系统状态、配置。
- 非目标：不约束后端算法实现细节；不在前端保存明文 API Key。

---

## 1. 状态定义

### 1.1 文档状态
- `RAW`：已上传，待解析
- `PARSED`：结构树可用
- `CHUNKED`：分块完成
- `EMBEDDED`：向量生成完成
- `INDEXED`：索引可用
- `READY`：可检索
- `ERROR`：处理失败（需附错误原因）
- `ARCHIVED`：归档（不参与索引）

### 1.2 查询阶段状态
- `RETRIEVE_COARSE`：粗检索进行中
- `RERANK_FINE`：精排进行中
- `FUSE_EVIDENCE`：证据融合进行中
- `GENERATE_ANSWER`：生成答案中
- `VERIFY_ANSWER`：一致性校验中
- `DONE`：结果就绪

### 1.3 索引构建与评测状态
- 索引构建步骤：`pending` / `active` / `done`
- 评测任务状态：`idle` / `running` / `done`

### 1.4 队列与系统健康
- 队列任务：`queued` / `running` / `done`
- 健康检查：`healthy` / `degraded` / `down`

### 1.5 图谱与证据类型（统一口径）
- 文档图谱节点：`root` / `section` / `concept`
- 证据图谱节点（问答链路）：`document` / `concept`
- 统一建议：对外暴露统一的 `node.type` 集合，并提供 `node.kind`/`node.level` 作为细分字段，避免类型混用。

### 1.6 UI 通用状态
- `Idle` / `Loading` / `Empty` / `Error` / `Success`

---

## 2. 流程描述

### 2.1 文档上传与解析
1. 用户上传文件 → `POST /api/documents/upload`。
2. 返回 `doc_id` 与初始状态 `RAW`。
3. 后端异步推进状态：`RAW` → `PARSED` → `CHUNKED` → `EMBEDDED` → `INDEXED` → `READY`。
4. 前端轮询或订阅状态变更（建议轮询 `/api/documents/{id}` 或 `/api/documents`）。

### 2.2 索引构建
1. 管理员触发构建 → `POST /api/index/build`。
2. 返回构建任务信息；前端显示构建步骤与进度。
3. 构建完成后，`/api/index/status` 更新版本与覆盖率。

### 2.3 问答检索与证据
1. 用户提交 query → `POST /api/qa/query`。
2. 返回 `answer_id`、答案、阶段耗时、证据列表、引用与图谱（可分步获取）。
3. 前端渲染证据卡片与图谱，并允许反馈。

### 2.4 反馈与标注
1. 用户评分/评论/冲突标记 → `POST /api/feedback`。
2. 可查询历史反馈 → `GET /api/feedback`。

### 2.5 评测
1. 触发评测 → `POST /api/eval/run`。
2. 获取任务进度 → `GET /api/eval/tasks`。
3. 获取报告 → `GET /api/eval/report/{id}`（支持 JSON/CSV）。

### 2.6 系统健康与队列
1. 健康检查 → `GET /health` / `GET /ready`。
2. 服务/队列状态 → `GET /api/system/status` 与 `GET /api/system/queue`。

### 2.7 思维链（可选）
- 链表列表 → `GET /api/chains`。
- 链表详情 → `GET /api/chains/{id}`。

---

## 3. 推论逻辑（可验证规则）
- 文档状态单调推进：`RAW` → `READY` 不可逆；`ERROR` 与 `ARCHIVED` 为终止态。
- `READY` 必须满足：结构树存在、chunk 可查、向量完成、索引版本一致。
- 问答结果中 `evidence[].chunk_id` 必须能映射到文档与结构树节点。
- 图谱节点必须与证据或结构树存在可追溯关系（可通过 `node.path` 或 `node_id` 关联）。
- 当 `index_ready=false` 时，`/api/qa/query` 允许返回“仅证据摘要”或直接拒绝（HTTP 409）。

---

## 4. 边界条件与降级策略
- 大文件上传：限制文件大小（建议 ≤ 50MB），超限返回 413 并提示。
- 结构树为空：返回空数组并展示 `Empty` 状态，不应报错。
- 索引未就绪：前端显示警告并提供“触发索引”入口。
- LLM 超时：展示“仅证据摘要”与重试入口。
- 图谱节点过多：服务端采样或分页返回，并提供 `truncated=true` 标记。
- 评测任务 > 60s：前端提示超时风险，后端需支持异步任务与轮询。

---

## 5. 风险清单（重点标注）
- ⚠️ 索引未就绪：问答结果不可信或不可用，需强制 gating 与用户提示。
- ⚠️ LLM mock：当前前端为 mock 输出，真实 LLM 接入后可能出现延迟与字段差异。
- ⚠️ 图谱类型混用：文档图谱与证据图谱类型口径不同，需统一 `node.type` 与字段映射。
- 数据量风险：图谱节点/证据数量过大导致前端渲染卡顿。
- 字段漂移风险：后端字段变更会导致 UI 解析失败，需版本化或兼容映射层。

---

## 6. 接口契约

### 6.1 通用约定
- Base URL：`/api`
- 时间格式：ISO 8601
- 分页参数：`page`（1-based）、`page_size`、`total`、`items[]`
- 错误响应示例：

```json
{
  "error_code": "INDEX_NOT_READY",
  "message": "Index is not ready.",
  "detail": "Build index before querying."
}
```

### 6.2 文档与结构树

#### POST /api/documents/upload
- Content-Type：`multipart/form-data`
- 请求字段：
  - `file`：文件
  - `tags`：可选标签数组
- 响应字段：
  - `doc_id`、`status`、`name`、`size_bytes`

#### GET /api/documents
- Query：`page`、`page_size`、`status`、`keyword`
- 响应字段：
  - `items[]`：`id` `name` `type` `status` `updated_at` `version` `pages` `chunks` `tags[]`
  - `total`

#### GET /api/documents/{id}
- 响应字段：
  - `id` `name` `type` `status` `updated_at` `version` `pages` `chunks` `tags[]`

#### GET /api/documents/{id}/tree
- 响应字段：树形结构 `nodes[]`，每个节点包含 `id` `title` `path` `children[]`

#### GET /api/documents/{id}/graph
- 响应字段：`nodes[]`、`edges[]`

#### GET /api/documents/{id}/evidence (可选)
- Query：`node_id`（可选）
- 响应字段：`evidence[]`（用于文档详情页证据列表）

#### DELETE /api/documents/{id}
- 响应：`{ "ok": true }`

#### POST /api/documents/{id}/archive
- 响应：`{ "ok": true }`

### 6.3 索引管理

#### POST /api/index/build
- 请求：`{ "doc_ids": ["..."], "force": false }`
- 响应：`{ "build_id": "...", "status": "active" }`

#### GET /api/index/status
- 响应字段：`index_version` `coverage` `ready_docs` `total_docs` `last_run_at`

#### GET /api/index/runs
- 响应字段：`runs[]`（`id` `started_at` `duration` `docs_indexed` `status` `version`）

### 6.4 问答与证据

#### POST /api/qa/query
- 请求字段：
  - `query` `top_k` `rerank_k` `use_structure_prior`
  - `model` `enable_thinking` `enable_tuning`
- 响应字段：
  - `answer_id` `answer` `citations[]`
  - `evidence[]`（`id` `doc_name` `chunk_id` `score` `path` `source_rank` `conflict` `redundant` `snippet`）
  - `stages[]`（`key` `status` `duration_ms`）
  - `graph`（可选）

#### GET /api/answers/{id}/evidence
- 响应字段：`evidence[]`

#### GET /api/answers/{id}/graph
- 响应字段：`nodes[]`、`edges[]`

### 6.5 反馈

#### POST /api/feedback
- 请求字段：
  - `answer_id` `score` `comment`
  - `uncertain` `conflict` `evidence_ids[]`
- 响应：`{ "ok": true, "feedback_id": "..." }`

#### GET /api/feedback
- Query：`answer_id`（可选）
- 响应字段：`items[]`（`id` `score` `comment` `uncertain` `conflict` `evidence_ids[]` `created_at`）

### 6.6 LLM 配置

#### POST /api/llm/config
- 请求字段：`base_url` `model` `system_prompt` `enable_thinking` `enable_tuning`
- 约束：API Key 不落盘，可仅在请求头临时传输。
- 响应：`{ "ok": true }`

#### POST /api/llm/test
- 请求字段：`base_url` `model`
- 响应字段：`latency_ms` `message`

### 6.7 评测

#### POST /api/eval/run
- 请求字段：`suite_id`（可选）`max_duration_s`
- 响应字段：`task_id` `status`

#### GET /api/eval/tasks
- 响应字段：`tasks[]`（`id` `name` `status` `duration`）

#### GET /api/eval/report/{id}
- 响应字段：`metrics` `tasks` `version` `generated_at`

#### GET /api/eval/report/{id}.csv
- 响应：CSV 文件

### 6.8 系统状态

#### GET /health /ready
- 响应字段：`status` `components[]`

#### GET /api/system/status
- 响应字段：`services[]`（`name` `endpoint` `status` `latency_ms`）

#### GET /api/system/queue
- 响应字段：`items[]`（`id` `task` `status` `eta`）

### 6.9 思维链（可选）

#### GET /api/chains
- Query：`type`（可选）
- 响应字段：`items[]`（`id` `title` `type` `updated_at` `summary`）

#### GET /api/chains/{id}
- 响应字段：`root`（树形结构）`evidence[]`

---

## 7. 验收要点
- 状态映射正确：文档与问答阶段状态与 UI 显示一致。
- 索引 gating 生效：索引未就绪时，前端有明确提示与处理路径。
- 证据可追溯：证据列表能映射到文档与结构树节点。
- 图谱一致性：图谱节点类型统一，结构树与图谱联动可用。
- 反馈闭环：反馈可提交并可查询，字段完整。
- 评测可验证：单次运行 < 60s，报告可导出 JSON/CSV。
- 安全约束：前端不保存明文 API Key；敏感配置仅短时传输。
- 性能基线：首屏渲染 ≤ 2s，图谱渲染保持可操作性。

---

如有接口变动或新增字段，请同步更新本文档与前端适配层。
