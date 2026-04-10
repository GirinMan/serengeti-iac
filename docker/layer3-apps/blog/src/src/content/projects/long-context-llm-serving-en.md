---
title: "Long-Context Legal Document LLM — Training, Evaluation & Serving"
description: "End-to-end long-context work on legal documents of 50K–100K+ tokens: successful open-model SFT convergence at 100K+ context on a single GPU server node, a matching long-document evaluation pipeline, and production serving on top of the trained model."
tags: ["Model Training", "Long Context SFT", "LLM Training", "Evaluation", "vLLM", "LLM Serving"]
featured: true
order: 4
locale: "en"
period: "2023.12 — Present"
organization: "BHSN"
role: "AI Engineer"
---

## Overview

Ordinary legal contracts sit in the "a few thousand to a few tens of thousands of tokens" range, but specialized contracts such as EPC (Engineering/Procurement/Construction) agreements routinely exceed 50K–80K tokens — more than 200K characters in the raw source. Whether a model can reliably ground clause-level reasoning while the entire document is in context is the real question in this regime, and this project answered that question by wiring **training → evaluation → serving** into a single coherent pipeline on top of the same model.

Along the way it naturally pulled in the broader production LLM-serving work (LoRAX → vLLM migration, model gateway, structured output, etc.) as the substrate everything else runs on.

## Long-Context Training (SFT)

### Successful 100K+ context SFT on a single GPU server node

The result I personally care about most on this project is that **long-context SFT of an open model actually converged at 100K+ token context length on a single GPU server node — no giant multi-node training cluster involved**. Feeding an entire long document into one training sample normally blows up attention memory non-linearly, making it easy to hit OOM or gradient instability; getting real convergence within those environmental constraints is the load-bearing claim here.

Concretely, the training held up in two ways.

- **Training loss fitting** — training loss decreased and converged normally in the long-context regime rather than diverging, confirming that the learning signal still reached the model at these lengths.
- **Recall metric fitting** — recall-style metrics that measure whether the model can locate supporting clauses *inside* a long document improved in lockstep with loss. That matters because it shows the model was learning to retrieve from long context, not just memorizing shortcuts to drive loss down.
- **Single-node budget** — all of this happened inside one GPU server node rather than a multi-node distributed training setup. Reaching convergence at this context length meant working the memory budget, sequence packing, gradient checkpointing, and the choice of attention implementation explicitly, as part of the experiment.

> The important framing here is not "we ran SFT on large contexts" but "we empirically established the convergence regime for long-context SFT under a realistic single-node hardware budget." Every downstream step in this project — evaluation, serving — sits on top of that trained model.

### Long-Context SFT pipeline

- Trained on a long-context citation task over 200K-character EPC contracts — the task demands that the model reliably point out which clauses ground which conclusions inside a long document
- Built the training set by harvesting EPC weak labels through internal demo pages and tightened weak areas via train-data fitting analysis
- The resulting SFT model meaningfully lifted long-context review quality above the base model, to the point where EPC contract review — previously heavily manual — can now be assisted by the model in practice.

## Long-Context Evaluation

### Long-document evaluation framework

- Built a citation evaluation pipeline targeting 50K–80K-token EPC contracts
- Ran Needle-in-a-Haystack–style positional analysis to check whether the mid-document degradation reported in "Lost in the Middle" ([Liu et al., TACL 2024](https://arxiv.org/abs/2307.03172)) reproduces in the legal domain, and empirically confirmed that it does
- Constructed a gold-standard evaluation dataset by combining model ensembles with human review

### Coupling evaluation back to training

- The SFT model trained above was mounted directly into this evaluation harness so that long-document recall could be measured pre- vs. post-training in a like-for-like way
- Weaknesses surfaced by the evaluation fed directly back into training-data reinforcement, closing the loop

## Long-Context Serving

### Serving requirements & infrastructure

- Computed KV-cache memory requirements per model × GPU so that, for any given model on any given box, the safe long-context sequence length was known up front
- Used that budget to define long-context serving requirements (sequence caps, batching policy, device allocation) and rolled those into the production environment
- Applied prefix caching to the recurring "review and compare the same contract again" pattern to cut prompt re-computation cost
- Ran multi-LoRA adapter serving so that task-specific LoRA adapters share a single backend efficiently
- Validated the vLLM V0 → V1 engine migration on an 84K-token long-context scenario, where response time improved by several times over (from roughly 478s down to roughly 100s)

### Operations & troubleshooting

- Diagnosed and resolved recurring production issues in long-context serving — OOM, timeouts, token-count mismatches — as they came up
- Used an Opik-based evaluation setup to continuously monitor long-context review quality in production

## General LLM-Serving Operations

Long-context work runs on top of everyday LLM-serving operations, which this project also covered.

### vLLM adoption and LoRAX → vLLM migration

- Personally researched vLLM built on PagedAttention ([Kwon et al., SOSP 2023](https://arxiv.org/abs/2309.06180)) and took the lead on proposing and driving the migration from the internal LoRAX-based stack to vLLM
- Rolled it out in stages, from initial evaluation to Dockerized internal production deployment

### Model gateway

- Contributed actively to the implementation and operational design of a LiteLLM-based model gateway that exposes our vLLM backends, commercial APIs, and multiple models through a single serving interface

### Structured output

- Implemented guided decoding for contract analysis outputs using JSON schema and regex
- Designed a coherent `response_format` policy across multiple serving backends
- Fixed streaming-compatibility issues with structured-output responses

## Talk

At LangCon 2024 I presented **"How to Tune Open Models for Long Context"** on behalf of BHSN — covering open-model long-context fine-tuning strategies for 54K–80K-token legal contracts, legal-document summarization, the multi-turn RAG chat pipeline, LoRAX-based multi-adapter serving, prefix caching, structured output, and GPU memory optimization, framed as the production know-how that holds the whole long-context pipeline together.

📎 [Slides (Google Drive)](https://drive.google.com/file/d/1rRJ2EO1J2Hhonxr8bNvISnVFqYz5iL5s/view)

## Foundations & Use of Open-Source Frameworks

To handle long context I worked through how RoPE-based positional encoding and its extensions ([LongRoPE, ICML 2024](https://arxiv.org/abs/2402.13753) and so on) actually extend the context window, and when positionless approaches such as NoPE are worth considering. I did not invent a new technique; I used that foundational understanding to decide *which* long-context options from open-source training and serving frameworks to turn on, *when*, and *with what parameters*, and then applied those choices to training at 100K+ tokens and to serving 50K–84K-token legal contracts in production.

## Tech Stack

Open-model SFT, long-context fine-tuning, vLLM, LiteLLM, Docker, GPUs (A100 / H100), OpenAI-compatible API
