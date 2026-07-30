import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  findReleaseCandidateIssues,
  resolveOutputReference,
} from "../scripts/check-release-candidate.mjs";

const temporaryDirectories = [];

const createSite = (files) => {
  const directory = mkdtempSync(join(tmpdir(), "eryu-release-candidate-"));
  temporaryDirectories.push(directory);

  for (const [relativePath, content] of Object.entries(files)) {
    const outputPath = join(directory, relativePath);
    mkdirSync(dirname(outputPath), { recursive: true });
    writeFileSync(outputPath, content, "utf8");
  }

  return directory;
};

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("release candidate output references", () => {
  it("resolves routes, assets, query strings, and fragments inside dist", () => {
    const distDirectory = createSite({
      "index.html": "home",
      "notes/index.html": "notes",
      "_astro/app.js": "app",
    });

    expect(resolveOutputReference(distDirectory, "/")).toBe(
      join(distDirectory, "index.html"),
    );
    expect(resolveOutputReference(distDirectory, "/notes/?page=1#latest")).toBe(
      join(distDirectory, "notes", "index.html"),
    );
    expect(resolveOutputReference(distDirectory, "/_astro/app.js?v=1")).toBe(
      join(distDirectory, "_astro", "app.js"),
    );
    expect(resolveOutputReference(distDirectory, "https://example.com")).toBeNull();
  });

  it("maps the canonical /404/ route to Astro's 404.html output", () => {
    const distDirectory = createSite({
      "404.html": '<link rel="canonical" href="https://eryu.fun/404/">',
    });

    expect(
      resolveOutputReference(
        distDirectory,
        "https://eryu.fun/404/",
        join(distDirectory, "404.html"),
      ),
    ).toBe(join(distDirectory, "404.html"));
  });
});

