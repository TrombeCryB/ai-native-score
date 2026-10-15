// src/discovery.ts
import { lstat, readdir, realpath } from "node:fs/promises";
import { join, resolve } from "node:path";
import { homedir } from "node:os";
var TOOLS = ["Codex", "Hermes", "WorkBuddy", "OpenClaw", "DeepSeek Harness", "ZCode", "Claude Code", "GPT / ChatGPT"];
async function discover(options = {}) {
  const home = resolve(options.home ?? homedir());
  const sources = [];
  async function probe(tool, path, instance, adapter) {
    const result = { tool, instance, path, discovery: "unknown", adapter, authorization: "not-granted", read: "not-read", exportRequired: adapter === null, note: "\u4EC5\u68C0\u67E5\u8DEF\u5F84\u5143\u6570\u636E\uFF1B\u672A\u8BFB\u53D6\u5185\u5BB9\uFF0C\u4E5F\u672A\u83B7\u5F97\u5386\u53F2\u8BFB\u53D6\u6388\u6743\u3002" };
    if (/(^|\/)(Library|\.ssh|\.aws|\.config|\.env[^/]*|auth[^/]*|credentials?[^/]*|secrets?[^/]*)(\/|$)/i.test(path)) {
      result.discovery = "denied";
      result.note = "\u62D2\u7EDD\u654F\u611F\u6216\u53D7\u9650\u76EE\u5F55\uFF0C\u4E0D\u8BFB\u53D6\u5143\u6570\u636E\u6216\u5185\u5BB9\u3002";
      sources.push(result);
      return result;
    }
    try {
      let current = "/";
      for (const part of resolve(path).split("/").filter(Boolean)) {
        current = join(current, part);
        if ((await lstat(current)).isSymbolicLink()) throw Error("symlink");
      }
      if (await realpath(path) !== resolve(path)) throw Error("changed");
      result.discovery = "found";
    } catch (e) {
      result.discovery = e?.code === "ENOENT" ? "not-found" : e?.code === "EACCES" || e?.code === "EPERM" ? "denied" : "unknown";
    }
    sources.push(result);
    return result;
  }
  await probe("Codex", join(home, ".codex", "sessions"), "default", "codex");
  if (!options.home && process.env.CODEX_HOME && resolve(process.env.CODEX_HOME) !== join(home, ".codex")) await probe("Codex", join(process.env.CODEX_HOME, "sessions"), "configured", "codex");
  if (!options.home && process.env.HERMES_HOME && resolve(process.env.HERMES_HOME) !== join(home, ".hermes")) await probe("Hermes", join(process.env.HERMES_HOME, "state.db"), "configured", "hermes-sqlite");
  await probe("Hermes", join(home, ".hermes", "state.db"), "default", "hermes-sqlite");
  const profiles = await probe("Hermes", join(home, ".hermes", "profiles"), "profiles", null);
  if (profiles.discovery === "found") try {
    for (const entry of (await readdir(profiles.path, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name)).slice(0, 128)) {
      if (entry.isDirectory() && !entry.isSymbolicLink()) await probe("Hermes", join(profiles.path, entry.name, "state.db"), entry.name, "hermes-sqlite");
    }
  } catch {
    profiles.discovery = "denied";
  }
  for (const root of options.roots ?? []) {
    if (!root || typeof root.tool !== "string" || typeof root.path !== "string" || typeof root.instance !== "string") throw Error("\u53D1\u73B0\u8303\u56F4\u65E0\u6548");
    await probe(root.tool, root.path, root.instance, root.tool === "Codex" ? "codex" : null);
  }
  for (const tool of TOOLS) if (!sources.some((s) => s.tool === tool)) sources.push({ tool, instance: "unresolved", discovery: "unknown", adapter: null, authorization: "not-granted", read: "not-read", exportRequired: true, note: "\u672A\u5B9E\u73B0\u539F\u751F\u683C\u5F0F\u8BFB\u53D6\uFF1B\u8BF7\u5728\u5E94\u7528\u4E2D\u5BFC\u51FA\u6240\u9009\u65E5\u671F\u7684\u8BB0\u5F55\uFF0C\u6216\u660E\u786E\u63D0\u4F9B\u6839\u76EE\u5F55\u4E0E\u683C\u5F0F\u6837\u672C\u3002\u672A\u731C\u6D4B\u8DEF\u5F84\u3002" });
  return { sources, limits: ["\u53D1\u73B0\u53EA\u8BFB\u5DF2\u77E5\u6839\u76EE\u5F55\u7684\u5143\u6570\u636E\u53CA Hermes profile \u540D\u79F0\uFF0C\u4E0D\u8BFB\u51ED\u636E\u3001\u914D\u7F6E\u5185\u5BB9\u6216\u4F1A\u8BDD\u6B63\u6587\u3002", "\u4EC5\u8FD9\u4E9B\u660E\u786E\u5165\u53E3\u53EF\u53D1\u73B0\uFF1B\u6C99\u7BB1\u3001\u8FDC\u7A0B\u548C\u81EA\u5B9A\u4E49\u76EE\u5F55\u53EF\u80FD\u9057\u6F0F\uFF0C\u8865\u5145\u6839\u76EE\u5F55\u6216\u5BFC\u51FA\u4EE5\u6269\u5C55\u3002", "\u53D1\u73B0\u3001\u9002\u914D\u3001\u6388\u6743\u548C\u6210\u529F\u8BFB\u53D6\u662F\u4E0D\u540C\u72B6\u6001\uFF1B\u5B58\u5728\u76EE\u5F55\u4E0D\u4EE3\u8868\u9002\u914D\u6210\u529F\u3002", "\u62D2\u8BFB\u53D7\u9650\u76EE\u5F55\uFF0C\u4E0D\u7ED5\u8FC7\u6743\u9650\uFF1B\u53BB\u654F\u53CA\u8DEF\u5F84\u9632\u62A4\u5C3D\u529B\u800C\u4E3A\uFF0C\u4E0D\u80FD\u4FDD\u8BC1\u7EDD\u5BF9\u5B89\u5168\u3002"], network: "none", contentRead: false };
}

