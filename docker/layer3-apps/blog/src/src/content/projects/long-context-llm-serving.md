---
title: "Long-Context 법률 문서 LLM 학습·평가·서빙"
description: "수만~십수만 토큰 규모의 장문 법률 문서를 대상으로, 단일 GPU 서버 노드로 100K 이상 context에서 open model SFT 를 성공적으로 수렴시키고, 그 모델을 긴 문서용 평가 파이프라인과 프로덕션 서빙까지 end-to-end 로 운영."
tags: ["모델 학습", "Long Context SFT", "LLM 학습", "평가", "vLLM", "LLM 서빙"]
featured: true
order: 4
locale: "ko"
period: "2023.12 — 현재"
organization: "BHSN"
role: "AI Engineer"
---

## 개요

일반적인 법률 계약서는 수천~수만 토큰 범위에서 처리되지만, EPC(건설 도급계약)처럼 분량이 큰 특수 계약은 단일 문서가 5만~8만 토큰, 원문 기준 20만 자 이상을 넘어가는 경우가 있습니다. 이런 long-context 영역은 "긴 문서를 그대로 모델에 넣어도 조항 간 근거를 안정적으로 짚을 수 있느냐" 가 핵심인 작업이고, 이 프로젝트는 그 질문에 대해 **학습 → 평가 → 서빙** 전 단계를 일관된 하나의 파이프라인으로 붙여서 답을 만든 작업입니다.

그 과정에서 일반 LLM 서빙 운영(LoRAX → vLLM 이관, 모델 게이트웨이, 구조화 출력 등)까지 자연스럽게 함께 다뤘습니다.

## Long-Context 학습 (SFT)

### 단일 GPU 서버 노드에서 100K 이상 context 학습 성공

이 프로젝트에서 개인적으로 가장 의미 있었던 성과는, **별도의 거대한 학습 클러스터 없이 단일 GPU 서버 노드 한 대로 100K 토큰 이상 context 길이에 대한 open model long-context SFT 를 성공적으로 수렴**시켰다는 점입니다. 긴 문맥을 그대로 한 샘플로 집어넣어 학습하려 하면 attention 메모리가 비선형으로 커져 OOM·gradient instability 에 쉽게 걸리는데, 이 환경적 한계를 우회하고도 학습을 안정적으로 돌렸다는 의미입니다.

구체적으로는 다음과 같이 확인했습니다.

- **Training loss fitting**: 긴 문맥 학습 세팅에서도 training loss 가 발산하지 않고 정상적으로 감소·수렴해, long-context 영역에서도 학습 신호가 유효하게 전달됨을 확인
- **Recall metric fitting**: 긴 문서 안에서 정답 조항을 "어디에 있는지" 짚어내는 recall 계열 지표가 학습이 진행되는 동안 유의미하게 같이 상승해, loss 가 단순히 외우기로 떨어지는 것이 아니라 실제로 긴 문맥 검색 능력이 학습되고 있음을 확인
- **단일 서버 노드**: 멀티 노드 분산 학습 인프라가 아닌 단일 GPU 서버 노드 한 대 안에서 이 수준의 context 길이를 끝까지 돌렸습니다. 메모리 예산과 시퀀스 패킹, 그래디언트 체크포인팅, 학습 시 attention 구현 선택 등 실전 제약 조건을 정리해 가며 수렴까지 도달했습니다.

> 이 부분은 단순히 "큰 context 로 SFT 를 돌렸다" 가 아니라, **제한된 하드웨어 안에서 긴 문맥 학습의 수렴 조건을 실전으로 확인했다**는 것이 핵심입니다. 이후 작업(평가·서빙)이 모두 이 학습 결과 위에 얹혀 있습니다.

### Long-Context SFT 파이프라인

- 200K자 규모의 EPC 계약서를 다루는 long-context citation 태스크 — "긴 문서 안에서 어떤 조항이 어디를 근거로 삼고 있는지" 모델이 안정적으로 짚어낼 수 있어야 하는 작업 — 에 맞춰 open model SFT 진행
- 학습 데이터는 내부 데모 페이지를 활용해 EPC weak label 을 수집하고, train data fitting 분석으로 부족한 영역을 보강
- 결과적으로 long-context 검토 품질이 base 모델 대비 의미 있게 향상되어, 사람 손이 많이 가던 EPC 계약서 검토를 AI 가 실제로 보조할 수 있는 수준에 도달

## Long-Context 평가

### 긴 문서용 평가 체계

