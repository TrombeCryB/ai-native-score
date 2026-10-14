// src/cli.ts
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve as resolve2, join as join2, dirname } from "node:path";

// src/collector.ts
import { lstat, realpath, open, readdir } from "node:fs/promises";
import { constants } from "node:fs";
import { resolve, relative, join, basename } from "node:path";
import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

// src/model.ts
var VERSION = "am-0.1";
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
  return { dimensions, total: known === 24 ? Math.round(100 * sum / 96) : null, interval: [round(100 * sum / 96), round(100 * (sum + 4 * (24 - known)) / 96)], coverage: round(known / 24), confidence: known ? conf / known >= 0.8 ? "high" : conf / known >= 0.5 ? "medium" : "low" : "unknown" };
}
var round = (n) => Math.round(n * 1e3) / 1e3;
var unknownRatings = () => AXES.map(() => Array.from({ length: 4 }, () => ({ value: null, confidence: 0, evidence: [], basis: "unknown" })));
function publicScore(report, nickname = "") {
  const s = summarize(report.ratings);
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
  if (x.coverage === 0 && (x.confidence !== "unknown" || x.dimensions.some((v) => v !== null) || x.interval[0] !== 0 || x.interval[1] !== 100)) throw Error("\u672A\u77E5\u72B6\u6001\u4E0D\u4E00\u81F4");
  if (Number(x.coverage) < 1 && x.total !== null) throw Error("\u8BC1\u636E\u4E0D\u5B8C\u6574\u65F6\u603B\u5206\u5FC5\u987B\u4E3A\u672A\u77E5");
  if (x.coverage === 1 && (x.dimensions.some((v) => v === null) || x.total === null || Math.round(x.dimensions.reduce((a, b) => a + b, 0) / 6) !== x.total || x.interval.some((v) => Math.abs(v - x.dimensions.reduce((a, b) => a + b, 0) / 6) > 2e-3))) throw Error("\u603B\u5206\u4E0D\u4E00\u81F4");
  if (Number(x.coverage) < 1 && Math.abs(x.interval[1] - x.interval[0] - 100 * (1 - Number(x.coverage))) > 0.2) throw Error("\u8986\u76D6\u7387\u548C\u533A\u95F4\u4E0D\u4E00\u81F4");
  if (x.nickname !== void 0 && (typeof x.nickname !== "string" || Array.from(x.nickname).length > 24 || /[\p{C}<>]/u.test(x.nickname))) throw Error("\u6635\u79F0\u965024\u5B57\u7B26\u4E14\u4E0D\u80FD\u5305\u542B\u63A7\u5236\u7B26\u6216HTML");
  return x;
}
function validateReport(x) {
  if (!record(x) || !keys(x, ["schemaVersion", "scoringVersion", "kind", "ratings", "evidence", "summary"]) || x.schemaVersion !== 1 || x.scoringVersion !== VERSION || !["local-assessment", "synthetic"].includes(String(x.kind))) throw Error("\u672C\u5730\u62A5\u544A\u7248\u672C\u65E0\u6548");
  if (!Array.isArray(x.evidence) || x.evidence.length > 128) throw Error("\u8BC1\u636E\u65E0\u6548");
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
  if (JSON.stringify(x.summary) !== JSON.stringify(summary)) throw Error("\u6C47\u603B\u4E0E\u6307\u6807\u4E0D\u4E00\u81F4");
  return x;
}