// src/model.ts
var VERSION = "am-0.2";
var AXES = ["\u76EE\u6807\u4E0E\u59D4\u6D3E", "\u4E0A\u4E0B\u6587\u8868\u8FBE", "\u5DE5\u4F5C\u6D41\u7F16\u6392", "\u8BC4\u4F30\u4E0E\u5224\u65AD", "\u5B66\u4E60\u4E0E\u590D\u7528", "\u5B89\u5168\u4E0E\u8D23\u4EFB"];
var INDICATORS = [
  ["\u76EE\u6807\u4E0E\u9A8C\u6536\u6807\u51C6", "\u6309\u80FD\u529B\u9650\u5236\u9009\u62E9\u5DE5\u5177", "\u5206\u914D\u4EBA\u673A\u8D23\u4EFB", "\u7EA6\u675F\u3001\u53D6\u820D\u548C\u505C\u6B62\u6761\u4EF6"],
  ["\u76F8\u5173\u8F93\u5165\u53CA\u6765\u6E90", "\u53D7\u4F17\u3001\u683C\u5F0F\u3001\u7EA6\u675F\u4E0E\u793A\u4F8B", "\u8BC6\u522B\u7F3A\u5931\u3001\u8FC7\u671F\u3001\u77DB\u76FE", "\u66F4\u65B0\u4E0A\u4E0B\u6587\u5E76\u533A\u5206\u6750\u6599\u6027\u8D28"],
  ["\u5408\u7406\u9636\u6BB5\u4E0E\u4F9D\u8D56", "\u7AEF\u5230\u7AEF\u96C6\u6210\u4EA7\u51FA", "\u68C0\u67E5\u70B9\u3001\u5931\u8D25\u6062\u590D\u4E0E\u5347\u7EA7", "\u590D\u6742\u5EA6\u3001\u8017\u65F6\u3001\u6210\u672C\u4E0E\u7EF4\u62A4\u6743\u8861"],
  ["\u5BF9\u5B9E\u9645\u9A8C\u6536\u6807\u51C6\u68C0\u67E5", "\u72EC\u7ACB\u9A8C\u8BC1\u3001\u8D1F\u4F8B\u4E0E\u8FB9\u754C", "\u8BC6\u522B\u9519\u8BEF\u3001\u4E0D\u786E\u5B9A\u6027\u4E0E\u504F\u5DEE", "\u4FEE\u6B63\u5E76\u590D\u6838\u6700\u7EC8\u7ED3\u679C"],
  ["\u91CD\u590D\u9700\u8981\u8F6C\u4E3A\u590D\u7528\u8D44\u4EA7", "\u8DE8\u4EFB\u52A1\u9002\u914D", "\u7528\u5931\u8D25\u53CD\u9988\u6539\u8FDB", "\u7EF4\u62A4\u7248\u672C\u3001\u793A\u4F8B\u3001\u8BC4\u4F30\u4E0E\u77E5\u8BC6"],
  ["\u6570\u636E\u4E0E\u79D8\u5BC6\u6700\u5C0F\u66B4\u9732", "\u6743\u9650\u3001\u5BA1\u6279\u3001\u53EF\u9006\u6027\u4E0E\u76D1\u7763", "\u6B63\u786E\u5904\u7406\u975E\u53EF\u4FE1\u5185\u5BB9", "\u8D23\u4EFB\u3001\u6765\u6E90\u3001\u62AB\u9732\u53CA\u6743\u5229\u5F71\u54CD"]
];
function summarize(ratings) {
  if (ratings.length !== 6 || ratings.some((a) => a.length !== 4)) throw Error("\u9700\u8981\u516D\u8F74\u3001\u6BCF\u8F74\u56DB\u6307\u6807");
  let sum = 0, known = 0, conf = 0;
  const dimensions = ratings.map((axis) => {
    let n = 0, s = 0;
    for (const r of axis) {
      if (r.value === null) {
        if (r.confidence !== 0) throw Error("\u672A\u77E5\u6307\u6807\u7F6E\u4FE1\u5EA6\u5FC5\u987B\u4E3A\u96F6");
        continue;
      }
      if (!Number.isInteger(r.value) || r.value < 0 || r.value > 4 || !Number.isFinite(r.confidence) || r.confidence < 0 || r.confidence > 1) throw Error("\u6307\u6807\u65E0\u6548");
      n++;
      s += r.value;
      sum += r.value;
      known++;
      conf += r.confidence;
    }
    return n ? round(25 * s / n) : null;
  });
  const ready = known === 24 && ratings.flat().every((r) => r.basis === "observed" && r.confidence >= 0.5 && r.evidence.length > 0);
  return { dimensions: ready ? dimensions : AXES.map(() => null), total: ready ? Math.round(100 * sum / 96) : null, interval: ready ? [round(100 * sum / 96), round(100 * sum / 96)] : null, coverage: round(known / 24), confidence: known ? conf / known >= 0.8 ? "high" : conf / known >= 0.5 ? "medium" : "low" : "unknown" };
}
var round = (n) => Math.round(n * 1e3) / 1e3;
var unknownRatings = () => AXES.map(() => Array.from({ length: 4 }, () => ({ value: null, confidence: 0, evidence: [], basis: "unknown" })));
function publicScore(report, nickname = "") {
  validateReport(report);
  const s = summarize(report.ratings);
  if (s.total === null) throw Error("\u8BC1\u636E\u4E0D\u8DB3\uFF1A\u7981\u6B62\u5BFC\u51FA\u6216\u4E0A\u4F20\u6570\u503C\u8BC4\u5206");
  const result = { scoringVersion: report.scoringVersion, kind: "local-assessment", ...s };
  if (nickname.trim()) result.nickname = nickname.trim();
  return validatePublic(result);
}
var record = (x) => !!x && typeof x === "object" && !Array.isArray(x);
var keys = (x, allowed) => Object.keys(x).every((k) => allowed.includes(k));
var num = (x, max = 100) => typeof x === "number" && Number.isFinite(x) && x >= 0 && x <= max;
function validatePublic(x) {
  if (!record(x) || !keys(x, ["scoringVersion", "kind", "dimensions", "total", "interval", "coverage", "confidence", "nickname"])) throw Error("\u4EC5\u5141\u8BB8\u805A\u5408\u5B57\u6BB5");
  if (x.scoringVersion !== VERSION || !["local-assessment", "self-report"].includes(String(x.kind))) throw Error("\u8BC4\u5206\u7248\u672C\u6216\u7C7B\u578B\u65E0\u6548");
  if (!Array.isArray(x.dimensions) || x.dimensions.length !== 6 || !x.dimensions.every((v) => v === null || num(v))) throw Error("\u7EF4\u5EA6\u65E0\u6548");
  if (!Array.isArray(x.interval) || x.interval.length !== 2 || !x.interval.every((v) => num(v)) || x.interval[0] > x.interval[1]) throw Error("\u533A\u95F4\u65E0\u6548");
  if (!num(x.coverage, 1) || !["low", "medium", "high", "unknown"].includes(String(x.confidence)) || x.total !== null && !num(x.total)) throw Error("\u805A\u5408\u503C\u65E0\u6548");
  if (x.coverage !== 1 || x.total === null || x.confidence === "low" || x.confidence === "unknown") throw Error("\u8BC1\u636E\u4E0D\u8DB3\u4E0D\u5141\u8BB8\u516C\u5F00\u8BC4\u5206");
  if (Number(x.coverage) < 1 && x.total !== null) throw Error("\u8BC1\u636E\u4E0D\u5B8C\u6574\u65F6\u603B\u5206\u5FC5\u987B\u4E3A\u672A\u77E5");
  if (x.coverage === 1 && (x.dimensions.some((v) => v === null) || x.total === null || Math.round(x.dimensions.reduce((a, b) => a + b, 0) / 6) !== x.total || x.interval.some((v) => Math.abs(v - x.dimensions.reduce((a, b) => a + b, 0) / 6) > 2e-3))) throw Error("\u603B\u5206\u4E0D\u4E00\u81F4");
  if (x.nickname !== void 0 && (typeof x.nickname !== "string" || Array.from(x.nickname).length > 24 || /[\p{C}<>]/u.test(x.nickname))) throw Error("\u6635\u79F0\u965024\u5B57\u7B26\u4E14\u4E0D\u80FD\u5305\u542B\u63A7\u5236\u7B26\u6216HTML");
  return x;
}
function validateReport(x) {
  if (!record(x) || !keys(x, ["schemaVersion", "scoringVersion", "kind", "ratings", "evidence", "summary", "assessmentGate"]) || x.schemaVersion !== 1 || x.scoringVersion !== VERSION || !["local-assessment", "synthetic"].includes(String(x.kind))) throw Error("\u672C\u5730\u62A5\u544A\u7248\u672C\u65E0\u6548");
  if (!Array.isArray(x.evidence) || x.evidence.length > 512) throw Error("\u8BC1\u636E\u65E0\u6548");
  const ids = /* @__PURE__ */ new Set();
  for (const e of x.evidence) {
    if (!record(e) || !keys(e, ["id", "source", "fact", "strength"]) || typeof e.id !== "string" || !/^e\d+$/.test(e.id) || ids.has(e.id) || typeof e.fact !== "string" || e.fact.length > 160 || !["project-structure", "agent-structure", "workflow-record"].includes(String(e.source)) || !["structure", "declaration", "observation"].includes(String(e.strength))) throw Error("\u8BC1\u636E\u7ED3\u6784\u65E0\u6548");
    ids.add(e.id);
  }
  if (!Array.isArray(x.ratings) || x.ratings.length !== 6 || x.ratings.some((a) => !Array.isArray(a) || a.length !== 4)) throw Error("\u6307\u6807\u7ED3\u6784\u65E0\u6548");
  for (const a of x.ratings) for (const r of a) {
    if (!record(r) || !keys(r, ["value", "confidence", "evidence", "basis"]) || !["declared", "observed", "self-report", "unknown"].includes(String(r.basis)) || !Array.isArray(r.evidence) || !r.evidence.every((id) => typeof id === "string" && ids.has(id)) || typeof r.confidence !== "number") throw Error("\u6307\u6807\u8BC1\u636E\u65E0\u6548");
    if (r.value !== null && r.basis !== "self-report" && !r.evidence.length) throw Error("\u5DF2\u77E5\u6307\u6807\u5FC5\u987B\u6709\u8BC1\u636E");
    if (r.value === null && r.basis !== "unknown") throw Error("\u672A\u77E5\u6307\u6807\u6765\u6E90\u65E0\u6548");
  }
  const summary = summarize(x.ratings);
  if (summary.total !== null && (!record(x.assessmentGate) || x.assessmentGate.status !== "ready" || x.assessmentGate.reviewComplete !== true || x.assessmentGate.familiesFinalized !== true || x.assessmentGate.counterexamplesReviewed !== true)) throw Error("\u62A5\u544A\u672A\u901A\u8FC7\u5BA1\u9605\u4E0E\u4EFB\u52A1\u5BB6\u65CF\u5C31\u7EEA\u95E8\u69DB");
  if (JSON.stringify(x.summary) !== JSON.stringify(summary)) throw Error("\u6C47\u603B\u4E0E\u6307\u6807\u4E0D\u4E00\u81F4");
  return x;
}

