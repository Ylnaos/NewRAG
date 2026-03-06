import json

from app.qa.structured_output import parse_qa_output


def test_parse_qa_output_accepts_mindmap_alias() -> None:
    payload = {
        "answer": "ok",
        "mindmap": {
            "nodes": [{"id": 1, "label": "A"}],
            "edges": [{"source": 1, "target": "2"}],
        },
    }
    parsed = parse_qa_output(json.dumps(payload))

    assert parsed.answer == "ok"
    assert parsed.graph is not None
    assert parsed.graph["nodes"][0]["id"] == "1"
    assert parsed.graph["edges"][0]["source"] == "1"
    assert parsed.graph["edges"][0]["target"] == "2"


def test_parse_qa_output_accepts_diagram_alias() -> None:
    payload = {
        "final_answer": "done",
        "diagram": {
            "nodes": [{"id": "root", "label": "Root"}],
            "edges": [],
        },
    }
    parsed = parse_qa_output(json.dumps(payload))

    assert parsed.answer == "done"
    assert parsed.graph is not None
    assert parsed.graph["nodes"][0]["id"] == "root"
    assert parsed.graph["edges"] == []
