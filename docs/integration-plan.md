# NewRAG 前后端对接文档（整合版）

版本：v1.1  
日期：2026-01-06  
范围：当前前后端仓库代码对接与差异清单

## 0. 一句话概览
本文件把前后端现状、接口契约、字段映射与缺口清单合并到同一份对接文档，便于统一规划与验收。

## 1. 目标与范围
### 目标
- 🎯 明确现有后端接口与前端页面功能的对接边界。
- 🎯 给出缺口清单（前端缺后端、后端缺前端）与优先级。
- 🎯 输出可执行的对接规划与验收要点。

### 非目标
- 后端业务逻辑不改动，本轮仅补齐前端对接与说明。
- 不改动现有接口运行行为，仅调整前端调用与对接文档。

## 2. 现状盘点
### 2.1 后端已提供接口（FastAPI）
- GET `/health`：健康检查，返回版本与运行时间。
- GET `/ready`：就绪检查，返回配置校验与索引状态。
- POST `/api/documents/upload`：上传文档（multipart），支持 `async_process`。
- GET `/api/documents`：文档列表。
- GET `/api/documents/{doc_id}`：文档详情统计。
- GET `/api/documents/{doc_id}/tree`：文档结构树。
- POST `/api/index/build`：构建索引（支持 `async_process`）。
- GET `/api/index/status`：索引状态。
- POST `/api/qa/query`：问答查询，返回答案、证据、图谱与校验信息。
- POST `/api/feedback`：反馈提交。

### 2.2 前端现有页面/功能（React）
- `/chat`：聊天、附件、思考步骤、证据图谱弹窗。
- `/qa`：问答工作台（参数设置、证据、反馈）。
- `/docs`：文档管理（上传/筛选/删除/归档）。
- `/docs/:id`：文档详情（结构树/证据/图谱）。
- `/index`：索引构建与历史。
- `/graph`：证据图谱总览。
- `/eval`：评测任务与指标。
- `/status`：系统状态/队列/版本。
- `/settings`：LLM 配置、历史、头像。

## 3. 对接约定
### 3.1 基础协议
- Base URL：前端通过 VITE_API_BASE_URL 注入，未配置时使用相对路径。
- 请求头：`X-Request-ID` 可选透传（后端会回写同名 Header）。
- Content-Type：
  - JSON：`application/json`
  - 上传：`multipart/form-data`
- 时间格式：ISO-8601（后端 `created_at` / `updated_at`）。

### 3.2 错误约定（现状）
- FastAPI 默认返回 `{"detail": "..."}`。
- 4xx：参数/状态冲突；5xx：服务异常。
- 不确定点：是否需要统一错误码结构（需进一步确认）。

## 4. 接口契约（现有）
### 4.1 文档
1) POST `/api/documents/upload`
- 入参：`file`(必填), `title`(可选), `source`(可选), `async_process`(可选)。
- 出参：`{ doc_id, status, task_id? }`。

2) GET `/api/documents`
- 出参：`{ documents: [{ doc_id, title, source, status, meta, created_at, updated_at }] }`

3) GET `/api/documents/{doc_id}`
- 出参：`{ document, sections, paragraphs, chunks }`

4) GET `/api/documents/{doc_id}/tree`
- 出参：`{ doc_id, tree: [{ id, title, path, children? }] }`

### 4.2 索引
1) POST `/api/index/build`
- 入参：`{ async_process: boolean }`
- 出参：`{ task_id }` 或 `{ index }`

2) GET `/api/index/status`
- 出参：`{ index }`（含 `status/version/build_time/doc_count` 等）

### 4.3 问答
POST `/api/qa/query`
- 入参：
```json
{
  "query": "string",
  "top_k": 5,
  "rerank_k": 20,
  "max_evidence": 5
}
```
- 出参（核心字段）：
```json
{
  "answer": "string",
  "evidence": [
    {
      "chunk_id": "string",
      "doc_id": "string",
      "section_id": "string",
      "path": "string",
      "text": "string",
      "score": 0.0,
      "redundant_flag": false,
      "conflict_flag": false,
      "confidence": 0.0
    }
  ],
  "citations": [{ "chunk_id": "string", "doc_id": "string", "path": "string", "score": 0.0 }],
  "graph": { "nodes": [], "edges": [] },
  "verify_status": "PASS|FALLBACK",
  "verify_detail": { "status": "PASS|FAIL", "overlap": 0.0 },
  "fallback_reason": "string",
  "coarse_sections": []
}
```

