---
title: "LoRAX 오픈소스 기여"
description: "predibase/lorax에 4개 PR 머지. OpenAI 호환 서빙 인터페이스, 결정적 생성, 스트리밍 사용량, 구조화 출력 지원을 개선했습니다."
tags: ["오픈소스", "LLM 서빙", "Rust", "Python", "OpenAI API"]
repoUrl: "https://github.com/predibase/lorax"
featured: true
order: 2.5
locale: "ko"
organization: "Open Source"
role: "Contributor"
period: "2024.03 — 2024.10"
---

## 개요

파인튜닝된 LLM을 서빙하는 오픈소스 프레임워크 [predibase/lorax](https://github.com/predibase/lorax)에 4개의 PR을 기여하여 머지되었습니다. LoRAX는 멀티 LoRA 서빙 연구를 실전 프레임워크로 구현한 시스템이며, [LoRA Land](https://arxiv.org/abs/2405.00732) 기술 보고서에서 310개 파인튜닝 모델의 서빙 인프라로 사용되었습니다. 각 기여는 프로덕션 운영 중 발견한 OpenAI API 호환성 문제를 해결한 것입니다.

## 기여 내역

### PR #358 — Chat Completion Stream 수정 & API 개선
- OpenAI 클라이언트 호환을 위한 chat completion 최종 delta 직렬화 수정
- `/tokenize` 엔드포인트 추가 (토큰 카운팅)
- Swagger/OpenAPI 문서 개선

### PR #374 — Seed 파라미터 지원
- OpenAI 호환 엔드포인트에 `seed` 파라미터 추가
- 재현 가능한 테스트와 평가를 위한 결정적 생성 활성화

### PR #506 — 스트리밍 사용량 정보
- 스트리밍 chat completion 응답에 토큰 `usage` 필드 추가
- OpenAI stream_options 사용량 리포팅 동작과 정렬

### PR #644 — 구조화 출력 지원
- `response_format` 지원 구현 (`text`, `json_object`, `json_schema`)
- OpenAI API와 self-hosted LoRAX 서빙 간 전환 비용 절감

## 임팩트

단독 OSS 활동이 아니라 프로덕션 LLM 배포에서 발견한 서빙 인터페이스 이슈를 직접 해결한 결과입니다. 특히 PR #644는 `response_format` API 인터페이스를 추가하여 OpenAI API와 self-hosted LoRAX 간의 structured output 호환성을 확보했고, 내부 계약 분류·체크리스트 생성 파이프라인에 직접 연동되었습니다.

## 링크

- [PR #358](https://github.com/predibase/lorax/pull/358) | [PR #374](https://github.com/predibase/lorax/pull/374) | [PR #506](https://github.com/predibase/lorax/pull/506) | [PR #644](https://github.com/predibase/lorax/pull/644)
