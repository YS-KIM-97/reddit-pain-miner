from __future__ import annotations

import re


def normalize_text(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip()


def find_keywords(text: str, keywords: list[str]) -> list[str]:
    normalized = normalize_text(text).casefold()
    return [keyword for keyword in keywords if keyword.casefold() in normalized]


def excerpt(text: str, limit: int = 1200) -> str:
    normalized = normalize_text(text)
    if len(normalized) <= limit:
        return normalized
    return normalized[: limit - 1].rstrip() + "…"
