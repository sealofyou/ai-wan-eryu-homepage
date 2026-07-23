export type NoteFilter = "all" | "share" | "activity" | "project" | "note";

import type {
  ContentSectionId,
  ContentTarget,
  DesktopContentItem,
  DesktopContentPayload,
} from "../desktop/content";
import { resolveContentUrl } from "../desktop/content";

type DatedEntry = {
  data: {
    date: Date;
  };
};

type TypedEntry = {
  data: {
    type: string;
  };
};

export function sortByDateDesc<T extends DatedEntry>(entries: readonly T[]): T[] {
  return [...entries].sort((a, b) => b.data.date.getTime() - a.data.date.getTime());
}

export function filterNotesByType<T extends TypedEntry>(entries: readonly T[], filter: NoteFilter): T[] {
  if (filter === "all") return [...entries];
  return entries.filter((entry) => entry.data.type === filter);
}

export function formatDate(date: Date, includeDay = true): string {
  const options: Intl.DateTimeFormatOptions = includeDay
    ? { year: "numeric", month: "2-digit", day: "2-digit" }
    : { year: "numeric", month: "2-digit" };

  return new Intl.DateTimeFormat("zh-CN", options).format(date).replaceAll("/", ".");
}

type DesktopContentData = {
  title: string;
  description: string;
  preview?: string;
  date: Date;
  category?: string;
  type?: string;
  draft?: boolean;
  featured?: boolean;
  location?: string;
  cover?: string;
  target?: ContentTarget;
  externalUrl?: string;
  internalUrl?: string;
};

type DesktopContentEntry = {
  id: string;
  data: DesktopContentData;
};

export function createDesktopContentItem(
  section: ContentSectionId,
  entry: DesktopContentEntry,
): DesktopContentItem | null {
  const { data } = entry;
  if (data.draft || !data.target) return null;

  const item: DesktopContentItem = {
    id: entry.id,
    section,
    title: data.title.trim(),
    date: data.date.toISOString().slice(0, 10),
    description: data.description.trim(),
    preview: data.preview?.trim() || data.description.trim(),
    category: data.category?.trim() || data.type?.trim(),
    location: data.location?.trim(),
    cover: data.cover?.trim(),
    externalUrl: data.externalUrl?.trim(),
    internalUrl: data.internalUrl?.trim(),
    target: data.target,
    featured: data.featured ?? false,
  };

  return resolveContentUrl(item) ? item : null;
}

export function serializeDesktopContentPayload(payload: DesktopContentPayload): string {
  return JSON.stringify(payload)
    .replaceAll("<", "\\u003c")
    .replaceAll(">", "\\u003e")
    .replaceAll("&", "\\u0026")
    .replaceAll("\u2028", "\\u2028")
    .replaceAll("\u2029", "\\u2029");
}
