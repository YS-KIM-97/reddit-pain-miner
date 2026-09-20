# Security policy

## Supported version

Only the latest commit on the `main` branch is supported while the project is pre-release.

## Reporting a vulnerability

Do not disclose credentials, tokens, personal data, or an exploitable vulnerability in a public issue. Use GitHub's private vulnerability reporting feature for this repository.

Include a concise description, affected component, reproduction steps, expected impact, and any suggested mitigation. Reports will be acknowledged as soon as practical.

## Secrets

- Local secrets belong only in `.env`, which is ignored by Git.
- CI secrets belong in encrypted GitHub Actions secrets.
- Logs, issues, pull requests, artifacts, and source files must never contain API credentials.
- `REDDIT_API_APPROVED` must remain `false` until Reddit grants explicit approval.

