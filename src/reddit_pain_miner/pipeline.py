from __future__ import annotations

from pathlib import Path

from reddit_pain_miner.analyzer import analyze_offline, analyze_with_openai
from reddit_pain_miner.collector import collect_signals
from reddit_pain_miner.config import PipelineSettings
from reddit_pain_miner.io import read_json, write_json, write_text
from reddit_pain_miner.models import IdeaReport, PainSignal
from reddit_pain_miner.notifier import notify_slack
from reddit_pain_miner.reporting import idea_report_markdown


def load_signals(path: Path) -> list[PainSignal]:
    return [PainSignal.model_validate(item) for item in read_json(path)]


def load_report(path: Path) -> IdeaReport:
    return IdeaReport.model_validate(read_json(path))


def run_pipeline(
    settings: PipelineSettings,
    *,
    input_path: Path | None = None,
    offline: bool = False,
) -> tuple[Path, Path]:
    output_dir = settings.output.directory
    output_dir.mkdir(parents=True, exist_ok=True)
    ideas_path = output_dir / "ideas.json"
    report_path = output_dir / "weekly-report.md"

    signals = load_signals(input_path) if input_path else collect_signals(settings.reddit)
    signals = signals[: settings.analysis.max_signals]

    if offline:
        report = analyze_offline(signals, settings.analysis.idea_count)
    else:
        report = analyze_with_openai(
            signals,
            model=settings.analysis.model,
            idea_count=settings.analysis.idea_count,
            output_language=settings.analysis.output_language,
        )
    write_json(ideas_path, report)
    markdown = idea_report_markdown(report)
    write_text(report_path, markdown)
    if settings.output.notify_slack:
        notify_slack(markdown)
    return ideas_path, report_path
