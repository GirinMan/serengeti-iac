---
title: "BA Reasoning Agent Architecture"
description: "Reasoning layer and agent architecture for complex legal AI queries. Plan-based query decomposition and multi-hop reasoning."
tags: ["Agent", "Reasoning", "Multi-hop", "RAG"]
featured: false
order: 9
locale: "en"
period: "2025 Q2 — 2026 Q1"
organization: "BHSN"
role: "AI Engineer"
image: "/images/projects/ba-reasoning-agent.png"
---

## Overview

Designed and implemented a reasoning agent architecture for handling complex legal queries. Going beyond simple retrieval-augmented generation (RAG), this system enables multi-step legal analysis through plan-based query decomposition and multi-hop reasoning.

## Key Achievements

- Designed BA Reasoning v3 architecture with plan-based query decomposition and binary intent classification
- Implemented multi-hop reasoning pipelines for document comparison and case law comparison
- Built template-based legal document drafting (reports, legal opinions)
- Set and pursued intent classification accuracy target of 95%+
- Set and pursued tool-calling performance improvement target of 15%+

## Technical Approach

- User queries are first classified via a binary intent classifier; complex queries go through a planning stage to be decomposed into sub-queries
- Each sub-query is routed to the appropriate tool (search, document comparison, case law lookup, etc.) for execution
- Intermediate results are synthesized to produce the final response through a multi-hop reasoning structure
- Structured draft generation leveraging document-type-specific legal templates

## Academic Context

The reasoning-acting pipeline in this project extends the reasoning trace and action interleaving paradigm proposed by [ReAct (Yao et al., ICLR 2023)](https://arxiv.org/abs/2210.03629) to legal multi-hop reasoning.

## Tech Stack

Python, LangGraph, LLM Tool Calling, RAG, Elasticsearch
