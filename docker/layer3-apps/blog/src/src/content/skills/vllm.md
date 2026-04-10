---
name: "vLLM"
description: "• Prefix caching, 구조화 출력, LoRA 서빙\n• 다양한 GPU 스펙에 맞춘 서빙 & 테스트\n• V0→V1 마이그레이션 — 84K 토큰 4.8x 가속\n• PagedAttention 기반 GPU 메모리 최적화"
category: "model-serving"
order: 7
layer: "infrastructure-serving"
layerOrder: 1
locale: "ko"
---

Production vLLM deployment and operations — built on PagedAttention ([Kwon et al., SOSP 2023](https://arxiv.org/abs/2309.06180)). Prefix caching, structured output, LoRA adapter serving, V0/V1 engine migration, GPU memory optimization. Familiar with speculative decoding techniques ([EAGLE](https://arxiv.org/abs/2401.15077), [Medusa](https://arxiv.org/abs/2401.10774)) for inference acceleration.
