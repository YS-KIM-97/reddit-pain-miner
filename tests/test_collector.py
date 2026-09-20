from reddit_pain_miner.collector import collect_signals
from reddit_pain_miner.config import RedditSettings
from reddit_pain_miner.models import SourcePlatform


class FakeComments:
    def __init__(self, comments: list[object]) -> None:
        self._comments = comments
        self.replaced_more = False

    def replace_more(self, *, limit: int) -> None:
        assert limit == 0
        self.replaced_more = True

    def list(self) -> list[object]:
        assert self.replaced_more
        return self._comments


class FakeComment:
    id = "c1"
    body = "Is there a tool for fixing this manual process?"
    score = 8
    permalink = "/r/test/comments/p1/example/c1/"


class FakePost:
    id = "p1"
    title = "A weekly frustration"
    selftext = "I hate when this task takes forever."
    score = 12
    subreddit = "test"
    permalink = "/r/test/comments/p1/example/"
    comment_sort = "confidence"
    comments = FakeComments([FakeComment()])


class FakeSubreddit:
    def top(self, *, time_filter: str, limit: int) -> list[object]:
        assert time_filter == "week"
        assert limit == 10
        return [FakePost()]


class FakeReddit:
    def subreddit(self, name: str) -> FakeSubreddit:
        assert name == "test"
        return FakeSubreddit()


def test_collection_filters_and_sorts_posts_and_comments() -> None:
    settings = RedditSettings(
        subreddits=["test"],
        post_limit_per_subreddit=10,
        comment_limit_per_post=5,
        minimum_score=2,
        keywords=["I hate when", "Is there a tool for"],
    )
    signals = collect_signals(settings, reddit=FakeReddit())  # type: ignore[arg-type]
    assert [signal.id for signal in signals] == ["post-p1", "comment-c1"]
    assert all(signal.source_platform == SourcePlatform.REDDIT for signal in signals)
    assert all(signal.community == "test" for signal in signals)
    assert signals[0].matched_keywords == ["I hate when"]
    assert signals[1].permalink.endswith("/c1/")
