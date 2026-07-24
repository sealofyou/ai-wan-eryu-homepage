import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const skillShare = readFileSync(
  new URL("../src/content/notes/2026-07-04-skill-share.md", import.meta.url),
  "utf8",
);

describe("approved public content", () => {
  it("publishes the confirmed 0704 Skill share through its public Feishu activity page", () => {
    expect(skillShare).toContain("draft: false");
    expect(skillShare).toContain('target: "feishu"');
    expect(skillShare).toContain(
      'externalUrl: "https://my.feishu.cn/wiki/Rt9qwrsRNi0mDnkOggsc8rPxnof"',
    );
    expect(skillShare).toContain("Meteor Defender");
  });
});
