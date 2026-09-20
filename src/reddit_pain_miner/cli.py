from __future__ import annotations

import argparse
import sys
from pathlib import Path

from dotenv import load_dotenv
from pydantic import ValidationError

from reddit_pain_miner.analyzer import AnalysisError, analyze_offline, analyze_with_openai
from reddit_pain_miner.collector import MissingRedditCredentials, RedditApprovalRequired
from reddit_pain_miner.config import PipelineSettings
from reddit_pain_miner.doctor import checks_passed, format_checks, run_checks
from reddit_pain_miner.io import write_json, write_text
from reddit_pain_miner.pipeline import load_report, load_signals, run_pipeline
from reddit_pain_miner.prd import SpecError, generate_spec_offline, generate_spec_with_openai
from reddit_pain_miner.reporting import idea_report_markdown, spec_markdown

DEFAULT_CONFIG = Path("config/pipeline.yaml")


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="reddit-pain")
    parser.add_argument("--config", type=Path, default=DEFAULT_CONFIG)
    subcommands = parser.add_subparsers(dest="command", required=True)

    doctor = subcommands.add_parser("doctor", help="Check local credentials and API access")
    doctor.add_argument("--live", action="store_true", help="Make read-only API checks")

    analyze = subcommands.add_parser("analyze", help="Turn signals into ranked app ideas")
    analyze.add_argument("--input", type=Path, required=True)
    analyze.add_argument("--output", type=Path, default=Path("artifacts/ideas.json"))
    analyze.add_argument("--offline", action="store_true")

    report = subcommands.add_parser("report", help="Render an idea report as Markdown")
    report.add_argument("--input", type=Path, default=Path("artifacts/ideas.json"))
    report.add_argument("--output", type=Path, default=Path("artifacts/weekly-report.md"))

    prd = subcommands.add_parser("prd", help="Generate an MVP PRD for a selected idea")
    prd.add_argument("--input", type=Path, default=Path("artifacts/ideas.json"))
    prd.add_argument("--idea-id", required=True)
    prd.add_argument("--output", type=Path, default=Path("artifacts/mvp-prd.md"))
    prd.add_argument("--json-output", type=Path, default=Path("artifacts/mvp-spec.json"))
    prd.add_argument("--offline", action="store_true")

    run = subcommands.add_parser("run", help="Run collection, analysis, and reporting")
    run.add_argument("--input", type=Path, help="Use an existing signals file instead of Reddit")
    run.add_argument("--offline", action="store_true")
    return parser


def _execute(args: argparse.Namespace) -> None:
    settings = PipelineSettings.load(args.config)
    if args.command == "doctor":
        checks = run_checks(settings, live=args.live)
        print(format_checks(checks))
        if not checks_passed(checks):
            raise SystemExit(2)
        return

    if args.command == "analyze":
        signals = load_signals(args.input)[: settings.analysis.max_signals]
        report = (
            analyze_offline(signals, settings.analysis.idea_count)
            if args.offline
            else analyze_with_openai(
                signals,
                model=settings.analysis.model,
                idea_count=settings.analysis.idea_count,
                output_language=settings.analysis.output_language,
            )
        )
        write_json(args.output, report)
        print(f"Generated {len(report.ideas)} ideas -> {args.output}")
        return

    if args.command == "report":
        report = load_report(args.input)
        write_text(args.output, idea_report_markdown(report))
        print(f"Rendered report -> {args.output}")
        return

    if args.command == "prd":
        report = load_report(args.input)
        idea = next((item for item in report.ideas if item.id == args.idea_id), None)
        if idea is None:
            available = ", ".join(item.id for item in report.ideas)
            raise ValueError(f"Unknown idea ID '{args.idea_id}'. Available: {available}")
        spec = (
            generate_spec_offline(idea)
            if args.offline
            else generate_spec_with_openai(
                idea,
                model=settings.analysis.model,
                output_language=settings.analysis.output_language,
            )
        )
        write_json(args.json_output, spec)
        write_text(args.output, spec_markdown(spec))
        print(f"Generated MVP spec -> {args.output}")
        return

    paths = run_pipeline(settings, input_path=args.input, offline=args.offline)
    print("Pipeline complete:")
    for path in paths:
        print(f"- {path}")


def main() -> None:
    load_dotenv()
    parser = _parser()
    try:
        _execute(parser.parse_args())
    except (
        AnalysisError,
        FileNotFoundError,
        MissingRedditCredentials,
        RedditApprovalRequired,
        SpecError,
        ValidationError,
        ValueError,
    ) as error:
        print(f"error: {error}", file=sys.stderr)
        raise SystemExit(2) from error


if __name__ == "__main__":
    main()
