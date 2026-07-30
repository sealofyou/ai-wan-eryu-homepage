# Homepage Content Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Connect real article and activity records to the accepted 3D desktop without changing its composition, then deploy the verified static build to `eryu.fun`.

**Architecture:** Astro reads content collections at build time and serializes a small public content index into the homepage. Pure TypeScript helpers own sorting, pagination and navigation state; `scene.ts` only renders that state into the existing side and main monitor canvases. Full content remains outside the 3D monitor and opens through a validated external or internal URL.

**Tech Stack:** Astro 7, TypeScript, Three.js canvas textures, Vitest, static deployment through the existing VPS2/Caddy scripts.

---

### Task 1: Content Domain And Navigation State

**Files:**
- Create: `src/desktop/content.ts`
- Modify: `src/desktop/model.ts`
- Create: `tests/desktop-content.test.ts`
- Modify: `tests/desktop-model.test.ts`

- [ ] **Step 1: Write failing tests for content sorting, pagination and state transitions**

Add tests that require:

```ts
expect(sortDesktopItems(items).map((item) => item.id)).toEqual(["new", "old"]);
expect(getContentPage(items, 0, 4)).toHaveLength(4);
expect(selectSection(state, "articles").contentView).toEqual({
  kind: "list",
  section: "articles",
  page: 0,
});
expect(selectContentItem(state, "article-1").contentView).toEqual({
  kind: "preview",
  section: "articles",
  itemId: "article-1",
});
```

- [ ] **Step 2: Run the focused tests and confirm the missing API fails**

Run: `npm test -- tests/desktop-content.test.ts tests/desktop-model.test.ts`

Expected: failure because the new content helpers and state transitions do not exist.

- [ ] **Step 3: Implement the minimal domain model**

Define:

```ts
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
```

Extend `DesktopState` with a discriminated `contentView` for home, list and preview states. Keep mouse, keyboard, quote, drawing and message state unchanged.

- [ ] **Step 4: Run focused and full tests**

Run: `npm test -- tests/desktop-content.test.ts tests/desktop-model.test.ts`

Expected: all focused tests pass.

Run: `npm test`

Expected: all existing tests remain green.

- [ ] **Step 5: Commit the domain layer**

Commit the tests and pure TypeScript changes using the Lore commit format.

### Task 2: Astro Content Schema And Public Index

**Files:**
- Modify: `src/content.config.ts`
- Modify: `src/pages/index.astro`
- Modify: `src/lib/content.ts`
- Modify: `tests/content-utils.test.ts`
- Modify: `tests/desktop-page.test.ts`
- Modify: `src/content/articles/*.md`
- Modify: `src/content/notes/*.md`

- [ ] **Step 1: Write failing tests for public content serialization**

Require the homepage to contain one JSON payload identified by `data-desktop-content`, and require the serializer to exclude drafts and records without a complete content target.

- [ ] **Step 2: Run focused tests and confirm they fail**

Run: `npm test -- tests/content-utils.test.ts tests/desktop-page.test.ts`

Expected: failure because the desktop content serializer and homepage payload do not exist.

- [ ] **Step 3: Extend content schemas conservatively**

Add optional/defaulted fields:

```ts
preview: z.string().default("")
cover: z.string().optional()
target: z.enum(["feishu", "internal"]).optional()
externalUrl: z.string().url().optional()
internalUrl: z.string().optional()
featured: z.boolean().default(false)
```

Keep existing content files compatible. Mark currently unapproved legacy articles and notes as drafts so the new desktop starts empty rather than exposing old material.

- [ ] **Step 4: Build the homepage content payload**

At Astro build time:

1. Read non-draft articles and activity/share notes.
2. Convert only records with a valid target URL into `DesktopContentItem` objects.
3. Sort them by date descending.
4. Serialize them into a safe JSON script block passed to `mountDesktopScene`.

- [ ] **Step 5: Run focused and full tests**

Run: `npm test -- tests/content-utils.test.ts tests/desktop-page.test.ts`

Expected: focused tests pass.

Run: `npm test`

Expected: all tests pass.

- [ ] **Step 6: Commit the content adapter**

Commit schema, serializer, homepage payload and draft-state changes using the Lore commit format.

### Task 3: Render Lists And Previews Inside Existing Screens