- 5만~8만 토큰 EPC 계약서를 대상으로 citation 평가 파이프라인 구축
- Needle-in-a-Haystack 방식으로 긴 문서 내 위치별 검색 약점을 분석 — "Lost in the Middle"([Liu et al., TACL 2024](https://arxiv.org/abs/2307.03172)) 에서 보고된 문서 중간부 성능 저하 현상이 법률 도메인에서도 재현되는지 실증적으로 확인
- 모델 앙상블과 사람 검수를 결합해 long-context 평가용 gold standard 데이터셋 구축

### 학습 결과 연결

- 위에서 학습시킨 SFT 모델을 이 평가 체계 위에 그대로 올려서, 학습 전후로 긴 문서 recall 이 어떻게 변화하는지 정량적으로 확인
- 평가에서 드러난 약점은 다시 학습 데이터 보강 쪽으로 피드백되는 구조로 운영

## Long-Context 서빙

### 서빙 요건 정의 & 인프라 설계

- 모델별·장비별로 long-context 추론에 필요한 KV cache 메모리 사용량을 직접 산정해, 어떤 GPU 에서 어떤 모델을 어느 시퀀스 길이까지 안정적으로 서빙할 수 있는지 사전에 가늠
- 그 결과를 바탕으로 long-context 워크로드에 맞는 서빙 요건(시퀀스 한계, 배치 정책, 장비 배분)을 정리하고 운영 환경에 반영
- 동일 계약서를 반복 검토·비교하는 패턴에 prefix caching 을 적용해 prompt 재계산 비용 절감
- multi-LoRA adapter 서빙을 활용해 task 별로 분리된 LoRA 어댑터들을 단일 백엔드에서 효율적으로 운영
- vLLM V0 → V1 엔진 마이그레이션을 통해 84K 토큰 long-context 시나리오에서 응답 시간이 수 배 수준으로 개선되는 것을 검증 (478초 → 100초 수준)

### 운영 & 트러블슈팅

- long-context 서빙 시 빈번하게 발생하는 OOM, 타임아웃, 토큰 카운팅 불일치 같은 프로덕션 이슈를 진단·해결
- Opik 기반 평가 세팅으로 long-context 검토 품질을 지속적으로 모니터링

## 일반 LLM 서빙 운영

Long-context 작업의 토대가 된 일반 LLM 서빙 영역도 함께 다뤘습니다.

### vLLM 도입과 LoRAX → vLLM 이관

- PagedAttention([Kwon et al., SOSP 2023](https://arxiv.org/abs/2309.06180)) 기반 vLLM 을 직접 리서치하고, 사내에서 사용하던 LoRAX 기반 서빙 스택에서 vLLM 으로 이관할 것을 앞장서서 건의·추진
- 초기 평가부터 Docker 기반 사내 프로덕션 배포까지 단계적으로 적용

### 모델 게이트웨이 구성

- LiteLLM 기반 모델 게이트웨이의 구현과 운영 설계에 적극 참여해, 자체 vLLM 백엔드와 상용 API 등 서로 다른 백엔드·다양한 모델을 단일 인터페이스로 서빙할 수 있는 인프라 구성

### 구조화 출력 (Structured Output)

- 계약 분석 결과를 위한 JSON schema 및 regex 기반 guided decoding 구현
- 복수 서빙 백엔드에 걸친 `response_format` 정책 설계
- 구조화 출력 응답의 스트리밍 호환성 이슈 해결

## 발표

LangCon 2024 에서 BHSN 소속으로 **"Open Model 을 Long Context 형태로 튜닝하는 방법"** 주제로 발표했습니다. 54K~80K 토큰 법률 계약서를 다루기 위한 open model long-context fine-tuning 전략, 법률 문서 요약과 멀티턴 RAG 채팅 파이프라인, LoRAX 기반 multi-adapter 서빙, prefix caching · 구조화 출력 · GPU 메모리 최적화 등 long-context 전체 파이프라인을 떠받치는 실전 노하우를 공유했습니다.

📎 [발표 자료 (Google Drive)](https://drive.google.com/file/d/1rRJ2EO1J2Hhonxr8bNvISnVFqYz5iL5s/view)

## 기반 기술 이해와 오픈소스 프레임워크 활용

Long-context 처리를 위해 RoPE 기반 positional encoding 과 그 확장 기법들([LongRoPE(ICML 2024)](https://arxiv.org/abs/2402.13753) 등) 이 어떤 원리로 context window 를 늘리는지, NoPE 처럼 위치 인코딩을 다르게 다루는 접근이 어떤 경우에 유효한지를 학습·정리했습니다. 새로운 기법을 직접 제안한 것은 아니지만, 이러한 기반 기술에 대한 이해를 바탕으로 오픈소스 학습 / 서빙 프레임워크가 제공하는 long-context 옵션들을 어떤 상황에서 어떤 파라미터로 적용해야 하는지 판단했고, 그 결과를 100K 이상 토큰 법률 계약서 학습과 50K~84K 토큰 서빙에 효과적으로 도입·운영했습니다.

## 기술 스택

Open model SFT, Long-context fine-tuning, vLLM, LiteLLM, Docker, GPU (A100/H100), OpenAI-compatible API
