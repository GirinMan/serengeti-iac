---
title: "한컴 HWP 애드온 워크플로우 연동"
description: "한컴오피스 HWP 문서 에디터에 WebView 기반 AI 워크플로우 애드온을 구현하여 문서 내에서 직접 AI 기능을 사용할 수 있도록 한 프로젝트."
tags: ["HWP", "WebView", "TypeScript", "워크플로우"]
featured: false
order: 12
locale: "ko"
period: "2025.07 — 현재"
organization: "BHSN"
role: "AI Engineer"
---

## 개요

한컴과의 외부 파트너 프로젝트로, 한컴오피스 HWP 문서 에디터 내에 WebView 기반 AI 워크플로우 애드온을 구현했습니다. 사용자가 HWP 환경을 벗어나지 않고 로그인, 워크플로우 선택, 실행, 결과 확인, 문서 삽입까지 수행할 수 있는 흐름을 만들었습니다.

## 주요 성과

- 로그인 → 워크플로우 목록 → 실행 → Canvas 결과 → HWP 문서 삽입까지의 전체 흐름 구현
- 24개 API 엔드포인트 분석 및 연동
- HWP InsertText, GetTextFile, GetSelectText API 연동
- Confluence Space에 프로젝트 홈, 의사결정 로그, 인수인계 문서, 4주 MVP 일정 문서화
- 공개 기사: [디지털투데이](https://www.digitaltoday.co.kr/news/articleView.html?idxno=574890)

## 기술적 접근

- 프론트엔드 개발 경험이 없는 상태에서, AI 코딩 에이전트(Claude Code, Cursor 등)를 적극 활용하여 WebView + TypeScript 기반 애드온 UI를 빠르게 구현했습니다
- 기존 서비스의 24개 API 엔드포인트와 HWP 애드온 SDK의 문서 조작 API를 분석하여 텍스트 추출 및 삽입 기능을 연동했습니다
- 워크플로우 실행 결과를 Canvas 형태로 렌더링한 뒤 HWP 문서에 직접 삽입하는 파이프라인을 구성했습니다
- 4주 MVP 일정으로 프로젝트를 구조화하고, 의사결정 로그와 인수인계 문서를 체계적으로 관리했습니다
- AI 에이전트를 활용한 빠른 프로토타이핑과 코드 생성으로, 낯선 기술 스택에서도 MVP 일정 내 안정적인 결과물을 도출했습니다

## 제품 기획 및 구현

한컴 에디터 환경에 맞는 제품 방향을 기획하고, 애플리케이션의 뼈대를 직접 구현했습니다:
- **제품 스펙 정의**: 한컴 에디터의 애드온 제약 사항을 분석하여 워크플로우 실행 중심의 제품 방향 설정
- **앱 아키텍처 설계**: 로그인 → 워크플로우 선택 → 실행 → 결과 렌더링 → 문서 삽입의 전체 흐름 설계 및 뼈대 구현
- **프로젝트 문서화**: Confluence Space에 요구사항, 의사결정 로그, 인수인계 자료, 4주 MVP 일정을 체계적으로 정리

## 전략적 맥락

기존 allibee 웹 앱의 API 인프라를 재활용하면서, 한컴 에디터 환경에 최적화된 새로운 애드온 앱을 빠르게 개발했습니다. 이를 통해 allibee 서비스의 유입 구간을 HWP 에디터까지 확장하여, 기존 자산을 활용한 효율적인 채널 확대를 실현했습니다.

## 기술 스택

TypeScript, Vite, WebView, HWP Add-on SDK, REST API, Playwright (API 캡처), Confluence, **AI-assisted development** (Claude Code, Cursor)
