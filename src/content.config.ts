import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";

const publicHttpsUrl = z.url().refine(
  (value) => new URL(value).protocol === "https:",
  "Public URLs must use HTTPS",
);
const internalPath = z.string().regex(/^\/(?!\/)/, "Internal URLs must be root-relative");

const articles = defineCollection({
  loader: glob({ pattern: "**/*.{md,mdx}", base: "./src/content/articles" }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    date: z.coerce.date(),
    category: z.string(),
    draft: z.boolean().default(false),
    featured: z.boolean().default(false),
    preview: z.string().default(""),
    cover: z.string().optional(),
    target: z.enum(["feishu", "internal"]).optional(),
    externalUrl: z.url().optional(),
    internalUrl: z.string().optional(),
  }),
});

const notes = defineCollection({
  loader: glob({ pattern: "**/*.{md,mdx}", base: "./src/content/notes" }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    date: z.coerce.date(),
    type: z.enum(["share", "activity", "project", "note"]),
    draft: z.boolean().default(false),
    location: z.string().optional(),
    images: z.array(z.string()).default([]),
    preview: z.string().default(""),
    cover: z.string().optional(),
    target: z.enum(["feishu", "internal"]).optional(),
    externalUrl: z.url().optional(),
    internalUrl: z.string().optional(),
    featured: z.boolean().default(false),
  }),
});

const projects = defineCollection({
  loader: glob({ pattern: "**/*.{md,mdx}", base: "./src/content/projects" }),
  schema: z
    .object({
      title: z.string(),
      description: z.string(),
      date: z.coerce.date(),
      updated: z.coerce.date(),
      status: z.string(),
      phase: z.string(),
      category: z.string(),
      draft: z.boolean().default(false),
      featured: z.boolean().default(false),
      preview: z.string().default(""),
      target: z.literal("internal"),
      internalUrl: internalPath,
      cover: internalPath.optional(),
      coverAlt: z.string().optional(),
      repoUrl: publicHttpsUrl.optional(),
      results: z
        .array(
          z.object({
            label: z.string(),
            value: z.string(),
          }),
        )
        .default([]),
    })
    .refine(
      (data) => Boolean(data.cover) === Boolean(data.coverAlt?.trim()),
      {
        message: "Project cover and coverAlt must be provided together",
        path: ["coverAlt"],
      },
    ),
});

const projectUpdates = defineCollection({
  loader: glob({
    pattern: "**/*.{md,mdx}",
    base: "./src/content/project-updates",
  }),
  schema: z.object({
    title: z.string(),
    summary: z.string(),
    date: z.coerce.date(),
    projectId: z.string(),
    phase: z.string(),
    kind: z.enum(["decision", "implementation", "verification", "release"]),
    draft: z.boolean().default(false),
    highlights: z.array(z.string()).default([]),
    evidence: z
      .array(
        z.object({
          label: z.string(),
          url: publicHttpsUrl,
        }),
      )
      .default([]),
  }),
});

export const collections = { articles, notes, projects, projectUpdates };
