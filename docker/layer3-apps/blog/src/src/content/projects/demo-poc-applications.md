---
title: "데모 및 PoC 애플리케이션"
description: "법률 AI 기능을 검증하고 시연하기 위한 데모 앱, 플레이북 QA 도구, 워크플로우 데모 UI 구축."
tags: ["Demo", "PoC", "플레이북"]
featured: false
order: 11
locale: "ko"
period: "2024.12 — 2026.03"
organization: "BHSN"
role: "AI Engineer"
image: "/images/projects/demo-poc-applications.png"
---

## 개요

법률 AI 기능을 내부 검증하고 외부에 시연하기 위한 데모 애플리케이션과 QA 도구를 구축한 프로젝트입니다. AI Review 성능 확인, 플레이북 관리 자동화, 워크플로우 데모 등 다양한 용도의 앱을 개발했습니다.

## 주요 성과

- AI Review 성능 QA 페이지 구축: 검토 결과를 체계적으로 검증할 수 있는 인터페이스 제공
- 플레이북 업로드 자동화: 파일 업로드 → Google Drive 저장 → SQL 반영까지 자동 파이프라인 구현
- 워크스페이스별 플레이북 overlay 시스템 구현: 공통 플레이북 위에 고객별 커스텀 규칙 적용
- RAG 검색 및 스트리밍 API 기반 법률 워크플로우 데모 구축
- 4개 레포에 걸쳐 61개 PR 기여

## Lawyer-in-the-Loop 플랫폼

단순 데모 앱을 넘어, 변호사가 직접 체크리스트를 작성하고 샘플 계약서로 테스트한 뒤 고객사별로 선택적으로 반영하는 self-serve 플레이북 플랫폼을 구현했습니다:
- 엑셀 파일로 플레이북 작성 → 업로드 테스트 → 최종본 Drive 업로드 → QA존 반영
- LATEST와 기존 릴리즈를 분리하여 반복 수정본과 현재 반영본 관리
- 특정 워크스페이스에 일부 플레이북만 커스텀하고 공통 영역은 유지하는 overlay 구조

## 프로젝트 타임라인

| 시기 | 주요 작업 |
|------|-----------|
| 2024 Q4 – 2025 Q2 | AI Review/플레이북 검수 페이지 구축, QA 인터페이스 |
| 2025 Q3 – Q4 | 워크플로우 gallery/builder/runner, 데모 앱 구조 확장 |
| 2026 Q1 | 워크플로우·스튜디오 시연 자산 연결 |

## 기술적 접근

- 변호사가 체크리스트를 작성하고, 데모 환경에서 테스트한 뒤 QA 승인을 거쳐 고객에게 배포하는 self-serve 구조를 설계
- RAG 기반 검색과 SSE 스트리밍 API를 활용하여 실시간 결과를 보여주는 데모 UI 구현
- 플레이북 관리와 배포 과정을 자동화하여 비엔지니어도 직접 운영 가능한 구조 구축
- 워크플로우 gallery에 builder/runner UX를 포함하여 JSON import/export까지 지원하는 조작 가능한 데모 앱 구현

## 기술 스택

FastAPI, Python, Google Drive API, PostgreSQL, SSE, vLLM, LoRAX