// src/collector.ts
import { lstat as lstat2, realpath as realpath2, open, readdir as readdir2 } from "node:fs/promises";
import { constants } from "node:fs";
import { resolve as resolve2, relative, join as join2 } from "node:path";
import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
var MAX_FILE = 1024 * 1024;
var MAX_TOTAL = 8 * 1024 * 1024;
var MAX_FILES = 200;
var MAX_ITEMS = 500;
var MAX_TIME = 2e4;
var denied = /(^|\/)(\.env[^/]*|\.git|node_modules|auth[^/]*|credentials?[^/]*|secrets?[^/]*|\.ssh|\.aws|\.config|Library|Cookies|Login Data|Keychains|keychain[^/]*|\.azure|\.kube|\.gnupg|\.npmrc|\.netrc|\.pypirc)(\/|$)/i;
function validateScope(x) {
  const s = x;
  if (!s || !["structure", "deep"].includes(s.mode) || !Array.isArray(s.projects) || !Array.isArray(s.agents) || !Array.isArray(s.histories) || s.projects.length + s.agents.length + s.histories.length > 256 || ![...s.projects, ...s.agents].every((p) => typeof p === "string" && p.length < 1024)) throw Error("\u8303\u56F4\u914D\u7F6E\u65E0\u6548");
  const validDate = (v) => /^\d{4}-\d{2}-\d{2}$/.test(v) && Number.isFinite(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v;
  if (!validDate(s.from) || !validDate(s.to) || s.from > s.to) throw Error("\u8BF7\u63D0\u4F9B\u6709\u6548\u65E5\u671F\u8303\u56F4");
  if (s.mode === "structure" && s.histories.length) throw Error("\u5386\u53F2\u8BB0\u5F55\u9700\u8981 deep \u6A21\u5F0F");
  for (const h of s.histories) if (!h || !["codex", "hermes-json", "hermes-sqlite", "normalized-export"].includes(h.adapter) || typeof h.instance !== "string" || !/^[A-Za-z0-9_.-]{1,64}$/.test(h.instance) || typeof h.path !== "string" || h.path.length > 1024) throw Error("\u9002\u914D\u5668\u914D\u7F6E\u65E0\u6548");
  return s;
}
var scopeDigest = (s) => createHash("sha256").update(JSON.stringify(s)).digest("hex");
function redact(input) {
  return input.replace(/^(\s*(?:Cookie|Set-Cookie)\s*:)\s*[^\n]*/gim, "$1 [SECRET HEADER]").replace(/-----BEGIN[^\n]*PRIVATE KEY-----[\s\S]*?-----END[^\n]*PRIVATE KEY-----/g, "[SECRET]").replace(/((?:api[_ -]?key|access[_ -]?token|refresh[_ -]?token|authorization|client[_ -]?secret|password|passwd|密钥|密码|验证码|\btoken\b|cookie|set-cookie)\s*[:=]\s*)(?:Bearer\s+)?[^\s,;，；]+/gi, "$1[SECRET]").replace(/((?:one[- ]time (?:password|code)|verification code|OTP|验证码)(?:\s+(?:is|was|为|是))?\s*[:：]?\s*)[A-Za-z0-9-]{4,12}/gi, "$1[SECRET]").replace(/\b(?:sk-[A-Za-z0-9_-]{8,}|gh[pousr]_[A-Za-z0-9]{8,}|github_pat_[A-Za-z0-9_]{20,}|AKIA[A-Z0-9]{16}|eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)\b/g, "[SECRET]").replace(/https?:\/\/[^\s)<>\u3400-\u9fff]+/g, "[URL]").replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[EMAIL]").replace(/(?:\/Users\/|\/home\/|[A-Z]:\\)[^\s"'<>\u3400-\u9fff]+/g, "[LOCAL PATH]").replace(/\b(?:\+?\d[\d -]{9,}\d)\b/g, "[NUMBER]").replace(/\b[A-Za-z0-9_+/=-]{32,}\b/g, "[LONG IDENTIFIER]").slice(0, 3e3);
}
async function safePath(path, root) {
  const abs = resolve2(path), base = resolve2(root);
  if (denied.test(abs) || relative(base, abs).startsWith("..")) throw Error("\u7981\u6B62\u7684\u626B\u63CF\u8DEF\u5F84");
  const parts = abs.split("/").filter(Boolean);
  let current = "/";
  for (const part of parts) {
    current = join2(current, part);
    if ((await lstat2(current)).isSymbolicLink()) throw Error("\u4E0D\u626B\u63CF\u7B26\u53F7\u94FE\u63A5");
  }
  const actual = await realpath2(abs);
  if (actual !== abs) throw Error("\u8DEF\u5F84\u53D1\u751F\u53D8\u5316");
  return abs;
}
async function collect(scope, confirmation) {
  validateScope(scope);
  if (confirmation !== scopeDigest(scope)) throw Error("\u626B\u63CF\u524D\u9700\u8981\u786E\u8BA4\u8303\u56F4\u6458\u8981");
  const inventory = await discover();
  const sources = [];
  const started = Date.now();
  const ledger = [];
  const evidence = [];
  const diagnostics = [];
  const stats = { files: 0, bytes: 0, skipped: 0, truncated: false };
  let sourceId = "", snapshotId = "";
  const budget = () => {
    if (Date.now() - started > MAX_TIME || stats.files >= MAX_FILES || stats.bytes >= MAX_TOTAL || ledger.length >= MAX_ITEMS) {
      stats.truncated = true;
      return false;
    }
    return true;
  };
  async function read(path, root) {
    if (!budget()) return null;
    let handle;
    try {
      await safePath(path, root);
      const stat = await lstat2(path);
      if (!stat.isFile() || Math.min(stat.size, MAX_FILE) + stats.bytes > MAX_TOTAL) {
        stats.skipped++;
        stats.truncated = true;
        if (diagnostics.length < 128) diagnostics.push({ target: path, reason: stat.isFile() ? "total-byte-limit" : "not-regular-file" });
        return null;
      }
      handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
      const opened = await handle.stat();
      if (!opened.isFile() || opened.ino !== stat.ino || opened.dev !== stat.dev) throw Error("\u626B\u63CF\u671F\u95F4\u6587\u4EF6\u6539\u53D8");
      let text2, used;
      if (stat.size > MAX_FILE) {
        stats.truncated = true;
        stats.skipped++;
        diagnostics.push({ target: path, reason: "oversized-file-needs-selected-export" });
        return null;
      }
      const buffer = Buffer.alloc(stat.size);
      const result = await handle.read(buffer, 0, buffer.length, 0);
      used = result.bytesRead;
      text2 = buffer.subarray(0, used).toString("utf8");
      stats.files++;
      stats.bytes += used;
      snapshotId = createHash("sha256").update(path + "|" + stat.size + "|" + stat.mtimeMs).digest("hex");
      return text2;
    } catch (error) {
      stats.skipped++;
      if (diagnostics.length < 128) diagnostics.push({ target: path, reason: ["EPERM", "EACCES"].includes(String(error?.code)) ? "permission-denied" : error?.code === "ENOENT" ? "missing-file" : "unsafe-or-changed-path" });
      return null;
    } finally {
      await handle?.close();
    }
  }
  function add(task, date, actor, instance, text2, locator = "", type = "unknown", verification = "unverified") {
    if (!/^\d{4}-\d{2}-\d{2}/.test(date) || !Number.isFinite(Date.parse(date)) || !budget() || date.slice(0, 10) < scope.from || date.slice(0, 10) > scope.to) return;
    const clean = redact(text2);
    if (clean.length >= 3e3) {
      stats.truncated = true;
      diagnostics.push({ target: locator, reason: "redacted-body-limit" });
    }
    if (!clean.trim()) return;
    const contentRef = createHash("sha256").update(clean).digest("hex");
    const eventId = createHash("sha256").update(sourceId + "|" + locator).digest("hex");
    ledger.push({ id: "e" + (ledger.length + 1), eventId, sourceId, snapshotId, contentRef, task: createHash("sha256").update(instance + "|" + task).digest("hex").slice(0, 12), date, actor, instance, text: clean, untrusted: true, locator, type, verification });
  }
  async function walk(root, exts, callback, depth = 0) {
    if (depth > 8) {
      stats.truncated = true;
      return;
    }
    if (!budget()) return;
    try {
      await safePath(root, root);
      const entries = await readdir2(root, { withFileTypes: true });
      for (const e of entries.sort((a, b) => a.name.localeCompare(b.name))) {
        if (!budget()) break;
        const p = join2(root, e.name);
        if (denied.test(p) || e.isSymbolicLink()) {
          stats.skipped++;
          if (diagnostics.length < 128) diagnostics.push({ target: p, reason: "excluded-sensitive-or-symlink" });
          continue;
        }
        if (e.isDirectory()) await walk(p, exts, callback, depth + 1);
        else if (e.isFile() && exts.some((ext) => e.name.endsWith(ext))) await callback(p);
        else if (!e.isFile()) stats.skipped++;
      }
    } catch {
      stats.skipped++;
    }
  }
  for (const root of scope.projects) {
    for (const name of ["AGENTS.md", "package.json", ".github/workflows/ci.yml", ".github/workflows/ci.yaml"]) {
      const raw = await read(join2(root, name), root);
      if (raw !== null) evidence.push({ id: "e" + (evidence.length + 1), source: "project-structure", fact: name === "package.json" ? "\u9879\u76EE\u5305\u542B\u5305\u6E05\u5355\uFF08\u4E0D\u8BC1\u660E\u5B8C\u6210\u8D28\u91CF\uFF09" : name === "AGENTS.md" ? "\u9879\u76EE\u5305\u542B agent \u5DE5\u4F5C\u8BF4\u660E\uFF08\u4E0D\u8BC1\u660E\u5DF2\u9075\u5B88\uFF09" : "\u9879\u76EE\u5305\u542B\u6301\u7EED\u96C6\u6210\u914D\u7F6E\uFF08\u4E0D\u8BC1\u660E\u68C0\u67E5\u901A\u8FC7\uFF09", strength: "structure" });
    }
  }
  for (const root of scope.agents) {
    await walk(join2(root, "skills"), ["SKILL.md"], async (p) => {
      const raw = await read(p, root);
      if (raw !== null && evidence.length < 128) evidence.push({ id: "e" + (evidence.length + 1), source: "agent-structure", fact: "\u5B58\u5728\u6280\u80FD\u5143\u6570\u636E\uFF08\u4E0D\u8BC1\u660E\u5B9E\u9645\u4F7F\u7528\uFF09", strength: "structure" });
    });
  }
  for (const h of scope.histories) {
    const before = ledger.length, skips = stats.skipped;
    sourceId = createHash("sha256").update(h.adapter + "|" + h.instance + "|" + resolve2(h.path)).digest("hex");
    if (h.adapter === "hermes-sqlite") {
      if (!budget()) break;
      try {
        await safePath(h.path, h.path);
        const st = await lstat2(h.path);
        snapshotId = createHash("sha256").update(h.path + "|" + st.size + "|" + st.mtimeMs).digest("hex");
        if (!st.isFile() || st.size > 2 * 1024 ** 3) throw Error("\u6570\u636E\u5E93\u4E0D\u652F\u6301");
        const r = await promisify(execFile)("python3", [join2(import.meta.dirname, "../scripts/hermes_read.py"), h.path, scope.from, scope.to], { timeout: Math.min(15e3, MAX_TIME - (Date.now() - started)), maxBuffer: MAX_TOTAL - stats.bytes });
        stats.files++;
        stats.bytes += Buffer.byteLength(r.stdout);
        const rows = JSON.parse(r.stdout);
        if (!Array.isArray(rows)) throw Error("\u6570\u636E\u5E93\u7ED3\u6784\u4E0D\u652F\u6301");
        if (rows.length >= MAX_ITEMS) stats.truncated = true;
        for (const m of rows) {
          if (m.truncated) stats.truncated = true;
          add(String(m.task), String(m.date), m.role === "user" ? "human" : "agent", h.instance, String(m.text), String(m.locator));
        }
      } catch {
        stats.skipped++;
        if (diagnostics.length < 128) diagnostics.push({ target: h.path, reason: "unsupported-schema-or-read-denied-or-query-limit" });
      }
    } else {
      await walk(h.path, h.adapter === "codex" ? [".jsonl"] : [".json", ".jsonl"], async (p) => {
        const datePath = relative(h.path, p).match(/^(\d{4})\/(\d{2})\/(\d{2})\//);
        if (h.adapter === "codex" && datePath) {
          const d = datePath.slice(1).join("-");
          if (d < scope.from || d > scope.to) return;
        }
        const raw = await read(p, h.path);
        if (raw === null) return;
        let rows;
        try {
          if (p.endsWith(".jsonl")) rows = raw.split("\n").map((l) => {
            if (!l.trim()) return null;
            try {
              return JSON.parse(l);
            } catch {
              stats.truncated = true;
              return null;
            }
          });
          else {
            const doc = JSON.parse(raw);
            rows = Array.isArray(doc) ? doc : doc.messages ?? [];
          }
        } catch {
          stats.skipped++;
          stats.truncated = true;
          return;
        }
        let sessionDate = "", task = relative(h.path, p), rowNumber = 0;
        for (const item of rows) {
          rowNumber++;
          const m = item;
          if (!m) continue;
          if (h.adapter === "normalized-export") {
            if (typeof m.task !== "string" || typeof m.text !== "string" || !["human", "agent", "thirdparty", "unknown"].includes(m.actor)) throw Error("\u5BFC\u51FA\u683C\u5F0F\u65E0\u6548");
            add(m.task, m.date, m.actor, h.instance, m.text, relative(h.path, p) + ":" + rowNumber, ["intent", "action", "artifact", "verifiedoutcome"].includes(m.type) ? m.type : "unknown", "unverified");
            continue;
          }
          if (!m) continue;
          if (m.type === "session_meta") {
            sessionDate = m.payload?.timestamp ?? m.timestamp ?? "";
            task = m.payload?.source?.subagent?.thread_spawn?.parent_thread_id ?? m.payload?.forked_from_id ?? m.payload?.id ?? task;
          }
          const rawDate = m.timestamp ?? m.date ?? sessionDate;
          const date = typeof rawDate === "number" ? new Date(rawDate * (rawDate < 1e11 ? 1e3 : 1)).toISOString() : rawDate;
          if (typeof date !== "string") continue;
          const payload = m.payload ?? m;
          const role = payload.role ?? (payload.type === "user_message" ? "user" : payload.type === "agent_message" ? "assistant" : null);
          if (!["user", "assistant"].includes(role)) continue;
          const content = payload.message ?? payload.content;
          const text2 = typeof content === "string" ? content : Array.isArray(content) ? content.filter((x) => ["input_text", "output_text", "text"].includes(x.type)).map((x) => x.text ?? "").join("\n") : "";
          add(task, date, role === "user" ? "human" : "agent", h.instance, text2, relative(h.path, p) + ":" + rowNumber);
        }
      });
    }
    sources.push({ tool: h.adapter === "codex" ? "Codex" : h.adapter.startsWith("hermes") ? "Hermes" : "User export", instance: h.instance, authorization: "granted", read: ledger.length > before ? "read" : stats.skipped > skips ? "failed" : "empty", adapter: h.adapter, records: ledger.length - before });
  }
  ledger.sort((a, b) => Date.parse(a.date) - Date.parse(b.date));
  const ratings = unknownRatings();
  return { report: { schemaVersion: 1, scoringVersion: VERSION, kind: "local-assessment", ratings, evidence, summary: summarize(ratings) }, ledger, stats, diagnostics, discovery: inventory, scope, sources };
}

// src/evaluate.ts
var text = (x) => typeof x === "string" && x.trim().length > 0 && x.length <= 2e3;
function applyEvaluation(collection, input) {
  const e = structuredClone(input);
  if (!e || !Array.isArray(e.decisions) || e.decisions.length !== 24 || !e.narrative || !Array.isArray(collection.ledger)) throw Error("\u8BC4\u4F30\u9700\u898124\u9879\u51B3\u7B56\u548C\u6587\u5B57\u8BC4\u4EF7");
  const lookup = new Map(collection.ledger.map((x) => [x.id, x]));
  if (lookup.size !== collection.ledger.length) throw Error("\u8BC1\u636EID\u91CD\u590D");
  const seen = /* @__PURE__ */ new Set();
  const ratings = unknownRatings();
  const knownTasks = new Set(collection.ledger.map((x) => x.task));
  if (e.taskGroups && (typeof e.taskGroups !== "object" || Array.isArray(e.taskGroups) || Object.entries(e.taskGroups).some(([t, g]) => !knownTasks.has(t) || !text(g) || g.length > 64))) throw Error("\u4EFB\u52A1\u5206\u7EC4\u65E0\u6548");
  const group = (x) => e.taskGroups?.[x.task] ?? x.task;
  const ids = (x) => Array.isArray(x) && x.length <= 500 && x.every((id) => typeof id === "string" && lookup.has(id));
  const review = e.review;
  if (!review || !ids(review.reviewedEvidence) || !Array.isArray(review.excludedEvidence) || review.excludedEvidence.some((x) => !lookup.has(x.id) || !text(x.reason))) throw Error("\u7F3A\u5C11\u9010\u4E8B\u4EF6\u5BA1\u9605\u4E0E\u6392\u9664\u6E05\u5355");
  const reviewed = new Set(review.reviewedEvidence), excluded = new Set(review.excludedEvidence.map((x) => x.id));
  if ([...excluded].some((id) => reviewed.has(id)) || reviewed.size !== review.reviewedEvidence.length || excluded.size !== review.excludedEvidence.length) throw Error("\u5BA1\u9605\u4E0E\u6392\u9664\u51B2\u7A81");
  const reviewReady = review.taskFamiliesFinalized === true && review.counterexampleSearchComplete === true && lookup.size === reviewed.size + excluded.size;
  for (const d of e.decisions) {
    if (!Number.isInteger(d.axis) || d.axis < 0 || d.axis > 5 || !Number.isInteger(d.indicator) || d.indicator < 0 || d.indicator > 3 || seen.has(`${d.axis}:${d.indicator}`) || !["low", "medium", "high"].includes(d.quality)) throw Error("\u51B3\u7B56\u7D22\u5F15\u65E0\u6548");
    seen.add(`${d.axis}:${d.indicator}`);
    if (!ids(d.support) || !ids(d.counterexamples) || [...d.support, ...d.counterexamples].some((id) => !reviewed.has(id))) throw Error("\u8BC1\u636EID\u4E0D\u5B58\u5728");
    for (const key of ["rationale", "humanContribution", "agentActivity", "outcome", "counterReview", "uncertainty", "nextLevelGap"]) if (!text(d[key])) throw Error("\u6BCF\u9879\u9700\u8981\u951A\u70B9\u3001\u53CD\u4F8B\u68C0\u7D22\u3001\u4E0D\u786E\u5B9A\u6027\u548C\u4E0B\u4E00\u7EA7\u5DEE\u8DDD");
    if (!d.improvement || !text(d.improvement.action) || !text(d.improvement.verify) || !["none-found", "resolved", "unresolved"].includes(d.conflict) || !Array.isArray(d.observations) || d.observations.length > 128) throw Error("\u7F3A\u5C11\u53EF\u9A8C\u8BC1\u6539\u8FDB\u6216\u51B2\u7A81\u5904\u7F6E");
    if (d.support.some((id) => d.counterexamples.includes(id))) throw Error("\u6B63\u53CD\u8BC1\u636E\u4E0D\u80FD\u6DF7\u4E3A\u4E00\u6761");
    if (d.value !== null && (!Number.isInteger(d.value) || d.value < 0 || d.value > 4)) throw Error("\u951A\u70B9\u65E0\u6548");
    const tasks = /* @__PURE__ */ new Set();
    for (const o of d.observations) {
      const b = lookup.get(o.behavior), r = lookup.get(o.result), v = lookup.get(o.verification);
      if (!b || !r || !v || ![o.behavior, o.result, o.verification].every((id) => d.support.includes(id)) || !text(o.scope)) throw Error("\u884C\u4E3A\u94FE\u5F15\u7528\u65E0\u6548");
      if (!["decision", "action", "request-only"].includes(o.enactment) || !["verified", "failure", "claim-only"].includes(o.outcome) || !["human", "agent", "unknown"].includes(o.attribution) || !["human-followup", "independent-artifact"].includes(o.verificationMethod)) throw Error("\u884C\u4E3A\u94FE\u5206\u7C7B\u65E0\u6548");
      if (o.enactment === "request-only" || o.outcome === "claim-only" || o.attribution !== "human" || b.actor !== "human" || (/* @__PURE__ */ new Set([o.behavior, o.result, o.verification])).size !== 3) continue;
      if (Date.parse(b.date) > Date.parse(r.date) || Date.parse(r.date) > Date.parse(v.date) || !Number.isFinite(Date.parse(b.date)) || !Number.isFinite(Date.parse(r.date)) || !Number.isFinite(Date.parse(v.date))) continue;
      if (group(b) !== group(r) || group(b) !== group(v) || collection.ledger.indexOf(v) <= collection.ledger.indexOf(r) || collection.ledger.indexOf(r) <= collection.ledger.indexOf(b)) continue;
      if (o.verificationMethod === "human-followup" ? v.actor !== "human" : !(v.actor === "thirdparty" && v.type === "verifiedoutcome")) continue;
      if (d.value === 0 && o.outcome !== "failure") continue;
      tasks.add(group(b));
    }
    const needed = d.value === 4 ? 3 : d.value === 3 ? 2 : 1;
    const blocked = d.value !== null && (!reviewReady || tasks.size < needed || d.quality === "low" || d.conflict === "unresolved" || collection.stats.truncated || collection.sources?.some((s) => s.read === "failed"));
    if (blocked) {
      d.value = null;
      d.rationale = redact(d.rationale + "\uFF1B\u8BC1\u636E\u95E8\u69DB\u672A\u6EE1\u8DB3\uFF1A\u9700\u8981\u72EC\u7ACB\u5B8C\u6574\u884C\u4E3A\u94FE\u3001\u4E2D\u9AD8\u8BC1\u636E\u8D28\u91CF\u3001\u51B2\u7A81\u5904\u7F6E\u548C\u672A\u622A\u65AD\u8F93\u5165\u3002");
    }
    if (d.value === null) continue;
    ratings[d.axis][d.indicator] = { value: d.value, confidence: d.quality === "high" ? 0.9 : 0.6, evidence: [.../* @__PURE__ */ new Set([...d.support, ...d.counterexamples])], basis: "observed" };
  }
  if (!Array.isArray(e.priorities) || e.priorities.length < 2 || e.priorities.length > 3 || e.priorities.some((p) => !text(p.action) || !text(p.verify) || !ids(p.evidence))) throw Error("\u62A5\u544A\u9700\u89812\u20133\u9879\u6709\u9A8C\u8BC1\u65B9\u5F0F\u7684\u4F18\u5148\u884C\u52A8");
  for (const key of ["strengths", "gaps", "workPatterns", "lifePatterns", "actions", "limitations"]) {
    const a = e.narrative[key];
    if (!Array.isArray(a) || a.length > 12 || a.some((t) => !text(t))) throw Error("\u6587\u5B57\u8BC4\u4EF7\u65E0\u6548");
    if (["strengths", "workPatterns", "lifePatterns"].includes(key) && a.some((t) => !Array.from(t.matchAll(/\be\d+\b/g)).some((m) => lookup.has(m[0])))) throw Error("\u6A21\u5F0F\u4E0E\u5F3A\u9879\u7ED3\u8BBA\u5FC5\u987B\u56DE\u94FE\u8BC1\u636E\uFF1B\u65E0\u8BC1\u636E\u65F6\u7559\u7A7A");
    e.narrative[key] = a.map(redact);
  }
  const used = new Set(ratings.flat().flatMap((r) => r.evidence));
  const evidence = [...used].map((id) => ({ id, source: "workflow-record", fact: "\u5DF2\u6388\u6743\u53BB\u654F\u884C\u4E3A\u94FE\uFF1B\u5177\u4F53\u652F\u6301\u8303\u56F4\u3001\u53CD\u8BC1\u4E0E\u6838\u9A8C\u89C1\u79C1\u5BC6\u8BC4\u4F30\u6587\u4EF6", strength: "observation" }));
  return { report: { schemaVersion: 1, scoringVersion: VERSION, kind: "local-assessment", ratings, evidence, summary: summarize(ratings), assessmentGate: { status: summarize(ratings).total === null ? "blocked" : "ready", reviewComplete: lookup.size === reviewed.size + excluded.size, familiesFinalized: review.taskFamiliesFinalized, counterexamplesReviewed: review.counterexampleSearchComplete } }, evaluation: e };
}
function writtenReport(report, evaluation, ledger = [], collection) {
  const s = report.summary, ready = s.total !== null;
  const clean = (x) => redact(x).replace(/[\r\n]+/g, " ").replace(/[。；]+$/g, "").replace(/。([。；])/g, "$1");
  const lines = ["# AI Native Score \u672C\u5730\u8BC4\u4EF7", "", report.kind === "synthetic" || collection?.report.kind === "synthetic" ? "\u5408\u6210\u793A\u4F8B\uFF1A\u6240\u6709\u4E8B\u4EF6\u548C\u5206\u6570\u4EC5\u7528\u4E8E\u5C55\u793A\u534F\u8BAE\u4E0E\u8BA1\u7B97\uFF0C\u4E0D\u8BC4\u4EF7\u4EFB\u4F55\u771F\u5B9E\u7528\u6237\u3002" : "\u79C1\u5BC6\u8BC4\u4F30\uFF1A\u4EC5\u9002\u7528\u4E8E\u672C\u6B21\u660E\u786E\u9009\u5B9A\u7684\u8303\u56F4\u3002", ready ? `\u53EF\u4EE5\u8D1F\u8D23\u7684\u7ED3\u8BBA\uFF1A\u672C\u6B21\u9009\u5B9A\u8303\u56F4\u6EE1\u8DB3\u8BC4\u5206\u95E8\u69DB\uFF0C\u603B\u5206 ${s.total} / 100\u3002` : "\u53EF\u4EE5\u8D1F\u8D23\u7684\u7ED3\u8BBA\uFF1A\u8BC1\u636E\u4E0D\u8DB3\uFF0C\u6682\u4E0D\u8BC4\u5206\u3002\u5F53\u524D\u53EA\u80FD\u8BF4\u660E\u89C2\u5BDF\u5230\u7684\u884C\u4E3A\u4E0E\u7F3A\u53E3\uFF1B\u6CA1\u6709\u8BC1\u636E\u4E0D\u4EE3\u8868\u80FD\u529B\u4F4E\u3002", "", `\u8BC4\u5206\u7248\u672C\uFF1A${VERSION}\u3002\u539F\u521B\u7EFC\u5408\u6307\u6807\uFF0C\u975E\u8BA4\u8BC1\u3001\u672A\u7ECF\u6D4B\u91CF\u6548\u5EA6\u9A8C\u8BC1\u3002`, `\u6307\u6807\u8BC1\u636E\u8986\u76D6\uFF1A${Math.round(s.coverage * 100)}%\uFF1B\u8BC1\u636E\u8D28\u91CF\uFF1A${{ low: "\u4F4E", medium: "\u4E2D", high: "\u9AD8", unknown: "\u672A\u77E5" }[s.confidence]}\uFF08\u4E0D\u662F\u6982\u7387\uFF09\u3002\u8BB0\u5F55\u6570\u91CF\u548C\u8017\u65F6\u4E0D\u52A0\u5206\u3002`, ""];
  lines.push("## \u8986\u76D6\u4E0E\u9057\u6F0F", "", `\u65F6\u95F4\u8303\u56F4\uFF1A${collection?.scope ? collection.scope.from + " \u81F3 " + collection.scope.to + "\uFF08UTC\uFF09" : "\u672A\u63D0\u4F9B\uFF0C\u4E0D\u80FD\u63A8\u65AD\u5B8C\u6574\u65F6\u95F4\u8986\u76D6"}\u3002`, `\u8BFB\u53D6\u6587\u4EF6\uFF1A${collection?.stats.files ?? "\u672A\u77E5"}\uFF1B\u53BB\u654F\u8BB0\u5F55\uFF1A${ledger.length}\uFF1B\u72EC\u7ACB\u4EFB\u52A1\u5019\u9009\uFF1A${new Set(ledger.map((x) => evaluation?.taskGroups?.[x.task] ?? x.task)).size}\u3002\u5019\u9009\u4EFB\u52A1\u6570\u4E0D\u7B49\u4E8E\u5DF2\u6838\u9A8C\u6709\u6548\u4EFB\u52A1\u6570\u3002`, `\u622A\u65AD\uFF1A${collection?.stats.truncated ? "\u662F\uFF0C\u9700\u7F29\u5C0F\u8303\u56F4\u8865\u67E5" : "\u672A\u62A5\u544A\u622A\u65AD"}\uFF1B\u8DF3\u8FC7\uFF1A${collection?.stats.skipped ?? "\u672A\u77E5"}\u3002`, "");
  for (const source of collection?.sources ?? []) lines.push(`- ${clean(source.tool)} / ${clean(source.instance)}\uFF1A\u9002\u914D ${source.adapter}\uFF1B\u6388\u6743 ${source.authorization}\uFF1B\u8BFB\u53D6 ${source.read}\uFF1B\u53BB\u654F\u8BB0\u5F55 ${source.records}\u3002`);
  for (const source of collection?.discovery?.sources ?? []) lines.push(`- \u53D1\u73B0 ${clean(source.tool)} / ${clean(source.instance)}\uFF1A${source.discovery}\uFF1B\u9002\u914D ${source.adapter ?? "\u672A\u9002\u914D"}\uFF1B\u6388\u6743 ${source.authorization}\uFF1B\u8BFB\u53D6 ${source.read}${source.exportRequired ? "\uFF1B\u9700\u9009\u5B9A\u5BFC\u51FA\u6216\u683C\u5F0F\u9002\u914D" : ""}\u3002`);
  lines.push(...(collection?.diagnostics ?? []).map((x) => `- \u6392\u9664/\u9057\u6F0F\uFF1A${clean(x.reason)}\uFF1B\u5177\u4F53\u8DEF\u5F84\u4FDD\u5B58\u5728\u79C1\u5BC6 collection \u6587\u4EF6\u3002`), "", collection?.discovery ? "\u53D1\u73B0\u6E05\u5355\u4E2D\u7684 not-granted/not-read \u63CF\u8FF0\u53D1\u73B0\u65F6\u72B6\u6001\uFF1B\u6388\u6743\u8BFB\u53D6\u7ED3\u679C\u63CF\u8FF0\u672C\u8F6E\u6536\u96C6\u72B6\u6001\u3002\u672A\u77E5\u6216\u4E0D\u53EF\u8BBF\u95EE\u6765\u6E90\u4E0D\u6263\u80FD\u529B\u5206\u3002" : "\u672A\u6267\u884C\u771F\u5B9E\u73AF\u5883\u53D1\u73B0\uFF0C\u8986\u76D6\u53EA\u9650\u8FD9\u91CC\u660E\u786E\u5217\u51FA\u7684\u6765\u6E90\uFF1B\u5176\u5B83\u73AF\u5883\u53EF\u80FD\u9057\u6F0F\uFF0C\u4E0D\u80FD\u636E\u6B64\u63A8\u65AD\u80FD\u529B\u4F4E\u3002", "");
  if (evaluation) lines.push(`\u5BA1\u9605\u95ED\u5408\uFF1A\u5DF2\u5BA1\u4E8B\u4EF6 ${evaluation.review.reviewedEvidence.length}\uFF1B\u660E\u786E\u6392\u9664 ${evaluation.review.excludedEvidence.length}\uFF1B\u4EFB\u52A1\u5BB6\u65CF ${evaluation.review.taskFamiliesFinalized ? "\u5DF2\u5B9A\u7A3F" : "\u672A\u5B8C\u6210"}\uFF1B\u53CD\u8BC1\u68C0\u7D22 ${evaluation.review.counterexampleSearchComplete ? "\u5DF2\u5B8C\u6210" : "\u672A\u5B8C\u6210"}\u3002\u6E05\u5355\u4FDD\u5B58\u5728\u540C\u76EE\u5F55 evaluation.private.json \u7684 review \u5B57\u6BB5\u3002`, "", ...evaluation.review.excludedEvidence.map((x) => `- \u6392\u9664 ${x.id}\uFF1A${clean(x.reason)}\u3002`), "");
  const titles = { strengths: "\u771F\u5B9E\u5F3A\u9879", gaps: "\u7F3A\u53E3\u4E0E\u53CD\u4F8B", workPatterns: "\u5DE5\u4F5C\u4E2D\u7684\u884C\u4E3A\u6A21\u5F0F", lifePatterns: "\u751F\u6D3B\u4E2D\u7684\u884C\u4E3A\u6A21\u5F0F" };
  for (const [key, title] of Object.entries(titles)) {
    const entries = evaluation?.narrative[key] ?? [];
    lines.push(`## ${title}`, "", ...entries.length ? entries.map((t) => "- " + clean(t)) : ["\u5C1A\u65E0\u8DB3\u591F\u53EF\u56DE\u94FE\u8BC1\u636E\u652F\u6301\u6B64\u7C7B\u7ED3\u8BBA\u3002"], "");
  }
  lines.push("## \u4F18\u5148\u884C\u52A8\u4E0E\u9A8C\u8BC1", "");
  if (evaluation) for (const [i, p] of evaluation.priorities.entries()) lines.push(`${i + 1}. ${clean(p.action)} \u9A8C\u8BC1\uFF1A${clean(p.verify)}\u3002\u4F9D\u636E\uFF1A${p.evidence.join(", ") || "\u5F53\u524D\u8986\u76D6\u7F3A\u53E3\uFF0C\u975E\u80FD\u529B\u7F3A\u9677"}\u3002`);
  else lines.push("1. \u9009\u62E9\u4E00\u4E2A\u660E\u786E\u65E5\u671F\u8303\u56F4\u548C\u5B9E\u9645\u4EFB\u52A1\uFF0C\u8865\u9F50\u7528\u6237\u51B3\u7B56\u3001\u6267\u884C\u7ED3\u679C\u4E0E\u4EBA\u7C7B\u540E\u7EED\u6838\u9A8C\uFF1B\u9A8C\u8BC1\uFF1A\u4E09\u7C7B\u8BB0\u5F55\u80FD\u56DE\u94FE\u5230\u540C\u4E00\u4EFB\u52A1\u3002", "2. \u5BF9\u672A\u8BFB\u53D6\u5DE5\u5177\u5BFC\u51FA\u6240\u9009\u4EFB\u52A1\u7684 JSON/JSONL\uFF0C\u68C0\u67E5\u53BB\u654F\u540E\u518D\u6388\u6743\u6536\u96C6\uFF1B\u9A8C\u8BC1\uFF1A\u6765\u6E90\u3001\u65E5\u671F\u3001\u89D2\u8272\u4E0E\u9057\u6F0F\u5747\u6709\u8BB0\u5F55\u3002");
  if (!ready) lines.push("", "\u4E0B\u4E00\u6B65\uFF1A\u7F29\u5C0F\u65E5\u671F\u8303\u56F4\u8865\u67E5\u6216\u4ECE\u672A\u9002\u914D\u5DE5\u5177\u5BFC\u51FA\u3002\u672A\u751F\u6210\u4EFB\u4F55\u4E34\u65F6\u603B\u5206\u3001\u7EF4\u5EA6\u5206\u3001\u5206\u6570\u533A\u95F4\u3001\u96F7\u8FBE\u6216\u53EF\u4E0A\u4F20\u805A\u5408\u6587\u4EF6\u3002");
  lines.push("", "## \u516D\u7EF4\u5B9A\u6027\u5206\u6790", "");
  AXES.forEach((a, i) => {
    lines.push(`### ${a}${ready ? " \xB7 " + Math.round(s.dimensions[i]) + "/100" : ""}`, "");
    INDICATORS[i].forEach((name, j) => {
      const r = report.ratings[i][j], d = evaluation?.decisions.find((d2) => d2.axis === i && d2.indicator === j);
      lines.push(`- ${name}\uFF1A${ready ? r.value + " / 4" : r.value === null ? "\u5F85\u8865\u8BC1\u636E" : "\u5DF2\u89C2\u5BDF\u5230\u76F8\u5173\u884C\u4E3A\uFF0C\u6574\u4F53\u6682\u4E0D\u8BC4\u5206"}\u3002${d ? clean(d.rationale) : "\u7ED3\u6784\u5143\u6570\u636E\u4E0D\u8DB3\u4EE5\u8BC1\u660E\u5B9E\u9645\u80FD\u529B\u3002"}`);
      if (d) lines.push(`  \u4EBA\u7C7B\u8D21\u732E\uFF1A${clean(d.humanContribution)}\uFF1Bagent \u6D3B\u52A8\uFF1A${clean(d.agentActivity)}\uFF1B\u7ED3\u679C\uFF1A${clean(d.outcome)}\u3002`, `  \u4E3A\u4F55\u4E0D\u8DB3\u4E0B\u4E00\u7EA7\uFF1A${clean(d.nextLevelGap)}\uFF1B\u53CD\u8BC1\uFF1A${d.counterexamples.join(", ") || "\u672A\u53D1\u73B0\uFF0C\u4E0D\u4EE3\u8868\u4E0D\u5B58\u5728"}\uFF1B\u68C0\u7D22\uFF1A${clean(d.counterReview)}\uFF1B\u51B2\u7A81\uFF1A${{ "none-found": "\u672A\u53D1\u73B0", "resolved": "\u5DF2\u5904\u7F6E", "unresolved": "\u672A\u89E3\u51B3" }[d.conflict]}\u3002`, `  \u4E0D\u786E\u5B9A\u6027\uFF1A${clean(d.uncertainty)}\uFF1B\u6539\u8FDB\uFF1A${clean(d.improvement.action)}\uFF1B\u9A8C\u8BC1\uFF1A${clean(d.improvement.verify)}\uFF1B\u4F9D\u636E\uFF1A${d.support.join(", ") || "\u65E0"}\u3002`);
      if (d) for (const o of d.observations) lines.push(`  \u6838\u9A8C\u94FE\uFF1A${o.behavior} \u2192 ${o.result} \u2192 ${o.verification}\uFF1B\u65B9\u6CD5 ${o.verificationMethod === "human-followup" ? "\u7528\u6237\u540E\u7EED\u590D\u6838" : "\u72EC\u7ACB\u4EA7\u7269\u6838\u67E5"}\uFF1B\u652F\u6301\u8303\u56F4\uFF1A${clean(o.scope)}\u3002`);
    });
    lines.push("");
  });
  lines.push("\u8BC4\u5206\u505C\u6B62\u6761\u4EF6\uFF1A\u4EFB\u4E00\u6307\u6807\u7F3A\u8BC1\u3001\u4F4E\u8D28\u91CF\u3001\u51B2\u7A81\u672A\u89E3\u51B3\u3001\u884C\u4E3A\u94FE\u4E0D\u5B8C\u6574\u3001\u8F93\u5165\u622A\u65AD\u3001\u8BFB\u53D6\u5931\u8D25\uFF0C\u6216\u6750\u6599\u5BA1\u9605\u53CA\u4EFB\u52A1\u5BB6\u65CF\u672A\u95ED\u5408\uFF0C\u5747\u4E0D\u51FA\u6574\u4F53\u6570\u503C\u3002\u5BFC\u5165\u8BB0\u5F55\u7684\u201C\u6750\u6599\u672A\u5916\u90E8\u8BA4\u8BC1\u201D\u8868\u793A\u6765\u6E90\u6807\u7B7E\u672C\u8EAB\u4E0D\u8BC1\u660E\u771F\u5B9E\u6027\uFF1B\u8BC4\u4F30\u6838\u9A8C\u94FE\u63CF\u8FF0\u672C\u6B21\u91C7\u7528\u7684\u540E\u7EED\u590D\u6838\u8BC1\u636E\uFF0C\u4E0D\u80FD\u89C6\u4E3A\u771F\u5B9E\u6027\u8BA4\u8BC1\u3002", "", "## \u9650\u5236\u4E0E\u6765\u6E90", "", ...(evaluation?.narrative.limitations ?? ["\u672C\u6B21\u5C1A\u672A\u5B8C\u6210\u884C\u4E3A\u6838\u9A8C\u3002"]).map((t) => "- " + clean(t)), "", "\u516C\u5F00\u6807\u51C6\u63D0\u4F9B\u6982\u5FF5\u542F\u53D1\uFF1B24\u9879\u6307\u6807\u3001\u951A\u70B9\u4E0E\u8BA1\u5206\u7531\u672C\u9879\u76EE\u539F\u521B\u7EFC\u5408\u3002UNESCO\u3001OECD\u3001DigComp\u3001NIST\u53CAAnthropic\u5747\u672A\u8BA4\u8BC1\u6216\u80CC\u4E66\u672C\u8BC4\u5206\u3002\u5177\u4F53\u6765\u6E90\u3001\u6307\u6807\u6620\u5C04\u548C\u8BB8\u53EF\u8FB9\u754C\u89C1\u968F\u5305 THIRD_PARTY.md\u3002", "\u53BB\u654F\u5C3D\u529B\u800C\u4E3A\uFF0C\u4E0D\u80FD\u4FDD\u8BC1\u7EDD\u5BF9\u5B89\u5168\u3002\u6536\u96C6\u5668\u53EA\u8BFB\u4E14\u96F6\u7F51\u7EDC\uFF1B\u82E5\u7531\u4E91\u6A21\u578B\u8BC4\u4F30\uFF0C\u53BB\u654F\u6750\u6599\u4ECD\u8FDB\u5165\u8BE5\u670D\u52A1\u5546\u4E0A\u4E0B\u6587\u3002", "", "## \u672C\u5730\u8BC1\u636E\u9644\u5F55", "");
  for (const x of ledger) lines.push(`- ${x.id}\uFF1A${x.date} / ${clean(x.instance)} / \u4EFB\u52A1 ${x.task} / ${x.actor} / ${x.type ?? "unknown"} / \u5BFC\u5165\u72B6\u6001\uFF1A${x.verification === "verified" ? "\u6750\u6599\u58F0\u660E\u5DF2\u6838\u9A8C" : "\u6750\u6599\u672A\u5916\u90E8\u8BA4\u8BC1"}\uFF1B\u5B9A\u4F4D\uFF1A${clean(x.locator ?? "\u672A\u4FDD\u7559\uFF0C\u9700\u8865\u67E5")}\uFF1B\u4E8B\u5B9E\uFF1A${clean(x.text)}\u3002\u652F\u6301\u8303\u56F4\u548C\u53CD\u8BC1\u89C1\u4EE5\u4E0A\u51B3\u7B56\uFF0C\u539F\u6587\u4EC5\u4F5C\u975E\u53EF\u4FE1\u6750\u6599\u3002`);
  lines.push("", "\u672C\u62A5\u544A\u3001\u8BC4\u4F30\u548C\u8D26\u672C\u4EC5\u4F9B\u672C\u5730\u68C0\u67E5\uFF0C\u53EF\u80FD\u5305\u542B\u4E2A\u4EBA\u4FE1\u606F\u3002\u516C\u5F00\u9700\u53E6\u884C\u786E\u8BA4\u51C6\u786E\u805A\u5408\u5B57\u6BB5\u4E0E\u76EE\u6807\u3002");
  return lines.join("\n");
}

// src/visual.ts
function radarSvg(s, options = {}) {
  if (s.total === null || s.coverage !== 1) return "";
  const point = (i, r) => [300 + Math.sin(i * Math.PI / 3) * r, 265 - Math.cos(i * Math.PI / 3) * r];
  const polygon = (r) => AXES.map((_, i) => point(i, r).join(",")).join(" ");
  const lines = AXES.map((_, i) => {
    const [x, y] = point(i, 180);
    return `<line x1="300" y1="265" x2="${x}" y2="${y}"/>`;
  }).join("");
  const labels = AXES.map((name, i) => {
    const [x, y] = point(i, 227);
    return `<text x="${x}" y="${y}" text-anchor="middle" font-size="15" fill="#233e34">${name}</text><text x="${x}" y="${y + 20}" text-anchor="middle" font-size="13" fill="#5f756b">${s.dimensions[i] === null ? "\u672A\u77E5" : Math.round(s.dimensions[i])}</text>`;
  }).join("");
  const known = s.dimensions.every((n) => n !== null);
  const shape = known ? `<polygon points="${s.dimensions.map((n, i) => point(i, n * 1.8).join(",")).join(" ")}" fill="#3c967c" fill-opacity="0.18" stroke="#348169" stroke-width="2"/>` : "";
  const dots = s.dimensions.map((n, i) => n === null ? "" : `<circle cx="${point(i, n * 1.8)[0]}" cy="${point(i, n * 1.8)[1]}" r="5" fill="#348169"/>`).join("");
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 545" role="img" font-family="system-ui" aria-label="\u516D\u7EF4\u96F7\u8FBE\u56FE\uFF1B${s.total === null ? "\u603B\u5206\u672A\u77E5" : `\u603B\u5206${s.total}`}\uFF1B\u8BC1\u636E\u8986\u76D6${Math.round(s.coverage * 100)}%"><g fill="none" stroke="#c9d4c7" stroke-width="1">${[45, 90, 135, 180].map((r) => `<polygon points="${polygon(r)}"/>`).join("")}${lines}</g>${shape}${dots}${labels}<circle cx="300" cy="265" r="60" fill="#f4f3eb"/><text x="300" y="264" text-anchor="middle" font-size="40" font-weight="600" fill="#173f35">${s.total ?? "\u2014"}</text><text x="300" y="289" text-anchor="middle" font-size="12" fill="#62746a">${s.total === null ? "\u8BC1\u636E\u4E0D\u5B8C\u6574" : "\u7EFC\u5408\u5206 / 100"}</text><text x="300" y="526" text-anchor="middle" font-size="12" fill="#62746a">\u8BC1\u636E\u95E8\u69DB\u5DF2\u901A\u8FC7 \xB7 \u539F\u521B\u6307\u6807\uFF0C\u975E\u8BA4\u8BC1</text></svg>`;
  if (options.dark) for (const [a, b] of Object.entries({ "#c9d4c7": "#345139", "#233e34": "#d6e6c8", "#5f756b": "#9eb69a", "#3c967c": "#a4e58a", "#348169": "#a4e58a", "#f4f3eb": "#111913", "#173f35": "#a4e58a", "#62746a": "#7c967c" })) svg = svg.replaceAll(a, b);
  return svg;
}

// src/report.ts
var escape = (s) => s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
function reportHtml(report, evaluation, collection) {
  const md = writtenReport(report, evaluation, collection?.ledger ?? [], collection);
  const content = md.split("\n").map((line) => line.startsWith("### ") ? `<h3>${escape(line.slice(4))}</h3>` : line.startsWith("## ") ? `<h2>${escape(line.slice(3))}</h2>` : line.startsWith("# ") ? "" : line ? `<p>${escape(line)}</p>` : "").join("\n");
  return `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"><title>AI Native Score \xB7 \u79C1\u5BC6\u62A5\u544A</title><style>:root{color-scheme:dark;--bg:#0b100e;--panel:#111913;--line:#263d2a;--green:#a4e58a;--muted:#7c967c;--bright:#e0efce}*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--bright);font:15px/1.85 ui-monospace,'SFMono-Regular',Menlo,'PingFang SC',monospace;background-image:linear-gradient(#18231a33 1px,transparent 1px),linear-gradient(90deg,#18231a33 1px,transparent 1px);background-size:32px 32px}main{max-width:940px;margin:60px auto;padding:0 26px 60px}header{border-bottom:2px solid var(--green);padding-bottom:24px}header small{color:var(--muted);letter-spacing:2px}h1{font-size:29px;line-height:1.2}h1 span,h2{color:var(--green)}h2{font-size:19px;margin:34px 0 16px;border-bottom:1px solid var(--line);padding-bottom:10px}h3{font-size:16px;color:var(--green)}p{margin:10px 0;overflow-wrap:anywhere}svg{max-width:580px;width:100%;display:block;margin:20px auto}article{background:var(--panel);border:1px solid var(--line);padding:24px;margin-top:24px}@media(max-width:550px){main{margin:28px auto;padding:0 16px 32px}article{padding:16px}h1{font-size:23px}body{font-size:14px}}@media print{body{background:white;color:#152519}article{background:white}h2,h3{color:#234e2e}}</style><main><header><small>PRIVATE LOCAL REPORT_</small><h1>AI NATIVE <span>SCORE</span></h1><p>${report.summary.total === null ? "NEEDS EVIDENCE_ \u5F85\u8865\u8BC1\u636E" : "EVIDENCE REVIEWED_ \u672C\u6B21\u8303\u56F4\u5DF2\u6838\u9A8C"}</p></header>${radarSvg(report.summary, { dark: true })}<article>${content}</article></main></html>`;
}

// src/cli.ts
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve as resolve3, join as join3, dirname } from "node:path";

