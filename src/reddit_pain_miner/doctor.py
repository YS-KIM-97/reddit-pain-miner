from __future__ import annotations

import os
import sys
from dataclasses import dataclass

from openai import OpenAI

from reddit_pain_miner.collector import create_reddit_client, reddit_api_is_approved
from reddit_pain_miner.config import PipelineSettings


@dataclass(frozen=True)
class CheckResult:
    name: str
    ok: bool
    detail: str
    required: bool = True


def _is_set(name: str) -> bool:
    return bool(os.getenv(name, "").strip())


def _safe_error(error: Exception) -> str:
    status_code = getattr(error, "status_code", None)
    suffix = f" (HTTP {status_code})" if status_code else ""
    return f"{type(error).__name__}{suffix}"


def run_checks(settings: PipelineSettings, *, live: bool = False) -> list[CheckResult]:
    checks = [
        CheckResult(
            name="Python",
            ok=sys.version_info >= (3, 11),
            detail=f"{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}",
        )
    ]

    approval_ready = reddit_api_is_approved()
    checks.append(
        CheckResult(
            name="Reddit API approval",
            ok=approval_ready,
            detail="confirmed" if approval_ready else "pending; live access is locked",
        )
    )

    required_env = ("REDDIT_CLIENT_ID", "REDDIT_CLIENT_SECRET", "REDDIT_USER_AGENT")
    reddit_ready = all(_is_set(name) for name in required_env)
    checks.append(
        CheckResult(
            name="Reddit credentials",
            ok=reddit_ready,
            detail="configured"
            if reddit_ready
            else "missing: " + ", ".join(name for name in required_env if not _is_set(name)),
        )
    )

    openai_ready = _is_set("OPENAI_API_KEY")
    checks.append(
        CheckResult(
            name="OpenAI credentials",
            ok=openai_ready,
            detail="configured" if openai_ready else "missing: OPENAI_API_KEY",
        )
    )

    slack_ready = _is_set("SLACK_WEBHOOK_URL")
    checks.append(
        CheckResult(
            name="Slack webhook",
            ok=slack_ready or not settings.output.notify_slack,
            detail=(
                "configured"
                if slack_ready
                else "not configured (optional)"
                if not settings.output.notify_slack
                else "missing: SLACK_WEBHOOK_URL"
            ),
            required=settings.output.notify_slack,
        )
    )

    if live and reddit_ready and approval_ready:
        try:
            reddit = create_reddit_client()
            subreddit = reddit.subreddit(settings.reddit.subreddits[0])
            next(subreddit.top(time_filter="week", limit=1), None)
            checks.append(CheckResult("Reddit API", True, "reachable"))
        except Exception as error:  # API clients expose several transport-specific exceptions
            checks.append(CheckResult("Reddit API", False, _safe_error(error)))

    if live and openai_ready:
        try:
            OpenAI().models.retrieve(settings.analysis.model)
            checks.append(
                CheckResult("OpenAI API", True, f"model accessible: {settings.analysis.model}")
            )
        except Exception as error:  # API clients expose several transport-specific exceptions
            checks.append(CheckResult("OpenAI API", False, _safe_error(error)))

    return checks


def checks_passed(checks: list[CheckResult]) -> bool:
    return all(check.ok for check in checks if check.required)


def format_checks(checks: list[CheckResult]) -> str:
    lines = []
    for check in checks:
        icon = "PASS" if check.ok else "FAIL" if check.required else "SKIP"
        lines.append(f"[{icon}] {check.name}: {check.detail}")
    return "\n".join(lines)
