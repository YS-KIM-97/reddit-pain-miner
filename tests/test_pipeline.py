from pathlib import Path

from reddit_pain_miner.analyzer import analyze_offline
from reddit_pain_miner.config import PipelineSettings
from reddit_pain_miner.pipeline import load_signals, run_pipeline
from reddit_pain_miner.prd import generate_spec_offline

ROOT = Path(__file__).parents[1]


def test_offline_pipeline_creates_outputs(tmp_path: Path) -> None:
    settings = PipelineSettings.load(ROOT / "config/pipeline.yaml")
    settings.output.directory = tmp_path
    paths = run_pipeline(
        settings,
        input_path=ROOT / "examples/sample_signals.json",
        offline=True,
    )
    assert all(path.exists() for path in paths)
    assert "idea-1" in (tmp_path / "weekly-report.md").read_text(encoding="utf-8")


def test_offline_prd_enforces_small_scope() -> None:
    signals = load_signals(ROOT / "examples/sample_signals.json")
    idea = analyze_offline(signals, idea_count=1).ideas[0]
    spec = generate_spec_offline(idea)
    assert spec.core_feature == idea.core_feature
    assert "팀 협업" in spec.non_goals
    assert len(spec.api_endpoints) == 2
