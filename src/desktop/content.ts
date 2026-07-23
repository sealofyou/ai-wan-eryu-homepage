export type ContentSectionId = "articles" | "activities" | "recent";
export type ContentTarget = "feishu" | "internal";

export interface DesktopContentItem {
  id: string;
  section: ContentSectionId;
  title: string;
  date: string;
  description: string;
  preview: string;
  category?: string;
  location?: string;
  cover?: string;
  externalUrl?: string;
  internalUrl?: string;
  target: ContentTarget;
  featured: boolean;
}

export interface DesktopContentPayload {
  items: DesktopContentItem[];
}

export interface ContentPage {
  items: DesktopContentItem[];
  page: number;
  pageCount: number;
}

export const sortDesktopItems = (
  items: readonly DesktopContentItem[],
): DesktopContentItem[] =>
  [...items].sort((left, right) => {
    if (left.featured !== right.featured) return left.featured ? -1 : 1;
    return right.date.localeCompare(left.date);
  });

export const getContentPage = (
  items: readonly DesktopContentItem[],
  requestedPage: number,
  pageSize: number,
): ContentPage => {
  const safeSize = Math.max(1, Math.floor(pageSize));
  const pageCount = Math.max(1, Math.ceil(items.length / safeSize));
  const page = Math.min(pageCount - 1, Math.max(0, Math.floor(requestedPage)));
  const start = page * safeSize;

  return {
    items: items.slice(start, start + safeSize),
    page,
    pageCount,
  };
};

export const resolveContentUrl = (item: DesktopContentItem): string | null => {
  const candidate = item.target === "internal" ? item.internalUrl : item.externalUrl;
  if (!candidate) return null;
  if (candidate.startsWith("/")) return candidate;

  try {
    const url = new URL(candidate);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
};
