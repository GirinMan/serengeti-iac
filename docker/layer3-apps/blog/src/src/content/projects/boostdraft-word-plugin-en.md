---
title: "BoostDraft Word Plugin Integration"
description: "External partner project integrating allibee contract review AI into Microsoft Word-based BoostDraft plugin via API."
tags: ["Word Plugin", "API Integration", "Partnership"]
featured: false
order: 13
locale: "en"
period: "2025.06 — Present"
organization: "BHSN"
role: "AI Engineer"
---

## Overview

An external partner project that integrated allibee contract review functionality into BoostDraft's Microsoft Word editor plugin via API. Designed a workflow enabling users to run AI contract review directly within the Word environment.

## Key Achievements

- Developed integration strategy and executed allibee contract review functionality within the BoostDraft editor
- Handled the full process from API spec definition to server preparation
- Press coverage: [Naver News](https://n.news.naver.com/mnews/article/138/0002198171?sid=105)

## Technical Approach

- Analyzed BoostDraft Word plugin's editor features and API call structure
- Defined the integration interface with the allibee review API and designed request/response specifications
- Implemented server endpoints that receive document text from the plugin and return review results

## Strategic Context

A contrasting integration strategy to the Hancom HWP project. Hancom's editor had limited AI capabilities, so we approached it with a workflow-based minimal add-on. BoostDraft, on the other hand, already had sophisticated editor-native features within the Word environment — definition lookup, citation clause verification, proofreading, and more. Therefore, rather than rebuilding the editor, supplying allibee's contract review AI via API was the more pragmatic solution.

## Tech Stack

FastAPI, Python, REST API, Microsoft Word Add-in