**Files:**
- Modify: `src/desktop/scene.ts`
- Modify: `src/pages/index.astro`
- Modify: `tests/desktop-page.test.ts`
- Create: `tests/desktop-scene-content.test.ts`

- [ ] **Step 1: Write failing source-level and behavior tests**

Require:

- Side screen labels for articles, activities and recent work.
- Main-screen list and preview render functions.
- Dynamic hit areas for visible list rows.
- A full-content action that resolves to a safe URL.
- Empty states when a section has no public records.

- [ ] **Step 2: Run focused tests and confirm they fail**

Run: `npm test -- tests/desktop-scene-content.test.ts tests/desktop-page.test.ts`

Expected: failure because the scene still uses the hard-coded activity array.

- [ ] **Step 3: Replace hard-coded demo content without changing geometry**

Keep all Three.js positions, rotations, materials, dimensions and camera logic unchanged. Replace only screen canvas drawing and invisible screen hit meshes:

- The three side cards select fixed sections.
- A section selection renders a paginated list on the main canvas.
- A list item selection renders a preview.
- Back returns preview to list, then list to home.
- `阅读全文` or `查看完整活动` opens the resolved URL in a new tab with `noopener,noreferrer`.
- No records renders a short honest empty state.

- [ ] **Step 4: Add wheel and on-screen pagination**

When the pointer intersects the main monitor and a list is active, wheel movement changes the page within bounds. Render previous/next controls in the current monitor style so pagination remains usable without a wheel.

- [ ] **Step 5: Run focused and full tests**

Run: `npm test -- tests/desktop-scene-content.test.ts tests/desktop-page.test.ts`

Expected: focused tests pass.

Run: `npm test`

Expected: the full suite passes.

- [ ] **Step 6: Commit the screen interaction**

Commit the scene integration using the Lore commit format, explicitly recording that geometry was intentionally preserved.

### Task 4: Static Verification And Visual Regression Check

**Files:**
- Modify if necessary: `tests/desk-layout.test.ts`
- Modify if necessary: `tests/desktop-page.test.ts`
- Create artifacts under: `output/playwright/`

- [ ] **Step 1: Run all automated verification**

Run:

```powershell
npm test
npm run check
npm run build
```

Expected: zero test failures, zero Astro/TypeScript errors and a successful static build.

- [ ] **Step 2: Capture the default desktop at three landscape sizes**

Capture `1366x768`, `2048x1024` and `2560x1080`. Compare the default state against the accepted current version and verify the desk, monitors, pegboards, keyboard, mouse and portrait have not shifted.

- [ ] **Step 3: Capture content states**

Capture article empty/list state, activity empty/list state and one preview state using controlled test data. Confirm text fits inside both monitors and controls do not overlap.

- [ ] **Step 4: Run visual verdict**

Persist the verdict to `.omx/state/homepage-content-integration/ralph-progress.json`. Continue correcting screen-only issues until the score is at least 90 without changing scene geometry.

- [ ] **Step 5: Commit verification fixes**

Commit only if verification required source changes.

### Task 5: Back Up And Deploy To eryu.fun

**Files:**
- Read: `DEPLOYMENT.md`
- Read: `deploy/publish-vps2.ps1`
- Read: `deploy/eryu.fun.caddy`
- Update only if required by verified deployment behavior.

- [ ] **Step 1: Confirm the deployment target**

Verify DNS and HTTPS for `eryu.fun`, the VPS2 SSH alias, Caddy document root and current deployed release path. Do not print credentials.

- [ ] **Step 2: Create a server-side rollback copy**

Before replacement, copy the current site release to a timestamped backup directory on VPS2 and verify the backup contains the existing index.

- [ ] **Step 3: Publish the verified `dist/` build**

Use the existing publishing script or its documented equivalent. Do not edit source files on the server.

- [ ] **Step 4: Verify production**

Check:

- `http://eryu.fun` redirects to HTTPS.
- `https://eryu.fun` returns 200.
- Static assets load without 404s.
- The default desktop renders.
- Side modules change only monitor content.
- Full-content targets open safely when present.

- [ ] **Step 5: Commit deployment documentation changes if any**

Do not commit generated `dist/` or credentials. Report the backup path and production verification evidence.
