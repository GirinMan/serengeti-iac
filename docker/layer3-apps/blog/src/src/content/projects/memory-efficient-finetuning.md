---
title: "메모리 효율적 LLM 파인튜닝"
description: "INT8 양자화와 LoRA 어댑터를 결합해 OPT-13B를 단일 소비자용 GPU(RTX 3090 24GB)에서 파인튜닝한 졸업 프로젝트."
tags: ["양자화", "LoRA", "PEFT", "LLM", "연구"]
featured: true
order: 6
locale: "ko"
period: "2022.09 — 2023.05"
organization: "한양대학교"
role: "학부 연구자"
image: "/images/projects/memory-efficient-finetuning.png"
---

## 개요

한양대학교 학부 졸업 프로젝트로, 대규모 언어 모델의 메모리 효율적 파인튜닝을 연구했습니다. `LLM.int8()` 양자화와 LoRA 어댑터를 결합해 13B 파라미터 모델 파인튜닝을 소비자급 GPU에서 가능하게 했습니다.

## 문제

대규모 언어 모델은 추론과 파인튜닝 모두 상당한 GPU 메모리를 필요로 합니다. 당시(2022-2023) 13B 모델 학습은 통상 멀티 GPU 셋업이나 고가의 클라우드 인스턴스가 필요해 개인 연구자나 학생에게는 접근이 어려웠습니다.

## 접근

- `LLM.int8()` (outlier 보존 혼합 정밀도 양자화)와 LoRA 어댑터 결합
- INT8+LoRA vs FP16+LoRA를 여러 NLU/NLG 벤치마크에서 비교
- 양자화된 백본과 전정밀도 백본 간 어댑터 이식성 테스트

## 결과

- **OPT-13B on RTX 3090 24GB**: SAMSum에서 ROUGE-L 0.4388 (21.60GB 메모리), A6000 48GB FP16+LoRA 베이스라인 (ROUGE-L 0.4336, 31.02GB)과 동등
- **OPT-1.3B**: INT8+LoRA가 MRPC, BoolQ, HellaSwag, SAMSum 전반에서 FP16+LoRA와 유사한 성능 유지, 메모리 3-17% 절감
- **어댑터 이식성**: 양자화 백본에서 학습한 LoRA 어댑터가 FP16 백본으로 전이 성공

## 의의

QLoRA 등이 주류가 되기 전인 2022-2023년 초기 탐색으로, 양자화, 파라미터 효율적 파인튜닝, 리소스 제약 ML의 기초 경험을 쌓아 이후 전문 커리어로 이어졌습니다.

## 학술적 맥락

이 프로젝트는 [LoRA(Hu et al., ICLR 2022)](https://arxiv.org/abs/2106.09685)의 low-rank 적응과 `LLM.int8()` 양자화를 결합한 초기 탐색입니다. 이후 발표된 [QLoRA(Dettmers et al., NeurIPS 2023)](https://arxiv.org/abs/2305.14314)가 4-bit NormalFloat 양자화로 65B 모델의 단일 GPU 학습을 가능하게 했는데, 본 프로젝트는 그보다 앞선 2022-2023년에 INT8+LoRA 조합으로 동일한 문제의식을 consumer GPU(RTX 3090)에서 실증한 것입니다.

## 링크

- [GitHub Repository](https://github.com/GirinMan/HYU-Graduation-Project-Quantization)