describe("release candidate output audit", () => {
  it("accepts a complete static site with safe internal and external links", () => {
    const distDirectory = createSite({
      "index.html": `
        <a href="/notes/">笔记</a>
        <a href="/projects/demo/">项目</a>
        <a href="/home/">合法的站内首页路由</a>
        <script src="/_astro/app.js"></script>
        <img data-src="/desktop/fallback.png" alt="">
        <a href="https://example.com" target="_blank" rel="noopener noreferrer">外链</a>
      `,
      "home/index.html": '<a href="/">返回</a>',
      "notes/index.html": '<a href="/">返回</a>',
      "portfolio/index.html": '<a href="/">返回</a>',
      "projects/demo/index.html": '<a href="/">返回</a>',
      "_astro/app.js": "console.log('ready')",
      "desktop/fallback.png": "fixture",
    });

    expect(
      findReleaseCandidateIssues({
        distDirectory,
        requiredRoutes: ["/", "/notes/", "/portfolio/", "/projects/demo/"],
      }),
    ).toEqual([]);
  });

  it("reports missing routes, broken resources, local data, and unsafe new windows", () => {
    const distDirectory = createSite({
      "index.html": `
        <a href="/missing/">断开的页面</a>
        <img data-src="/desktop/missing.png" alt="">
        <a href=https://example.com target=_blank>不安全外链</a>
        <p>E:\\workspace\\private\\notes.md</p>
        <script>const api_key = "not-a-real-secret";</script>
      `,
    });

    const issueCodes = findReleaseCandidateIssues({
      distDirectory,
      requiredRoutes: ["/", "/projects/demo/"],
    }).map(({ code }) => code);

    expect(issueCodes).toContain("missing-required-route");
    expect(issueCodes).toContain("broken-reference");
    expect(issueCodes).toContain("local-path");
    expect(issueCodes).toContain("credential-shape");
    expect(issueCodes).toContain("unsafe-blank-target");
  });

  it("does not treat external, hash, mail, phone, or data URLs as local files", () => {
    const distDirectory = createSite({
      "index.html": `
        <a href="https://example.com">网站</a>
        <a href="#section">页内位置</a>
        <a href="mailto:hello@example.com">邮件</a>
        <a href="tel:+861234567890">电话</a>
        <img src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP" alt="">
      `,
    });

    expect(
      findReleaseCandidateIssues({
        distDirectory,
        requiredRoutes: ["/"],
      }),
    ).toEqual([]);
  });

  it("checks responsive image candidates and CSS asset references", () => {
    const distDirectory = createSite({
      "index.html": `
        <link rel="stylesheet" href="/site.css">
        <img srcset="/desktop/available.png 1x, /desktop/missing.png 2x" alt="">
      `,
      "site.css": "body { background-image: url('/desktop/missing-bg.png'); }",
      "desktop/available.png": "fixture",
    });

    const details = findReleaseCandidateIssues({
      distDirectory,
      requiredRoutes: ["/"],
    }).map(({ detail }) => detail);

    expect(details).toContain("Missing output for /desktop/missing.png");
    expect(details).toContain("Missing output for /desktop/missing-bg.png");
  });

  it("resolves relative HTML and CSS references from their containing file", () => {
    const distDirectory = createSite({
      "index.html": '<a href="shares/demo/">分享</a>',
      "shares/demo/index.html": `
        <link rel=stylesheet href=assets/site.css>
        <img src=assets/available.png alt="">
        <img src=assets/missing.png alt="">
      `,
      "shares/demo/assets/site.css":
        "body { background-image: url('../screens/missing-bg.png'); }",
      "shares/demo/assets/available.png": "fixture",
    });

    const details = findReleaseCandidateIssues({
      distDirectory,
      requiredRoutes: ["/"],
    }).map(({ detail }) => detail);

    expect(details).toContain("Missing output for assets/missing.png");
    expect(details).toContain("Missing output for ../screens/missing-bg.png");
  });

  it("detects common credential assignments, private keys, and token prefixes", () => {
    const distDirectory = createSite({
      "index.html": "home",
      "secrets/client.js": 'const client_secret = "client-secret-value";',
      "secrets/aws.js":
        'const AWS_SECRET_ACCESS_KEY = "aws-secret-access-key-value";',
      "secrets/private-key.txt":
        "-----BEGIN PRIVATE KEY-----\nnot-a-real-key\n-----END PRIVATE KEY-----",
      "secrets/token.js": 'window.value = "sk-not-a-real-token-1234567890";',
    });

    const credentialFiles = findReleaseCandidateIssues({
      distDirectory,
      requiredRoutes: ["/"],
    })
      .filter(({ code }) => code === "credential-shape")
      .map(({ file }) => file)
      .sort();

    expect(credentialFiles).toEqual([
      join("secrets", "aws.js"),
      join("secrets", "client.js"),
      join("secrets", "private-key.txt"),
      join("secrets", "token.js"),
    ]);
  });

  it("detects loopback URLs and UNC paths without flagging a /home/ route", () => {
    const distDirectory = createSite({
      "index.html": '<a href="/home/">首页</a>',
      "home/index.html": "home",
      "diagnostics.txt": `
        http://0.0.0.0:4321
        http://[::1]:4321
        \\\\server\\private-share\\notes.md
      `,
    });

    const issues = findReleaseCandidateIssues({
      distDirectory,
      requiredRoutes: ["/", "/home/"],
    });

    expect(issues.filter(({ code }) => code === "local-url")).toHaveLength(1);
    expect(issues.filter(({ code }) => code === "local-path")).toHaveLength(1);
    expect(issues.some(({ file }) => file === "index.html")).toBe(false);
  });

  it("does not parse inline JavaScript property assignments as HTML attributes", () => {
    const distDirectory = createSite({
      "index.html": `
        <script>
          const image = {};
          image.src = dynamicValue;
        </script>
      `,
    });

    expect(
      findReleaseCandidateIssues({
        distDirectory,
        requiredRoutes: ["/"],
      }),
    ).toEqual([]);
  });

  it("does not treat a minified backslash key label as a UNC path", () => {
    const distDirectory = createSite({
      "index.html": "home",
      "assets/keyboard.js": 'const keys=["\\\\","typing",14.25,"/"];',
    });

    expect(
      findReleaseCandidateIssues({
        distDirectory,
        requiredRoutes: ["/"],
      }),
    ).toEqual([]);
  });

  it("reports malformed and escaping same-origin references", () => {
    const distDirectory = createSite({
      "index.html": `
        <a href="/..%2Fmissing.html">escaping path</a>
        <img src="/%E0%A4%A" alt="">
      `,
    });

    const invalidReferences = findReleaseCandidateIssues({
      distDirectory,
      requiredRoutes: ["/"],
    }).filter(({ code }) => code === "invalid-reference");

    expect(invalidReferences).toHaveLength(2);
  });

  it("parses quoted angle brackets without reading JavaScript inside attributes", () => {
    const distDirectory = createSite({
      "index.html": `
        <button onclick="image.src=dynamicValue">dynamic image</button>
        <a title="1 > 0" href=https://example.com target=_blank>external</a>
      `,
    });

    const issues = findReleaseCandidateIssues({
      distDirectory,
      requiredRoutes: ["/"],
    });

    expect(issues.filter(({ code }) => code === "broken-reference")).toEqual([]);
    expect(issues.filter(({ code }) => code === "unsafe-blank-target")).toHaveLength(
      1,
    );
  });

  it("checks CSS imports and inline styles while ignoring comments", () => {
    const distDirectory = createSite({
      "index.html": `
        <link rel="stylesheet" href="/site.css">
        <style>
          @import "styles/missing-inline.css";
          .hero { background: url("images/missing-inline.png"); }
        </style>
        <div style="background: url('images/missing-attribute.png')"></div>
      `,
      "site.css": `
        /* url("ignored-comment.png") */
        @import "missing-import.css";
        .real { background-image: url("missing-image.png"); }
      `,
    });

    const details = findReleaseCandidateIssues({
      distDirectory,
      requiredRoutes: ["/"],
    }).map(({ detail }) => detail);

    expect(details).toContain("Missing output for styles/missing-inline.css");
    expect(details).toContain("Missing output for images/missing-inline.png");
    expect(details).toContain("Missing output for images/missing-attribute.png");
    expect(details).toContain("Missing output for missing-import.css");
    expect(details).toContain("Missing output for missing-image.png");
    expect(details).not.toContain("Missing output for ignored-comment.png");
  });

  it("requires exact file identity without rejecting dot-prefixed names", () => {
    const distDirectory = createSite({
      "index.html": `
        <a href="/..release">valid dot-prefixed file</a>
        <img src="/ASSETS/LOGO.PNG" alt="">
        <script src="/bundle.js"></script>
      `,
      "..release": "valid",
      "assets/logo.png": "image",
      "bundle.js/placeholder.txt": "directory",
    });

    const issues = findReleaseCandidateIssues({
      distDirectory,
      requiredRoutes: ["/"],
    });
    const brokenDetails = issues
      .filter(({ code }) => code === "broken-reference")
      .map(({ detail }) => detail);

    expect(issues.some(({ detail }) => detail.includes("..release"))).toBe(false);
    expect(brokenDetails).toContain("Missing output for /ASSETS/LOGO.PNG");
    expect(brokenDetails).toContain("Missing output for /bundle.js");
  });

  it("honors raw-text endings, character references, and the document base URL", () => {
    const distDirectory = createSite({
      "index.html": `
        <base href="/nested/">
        <script>
          const sample = "</scripture><img src='/missing.png'>";
        </script>
        <a href="https://example.com" target="&#95;blank">external</a>
        <div style="background:url(&quot;existing.png&quot;)"></div>
        <img src="base-image.png" alt="">
      `,
      "nested/existing.png": "image",
      "nested/base-image.png": "image",
    });

    const issues = findReleaseCandidateIssues({
      distDirectory,
      requiredRoutes: ["/"],
    });

    expect(issues.filter(({ code }) => code === "broken-reference")).toEqual([]);
    expect(issues.filter(({ code }) => code === "unsafe-blank-target")).toHaveLength(
      1,
    );
  });

  it("ignores CSS strings and decodes escaped resource URLs", () => {
    const distDirectory = createSite({
      "index.html": '<link rel="stylesheet" href="/site.css">',
      "site.css": `
        .demo::before {
          content: 'url("missing.png") @import "missing.css"';
        }
        @import "actual.css";
        .hero { background: url("im\\61 ge.png"); }
      `,
      "actual.css": "body {}",
      "image.png": "image",
    });

    expect(
      findReleaseCandidateIssues({
        distDirectory,
        requiredRoutes: ["/"],
      }),
    ).toEqual([]);
  });

  it("keeps data URL commas intact while parsing srcset candidates", () => {
    const distDirectory = createSite({
      "index.html": `
        <img
          srcset="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP 1x, /available.png 2x"
          alt=""
        >
      `,
      "available.png": "image",
    });

    expect(
      findReleaseCandidateIssues({
        distDirectory,
        requiredRoutes: ["/"],
      }),
    ).toEqual([]);
  });

  it("does not follow a junction outside the build output", () => {
    const externalDirectory = mkdtempSync(
      join(tmpdir(), "eryu-release-external-"),
    );
    temporaryDirectories.push(externalDirectory);
    writeFileSync(join(externalDirectory, "secret.txt"), "outside", "utf8");

    const distDirectory = createSite({
      "index.html": '<a href="/escape/secret.txt">outside</a>',
    });
    symlinkSync(externalDirectory, join(distDirectory, "escape"), "junction");

    const brokenDetails = findReleaseCandidateIssues({
      distDirectory,
      requiredRoutes: ["/"],
    })
      .filter(({ code }) => code === "broken-reference")
      .map(({ detail }) => detail);

    expect(brokenDetails).toContain("Missing output for /escape/secret.txt");
  });

  it("applies base targets to anchors and areas using HTML whitespace rules", () => {
    const distDirectory = createSite({
      "index.html": `
        <base target="_blank">
        <a href="https://example.com">inherited target</a>
        <area href="https://example.com/map" target="&#95blank">
        <a
          href="https://example.com/nbsp"
          target="_blank"
          rel="noopener\u00a0noreferrer"
        >non-ASCII separator</a>
      `,
    });

    const unsafeLinks = findReleaseCandidateIssues({
      distDirectory,
      requiredRoutes: ["/"],
    }).filter(({ code }) => code === "unsafe-blank-target");

    expect(unsafeLinks).toHaveLength(3);
  });

  it("does not parse script double-escaped or RCDATA content as elements", () => {
    const distDirectory = createSite({
      "index.html": `
        <script>
          <!--<script></script><img src="/missing-double.png">-->
        </script>
        <textarea><img src="/missing-textarea.png"></textarea>
        <title><img src="/missing-title.png"></title>
      `,
    });

    expect(
      findReleaseCandidateIssues({
        distDirectory,
        requiredRoutes: ["/"],
      }),
    ).toEqual([]);
  });

  it("decodes CSS identifiers without accepting invalid URL functions", () => {
    const distDirectory = createSite({
      "index.html": '<link rel="stylesheet" href="/site.css">',
      "site.css": `
        @\\69mport "missing-import.css";
        .real { background: u\\72 l("missing-image.png"); }
        .space { background: url ("ignored-space.png"); }
        .prefix { value: éurl("ignored-prefix.png"); }
      `,
    });

    const brokenDetails = findReleaseCandidateIssues({
      distDirectory,
      requiredRoutes: ["/"],
    })
      .filter(({ code }) => code === "broken-reference")
      .map(({ detail }) => detail);

    expect(brokenDetails).toContain("Missing output for missing-import.css");
    expect(brokenDetails).toContain("Missing output for missing-image.png");
    expect(brokenDetails).not.toContain("Missing output for ignored-space.png");
    expect(brokenDetails).not.toContain("Missing output for ignored-prefix.png");
  });

  it("rejects every symbolic link in the release output, even when unreferenced", () => {
    const externalDirectory = mkdtempSync(
      join(tmpdir(), "eryu-release-external-unreferenced-"),
    );
    temporaryDirectories.push(externalDirectory);
    writeFileSync(
      join(externalDirectory, "credentials.txt"),
      'api_key = "not-a-real-secret"',
      "utf8",
    );

    const distDirectory = createSite({ "index.html": "home" });
    symlinkSync(
      externalDirectory,
      join(distDirectory, "unreferenced-leak"),
      "junction",
    );

    expect(
      findReleaseCandidateIssues({
        distDirectory,
        requiredRoutes: ["/"],
      }),
    ).toContainEqual(
      expect.objectContaining({
        code: "unsafe-output-link",
        file: "unreferenced-leak",
      }),
    );
  });

  it("decodes security-relevant named references with HTML case rules", () => {
    const distDirectory = createSite({
      "index.html": `
        <a href="https://example.com/unsafe" target="&UnderBar;blank">unsafe</a>
        <a
          href="https://example.com/safe"
          target="_blank"
          rel="noopener&Tab;noreferrer"
        >safe</a>
        <a href="https://example.com/not-blank" target="&LOWBAR;blank">ordinary</a>
      `,
    });

    const unsafeLinks = findReleaseCandidateIssues({
      distDirectory,
      requiredRoutes: ["/"],
    }).filter(({ code }) => code === "unsafe-blank-target");

    expect(unsafeLinks).toHaveLength(1);
  });

  it("handles comment end-bang syntax and consumes unterminated raw text", () => {
    const distDirectory = createSite({
      "index.html": `
        <!-- comment --!><img src="/missing-real.png" alt="">
        <textarea><img src="/ignored-textarea.png" alt="">
      `,
    });

    const brokenDetails = findReleaseCandidateIssues({
      distDirectory,
      requiredRoutes: ["/"],
    })
      .filter(({ code }) => code === "broken-reference")
      .map(({ detail }) => detail);

    expect(brokenDetails).toContain("Missing output for /missing-real.png");
    expect(brokenDetails).not.toContain("Missing output for /ignored-textarea.png");
  });

  it("audits video posters, object data, link image candidates, and CSS image sets", () => {
    const distDirectory = createSite({
      "index.html": `
        <video poster="/missing-poster.png"></video>
        <object data="/missing-object.svg"></object>
        <link rel="preload" imagesrcset="/missing-link-1.png 1x, /missing-link-2.png 2x">
        <link rel="stylesheet" href="/site.css">
      `,
      "site.css": `
        .hero {
          background-image: image-set("missing-image-set.png" 1x);
        }
      `,
    });

    const brokenDetails = findReleaseCandidateIssues({
      distDirectory,
      requiredRoutes: ["/"],
    })
      .filter(({ code }) => code === "broken-reference")
      .map(({ detail }) => detail);

    expect(brokenDetails).toEqual(
      expect.arrayContaining([
        "Missing output for /missing-poster.png",
        "Missing output for /missing-object.svg",
        "Missing output for /missing-link-1.png",
        "Missing output for /missing-link-2.png",
        "Missing output for missing-image-set.png",
      ]),
    );
  });

  it("follows CSS bad escape and bad string recovery before later URLs", () => {
    const distDirectory = createSite({
      "index.html": '<link rel="stylesheet" href="/site.css">',
      "site.css": `
        .not-a-url { background: u\\
rl("ignored.png"); }
        .broken-string { content: "unterminated
        ; background: url("missing-after-bad-string.png"); }
      `,
    });

    const brokenDetails = findReleaseCandidateIssues({
      distDirectory,
      requiredRoutes: ["/"],
    })
      .filter(({ code }) => code === "broken-reference")
      .map(({ detail }) => detail);

    expect(brokenDetails).toContain(
      "Missing output for missing-after-bad-string.png",
    );
    expect(brokenDetails).not.toContain("Missing output for ignored.png");
  });
});
