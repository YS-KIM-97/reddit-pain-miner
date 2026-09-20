# Data handling and retention

This project minimizes Reddit data at each stage.

## Collection

- Reads only public posts and comments from the explicitly configured subreddits.
- Does not collect usernames, user IDs, profile information, flair, avatars, private messages, or private account data.
- Limits each scheduled run to the configured weekly listings and a maximum of 120 matched signals.

## Processing

- The scheduled pipeline processes excerpts in memory and does not write raw Reddit content to disk.
- OpenAI requests use `store=false` and are used only for inference, never for model training or fine-tuning by this project.
- Model output must paraphrase source problems. Long verbatim overlap is rejected before a report is persisted.
- Evidence IDs are validated in memory and excluded from serialized reports.

## Raw-data persistence

- The live pipeline has no command that exports collected Reddit content to a file.
- Matched excerpts exist only in process memory for the duration of the scheduled analysis.
- The standalone `analyze` command accepts only an explicitly supplied file and is intended for synthetic samples or separately approved inputs.

## Long-lived output

- GitHub Actions uploads only `artifacts/ideas.json` and `artifacts/weekly-report.md`.
- These files contain aggregate, paraphrased findings and no Reddit usernames or content IDs.
- They are retained for 30 days to support the human idea-selection step.

Live Reddit API collection must not run before Reddit grants explicit approval for the declared use case. Both the CLI and scheduled workflow keep access locked unless `REDDIT_API_APPROVED=true` is explicitly configured after approval.
