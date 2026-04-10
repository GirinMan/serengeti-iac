---
name: "LoRA / PEFT / SFT / DPO"
description: "• Qwen2.5-14B 기반 5개 LoRA 어댑터 학습\n• 체크리스트·편집·번역·추출·Contract-AI\n• Multi-task SFT overall 0.9138 달성\n• SFT→DPO 2단계 정렬 파이프라인"
category: "model-training"
order: 2
layer: "models-foundation"
layerOrder: 1
locale: "ko"
---

Parameter-efficient fine-tuning, supervised fine-tuning, and direct preference optimization for domain-specific LLMs. Built on foundational methods: [LoRA](https://arxiv.org/abs/2106.09685) (Hu et al., ICLR 2022), [QLoRA](https://arxiv.org/abs/2305.14314) (Dettmers et al., NeurIPS 2023), and [DPO](https://arxiv.org/abs/2305.18290) (Rafailov et al., NeurIPS 2023). Contributed to LoRAX multi-adapter serving ([LoRA Land](https://arxiv.org/abs/2405.00732)), which demonstrated LoRA fine-tuned models rivaling GPT-4 across 31 tasks. Achieved comparable results to large-scale continued pretraining through efficient LoRA-based multi-task SFT with curated data — overall 0.9138 vs GPT-4.1 SOTA 0.8731. Alignment pipeline uses SFT→DPO two-stage approach.
