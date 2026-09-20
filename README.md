# Reddit Pain Miner

> Reddit API reviewers: see [application summary](docs/reddit-api-application.md), [data handling and retention](docs/data-retention.md), [privacy statement](docs/privacy.md), and [architecture](docs/architecture.md).

매주 Reddit의 반복적인 불편을 수집해, 근거가 연결된 앱 아이디어 3개와 7일짜리 MVP PRD를 만드는 최소 자동화 저장소입니다.

현재 구현 범위는 **수집 → 키워드 필터 → OpenAI 구조화 분석 → Markdown 리포트 → 선택 아이디어 PRD**입니다. 정기 실행은 Reddit 원문을 디스크에 저장하지 않으며, 장기 보관 결과에는 콘텐츠 ID와 장문 인용을 포함하지 않습니다. 앱 코드 생성과 배포는 검증된 아이디어를 선택한 다음 단계로 의도적으로 분리했습니다.

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

비식별 결과는 `artifacts/`에 생성됩니다.

Reddit 승인 전에도 공개 GitHub 근거로 조사부터 PRD까지 재현할 수 있습니다.

```bash
reddit-pain scenario
```

기본 사례는 영수증 기반 경비 입력 문제입니다. 사람이 검토하고 패러프레이즈한 공개 이슈·문서 3개를 `PainSignal`로 읽어 근거 연결을 검증하고, 아이디어 3개를 비교한 다음 최고 점수 아이디어의 MVP PRD를 `artifacts/research-demo/`에 생성합니다. 이 명령은 Reddit, OpenAI 또는 다른 외부 API를 호출하지 않습니다.

GitHub의 **Actions → Public research demo → Run workflow**에서도 같은 결과를 만들고 30일 보관 artifact로 내려받을 수 있습니다.

## ClaimSnap PWA MVP

연구 시나리오에서 가장 높은 점수를 받은 `ClaimSnap`의 첫 PWA가 `web/`에 있습니다. 영수증 이미지를 서버로 보내지 않고 브라우저의 Tesseract.js OCR로 읽은 뒤, 상호·날짜·금액·분류·설명을 수정하고 경비 한 줄로 확정합니다.

```bash
make web-install
make web-dev
```

빌드 검증은 `make web-build`로 실행합니다.

## 실제 데이터로 실행

1. `.env.example`을 `.env`로 복사하고 값을 입력합니다. CLI는 현재 작업 디렉터리의 `.env`를 자동 로드하며 이 파일은 Git에서 제외됩니다. 비밀값을 소스 코드나 채팅에 붙여 넣지 마세요.
2. `config/pipeline.yaml`에서 서브레딧, 키워드, 수집량을 조정합니다.
3. 자격 증명과 API 접근을 진단합니다.

```bash
reddit-pain doctor
reddit-pain doctor --live
```

Reddit User-Agent는 `script:weekly-pain-miner:v0.1.0 (by /u/사용자명)` 형식을 사용합니다.

`REDDIT_API_APPROVED`는 Reddit의 명시적 승인을 받기 전까지 반드시 `false`로 유지합니다. 승인 후에만 로컬 `.env`와 GitHub Actions variable을 `true`로 변경합니다. 코드와 예약 워크플로 모두 이 값이 없으면 라이브 수집을 실행하지 않습니다.

4. 승인 후 라이브 파이프라인을 실행합니다.

```bash
reddit-pain run
```

리포트에서 아이디어를 고른 뒤에만 PRD를 생성합니다.

```bash
reddit-pain prd --idea-id idea-1
```

온라인 분석은 OpenAI Responses API의 Structured Outputs를 사용하며 API로 보내는 원문은 저장하지 않도록 `store=False`를 지정합니다. Reddit 작성자 정보는 수집하지 않습니다. 라이브 수집 결과를 파일로 내보내는 명령은 제공하지 않으며, 정기 `run`은 일치한 발췌를 메모리에서만 처리합니다.

## 자동화

`.github/workflows/weekly-mine.yml`은 매주 월요일 오전 9시(KST)에 실행됩니다. GitHub 저장소에 아래 Actions secrets를 추가하세요.

- `REDDIT_CLIENT_ID`
- `REDDIT_CLIENT_SECRET`
- `REDDIT_USER_AGENT`
- `OPENAI_API_KEY`
- 선택 사항: `SLACK_WEBHOOK_URL`

모델은 Actions variable `OPENAI_MODEL`로 바꿀 수 있습니다. Slack 전송을 사용하려면 `config/pipeline.yaml`의 `notify_slack`을 `true`로 변경합니다.

워크플로는 비식별·비인용 리포트와 아이디어 JSON만 30일간 GitHub Actions artifact로 보관합니다. Reddit 원문이나 콘텐츠 ID는 업로드하지 않습니다. 수동 실행에서 `offline`을 선택하면 secret 없이 샘플 데이터로 smoke test를 수행합니다.

## 설계 원칙

- **근거 추적:** 생성 시 모든 아이디어의 `signal ID`를 메모리에서 검증한 뒤 ID를 폐기합니다.
- **명시적 실패:** API 오류를 오프라인 결과로 몰래 대체하지 않습니다.
- **작은 범위:** PRD는 핵심 기능 하나만 허용하고 팀 기능, 피드, 관리자 화면 등을 제외합니다.
- **사람의 선택:** 자동으로 앱을 생성하기 전에 사람이 아이디어 하나를 선택합니다.
- **승인 게이트:** Reddit의 명시적 승인 없이는 라이브 API 클라이언트를 생성하지 않습니다.
- **PWA 우선:** 검증과 앱 템플릿 생성은 다음 마일스톤에서 연결합니다.

## 명령어

```text
reddit-pain doctor [--live]                 자격 증명과 API 접근 진단
reddit-pain analyze --input FILE [--offline] 합성·승인된 입력을 앱 아이디어로 변환
reddit-pain report                          Markdown 리포트 렌더링
reddit-pain prd --idea-id idea-1 [--offline] 선택 아이디어의 MVP PRD 생성
reddit-pain run [--input FILE] [--offline]   수집부터 리포트까지 실행
reddit-pain scenario                        공개 근거 fixture로 조사→PRD 재현
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

승인 전·후 운영 절차는 [Reddit API approval checklist](docs/approval-checklist.md)에 정리되어 있습니다.
