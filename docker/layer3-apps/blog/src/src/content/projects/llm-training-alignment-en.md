---
title: "Legal Domain LLM Training & Alignment"
description: "End-to-end training pipeline for legal domain LLMs. Achieved SOTA on contract analysis benchmarks using SFT, DPO, and task-specific LoRA adapters."
tags: ["LLM Training", "SFT", "DPO", "LoRA", "Evaluation"]
featured: true
order: 3
locale: "en"
period: "2023.09 — 2026.01"
organization: "BHSN"
role: "AI Engineer"
---

## Overview

Built and operated the full training and alignment pipeline for legal domain LLMs at BHSN. Scope includes dataset curation, SFT, preference optimization, and multi-task evaluation across contract review, clause extraction, and document analysis.

## Key Achievements

### Contract Analysis SOTA
- Multi-task SFT model achieved **overall 0.9138** — +4.7% over GPT-4.1 (0.8731)
- Party identification: 97.5%, query answerability: 95.75%
- Checklist model v2 human eval 80.41% (on par with or above GPT-4o at 79.16%)

### Long-Context Performance
- Fine-tuned models for processing 200K-character EPC contracts
- Hit rate: base Gemma-3 0.081 → SFT 0.383 (approaching GPT-4.1 at 0.390)

### Task-Specific Adapters
- Trained 5 LoRA adapters on Qwen2.5-14B backbone: checklist review, redline revision, translation, label extraction, Contract-AI
- Adapter-based serving enabling simultaneous on-premise deployment and commercial model replacement

## Pipeline & Infrastructure

- Dataset operations across 13+ repositories (systematic version control)
- Evaluation framework: traditional metrics + LLM-as-a-Judge + legal expert rubrics
- Training on AICA-provided H100x8 GPU infrastructure
- 10+ model benchmark comparisons (GPT-4.1, Claude Sonnet, Gemini, Qwen3, Gemma-3)

## Academic Context

Task-specific LoRA adapter training extends the low-rank adaptation technique from [LoRA (Hu et al., ICLR 2022)](https://arxiv.org/abs/2106.09685) to legal domain multi-task settings. For preference optimization, [DPO (Rafailov et al., NeurIPS 2023)](https://arxiv.org/abs/2305.18290) was applied — directly optimizing policy with classification loss without a reward model — ensuring training stability and implementation simplicity. On the memory-efficient training front, quantization techniques from [QLoRA (Dettmers et al., NeurIPS 2023)](https://arxiv.org/abs/2305.14314) were also referenced for operating large-scale model training on H100/A100 infrastructure.

This project achieved comparable results to large-scale continued pretraining through small-scale, high-quality data and efficient LoRA-based fine-tuning. The multi-task SFT overall score of 0.9138 surpasses the GPT-4.1 SOTA (0.8731) in a resource-efficient manner, demonstrating that domain-specific adapter training is a key strategy for legal AI.

## Tech Stack

PyTorch, Transformers, PEFT/LoRA, vLLM, Weights & Biases, H100/A100 GPU
