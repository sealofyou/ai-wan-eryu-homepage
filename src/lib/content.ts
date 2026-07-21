export type NoteFilter = "all" | "share" | "activity" | "project" | "note";

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
