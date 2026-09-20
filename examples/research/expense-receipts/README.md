# 영수증 기반 경비 입력 조사 시나리오

Reddit API 승인 전에 파이프라인을 검증하기 위한 고정 연구 fixture입니다. 공개 GitHub 이슈와 제품 문서를 사람이 읽고 한국어로 패러프레이즈했으며, 작성자 이름이나 원문 본문은 저장하지 않습니다.

이 fixture는 웹을 다시 크롤링하지 않습니다. 따라서 테스트는 네트워크와 API 키 없이 재현할 수 있고, 근거 URL과 아이디어 연결이 잘못되면 Pydantic 검증 단계에서 실패합니다.

```bash
reddit-pain scenario
```

결과는 기본적으로 `artifacts/research-demo/`에 생성됩니다.

- `ideas.json`: 장기 보관 가능한 비식별 아이디어
- `research-report.md`: 점수순 아이디어 리포트
- `source-index.md`: 패러프레이즈된 근거와 출처 링크
- `mvp-spec.json`, `mvp-prd.md`: 가장 높은 점수 아이디어의 오프라인 MVP 스펙
