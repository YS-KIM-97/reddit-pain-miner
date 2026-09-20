from __future__ import annotations

from datetime import UTC, datetime
from enum import StrEnum

from pydantic import BaseModel, Field


def utc_now() -> datetime:
    return datetime.now(UTC)


class SourceKind(StrEnum):
    POST = "post"
    COMMENT = "comment"


class PainSignal(BaseModel):
    id: str
    subreddit: str
    kind: SourceKind
    text: str
    score: int = 0
    permalink: str
    matched_keywords: list[str] = Field(default_factory=list)
    post_title: str | None = None
    collected_at: datetime = Field(default_factory=utc_now)


class ScoreCard(BaseModel):
    pain_intensity: int = Field(ge=1, le=5)
    one_week_feasibility: int = Field(ge=1, le=5)
    willingness_to_pay: int = Field(ge=1, le=5)
    distribution_fit: int = Field(ge=1, le=5)

    @property
    def total(self) -> int:
        return (
            self.pain_intensity
            + self.one_week_feasibility
            + self.willingness_to_pay
            + self.distribution_fit
        )


class AppIdea(BaseModel):
    id: str = Field(pattern=r"^idea-[1-9][0-9]*$")
    name: str
    target_user: str
    problem: str
    core_feature: str
    evidence_signal_ids: list[str] = Field(min_length=1)
    validation_test: str
    monetization: str
    key_risk: str
    score: ScoreCard


class IdeaBatch(BaseModel):
    ideas: list[AppIdea]


class IdeaReport(BaseModel):
    generated_at: datetime = Field(default_factory=utc_now)
    source_count: int
    ideas: list[AppIdea]


class DataField(BaseModel):
    name: str
    type: str
    required: bool
    description: str


class DataEntity(BaseModel):
    name: str
    purpose: str
    fields: list[DataField]


class ApiEndpoint(BaseModel):
    method: str
    path: str
    purpose: str


class MvpSpec(BaseModel):
    product_name: str
    one_liner: str
    target_user: str
    problem_statement: str
    core_feature: str
    monetization: str
    user_flow: list[str]
    acceptance_criteria: list[str]
    non_goals: list[str]
    data_model: list[DataEntity]
    api_endpoints: list[ApiEndpoint]
    analytics_events: list[str]
    implementation_plan: list[str]
    launch_checklist: list[str]
    kill_criteria: list[str]
