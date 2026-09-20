from __future__ import annotations

from reddit_pain_miner.models import IdeaReport, MvpSpec


def idea_report_markdown(report: IdeaReport) -> str:
    lines = [
        "# 주간 Reddit Pain Point 리포트",
        "",
        f"- 생성 시각: {report.generated_at.isoformat()}",
        f"- 분석한 Pain Signal: {report.source_count}개",
        "",
    ]
    for idea in sorted(report.ideas, key=lambda item: item.score.total, reverse=True):
        lines.extend(
            [
                f"## {idea.id}: {idea.name} — {idea.score.total}/20",
                "",
                f"- 대상: {idea.target_user}",
                f"- 문제: {idea.problem}",
                f"- 핵심 기능: {idea.core_feature}",
                f"- 수익화: {idea.monetization}",
                f"- 검증: {idea.validation_test}",
                f"- 핵심 위험: {idea.key_risk}",
                "",
            ]
        )
    lines.append("다음 단계: `reddit-pain prd --idea-id idea-1`처럼 하나를 선택하세요.")
    return "\n".join(lines)


def spec_markdown(spec: MvpSpec) -> str:
    lines = [
        f"# {spec.product_name} MVP PRD",
        "",
        f"> {spec.one_liner}",
        "",
        "## 제품 범위",
        "",
        f"- 사용자: {spec.target_user}",
        f"- 문제: {spec.problem_statement}",
        f"- 유일한 핵심 기능: {spec.core_feature}",
        f"- 수익화: {spec.monetization}",
        "",
        "## 사용자 흐름",
        "",
        *[f"{index}. {step}" for index, step in enumerate(spec.user_flow, start=1)],
        "",
        "## 완료 조건",
        "",
        *[f"- {item}" for item in spec.acceptance_criteria],
        "",
        "## 만들지 않는 것",
        "",
        *[f"- {item}" for item in spec.non_goals],
        "",
        "## API",
        "",
        *[f"- `{item.method} {item.path}` — {item.purpose}" for item in spec.api_endpoints],
        "",
        "## 구현 계획",
        "",
        *[f"- {item}" for item in spec.implementation_plan],
        "",
        "## 중단 기준",
        "",
        *[f"- {item}" for item in spec.kill_criteria],
    ]
    return "\n".join(lines)
