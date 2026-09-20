from __future__ import annotations

from datetime import date
from pathlib import Path
from urllib.parse import urlparse

from pydantic import BaseModel, Field, model_validator

from reddit_pain_miner.filtering import has_verbatim_overlap
from reddit_pain_miner.io import read_json, write_json, write_text
from reddit_pain_miner.models import AppIdea, IdeaReport, PainSignal, SourcePlatform
from reddit_pain_miner.prd import generate_spec_offline
from reddit_pain_miner.reporting import idea_report_markdown, spec_markdown


class ResearchScenario(BaseModel):
    """A reviewed, reproducible research fixture for pre-API testing."""

    name: str
    theme: str
    researched_at: date
    signals: list[PainSignal] = Field(min_length=2)
    report: IdeaReport
    evidence_map: dict[str, list[str]]

    @model_validator(mode="after")
    def validate_grounding(self) -> ResearchScenario:
        signal_ids = [signal.id for signal in self.signals]
        if len(signal_ids) != len(set(signal_ids)):
            raise ValueError("Research signal IDs must be unique.")
        if self.report.source_count != len(self.signals):
            raise ValueError("report.source_count must equal the number of research signals.")

        idea_ids = {idea.id for idea in self.report.ideas}
        if not idea_ids:
            raise ValueError("A research scenario must contain at least one idea.")
        if set(self.evidence_map) != idea_ids:
            raise ValueError("evidence_map must contain exactly one entry for every idea.")

        valid_signal_ids = set(signal_ids)
        for idea_id, evidence_ids in self.evidence_map.items():
            if not evidence_ids:
                raise ValueError(f"Idea {idea_id} must reference at least one signal.")
            unknown = set(evidence_ids) - valid_signal_ids
            if unknown:
                raise ValueError(f"Idea {idea_id} references unknown signals: {sorted(unknown)}")

        for signal in self.signals:
            parsed = urlparse(signal.permalink)
            if parsed.scheme != "https" or not parsed.netloc:
                raise ValueError(f"Signal {signal.id} must use an absolute HTTPS source URL.")
            if signal.source_platform == SourcePlatform.GITHUB and parsed.netloc != "github.com":
                raise ValueError(f"GitHub signal {signal.id} must link to github.com.")

        for idea in self.report.ideas:
            candidate_text = _idea_text(idea)
            if any(has_verbatim_overlap(signal.text, candidate_text) for signal in self.signals):
                raise ValueError(
                    f"Idea {idea.id} contains a long verbatim source phrase; "
                    "research fixtures must be paraphrased."
                )
        return self


def _idea_text(idea: AppIdea) -> str:
    return " ".join(
        (
            idea.name,
            idea.target_user,
            idea.problem,
            idea.core_feature,
            idea.validation_test,
            idea.monetization,
            idea.key_risk,
        )
    )


def load_research_scenario(path: Path) -> ResearchScenario:
    return ResearchScenario.model_validate(read_json(path))


def source_index_markdown(scenario: ResearchScenario) -> str:
    signal_by_id = {signal.id: signal for signal in scenario.signals}
    lines = [
        f"# 조사 근거: {scenario.name}",
        "",
        f"- 조사일: {scenario.researched_at}",
        f"- 주제: {scenario.theme}",
        "- 원칙: 공개 출처를 사람이 검토하고 패러프레이즈했으며 작성자 정보는 저장하지 않음",
        "",
        "## Pain signals",
        "",
    ]
    for signal in scenario.signals:
        lines.extend(
            [
                f"### {signal.id}",
                "",
                f"- 출처: [{signal.community}]({signal.permalink})",
                f"- 유형: {signal.source_platform.value}/{signal.kind.value}",
                f"- 요약(패러프레이즈): {signal.text}",
                f"- 관찰 키워드: {', '.join(signal.matched_keywords)}",
                "",
            ]
        )

    lines.extend(["## 아이디어별 근거 연결", ""])
    ideas = {idea.id: idea for idea in scenario.report.ideas}
    for idea_id, evidence_ids in scenario.evidence_map.items():
        sources = ", ".join(
            f"[{signal_by_id[signal_id].community}]({signal_by_id[signal_id].permalink})"
            for signal_id in evidence_ids
        )
        lines.append(f"- **{ideas[idea_id].name}**: {sources}")
    return "\n".join(lines)


def run_research_scenario(input_path: Path, output_dir: Path) -> tuple[Path, ...]:
    scenario = load_research_scenario(input_path)
    output_dir.mkdir(parents=True, exist_ok=True)

    ideas_path = output_dir / "ideas.json"
    report_path = output_dir / "research-report.md"
    sources_path = output_dir / "source-index.md"
    spec_json_path = output_dir / "mvp-spec.json"
    prd_path = output_dir / "mvp-prd.md"

    write_json(ideas_path, scenario.report)
    write_text(
        report_path,
        idea_report_markdown(
            scenario.report,
            title=f"공개 근거 기반 Pain Point 테스트 — {scenario.name}",
            next_step="최고 점수 아이디어의 MVP PRD를 함께 생성했습니다.",
        ),
    )
    write_text(sources_path, source_index_markdown(scenario))

    top_idea = max(scenario.report.ideas, key=lambda idea: idea.score.total)
    spec = generate_spec_offline(top_idea)
    write_json(spec_json_path, spec)
    write_text(prd_path, spec_markdown(spec))
    return ideas_path, report_path, sources_path, spec_json_path, prd_path
