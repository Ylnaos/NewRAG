# NewRAG SiliconFlow 验收记录

- 日期: 2026-03-05
- 范围: LLM 配置落地、索引与图谱链路、端到端可用性
- 目标: 验证 `moonshot` 模式复用 SiliconFlow 配置后，全流程可运行

## 配置落地

- 文件: `backed/data/llm/config.json`
  - `base_url`: `https://api.siliconflow.cn/v1`
  - `model_id`: `Pro/zai-org/GLM-4.7`
  - `mode`: `moonshot`
- 文件: `backed/data/llm/api_key.txt`
  - 已写入测试 Key（按需求明文存储）

## 执行命令与结果

1. 后端测试
   - 命令: `PYTHONPATH=. pytest -q`
   - 结果: `24 passed`
2. 前端代码质量
   - 命令: `npm run lint`
   - 结果: 通过（0 warning）
3. 前端构建
   - 命令: `npm run build`
   - 结果: 通过（Vite build success）
4. 真实联调验收
   - 命令: `PYTHONPATH=. python scripts/run_acceptance_smoke.py`
   - 结果: 全部 PASS
   - 关键响应:
     - `/api/llm/models`: `model_count=128`
     - `/api/llm/test`: `status=ok`, `latency_ms=10265`
     - `/api/index/build`: `status=READY`, `version=5`
     - `/api/qa/query`: `verify_status=PASS`, `evidence=3`, `graph_nodes=2`
     - `/api/answers/{id}/graph`: 可用

## 本轮补齐项

- 修复前端 lint 阻断项:
  - `frontend/src/contexts/DocumentsContext.tsx` 去除 `archiveDocument` 的无效 hook 依赖
- 新增后端回归测试:
  - `backed/tests/test_structured_output.py`
    - 覆盖 `mindmap/diagram` 别名解析
  - `backed/tests/test_api_endpoints.py`
    - 新增“LLM 未返回 graph 时，接口回退构图”测试
- 新增验收脚本:
  - `backed/scripts/run_acceptance_smoke.py`
- 新增测试文件套件:
  - `docs/test-suites/suite-04-smoke/smoke_notes.txt`
  - `docs/test-suites/suite-04-smoke/queries.csv`

## 结论

- 当前版本在既定配置下已满足“可用”标准:
  - API 配置可持久化
  - 上传/索引/问答/图谱链路可跑通
  - 结构化输出（思维导图别名）可解析
  - 自动化测试与前端构建均通过

## 剩余风险

- 真实 LLM 依赖外部网络与第三方服务，延迟与可用性存在波动。
- 生产环境仍需额外考虑密钥安全（本次按测试要求明文存储）。
