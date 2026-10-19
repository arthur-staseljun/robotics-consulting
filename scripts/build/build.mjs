// Builds the deployable site into ../../_site.
//
// The page text lives in locales/*.json and is normally filled in by main.js at
// runtime, so a crawler (or a link preview) that doesn't run JS sees stale
// Latvian only. This script bakes each language into real HTML:
//   /        -> LV      /ru/ -> RU      /en/ -> EN
// main.js still runs on top of it (language switch, mobile copy, etc.).
import { cpSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const out = join(root, "_site");
const origin = "https://www.sia-robotics-consulting.eu";
const langs = { lv: "/", ru: "/ru/", en: "/en/" };
const ogLocale = { lv: "lv_LV", ru: "ru_RU", en: "en_US" };
const excluded = new Set([".git", ".github", ".idea", ".wrangler", "backend", "scripts", "node_modules", "_site", "README.md"]);

rmSync(out, { recursive: true, force: true });
mkdirSync(out);
for (const entry of readdirSync(root)) {
  if (excluded.has(entry)) continue;
  cpSync(join(root, entry), join(out, entry), { recursive: true });
}

const source = readFileSync(join(root, "index.html"), "utf8");

function setAttr(doc, selector, attr, value) {
  const node = doc.querySelector(selector);
  if (node) node.setAttribute(attr, value);
}

function render(lang) {
  const copy = JSON.parse(readFileSync(join(root, "locales", `${lang}.json`), "utf8"));
  const dom = new JSDOM(source);
  const doc = dom.window.document;
  const url = origin + langs[lang];

  doc.documentElement.lang = lang;
  doc.title = copy.page_title;
  setAttr(doc, 'meta[name="description"]', "content", copy.page_desc);
  setAttr(doc, 'meta[property="og:title"]', "content", copy.page_title);
  setAttr(doc, 'meta[name="twitter:title"]', "content", copy.page_title);
  setAttr(doc, 'meta[property="og:description"]', "content", copy.page_desc);
  setAttr(doc, 'meta[name="twitter:description"]', "content", copy.page_desc);
  setAttr(doc, 'meta[property="og:locale"]', "content", ogLocale[lang]);
  doc.querySelectorAll('meta[property="og:locale:alternate"]').forEach((node) => node.remove());
  const localeAnchor = doc.querySelector('meta[property="og:locale"]');
  for (const other of Object.keys(langs).filter((l) => l !== lang).reverse()) {
    const meta = doc.createElement("meta");
    meta.setAttribute("property", "og:locale:alternate");
    meta.setAttribute("content", ogLocale[other]);
    localeAnchor?.after(meta);
  }
  setAttr(doc, 'link[rel="canonical"]', "href", url);
  setAttr(doc, 'meta[property="og:url"]', "content", url);

  doc.querySelectorAll("[data-i18n]").forEach((node) => {
    const key = node.dataset.i18n;
    if (!Object.hasOwn(copy, key)) return;
    node.textContent = copy[key];
  });

  doc.querySelectorAll("[data-i18n-placeholder]").forEach((node) => {
    const key = node.dataset.i18nPlaceholder;
    if (Object.hasOwn(copy, key)) node.setAttribute("placeholder", copy[key]);
  });

  doc.querySelectorAll(".lang-btn").forEach((btn) => {
    const active = btn.dataset.lang === lang;
    btn.classList.toggle("active", active);
    btn.setAttribute("aria-pressed", String(active));
  });

  // Pages under /ru/ and /en/ are one level deeper, so relative ./ URLs
  // must become root-relative.
  doc.querySelectorAll("[href], [src], [srcset]").forEach((node) => {
    for (const attr of ["href", "src", "srcset"]) {
      const value = node.getAttribute(attr);
      if (value?.startsWith("./")) node.setAttribute(attr, value.slice(1));
    }
  });

  return dom.serialize();
}

for (const [lang, path] of Object.entries(langs)) {
  const dir = join(out, path);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "index.html"), render(lang));
  console.log(`built ${path}index.html (${lang})`);
}
