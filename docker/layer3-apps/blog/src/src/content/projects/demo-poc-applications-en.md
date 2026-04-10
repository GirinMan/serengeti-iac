---
title: "Demo & PoC Applications"
description: "Demo apps, playbook QA tools, and workflow demo UIs for validating and showcasing legal AI capabilities."
tags: ["Demo", "PoC", "Playbook"]
featured: false
order: 11
locale: "en"
period: "2024.12 — 2026.03"
organization: "BHSN"
role: "AI Engineer"
image: "/images/projects/demo-poc-applications.png"
---

## Overview

Built demo applications and QA tools for internal validation and external showcasing of legal AI capabilities. Developed apps for various purposes including AI Review performance verification, playbook management automation, and workflow demonstrations.

## Key Achievements

- Built AI Review performance QA page: provided a structured interface for systematically verifying review results
- Automated playbook uploads: implemented an end-to-end pipeline from file upload to Google Drive storage to SQL synchronization
- Implemented per-workspace playbook overlay system: applied customer-specific custom rules on top of shared playbooks
- Built legal workflow demo with RAG search and streaming API
- 61 PRs contributed across 4 repositories

## Lawyer-in-the-Loop Platform

Beyond a simple demo app, built a self-serve playbook platform where lawyers directly create checklists, test them on sample contracts, and selectively deploy to specific clients:
- Excel-based playbook authoring → upload testing → final version Drive upload → QA zone deployment
- Separated LATEST from existing releases to manage iterative revisions vs. currently deployed versions
- Overlay structure where specific workspaces customize certain playbooks while keeping the shared base intact

## Project Timeline

| Period | Focus |
|--------|-------|
| 2024 Q4 – 2025 Q2 | AI Review/playbook QA page build, QA interface |
| 2025 Q3 – Q4 | Workflow gallery/builder/runner, demo app structure expansion |
| 2026 Q1 | Workflow and studio demo asset integration |

## Technical Approach

- Designed a self-serve workflow where lawyers create checklists, test in a demo environment, go through QA approval, and deploy to customers
- Implemented a demo UI displaying real-time results using RAG-based search and SSE streaming API
- Automated playbook management and deployment to enable non-engineers to operate the system directly
- Built workflow gallery with builder/runner UX supporting JSON import/export for a fully interactive demo app

## Tech Stack

FastAPI, Python, Google Drive API, PostgreSQL, SSE, vLLM, LoRAX
