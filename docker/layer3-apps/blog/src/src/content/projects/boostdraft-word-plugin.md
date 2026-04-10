---
title: "BoostDraft Word 플러그인 연동"
description: "Microsoft Word 기반 BoostDraft 플러그인에 allibee 계약서 검토 AI를 API로 연동하는 외부 파트너 프로젝트."
tags: ["Word Plugin", "API 연동", "파트너십"]
featured: false
order: 13
locale: "ko"
period: "2025.06 — 현재"
organization: "BHSN"
role: "AI Engineer"
---

## 개요

BoostDraft의 Microsoft Word 에디터 플러그인 내에서 allibee 계약서 검토 기능을 사용할 수 있도록 API 연동을 수행한 외부 파트너 프로젝트입니다. 사용자가 Word 환경을 벗어나지 않고 AI 계약서 검토를 실행할 수 있는 구조를 설계했습니다.

## 주요 성과

- BoostDraft 에디터 내 allibee 계약서 검토 기능 연동 전략 수립 및 실행
- API 스펙 정의와 서버 준비까지 전 과정 수행
- 공개 협력 뉴스 보도: [네이버 뉴스](https://n.news.naver.com/mnews/article/138/0002198171?sid=105)

## 기술적 접근

- BoostDraft Word 플러그인의 에디터 기능과 API 호출 구조를 분석
- allibee 검토 API와의 연동 인터페이스를 정의하고, 요청/응답 스펙을 설계
- 플러그인에서 문서 텍스트를 전달받아 검토 결과를 반환하는 서버 엔드포인트 구현

## 전략적 맥락

한컴 HWP 프로젝트와 대조되는 통합 전략입니다. 한컴은 에디터 내 AI 기능이 제한적이어서 workflow 기반 최소 애드온으로 접근한 반면, BoostDraft는 이미 Word 환경에서 정의어 탐색, 인용 조항 확인, 교정 등 editor-native 기능을 정교하게 갖추고 있었습니다. 따라서 에디터를 다시 만들기보다 allibee의 계약서 검토 AI를 API로 공급하는 방식이 더 현실적인 해법이었습니다.

## 기술 스택

FastAPI, Python, REST API, Microsoft Word Add-in