// src/client.ts
import { createHash as createHash2, randomBytes, randomUUID } from "node:crypto";
var DEFAULT_SITE = "https://ai-native-score.laolv-wenxiang.workers.dev";
function siteOrigin(site) {
  const u = new URL(site);
  if (u.username || u.password || u.search || u.hash || u.pathname !== "/" || u.protocol !== "https:" && !(u.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(u.hostname))) throw Error("\u76EE\u6807\u9700\u4E3AHTTPS\u7AD9\u70B9\u6216\u672C\u673A\u6D4B\u8BD5\u5730\u5740");
  return u.origin;
}
var digest = (s) => createHash2("sha256").update(s).digest("hex");
function publicationPlan(input, site) {
  const score = validatePublic(input);
  const origin = siteOrigin(site);
  if (score.coverage !== 1 || score.total === null) throw Error("\u7F3A\u8BC1\u636E\u7ED3\u679C\u53EA\u4FDD\u7559\u672C\u5730\uFF0C\u4E0D\u8FDB\u5165\u5B8C\u6574\u8BC4\u5206\u6392\u884C");
  return { score, origin, confirmation: digest(origin + "\n" + JSON.stringify(score)) };
}
function preparePublication(input, site, confirmation, existing) {
  const plan = publicationPlan(input, site);
  if (confirmation !== plan.confirmation) throw Error("\u4E0A\u4F20\u524D\u9700\u660E\u786E\u786E\u8BA4\u51C6\u786E\u805A\u5408\u5B57\u6BB5\u548C\u76EE\u6807");
  const receipt = existing ?? { origin: plan.origin, id: randomUUID(), token: randomBytes(32).toString("hex"), payloadDigest: plan.confirmation };
  if (receipt.origin !== plan.origin || receipt.payloadDigest !== plan.confirmation || !/^[a-f0-9]{64}$/.test(receipt.token) || !/^[a-f0-9-]{36}$/.test(receipt.id)) throw Error("\u91CD\u8BD5\u51ED\u636E\u4E0E\u63D0\u4EA4\u4E0D\u5339\u914D");
  return { plan, receipt };
}
async function sendPublication(prepared, transport = fetch) {
  const { plan, receipt } = prepared;
  async function call(path, init) {
    const r = await transport(plan.origin + path, { ...init, headers: { Origin: plan.origin, "Content-Type": "application/json", ...init.headers }, signal: AbortSignal.timeout(15e3) });
    const data = await r.json();
    if (!r.ok) throw Error("\u63D0\u4EA4\u672A\u5B8C\u6210\uFF0C\u8BF7\u4FDD\u7559\u51ED\u636E\u540E\u91CD\u8BD5");
    return data;
  }
  const c = await call("/api/challenge", { method: "POST", body: "{}" });
  if (!/^[a-f0-9-]{36}$/.test(c.id) || c.difficulty !== 4 || typeof c.expiresAt !== "number") throw Error("\u670D\u52A1\u6821\u9A8C\u683C\u5F0F\u65E0\u6548");
  let nonce = 0;
  while (!digest(c.id + ":" + nonce).startsWith("0".repeat(c.difficulty))) {
    if (++nonce > 5e6 || Date.now() / 1e3 > c.expiresAt) throw Error("\u9632\u6EE5\u7528\u6821\u9A8C\u8D85\u65F6");
  }
  const result = await call("/api/submissions", { method: "POST", headers: { Authorization: "Bearer " + receipt.token }, body: JSON.stringify({ score: plan.score, confirmed: true, requestId: receipt.id, challengeId: c.id, nonce }) });
  if (result.id !== receipt.id) throw Error("\u670D\u52A1\u8FD4\u56DE\u4E0E\u63D0\u4EA4\u4E0D\u5339\u914D\uFF0C\u4FDD\u7559\u51ED\u636E\u68C0\u67E5");
  return { id: receipt.id, url: plan.origin + "/#" + receipt.id };
}
async function deletePublication(receipt, confirmation, transport = fetch) {
  if (confirmation !== receipt.id || !/^[a-f0-9-]{36}$/.test(receipt.id) || !/^[a-f0-9]{64}$/.test(receipt.token)) throw Error("\u9700\u8981\u786E\u8BA4\u5BF9\u5E94\u8BB0\u5F55ID");
  const origin = siteOrigin(receipt.origin);
  const r = await transport(origin + "/api/submissions/" + receipt.id, { method: "DELETE", headers: { Origin: origin, Authorization: "Bearer " + receipt.token }, signal: AbortSignal.timeout(15e3) });
  if (!r.ok) throw Error("\u8BB0\u5F55\u4E0D\u5B58\u5728\u6216\u51ED\u636E\u4E0D\u5339\u914D");
  return { deleted: true };
}

