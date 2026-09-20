import pytest

from reddit_pain_miner.collector import RedditApprovalRequired, create_reddit_client


def test_reddit_client_is_locked_before_approval(monkeypatch) -> None:
    monkeypatch.setenv("REDDIT_API_APPROVED", "false")
    monkeypatch.setenv("REDDIT_CLIENT_ID", "client")
    monkeypatch.setenv("REDDIT_CLIENT_SECRET", "secret")
    monkeypatch.setenv("REDDIT_USER_AGENT", "script:test:v1 (by /u/test)")
    with pytest.raises(RedditApprovalRequired):
        create_reddit_client()
