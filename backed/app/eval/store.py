from __future__ import annotations

import csv
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class EvalStore:
    def __init__(self, base_dir: str) -> None:
        self._base_dir = Path(base_dir) / "eval" / "reports"
        self._base_dir.mkdir(parents=True, exist_ok=True)
        self._index_path = self._base_dir / "index.json"

    def save(self, report_id: str, report: Dict[str, Any]) -> None:
        target_dir = self._base_dir / report_id
        target_dir.mkdir(parents=True, exist_ok=True)
        self._write_report(report, target_dir)
        self._update_index(report_id, report)

    def load(self, report_id: str) -> Optional[Dict[str, Any]]:
        report_path = self._base_dir / report_id / "report.json"
        if not report_path.exists():
            return None
        return json.loads(report_path.read_text(encoding="utf-8"))

    def list_reports(self) -> List[Dict[str, Any]]:
        if not self._index_path.exists():
            return []
        payload = json.loads(self._index_path.read_text(encoding="utf-8"))
        return list(payload.get("reports", []))

    def _write_report(self, report: Dict[str, Any], output_dir: Path) -> None:
        json_path = output_dir / "report.json"
        json_path.write_text(json.dumps(report, ensure_ascii=True, indent=2), encoding="utf-8")

        csv_path = output_dir / "report.csv"
        rows = report.get("samples", [])
        if not rows:
            csv_path.write_text("", encoding="utf-8")
            return
        fieldnames = list(rows[0].keys())
        with csv_path.open("w", encoding="utf-8", newline="") as handle:
            writer = csv.DictWriter(handle, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(rows)

    def _update_index(self, report_id: str, report: Dict[str, Any]) -> None:
        summary = report.get("summary", {})
        payload = {"reports": []}
        if self._index_path.exists():
            payload = json.loads(self._index_path.read_text(encoding="utf-8"))
        reports = list(payload.get("reports", []))
        reports.insert(
            0,
            {
                "report_id": report_id,
                "created_at": _utcnow().isoformat(),
                "sample_count": summary.get("sample_count", 0),
                "avg_recall": summary.get("avg_recall", 0.0),
                "avg_mrr": summary.get("avg_mrr", 0.0),
                "avg_ndcg": summary.get("avg_ndcg", 0.0),
                "avg_evidence_coverage": summary.get("avg_evidence_coverage", 0.0),
                "avg_latency_ms": summary.get("avg_latency_ms", 0.0),
                "p95_latency_ms": summary.get("p95_latency_ms", 0.0),
            },
        )
        payload["reports"] = reports[:50]
        self._index_path.write_text(json.dumps(payload, ensure_ascii=True, indent=2), encoding="utf-8")
