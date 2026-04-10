---
title: "CLOVA Note Title Generation Model"
description: "NAVER Cloud Document Intelligence internship project. Built summary-based title generation for CLOVA Note and improved weak label quality via positive filtering SFT."
tags: ["NLP", "HyperCLOVA", "LoRA", "Weak Labeling"]
featured: false
order: 7
locale: "en"
period: "2022.12 — 2023.02"
organization: "NAVER / NAVER Cloud"
role: "AI Research Engineer (Intern)"
image: "/images/projects/clovanote-title-generation.jpg"
---

## Overview

During an internship on the NAVER Cloud Document Intelligence team, I developed an automatic title generation model based on CLOVA Note meeting summaries. Applied LoRA tuning on HyperCLOVA/LaRva backbones and systematically improved weak label quality through multi-criteria positive filtering.

## Key Achievements

- Designed a multi-criteria filtering pipeline with 4 criteria:
  - ROUGE-1 precision >= 0.75
  - RoBERTa-HyperUNICON semantic similarity >= 0.9
  - 2 additional quality filters applied
- Reduced bullet-format error rate from 6.75% to 3.50% (-48%) in the first SFT round
- Further reduced bullet-format errors from 12 to 1 (-92%) in subsequent experiments
- Improved train filtered count from 83.71% to 95.98%
- Performed OOD validation (news articles, course syllabi, multilingual data)
- Launched as the official CLOVA Note "AI Summary Subtitle Support" feature 3 months after the internship ended

## Design Constraints & Decisions

- Had to improve quality from weak labeling alone without large-scale manual annotation
- This was late 2022 — before DPO (Direct Preference Optimization) existed — so improving model preferences had to be achieved purely through SFT + automatic data curation
- Chose an iteration structure retaining only positive data for retraining, rather than stopping at rule-based quality constraints
- Separated tone & manner from length constraints, iteratively tuning metric combinations in follow-up experiments

## Technical Approach

- Used HyperCLOVA/LaRva large language models as backbones with efficient fine-tuning via LoRA/PEFT
- Applied positive filtering SFT methodology to improve weak label data quality: selected only samples passing quality criteria from first-round SFT model outputs for second-round SFT
- Multi-axis filtering combining ROUGE-based lexical overlap and RoBERTa-based semantic similarity for noise removal
- Validated generalization performance on OOD data including news articles, course syllabi, and multilingual inputs
- Contributed a PR to the internal SFT finetuning platform, enabling comparison of multiple metrics at once during intermediate validation

## Tech Stack

HyperCLOVA, LaRva, LoRA/PEFT, ROUGE, RoBERTa, Streamlit, Python
