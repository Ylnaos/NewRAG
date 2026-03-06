import json
from pathlib import Path

from app.eval.runner import run_evaluation


def test_run_evaluation_writes_report(tmp_path) -> None:
    dataset = {
        "defaults": {"top_k": 3, "rerank_k": 5, "max_evidence": 2},
        "documents": [
            {
                "filename": "sample.txt",
                "content": "1 Intro\nHello world.\n\n1.1 Detail\nMore text about evidence.",
            }
        ],
        "samples": [
            {
                "id": "q1",
                "query": "detail evidence",
                "expected_evidence": ["More text about evidence."],
            }
        ],
    }
    dataset_path = tmp_path / "dataset.json"
    dataset_path.write_text(json.dumps(dataset), encoding="utf-8")

    report = run_evaluation(
        str(dataset_path),
        data_dir=str(tmp_path / "data"),
        output_dir=str(tmp_path / "reports"),
    )

    assert report["summary"]["sample_count"] == 1
    assert (tmp_path / "reports" / "report.json").exists()
    assert (tmp_path / "reports" / "report.csv").exists()
