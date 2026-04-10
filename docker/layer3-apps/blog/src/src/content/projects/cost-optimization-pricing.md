---
title: "LLM 비용 최적화 및 가격 정책"
description: "SaaS 가격 모델 설계, 토큰-크레딧 시스템 구축, 자체 Judge 모델로 평가 비용 70-80% 절감."
tags: ["가격 정책", "비용 최적화", "크레딧 시스템"]
featured: false
order: 15
locale: "ko"
period: "2025.06 — 2026.03"
organization: "BHSN"
role: "AI Engineer"
image: "/images/projects/cost-optimization-pricing.png"
---

## 개요

SaaS 제품의 LLM API 비용을 분석하고, 가격 모델을 설계하며, 토큰-크레딧 시스템을 구축한 프로젝트입니다. 자체 Judge 모델 도입으로 평가 비용을 대폭 절감했습니다.

## 주요 성과

- LLM API 비용 분석: 모델별·기능별 블렌디드 비용 산출 및 비용/매출 비율 분석
- 토큰-크레딧 시스템 구축: 멀티테넌트 지원, 정밀도 스케일링, 다단계 fallback 조회 체계
- Gemma-3-12b 기반 자체 Judge 모델 도입으로 외부 LLM API 평가 비용 대폭 절감
- SaaS 가격 모델 설계 및 크레딧 기반 과금 체계 수립

## 기술적 접근

- API 호출 로그를 분석하여 모델별, 기능별 토큰 사용량과 비용 구조를 파악
- 토큰-크레딧 변환 로직 구현 및 workspace → tenant → global 다단계 fallback 조회 체계 설계
- SQL 기반 사용량 측정: 캐시 hit 구분, task 유형, 토큰 수, 요청 시점 추적
- Gemma-3-12b를 SFT + DPO로 Judge 모델 학습하여 외부 LLM API 호출 없이 품질 평가 수행

## 비즈니스 임팩트

LLM 서비스의 원가 구조를 정량적으로 분석하고, 토큰-크레딧 시스템을 설계한 경험은 AI 제품의 비즈니스 모델과 기술 구현을 연결하는 역량을 보여줍니다. blended rate 계산, 멀티테넌트 크레딧 아키텍처, 자체 Judge 모델을 통한 비용 절감 전략까지 포함하여 순수 엔지니어링을 넘어선 제품 경제성 이해를 포함합니다.

## 기술 스택

Python, FastAPI, PostgreSQL, Gemma-3-12b, LangChain, Cloud SQL
