---
name: "학습 데이터 파이프라인"
nameEn: "Training Data Pipeline"
description: "• 전처리→필터링→합성→어노테이션 전체 파이프라인\n• Positive/Negative 필터링 — 불량 데이터 48% 감소\n• LLM 기반 합성 데이터 및 Weak Labeling\n• SFT/DPO 학습셋 구축 및 품질 관리"
category: "data-engineering"
order: 10.1
layer: "models-evaluation"
layerOrder: 3
locale: "ko"
---

End-to-end training data pipeline — preprocessing, quality filtering, synthetic data generation, and annotation. Achieved 48% bad data reduction via positive/negative filtering and semantic similarity-based selection at NAVER. Built LLM-powered synthetic data and weak labeling pipelines for SFT/DPO training at BHSN. Covers deduplication, human annotation workflow design, and iterative data curation across legal domain datasets.
