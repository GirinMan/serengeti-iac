---
title: "Long-Context 법률 문서 LLM 서빙·평가·운영"
description: "EPC 계약 등 5만-8만 토큰 long-context 법률 문서를 처리하기 위한 프로덕션 LLM 인프라. KV cache 메모리 산정, prefix caching, multi-LoRA 서빙, long-context 평가 및 SFT, 운영 트러블슈팅을 포함합니다."
tags: ["vLLM", "LLM 서빙", "Long Context", "평가", "인프라"]
featured: true
order: 4
locale: "ko"
period: "2023.12 — 현재"
organization: "BHSN"
role: "AI Engineer"
image: "/images/projects/long-context-hit-rate-matrix.png"
---

## 개요

일반적인 법률 계약서는 수천~수만 토큰 범위에서 처리되지만, EPC(건설 도급계약)처럼 분량이 큰 특수 계약은 단일 문서가 5만~8만 토큰을 넘어가는 경우가 있습니다. 이런 long-context 케이스에는 표준 LLM 서빙 방식만으로는 대응이 어렵기 때문에, 이 프로젝트는 long-context 법률 문서를 안정적으로 서빙·평가·학습하기 위한 인프라와 운영 체계를 구축하는 데 집중했고, 그 과정에서 일반 LLM 서빙 운영 영역까지 end-to-end로 함께 다뤘습니다.

## Long-Context를 위한 작업

### Long-Context 서빙 요건 정의 & 인프라 설계
- 모델별·장비별로 long-context 추론에 필요한 KV cache 메모리 사용량을 직접 산정해, 어떤 GPU에서 어떤 모델을 어느 시퀀스 길이까지 안정적으로 서빙할 수 있는지 사전에 가늠
- 그 결과를 바탕으로 long-context 워크로드에 맞는 서빙 요건(시퀀스 한계, 배치 정책, 장비 배분)을 정리하고 운영 환경에 반영
- 동일 계약서를 반복 검토·비교하는 패턴에 prefix caching을 적용해 prompt 재계산 비용 절감
- multi-LoRA adapter 서빙을 활용해 task별로 분리된 LoRA 어댑터들을 단일 백엔드에서 효율적으로 운영
- vLLM V0 → V1 엔진 마이그레이션을 통해 84K 토큰 long-context 시나리오에서 응답 시간이 수 배 수준으로 개선되는 것을 검증 (478초 → 100초 수준)

### Long-Context 평가 체계
- 5만~8만 토큰 EPC 계약서를 대상으로 citation 평가 파이프라인 구축
- Needle-in-a-Haystack 방식으로 긴 문서 내 위치별 검색 약점을 분석 — "Lost in the Middle"([Liu et al., TACL 2024](https://arxiv.org/abs/2307.03172))에서 보고된 문서 중간부 성능 저하 현상이 법률 도메인에서도 재현되는지 실증적으로 확인
- 모델 앙상블과 사람 검수를 결합해 long-context 평가용 gold standard 데이터셋 구축

### Long-Context SFT & 모델 개발
- 200K자 규모의 EPC 계약서를 다루는 long-context citation 태스크 — "긴 문서 안에서 어떤 조항이 어디를 근거로 삼고 있는지" 모델이 안정적으로 짚어낼 수 있어야 하는 작업 — 에 맞춰 open model SFT 진행
- 학습 데이터는 데모 페이지를 활용해 EPC weak label을 수집하고, train data fitting 분석으로 부족한 영역을 보강
- 결과적으로 long-context 검토 품질이 base 모델 대비 의미 있게 향상되어, 사람 손이 많이 가던 EPC 계약서 검토를 AI가 실제로 보조할 수 있는 수준에 도달

### Long-Context 운영 & 트러블슈팅
- long-context 서빙 시 빈번하게 발생하는 OOM, 타임아웃, 토큰 카운팅 불일치 같은 프로덕션 이슈를 진단·해결
- Opik 기반 평가 세팅으로 long-context 검토 품질을 지속적으로 모니터링

## 일반 LLM 서빙 운영

Long-context 작업의 토대가 된 일반 LLM 서빙 영역도 함께 다뤘습니다.

### vLLM 도입과 LoRAX → vLLM 이관
- PagedAttention([Kwon et al., SOSP 2023](https://arxiv.org/abs/2309.06180)) 기반 vLLM을 직접 리서치하고, 사내에서 사용하던 LoRAX 기반 서빙 스택에서 vLLM으로 이관할 것을 앞장서서 건의·추진
- 초기 평가부터 Docker 기반 사내 프로덕션 배포까지 단계적으로 적용

### 모델 게이트웨이 구성
- LiteLLM 기반 모델 게이트웨이의 구현과 운영 설계에 적극 참여해, 자체 vLLM 백엔드와 상용 API 등 서로 다른 백엔드·다양한 모델을 단일 인터페이스로 서빙할 수 있는 인프라 구성

### 구조화 출력 (Structured Output)
- 계약 분석 결과를 위한 JSON schema 및 regex 기반 guided decoding 구현
- 복수 서빙 백엔드에 걸친 `response_format` 정책 설계
- 구조화 출력 응답의 스트리밍 호환성 이슈 해결

## 발표

LangCon 2024에서 BHSN 소속으로 **"Open Model을 Long Context 형태로 튜닝하는 방법"** 주제로 발표했습니다. 54K~80K 토큰 법률 계약서를 다루기 위한 open model long-context fine-tuning 전략, 법률 문서 요약과 멀티턴 RAG 채팅 파이프라인, LoRAX 기반 multi-adapter 서빙, prefix caching·구조화 출력·GPU 메모리 최적화 등 long-context 서빙을 떠받치는 실전 노하우를 공유했습니다.

📎 [발표 자료 (Google Drive)](https://drive.google.com/file/d/1rRJ2EO1J2Hhonxr8bNvISnVFqYz5iL5s/view)

## 기반 기술 이해와 오픈소스 프레임워크 활용

Long-context 처리를 위해 RoPE 기반 positional encoding과 그 확장 기법들([LongRoPE(ICML 2024)](https://arxiv.org/abs/2402.13753) 등)이 어떤 원리로 context window를 늘리는지, NoPE처럼 위치 인코딩을 다르게 다루는 접근이 어떤 경우에 유효한지를 학습·정리했습니다. 새로운 기법을 직접 제안한 것은 아니지만, 이러한 기반 기술에 대한 이해를 바탕으로 vLLM·LoRAX 같은 오픈소스 학습/서빙 프레임워크가 제공하는 long-context 옵션들을 어떤 상황에서 어떤 파라미터로 적용해야 하는지 판단했고, 그 결과를 50K~84K 토큰 법률 계약서 서빙·학습에 효과적으로 도입·운영했습니다.

## 기술 스택

vLLM, LiteLLM, Docker, GPU (A100/H100), OpenAI-compatible API
