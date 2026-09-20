# Reddit Pain Miner

매주 Reddit의 반복적인 불편을 수집해, 근거가 연결된 앱 아이디어 3개와 7일짜리 MVP PRD를 만드는 최소 자동화 저장소입니다.

현재 구현 범위는 **수집 → 키워드 필터 → OpenAI 구조화 분석 → Markdown 리포트 → 선택 아이디어 PRD**입니다. 앱 코드 생성과 배포는 검증된 아이디어를 선택한 다음 단계로 의도적으로 분리했습니다.

## 5분 시작

Python 3.11 이상이 필요합니다.

```bash
python -m venv .venv
source .venv/bin/activate
python -m pip install -e '.[dev]'
```

API 키 없이 전체 흐름을 확인합니다.

```bash
reddit-pain run --offline --input examples/sample_signals.json
reddit-pain prd --offline --idea-id idea-1
```

결과는 `artifacts/`에 생성됩니다.

## 실제 데이터로 실행

1. `.env.example`을 `.env`로 복사하고 값을 입력합니다. CLI는 현재 작업 디렉터리의 `.env`를 자동 로드하며 이 파일은 Git에서 제외됩니다. 비밀값을 소스 코드나 채팅에 붙여 넣지 마세요.
2. `config/pipeline.yaml`에서 서브레딧, 키워드, 수집량을 조정합니다.
3. 자격 증명과 API 접근을 진단합니다.

```bash
reddit-pain doctor
reddit-pain doctor --live
```

4. 다음 명령을 실행합니다.

```bash
reddit-pain collect
reddit-pain analyze
reddit-pain report
```

한 번에 실행하려면:

```bash
reddit-pain run
```

리포트에서 아이디어를 고른 뒤에만 PRD를 생성합니다.

```bash
reddit-pain prd --idea-id idea-1
```

온라인 분석은 OpenAI Responses API의 Structured Outputs를 사용하며 API로 보내는 원문은 저장하지 않도록 `store=False`를 지정합니다. Reddit에서는 키워드와 일치한 공개 게시물/댓글의 짧은 발췌만 저장하고 작성자 정보는 저장하지 않습니다.

## 자동화

`.github/workflows/weekly-mine.yml`은 매주 월요일 오전 9시(KST)에 실행됩니다. GitHub 저장소에 아래 Actions secrets를 추가하세요.

- `REDDIT_CLIENT_ID`
- `REDDIT_CLIENT_SECRET`
- `REDDIT_USER_AGENT`
- `OPENAI_API_KEY`
- 선택 사항: `SLACK_WEBHOOK_URL`

모델은 Actions variable `OPENAI_MODEL`로 바꿀 수 있습니다. Slack 전송을 사용하려면 `config/pipeline.yaml`의 `notify_slack`을 `true`로 변경합니다.

워크플로는 리포트와 JSON을 30일간 GitHub Actions artifact로 보관합니다. 수동 실행에서 `offline`을 선택하면 secret 없이 샘플 데이터로 smoke test를 수행합니다.

## 설계 원칙

- **근거 추적:** 모든 아이디어는 실제 `signal ID`를 참조해야 합니다.
- **명시적 실패:** API 오류를 오프라인 결과로 몰래 대체하지 않습니다.
- **작은 범위:** PRD는 핵심 기능 하나만 허용하고 팀 기능, 피드, 관리자 화면 등을 제외합니다.
- **사람의 선택:** 자동으로 앱을 생성하기 전에 사람이 아이디어 하나를 선택합니다.
- **PWA 우선:** 검증과 앱 템플릿 생성은 다음 마일스톤에서 연결합니다.

## 명령어

```text
reddit-pain collect                         Reddit 주간 신호 수집
reddit-pain doctor [--live]                 자격 증명과 API 접근 진단
reddit-pain analyze [--offline]             신호를 앱 아이디어로 변환
reddit-pain report                          Markdown 리포트 렌더링
reddit-pain prd --idea-id idea-1 [--offline] 선택 아이디어의 MVP PRD 생성
reddit-pain run [--input FILE] [--offline]   수집부터 리포트까지 실행
```

모든 명령에서 기본 설정 파일을 바꾸려면 서브명령 앞에 `--config`를 둡니다.

```bash
reddit-pain --config config/pipeline.yaml run
```

## 다음 마일스톤

1. 리포트 승인용 GitHub Issue 생성과 `idea-id` 라벨 선택
2. 선택된 PRD에서 PWA 템플릿 저장소 생성
3. Playwright 기반 핵심 흐름 테스트와 스크린샷 생성
4. Vercel/Cloudflare Pages preview 배포
5. 초기 반응 기준을 통과한 앱만 Expo 네이티브 전환

## 개발

```bash
make lint
make test
```
