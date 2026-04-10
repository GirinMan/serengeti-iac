---
title: "AI 평가 메트릭 시스템"
description: "전통 NLP 메트릭, LLM-as-a-Judge, 법률 전문가 rubric을 결합한 다축 평가 프레임워크. 20+ 커스텀 메트릭, 10+ 모델 벤치마크."
tags: ["평가", "LLM-as-Judge", "NLP 메트릭", "품질 보증"]
featured: false
order: 5
locale: "ko"
period: "2024 Q1 — 현재"
organization: "BHSN"
role: "AI Engineer"
image: "/images/projects/ai-evaluation-system.png"
---

## 개요

법률 AI 서비스를 위한 평가 프레임워크를 설계·구현했습니다. 계약서 검토, 조항 수정, 문서 요약, 정보 추출 전반에 걸쳐 세 가지 상호 보완적인 평가 축으로 품질을 측정합니다.

## 평가 아키텍처

### 전통 정량 메트릭
- 도메인 특화 NLP 메트릭 (MeCab 한국어 토크나이저 기반 ROUGE, 구조화된 정확도)
- 태스크별 평가: 체크리스트 검토 정확도, 조항 추출 F1, 법률 자문 요약 품질
- 다국어 지원 (한국어, 영어, 일본어) 및 자동 언어 감지

### LLM-as-a-Judge
- 주관적 품질 차원에 대한 LLM 판정 기반 자동 평가
- G-Eval 스타일의 유창성, 일관성, 사실 정합성 점수
- 자체 judge 모델 학습 (SFT + DPO) — G-Eval 평가 시 Claude Sonnet API 호출 비용을 추적하고, 자체 모델로 대체하여 평가 비용을 대폭 절감

### 법률 전문가 평가
- 법률 전문가와 협업하여 도메인 특화 rubric 정의
- 수정 정책 준수(0-2점), 문맥 일관성(0-5점), 가이드라인 반영도(3단계 검증) 등
- 모델 앙상블 + 전문가 검토 워크플로우로 gold standard 데이터셋 구축

## 규모

- 20+ 커스텀 메트릭을 두 개의 독립 평가 시스템에 구현
- 10+ 모델 벤치마크 비교 (GPT-4.1, Claude Sonnet, Gemini, Qwen3, Gemma-3) — 동일 playbook 평가
- 리더보드 기반 모델 비교로 지속적 개선 추적
- 평가 파이프라인을 모델 개발 워크플로우에 통합

## 학술적 맥락

LLM-as-a-Judge 평가 체계는 [MT-Bench & Chatbot Arena(Zheng et al., NeurIPS 2023)](https://arxiv.org/abs/2306.05685)가 검증한 LLM judge 패러다임 위에 구축했습니다. 해당 연구에서 밝힌 position bias와 verbosity bias 문제를 법률 도메인 특화 rubric으로 보정하며, 도메인 특화 소형 judge 모델의 비용 효율성을 실증합니다. 자체 judge 모델은 [DPO(Rafailov et al., NeurIPS 2023)](https://arxiv.org/abs/2305.18290)로 학습하여 Claude Sonnet API 호출을 자체 모델로 대체, 평가 비용을 대폭 절감했습니다.

## 기술 스택

Python, ROUGE (MeCab), G-Eval, Claude/GPT API, Gemma-3-12b (judge model), Weights & Biases
