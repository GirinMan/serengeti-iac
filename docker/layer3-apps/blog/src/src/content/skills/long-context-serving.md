---
name: "Long-Context Serving (50K+ tokens)"
description: "• 54K-80K 토큰 EPC 계약서 서빙 최적화\n• Prefix caching 기반 반복 패턴 가속\n• Citation F1 평가 파이프라인 구축\n• Needle-in-a-Haystack 위치 편향 분석·SFT 개선"
category: "model-serving"
order: 10
layer: "models-domain"
layerOrder: 3
locale: "ko"
---

Serving optimization for 50K-80K token legal documents with prefix caching ([SGLang/RadixAttention](https://arxiv.org/abs/2312.07104)) and citation evaluation. Validated "[Lost in the Middle](https://arxiv.org/abs/2307.03172)" position bias in legal domain, improved hit rate via long-context SFT. Applies RoPE + NoPE multi-scale positional encoding in production — referencing [LongRoPE (ICML 2024)](https://arxiv.org/abs/2402.13753) progressive extension strategy, deployed on real legal contracts with vLLM V1 achieving 4.8-5.5x speedup.
