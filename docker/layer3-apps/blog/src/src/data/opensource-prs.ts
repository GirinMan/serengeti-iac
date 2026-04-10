import type { Locale } from "../i18n";

export interface OssPr {
  slug: string;
  number: number;
  repo: string;
  repoUrl: string;
  prUrl: string;
  title: string;
  mergedDate: string;
  description: string;
  whatChanged: string[];
  whyItMatters: string;
  technicalDetail: string;
  relatedWork: string;
  relatedProjectUrl?: string;
  tags: string[];
  filesChanged?: number;
}

interface OssPrI18n {
  slug: string;
  number: number;
  repo: string;
  repoUrl: string;
  prUrl: string;
  title: string;
  mergedDate: string;
  description: { ko: string; en: string };
  whatChanged: { ko: string[]; en: string[] };
  whyItMatters: { ko: string; en: string };
  technicalDetail: { ko: string; en: string };
  relatedWork: { ko: string; en: string };
  relatedProjectUrl?: string;
  tags: string[];
  filesChanged?: number;
}

const ossPrsData: OssPrI18n[] = [
  {
    slug: "lorax-358",
    number: 358,
    repo: "predibase/lorax",
    repoUrl: "https://github.com/predibase/lorax",
    prUrl: "https://github.com/predibase/lorax/pull/358",
    title: "Chat Completion Stream Fix & API Improvements",
    mergedDate: "2024-03-27",
    description: {
      ko: "Chat completion stream의 마지막 delta 직렬화가 OpenAI client 표준과 다른 문제를 수정하고, /tokenize 엔드포인트 추가 및 Swagger 문서를 개선했다.",
      en: "Fixed the last delta serialization in chat completion stream to match OpenAI client standards, added a /tokenize endpoint, and improved Swagger documentation.",
    },
    whatChanged: {
      ko: [
        "Chat completion streaming 응답의 마지막 delta 직렬화를 OpenAI 클라이언트 호환 형식으로 수정",
        "/tokenize 엔드포인트를 추가하여 토큰 카운팅 기능 제공",
        "Swagger/OpenAPI 문서 개선",
      ],
      en: [
        "Fixed last delta serialization in chat completion streaming to be OpenAI client-compatible",
        "Added /tokenize endpoint for token counting functionality",
        "Improved Swagger/OpenAPI documentation",
      ],
    },
    whyItMatters: {
      ko: "OpenAI 호환 클라이언트 라이브러리(Python openai SDK 등)가 LoRAX 서버와 통신할 때 stream 종료 시점에서 파싱 오류가 발생하는 문제였다. 이 수정으로 OpenAI SDK를 그대로 사용하면서 LoRAX로 backend만 교체하는 구성이 안정화됐다.",
      en: "OpenAI-compatible client libraries (e.g., Python openai SDK) encountered parsing errors at stream termination when communicating with LoRAX servers. This fix stabilized configurations where OpenAI SDK is used as-is with only the backend swapped to LoRAX.",
    },
    technicalDetail: {
      ko: "Rust 기반 router 레이어(router/src/lib.rs, router/src/server.rs)에서 streaming chat completion의 마지막 chunk가 OpenAI의 [DONE] 프로토콜과 다르게 직렬화되는 문제를 수정했다. 내부 fork(repo:cbf2b99b35c1#6)에서 2024-03-21 먼저 수정한 뒤, 같은 변경을 upstream에 PR로 제출했다. LoRAX는 S-LoRA(Sheng et al., MLSys 2024)와 Punica(Chen et al., MLSys 2024)의 멀티 LoRA 서빙 연구를 실전 프레임워크로 구현한 시스템이다.",
      en: "Fixed the Rust-based router layer (router/src/lib.rs, router/src/server.rs) where the last chunk of streaming chat completion was serialized differently from OpenAI's [DONE] protocol. First fixed in internal fork (repo:cbf2b99b35c1#6) on 2024-03-21, then submitted the same change upstream as a PR. LoRAX is a production framework implementing multi-LoRA serving research from S-LoRA (Sheng et al., MLSys 2024) and Punica (Chen et al., MLSys 2024).",
    },
    relatedWork: {
      ko: "내부 fork에서 먼저 문제를 해결(2024-03-21)한 뒤 upstream에 기여(2024-03-27). 내부 LoRAX 서빙 환경에서 OpenAI 호환 클라이언트를 사용하기 위한 선결 조건이었다.",
      en: "Fixed in internal fork first (2024-03-21) then contributed upstream (2024-03-27). This was a prerequisite for using OpenAI-compatible clients with the internal LoRAX serving environment.",
    },
    relatedProjectUrl: "/projects/legal-ai-contract-review",
    tags: ["Rust", "Streaming", "OpenAI API", "Bug Fix"],
  },
  {
    slug: "lorax-374",
    number: 374,
    repo: "predibase/lorax",
    repoUrl: "https://github.com/predibase/lorax",
    prUrl: "https://github.com/predibase/lorax/pull/374",
    title: "Seed Parameter Support",
    mergedDate: "2024-04-03",
    description: {
      ko: "OpenAI 호환 엔드포인트에 seed 파라미터를 추가하여 결정론적(deterministic) 생성을 가능하게 했다.",
      en: "Added seed parameter to OpenAI-compatible endpoints to enable deterministic generation.",
    },
    whatChanged: {
      ko: [
        "OpenAI 호환 chat/completion 엔드포인트에 seed 파라미터 지원 추가",
        "동일 seed 입력 시 동일 출력을 보장하는 결정론적 생성 활성화",
      ],
      en: [
        "Added seed parameter support to OpenAI-compatible chat/completion endpoints",
        "Enabled deterministic generation guaranteeing identical output for the same seed input",
      ],
    },
    whyItMatters: {
      ko: "모델 평가, 회귀 테스트, 품질 비교 실험에서 동일한 입력에 대해 재현 가능한 결과가 필요했다. seed 지원 없이는 동일 프롬프트에도 매번 다른 출력이 나와 정량 비교가 어려웠다. LoRA Land(Zhao et al., 2024)에서 310개 모델 × 31개 태스크를 평가할 때도 재현 가능한 생성이 핵심 전제였다.",
      en: "Reproducible results for identical inputs were essential for model evaluation, regression testing, and quality comparison experiments. Without seed support, the same prompt produced different outputs each time, making quantitative comparison difficult. Reproducible generation was also a core prerequisite when LoRA Land (Zhao et al., 2024) evaluated 310 models × 31 tasks.",
    },
    technicalDetail: {
      ko: "OpenAI API spec의 seed 파라미터를 LoRAX의 Rust router에서 받아 sampling 레이어로 전달하도록 구현했다. 같은 날 내부 레포에 seed: 42 기반 deterministic_test.py/json을 추가하여 original vs improved 엔드포인트의 일관성을 검증했다.",
      en: "Implemented passing the OpenAI API spec's seed parameter from LoRAX's Rust router to the sampling layer. On the same day, added seed: 42-based deterministic_test.py/json to internal repo to verify consistency between original vs improved endpoints.",
    },
    relatedWork: {
      ko: "같은 날(2024-04-03) 내부 레포에 deterministic test를 추가해 upstream 기능과 내부 검증을 동시에 완성. 이후 모델 평가 파이프라인에서 seed 기반 재현 가능한 생성을 활용했다.",
      en: "On the same day (2024-04-03), added deterministic tests to internal repo, completing both upstream feature and internal verification simultaneously. Subsequently used seed-based reproducible generation in the model evaluation pipeline.",
    },
    relatedProjectUrl: "/projects/legal-ai-contract-review",
    tags: ["Rust", "Deterministic", "Evaluation", "Feature"],
  },
  {
    slug: "lorax-506",
    number: 506,
    repo: "predibase/lorax",
    repoUrl: "https://github.com/predibase/lorax",
    prUrl: "https://github.com/predibase/lorax/pull/506",
    title: "Streaming Usage Information",
    mergedDate: "2024-06-11",
    description: {
      ko: "Streaming chat completion 응답에 token usage 정보(prompt_tokens, completion_tokens, total_tokens)를 반환하도록 했다.",
      en: "Added token usage information (prompt_tokens, completion_tokens, total_tokens) to streaming chat completion responses.",
    },
    whatChanged: {
      ko: [
        "Streaming chat completion 응답의 마지막 chunk에 usage 필드 추가",
        "OpenAI의 stream_options.include_usage 동작과 호환되는 토큰 사용량 리포팅",
      ],
      en: [
        "Added usage field to the last chunk of streaming chat completion responses",
        "Token usage reporting compatible with OpenAI's stream_options.include_usage behavior",
      ],
    },
    whyItMatters: {
      ko: "Self-hosted LLM 서빙에서도 API 호출당 토큰 사용량을 추적해야 비용 관리와 모니터링이 가능하다. 기존에는 stream 모드에서 usage 정보가 누락되어 별도 토큰 카운팅 로직이 필요했다.",
      en: "Even in self-hosted LLM serving, per-API-call token usage tracking is essential for cost management and monitoring. Previously, usage information was missing in stream mode, requiring separate token counting logic.",
    },
    technicalDetail: {
      ko: "Rust router의 streaming response handler에서 generation 완료 시점에 prompt_tokens, completion_tokens, total_tokens를 집계하여 마지막 SSE chunk에 포함시켰다. OpenAI API의 stream_options 규격에 맞춘 구현이다. vLLM의 PagedAttention(Kwon et al., SOSP 2023)과 같은 서빙 시스템에서 토큰 사용량 추적은 KV 캐시 메모리 관리와 비용 모니터링의 기반이 된다.",
      en: "In the Rust router's streaming response handler, aggregated prompt_tokens, completion_tokens, and total_tokens at generation completion and included them in the last SSE chunk. Implementation follows OpenAI API's stream_options specification. In serving systems like vLLM's PagedAttention (Kwon et al., SOSP 2023), token usage tracking is foundational for KV cache memory management and cost monitoring.",
    },
    relatedWork: {
      ko: "내부 LLM middleware에서 task/workspace 단위 토큰 사용량 추적에 활용 가능한 기반이 됐다. 다만 이 PR의 직접적인 내부 rollout artifact는 현재 확인되지 않는다.",
      en: "Provided the foundation for task/workspace-level token usage tracking in the internal LLM middleware. However, direct internal rollout artifacts from this specific PR are not currently confirmed.",
    },
    relatedProjectUrl: "/projects/workflow-platform-agent-tooling",
    tags: ["Rust", "Streaming", "Token Accounting", "Feature"],
  },
  {
    slug: "lorax-644",
    number: 644,
    repo: "predibase/lorax",
    repoUrl: "https://github.com/predibase/lorax",
    prUrl: "https://github.com/predibase/lorax/pull/644",
    title: "Structured Output Support",
    mergedDate: "2024-10-16",
    description: {
      ko: "response_format 파라미터로 text, json_object, json_schema를 지원하여 OpenAI의 structured output 인터페이스와 호환성을 강화했다.",
      en: "Added support for text, json_object, and json_schema via the response_format parameter, strengthening compatibility with OpenAI's structured output interface.",
    },
    whatChanged: {
      ko: [
        "response_format 파라미터에 text, json_object, json_schema 타입 지원 추가",
        "OpenAI structured output API와의 호환성 강화로 provider 전환 비용 절감",
      ],
      en: [
        "Added text, json_object, json_schema type support to the response_format parameter",
        "Reduced provider switching costs through enhanced OpenAI structured output API compatibility",
      ],
    },
    whyItMatters: {
      ko: "Structured output은 LLM 응답을 JSON schema에 맞게 강제하는 기능으로, 계약서 분류, 체크리스트 생성 같은 구조화된 결과가 필요한 task에서 필수적이다. LoRAX에서 이를 지원함으로써 OpenAI와 self-hosted 서빙 간 코드 변경 없이 전환할 수 있게 됐다. Grammar-Aligned Decoding(Park et al., 2024)에서 이론적으로 분석된 constrained decoding 기법을 서빙 인터페이스 수준에서 구현한 것이다.",
      en: "Structured output forces LLM responses to conform to a JSON schema — essential for tasks requiring structured results like contract classification and checklist generation. Supporting this in LoRAX enabled switching between OpenAI and self-hosted serving without code changes. This implemented constrained decoding techniques theoretically analyzed in Grammar-Aligned Decoding (Park et al., 2024) at the serving interface level.",
    },
    technicalDetail: {
      ko: "OpenAI API spec의 response_format 필드를 LoRAX router에서 파싱하고, json_schema 모드에서는 제공된 schema에 따라 guided decoding을 수행하도록 구현했다. 머지 다음 날(2024-10-17) 내부 registry의 LoRAX 이미지를 새 버전으로 갱신하고, image repository 선택 기능도 추가했다.",
      en: "Parsed the OpenAI API spec's response_format field in the LoRAX router and implemented guided decoding according to the provided schema in json_schema mode. The day after merge (2024-10-17), updated the LoRAX image in the internal registry to the new version and added image repository selection functionality.",
    },
    relatedWork: {
      ko: "내부에서는 contract type classification, playbook generation, legal document drafting, widget response 등에 structured output을 적용했다. 이 PR 이후 내부 middleware에서 OpenAI/Azure/LoRAX 간 response_format 인터페이스를 통일하는 작업이 진행됐다.",
      en: "Internally applied structured output to contract type classification, playbook generation, legal document drafting, and widget responses. After this PR, work proceeded to unify the response_format interface across OpenAI/Azure/LoRAX in the internal middleware.",
    },
    relatedProjectUrl: "/projects/ai-evaluation-system",
    tags: ["Rust", "Structured Output", "JSON Schema", "Feature"],
  },
];

export function getOssPrs(locale: Locale): OssPr[] {
  return ossPrsData.map((pr) => ({
    slug: pr.slug,
    number: pr.number,
    repo: pr.repo,
    repoUrl: pr.repoUrl,
    prUrl: pr.prUrl,
    title: pr.title,
    mergedDate: pr.mergedDate,
    description: pr.description[locale],
    whatChanged: pr.whatChanged[locale],
    whyItMatters: pr.whyItMatters[locale],
    technicalDetail: pr.technicalDetail[locale],
    relatedWork: pr.relatedWork[locale],
    relatedProjectUrl: pr.relatedProjectUrl,
    tags: pr.tags,
    filesChanged: pr.filesChanged,
  }));
}

/** @deprecated Use getOssPrs(locale) instead */
export const ossPrs: OssPr[] = getOssPrs("ko");
