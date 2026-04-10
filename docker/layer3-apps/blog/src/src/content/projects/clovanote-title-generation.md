---
title: "클로바노트 제목 생성 모델"
description: "NAVER Cloud Document Intelligence 인턴십에서 수행한 클로바노트 요약문 기반 제목 생성. Positive filtering SFT로 weak label 품질 개선."
tags: ["NLP", "HyperCLOVA", "LoRA", "Weak Labeling"]
featured: false
order: 7
locale: "ko"
period: "2022.12 — 2023.02"
organization: "NAVER / NAVER Cloud"
role: "AI Research Engineer (인턴)"
image: "/images/projects/clovanote-title-generation.jpg"
---

## 개요

NAVER Cloud Document Intelligence 팀 인턴십에서 클로바노트 회의 요약문 기반 제목 자동 생성 모델을 개발했습니다. HyperCLOVA/LaRva 백본에 LoRA 튜닝을 적용하고, multi-criteria positive filtering을 통해 weak label 품질을 체계적으로 개선했습니다.

## 주요 성과

- 4가지 기준의 multi-criteria 필터링 파이프라인 설계
  - ROUGE-1 precision >= 0.75
  - RoBERTa-HyperUNICON semantic similarity >= 0.9
  - 그 외 2가지 품질 필터 적용
- 1차 SFT에서 개조식 오류율 6.75%에서 3.50%로 감소 (-48%)
- 후속 실험에서 개조식 오류 12건에서 1건으로 감소 (-92%)
- Train filtered count 83.71%에서 95.98%로 개선
- OOD 검증 수행 (뉴스, 강의계획서, 다국어 데이터)
- 인턴십 종료 3개월 후 ClovaNote 공식 'AI 요약 소제목 지원' 기능으로 출시

## 설계 제약과 판단

- 대규모 수작업 annotation 없이 weak labeling 기반으로 품질을 끌어올려야 했습니다
- DPO(Direct Preference Optimization)가 존재하지 않던 2022년 말 시점이라, 모델 선호도 개선을 순수 SFT + 자동 데이터 큐레이션으로만 달성해야 했습니다
- rule 기반 품질 제약에 그치지 않고, positive data만 남겨 재학습하는 iteration 구조를 선택했습니다
- tone & manner와 길이 제약을 분리하여 보고, 후속 실험에서 metric 조합을 반복 튜닝했습니다

## 기술적 접근

- HyperCLOVA/LaRva 대규모 언어 모델을 백본으로 활용하고, LoRA/PEFT로 효율적 파인튜닝 수행
- Weak label 데이터의 품질을 높이기 위해 positive filtering SFT 방법론 적용: 1차 SFT 모델이 생성한 출력 중 품질 기준을 통과한 샘플만 선별하여 2차 SFT 수행
- ROUGE 기반 어휘 일치도와 RoBERTa 기반 의미 유사도를 조합한 다축 필터링으로 노이즈 제거
- 뉴스, 강의계획서, 다국어 입력 등 OOD 데이터에 대한 일반화 성능 검증
- 사내 SFT finetuning 플랫폼에 PR을 올려, 중간 validation에서 여러 metric을 한 번에 비교 가능하게 개선

## 기술 스택

HyperCLOVA, LaRva, LoRA/PEFT, ROUGE, RoBERTa, Streamlit, Python
