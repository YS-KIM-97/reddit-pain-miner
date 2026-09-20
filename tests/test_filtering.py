from reddit_pain_miner.filtering import (
    excerpt,
    find_keywords,
    has_verbatim_overlap,
    normalize_text,
)


def test_find_keywords_is_case_insensitive() -> None:
    assert find_keywords("I HATE WHEN this breaks", ["I hate when", "struggling with"]) == [
        "I hate when"
    ]


def test_normalize_and_excerpt() -> None:
    assert normalize_text(" hello\n  world ") == "hello world"
    assert excerpt("abcdefgh", limit=5) == "abcd…"


def test_long_verbatim_overlap() -> None:
    source = "one two three four five six seven eight nine ten"
    assert has_verbatim_overlap(source, "prefix one two three four five six seven eight suffix")
    assert not has_verbatim_overlap(source, "one two three four five six seven changed")
