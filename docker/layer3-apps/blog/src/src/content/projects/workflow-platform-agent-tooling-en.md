---
title: "AI Workflow & Agent Platform"
description: "LangGraph-based workflow engine powering 10+ legal automation scenarios. Supports contract drafting, comparison, review, compliance, and document inspection via tool calling and subgraph composition."
tags: ["LangGraph", "Agent", "Workflow", "FastAPI", "Python"]
featured: true
order: 1
locale: "en"
period: "2024.04 — Present"
organization: "BHSN"
role: "AI Engineer"
image: "/images/projects/workflow-platform-agent-tooling.png"
---

## Overview

Designed and built a production AI workflow and agent platform at BHSN. Legal professionals can automate complex document tasks through composable, multi-step AI workflows. The platform served as the primary execution layer for the Agent Legal product launch.

## Key Work

### Workflow Engine Architecture
- LangGraph-based cyclic agent graph — tool calling, task lifecycle management, workflow status tracking
- Workflow subgraph composition — reuse existing workflows as nodes within larger workflows
- SSE-based real-time streaming response integration

### Workflow Catalog (10+ Types)
- Contract drafting, comparison, and review workflows
- Legal document generation, email drafting, internal policy compliance checks
- Permit analysis and document inspection workflows

### Developer & Non-Developer Tooling
- Browser-based workflow builder, template manager, and prompt preview UI (for non-developers)
- Typer-based CLI — enabling AI coding agents to directly execute and validate workflows
- Tool call interface, AskUserQuestion pattern, Canvas document integration

### Agent Architecture Evolution
- Led transition from DAG-based workflows to cyclic agent graphs (messages-based state management)
- Implemented cancel_workflow, display flags, LLM node billing, and follow-up chat features
- Integrated observability via PostgreSQL logging of agent node LLM requests/responses

## Business Impact

Contributed to growth from 41 to 227 paid workspaces and 98 to 412 licenses during the Agent Legal launch period. Achieved 15% paid conversion rate on a cohort basis (team-level metric).

## Academic Context

The agent architecture of this platform applies the reasoning-acting interleaving paradigm from [ReAct (Yao et al., ICLR 2023)](https://arxiv.org/abs/2210.03629) to the legal domain. The LangGraph-based cyclic agent graph corresponds to a dynamic runtime graph, operating 10+ workflow scenarios via tool calling and subgraph composition.

## Tech Stack

Python, LangGraph, FastAPI, PostgreSQL, SSE, TypeScript (UI), Typer (CLI)
