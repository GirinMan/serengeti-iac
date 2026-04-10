---
title: "BA 추론 에이전트 아키텍처"
description: "복잡한 법률 AI 질의를 처리하기 위한 추론 레이어와 에이전트 아키텍처 설계. 계획 기반 쿼리 분해, 멀티홉 추론."
tags: ["Agent", "추론", "Multi-hop", "RAG"]
featured: false
order: 9
locale: "ko"
period: "2025 Q2 — 2026 Q1"
organization: "BHSN"
role: "AI Engineer"
image: "/images/projects/ba-reasoning-agent.png"
---

## 개요

복잡한 법률 질의를 처리하기 위한 추론 에이전트 아키텍처를 설계하고 구현했습니다. 단순 검색-생성(RAG) 구조를 넘어, 계획 기반 쿼리 분해와 멀티홉 추론을 통해 다단계 법률 분석이 가능한 시스템을 구축했습니다.

## 주요 성과

- BA Reasoning v3 아키텍처 설계: 계획 기반 쿼리 분해와 바이너리 의도 분류 적용
- 문서 비교, 판례 비교 등 멀티홉 추론 파이프라인 구현
- 템플릿 기반 법률 문서 초안 생성 (보고서, 법률 의견서)
- 의도 분류 정확도 95% 이상 목표 설정 및 달성 추진
- Tool-calling 성능 15% 이상 개선 목표 설정 및 추진

## 기술적 접근

- 사용자 질의를 바이너리 의도 분류기로 먼저 분류한 뒤, 복잡한 질의에 대해 계획(plan) 단계를 거쳐 하위 질의로 분해
- 각 하위 질의별로 적절한 도구(검색, 문서 비교, 판례 조회 등)를 선택하여 실행
- 중간 결과를 종합하여 최종 응답을 생성하는 멀티홉 추론 구조 적용
- 법률 문서 유형별 템플릿을 활용한 구조화된 초안 생성

## 학술적 맥락

이 프로젝트의 reasoning-acting 파이프라인은 [ReAct(Yao et al., ICLR 2023)](https://arxiv.org/abs/2210.03629)가 제안한 reasoning trace와 action 인터리빙 패러다임을 법률 멀티홉 추론에 확장한 것입니다.

## 기술 스택

Python, LangGraph, LLM Tool Calling, RAG, Elasticsearch
