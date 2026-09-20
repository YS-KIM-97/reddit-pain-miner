# Reddit Data API application summary

## Benefit and purpose

The application identifies recurring, explicitly stated workflow problems in public Reddit discussions and summarizes them into aggregate product insights. The findings may inform future commercial software products; Reddit data itself will not be sold, licensed, published as a dataset, or used to train or fine-tune an AI model.

The application does not profile individual Redditors, infer sensitive characteristics, or target users. It does not automatically post, comment, vote, message, or contact users.

## Platform activity

After explicit approval, a read-only Python/PRAW job will run once per week. For each declared subreddit it will inspect up to 40 posts from the weekly top listing and up to 20 ranked comments per post, select at most 120 excerpts containing explicit problem language, and produce three paraphrased aggregate product ideas.

Processing is in memory. The application does not collect author identifiers and does not persist raw Reddit content or content IDs. OpenAI requests use `store=false`. Persisted reports are checked for long verbatim overlap and contain only paraphrased, de-identified findings.

## Why this is external to Devvit

This is a private, read-only, cross-community research workflow rather than an in-community application. It has no Reddit UI, post type, moderation action, or bot behavior. Devvit's community-installation model would require moderators of unrelated target communities to install an app that provides them no in-community functionality. The required output is instead a private off-platform report produced by an external scheduled workflow.

## Initial subreddit scope

- r/Entrepreneur
- r/productivity
- r/smallbusiness
- r/SaaS

The application will not access additional subreddits without updating its declared scope and obtaining any additional approval required by Reddit.

## Approval gate

Live API access is disabled in code and CI until `REDDIT_API_APPROVED=true` is set after Reddit grants explicit approval.
