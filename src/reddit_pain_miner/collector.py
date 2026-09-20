from __future__ import annotations

import os
from collections.abc import Iterable

import praw

from reddit_pain_miner.config import RedditSettings
from reddit_pain_miner.filtering import excerpt, find_keywords
from reddit_pain_miner.models import PainSignal, SourceKind


class MissingRedditCredentials(RuntimeError):
    pass


class RedditApprovalRequired(RuntimeError):
    pass


def reddit_api_is_approved() -> bool:
    return os.getenv("REDDIT_API_APPROVED", "").casefold() == "true"


def create_reddit_client() -> praw.Reddit:
    if not reddit_api_is_approved():
        raise RedditApprovalRequired(
            "Live Reddit API access is disabled. Set REDDIT_API_APPROVED=true only after "
            "Reddit grants explicit approval."
        )
    required = ("REDDIT_CLIENT_ID", "REDDIT_CLIENT_SECRET", "REDDIT_USER_AGENT")
    missing = [name for name in required if not os.getenv(name)]
    if missing:
        raise MissingRedditCredentials(
            "Missing Reddit credentials: " + ", ".join(missing) + ". See .env.example."
        )
    return praw.Reddit(
        client_id=os.environ["REDDIT_CLIENT_ID"],
        client_secret=os.environ["REDDIT_CLIENT_SECRET"],
        user_agent=os.environ["REDDIT_USER_AGENT"],
        check_for_async=False,
    )


def _post_signal(post: object, keywords: list[str]) -> PainSignal | None:
    title = str(getattr(post, "title", ""))
    body = str(getattr(post, "selftext", ""))
    text = f"{title}\n{body}".strip()
    matches = find_keywords(text, keywords)
    if not matches:
        return None
    return PainSignal(
        id=f"post-{post.id}",
        subreddit=str(post.subreddit),
        kind=SourceKind.POST,
        text=excerpt(text),
        score=int(getattr(post, "score", 0)),
        permalink="https://www.reddit.com" + str(post.permalink),
        matched_keywords=matches,
        post_title=title,
    )


def _comment_signal(comment: object, post: object, keywords: list[str]) -> PainSignal | None:
    text = str(getattr(comment, "body", ""))
    matches = find_keywords(text, keywords)
    if not matches:
        return None
    permalink = getattr(comment, "permalink", None)
    if callable(permalink):
        permalink = permalink()
    return PainSignal(
        id=f"comment-{comment.id}",
        subreddit=str(post.subreddit),
        kind=SourceKind.COMMENT,
        text=excerpt(text),
        score=int(getattr(comment, "score", 0)),
        permalink="https://www.reddit.com" + str(permalink),
        matched_keywords=matches,
        post_title=str(getattr(post, "title", "")),
    )


def collect_signals(
    settings: RedditSettings, reddit: praw.Reddit | None = None
) -> list[PainSignal]:
    client = reddit or create_reddit_client()
    signals: dict[str, PainSignal] = {}

    for subreddit_name in settings.subreddits:
        subreddit = client.subreddit(subreddit_name)
        posts: Iterable[object] = subreddit.top(
            time_filter="week", limit=settings.post_limit_per_subreddit
        )
        for post in posts:
            if int(getattr(post, "score", 0)) >= settings.minimum_score:
                signal = _post_signal(post, settings.keywords)
                if signal:
                    signals[signal.id] = signal

            if settings.comment_limit_per_post == 0:
                continue
            post.comment_sort = "top"
            post.comments.replace_more(limit=0)
            for comment in post.comments.list()[: settings.comment_limit_per_post]:
                if int(getattr(comment, "score", 0)) < settings.minimum_score:
                    continue
                signal = _comment_signal(comment, post, settings.keywords)
                if signal:
                    signals[signal.id] = signal

    return sorted(signals.values(), key=lambda item: item.score, reverse=True)
