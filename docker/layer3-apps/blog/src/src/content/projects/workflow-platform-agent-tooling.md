---
title: "AI 워크플로우 & 에이전트 플랫폼"
description: "LangGraph 기반 워크플로우 엔진으로 10+ 법률 자동화 시나리오를 구동합니다. 계약서 작성·비교·검토, 컴플라이언스, 문서 검수를 tool calling과 subgraph 합성으로 지원."
tags: ["LangGraph", "에이전트", "워크플로우", "FastAPI", "Python"]
featured: true
order: 1
locale: "ko"
period: "2024.04 — 현재"
organization: "BHSN"
role: "AI Engineer"
image: "/images/projects/workflow-platform-agent-tooling.png"
---

## 개요

BHSN에서 프로덕션 AI 워크플로우 및 에이전트 플랫폼을 설계·구축했습니다. 법률 전문가가 복잡한 문서 업무를 조합 가능한 다단계 AI 워크플로우로 자동화할 수 있으며, Agent Legal 제품 런칭에서 주요 실행 기반으로 사용됐습니다.

## 주요 작업

### 워크플로우 엔진 아키텍처
- LangGraph 기반 순환형 에이전트 그래프 — tool calling, task lifecycle 관리, workflow status 추적
- 워크플로우 서브그래프 합성 — 기존 워크플로우를 더 큰 워크플로우의 노드로 재사용
- SSE 기반 실시간 스트리밍 응답 통합

### 워크플로우 카탈로그 (10+ 타입)
- 계약서 작성, 비교, 검토 워크플로우
- 법률 문서 생성, 이메일 초안, 내부 규정 점검
- 인허가 분석, 문서 검수 워크플로우

### 개발자 & 비개발자 도구
- 브라우저 기반 워크플로우 빌더, 템플릿 매니저, 프롬프트 미리보기 UI (비개발자용)
- Typer 기반 CLI — AI 코딩 에이전트가 워크플로우를 직접 실행·검증
- tool call 인터페이스, AskUserQuestion 패턴, Canvas 문서 통합

### 에이전트 아키텍처 진화
- DAG 기반 워크플로우에서 순환형 에이전트 그래프(messages 기반 상태 관리)로 전환 리드
- cancel_workflow, display flags, LLM 노드 과금, 후속 채팅 기능 구현
- 에이전트 노드 LLM 요청/응답 PostgreSQL 로깅으로 observability 통합

## 비즈니스 임팩트

Agent Legal 런칭 기간 동안 paid workspaces 41→227, licenses 98→412 성장에 기여. 코호트 기준 15% 유료 전환율 달성 (team-level metric).

## 학술적 맥락

이 플랫폼의 에이전트 아키텍처는 [ReAct(Yao et al., ICLR 2023)](https://arxiv.org/abs/2210.03629)의 reasoning-acting 인터리빙 패러다임을 법률 도메인에 적용한 것입니다. LangGraph 기반 순환형 에이전트 그래프는 dynamic runtime graph에 해당하며, 10+ 워크플로우 시나리오를 tool calling과 subgraph 합성으로 운영합니다.

## 기술 스택

Python, LangGraph, FastAPI, PostgreSQL, SSE, TypeScript (UI), Typer (CLI)
