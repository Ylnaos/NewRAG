from app.evidence.service import EvidenceFusionService


def test_redundancy_and_conflict_flags() -> None:
    service = EvidenceFusionService(redundancy_threshold=0.5)
    candidates = [
        {
            "chunk_id": "c1",
            "doc_id": "d1",
            "section_id": "s1",
            "path": "root / Intro",
            "text": "The system has 16 cores and runs fast.",
            "score": 0.9,
        },
        {
            "chunk_id": "c2",
            "doc_id": "d1",
            "section_id": "s1",
            "path": "root / Intro",
            "text": "The system has 32 cores and runs fast.",
            "score": 0.8,
        },
        {
            "chunk_id": "c3",
            "doc_id": "d2",
            "section_id": "s2",
            "path": "root / Detail",
            "text": "Unrelated section for coverage.",
            "score": 0.7,
        },
    ]

    fused = service.fuse("system cores", candidates, max_evidence=3)
    assert len(fused) == 3

    conflicts = [item for item in fused if item["conflict_flag"]]
    assert conflicts

    redundant = [item for item in fused if item["redundant_flag"]]
    assert redundant
