---
name: "LoRAX Multi-Adapter Serving"
description: "• Multi-LoRA adapter concurrent serving via Predibase LoRAX
• Shared base model + per-request adapter routing
• Open-source contributions including structured output (4 PRs merged)
• Migration to vLLM V1 after native LoRA support"
category: "model-serving"
order: 7.5
layer: "infrastructure-serving"
layerOrder: 3
locale: "en"
---

Production multi-adapter serving with Predibase LoRAX — shared base model with per-request LoRA adapter routing for cost-efficient multi-task deployment. Contributed structured output support and other improvements (4 merged PRs to predibase/lorax). After vLLM V1 added native LoRA adapter serving support, migrated the production stack to vLLM for unified serving infrastructure.
