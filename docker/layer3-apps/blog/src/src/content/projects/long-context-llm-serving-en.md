---
title: "Long-Context Legal Document LLM Serving, Evaluation & Operations"
description: "Production LLM infrastructure processing 50K–80K token legal documents. Covers vLLM serving, prefix caching, structured output, citation evaluation, long-context SFT, and troubleshooting."
tags: ["vLLM", "LLM Serving", "Long Context", "Evaluation", "Infrastructure"]
featured: true
order: 4
locale: "en"
period: "2023.12 — Present"
organization: "BHSN"
role: "AI Engineer"
image: "/images/projects/long-context-hit-rate-matrix.png"
---

## Overview

Legal contracts typically exceed 50K tokens, presenting serving, evaluation, and operational challenges that standard LLM deployments cannot address. In this project, I designed and operated production infrastructure for long-context legal document processing while building evaluation systems, training models, and resolving operational issues end-to-end.

## Key Work

### vLLM Production Operations
- Led adoption of vLLM based on PagedAttention ([Kwon et al., SOSP 2023](https://arxiv.org/abs/2309.06180)) from initial evaluation through Docker-based internal production deployment
- Optimized recurring contract review patterns via prefix caching leveraging RadixAttention ([Zheng et al., NeurIPS 2024](https://arxiv.org/abs/2312.07104)) principles
- V0 → V1 engine migration — **4.8-5.5x speed improvement** on 84K-token contracts (478s → 100s)
- GPU memory optimization and multi-model serving via LiteLLM routing

### Structured Output
- Implemented JSON schema and regex-based guided decoding for contract analysis results
- Designed `response_format` policy across multiple serving backends
- Resolved streaming compatibility issues with structured output responses

### Long-Context Evaluation Framework
- Built citation evaluation pipeline targeting 50K–80K token EPC contracts
- Identified retrieval weaknesses through Needle-in-a-Haystack positional analysis — empirically confirmed the mid-document performance degradation reported in "Lost in the Middle" ([Liu et al., TACL 2024](https://arxiv.org/abs/2307.03172)) in the legal domain, improving hit rate from 0.081 to 0.383 via SFT
- Constructed gold standard evaluation datasets through model ensemble + human review

### Long-Context SFT & Model Development
- Trained long-context SFT models targeting 200K-character EPC contracts
- Hit rate: base Gemma-3 0.081 → SFT 0.383 (approaching GPT-4.1 at 0.390)
- Train data fitting analysis, EPC weak label generation using demo pages

### Operations & Troubleshooting
- Diagnosed and resolved production issues including OOM, timeouts, and token counting mismatches during long-context serving
- Monitored long-context review quality via Opik-based evaluation setup

### Presentations
- Presented on long-context LLM serving for the legal domain at [LangCon 2024](https://2024langcon.oopy.io/time-table) — covering document summarization, multi-turn RAG chat, and serving efficiency strategies.

## Academic Context

The RoPE-based positional encoding extension used in this project references the progressive extension strategy proposed by [LongRoPE (ICML 2024)](https://arxiv.org/abs/2402.13753). While LongRoPE theoretically demonstrated context window extension up to 2M tokens, this project applied RoPE extension techniques to production serving of actual 50K–84K token legal contracts. NoPE (No Positional Encoding) is a separate technique from RoPE, explored as part of a multi-scale positional encoding strategy.

## Tech Stack

vLLM, LiteLLM, Docker, GPU (A100/H100), OpenAI-compatible API
