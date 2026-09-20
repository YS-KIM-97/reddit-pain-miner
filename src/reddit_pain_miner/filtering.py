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


def has_verbatim_overlap(source: str, candidate: str, minimum_words: int = 8) -> bool:
    """Return true when candidate repeats a long source phrase verbatim."""
    source_words = re.findall(r"[\w']+", source.casefold())
    candidate_words = re.findall(r"[\w']+", candidate.casefold())
    if len(source_words) < minimum_words or len(candidate_words) < minimum_words:
        return False
    source_ngrams = {
        tuple(source_words[index : index + minimum_words])
        for index in range(len(source_words) - minimum_words + 1)
    }
    return any(
        tuple(candidate_words[index : index + minimum_words]) in source_ngrams
        for index in range(len(candidate_words) - minimum_words + 1)
    )
