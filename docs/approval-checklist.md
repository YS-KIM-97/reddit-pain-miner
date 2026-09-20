# Reddit Data API approval checklist

## Before submitting the request

- [x] Public source repository is available.
- [x] Intended commercial product-research purpose is disclosed.
- [x] Initial subreddit scope is limited and documented.
- [x] The application is read-only and contains no Reddit write operations.
- [x] Author identifiers and private user data are not collected.
- [x] Raw Reddit content is processed in memory and is not persisted.
- [x] Persisted output excludes Reddit content IDs and rejects long verbatim excerpts.
- [x] Live access is locked in code and CI pending explicit approval.
- [x] Synthetic-data CI and the scheduled offline workflow pass.
- [x] Data handling, privacy, architecture, and security documentation is public.
- [ ] Submit the request to Reddit with the repository URL and accurate use-case description.
- [ ] Record the approval date, approved scope, and any conditions in this document.

## Values that must stay disabled before approval

```dotenv
REDDIT_API_APPROVED=false
```

Do not add Reddit credentials to GitHub until approval is granted. Never commit credentials to the repository.

## After Reddit grants approval

1. Record the approval date, approved subreddits, usage limits, retention requirements, and any other conditions below.
2. Add `REDDIT_CLIENT_ID`, `REDDIT_CLIENT_SECRET`, `REDDIT_USER_AGENT`, and `OPENAI_API_KEY` as encrypted GitHub Actions secrets.
3. Keep `REDDIT_API_APPROVED=false` while validating the credential configuration locally.
4. Set the local flag to `true` and run `reddit-pain doctor --live` once.
5. Run one manually dispatched live workflow and inspect the de-identified artifact.
6. Set the repository variable `REDDIT_API_APPROVED=true` only after that validation succeeds.
7. Confirm the scheduled Monday workflow and monitor rate-limit and policy changes.

## Approval record

- Approval date: pending
- Approved operator account: pending
- Approved subreddits: pending
- Approved usage/rate limits: pending
- Additional Reddit conditions: pending
- Approval correspondence reference: pending

