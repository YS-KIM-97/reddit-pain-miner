# Privacy statement

Last updated: September 21, 2026

## Purpose

Reddit Pain Miner is a private product-research workflow that identifies recurring, explicitly stated workflow problems in a limited set of public Reddit discussions. Live operation is disabled until Reddit grants explicit approval.

## Data processed

After approval, the application will temporarily process public post and comment text, public content IDs, subreddit names, public scores, permalinks, matched phrases, and collection timestamps in memory. It does not collect Reddit usernames, user IDs, profiles, avatars, flair, private messages, voting history, subscribed communities, or other private account data.

## Use of data

Selected public excerpts are sent to the OpenAI API for one-time inference with `store=false`. The project does not use Reddit data to train or fine-tune an AI model. Reddit data is not sold, licensed, or published as a dataset.

## Storage and retention

Raw Reddit content and content IDs are not written to disk by the live pipeline. Persisted reports contain only paraphrased, aggregate findings and exclude author identifiers and Reddit content IDs. GitHub Actions retains those de-identified reports for 30 days.

## Automated activity

The application does not post, comment, vote, send messages, moderate communities, manipulate karma, or automatically contact Redditors.

## Scope and changes

Initial access is limited to the subreddits listed in `docs/reddit-api-application.md`. Material changes to purpose, subreddit scope, data handling, or automated behavior require a policy review and any additional approval required by Reddit before deployment.

## Contact

Privacy or data-handling questions can be submitted through the repository's GitHub Issues page. Do not include secrets or private personal information in an issue.

