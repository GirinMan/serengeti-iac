---
title: "LoRAX Open-Source Contributions"
description: "4 PRs merged to predibase/lorax. Improved OpenAI-compatible serving interface, deterministic generation, streaming usage, and structured output support."
tags: ["Open Source", "LLM Serving", "Rust", "Python", "OpenAI API"]
repoUrl: "https://github.com/predibase/lorax"
featured: true
order: 2.5
locale: "en"
organization: "Open Source"
role: "Contributor"
period: "2024.03 — 2024.10"
---

## Overview

Contributed 4 merged PRs to [predibase/lorax](https://github.com/predibase/lorax), an open-source framework for serving fine-tuned LLMs. LoRAX is a production implementation of multi-LoRA serving research, and was used as the serving infrastructure for 310 fine-tuned models in the [LoRA Land](https://arxiv.org/abs/2405.00732) technical report. Each contribution addressed OpenAI API compatibility issues discovered during production operations.

## Contributions

### PR #358 — Chat Completion Stream Fix & API Improvements
- Fixed chat completion final delta serialization for OpenAI client compatibility
- Added `/tokenize` endpoint (token counting)
- Improved Swagger/OpenAPI documentation

### PR #374 — Seed Parameter Support
- Added `seed` parameter to OpenAI-compatible endpoints
- Enabled deterministic generation for reproducible testing and evaluation

### PR #506 — Streaming Usage Information
- Added token `usage` field to streaming chat completion responses
- Aligned with OpenAI stream_options usage reporting behavior

### PR #644 — Structured Output Support
- Implemented `response_format` support (`text`, `json_object`, `json_schema`)
- Reduced switching costs between OpenAI API and self-hosted LoRAX serving

## Impact

These were not standalone OSS activities but direct solutions to serving interface issues discovered in production LLM deployments. PR #644's structured output support in particular implements constrained decoding techniques at the serving interface level, and was directly applied to internal contract classification and checklist generation pipelines.

## Links

- [PR #358](https://github.com/predibase/lorax/pull/358) | [PR #374](https://github.com/predibase/lorax/pull/374) | [PR #506](https://github.com/predibase/lorax/pull/506) | [PR #644](https://github.com/predibase/lorax/pull/644)
- A richer PR card and summary view is available from the same component on the [Achievements page — Open Source section](/en/achievements#opensource).
