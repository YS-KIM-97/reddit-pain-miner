from __future__ import annotations

import json
import os
from collections import Counter

from openai import OpenAI

from reddit_pain_miner.filtering import has_verbatim_overlap
from reddit_pain_miner.models import (
    EvidenceBackedAppIdea,
    IdeaBatch,
    IdeaReport,
    PainSignal,
    ScoreCard,
)


class AnalysisError(RuntimeError):
    pass


def _compact_signals(signals: list[PainSignal]) -> str:
    payload = [
        {
            "id": signal.id,
            "source_platform": signal.source_platform,
            "community": signal.community,
            "text": signal.text,
            "score": signal.score,
            "keywords": signal.matched_keywords,
        }
        for signal in signals
    ]
    return json.dumps(payload, ensure_ascii=False)


def analyze_with_openai(
    signals: list[PainSignal], *, model: str, idea_count: int, output_language: str
) -> IdeaReport:
    if not os.getenv("OPENAI_API_KEY"):
        raise AnalysisError("OPENAI_API_KEY is required for online analysis.")
    if not signals:
        raise AnalysisError("No pain signals were found; cannot generate grounded ideas.")

    client = OpenAI()
    response = client.responses.parse(
        model=model,
        store=False,
        input=[
            {
                "role": "system",
                "content": (
                    "You are a skeptical product researcher. Generate only evidence-backed "
                    "MVP ideas. Each idea must be buildable by one developer in seven days "
                    "and have exactly one core feature. Use only supplied signal IDs as "
                    "evidence. Paraphrase every problem; do not reproduce source sentences "
                    "or quote more than seven consecutive source words. Never include usernames, "
                    "permalinks, or source content IDs in human-readable fields. "
                    "Avoid generic AI wrappers. "
                    f"Return exactly {idea_count} ideas, ordered by total opportunity score. "
                    f"Write human-readable fields in language code '{output_language}'."
                ),
            },
            {"role": "user", "content": _compact_signals(signals)},
        ],
        text_format=IdeaBatch,
    )
    batch = response.output_parsed
    if batch is None:
        raise AnalysisError("The model did not return a parsed idea report.")
    if len(batch.ideas) != idea_count:
        raise AnalysisError(f"Expected {idea_count} ideas, received {len(batch.ideas)}.")

    valid_ids = {signal.id for signal in signals}
    for idea in batch.ideas:
        if not idea.evidence_signal_ids:
            raise AnalysisError(f"Idea {idea.id} does not reference any evidence signals.")
        unknown = set(idea.evidence_signal_ids) - valid_ids
        if unknown:
            raise AnalysisError(f"Idea {idea.id} references unknown signals: {sorted(unknown)}")
        candidate_text = " ".join(
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
        if any(has_verbatim_overlap(signal.text, candidate_text) for signal in signals):
            raise AnalysisError(
                f"Idea {idea.id} contains a long verbatim source phrase; refusing to persist it."
            )
    return IdeaReport(source_count=len(signals), ideas=batch.ideas)


def analyze_offline(signals: list[PainSignal], idea_count: int = 3) -> IdeaReport:
    """Deterministic demo analyzer; never used as an implicit API fallback."""
    if not signals:
        raise AnalysisError("No pain signals were supplied.")

    ranked = sorted(signals, key=lambda item: (item.score, len(item.text)), reverse=True)
    keyword_counts = Counter(keyword for item in signals for keyword in item.matched_keywords)
    common_keyword = keyword_counts.most_common(1)[0][0] if keyword_counts else "manual work"
    ideas: list[EvidenceBackedAppIdea] = []
    for index in range(idea_count):
        evidence = ranked[index % len(ranked)]
        if evidence.source_platform == "reddit":
            audience = f"r/{evidence.community}"
        elif evidence.source_platform == "github":
            audience = f"{evidence.community} 프로젝트"
        else:
            audience = evidence.community
        ideas.append(
            EvidenceBackedAppIdea(
                id=f"idea-{index + 1}",
                name=f"Pain Signal Pilot {index + 1}",
                target_user=f"{audience}에서 반복 작업을 하는 사용자",
                problem=(
                    f"{audience} 사용자들이 반복적이고 시간이 많이 드는 "
                    "작업을 더 단순하게 처리할 방법을 찾고 있음"
                ),
                core_feature=f"'{common_keyword}' 상황을 한 번의 입력으로 처리하는 단일 워크플로",
                evidence_signal_ids=[evidence.id],
                validation_test=(
                    "관련 커뮤니티 사용자 10명에게 랜딩 페이지를 보여주고 3명 이상 가입"
                ),
                monetization="7일 무료 체험 후 월 구독",
                key_risk="표본이 작아 문제의 빈도를 과대평가할 수 있음",
                score=ScoreCard(
                    pain_intensity=min(5, max(1, evidence.score // 10 + 2)),
                    one_week_feasibility=5,
                    willingness_to_pay=3,
                    distribution_fit=4,
                ),
            )
        )
    return IdeaReport(source_count=len(signals), ideas=ideas)
