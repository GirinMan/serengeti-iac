---
title: "Hancom HWP Add-on Workflow Integration"
description: "WebView-based AI workflow add-on for Hancom HWP document editor, enabling direct AI functionality within documents."
tags: ["HWP", "WebView", "TypeScript", "Workflow"]
featured: false
order: 12
locale: "en"
period: "2025.07 — Present"
organization: "BHSN"
role: "AI Engineer"
---

## Overview

An external partner project with Hancom, implementing a WebView-based AI workflow add-on within the Hancom HWP document editor. Created a seamless flow where users can log in, select and execute workflows, view results, and insert content into HWP documents — all without leaving the editor.

## Key Achievements

- Implemented the complete flow: login → workflow list → execution → Canvas results → HWP document insertion
- Analyzed and integrated 24 API endpoints
- Integrated HWP InsertText, GetTextFile, and GetSelectText APIs
- Documented project home, decision log, handover documents, and 4-week MVP schedule in Confluence Space
- Press coverage: [DigitalToday](https://www.digitaltoday.co.kr/news/articleView.html?idxno=574890)

## Technical Approach

- With no prior frontend development experience, leveraged AI coding agents (Claude Code, Cursor) to rapidly build the add-on UI using WebView + TypeScript
- Analyzed 24 API endpoints from the existing service and the HWP Add-on SDK's document manipulation APIs to integrate text extraction and insertion
- Configured a pipeline that renders workflow execution results as Canvas and directly inserts them into HWP documents
- Structured the project around a 4-week MVP timeline, with systematic management of decision logs and handover documentation
- AI-assisted rapid prototyping and code generation enabled delivering stable results within the MVP timeline, even on an unfamiliar tech stack

## Product Planning & Implementation

Defined the product direction tailored to the Hancom editor environment and built the application's core structure:
- **Product Spec Definition**: Analyzed Hancom editor add-on constraints to shape a workflow-execution-centered product direction
- **App Architecture Design**: Designed and implemented the end-to-end skeleton — login → workflow selection → execution → result rendering → document insertion
- **Project Documentation**: Systematically organized requirements, decision logs, handover materials, and 4-week MVP timeline in Confluence Space

## Strategic Context

By reusing the existing allibee web app's API infrastructure, a new add-on app optimized for the Hancom editor environment was rapidly developed. This expanded allibee's service entry points into the HWP editor, achieving efficient channel growth by leveraging existing assets.

## Tech Stack

TypeScript, Vite, WebView, HWP Add-on SDK, REST API, Playwright (API capture), Confluence, **AI-assisted development** (Claude Code, Cursor)
