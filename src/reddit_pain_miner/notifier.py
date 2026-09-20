from __future__ import annotations

import json
import os
from urllib.request import Request, urlopen


class NotificationError(RuntimeError):
    pass


def notify_slack(markdown: str) -> None:
    webhook = os.getenv("SLACK_WEBHOOK_URL")
    if not webhook:
        raise NotificationError("SLACK_WEBHOOK_URL is not configured.")
    payload = json.dumps({"text": markdown[:3900]}).encode()
    request = Request(webhook, data=payload, headers={"Content-Type": "application/json"})
    with urlopen(request, timeout=15) as response:  # noqa: S310 - URL comes from trusted env config
        if response.status >= 300:
            raise NotificationError(f"Slack webhook returned HTTP {response.status}.")
