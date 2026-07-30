import {
  existsSync,
  lstatSync,
  readFileSync,
  readdirSync,
  realpathSync,
  statSync,
} from "node:fs";
import {
  extname,
  isAbsolute,
  join,
  relative,
  resolve,
  sep,
} from "node:path";
import { pathToFileURL } from "node:url";

export const DEFAULT_REQUIRED_ROUTES = [
  "/",
  "/notes/",
  "/portfolio/",
  "/projects/personal-homepage-build-in-public/",
];

const TEXT_EXTENSIONS = new Set([
  ".css",
  ".html",
  ".js",
  ".json",
  ".map",
  ".svg",
  ".txt",
  ".webmanifest",
  ".xml",
]);
const SITE_URL = new URL("https://eryu.fun/");
const EXTERNAL_PROTOCOLS = new Set([
  "data:",
  "http:",
  "https:",
  "mailto:",
  "tel:",
]);
const LOCAL_PATH_PATTERNS = [
  /(?:^|[^A-Za-z0-9+.-])[A-Za-z]:[\\/]/im,
  /(?:^|[\s"'=:(>])\\\\[A-Za-z0-9._-]+\\[A-Za-z0-9$._-]+(?:\\[^\s"'<>]*)?/m,
  /(?:^|[\s"'=:(>])\/(?:Users|home)\/[^/\s"'<>]+\/[^\s"'<>]+/im,
];
const LOCAL_URL_PATTERN =
  /https?:\/\/(?:localhost(?:\.localdomain)?|0\.0\.0\.0|127(?:\.\d{1,3}){3}|\[::1\])(?::\d+)?(?=[/?#\s"'<>]|$)/i;
const CREDENTIAL_PATTERNS = [
  /\b(?:api[_ -]?key|access[_ -]?token|auth[_ -]?token|client[_ -]?secret|aws[_ -]?secret[_ -]?access[_ -]?key|secret[_ -]?access[_ -]?key|password|passwd|private[_ -]?key)\b\s*[:=]\s*["']?[A-Za-z0-9+/_=.-]{8,}/i,
  /-----BEGIN(?: [A-Z0-9]+)? PRIVATE KEY-----/i,
  /\b(?:sk-[A-Za-z0-9_-]{16,}|gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|xox[baprs]-[A-Za-z0-9-]{20,}|AKIA[0-9A-Z]{16}|LTAI[A-Za-z0-9]{12,})\b/,
];

const listFiles = (directory, unsafeLinks = []) => {
  if (!existsSync(directory)) return [];

  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    const metadata = lstatSync(path);
    if (metadata.isSymbolicLink()) {
      unsafeLinks.push(path);
      return [];
    }
    if (metadata.isDirectory()) return listFiles(path, unsafeLinks);
    return metadata.isFile() ? [path] : [];
  });
};

const isOutsideDirectory = (relativePath) =>
  relativePath === ".." ||
  relativePath.startsWith(`..${sep}`) ||
  isAbsolute(relativePath);

const isExactFilePath = (rootDirectory, targetPath) => {
  const root = resolve(rootDirectory);
  const target = resolve(targetPath);
  const targetRelativePath = relative(root, target);
  if (isOutsideDirectory(targetRelativePath)) return false;

  try {
    const realRoot = realpathSync(root);
    let current = root;
    for (const segment of targetRelativePath.split(/[\\/]/).filter(Boolean)) {
      if (!existsSync(current) || !statSync(current).isDirectory()) return false;
      if (!readdirSync(current).includes(segment)) return false;

      current = join(current, segment);
      if (lstatSync(current).isSymbolicLink()) return false;
    }

    const realTargetRelativePath = relative(realRoot, realpathSync(current));
    return (
      !isOutsideDirectory(realTargetRelativePath) &&
      statSync(current).isFile()
    );
  } catch {
    return false;
  }
};

const classifyOutputReference = (
  distDirectory,
  reference,
  sourceFile = join(resolve(distDirectory), "index.html"),
  documentBaseReference = null,
) => {
  if (typeof reference !== "string" || !reference.trim()) {
    return { kind: "ignored" };
  }

  const distRoot = resolve(distDirectory);
  const resolvedSource = resolve(sourceFile);
  const sourceRelativePath = relative(distRoot, resolvedSource);
  if (isOutsideDirectory(sourceRelativePath)) {
    return { kind: "invalid", reason: "Reference source is outside dist" };
  }

  let referenceUrl;
  try {
    const sourceUrl = new URL(
      `/${sourceRelativePath.replaceAll("\\", "/")}`,
      SITE_URL,
    );
    const baseUrl = documentBaseReference
      ? new URL(documentBaseReference, sourceUrl)
      : sourceUrl;
    referenceUrl = new URL(reference, baseUrl);
  } catch {
    return { kind: "invalid", reason: "URL cannot be parsed" };
  }

  if (referenceUrl.origin !== SITE_URL.origin) {
    return EXTERNAL_PROTOCOLS.has(referenceUrl.protocol)
      ? { kind: "external" }
      : { kind: "invalid", reason: "URL protocol is not allowed" };
  }

  let pathname;
  try {
    pathname = decodeURIComponent(referenceUrl.pathname);
  } catch {
    return { kind: "invalid", reason: "URL path cannot be decoded" };
  }

  const directPath = resolve(distRoot, pathname.replace(/^\/+/, ""));
  const relativePath = relative(distRoot, directPath);
  if (isOutsideDirectory(relativePath)) {
    return { kind: "invalid", reason: "URL path escapes dist" };
  }

  if (isExactFilePath(distRoot, directPath)) {
    return { kind: "local", path: directPath };
  }

  if (pathname.endsWith("/") || !extname(pathname)) {
    const flatHtmlPath = `${directPath}.html`;
    if (isExactFilePath(distRoot, flatHtmlPath)) {
      return { kind: "local", path: flatHtmlPath };
    }
    return { kind: "local", path: join(directPath, "index.html") };
  }

  return { kind: "local", path: directPath };
};

export function resolveOutputReference(
  distDirectory,
  reference,
  sourceFile = join(resolve(distDirectory), "index.html"),
) {
  const result = classifyOutputReference(
    distDirectory,
    reference,
    sourceFile,
  );
  return result.kind === "local" ? result.path : null;
}

const HTML_CHARACTER_REFERENCES = new Map([
  ["AMP", "&"],
  ["GT", ">"],
  ["LT", "<"],
  ["NonBreakingSpace", "\u00a0"],
  ["QUOT", '"'],
  ["Tab", "\t"],
  ["UnderBar", "_"],
  ["amp", "&"],
  ["apos", "'"],
  ["gt", ">"],
  ["lowbar", "_"],
  ["lt", "<"],
  ["nbsp", "\u00a0"],
  ["quot", '"'],
]);

const isHtmlWhitespace = (character) =>
  /[\t\n\f\r ]/.test(character ?? "");

const decodeHtmlCharacterReferences = (value) =>
  value.replace(
    /(?:&#x([0-9a-f]+);?|&#([0-9]+);?|&([a-z][a-z0-9]+);)/gi,
    (match, hexadecimal, decimal, named) => {
      if (hexadecimal || decimal) {
        const codePoint = Number.parseInt(hexadecimal ?? decimal, hexadecimal ? 16 : 10);
        if (
          Number.isInteger(codePoint) &&
          codePoint > 0 &&
          codePoint <= 0x10ffff &&
          !(codePoint >= 0xd800 && codePoint <= 0xdfff)
        ) {
          return String.fromCodePoint(codePoint);
        }
        return "\ufffd";
      }

      return HTML_CHARACTER_REFERENCES.get(named) ?? match;
    },
  );

const parseStartTag = (markup, start, end, rawContent = "") => {
  let cursor = 1;
  while (cursor < markup.length && isHtmlWhitespace(markup[cursor])) {
    cursor += 1;
  }

  const nameStart = cursor;
  while (
    cursor < markup.length &&
    !isHtmlWhitespace(markup[cursor]) &&
    !/[/>]/.test(markup[cursor])
  ) {
    cursor += 1;
  }
  const name = markup.slice(nameStart, cursor).toLowerCase();
  if (!name) return null;

  const attributes = new Map();
  while (cursor < markup.length) {
    while (cursor < markup.length && isHtmlWhitespace(markup[cursor])) {
      cursor += 1;
    }
    if (cursor >= markup.length || /[/>]/.test(markup[cursor])) break;

    const attributeStart = cursor;
    while (
      cursor < markup.length &&
      !isHtmlWhitespace(markup[cursor]) &&
      !/[=/>]/.test(markup[cursor])
    ) {
      cursor += 1;
    }
    const attributeName = markup
      .slice(attributeStart, cursor)
      .toLowerCase();
    if (!attributeName) {
      cursor += 1;
      continue;
    }

    while (cursor < markup.length && isHtmlWhitespace(markup[cursor])) {
      cursor += 1;
    }
    let value = "";
    if (markup[cursor] === "=") {
      cursor += 1;
      while (cursor < markup.length && isHtmlWhitespace(markup[cursor])) {
        cursor += 1;
      }

      const quote = markup[cursor];
      if (quote === '"' || quote === "'") {
        cursor += 1;
        const valueStart = cursor;
        while (cursor < markup.length && markup[cursor] !== quote) cursor += 1;
        value = markup.slice(valueStart, cursor);
        if (markup[cursor] === quote) cursor += 1;
      } else {
        const valueStart = cursor;
        while (
          cursor < markup.length &&
          !isHtmlWhitespace(markup[cursor]) &&
          markup[cursor] !== ">"
        ) {
          cursor += 1;
        }
        value = markup.slice(valueStart, cursor);
      }
    }

    if (!attributes.has(attributeName)) {
      attributes.set(attributeName, decodeHtmlCharacterReferences(value));
    }
  }

  return { attributes, end, name, rawContent, start };
};

const findRawTextClosingStart = (lowerHtml, name, fromIndex) => {
  const prefix = `</${name}`;
  let index = lowerHtml.indexOf(prefix, fromIndex);
  while (index !== -1) {
    const nextCharacter = lowerHtml[index + prefix.length];
    if (
      nextCharacter === undefined ||
      /[\t\n\f\r />]/.test(nextCharacter)
    ) {
      return index;
    }
    index = lowerHtml.indexOf(prefix, index + prefix.length);
  }
  return -1;
};

const hasHtmlTagNameBoundary = (lowerHtml, indexAfterName) => {
  const nextCharacter = lowerHtml[indexAfterName];
  return (
    nextCharacter === undefined ||
    /[\t\n\f\r />]/.test(nextCharacter)
  );
};

const findScriptClosingStart = (lowerHtml, fromIndex) => {
  let state = "data";
  let cursor = fromIndex;

  while (cursor < lowerHtml.length) {
    if (state === "data" && lowerHtml.startsWith("<!--", cursor)) {
      state = "escaped";
      cursor += 4;
      continue;
    }
    if (state === "escaped" && lowerHtml.startsWith("-->", cursor)) {
      state = "data";
      cursor += 3;
      continue;
    }

    if (
      state === "escaped" &&
      lowerHtml.startsWith("<script", cursor) &&
      hasHtmlTagNameBoundary(lowerHtml, cursor + 7)
    ) {
      state = "double-escaped";
      cursor += 7;
      continue;
    }

    if (
      lowerHtml.startsWith("</script", cursor) &&
      hasHtmlTagNameBoundary(lowerHtml, cursor + 8)
    ) {
      if (state === "double-escaped") {
        state = "escaped";
        cursor += 8;
        continue;
      }
      return cursor;
    }

    cursor += 1;
  }

  return -1;
};

const RAW_TEXT_ELEMENT_NAMES = new Set([
  "iframe",
  "noembed",
  "noframes",
  "script",
  "style",
  "textarea",
  "title",
  "xmp",
]);

const extractHtmlStartTags = (html) => {
  const tags = [];
  const lowerHtml = html.toLowerCase();
  let cursor = 0;

  while (cursor < html.length) {
    const start = html.indexOf("<", cursor);
    if (start === -1) break;

    if (html.startsWith("<!--", start)) {
      const regularCommentEnd = html.indexOf("-->", start + 4);
      const bangCommentEnd = html.indexOf("--!>", start + 4);
      const commentEnd =
        regularCommentEnd === -1
          ? bangCommentEnd
          : bangCommentEnd === -1
            ? regularCommentEnd
            : Math.min(regularCommentEnd, bangCommentEnd);
      cursor =
        commentEnd === -1
          ? html.length
          : commentEnd +
            (html.startsWith("--!>", commentEnd) ? 4 : 3);
      continue;
    }

    if (!/[A-Za-z]/.test(html[start + 1] ?? "")) {
      cursor = start + 1;
      continue;
    }

    let end = start + 1;
    let quote = null;
    while (end < html.length) {
      const character = html[end];
      if (quote) {
        if (character === quote) quote = null;
      } else if (character === '"' || character === "'") {
        quote = character;
      } else if (character === ">") {
        break;
      }
      end += 1;
    }
    if (end >= html.length) break;

    const provisionalTag = parseStartTag(
      html.slice(start, end + 1),
      start,
      end + 1,
    );
    if (!provisionalTag) {
      cursor = end + 1;
      continue;
    }

    if (RAW_TEXT_ELEMENT_NAMES.has(provisionalTag.name)) {
      const closingStart =
        provisionalTag.name === "script"
          ? findScriptClosingStart(lowerHtml, end + 1)
          : findRawTextClosingStart(
              lowerHtml,
              provisionalTag.name,
              end + 1,
            );
      if (closingStart !== -1) {
        provisionalTag.rawContent = html.slice(end + 1, closingStart);
        const closingEnd = html.indexOf(">", closingStart);
        cursor = closingEnd === -1 ? html.length : closingEnd + 1;
      } else {
        provisionalTag.rawContent = html.slice(end + 1);
        cursor = html.length;
      }
    } else {
      cursor = end + 1;
    }

    tags.push(provisionalTag);
  }

  return tags;
};

const isCssWhitespace = (character) => /[\t\n\f\r ]/.test(character ?? "");
const isCssNameCharacter = (character) => {
  if (!character) return false;
  return (
    /[A-Za-z0-9_-]/.test(character) ||
    character.codePointAt(0) >= 0x80
  );
};

const isValidCssEscape = (source, start) =>
  source[start] === "\\" &&
  start + 1 < source.length &&
  !/[\n\r\f]/.test(source[start + 1]);

const consumeCssEscape = (source, start) => {
  let cursor = start + 1;
  if (cursor >= source.length) return { end: cursor, value: "" };

  if (source[cursor] === "\r" || source[cursor] === "\n") {
    if (source[cursor] === "\r" && source[cursor + 1] === "\n") cursor += 1;
    return { end: cursor + 1, value: "" };
  }

  if (/[0-9A-Fa-f]/.test(source[cursor])) {
    const hexadecimalStart = cursor;
    while (
      cursor < source.length &&
      cursor - hexadecimalStart < 6 &&
      /[0-9A-Fa-f]/.test(source[cursor])
    ) {
      cursor += 1;
    }
    const codePoint = Number.parseInt(
      source.slice(hexadecimalStart, cursor),
      16,
    );
    if (isCssWhitespace(source[cursor])) cursor += 1;
    const value =
      codePoint > 0 &&
      codePoint <= 0x10ffff &&
      !(codePoint >= 0xd800 && codePoint <= 0xdfff)
        ? String.fromCodePoint(codePoint)
        : "\ufffd";
    return { end: cursor, value };
  }

  return { end: cursor + 1, value: source[cursor] };
};

const consumeCssString = (source, start) => {
  const quote = source[start];
  let cursor = start + 1;
  let value = "";

  while (cursor < source.length) {
    const character = source[cursor];
    if (character === quote) {
      return { closed: true, end: cursor + 1, value };
    }
    if (/[\n\r\f]/.test(character)) {
      return { closed: false, end: cursor, value };
    }
    if (character === "\\") {
      const escape = consumeCssEscape(source, cursor);
      value += escape.value;
      cursor = escape.end;
      continue;
    }
    value += character;
    cursor += 1;
  }

  return { closed: false, end: cursor, value };
};

const skipCssWhitespace = (source, start) => {
  let cursor = start;
  while (cursor < source.length && isCssWhitespace(source[cursor])) {
    cursor += 1;
  }
  return cursor;
};

const skipCssWhitespaceAndComments = (source, start) => {
  let cursor = start;
  while (cursor < source.length) {
    const next = skipCssWhitespace(source, cursor);
    if (source[next] === "/" && source[next + 1] === "*") {
      const commentEnd = source.indexOf("*/", next + 2);
      cursor = commentEnd === -1 ? source.length : commentEnd + 2;
      continue;
    }
    return next;
  }
  return cursor;
};

const consumeCssIdentifier = (source, start) => {
  let cursor = start;
  let value = "";

  while (cursor < source.length) {
    if (isCssNameCharacter(source[cursor])) {
      value += source[cursor];
      cursor += 1;
      continue;
    }
    if (isValidCssEscape(source, cursor)) {
      const escape = consumeCssEscape(source, cursor);
      value += escape.value;
      cursor = escape.end;
      continue;
    }
    break;
  }

  return { end: cursor, value };
};

const consumeCssUrlArguments = (source, openParenthesisIndex) => {
  let cursor = skipCssWhitespace(source, openParenthesisIndex + 1);

  if (source[cursor] === '"' || source[cursor] === "'") {
    const string = consumeCssString(source, cursor);
    cursor = skipCssWhitespace(source, string.end);
    if (source[cursor] === ")") cursor += 1;
    return { end: cursor, value: string.closed ? string.value : "" };
  }

  let value = "";
  while (cursor < source.length && source[cursor] !== ")") {
    if (source[cursor] === "\\") {
      const escape = consumeCssEscape(source, cursor);
      value += escape.value;
      cursor = escape.end;
      continue;
    }
    value += source[cursor];
    cursor += 1;
  }
  if (source[cursor] === ")") cursor += 1;
  return { end: cursor, value: value.trim() };
};

const consumeCssImageSetArguments = (source, openParenthesisIndex) => {
  const references = [];
  let cursor = openParenthesisIndex + 1;
  let depth = 1;

  while (cursor < source.length && depth > 0) {
    if (source[cursor] === "/" && source[cursor + 1] === "*") {
      const commentEnd = source.indexOf("*/", cursor + 2);
      cursor = commentEnd === -1 ? source.length : commentEnd + 2;
      continue;
    }

    if (source[cursor] === '"' || source[cursor] === "'") {
      const string = consumeCssString(source, cursor);
      if (depth === 1 && string.closed && string.value) {
        references.push(string.value);
      }
      cursor = Math.max(cursor + 1, string.end);
      continue;
    }

    if (isCssNameCharacter(source[cursor]) || source[cursor] === "\\") {
      const identifier = consumeCssIdentifier(source, cursor);
      if (
        identifier.value.toLowerCase() === "url" &&
        source[identifier.end] === "("
      ) {
        const url = consumeCssUrlArguments(source, identifier.end);
        if (url.value) references.push(url.value);
        cursor = url.end;
        continue;
      }
      cursor = Math.max(cursor + 1, identifier.end);
      continue;
    }

    if (source[cursor] === "(") depth += 1;
    if (source[cursor] === ")") depth -= 1;
    cursor += 1;
  }

  return { end: cursor, references };
};

const extractStylesheetReferences = (source) => {
  const references = [];
  let cursor = 0;

  while (cursor < source.length) {
    if (source[cursor] === "/" && source[cursor + 1] === "*") {
      const commentEnd = source.indexOf("*/", cursor + 2);
      cursor = commentEnd === -1 ? source.length : commentEnd + 2;
      continue;
    }

    if (source[cursor] === '"' || source[cursor] === "'") {
      cursor = consumeCssString(source, cursor).end;
      continue;
    }

    if (source[cursor] === "@") {
      const atKeyword = consumeCssIdentifier(source, cursor + 1);
      if (atKeyword.value.toLowerCase() === "import") {
        const importStart = skipCssWhitespaceAndComments(
          source,
          atKeyword.end,
        );
        if (source[importStart] === '"' || source[importStart] === "'") {
          const importedString = consumeCssString(source, importStart);
          if (importedString.value) references.push(importedString.value);
          cursor = importedString.end;
          continue;
        }

        const importedIdentifier = consumeCssIdentifier(source, importStart);
        if (
          importedIdentifier.value.toLowerCase() === "url" &&
          source[importedIdentifier.end] === "("
        ) {
          const importedUrl = consumeCssUrlArguments(
            source,
            importedIdentifier.end,
          );
          if (importedUrl.value) references.push(importedUrl.value);
          cursor = importedUrl.end;
          continue;
        }
      }
      cursor = Math.max(cursor + 1, atKeyword.end);
      continue;
    }

    if (isCssNameCharacter(source[cursor]) || source[cursor] === "\\") {
      const identifier = consumeCssIdentifier(source, cursor);
      if (
        ["image-set", "-webkit-image-set"].includes(
          identifier.value.toLowerCase(),
        ) &&
        source[identifier.end] === "("
      ) {
        const imageSet = consumeCssImageSetArguments(
          source,
          identifier.end,
        );
        references.push(...imageSet.references);
        cursor = imageSet.end;
        continue;
      }
      if (
        identifier.value.toLowerCase() === "url" &&
        source[identifier.end] === "("
      ) {
        const url = consumeCssUrlArguments(source, identifier.end);
        if (url.value) references.push(url.value);
        cursor = url.end;
        continue;
      }
      cursor = Math.max(cursor + 1, identifier.end);
      continue;
    }

    cursor += 1;
  }

  return references;
};

const extractSrcsetReferences = (srcset) => {
  const references = [];
  let cursor = 0;

  while (cursor < srcset.length) {
    while (
      cursor < srcset.length &&
      (srcset[cursor] === "," || isHtmlWhitespace(srcset[cursor]))
    ) {
      cursor += 1;
    }
    if (cursor >= srcset.length) break;

    const urlStart = cursor;
    while (
      cursor < srcset.length &&
      !isHtmlWhitespace(srcset[cursor])
    ) {
      cursor += 1;
    }
    const rawUrl = srcset.slice(urlStart, cursor);
    const trailingCommas = rawUrl.match(/,+$/)?.[0].length ?? 0;
    const reference =
      trailingCommas > 0 ? rawUrl.slice(0, -trailingCommas) : rawUrl;
    if (reference) references.push(reference);
    if (trailingCommas > 0) continue;

    while (cursor < srcset.length && srcset[cursor] !== ",") cursor += 1;
    if (srcset[cursor] === ",") cursor += 1;
  }

  return references;
};

const extractOutputReferences = (tags) => {
  const references = [];

  for (const tag of tags) {
    for (const name of ["href", "src", "data-src"]) {
      const reference = tag.attributes.get(name);
      if (reference && !(tag.name === "base" && name === "href")) {
        references.push({ reference, useDocumentBase: true });
      }
    }

    const tagSpecificReferences = [
      tag.name === "object" ? tag.attributes.get("data") : null,
      tag.name === "video" ? tag.attributes.get("poster") : null,
    ].filter(Boolean);
    for (const reference of tagSpecificReferences) {
      references.push({ reference, useDocumentBase: true });
    }

    const responsiveSources = [
      tag.attributes.get("srcset"),
      tag.name === "link" ? tag.attributes.get("imagesrcset") : null,
    ].filter(Boolean);
    for (const srcset of responsiveSources) {
      for (const reference of extractSrcsetReferences(srcset)) {
        references.push({ reference, useDocumentBase: true });
      }
    }

    const inlineStyle = tag.attributes.get("style");
    if (inlineStyle) {
      references.push(
        ...extractStylesheetReferences(inlineStyle).map((reference) => ({
          reference,
          useDocumentBase: true,
        })),
      );
    }
    if (tag.name === "style" && tag.rawContent) {
      references.push(
        ...extractStylesheetReferences(tag.rawContent).map((reference) => ({
          reference,
          useDocumentBase: true,
        })),
      );
    }
  }

  return references;
};

const hasSafeBlankTarget = (anchor) => {
  const rel = anchor.attributes.get("rel");
  if (!rel) return false;
  const values = new Set(
    rel
      .toLowerCase()
      .split(/[\t\n\f\r ]+/)
      .filter(Boolean),
  );
  return values.has("noopener") && values.has("noreferrer");
};

export function findReleaseCandidateIssues({
  distDirectory,
  requiredRoutes = DEFAULT_REQUIRED_ROUTES,
}) {
  const issues = [];
  const addIssue = (code, file, detail) => issues.push({ code, file, detail });

  if (!existsSync(distDirectory)) {
    addIssue("missing-dist", ".", "Build output directory does not exist");
    return issues;
  }

  for (const route of requiredRoutes) {
    const outputPath = resolveOutputReference(
      distDirectory,
      route,
      join(resolve(distDirectory), "index.html"),
    );
    if (!outputPath || !isExactFilePath(resolve(distDirectory), outputPath)) {
      addIssue("missing-required-route", route, "Required page was not built");
    }
  }

  const unsafeOutputLinks = [];
  const files = listFiles(distDirectory, unsafeOutputLinks);
  for (const linkPath of unsafeOutputLinks) {
    addIssue(
      "unsafe-output-link",
      relative(distDirectory, linkPath),
      "Symbolic links and junctions are not allowed in release output",
    );
  }
  for (const filePath of files) {
    const extension = extname(filePath).toLowerCase();
    if (!TEXT_EXTENSIONS.has(extension)) continue;

    const content = readFileSync(filePath, "utf8");
    const displayPath = relative(distDirectory, filePath) || "index.html";

    if (LOCAL_PATH_PATTERNS.some((pattern) => pattern.test(content))) {
      addIssue("local-path", displayPath, "Local absolute path found");
    }
    if (LOCAL_URL_PATTERN.test(content)) {
      addIssue("local-url", displayPath, "Local development URL found");
    }
    if (CREDENTIAL_PATTERNS.some((pattern) => pattern.test(content))) {
      addIssue("credential-shape", displayPath, "Credential-like value found");
    }

    const htmlTags =
      extension === ".html" ? extractHtmlStartTags(content) : [];
    const documentBaseReference = htmlTags
      .find(({ attributes, name }) => name === "base" && attributes.has("href"))
      ?.attributes.get("href");
    const documentBaseTarget = htmlTags
      .find(
        ({ attributes, name }) => name === "base" && attributes.has("target"),
      )
      ?.attributes.get("target");
    if (documentBaseReference) {
      const baseResult = classifyOutputReference(
        distDirectory,
        documentBaseReference,
        filePath,
      );
      if (baseResult.kind === "invalid") {
        addIssue(
          "invalid-reference",
          displayPath,
          `Invalid document base ${documentBaseReference}: ${baseResult.reason}`,
        );
      }
    }

    const references =
      extension === ".html"
        ? extractOutputReferences(htmlTags)
        : extension === ".css"
          ? extractStylesheetReferences(content).map((reference) => ({
              reference,
              useDocumentBase: false,
            }))
          : [];
    for (const { reference, useDocumentBase } of references) {
      const result = classifyOutputReference(
        distDirectory,
        reference,
        filePath,
        useDocumentBase ? documentBaseReference : null,
      );
      if (result.kind === "invalid") {
        addIssue(
          "invalid-reference",
          displayPath,
          `Invalid reference ${reference}: ${result.reason}`,
        );
        continue;
      }
      if (result.kind !== "local") continue;
      if (!isExactFilePath(resolve(distDirectory), result.path)) {
        addIssue(
          "broken-reference",
          displayPath,
          `Missing output for ${reference}`,
        );
      }
    }

    if (extension !== ".html") continue;

    for (const link of htmlTags.filter(
      ({ attributes, name }) =>
        (name === "a" || name === "area") && attributes.has("href"),
    )) {
      const target = link.attributes.get("target") ?? documentBaseTarget;
      if (target?.toLowerCase() === "_blank" && !hasSafeBlankTarget(link)) {
        addIssue(
          "unsafe-blank-target",
          displayPath,
          "New-window link must include noopener noreferrer",
        );
      }
    }
  }

  return issues;
}

const run = () => {
  const root = process.cwd();
  const distDirectory = join(root, "dist");
  const issues = findReleaseCandidateIssues({ distDirectory });

  if (issues.length === 0) {
    console.log(
      `Release candidate check passed: ${DEFAULT_REQUIRED_ROUTES.length} required routes and audited local references are valid.`,
    );
    return;
  }

  console.error(`Release candidate check failed with ${issues.length} issue(s).`);
  console.table(issues);
  process.exitCode = 1;
};

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  run();
}
