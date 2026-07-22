const legacyRoutes: Record<string, string> = {
  "#home": "/",
  "#portfolio": "/portfolio/",
  "#notes": "/notes/",
};

export function legacyHashToPath(hash: string): string | null {
  return legacyRoutes[hash] ?? null;
}
