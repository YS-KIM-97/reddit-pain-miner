from datetime import UTC, datetime

from reddit_pain_miner.models import AppIdea, IdeaReport, ScoreCard
from reddit_pain_miner.reporting import idea_report_markdown


def test_report_is_sorted_by_score() -> None:
    def idea(number: int, score: int) -> AppIdea:
        return AppIdea(
            id=f"idea-{number}",
            name=f"Idea {number}",
            target_user="user",
            problem="problem",
            core_feature="feature",
            evidence_signal_ids=["signal-1"],
            validation_test="test",
            monetization="subscription",
            key_risk="risk",
            score=ScoreCard(
                pain_intensity=score,
                one_week_feasibility=1,
                willingness_to_pay=1,
                distribution_fit=1,
            ),
        )

    report = IdeaReport(
        generated_at=datetime(2026, 9, 21, tzinfo=UTC),
        source_count=1,
        ideas=[idea(1, 1), idea(2, 5)],
    )
    markdown = idea_report_markdown(report)
    assert markdown.index("idea-2") < markdown.index("idea-1")
