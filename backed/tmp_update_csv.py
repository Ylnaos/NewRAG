import csv
from pathlib import Path

path = Path("C:/Users/Sin/Desktop/CodexSkill/agent-designer/NewRAG/backed/phase-status.csv")

with path.open("r", encoding="utf-8-sig", newline="") as handle:
    reader = csv.DictReader(handle)
    fieldnames = reader.fieldnames
    rows = list(reader)

if not fieldnames:
    raise SystemExit("CSV header missing")

updates = {
    3: "验收：pytest tests/test_health.py",
    4: "验收：代码检查 app/core/config.py；/ready 返回配置校验字段",
    5: "验收：pytest tests/test_request_id.py；app/core/logging.py JSON日志",
    6: "验收：手工验证 TaskQueue 超时/重试（attempts=2）",
    7: "验收：pytest tests/test_documents.py（上传/拒绝未知扩展）",
    9: "验收：pytest tests/test_retriever.py；app/documents/chunker.py",
    10: "验收：pytest tests/test_documents.py（/tree）",
    11: "验收：手工验证 解析异常PDF回退；app/documents/service.py",
    12: "验收：pytest tests/test_index.py；app/index/bm25.py",
    13: "验收：pytest tests/test_index.py；app/index/vector.py",
    14: "验收：pytest tests/test_index.py（构建/回滚）",
    15: "验收：pytest tests/test_retriever.py（coarse_sections）",
    16: "验收：pytest tests/test_retriever.py（fine_chunks重排）",
    17: "验收：pytest tests/test_evidence.py（冗余标记）",
    18: "验收：pytest tests/test_evidence.py（冲突标记）",
    19: "验收：app/evidence/service.py 加权排序",
    20: "验收：pytest tests/test_qa.py（mock/disabled）",
    21: "验收：app/qa/prompt.py 证据提示模板",
    22: "验收：pytest tests/test_qa.py（verify_status=PASS）",
    23: "验收：pytest tests/test_qa.py（fallback）",
    24: "验收：pytest tests/test_api_endpoints.py（/api/qa/query）",
    25: "验收：pytest tests/test_documents.py（upload）；app/api/routes/documents.py",
    26: "验收：pytest tests/test_documents.py（/tree）",
    27: "验收：pytest tests/test_api_endpoints.py（/api/feedback）",
    28: "验收：pytest tests/test_health.py（/health,/ready）",
    30: "验收：pytest tests/test_eval.py（report 输出）",
    31: "验收：pytest tests/test_eval.py（report.json/csv）",
}

for idx, note in updates.items():
    if idx < 1 or idx > len(rows):
        raise SystemExit(f"invalid row index {idx}")
    row = rows[idx - 1]
    row["功能验收"] = "是"
    row["状态"] = "已验收"
    remark = row.get("备注") or ""
    if remark:
        separator = "；" if not remark.endswith((";", "；")) else ""
        row["备注"] = f"{remark}{separator}{note}"
    else:
        row["备注"] = note

with path.open("w", encoding="utf-8-sig", newline="") as handle:
    writer = csv.DictWriter(handle, fieldnames=fieldnames)
    writer.writeheader()
    writer.writerows(rows)
