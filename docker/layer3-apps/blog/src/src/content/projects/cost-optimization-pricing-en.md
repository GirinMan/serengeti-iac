---
title: "LLM Cost Optimization & Pricing Strategy"
description: "SaaS pricing model design, token-credit system implementation, 70–80% evaluation cost reduction with in-house Judge model."
tags: ["Pricing Strategy", "Cost Optimization", "Credit System"]
featured: false
order: 15
locale: "en"
period: "2025.06 — 2026.03"
organization: "BHSN"
role: "AI Engineer"
image: "/images/projects/cost-optimization-pricing.png"
---

## Overview

Analyzed LLM API costs for the SaaS product, designed pricing models, and built a token-credit system. Achieved significant evaluation cost reduction by introducing an in-house Judge model.

## Key Achievements

- LLM API cost analysis: calculated blended rate of $1.48/1M tokens (input 97.3%, output 2.7% pattern), confirmed cost/revenue ratio of 5.53%
- Built credit system (CreditApplication): multi-tenant support with 1000x precision scaling, 3-tier lookup hierarchy
- Achieved 70–80% evaluation cost reduction vs. Claude Sonnet by introducing Gemma-3-12b as an in-house Judge model
- Designed pricing model based on ₩99,000/month SaaS plan with 10,000 credits

## Technical Approach

- Analyzed API call logs to map per-model, per-feature token usage and cost structures (GPT-4.1-mini primary at 550K requests, GPT-4.1, Gemini variants in parallel)
- Implemented token-credit conversion via `creditsPerToken` multiplier in `CreditApplication`, with workspace-specific → tenant default → global fallback 3-tier lookup
- Built SQL-based usage measurement on `llm_events` table: cache hit distinction, task_type, token counts, request timestamps tracking
- Trained Gemma-3-12b as a Judge model via SFT + DPO to perform quality evaluation without external LLM API calls

## Business Impact

Quantitatively analyzing the cost structure of LLM services and designing a token-credit system demonstrates the ability to bridge business models and technical implementation for AI products. This spans blended rate calculation, multi-tenant credit architecture, and cost reduction strategy through an in-house Judge model — showing product economics understanding beyond pure engineering.

## Tech Stack

Python, FastAPI, PostgreSQL, Gemma-3-12b, LangChain, Cloud SQL
