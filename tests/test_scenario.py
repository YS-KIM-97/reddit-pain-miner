import json
from pathlib import Path

import pytest
from pydantic import ValidationError

from reddit_pain_miner.models import SourcePlatform
from reddit_pain_miner.scenario import load_research_scenario, run_research_scenario

ROOT = Path(__file__).parents[1]
SCENARIO = ROOT / "examples/research/expense-receipts/scenario.json"


def test_research_scenario_is_grounded_and_source_agnostic() -> None:
    scenario = load_research_scenario(SCENARIO)

    assert scenario.report.source_count == 3
    assert {signal.source_platform for signal in scenario.signals} == {
        SourcePlatform.GITHUB
    }
    assert scenario.evidence_map["idea-1"] == [
        "gh-frappe-hrms-4541",
        "gh-ms-business-central-expenses",
    ]


def test_research_scenario_generates_report_sources_and_top_prd(tmp_path: Path) -> None:
    paths = run_research_scenario(SCENARIO, tmp_path)

    assert len(paths) == 5
    assert all(path.exists() for path in paths)
    assert "ClaimSnap" in (tmp_path / "mvp-prd.md").read_text(encoding="utf-8")
    assert "공개 근거 기반 Pain Point 테스트" in (
        tmp_path / "research-report.md"
    ).read_text(encoding="utf-8")
    source_index = (tmp_path / "source-index.md").read_text(encoding="utf-8")
    assert "https://github.com/frappe/hrms/issues/4541" in source_index
    assert "요약(패러프레이즈)" in source_index

    ideas_json = (tmp_path / "ideas.json").read_text(encoding="utf-8")
    assert "gh-frappe-hrms-4541" not in ideas_json
    assert "github.com" not in ideas_json


def test_research_scenario_rejects_unknown_evidence(tmp_path: Path) -> None:
    payload = json.loads(SCENARIO.read_text(encoding="utf-8"))
    payload["evidence_map"]["idea-1"] = ["missing-signal"]
    invalid_path = tmp_path / "invalid.json"
    invalid_path.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")

    with pytest.raises(ValidationError, match="unknown signals"):
        load_research_scenario(invalid_path)
