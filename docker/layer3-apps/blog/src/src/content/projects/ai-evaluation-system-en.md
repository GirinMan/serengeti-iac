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
image: "/images/projects/ai-evaluation-system.png"
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
- G-Eval-style fluency, coherence, and factual consistency scoring
- In-house judge model training (SFT + DPO) — 70-80% cost reduction compared to Claude Sonnet

### Legal Expert Evaluation
- Collaborated with legal professionals to define domain-specific rubrics
- Revision policy compliance (0-2 points), contextual consistency (0-5 points), guideline adherence (3-stage verification), etc.
- Gold standard dataset construction through model ensemble + expert review workflows

## Scale

- 20+ custom metrics implemented across two independent evaluation systems
- 10+ model benchmark comparisons (GPT-4.1, Claude Sonnet, Gemini, Qwen3, Gemma-3) — evaluated on identical playbooks
- Leaderboard-based model comparison for continuous improvement tracking
- Evaluation pipeline integrated into model development workflows

## Academic Context

The LLM-as-a-Judge evaluation framework builds on the LLM judge paradigm validated by [MT-Bench & Chatbot Arena (Zheng et al., NeurIPS 2023)](https://arxiv.org/abs/2306.05685). Position bias and verbosity bias issues identified in that research are mitigated through legal domain-specific rubrics, while demonstrating the cost efficiency of domain-specific small judge models. The in-house judge model was trained with [DPO (Rafailov et al., NeurIPS 2023)](https://arxiv.org/abs/2305.18290), achieving 70-80% cost reduction compared to Claude Sonnet.

## Tech Stack

Python, ROUGE (MeCab), G-Eval, Claude/GPT API, Gemma-3-12b (judge model), Weights & Biases
