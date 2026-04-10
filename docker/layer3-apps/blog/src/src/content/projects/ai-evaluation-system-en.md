---
title: "AI Evaluation Metrics System"
description: "Multi-axis evaluation framework combining traditional NLP metrics, LLM-as-a-Judge, and legal expert rubrics. 20+ custom metrics, 10+ model benchmarks."
tags: ["Evaluation", "LLM-as-Judge", "NLP Metrics", "Quality Assurance"]
featured: false
order: 5
locale: "en"
period: "2024 Q1 — Present"
organization: "BHSN"
role: "AI Engineer"
---

## Overview

Designed and implemented an evaluation framework for legal AI services. Measures quality across contract review, clause revision, document summarization, and information extraction through three complementary evaluation axes.

## Evaluation Architecture

### Traditional Quantitative Metrics
- Domain-specific NLP metrics (MeCab Korean tokenizer-based ROUGE, structured accuracy)
- Task-specific evaluation: checklist review accuracy, clause extraction F1, legal advisory summary quality
- Multilingual support (Korean, English, Japanese) with automatic language detection

### LLM-as-a-Judge
- Automated evaluation based on LLM judgments for subjective quality dimensions
- G-Eval-style fluency, coherence, consistency, and relevance scoring
- In-house judge model training (SFT + DPO) — tracked Claude Sonnet API cost while running G-Eval and replaced it with an in-house model to substantially reduce evaluation cost

### Legal Expert Evaluation
- Collaborated with legal professionals to define domain-specific rubrics
- Revision policy compliance (0-2 points), contextual consistency (0-5 points), guideline adherence (3-stage verification), etc.
- Gold standard dataset construction through model ensemble + expert review workflows

## Representative Metrics (High Level)

The three axes answer different questions. At a human-readable level, each evaluation checks roughly:

- whether the model left untouched clauses alone — a "policy compliance" check
- whether the revisions still flow naturally with surrounding clauses, defined terms, and premises — a "contextual consistency" check
- whether the items required by the internal guidelines actually show up in the output — a "guideline adherence" check
- whether the generated text reads well and stays on topic — a "generation quality" check
- on tasks with a ground-truth set, an additional "how many did it get right" check driven by ground-truth metrics

## What a Review Record Contains (Abstracted)

The real schema is different, but conceptually each evaluated case bundles together:

- **Case identifiers** — which review this evaluation is attached to
- **Task type** — clause review, summarization, extraction, and so on
- **Per-axis judgments** — a high / medium / low verdict for each of policy compliance, contextual consistency, guideline adherence, and generation quality
- **A short rationale** — one or two lines in human-readable form, e.g. "definition clauses were untouched, but a dropped exception condition nudged the consistency score down"
- **Reviewer agreement flag** — whether the human reviewer agrees with the judge model; disagreements are the only cases where the rubric is reopened

That shape is what keeps expert review time bounded while the gold-standard dataset keeps growing.

## Scale

- 20+ custom metrics implemented across two independent evaluation systems
- 10+ model benchmark comparisons (GPT-4.1, Claude Sonnet, Gemini, Qwen3, Gemma-3) — evaluated on identical playbooks
- Leaderboard-based model comparison for continuous improvement tracking
- Evaluation pipeline integrated into model development workflows

## Academic Context

The LLM-as-a-Judge evaluation framework builds on the chain-of-thought–driven LLM evaluation paradigm proposed by [G-Eval (Liu et al., 2023)](https://arxiv.org/abs/2303.16634). The paper's four-axis rubric — fluency, coherence, consistency, and relevance — is extended to legal-domain tasks, and we demonstrate the cost efficiency of domain-specific small judge models. The in-house judge model was trained with [DPO (Rafailov et al., NeurIPS 2023)](https://arxiv.org/abs/2305.18290) to replace Claude Sonnet API calls with the in-house model, substantially reducing evaluation cost.

## Tech Stack

Python, ROUGE (MeCab), G-Eval, Claude/GPT API, Gemma-3-12b (judge model), Weights & Biases
