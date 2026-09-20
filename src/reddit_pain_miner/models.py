from __future__ import annotations

from datetime import UTC, datetime
from enum import StrEnum

from pydantic import AliasChoices, BaseModel, Field


def utc_now() -> datetime:
    return datetime.now(UTC)


class SourceKind(StrEnum):
    POST = "post"
    COMMENT = "comment"
    ISSUE = "issue"
    DOCUMENTATION = "documentation"


class SourcePlatform(StrEnum):
    REDDIT = "reddit"
    GITHUB = "github"
    SYNTHETIC = "synthetic"


class PainSignal(BaseModel):
    id: str
    source_platform: SourcePlatform = SourcePlatform.REDDIT
    community: str = Field(validation_alias=AliasChoices("community", "subreddit"))
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
    validation_test: str
    monetization: str
    key_risk: str
    score: ScoreCard


class EvidenceBackedAppIdea(AppIdea):
    """Transient model used to validate grounding before persistence."""

    evidence_signal_ids: list[str] = Field(min_length=1)


class IdeaBatch(BaseModel):
    ideas: list[EvidenceBackedAppIdea]


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
