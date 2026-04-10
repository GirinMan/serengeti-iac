---
title: "Memory-Efficient LLM Fine-Tuning"
description: "Graduation project combining INT8 quantization and LoRA adapters to fine-tune OPT-13B on a single consumer GPU (RTX 3090 24GB)."
tags: ["Quantization", "LoRA", "PEFT", "LLM", "Research"]
featured: true
order: 6
locale: "en"
period: "2022.09 — 2023.05"
organization: "Hanyang University"
role: "Undergraduate Researcher"
---

## Overview

As an undergraduate graduation project at Hanyang University, I researched memory-efficient fine-tuning of large language models. By combining `LLM.int8()` quantization with LoRA adapters, I enabled fine-tuning of a 13B-parameter model on a consumer-grade GPU.

## Problem

Large language models require substantial GPU memory for both inference and fine-tuning. At the time (2022-2023), training 13B models typically required multi-GPU setups or expensive cloud instances, making them inaccessible to individual researchers and students.

## Approach

- Combined `LLM.int8()` (outlier-preserving mixed-precision quantization) with LoRA adapters
- Compared INT8+LoRA vs FP16+LoRA across multiple NLU/NLG benchmarks
- Tested adapter portability between quantized and full-precision backbones

## Results

- **OPT-13B on RTX 3090 24GB**: ROUGE-L 0.4388 on SAMSum (21.60GB memory), on par with A6000 48GB FP16+LoRA baseline (ROUGE-L 0.4336, 31.02GB)
- **OPT-1.3B**: INT8+LoRA maintained comparable performance to FP16+LoRA across MRPC, BoolQ, HellaSwag, and SAMSum, with 3-17% memory savings
- **Adapter Portability**: LoRA adapters trained on quantized backbones successfully transferred to FP16 backbones

## Significance

As an early exploration in 2022-2023 — before QLoRA and similar techniques became mainstream — this project built foundational experience in quantization, parameter-efficient fine-tuning, and resource-constrained ML that directly shaped my professional career.

## Academic Context

This project is an early exploration combining the low-rank adaptation from [LoRA (Hu et al., ICLR 2022)](https://arxiv.org/abs/2106.09685) with `LLM.int8()` quantization. While the later [QLoRA (Dettmers et al., NeurIPS 2023)](https://arxiv.org/abs/2305.14314) enabled single-GPU training of 65B models with 4-bit NormalFloat quantization, this project demonstrated the same problem space with INT8+LoRA on a consumer GPU (RTX 3090) during 2022-2023, predating QLoRA's publication.

## Links

- [GitHub Repository](https://github.com/GirinMan/HYU-Graduation-Project-Quantization)
