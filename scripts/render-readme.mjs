#!/usr/bin/env node

import fs from "node:fs"
import path from "node:path"
import crypto from "node:crypto"
import { fileURLToPath } from "node:url"
import { marked } from "marked"

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, "..")
const README = path.join(ROOT, "README.md")
const DEMO = path.join(ROOT, "rendered-demo.html")
const SITE = path.join(ROOT, "site")
const SITE_INDEX = path.join(SITE, "index.html")
const ASSETS = path.join(ROOT, "assets")
const CHECK = process.argv.includes("--check")

function die(message) {
  console.error(`FAIL  ${message}`)
  process.exit(1)
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
}

function decodeBasicEntities(value) {
  return String(value)
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("&#x27;", "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
}

function stripHtml(value) {
  return decodeBasicEntities(
    String(value)
      .replace(/<code[^>]*>(.*?)<\/code>/gis, "$1")
      .replace(/<[^>]+>/g, "")
  ).trim()
}

function slugBase(value) {
  const normalized = stripHtml(value)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
  return normalized || "section"
}

function addHeadingIds(fragment) {
  const seen = new Map()
  const headings = []

  const html = fragment.replace(
    /<h([1-3])>([\s\S]*?)<\/h\1>/g,
    (whole, levelRaw, inner) => {
      const level = Number(levelRaw)
      const base = slugBase(inner)
      const count = seen.get(base) ?? 0
      seen.set(base, count + 1)
      const id = count === 0 ? base : `${base}-${count + 1}`
      const text = stripHtml(inner)

      headings.push({ level, id, text })

      return `<h${level} id="${escapeHtml(id)}">${inner}<a class="anchor" href="#${escapeHtml(id)}" aria-label="Link to ${escapeHtml(text)}">#</a></h${level}>`
    }
  )

  return { html, headings }
}

function rewriteMarkdownLinks(fragment, repoUrl) {
  return fragment.replace(
    /href="([^"]+\.md)(#[^"]*)?"/gi,
    (whole, rawPath, fragmentPart = "") => {
      if (/^(?:https?:|mailto:|#)/i.test(rawPath)) return whole
      const clean = rawPath.replace(/^\.\//, "")
      return `href="${repoUrl}/blob/main/${clean}${fragmentPart}"`
    }
  )
}

function buildNav(headings) {
  return headings
    .filter((h) => h.level <= 3)
    .map((h) => {
      const klass = h.level === 1 ? "nav-l1" : h.level === 2 ? "nav-l2" : "nav-l3"
      return `<a class="${klass}" href="#${escapeHtml(h.id)}">${escapeHtml(h.text)}</a>`
    })
    .join("\n")
}

function sourceDate() {
  const epoch = process.env.SOURCE_DATE_EPOCH
  if (epoch && /^\d+$/.test(epoch)) {
    return new Date(Number(epoch) * 1000)
  }
  return new Date()
}

function loadPackageVersion() {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"))
    return String(pkg.version ?? "unknown")
  } catch {
    return "unknown"
  }
}

if (!fs.existsSync(README)) die("README.md not found")

const readme = fs.readFileSync(README, "utf8")
const repository = process.env.DMT_REPOSITORY || process.env.GITHUB_REPOSITORY || "es-3581100/Goblin-D.M.T."
const [owner, repo] = repository.split("/")
const repoUrl = `https://github.com/${repository}`
const pagesUrl = process.env.DMT_PAGES_URL || `https://${owner}.github.io/${repo}/`
const version = loadPackageVersion()
const readmeHash = crypto.createHash("sha256").update(readme).digest("hex")
const livePass = readme.includes("GOBLIN_DMT_LIVE_E2E")
const generated = sourceDate().toISOString()

marked.setOptions({
  gfm: true,
  breaks: false,
})

let fragment = marked.parse(readme)
const withIds = addHeadingIds(fragment)
fragment = rewriteMarkdownLinks(withIds.html, repoUrl)
const nav = buildNav(withIds.headings)

const statusClass = livePass ? "pass" : "warn"
const statusText = livePass ? "LIVE E2E PASS" : "LIVE E2E NOT RECORDED"

const documentHtml = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark">
<meta name="theme-color" content="#11130f">
<meta name="description" content="Goblin-D.M.T. — Dynamic Meta Transfusion runtime manual">
<meta property="og:title" content="Goblin-D.M.T. — Dynamic Meta Transfusion">
<meta property="og:description" content="Actor-driven OpenCode runtime for bounded, evidence-backed agent work.">
<meta property="og:type" content="website">
<meta property="og:url" content="${escapeHtml(pagesUrl)}">
<meta property="og:image" content="${escapeHtml(new URL("assets/goblin-dmt-banner.png", pagesUrl).href)}">
<link rel="canonical" href="${escapeHtml(pagesUrl)}">
<title>Goblin-D.M.T. — Dynamic Runtime Manual</title>
<style>
:root{
  --bg:#11130f;
  --surface:#191c16;
  --surface2:#20241b;
  --elevated:#292e21;
  --ink:#e8e4d6;
  --muted:#a9aa98;
  --moss:#9dba52;
  --blood:#d86545;
  --brass:#b7a06a;
  --ok:#a6c763;
  --warn:#d4a84f;
  --danger:#d65d4d;
  --info:#8fa89a;
  --line:#3b4031;
  --code:#0c0e0a;
  --max:930px
}
*{box-sizing:border-box}
html{scroll-behavior:smooth;background:var(--bg)}
body{
  margin:0;
  background:
    radial-gradient(circle at 50% -10%,#29311c 0,transparent 34rem),
    linear-gradient(180deg,#11130f,#0e100c 72%);
  color:var(--ink);
  font:15px/1.65 ui-monospace,SFMono-Regular,Menlo,Consolas,"Liberation Mono",monospace
}
a{color:#c5d980;text-underline-offset:3px}
a:hover{color:#e1efab}
.topbar{
  position:sticky;top:0;z-index:50;
  display:flex;align-items:center;justify-content:space-between;gap:16px;
  min-height:46px;padding:8px 18px;
  border-bottom:1px solid var(--line);
  background:#11130fe8;
  backdrop-filter:blur(14px)
}
.topbar .brand{color:var(--moss);font-weight:800;letter-spacing:.06em;text-decoration:none}
.topbar .links{display:flex;gap:14px;flex-wrap:wrap;font-size:12px}
.shell{
  display:grid;
  grid-template-columns:260px minmax(0,var(--max)) 250px;
  gap:28px;
  max-width:1510px;
  margin:auto;
  padding:24px 22px 80px
}
nav,.rail{
  position:sticky;top:70px;
  height:calc(100vh - 92px);
  overflow:auto;
  scrollbar-width:thin
}
nav{padding-right:10px}
.nav-head{
  padding:10px 8px 14px;
  margin-bottom:10px;
  border-bottom:1px solid var(--line)
}
.nav-head strong{display:block;color:var(--moss);font-size:15px}
.nav-head small{color:var(--muted)}
nav a{
  display:block;color:var(--muted);text-decoration:none;
  padding:5px 8px;border-left:2px solid transparent
}
nav a:hover,nav a:focus-visible{
  color:var(--ink);border-left-color:var(--moss);background:var(--surface2);outline:none
}
.nav-l1{font-weight:800;color:var(--ink)!important}
.nav-l2{padding-left:14px;font-size:12px}
.nav-l3{padding-left:25px;font-size:11px;opacity:.9}
main{min-width:0}
.markdown-body{
  border-top:3px solid var(--moss);
  padding-top:12px
}
.markdown-body>p[align="center"]:first-of-type{
  margin:0 0 20px;
  padding:0;
  overflow:hidden;
  border:1px solid var(--line);
  background:#090a08
}
.markdown-body>p[align="center"]:first-of-type img{
  display:block;
  width:100%;
  max-width:none!important;
  height:auto;
  margin:0
}
h1,h2,h3{
  font-family:ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
  line-height:1.2;
  scroll-margin-top:72px
}
h1{font-size:38px;margin:25px 0 18px;color:#f3ecd7}
h2{font-size:24px;margin-top:2.15em;padding-bottom:8px;border-bottom:1px solid var(--line)}
h3{font-size:17px;color:var(--brass);margin-top:1.8em}
.anchor{
  opacity:0;margin-left:8px;color:var(--moss);
  text-decoration:none;font-family:ui-monospace,monospace;font-size:.7em
}
h1:hover .anchor,h2:hover .anchor,h3:hover .anchor,.anchor:focus{opacity:1}
blockquote{
  margin:18px 0;
  padding:10px 16px;
  border-left:4px solid var(--blood);
  background:#181b15;
  color:#ddd7c4
}
code{
  background:var(--surface2);
  padding:1px 4px;
  border-radius:3px
}
pre{
  position:relative;
  background:var(--code);
  border:1px solid #24281f;
  border-left:3px solid var(--brass);
  padding:16px;
  overflow:auto;
  box-shadow:0 8px 26px #0005
}
pre code{background:transparent;padding:0}
.copy{
  position:absolute;right:7px;top:7px;
  border:1px solid var(--line);
  background:#181c15;color:var(--muted);
  font:inherit;font-size:11px;padding:4px 7px;cursor:pointer
}
.copy:hover{color:var(--ink);border-color:var(--moss)}
table{
  border-collapse:collapse;width:100%;
  display:block;overflow-x:auto;margin:18px 0
}
th,td{
  border-bottom:1px solid var(--line);
  padding:9px 12px;text-align:left;vertical-align:top
}
th{color:var(--brass);background:#181b15}
hr{border:0;border-top:1px solid var(--line);margin:32px 0}
.rail{
  border-left:1px solid var(--line);
  padding-left:18px;
  color:var(--muted);
  font-size:12px
}
.meter{padding:11px 0;border-bottom:1px solid var(--line)}
.meter b{display:block;color:var(--ink);overflow-wrap:anywhere}
.pass{color:var(--ok)!important}
.warn{color:var(--warn)!important}
.hash{font-size:10px;word-break:break-all}
footer{
  margin-top:50px;border-top:1px solid var(--line);
  padding-top:18px;color:var(--muted);font-size:12px
}
@media(max-width:1120px){
  .shell{grid-template-columns:220px minmax(0,1fr)}
  .rail{display:none}
}
@media(max-width:780px){
  .topbar{position:static}
  .shell{display:block;padding:14px}
  nav{position:static;height:auto;max-height:260px;margin-bottom:24px;border-bottom:1px solid var(--line)}
  h1{font-size:30px}
}
@media(prefers-reduced-motion:reduce){
  html{scroll-behavior:auto}
  *{animation:none!important;transition:none!important}
}
:focus-visible{outline:2px solid var(--moss);outline-offset:2px}
</style>
</head>
<body>
<header class="topbar">
  <a class="brand" href="${escapeHtml(pagesUrl)}">GOBLIN-D.M.T.</a>
  <div class="links">
    <a href="${escapeHtml(repoUrl)}">GitHub</a>
    <a href="${escapeHtml(repoUrl)}/blob/main/README.md">README source</a>
    <a href="${escapeHtml(repoUrl)}/blob/main/scripts/render-readme.mjs">renderer</a>
  </div>
</header>
<div class="shell">
  <nav aria-label="README sections">
    <div class="nav-head">
      <strong>DYNAMIC MANUAL</strong>
      <small>README → deterministic HTML projection</small>
    </div>
    ${nav}
  </nav>
  <main>
    <article class="markdown-body">
      ${fragment}
    </article>
    <footer>
      Generated from <code>README.md</code> by <code>scripts/render-readme.mjs</code>.<br>
      The GitHub README remains the portable source surface; this page is its dynamic presentation surface.
    </footer>
  </main>
  <aside class="rail" aria-label="Build provenance">
    <div class="meter"><span>PACKAGE</span><b>dmt ${escapeHtml(version)}</b></div>
    <div class="meter"><span>LIVE CHECKPOINT</span><b class="${statusClass}">${statusText}</b></div>
    <div class="meter"><span>GENERATED</span><b>${escapeHtml(generated)}</b></div>
    <div class="meter"><span>README SHA-256</span><b class="hash">${escapeHtml(readmeHash)}</b></div>
    <div class="meter"><span>AUTHORITY</span><b>README.md</b></div>
  </aside>
</div>
<script>
for (const pre of document.querySelectorAll("pre")) {
  const button = document.createElement("button")
  button.className = "copy"
  button.type = "button"
  button.textContent = "copy"
  button.addEventListener("click", async () => {
    const text = pre.querySelector("code")?.innerText ?? pre.innerText
    try {
      await navigator.clipboard.writeText(text)
      button.textContent = "copied"
      setTimeout(() => button.textContent = "copy", 1200)
    } catch {
      button.textContent = "blocked"
      setTimeout(() => button.textContent = "copy", 1200)
    }
  })
  pre.appendChild(button)
}
</script>
</body>
</html>
`

if (CHECK) {
  if (!fs.existsSync(DEMO)) die("rendered-demo.html is missing")
  const current = fs.readFileSync(DEMO, "utf8")
  if (current !== documentHtml) {
    console.error("FAIL  rendered-demo.html is stale")
    console.error("      run: npm run docs:build")
    process.exit(1)
  }
  console.log("PASS  rendered-demo.html matches README.md")
  process.exit(0)
}

fs.rmSync(SITE, { recursive: true, force: true })
fs.mkdirSync(SITE, { recursive: true })
fs.writeFileSync(DEMO, documentHtml)
fs.writeFileSync(SITE_INDEX, documentHtml)

if (fs.existsSync(ASSETS)) {
  fs.cpSync(ASSETS, path.join(SITE, "assets"), { recursive: true })
}

fs.writeFileSync(
  path.join(SITE, ".nojekyll"),
  "Goblin-D.M.T. dynamic manual is pre-rendered; Jekyll is intentionally bypassed.\n"
)

console.log(`PASS  rendered ${path.relative(ROOT, DEMO)}`)
console.log(`PASS  rendered ${path.relative(ROOT, SITE_INDEX)}`)
console.log(`INFO  readme_sha256=${readmeHash}`)
console.log(`INFO  pages_url=${pagesUrl}`)
