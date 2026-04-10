---
title: "GPU 벤더 및 인프라 평가"
description: "LLM 서빙 플랫폼 확장을 위한 외부 GPU/서빙 벤더 평가 및 인프라 의사결정. FriendliAI, Rebellion, Kakao Cloud 등 비교."
tags: ["GPU", "벤더 평가", "인프라", "LiteLLM"]
featured: false
order: 14
locale: "ko"
period: "2025.01 — 2025.03"
organization: "BHSN"
role: "AI Engineer"
---

## 개요

LLM 서빙 플랫폼 확장을 위해 외부 GPU 및 서빙 벤더를 평가하고, 인프라 의사결정을 수행한 프로젝트입니다. FriendliAI, Rebellion, Kakao Cloud 등 복수 벤더를 비교 분석하고, GPU 벤치마크 프레임워크를 구축했습니다.

## 주요 성과

- FriendliAI 평가: 클라우드 vs 컨테이너 배포 방식 비교, 멀티 LoRA 지원 여부 검증
- Rebellion AI 평가: ATOM GPU 아키텍처 분석, TPS/지연/전력 벤치마크 수행
- Kakao Cloud 평가: A100 80GB, H100 8-pack 비용 비교 분석
- LiteLLM 스트리밍 청크 엣지 케이스 해결
- AICA H100×8 인프라 확보 (2025 Q1-Q2)

## 기술적 접근

- 각 벤더별 배포 방식, 모델 호환성, 비용 구조를 통일된 기준으로 비교
- GPU 벤치마크 프레임워크 구축: BERT-base/Qwen2.5-7B 기준 TPS, peak power, power efficiency ratio 측정
- LiteLLM 프록시를 통한 멀티 벤더 서빙 통합 시 발생하는 스트리밍 엣지 케이스를 분석하고 해결
- 벤치마크 결과와 비용 분석을 바탕으로 인프라 의사결정 보고서 작성

## LiteLLM 통합 이슈 해결

- **스트리밍 청크 차이**: OpenAI vs LiteLLM의 `stop` 토큰 처리 차이(content `""` vs `None`, empty `choices` vs populated) 대응
- **반복 텍스트 탐지**: N-gram + fuzzy matching 기반 다중 수준 반복 탐지(token, sentence, structure level) 구현
- **YAML 기반 멀티 벤더 라우팅**: vLLM + LiteLLM 통합 패턴으로 Dev/Stage/Prod 배포 워크플로우 구성

## 기술 스택

LiteLLM, vLLM, PyTorch, CUDA, H100, A100, Docker Compose, GitHub Actions, Python
