---
title: "법률 도메인 LLM 학습 & 정렬"
description: "법률 도메인 LLM을 위한 End-to-end 학습 파이프라인. SFT, DPO, task-specific LoRA 어댑터를 활용하여 자체 정의한 계약 분석 벤치마크에서 지속적으로 성능을 고도화했습니다."
tags: ["LLM 학습", "SFT", "DPO", "LoRA", "평가"]
featured: true
order: 3
locale: "ko"
period: "2023.09 — 2026.01"
organization: "BHSN"
role: "AI Engineer"
---

## 개요

BHSN에서 법률 도메인 LLM의 전체 학습·정렬 파이프라인을 구축·운영했습니다. 데이터셋 큐레이션, SFT, 선호도 최적화, 계약 검토·조항 추출·문서 분석 전반의 multi-task 평가까지 포함합니다.

## 주요 성과

### 자체 벤치마크 기반 성능 고도화
- Multi-task SFT 모델 **overall 0.9138** — GPT-4.1 (0.8731) 대비 +4.7%
- Party identification: 97.5%, query answerability: 95.75%
- 체크리스트 모델 v2 human eval 80.41% (GPT-4o 79.16% 대비 동등 이상)

### Long-Context 성능
- 200K자 EPC 계약서 처리를 위한 모델 파인튜닝
- Hit rate: base Gemma-3 0.081 → SFT 0.383 (GPT-4.1 0.390에 근접)

### Task-Specific 어댑터
- Qwen2.5-14B 백본 기반 5종 LoRA 어댑터 학습: 체크리스트 검토, 레드라인 수정, 번역, 라벨 추출, Contract-AI
- 어댑터 기반 서빙으로 on-premise 배포와 상용 모델 대체 동시 추진

## 파이프라인 & 인프라

- 13+ 레포에 걸친 데이터셋 운영 (체계적 버전 관리)
- 평가 프레임워크: 전통 메트릭 + LLM-as-a-Judge + 법률 전문가 rubric
- AICA 제공 H100x8 GPU 인프라로 학습
- 10+ 모델 벤치마크 비교 (GPT-4.1, Claude Sonnet, Gemini, Qwen3, Gemma-3)

## 학술적 맥락

Task-specific LoRA 어댑터 학습은 [LoRA(Hu et al., ICLR 2022)](https://arxiv.org/abs/2106.09685)의 low-rank 적응 기법을 법률 도메인 멀티태스크에 확장한 것입니다. 선호도 최적화에는 reward model 없이 classification loss로 직접 정책을 최적화하는 [DPO(Rafailov et al., NeurIPS 2023)](https://arxiv.org/abs/2305.18290)를 적용하여 학습 안정성과 구현 단순성을 확보했습니다. 메모리 효율적 학습 측면에서는 [QLoRA(Dettmers et al., NeurIPS 2023)](https://arxiv.org/abs/2305.14314)의 양자화 기법도 참고하여 H100/A100 인프라에서 대규모 모델 학습을 운영했습니다.

이 프로젝트는 소규모 고품질 데이터와 LoRA 기반 효율적 fine-tuning으로 대규모 continued pretraining과 동등한 수준의 성과를 달성했습니다. Multi-task SFT overall 0.9138은 GPT-4.1 SOTA(0.8731)를 리소스 효율적으로 넘어선 결과이며, 도메인 특화 어댑터 학습이 법률 AI의 핵심 전략임을 실증했습니다.

## 기술 스택

PyTorch, Transformers, PEFT/LoRA, vLLM, Weights & Biases, H100/A100 GPU
