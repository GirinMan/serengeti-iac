---
name: "LoRAX Multi-Adapter Serving"
description: "• Predibase LoRAX 기반 멀티 LoRA 어댑터 동시 서빙\n• Shared base model + per-request adapter 라우팅\n• Structured output 등 오픈소스 기여 (PR 4건 머지)\n• vLLM V1 LoRA 지원 후 마이그레이션 완료"
category: "model-serving"
order: 7.5
layer: "infrastructure-serving"
layerOrder: 3
locale: "ko"
---

Production multi-adapter serving with Predibase LoRAX — shared base model with per-request LoRA adapter routing for cost-efficient multi-task deployment. Contributed structured output support and other improvements (4 merged PRs to predibase/lorax). After vLLM V1 added native LoRA adapter serving support, migrated the production stack to vLLM for unified serving infrastructure.
