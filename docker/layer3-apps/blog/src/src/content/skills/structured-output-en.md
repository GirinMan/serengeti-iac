---
name: "Structured Output / Guided Decoding"
description: "• JSON schema, regex, FSM-based guided decoding
• vLLM structured output policy establishment
• XGrammar-based 100x acceleration pipeline
• LoRAX structured output open-source contribution"
category: "model-serving"
order: 8
layer: "models-foundation"
layerOrder: 4
locale: "en"
---

JSON schema, regex, and FSM-based guided decoding for controlled LLM output generation. Contributed structured output support to LoRAX ([PR #644](https://github.com/predibase/lorax/pull/644)), applying constrained decoding techniques at the serving interface level. Production backend uses [XGrammar](https://arxiv.org/abs/2411.15100) (Dong et al., 2024), achieving 100x speedup via adaptive token mask caching and persistent execution stack — integrated into vLLM V1 serving pipeline. Multi-backend JSON schema compliance validated against findings from [JSONSchemaBench](https://arxiv.org/abs/2501.10868) (2025), which benchmarks 6 constrained decoding frameworks across 10K real-world schemas.