// src/collector.ts
var MAX_FILE = 1024 * 1024;
var MAX_TOTAL = 8 * 1024 * 1024;
var MAX_FILES = 200;
var MAX_ITEMS = 500;
var MAX_TIME = 2e4;
var denied = /(^|\/)(\.env[^/]*|\.git|node_modules|auth[^/]*|credentials?[^/]*|secrets?[^/]*|\.ssh|\.aws|\.config|Library|Cookies|Login Data)(\/|$)/i;
function validateScope(x) {
  const s = x;
  if (!s || !["structure", "deep"].includes(s.mode) || !Array.isArray(s.projects) || !Array.isArray(s.agents) || !Array.isArray(s.histories) || s.projects.length + s.agents.length + s.histories.length > 12 || ![...s.projects, ...s.agents].every((p) => typeof p === "string" && p.length < 1024)) throw Error("\u8303\u56F4\u914D\u7F6E\u65E0\u6548");
  const validDate = (v) => /^\d{4}-\d{2}-\d{2}$/.test(v) && Number.isFinite(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v;
  if (!validDate(s.from) || !validDate(s.to) || s.from > s.to) throw Error("\u8BF7\u63D0\u4F9B\u6709\u6548\u65E5\u671F\u8303\u56F4");
  if (s.mode === "structure" && s.histories.length) throw Error("\u5386\u53F2\u8BB0\u5F55\u9700\u8981 deep \u6A21\u5F0F");
  for (const h of s.histories) if (!h || !["codex", "hermes-json", "hermes-sqlite"].includes(h.adapter) || typeof h.instance !== "string" || !/^[A-Za-z0-9_.-]{1,64}$/.test(h.instance) || typeof h.path !== "string" || h.path.length > 1024) throw Error("\u9002\u914D\u5668\u914D\u7F6E\u65E0\u6548");
  return s;
}
var scopeDigest = (s) => createHash("sha256").update(JSON.stringify(s)).digest("hex");
function redact(input) {
  return input.replace(/-----BEGIN[^\n]*PRIVATE KEY-----[\s\S]*?-----END[^\n]*PRIVATE KEY-----/g, "[SECRET]").replace(/^.*(?:api[_ -]?key|access[_ -]?token|refresh[_ -]?token|password|passwd|authorization|client[_ -]?secret|密钥|密码|验证码|secret.canary)[^\n]*$/gim, "[SECRET LINE]").replace(/\b(?:sk-[A-Za-z0-9_-]{8,}|gh[pousr]_[A-Za-z0-9]{8,}|AKIA[A-Z0-9]{16}|eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)\b/g, "[SECRET]").replace(/https?:\/\/[^\s)<>]+/g, "[URL]").replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[EMAIL]").replace(/(?:\/Users\/|\/home\/|[A-Z]:\\)[^\s"'<>]+/g, "[LOCAL PATH]").replace(/\b(?:\+?\d[\d -]{9,}\d)\b/g, "[NUMBER]").replace(/\b[A-Za-z0-9_+/=-]{32,}\b/g, "[LONG IDENTIFIER]").slice(0, 3e3);
}
async function safePath(path, root) {
  const abs = resolve(path), base = resolve(root);
  if (denied.test(abs) || relative(base, abs).startsWith("..")) throw Error("\u7981\u6B62\u7684\u626B\u63CF\u8DEF\u5F84");
  const parts = abs.split("/").filter(Boolean);
  let current = "/";
  for (const part of parts) {
    current = join(current, part);
    if ((await lstat(current)).isSymbolicLink()) throw Error("\u4E0D\u626B\u63CF\u7B26\u53F7\u94FE\u63A5");
  }
  const actual = await realpath(abs);
  if (actual !== abs) throw Error("\u8DEF\u5F84\u53D1\u751F\u53D8\u5316");
  return abs;
}
async function collect(scope, confirmation) {
  validateScope(scope);
  if (confirmation !== scopeDigest(scope)) throw Error("\u626B\u63CF\u524D\u9700\u8981\u786E\u8BA4\u8303\u56F4\u6458\u8981");
  const started = Date.now();
  const ledger = [];
  const evidence = [];
  const diagnostics = [];
  const stats = { files: 0, bytes: 0, skipped: 0, truncated: false };
  const hashes = /* @__PURE__ */ new Set();
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
      const stat = await lstat(path);
      if (!stat.isFile() || Math.min(stat.size, MAX_FILE) + stats.bytes > MAX_TOTAL) {
        stats.skipped++;
        stats.truncated = true;
        if (diagnostics.length < 128) diagnostics.push({ target: path, reason: stat.isFile() ? "total-byte-limit" : "not-regular-file" });
        return null;
      }
      handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
      const opened = await handle.stat();
      if (!opened.isFile() || opened.ino !== stat.ino || opened.dev !== stat.dev) throw Error("\u626B\u63CF\u671F\u95F4\u6587\u4EF6\u6539\u53D8");
      let text, used;
      if (stat.size > MAX_FILE) {
        stats.truncated = true;
        const half = MAX_FILE / 2, head = Buffer.alloc(half), tail = Buffer.alloc(half);
        const a = await handle.read(head, 0, half, 0), b = await handle.read(tail, 0, half, stat.size - half);
        used = a.bytesRead + b.bytesRead;
        text = head.subarray(0, a.bytesRead).toString("utf8") + "\n" + tail.subarray(0, b.bytesRead).toString("utf8");
      } else {
        const buffer = Buffer.alloc(stat.size);
        const result = await handle.read(buffer, 0, buffer.length, 0);
        used = result.bytesRead;
        text = buffer.subarray(0, used).toString("utf8");
      }
      stats.files++;
      stats.bytes += used;
      return text;
    } catch (error) {
      stats.skipped++;
      if (diagnostics.length < 128) diagnostics.push({ target: path, reason: ["EPERM", "EACCES"].includes(String(error?.code)) ? "permission-denied" : error?.code === "ENOENT" ? "missing-file" : "unsafe-or-changed-path" });
      return null;
    } finally {
      await handle?.close();
    }
  }
  function add(task, date, actor, instance, text) {
    if (!budget() || date.slice(0, 10) < scope.from || date.slice(0, 10) > scope.to) return;
    const clean = redact(text);
    if (!clean.trim()) return;
    const key = createHash("sha256").update(task + "|" + actor + "|" + clean).digest("hex");
    if (hashes.has(key)) return;
    hashes.add(key);
    ledger.push({ id: "e" + (ledger.length + 1), task: createHash("sha256").update(instance + "|" + task).digest("hex").slice(0, 12), date: date.slice(0, 10), actor, instance, text: clean, untrusted: true });
  }
  async function walk(root, exts, callback, depth = 0) {
    if (depth > 8 || !budget()) return;
    try {
      await safePath(root, root);
      const entries = await readdir(root, { withFileTypes: true });
      for (const e of entries.sort((a, b) => a.name.localeCompare(b.name))) {
        if (!budget()) break;
        const p = join(root, e.name);
        if (denied.test(p) || e.isSymbolicLink()) continue;
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
      const raw = await read(join(root, name), root);
      if (raw !== null) evidence.push({ id: "e" + (evidence.length + 1), source: "project-structure", fact: name === "package.json" ? "\u9879\u76EE\u5305\u542B\u5305\u6E05\u5355\uFF08\u4E0D\u8BC1\u660E\u5B8C\u6210\u8D28\u91CF\uFF09" : name === "AGENTS.md" ? "\u9879\u76EE\u5305\u542B agent \u5DE5\u4F5C\u8BF4\u660E\uFF08\u4E0D\u8BC1\u660E\u5DF2\u9075\u5B88\uFF09" : "\u9879\u76EE\u5305\u542B\u6301\u7EED\u96C6\u6210\u914D\u7F6E\uFF08\u4E0D\u8BC1\u660E\u68C0\u67E5\u901A\u8FC7\uFF09", strength: "structure" });
    }
  }
  for (const root of scope.agents) {
    await walk(join(root, "skills"), ["SKILL.md"], async (p) => {
      const raw = await read(p, root);
      if (raw !== null && evidence.length < 128) evidence.push({ id: "e" + (evidence.length + 1), source: "agent-structure", fact: "\u5B58\u5728\u6280\u80FD\u5143\u6570\u636E\uFF08\u4E0D\u8BC1\u660E\u5B9E\u9645\u4F7F\u7528\uFF09", strength: "structure" });
    });
  }
  for (const h of scope.histories) {
    if (h.adapter === "hermes-sqlite") {
      if (!budget()) break;
      try {
        await safePath(h.path, h.path);
        const st = await lstat(h.path);
        if (!st.isFile() || st.size > 2 * 1024 ** 3) throw Error("\u6570\u636E\u5E93\u4E0D\u652F\u6301");
        const r = await promisify(execFile)("python3", [join(import.meta.dirname, "../scripts/hermes_read.py"), h.path, scope.from, scope.to], { timeout: Math.min(15e3, MAX_TIME - (Date.now() - started)), maxBuffer: MAX_TOTAL - stats.bytes });
        stats.files++;
        stats.bytes += Buffer.byteLength(r.stdout);
        const rows = JSON.parse(r.stdout);
        if (!Array.isArray(rows)) throw Error("\u6570\u636E\u5E93\u7ED3\u6784\u4E0D\u652F\u6301");
        if (rows.length >= MAX_ITEMS) stats.truncated = true;
        for (const m of rows) add(String(m.task), String(m.date), m.role === "user" ? "human" : "agent", h.instance, String(m.text));
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
          if (p.endsWith(".jsonl")) rows = raw.split("\n").filter(Boolean).map((l) => {
            try {
              return JSON.parse(l);
            } catch {
              return null;
            }
          });
          else {
            const doc = JSON.parse(raw);
            rows = Array.isArray(doc) ? doc : doc.messages ?? [];
          }
        } catch {
          stats.skipped++;
          return;
        }
        let sessionDate = "", task = basename(p);
        for (const item of rows) {
          const m = item;
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
          const text = typeof content === "string" ? content : Array.isArray(content) ? content.filter((x) => ["input_text", "output_text", "text"].includes(x.type)).map((x) => x.text ?? "").join("\n") : "";
          add(task, date, role === "user" ? "human" : "agent", h.instance, text);
        }
      });
    }
  }
  const ratings = unknownRatings();
  return { report: { schemaVersion: 1, scoringVersion: VERSION, kind: "local-assessment", ratings, evidence, summary: summarize(ratings) }, ledger, stats, diagnostics };
}

