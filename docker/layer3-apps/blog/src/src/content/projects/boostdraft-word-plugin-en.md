---
title: "BoostDraft × allibee Partner Product"
description: "An ongoing partner product combining BoostDraft's Word-native editing interactions with allibee's near-human contract review depth — currently in active negotiation and co-development."
tags: ["Word Plugin", "Partnership", "Product Development"]
featured: false
order: 13
locale: "en"
period: "2025.06 — Present (in negotiation & development)"
organization: "BHSN"
role: "AI Engineer"
---

## Overview

A partner product that pairs BoostDraft's Microsoft Word–based editor with allibee's contract review AI. The work is **currently in progress in parallel with active business negotiation**: the final scope, API contract, and commercial terms are still being shaped with the partner. This page captures the direction as it stands today.

## The Synergy We Are Building

BoostDraft and allibee come from different angles but are strongly complementary.

- **allibee** brings contract review that approaches a human lawyer's depth — reasoning across the whole document, connecting clauses, checking policy compliance, and surfacing risks.
- **BoostDraft** already ships a polished editor-native experience on top of Word, with fast, precise interactions such as definition lookup, citation clause verification, and proofreading.

Multiplying the two produces something neither side can deliver alone: instead of a one-shot review that ends when the report is generated, the user keeps working inside Word — editing a clause, asking again, and continuing the conversation. **Maximizing this interaction-level synergy** is the core goal of the product work.

## What We Are Doing Now

- Studying BoostDraft's editor interaction model and co-designing, with the partner team, how allibee's review output should appear inside that flow
- Negotiating the API contract, authentication, and permissioning needed to expose allibee's deep review engine to the partner product
- Preparing shared demo scenarios and evaluation criteria so that both teams can measure the synergy qualitatively and quantitatively
- Press coverage: [Naver News](https://n.news.naver.com/mnews/article/138/0002198171?sid=105)

## Strategic Context

This sits at a different point from the Hancom HWP project. Hancom's editor had very limited in-editor AI interactions, so we approached it as a minimal workflow-execution add-on. BoostDraft, in contrast, already runs a strong editor-native experience on Word, so the natural move is not to rebuild the editor but to bring allibee's deep review capability *into* that experience. The project is currently being shaped into a real product while the business negotiation is still live.

## Tech Stack

FastAPI, Python, REST API, Microsoft Word Add-in
