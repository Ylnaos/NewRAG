# 前后端联调验收报告

日期：2026-01-22 11:45  
范围：NewRAG 前后端联调与功能完成度验收

## 一句话结论
前后端核心链路已打通并通过验收；仅真实 LLM（moonshot）联通性因缺少参数未验证。

## 状态定义
- 已通过：前后端接口可用且关键流程跑通。
- 未通过：已接入但因后端不可用/错误导致失败。
- 未验证：暂未执行或需要明确确认后才能执行。
- 阻塞：依赖前置条件未满足，无法验证。

## 测试环境与参数
- 操作系统：Windows
- Python：3.11.1
- Node.js：v22.17.1
- Vite：v5.4.21
- 前端地址：http://127.0.0.1:5173
- 后端地址：http://127.0.0.1:8000（运行中）
- VITE_API_BASE_URL：http://127.0.0.1:8000（已注入）
- 前端调试：Chrome MCP
- 测试文档：upload-smoke.txt（doc_id: 27ec8747-0a4d-4412-886f-e4347d1d75b4）

## 关键证据（本次验收）
- 文档上传：`POST /api/documents/upload` 200；文档在 `/docs` 可见。
- 索引构建：`POST /api/index/build` 200；`/index` 显示 `READY`，版本 `v2.0`，文档就绪 `1/1`。
- QA：`POST /api/qa/query` 200；`verify_status=PASS`；`answer_id=7d34e0f6-000f-4c9e-8ad6-e8afb94935d2`。
- 答案图谱：`GET /api/answers/{answer_id}/graph` 200（验证图谱节点含 `upload-smoke.txt`）。
- 反馈：`POST /api/feedback` 200；前端出现“反馈已提交”，历史记录可见。
- LLM 连接测试（mock）：`POST /api/llm/test` 返回 `status=ok`（延迟 0ms）。
- 评测：`POST /api/eval/run` 200；`report_id=ddc87ed8-a114-4ae0-b8dd-6f529e639acf`；`GET /api/eval/report/{id}` 200。
- 删除：`DELETE /api/documents/{id}` 已验证（通过 UI 删除测试文档，刷新后不再出现）。

## 验证流程
1. 启动后端：`python -m uvicorn app.main:app --host 127.0.0.1 --port 8000`。
2. 启动前端：`VITE_API_BASE_URL=http://127.0.0.1:8000` + Vite dev server。
3. Chrome MCP 访问 `/status`、`/docs`、`/docs/{id}`、`/index`、`/qa`、`/chat`、`/graph`、`/settings`、`/eval`。
4. 索引构建：`POST /api/index/build`，确认 `GET /api/index/status` READY。
5. QA 查询 + 反馈提交，验证 `/api/qa/query`、`/api/feedback`。
6. Chat 证据图谱，验证 `/api/answers/{id}/graph`。
7. 评测运行与报告，验证 `/api/eval/run`、`/api/eval/report/{id}`。
8. LLM 配置与权重保存，验证 `/api/llm/config`、`/api/llm/test`、`/api/qa/weights`。

## 未完成/未通过验收清单
| 模块 | 功能/接口 | 期望 | 实际 | 结论 | 证据/备注 |
| --- | --- | --- | --- | --- | --- |
| LLM 配置 | 非 mock 模式 `/api/llm/test`（moonshot） | 真实模型联通 | 未提供真实 API Key/Base URL/模型 ID | 未验证 | 仅验证 mock 模式成功；需提供 moonshot 参数复测 |

## 已通过/可运行项
- 后端启动、`/health`、`/ready` 可用。
- 文档列表、上传、详情、结构树接口可用。
- 文档归档/恢复接口可用，状态同步到前端。
- 文档删除接口可用（DELETE）。
- 索引构建与状态查询可用。
- QA 查询、证据展示与反馈提交可用（索引 READY 前置）。
- Chat 证据图谱可用（`/api/answers/{id}/graph`）。
- 评测运行与报告可用。
- 任务队列接口可用（无排队任务）。
- LLM 配置读取/保存、连接测试（mock 模式）与权重保存可用。

## 关键修复记录
- 修复文档详情页重复请求 `/api/documents/{id}` 的循环触发，改为依赖 `documentId` 避免反复拉取。
- 修复后端 LLM 持久化配置在未配置时覆盖环境变量的问题（测试与 `LLM_MODE=disabled` 场景）。

## 推论逻辑
- 后端健康与接口返回 200 → 关键联调链路具备可用性。
- 索引构建为 QA 查询前置条件；索引 READY 后，QA 与评测正常完成。

## 边界条件与风险检查
- LLM 真实服务未验证（当前 mode=mock），生产连通性与鉴权仍有风险。
- 删除属于破坏性操作，建议仅对测试文档执行并注意数据备份。
- 文档归档/恢复后需重建索引以保持 QA 结果一致性。

## 下一步建议
1. 提供 Moonshot（Kimi）真实 API Key/Base URL/模型 ID，复测非 mock 模式联通性与 `$web_search`。
2. 若接入更多文档，建议重新构建索引并复测 QA/评测。