// src/evaluate.ts
function applyEvaluation(collection, input) {
  const e = input;
  if (!e || !Array.isArray(e.decisions) || e.decisions.length !== 24 || !e.narrative) throw Error("\u8BC4\u4F30\u9700\u898124\u9879\u51B3\u7B56\u548C\u6587\u5B57\u8BC4\u4EF7");
  const lookup = new Map(collection.ledger.map((x) => [x.id, x]));
  const seen = /* @__PURE__ */ new Set();
  const ratings = unknownRatings();
  const knownTasks = new Set(collection.ledger.map((x) => x.task));
  if (e.taskGroups && (typeof e.taskGroups !== "object" || Array.isArray(e.taskGroups) || Object.entries(e.taskGroups).some(([t, g]) => !knownTasks.has(t) || typeof g !== "string" || g.length > 64))) throw Error("\u4EFB\u52A1\u5206\u7EC4\u65E0\u6548");
  for (const d of e.decisions) {
    if (!Number.isInteger(d.axis) || d.axis < 0 || d.axis > 5 || !Number.isInteger(d.indicator) || d.indicator < 0 || d.indicator > 3 || seen.has(`${d.axis}:${d.indicator}`) || !["low", "medium", "high"].includes(d.quality)) throw Error("\u51B3\u7B56\u7D22\u5F15\u65E0\u6548");
    seen.add(`${d.axis}:${d.indicator}`);
    if (!Array.isArray(d.support) || !Array.isArray(d.counterexamples) || [...d.support, ...d.counterexamples].some((id) => !lookup.has(id))) throw Error("\u8BC1\u636EID\u4E0D\u5B58\u5728");
    for (const key of ["rationale", "humanContribution", "agentActivity", "outcome"]) if (typeof d[key] !== "string" || d[key].length > 2e3) throw Error("\u51B3\u7B56\u8BF4\u660E\u65E0\u6548");
    if (d.value === null) continue;
    if (!Number.isInteger(d.value) || d.value < 0 || d.value > 4 || !d.support.length || !d.rationale.trim() || !d.humanContribution.trim() || !d.outcome.trim()) throw Error("\u5DF2\u77E5\u8BC4\u5206\u9700\u8981\u884C\u4E3A\u548C\u7ED3\u679C\u89E3\u91CA");
    const records = d.support.map((id) => lookup.get(id));
    const tasks = new Set(records.map((x) => e.taskGroups?.[x.task] ?? x.task));
    if (!records.some((x) => x.actor === "human")) throw Error("agent \u6D3B\u52A8\u4E0D\u80FD\u76F4\u63A5\u5F53\u6210\u4EBA\u7C7B\u80FD\u529B");
    if (d.value >= 3 && tasks.size < 2) throw Error("3\u20134\u7EA7\u9700\u8981\u591A\u4E2A\u72EC\u7ACB\u4EFB\u52A1\u7684\u8BC1\u636E");
    if (d.value === 4 && tasks.size < 3) throw Error("4\u7EA7\u9700\u8981\u81F3\u5C11\u4E09\u4E2A\u4EFB\u52A1\u5E76\u89E3\u91CA\u8FC1\u79FB\u4E0E\u7ED3\u679C");
    ratings[d.axis][d.indicator] = { value: d.value, confidence: d.quality === "high" ? 0.9 : d.quality === "medium" ? 0.6 : 0.3, evidence: [.../* @__PURE__ */ new Set([...d.support, ...d.counterexamples])], basis: "observed" };
  }
  for (const key of ["strengths", "gaps", "workPatterns", "lifePatterns", "actions", "limitations"]) {
    const a = e.narrative[key];
    if (!Array.isArray(a) || a.length > 12 || a.some((t) => typeof t !== "string" || t.length > 2e3)) throw Error("\u6587\u5B57\u8BC4\u4EF7\u65E0\u6548");
    e.narrative[key] = a.map(redact);
  }
  const used = new Set(ratings.flat().flatMap((r) => r.evidence));
  const evidence = [...used].map((id) => ({ id, source: "workflow-record", fact: "\u5DF2\u6388\u6743\u53BB\u654F\u884C\u4E3A\u8BB0\u5F55\uFF1B\u8BE6\u89C1\u672C\u5730\u79C1\u5BC6\u8BC1\u636E\u8D26\u672C", strength: "observation" }));
  return { report: { schemaVersion: 1, scoringVersion: VERSION, kind: "local-assessment", ratings, evidence, summary: summarize(ratings) }, evaluation: e };
}
function writtenReport(report, evaluation, ledger = []) {
  const s = report.summary;
  const lines = ["# AI Native Score \u672C\u5730\u8BC4\u4EF7", "", `\u8BC4\u5206\u7248\u672C\uFF1A${VERSION}\u3002\u539F\u521B\u7EFC\u5408\u6307\u6807\uFF0C\u975E\u8BA4\u8BC1\u3002`, "", `\u603B\u5206\uFF1A${s.total ?? "\u672A\u77E5"}\uFF1B\u7F3A\u8BC1\u636E\u4E0B\u53EF\u80FD\u533A\u95F4\uFF1A${Math.floor(s.interval[0])}\u2013${Math.ceil(s.interval[1])} / 100\u3002`, `\u8BC1\u636E\u8986\u76D6\uFF1A${Math.round(s.coverage * 100)}%\uFF1B\u8BC1\u636E\u8D28\u91CF\uFF1A${s.confidence}\uFF08\u4E0D\u662F\u6982\u7387\uFF09\u3002`, "", "\u7F3A\u9879\u4FDD\u7559\u672A\u77E5\uFF0C\u533A\u95F4\u4E0D\u662F\u7EDF\u8BA1\u7F6E\u4FE1\u533A\u95F4\u3002\u7EF4\u5EA6\u503C\u82E5\u6709\u7F3A\u9879\uFF0C\u4EC5\u4E3A\u5DF2\u77E5\u90E8\u5206\u7684\u6682\u5B9A\u8F6E\u5ED3\u3002", ""];
  AXES.forEach((a, i) => {
    lines.push(`## ${a}`, `\u6682\u5B9A\u7EF4\u5EA6\uFF1A${s.dimensions[i] === null ? "\u672A\u77E5" : Math.round(s.dimensions[i])}`, "");
    INDICATORS[i].forEach((name, j) => {
      const r = report.ratings[i][j];
      const d = evaluation?.decisions.find((d2) => d2.axis === i && d2.indicator === j);
      lines.push(`- ${name}\uFF1A${r.value ?? "\u672A\u77E5"} / 4${d ? `\u3002${redact(d.rationale)} \u4EBA\u7C7B\u8D21\u732E\uFF1A${redact(d.humanContribution)}\u3002agent \u6D3B\u52A8\uFF1A${redact(d.agentActivity)}\u3002\u7ED3\u679C\uFF1A${redact(d.outcome)}\u3002\u8BC1\u636E\uFF1A${d.support.join(", ") || "\u65E0"}\uFF1B\u53CD\u4F8B\uFF1A${d.counterexamples.join(", ") || "\u672A\u89C2\u5BDF\u5230\uFF0C\u4E0D\u7B49\u4E8E\u4E0D\u5B58\u5728"}` : "\u3002\u7ED3\u6784\u5143\u6570\u636E\u4E0D\u8DB3\u4EE5\u8BC1\u660E\u5B9E\u9645\u80FD\u529B\u3002"}`);
    });
    lines.push("");
  });
  const titles = { strengths: "\u6709\u8BC1\u636E\u7684\u5F3A\u9879", gaps: "\u77ED\u677F\u4E0E\u53CD\u4F8B", workPatterns: "\u5DE5\u4F5C\u4EFB\u52A1\u4E2D\u7684\u957F\u671F\u6A21\u5F0F", lifePatterns: "\u751F\u6D3B\u4EFB\u52A1\u4E2D\u7684\u957F\u671F\u6A21\u5F0F", actions: "\u53EF\u6267\u884C\u6539\u8FDB\u5EFA\u8BAE", limitations: "\u8986\u76D6\u9650\u5236\u4E0E\u66FF\u4EE3\u89E3\u91CA" };
  for (const [key, title] of Object.entries(titles)) {
    lines.push(`## ${title}`, "");
    const entries = evaluation?.narrative[key] ?? [];
    lines.push(...entries.length ? entries.map((t) => "- " + redact(t)) : ["\u5F53\u524D\u7F3A\u4E4F\u53EF\u652F\u6301\u6B64\u7ED3\u8BBA\u7684\u884C\u4E3A\u8BC1\u636E\uFF1B\u8BF7\u9009\u62E9\u65E5\u671F\u8303\u56F4\u5F00\u5C55\u6DF1\u5EA6\u8BC4\u4F30\u3002"], "");
  }
  lines.push("## \u672C\u5730\u8BC1\u636E\u7D22\u5F15", "", ...ledger.map((x) => `- ${x.id}\uFF1A${x.date} / ${x.instance} / \u4EFB\u52A1 ${x.task} / ${x.actor}\uFF1B\u6B63\u6587\u4FDD\u7559\u5728\u79C1\u5BC6\u8D26\u672C\u3002`), "", "\u672C\u62A5\u544A\u548C\u8D26\u672C\u53EF\u80FD\u5305\u542B\u4E2A\u4EBA\u4FE1\u606F\u3002\u4EC5\u4E0A\u4F20 public-score.json \u524D\u8BF7\u68C0\u67E5\u5E76\u660E\u786E\u786E\u8BA4\u3002");
  return lines.join("\n");
}

