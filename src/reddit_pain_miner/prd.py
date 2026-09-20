from __future__ import annotations

import json
import os

from openai import OpenAI

from reddit_pain_miner.models import (
    ApiEndpoint,
    AppIdea,
    DataEntity,
    DataField,
    MvpSpec,
)


class SpecError(RuntimeError):
    pass


def generate_spec_with_openai(idea: AppIdea, *, model: str, output_language: str) -> MvpSpec:
    if not os.getenv("OPENAI_API_KEY"):
        raise SpecError("OPENAI_API_KEY is required for online PRD generation.")
    client = OpenAI()
    response = client.responses.parse(
        model=model,
        store=False,
        input=[
            {
                "role": "system",
                "content": (
                    "Act as a ruthless MVP product engineer. Produce a seven-day "
                    "implementation spec for one developer. Preserve exactly one core "
                    "feature. Authentication and payment may support that feature, but "
                    "exclude teams, chat, social feeds, admin dashboards, customization, "
                    "and speculative features. Use REST-style endpoint descriptions. "
                    f"Write human-readable fields in language code '{output_language}'."
                ),
            },
            {
                "role": "user",
                "content": json.dumps(idea.model_dump(mode="json"), ensure_ascii=False),
            },
        ],
        text_format=MvpSpec,
    )
    if response.output_parsed is None:
        raise SpecError("The model did not return a parsed MVP specification.")
    return response.output_parsed


def generate_spec_offline(idea: AppIdea) -> MvpSpec:
    return MvpSpec(
        product_name=idea.name,
        one_liner=idea.core_feature,
        target_user=idea.target_user,
        problem_statement=idea.problem,
        core_feature=idea.core_feature,
        monetization=idea.monetization,
        user_flow=["로그인", "핵심 입력 제출", "결과 확인", "필요할 때 결제"],
        acceptance_criteria=[
            "사용자는 60초 안에 첫 결과를 얻는다",
            "실패 시 재시도 가능한 오류 메시지가 표시된다",
            "핵심 흐름이 모바일 화면에서 동작한다",
        ],
        non_goals=["팀 협업", "소셜 피드", "관리자 대시보드", "고급 사용자 설정"],
        data_model=[
            DataEntity(
                name="jobs",
                purpose="핵심 작업과 결과 저장",
                fields=[
                    DataField(name="id", type="uuid", required=True, description="기본 키"),
                    DataField(
                        name="user_id", type="uuid", required=True, description="소유 사용자"
                    ),
                    DataField(name="input", type="text", required=True, description="사용자 입력"),
                    DataField(name="result", type="json", required=False, description="처리 결과"),
                ],
            )
        ],
        api_endpoints=[
            ApiEndpoint(method="POST", path="/api/jobs", purpose="핵심 작업 생성"),
            ApiEndpoint(method="GET", path="/api/jobs/{id}", purpose="작업 결과 조회"),
        ],
        analytics_events=[
            "signup_completed",
            "core_job_created",
            "core_job_completed",
            "paywall_viewed",
        ],
        implementation_plan=[
            "1일차: 데이터 모델과 인증",
            "2~3일차: 핵심 기능",
            "4일차: 결제와 제한",
            "5일차: 오류 처리와 분석 이벤트",
            "6일차: 사용자 테스트와 수정",
            "7일차: PWA 배포와 커뮤니티 검증",
        ],
        launch_checklist=["모바일 QA", "분석 이벤트 확인", "개인정보처리방침", "결제 복원 테스트"],
        kill_criteria=["인터뷰 10명 중 문제 경험자가 3명 미만", "랜딩 방문자 가입률 5% 미만"],
    )
