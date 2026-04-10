import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";

const projects = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/projects" }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    tags: z.array(z.string()).default([]),
    href: z.string().url().optional(),
    repoUrl: z.string().url().optional(),
    featured: z.boolean().default(false),
    order: z.number().default(0),
    locale: z.enum(["en", "ko"]).default("en"),
    image: z.string().optional(),
    period: z.string().optional(),
    organization: z.string().optional(),
    role: z.string().optional(),
  }),
});

const skills = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/skills" }),
  schema: z.object({
    name: z.string(),
    description: z.string().optional(),
    category: z.enum(["ai-ml", "llm-app", "model-training", "model-eval", "model-serving", "ml-framework", "backend-api", "gpu-infra", "data-engineering", "tools", "language", "collaboration", "domain", "service-planning", "other"]),
    level: z.enum(["beginner", "intermediate", "advanced", "expert"]).optional(),
    order: z.number().default(0),
    locale: z.enum(["en", "ko"]).default("en"),
    layer: z.enum(["infrastructure", "infrastructure-serving", "chips", "models-foundation", "models-domain", "models-evaluation", "applications", "applications-agent", "cross-cutting", "cross-cutting-collab"]).optional(),
    layerOrder: z.number().optional(),
  }),
});

const achievements = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/achievements" }),
  schema: z.object({
    title: z.string(),
    category: z.enum(["patent", "award", "certification", "speaking", "competition", "opensource"]),
    date: z.string(),
    description: z.string(),
    url: z.string().url().optional(),
    image: z.string().optional(),
    issuer: z.string().optional(),
    order: z.number().default(0),
    locale: z.enum(["en", "ko"]).default("ko"),
  }),
});

export const collections = { projects, skills, achievements };