// src/visual.ts
function radarSvg(s, options = {}) {
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
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 545" role="img" font-family="system-ui" aria-label="\u516D\u7EF4\u96F7\u8FBE\u56FE\uFF1B${s.total === null ? "\u603B\u5206\u672A\u77E5" : `\u603B\u5206${s.total}`}\uFF1B\u8BC1\u636E\u8986\u76D6${Math.round(s.coverage * 100)}%"><g fill="none" stroke="#c9d4c7" stroke-width="1">${[45, 90, 135, 180].map((r) => `<polygon points="${polygon(r)}"/>`).join("")}${lines}</g>${shape}${dots}${labels}<circle cx="300" cy="265" r="60" fill="#f4f3eb"/><text x="300" y="264" text-anchor="middle" font-size="40" font-weight="600" fill="#173f35">${s.total ?? "\u2014"}</text><text x="300" y="289" text-anchor="middle" font-size="12" fill="#62746a">${s.total === null ? "\u8BC1\u636E\u4E0D\u5B8C\u6574" : "\u7EFC\u5408\u5206 / 100"}</text><text x="300" y="526" text-anchor="middle" font-size="12" fill="#62746a">\u6682\u5B9A\u8F6E\u5ED3 \xB7 \u672A\u77E5\u7EF4\u5EA6\u4E0D\u753B\u4E3A\u96F6 \xB7 \u539F\u521B\u6307\u6807\uFF0C\u975E\u8BA4\u8BC1</text></svg>`;
  if (options.dark) for (const [a, b] of Object.entries({ "#c9d4c7": "#345139", "#233e34": "#d6e6c8", "#5f756b": "#9eb69a", "#3c967c": "#a4e58a", "#348169": "#a4e58a", "#f4f3eb": "#111913", "#173f35": "#a4e58a", "#62746a": "#7c967c" })) svg = svg.replaceAll(a, b);
  return svg;
}

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
    const path = resolve2(option("receipt") ?? "reports/submission.receipt.json");
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
    console.log(JSON.stringify({ scope, limits: { fileBytes: 1048576, totalBytes: 8388608, files: 200, ledgerEntries: 500, timeMs: 2e4 }, network: "none", confirmation: scopeDigest(scope) }, null, 2));
    return;
  }
  if (command === "scan") {
    const scope = validateScope(await load(option("scope") ?? "scope.local.json"));
    const result = await collect(scope, option("confirm-scope") ?? "");
    const out = resolve2(option("out") ?? "reports/collection");
    await mkdir(dirname(out), { recursive: true });
    await mkdir(out, { mode: 448 });
    await save(join2(out, "collection.private.json"), JSON.stringify(result, null, 2));
    await save(join2(out, "report.json"), JSON.stringify(result.report, null, 2));
    await save(join2(out, "report.md"), writtenReport(result.report, void 0, result.ledger));
    console.log(JSON.stringify({ completed: true, files: result.stats.files, skipped: result.stats.skipped, truncated: result.stats.truncated, evidenceItems: result.ledger.length, coverage: 0, notes: "\u79C1\u5BC6\u7ED3\u679C\u5DF2\u5199\u5165\u6307\u5B9A\u76EE\u5F55\uFF1B\u672A\u8F93\u51FA\u6B63\u6587\uFF0C\u672A\u8054\u7F51\u3002" }));
    return;
  }
  if (command === "evaluate") {
    const collection = await load(option("collection") ?? "reports/collection/collection.private.json");
    const result = applyEvaluation(collection, await load(option("evaluation") ?? "evaluation.private.json"));
    validateReport(result.report);
    const out = resolve2(option("out") ?? "reports/assessment");
    await mkdir(dirname(out), { recursive: true });
    await mkdir(out, { mode: 448 });
    await save(join2(out, "report.json"), JSON.stringify(result.report, null, 2));
    await save(join2(out, "report.md"), writtenReport(result.report, result.evaluation, collection.ledger));
    await save(join2(out, "public-score.json"), JSON.stringify(publicScore(result.report), null, 2));
    const svg = radarSvg(result.report.summary);
    await save(join2(out, "report.html"), `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'"><title>Agent Mirror \u79BB\u7EBF\u62A5\u544A</title><style>body{max-width:880px;margin:3em auto;padding:1em;font:16px/1.8 system-ui;background:#f3f1e9;color:#153e36}svg{max-width:600px}pre{white-space:pre-wrap}</style>${svg}<pre>${escape(writtenReport(result.report, result.evaluation, collection.ledger))}</pre></html>`);
    console.log(JSON.stringify({ completed: true, coverage: result.report.summary.coverage, confidence: result.report.summary.confidence, total: result.report.summary.total, notes: "\u672C\u5730\u6587\u5B57\u3001\u96F7\u8FBE\u4E0E\u805A\u5408\u6587\u4EF6\u5DF2\u751F\u6210\uFF1B\u672A\u4E0A\u4F20\u3002" }));
    return;
  }
  if (command === "export") {
    const report = validateReport(await load(option("report") ?? "reports/assessment/report.json"));
    const score = publicScore(report, option("nickname") ?? "");
    if (option("confirm-public") !== "yes") throw Error("\u5148\u68C0\u67E5\u805A\u5408\u5B57\u6BB5\uFF1B\u4EC5\u660E\u786E\u540C\u610F\u516C\u5F00\u6635\u79F0\u4E0E\u5206\u6570\u540E\u4F7F\u7528 --confirm-public yes \u5BFC\u51FA\u516C\u5F00\u526F\u672C");
    await save(resolve2(option("out") ?? "reports/public-score.json"), JSON.stringify(score, null, 2));
    console.log("\u5DF2\u5BFC\u51FA\u805A\u5408\u526F\u672C\uFF0C\u5C1A\u672A\u4E0A\u4F20\u3002");
    return;
  }
  console.log("AI Native Score\nplan --scope scope.local.json\nscan --scope scope.local.json --confirm-scope <plan\u6458\u8981> --out reports/collection\nevaluate --collection <\u79C1\u5BC6\u6536\u96C6\u7ED3\u679C> --evaluation <agent\u751F\u6210\u51B3\u7B56> --out reports/assessment\npublish-plan --score <\u805A\u5408\u5206\u6570> [--site <HTTPS\u7AD9\u70B9>]\npublish --score <\u805A\u5408\u5206\u6570> [--site <\u7AD9\u70B9>] --confirm-public <\u8BA1\u5212\u6458\u8981> --receipt <\u79C1\u5BC6\u51ED\u636E>\ndelete --receipt <\u79C1\u5BC6\u51ED\u636E> --confirm-delete <\u5BF9\u5E94ID>\n\u6240\u6709\u6536\u96C6\u4E0E\u8BC4\u4F30\u547D\u4EE4\u96F6\u7F51\u7EDC\uFF1B\u53EA\u6709\u5355\u72EC\u786E\u8BA4\u7684publish/delete\u8054\u7F51\u3002");
}
function escape(s) {
  return s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}
main().catch(() => {
  console.error("\u64CD\u4F5C\u672A\u5B8C\u6210\uFF1A\u8BF7\u68C0\u67E5\u53C2\u6570\u3001\u8303\u56F4\u786E\u8BA4\u3001\u8F93\u5165schema\u6216\u8DEF\u5F84\u6743\u9650\u3002\u672A\u8F93\u51FA\u79C1\u5BC6\u9519\u8BEF\u7EC6\u8282\u3002");
  process.exitCode = 1;
});
