# Architecture

```text
Approved public subreddits
        |
        | OAuth, read-only, weekly limits
        v
In-memory keyword filtering
        |
        | maximum 120 matched excerpts
        v
OpenAI structured analysis (store=false)
        |
        | evidence validation + verbatim-overlap rejection
        v
Paraphrased, de-identified idea report
        |
        v
Private human review and MVP selection
```

The application does not post, comment, vote, message users, moderate communities, or infer sensitive user characteristics.