### 4.4 反馈
POST `/api/feedback`
- 入参：`{ node_id, score, comment?, doc_id? }`
- 出参：`{ feedback }`

### 4.5 健康检查
- GET `/health`
- GET `/ready`

## 5. 字段映射与差异
### 5.1 文档（Document）
- 前端 `DocumentItem.id` ⇔ 后端 `document.doc_id`
- 前端 `name` ⇔ 后端 `title`
- 前端 `status` ⇔ 后端 `status`（前端包含 `ARCHIVED/ERROR`，后端未定义）
- 前端缺失字段：`sizeLabel/pages/version/tags`（建议后端补充或前端从 `meta`/文件信息推导）

### 5.2 证据（Evidence）
- 前端 `chunkId` ⇔ 后端 `chunk_id`
- 前端 `nodeId` ⇔ 后端 `section_id`
- 前端 `conflict/redundant` ⇔ 后端 `conflict_flag/redundant_flag`
- 缺失字段：`sourceRank/snippet/id`（可由后端补齐或前端基于排序与截断生成）

### 5.3 图谱（Graph）
- 后端 `graph.nodes` 为“证据链式”节点；前端有“结构树图谱”与“证据图谱弹窗”两套模型。
- 建议：明确图谱类型字段（例如 `type: evidence|structure|conversation`），避免误用。

### 5.4 反馈（Feedback）
- 前端期望 `uncertain/conflict/evidenceIds`，后端当前仅支持 `node_id/score/comment/doc_id`。
- 建议：统一反馈结构或拆分为“评分反馈/证据标注”两类接口。

### 5.5 状态定义
- 文档状态：后端已有 `RAW/PARSED/CHUNKED/EMBEDDED/INDEXED/READY`。
- 前端额外状态：`ARCHIVED/ERROR`，需协商扩展或前端本地映射。
- 查询流程：前端展示 `RETRIEVE_COARSE → RERANK_FINE → FUSE_EVIDENCE → GENERATE_ANSWER → VERIFY_ANSWER`，后端目前不输出阶段耗时。

## 6. 流程描述（端到端）
1. 文档上传 → 解析/切分 → 构建索引 → 索引就绪。  
2. 用户提问 → 召回/重排 → 证据融合 → 生成答案 → 校验 → 返回证据与图谱。  
3. 用户反馈 → 提交评分/评论 → 反馈入库。  

## 7. 边界条件与风险检查
- ⚠️ 无可用索引时 `/api/qa/query` 返回 409（前端需提示构建索引）。
- ⚠️ 文档上传类型/大小限制（后端拒绝不支持类型与超限文件）。
- ⚠️ LLM 处于 `mock/disabled` 模式，答案非真实推理结果。
- ⚠️ 图谱类型混用风险：结构图与证据图字段不一致。
- ⚠️ 异步任务缺少查询接口：`task_id` 无法轮询跟踪。

## 8. 缺口汇总（详见 CSV）
- 前端缺后端实现：10 项（已完成 9，阻塞 1）
- 后端缺前端实现：14 项（待后端补齐）
- CSV：`docs/integration-gaps.csv`

## 9. 对接规划（建议）
### P0 对接基础（已完成）
- 完成文档上传/列表/详情/结构树对接。
- 完成索引构建与状态对接。
- 完成问答查询与反馈提交对接。
- 验收：端到端“上传 → 构建 → 询问 → 反馈”跑通。
- 状态：前端对接已完成，索引就绪与任务队列仍依赖后端。

### P1 体验补齐（数据一致性）
- 补齐文档状态与元数据字段。
- 补齐证据字段（排名/片段）与图谱类型标识。
- 加入 `/health` / `/ready` 实时状态。
- 验收：前端展示与后端字段一致，无需 mock 数据。
- 状态：系统状态已接入，其余字段补齐依赖后端。

### P2 运营与评测
- 增加评测 API、任务队列查询、索引历史、LLM 配置接口。
- 验收：评测报告可导出，队列/任务可监控。

## 10. 验收要点（可验证）
- 文档列表与详情字段一致且可追溯。
- QA 返回的证据与图谱可视化无字段缺失。
- 关键接口 4xx/5xx 行为可复现并有前端提示。
- 单次评测与任务执行在 60s 内完成。











