import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";

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

export const collections = { articles, notes };
