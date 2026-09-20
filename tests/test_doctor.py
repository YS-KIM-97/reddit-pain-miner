from reddit_pain_miner.config import PipelineSettings
from reddit_pain_miner.doctor import checks_passed, format_checks, run_checks


def test_doctor_reports_missing_credentials(monkeypatch, tmp_path) -> None:
    for name in (
        "REDDIT_CLIENT_ID",
        "REDDIT_CLIENT_SECRET",
        "REDDIT_USER_AGENT",
        "OPENAI_API_KEY",
        "SLACK_WEBHOOK_URL",
    ):
        monkeypatch.delenv(name, raising=False)

    settings = PipelineSettings.model_validate(
        {
            "reddit": {"subreddits": ["test"], "keywords": ["pain"]},
            "analysis": {},
            "output": {"directory": str(tmp_path), "notify_slack": False},
        }
    )
    checks = run_checks(settings)
    output = format_checks(checks)
    assert not checks_passed(checks)
    assert "missing: OPENAI_API_KEY" in output
    assert "Slack webhook: not configured (optional)" in output
