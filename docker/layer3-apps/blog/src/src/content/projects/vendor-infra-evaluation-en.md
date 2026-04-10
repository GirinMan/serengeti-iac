---
title: "GPU Vendor & Infrastructure Evaluation"
description: "External GPU/serving vendor evaluation and infrastructure decision-making for LLM serving platform expansion. Compared FriendliAI, Rebellion, Kakao Cloud, and others."
tags: ["GPU", "Vendor Evaluation", "Infrastructure", "LiteLLM"]
featured: false
order: 14
locale: "en"
period: "2025.01 — 2025.03"
organization: "BHSN"
role: "AI Engineer"
---

## Overview

Evaluated external GPU and serving vendors and performed infrastructure decision-making for LLM serving platform expansion. Conducted comparative analysis of multiple vendors including FriendliAI, Rebellion, and Kakao Cloud, and built a GPU benchmark framework.

## Key Achievements

- FriendliAI evaluation: compared cloud vs. container deployment, verified multi-LoRA support
- Rebellion AI evaluation: analyzed ATOM GPU architecture, benchmarked TPS/latency/power consumption
- Kakao Cloud evaluation: compared costs for A100 80GB and H100 8-pack configurations
- Resolved LiteLLM streaming chunk edge cases
- Secured AICA H100×8 infrastructure (2025 Q1–Q2)

## Technical Approach

- Compared each vendor's deployment model, model compatibility, and cost structure using a unified evaluation framework
- Built a GPU benchmark framework: measured TPS with BERT-base/Qwen2.5-7B, peak power, and power efficiency ratio
- Analyzed and resolved streaming edge cases encountered when integrating multi-vendor serving through LiteLLM proxy
- Produced infrastructure decision reports based on benchmark results and cost analysis

## LiteLLM Integration Issues Resolved

- **Streaming chunk differences**: Handled discrepancies between OpenAI and LiteLLM `stop` token processing (content `""` vs `None`, empty `choices` vs populated)
- **Repetition text detection**: Implemented multi-level repetition detection (token, sentence, structure level) based on N-gram + fuzzy matching
- **YAML-based multi-vendor routing**: Configured Dev/Stage/Prod deployment workflows using vLLM + LiteLLM integration patterns

## Tech Stack

LiteLLM, vLLM, PyTorch, CUDA, H100, A100, Docker Compose, GitHub Actions, Python