// src/cli.ts
var args = process.argv.slice(2);
var command = args.shift();
var option = (name) => {
  const i = args.indexOf("--" + name);
  return i === -1 ? void 0 : args[i + 1];
};
async function load(path) {
  const data = await readFile(path, "utf8");
  if (Buffer.byteLength(data) > 12 * 1024 ** 2) throw Error("\u8F93\u5165\u6587\u4EF6\u8FC7\u5927");
  return JSON.parse(data);
}
async function save(path, data) {
  await writeFile(path, data, { mode: 384, flag: "wx" });
}
async function main() {
  if (command === "discover") {
    console.log(JSON.stringify(await discover(option("roots") ? { roots: await load(option("roots")) } : {}), null, 2));
    return;
  }
  if (command === "publish-plan") {
    const input = await load(option("score") ?? "reports/assessment/public-score.json");
    if (option("nickname") !== void 0) input.nickname = option("nickname");
    const plan = publicationPlan(input, option("site") ?? DEFAULT_SITE);
    console.log(JSON.stringify({ publicFields: plan.score, target: plan.origin, confirmation: plan.confirmation }, null, 2));
    return;
  }
  if (command === "publish") {
    const input = await load(option("score") ?? "reports/assessment/public-score.json");
    if (option("nickname") !== void 0) input.nickname = option("nickname");
    const path = resolve3(option("receipt") ?? "reports/submission.receipt.json");
    let existing;
    try {
      existing = await load(path);
    } catch {
    }
    const prepared = preparePublication(input, option("site") ?? DEFAULT_SITE, option("confirm-public") ?? "", existing);
    if (!existing) {
      await mkdir(dirname(path), { recursive: true, mode: 448 });
      await save(path, JSON.stringify(prepared.receipt, null, 2));
    }
    const result = await sendPublication(prepared);
    console.log(JSON.stringify({ submitted: true, url: result.url, notes: "\u79C1\u5BC6\u5220\u9664\u51ED\u636E\u5DF2\u4FDD\u5B58\u5728\u6307\u5B9A\u6587\u4EF6\uFF1B\u4E0D\u8981\u5206\u4EAB\u51ED\u636E\u3002" }));
    return;
  }
  if (command === "delete") {
    console.log(JSON.stringify(await deletePublication(await load(option("receipt") ?? "reports/submission.receipt.json"), option("confirm-delete") ?? "")));
    return;
  }
  if (command === "plan") {
    const scope = validateScope(await load(option("scope") ?? "scope.local.json"));
    console.log(JSON.stringify({ discovery: await discover(), scope, readOnly: true, safety: "\u62D2\u8BFB\u51ED\u636E\u548C\u53D7\u9650\u76EE\u5F55\uFF1B\u4E0D\u7ED5\u8FC7\u6743\u9650\u3002\u53BB\u654F\u4E0D\u80FD\u4FDD\u8BC1\u7EDD\u5BF9\u5B89\u5168\u3002", duration: "\u8BC4\u4F30\u53EF\u80FD\u6301\u7EED\u8F83\u957F\u65F6\u95F4\uFF1B\u4EE5\u6765\u6E90\u3001\u6587\u4EF6\u3001\u4EFB\u52A1\u94FE\u548C\u9057\u6F0F\u62A5\u544A\u8FDB\u5EA6\uFF0C\u8017\u65F6\u4E0D\u4EE3\u8868\u6DF1\u5EA6\u6216\u771F\u5B9E\u6027\u3002", limits: { fileBytes: 1048576, totalBytes: 8388608, files: 200, ledgerEntries: 500, timeMs: 2e4 }, network: "none", confirmation: scopeDigest(scope) }, null, 2));
    return;
  }
  if (command === "scan") {
    const scope = validateScope(await load(option("scope") ?? "scope.local.json"));
    console.error("\u5F00\u59CB\u53EA\u8BFB\u6536\u96C6\uFF1B\u53EF\u80FD\u6301\u7EED\u8F83\u957F\u65F6\u95F4\u3002\u9636\u6BB5\uFF1A\u53D1\u73B0 \u2192 \u6388\u6743\u8303\u56F4\u8BFB\u53D6 \u2192 \u53BB\u654F\uFF1B\u8017\u65F6\u4E0D\u8BA1\u5206\u3002");
    const result = await collect(scope, option("confirm-scope") ?? "");
    const out = resolve3(option("out") ?? "reports/collection");
    await mkdir(dirname(out), { recursive: true });
    await mkdir(out, { mode: 448 });
    await save(join3(out, "collection.private.json"), JSON.stringify(result, null, 2));
    await save(join3(out, "report.json"), JSON.stringify(result.report, null, 2));
    await save(join3(out, "report.md"), writtenReport(result.report, void 0, result.ledger, result));
    await save(join3(out, "report.html"), reportHtml(result.report, void 0, result));
    console.log(JSON.stringify({ completed: true, files: result.stats.files, skipped: result.stats.skipped, truncated: result.stats.truncated, evidenceItems: result.ledger.length, coverage: 0, notes: "\u79C1\u5BC6\u7ED3\u679C\u5DF2\u5199\u5165\u6307\u5B9A\u76EE\u5F55\uFF1B\u672A\u8F93\u51FA\u6B63\u6587\uFF0C\u672A\u8054\u7F51\u3002" }));
    return;
  }
  if (command === "evaluate") {
    const collection = await load(option("collection") ?? "reports/collection/collection.private.json");
    const result = applyEvaluation(collection, await load(option("evaluation") ?? "evaluation.private.json"));
    validateReport(result.report);
    const out = resolve3(option("out") ?? "reports/assessment");
    await mkdir(dirname(out), { recursive: true });
    await mkdir(out, { mode: 448 });
    await save(join3(out, "report.json"), JSON.stringify(result.report, null, 2));
    await save(join3(out, "evaluation.private.json"), JSON.stringify(result.evaluation, null, 2));
    await save(join3(out, "report.md"), writtenReport(result.report, result.evaluation, collection.ledger, collection));
    if (result.report.summary.total !== null) await save(join3(out, "public-score.json"), JSON.stringify(publicScore(result.report), null, 2));
    await save(join3(out, "report.html"), reportHtml(result.report, result.evaluation, collection));
    console.log(JSON.stringify({ completed: true, status: result.report.summary.total === null ? "needs-evidence" : "scored", coverage: result.report.summary.coverage, confidence: result.report.summary.confidence, notes: result.report.summary.total === null ? "\u4EC5\u751F\u6210\u7F3A\u53E3\u4E0E\u8865\u67E5\u62A5\u544A\uFF1B\u65E0\u6570\u503C\u8BC4\u5206\u3001\u96F7\u8FBE\u6216\u516C\u5F00\u6587\u4EF6\u3002" : "\u672C\u5730\u62A5\u544A\u53CA\u805A\u5408\u6587\u4EF6\u5DF2\u751F\u6210\uFF1B\u672A\u4E0A\u4F20\u3002" }));
    return;
  }
  if (command === "export") {
    const report = validateReport(await load(option("report") ?? "reports/assessment/report.json"));
    const score = publicScore(report, option("nickname") ?? "");
    if (option("confirm-public") !== "yes") throw Error("\u5148\u68C0\u67E5\u805A\u5408\u5B57\u6BB5\uFF1B\u4EC5\u660E\u786E\u540C\u610F\u516C\u5F00\u6635\u79F0\u4E0E\u5206\u6570\u540E\u4F7F\u7528 --confirm-public yes \u5BFC\u51FA\u516C\u5F00\u526F\u672C");
    await save(resolve3(option("out") ?? "reports/public-score.json"), JSON.stringify(score, null, 2));
    console.log("\u5DF2\u5BFC\u51FA\u805A\u5408\u526F\u672C\uFF0C\u5C1A\u672A\u4E0A\u4F20\u3002");
    return;
  }
  console.log("AI Native Score\ndiscover [--roots <\u5DF2\u77E5\u6839\u76EE\u5F55\u5217\u8868>]\nplan --scope scope.local.json\nscan --scope scope.local.json --confirm-scope <plan\u6458\u8981> --out reports/collection\nevaluate --collection <\u79C1\u5BC6\u6536\u96C6\u7ED3\u679C> --evaluation <agent\u751F\u6210\u51B3\u7B56> --out reports/assessment\npublish-plan --score <\u805A\u5408\u5206\u6570> [--site <HTTPS\u7AD9\u70B9>]\npublish --score <\u805A\u5408\u5206\u6570> [--site <\u7AD9\u70B9>] --confirm-public <\u8BA1\u5212\u6458\u8981> --receipt <\u79C1\u5BC6\u51ED\u636E>\ndelete --receipt <\u79C1\u5BC6\u51ED\u636E> --confirm-delete <\u5BF9\u5E94ID>\n\u6240\u6709\u6536\u96C6\u4E0E\u8BC4\u4F30\u547D\u4EE4\u96F6\u7F51\u7EDC\uFF1B\u53EA\u6709\u5355\u72EC\u786E\u8BA4\u7684publish/delete\u8054\u7F51\u3002");
}
main().catch(() => {
  console.error("\u64CD\u4F5C\u672A\u5B8C\u6210\uFF1A\u8BF7\u68C0\u67E5\u53C2\u6570\u3001\u8303\u56F4\u786E\u8BA4\u3001\u8F93\u5165schema\u6216\u8DEF\u5F84\u6743\u9650\u3002\u672A\u8F93\u51FA\u79C1\u5BC6\u9519\u8BEF\u7EC6\u8282\u3002");
  process.exitCode = 1;
});
