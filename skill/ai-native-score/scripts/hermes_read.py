"""Bounded Hermes SQLite adapter. No agent code imports; SELECT-only, no network."""
import sys, sqlite3, pathlib, datetime, time, json, re, os, stat
path, start, end = sys.argv[1:]
p = pathlib.Path(path)
if p.name != 'state.db' or p.is_symlink() or not stat.S_ISREG(p.stat().st_mode):
    raise SystemExit('Unsupported database')
deadline = time.monotonic() + 10
db = sqlite3.connect(p.as_uri() + '?mode=ro', uri=True, timeout=1)
db.execute('PRAGMA query_only=ON')
db.set_progress_handler(lambda: int(time.monotonic() > deadline), 1000)
columns = {row[1] for row in db.execute('PRAGMA table_info(messages)')}
required = {'session_id', 'role', 'content', 'timestamp'}
if not required.issubset(columns):
    raise SystemExit('Unsupported Hermes messages schema')
lo = datetime.datetime.fromisoformat(start).replace(tzinfo=datetime.timezone.utc).timestamp()
hi = datetime.datetime.fromisoformat(end).replace(tzinfo=datetime.timezone.utc).timestamp() + 86400
rows = db.execute("SELECT rowid,session_id,role,substr(content,1,6000),timestamp,length(content) FROM messages WHERE timestamp>=? AND timestamp<? AND role IN ('user','assistant') ORDER BY timestamp LIMIT 500", (lo,hi))
session_columns = {row[1] for row in db.execute('PRAGMA table_info(sessions)')}
can_group = {'id','parent_session_id'}.issubset(session_columns)
roots = {}
def task_root(task):
    if not can_group:
        return task
    original, seen = task, set()
    for _ in range(24):
        if task in roots:
            task = roots[task]
            break
        if task in seen:
            break
        seen.add(task)
        row = db.execute('SELECT parent_session_id FROM sessions WHERE id=? LIMIT 1', (task,)).fetchone()
        if not row or not row[0]:
            break
        task = row[0]
    roots[original] = task
    return task
result = []
for rowid, task, role, text, timestamp, content_length in rows:
    # Redact before process boundary as well as in TS; never emit raw exceptions or SQL values.
    text = str(text or '')
    text = re.sub(r'^(\s*(?:Cookie|Set-Cookie)\s*:).*$', r'\1 [SECRET HEADER]', text, flags=re.I|re.M)
    text = re.sub(r'((?:api[_ -]?key|access[_ -]?token|refresh[_ -]?token|authorization|client[_ -]?secret|password|passwd|密钥|密码|验证码|\btoken\b)\s*[:=]\s*)(?:Bearer\s+)?[^\s,;，；]+', r'\1[SECRET]', text, flags=re.I)
    text = re.sub(r'((?:one[- ]time (?:password|code)|verification code|OTP|验证码)(?:\s+(?:is|was|为|是))?\s*[:：]?\s*)[A-Za-z0-9-]{4,12}', r'\1[SECRET]', text, flags=re.I)
    text = re.sub(r'\b(?:sk-[\w-]{8,}|gh[pousr]_[\w]{8,}|[\w+/=-]{32,})\b', '[SECRET]', text)
    text = re.sub(r'https?://[^\s\u3400-\u9fff]+|[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}|(?:/Users/|/home/)[^\s\u3400-\u9fff]+', '[PRIVATE]', text)
    result.append({'locator':'sqlite:messages:rowid='+str(rowid),'truncated':content_length > 6000,'task':str(task_root(task)),'role':role,'text':text,'date':datetime.datetime.fromtimestamp(timestamp, datetime.timezone.utc).isoformat()})
db.close()
print(json.dumps(result, ensure_ascii=False))
