from __future__ import annotations

import os
from pathlib import Path

import yaml
from pydantic import BaseModel, Field


class RedditSettings(BaseModel):
    subreddits: list[str]
    post_limit_per_subreddit: int = Field(default=40, ge=1, le=100)
    comment_limit_per_post: int = Field(default=20, ge=0, le=100)
    minimum_score: int = 2
    keywords: list[str]


class AnalysisSettings(BaseModel):
    idea_count: int = Field(default=3, ge=1, le=10)
    max_signals: int = Field(default=120, ge=1, le=500)
    model: str = "gpt-5-mini"
    output_language: str = "ko"


class OutputSettings(BaseModel):
    directory: Path = Path("artifacts")
    notify_slack: bool = False


class PipelineSettings(BaseModel):
    reddit: RedditSettings
    analysis: AnalysisSettings
    output: OutputSettings

    @classmethod
    def load(cls, path: Path) -> PipelineSettings:
        with path.open(encoding="utf-8") as handle:
            raw = yaml.safe_load(handle)
        settings = cls.model_validate(raw)
        env_model = os.getenv("OPENAI_MODEL")
        if env_model:
            settings.analysis.model = env_model
        return settings
