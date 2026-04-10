---
title: "AI Workflow & Agent Platform"
description: "LangGraph-based workflow engine powering 10+ legal automation scenarios. Supports contract drafting, comparison, review, compliance, and document inspection via tool calling and subgraph composition."
tags: ["LangGraph", "Agent", "Workflow", "FastAPI", "Python"]
featured: true
order: 1
locale: "en"
period: "2025.11 — Present"
organization: "BHSN"
role: "AI Engineer"
---

## Overview

Designed and built a production AI workflow and agent platform at BHSN. Legal professionals can automate complex document tasks through composable, multi-step AI workflows. The platform served as the primary execution layer for the Agent Legal product launch.

## Key Work

### Workflow Engine Architecture
- Engine built on a cyclic agent graph with tool calling, task lifecycle management, and run-state tracking
- Subgraph composition that lets existing workflows be reused as building blocks inside larger workflows
- Real-time streaming responses wired smoothly through the whole stack

### Workflow Catalog (10+ Types)
- Contract drafting, comparison, and review workflows
- Legal document generation, email drafting, internal policy compliance checks
- Permit analysis and document inspection workflows

### Developer & Non-Developer Tooling
- Browser-based workflow builder, template manager, and prompt preview UI (for non-developers)
- A CLI that lets AI coding agents directly execute and validate workflows
- Tool call interface, user-confirmation question pattern, and Canvas-style document interaction

### Agent Architecture Evolution
- Led the transition from DAG-based workflows to cyclic agent graphs built around message-centric state management
- Added operational features such as workflow cancellation, response-display control, LLM node billing, and follow-up chat
- Integrated observability through logging of agent-node LLM requests and responses

## Business Impact

Contributed to growth from 41 to 227 paid workspaces and 98 to 412 licenses during the Agent Legal launch period. Achieved 15% paid conversion rate on a cohort basis (team-level metric).

## Design Reference

The agent architecture of this platform was not lifted from an academic paper. It was shaped by directly debugging and reverse-engineering how the most successful modern agent products — Claude Code, Codex, and the like — actually behave end to end. Observing their message-history handling, tool-call retry loops, cancellation paths, and user-confirmation flows, we picked out the logic that matters for the legal domain and re-implemented and tested it inside our own environment. The result is not a shallow imitation that merely mimics the surface output of commercial agents, but an agent runtime whose runtime behavior actually holds up in production.

## Tech Stack

Python, graph-based agent runtime, FastAPI, PostgreSQL, streaming response channel, TypeScript UI, CLI
