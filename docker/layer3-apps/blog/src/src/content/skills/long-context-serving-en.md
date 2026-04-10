---
name: "Long-Context Serving (50K+ tokens)"
description: "• 54K-80K token EPC contract serving optimization
• Prefix caching for recurring pattern acceleration
• Citation F1 evaluation pipeline
• Needle-in-a-Haystack position bias analysis and SFT improvement"
category: "model-serving"
order: 10
layer: "models-domain"
layerOrder: 3
locale: "en"
---

Serving optimization for 50K-80K token legal documents with prefix caching ([SGLang/RadixAttention](https://arxiv.org/abs/2312.07104)) and citation evaluation. Validated "[Lost in the Middle](https://arxiv.org/abs/2307.03172)" position bias in legal domain, improved hit rate via long-context SFT. Applies RoPE + NoPE multi-scale positional encoding in production — referencing [LongRoPE (ICML 2024)](https://arxiv.org/abs/2402.13753) progressive extension strategy, deployed on real legal contracts with vLLM V1 achieving 4.8-5.5x speedup.
