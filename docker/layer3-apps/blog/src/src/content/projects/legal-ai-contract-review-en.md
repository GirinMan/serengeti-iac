---
title: "AI Contract Review System"
description: "End-to-end AI system for contract analysis covering extraction, checklist review, risk assessment, and revision suggestions. Patent registered."
tags: ["Legal AI", "NLP", "Contract Analysis", "FastAPI", "Patent"]
featured: true
order: 2
locale: "en"
period: "2023.09 — Present"
organization: "BHSN"
role: "AI Engineer"
---

## Overview

Built and evolved a production AI system for automated contract review. Covers the full pipeline from document extraction to checklist-based review, risk assessment, and revision suggestions, processing multilingual contracts (Korean, English, Japanese).

## Core Features

### Contract Analysis Pipeline
- **Extraction**: Clause-level extraction, party identification (97.5% accuracy), contract classification
- **Checklist Review**: Custom playbook-based AI review (Green/Yellow/Red risk grades) — evolved from per-clause V1 to full-contract V2 API
- **Summarization**: Structured contract summaries with key term identification
- **Revision Suggestions**: Context-aware clause revision recommendations (91-93% fix ratio on production contracts)

### Playbook Self-Serve Platform
- Designed a platform enabling legal professionals to independently author, test, and deploy review playbooks via Excel-based workflows
- Client-specific playbook overlay structure — maintaining shared playbooks while applying workspace-level customizations
- Automated playbook release pipeline: contract type SQL, playbook build, warning triage, handoff

### Multi-Editor Integration
- Extended AI review for direct use within document editors (Hancom HWP add-on, Word plugin)
- Led API specification design for external partner integrations

## Scale

- 2.5 years of continuous development
- Multilingual support: Korean, English, Japanese
- 38 contract types, 4 client PoC deployments

## Patent

**Registration No. 10-2867168** (Republic of Korea) — Registered patent for AI contract review methodology. Covers contract analysis, summarization, checklist review, and model training.

## Academic Context

The retrieval pipeline for contract analysis follows the Advanced RAG paradigm, and structured output generation applies JSON schema validation in the context of constrained decoding research such as [XGrammar (Dong et al., 2024)](https://arxiv.org/abs/2411.15100).

While the foundational [CUAD (NeurIPS 2021)](https://arxiv.org/abs/2103.06268) dataset covers 13K annotations on single-language contracts, this system extends to 38 contract types across Korean, English, and Japanese with client-specific custom playbook overlays. This system achieves production-grade performance through domain-specific fine-tuning and a playbook-based approach, and includes a citation verification system and related clause linking.

## Impact

Operating as a core product feature enabling legal teams to review contracts more efficiently with AI-assisted analysis.
