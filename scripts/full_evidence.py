"""Private, offline full-evidence archive. Incremental JSON + disk-backed integrity/review index.
No agent imports, credential lookup, network, body truncation or per-volume scores.
"""
import os, sys, json, hashlib, sqlite3, tempfile, pathlib, re, shutil
os.umask(0o077)
ATOM = 16 * 1024 * 1024  # one control value/event, not corpus size
PAGE = 4 * 1024 * 1024
def unique_pairs(pairs):
    result={}
    for key,value in pairs:
        if key in result: raise ValueError('duplicate JSON key')
        result[key]=value
    return result
def invalid_constant(value): raise ValueError('nonstandard JSON number')
def decoder():return json.JSONDecoder(object_pairs_hook=unique_pairs,parse_constant=invalid_constant)
class Reader:
    def __init__(self, path):
        self.f = open(path, 'r', encoding='utf-8'); self.buf = ''; self.pos = 0; self.eof = False
    def more(self):
        self.buf = self.buf[self.pos:]; self.pos = 0
        part = self.f.read(65536); self.eof = not part; self.buf += part
        return bool(part)
    def skip(self):
        while True:
            m = re.match(r'[ \t\r\n]*', self.buf[self.pos:]); self.pos += m.end()
            if self.pos < len(self.buf) or self.eof: return
            self.more()
    def char(self, expected):
        self.skip()
        if self.pos >= len(self.buf) or self.buf[self.pos] != expected: raise ValueError('JSON structure')
        self.pos += 1
    def peek(self):
        self.skip(); return self.buf[self.pos:self.pos+1]
    def value(self):
        self.skip()
        while True:
            try:
                value, end = decoder().raw_decode(self.buf, self.pos)
                # A number can continue in the next chunk. Delimiters/EOF establish its boundary.
                if end == len(self.buf) and not self.eof and isinstance(value, (int,float)):
                    if self.more(): continue
                if end-self.pos>ATOM: raise ValueError('single JSON value exceeds explicit bound')
                self.pos = end; return value
            except json.JSONDecodeError:
                if len(self.buf)-self.pos > ATOM: raise ValueError('single value exceeds bounded memory; split control/event export explicitly')
                if self.eof or not self.more():
                    if self.eof:
                        value,end=decoder().raw_decode(self.buf,self.pos)
                        if end-self.pos>ATOM:raise ValueError('single JSON value exceeds explicit bound')
                        self.pos=end; return value
    def array(self):
        self.char('[')
        if self.peek() == ']': self.char(']'); return
        while True:
            yield self.value()
            if self.peek() == ']': self.char(']'); return
            self.char(',')
    def object(self, unique=True):
        self.char('{'); seen=set() if unique else None
        if self.peek() == '}': self.char('}'); return
        while True:
            key=self.value()
            if not isinstance(key,str) or (seen is not None and key in seen): raise ValueError('duplicate object key')
            if seen is not None:seen.add(key)
            self.char(':'); yield key
            if self.peek() == '}': self.char('}'); return
            self.char(',')
    def finish(self):
        if self.peek(): raise ValueError('trailing JSON data')
        self.f.close()
def canonical(x): return json.dumps(x,ensure_ascii=False,sort_keys=True,separators=(',',':'),allow_nan=False).encode('utf-8')
def sha(path):
    h=hashlib.sha256()
    with open(path,'rb') as f:
        while True:
            b=f.read(1024*1024)
            if not b: break
            h.update(b)
    return h.hexdigest()
def regular(path):
    p=pathlib.Path(path)
    if p.is_symlink() or not p.is_file(): raise ValueError('regular file required')
    return p

def event_record(e, ordinal):
    if not isinstance(e,dict) or not all(isinstance(e.get(k),str) for k in ['id','task','date','actor','instance','text']): raise ValueError('collection event format')
    if not e['id'] or e['actor'] not in ['human','agent','thirdparty','unknown']: raise ValueError('event identity/actor')
    e=dict(e)
    if not e.get('eventId'):
        identity=[e.get('sourceId',e['instance']),e.get('locator','record:'+str(ordinal)),e['id'],e['task'],e['date']]
        e['eventId']=hashlib.sha256(canonical(identity)).hexdigest()
    if not isinstance(e['eventId'],str): raise ValueError('eventId')
    e.setdefault('contentRef',hashlib.sha256(e['text'].encode('utf-8')).hexdigest())
    return e

def database(path):
    db=sqlite3.connect(str(path)); db.execute('PRAGMA temp_store=FILE'); db.execute('PRAGMA cache_size=-4096')
    db.execute('CREATE TABLE events(id TEXT PRIMARY KEY,event_id TEXT UNIQUE,seq INTEGER,task TEXT,meta TEXT)')
    db.execute('CREATE INDEX event_tasks ON events(task)'); db.execute('CREATE TABLE disposition(id TEXT PRIMARY KEY,status TEXT,reason TEXT)')
    db.execute('CREATE TABLE groups(task TEXT PRIMARY KEY,family TEXT)'); return db

def index_event(db,e,seq,archive_ref=""):
    # All bodies stay in the archive, never copied into the in-memory scoring projection.
    meta={k:v for k,v in e.items() if k in ['id','eventId','sourceId','snapshotId','contentRef','task','date','actor','instance','untrusted','locator','type','verification']}
    meta['archiveRef']=archive_ref
    meta['text']='[全文保存在完整私密证据分卷；此处仅为引用索引]';meta['untrusted']=True
    db.execute('INSERT INTO events VALUES(?,?,?,?,?)',(e['id'],e['eventId'],seq,e['task'],json.dumps(meta,ensure_ascii=False)))

def pack(source, out):
    source=regular(source); before=source.stat(); out=pathlib.Path(out); out.mkdir(mode=0o700)
    r=Reader(source); metadata={};meta_bytes=0; parts=[]; count=0; handle=None; current=None; found=False
    with tempfile.TemporaryDirectory(prefix='ai-score-index-') as temp:
        db=database(pathlib.Path(temp)/'index.sqlite')
        try:
            for key in r.object():
                if key != 'ledger':
                    value=r.value();meta_bytes+=len(canonical(value))+len(key.encode('utf-8'))
                    if meta_bytes>ATOM:raise ValueError('metadata control bound')
                    metadata[key]=value;continue
                found=True
                for original in r.array():
                    e=event_record(original,count); index_event(db,e,count)
                    data=canonical(e)+b'\n'
                    if len(data.decode('utf-8'))>ATOM: raise ValueError('single event exceeds explicit bound')
                    if handle is None or current['bytes']+len(data)>PAGE:
                        if handle: handle.close();current['sha256']=sha(out/current['name'])
                        current={'name':'events-%06d.jsonl'%len(parts),'bytes':0,'events':0,'firstOrdinal':count};parts.append(current);handle=open(out/current['name'],'xb')
                    handle.write(data);current['bytes']+=len(data);current['events']+=1;count+=1
                    if count%10000==0:sys.stderr.write('Retained events: %d\n'%count)
            r.finish()
            if not found: raise ValueError('ledger missing')
            if handle: handle.close();handle=None;current['sha256']=sha(out/current['name'])
            db.commit()
        finally:
            if handle: handle.close()
            db.close()
    meta_path=out/'metadata.json';meta_path.write_bytes(canonical(metadata))
    source_digest=sha(source);after=source.stat()
    if (before.st_size,before.st_mtime_ns,before.st_ino)!=(after.st_size,after.st_mtime_ns,after.st_ino): raise ValueError('source changed')
    manifest={'format':'ai-native-evidence-volumes-v1','complete':True,'events':count,'metadata':{'name':'metadata.json','sha256':sha(meta_path),'bytes':meta_path.stat().st_size},'parts':parts,'sourceSha256':source_digest}
    manifest['rootSha256']=hashlib.sha256(canonical(manifest)).hexdigest()
    (out/'manifest.json').write_bytes(canonical(manifest))
    return out/'manifest.json'

def bounded_json(path):
    p=regular(path)
    if p.stat().st_size>ATOM: raise ValueError('control value too large')
    return json.loads(p.read_text(encoding='utf-8'),object_pairs_hook=unique_pairs,parse_constant=invalid_constant)
def member(root,name):
    if not isinstance(name,str) or pathlib.Path(name).name!=name or name in ['.','..']: raise ValueError('archive path')
    return regular(root/name)
def verify(manifest_path,db):
    path=regular(manifest_path);m=bounded_json(path);root=path.parent
    given=m.get('rootSha256');body={k:v for k,v in m.items() if k!='rootSha256'}
    if m.get('format')!='ai-native-evidence-volumes-v1' or m.get('complete') is not True or given!=hashlib.sha256(canonical(body)).hexdigest(): raise ValueError('manifest integrity')
    meta=m['metadata'];p=member(root,meta['name'])
    if p.stat().st_size!=meta['bytes'] or sha(p)!=meta['sha256']: raise ValueError('metadata integrity')
    metadata=bounded_json(p);seq=0;names=set()
    for part in m['parts']:
        if part.get('firstOrdinal')!=seq:raise ValueError('volume order')
        if part['name'] in names: raise ValueError('duplicate volume')
        names.add(part['name']);p=member(root,part['name'])
        if p.stat().st_size!=part['bytes']: raise ValueError('volume size')
        n=0;observed_hash=hashlib.sha256()
        with open(p,'rb') as f:
            while True:
                line=f.readline(ATOM*4+1)
                if not line: break
                if len(line)>ATOM*4: raise ValueError('single event too large')
                observed_hash.update(line);line=line.decode('utf-8')
                if len(line)>ATOM:raise ValueError('single event too large')
                e=event_record(json.loads(line,object_pairs_hook=unique_pairs,parse_constant=invalid_constant),seq);index_event(db,e,seq,part['name']+':'+str(n+1));seq+=1;n+=1
                if seq%10000==0:sys.stderr.write('Indexed events: %d\n'%seq)
        if n!=part['events'] or observed_hash.hexdigest()!=part['sha256']: raise ValueError('volume count/integrity')
    if seq!=m['events']: raise ValueError('global event count')
    sys.stderr.write('Verified events: %d; volumes: %d\n'%(seq,len(m['parts'])))
    return m,metadata

def prepare(source,evaluation,out,is_manifest=False):
    out=pathlib.Path(out)
    evaluation=regular(evaluation);before=evaluation.stat();frozen=out/'evaluation-input.private.json'
    if frozen.exists():raise ValueError('no overwrite')
    shutil.copyfile(evaluation,frozen);after=evaluation.stat()
    if (before.st_size,before.st_mtime_ns,before.st_ino)!=(after.st_size,after.st_mtime_ns,after.st_ino):raise ValueError('evaluation changed')
    evaluation=frozen
    manifest=pathlib.Path(source) if is_manifest else pack(source,out/'evidence')
    with tempfile.TemporaryDirectory(prefix='ai-score-review-') as temp:
        db=database(pathlib.Path(temp)/'index.sqlite');m,meta=verify(manifest,db)
        data={};review={};control_bytes=0;r=Reader(regular(evaluation));review_log=open(out/'review-events.private.jsonl','xb')
        def disposition(item,status):
            ident=item if status=='reviewed' else item.get('id');reason='' if status=='reviewed' else item.get('reason')
            if not isinstance(ident,str) or not isinstance(reason,str) or (status=='excluded' and not reason.strip()) or len(reason)>2000: raise ValueError('review disposition')
            if not db.execute('SELECT 1 FROM events WHERE id=?',(ident,)).fetchone(): raise ValueError('unknown review id')
            db.execute('INSERT INTO disposition VALUES(?,?,?)',(ident,status,reason));review_log.write(canonical({'id':ident,'status':status,'reason':reason})+b'\n')
        try:
            for key in r.object():
                if key=='review':
                    for k in r.object():
                        if k in ['reviewedEvidence','excludedEvidence']:
                            for item in r.array(): disposition(item,'reviewed' if k=='reviewedEvidence' else 'excluded')
                        else: review[k]=r.value()
                elif key=='taskGroups':
                    for task in r.object(unique=False):
                        family=r.value()
                        if not isinstance(family,str) or not family or len(family)>64 or not db.execute('SELECT 1 FROM events WHERE task=?',(task,)).fetchone():raise ValueError('task family')
                        db.execute('INSERT INTO groups VALUES(?,?)',(task,family))
                else:
                    value=r.value();control_bytes+=len(canonical(value))+len(key.encode('utf-8'))
                    if control_bytes>ATOM:raise ValueError('evaluation control bound')
                    data[key]=value
            r.finish();db.commit()
        finally:review_log.close()
        refs=set()
        for d in data.get('decisions',[]):
            refs.update(d.get('support',[]));refs.update(d.get('counterexamples',[]))
            for o in d.get('observations',[]):refs.update(o.get(k) for k in ['behavior','result','verification'])
        for p in data.get('priorities',[]):refs.update(p.get('evidence',[]))
        for values in data.get('narrative',{}).values():
            for line in values:
                refs.update(re.findall(r'\be\d+\b',line))
                for token in re.findall(r'[A-Za-z0-9][A-Za-z0-9._:@|/#=-]{0,255}',line):
                    if db.execute('SELECT 1 FROM events WHERE id=?',(token,)).fetchone():refs.add(token)
        selected=[];groups={};projection_bytes=0
        for ident in refs:
            row=db.execute('SELECT meta,seq,task FROM events WHERE id=?',(ident,)).fetchone()
            status=db.execute('SELECT status FROM disposition WHERE id=?',(ident,)).fetchone()
            if not row or not status or status[0]!='reviewed': raise ValueError('referenced event not reviewed')
            projection_bytes+=len(row[0].encode('utf-8'))
            if projection_bytes>12*1024*1024:raise ValueError('citation metadata projection bound')
            selected.append((row[1],json.loads(row[0])));family=db.execute('SELECT family FROM groups WHERE task=?',(row[2],)).fetchone()
            if family:groups[row[2]]=family[0]
        selected.sort(key=lambda x:x[0]);ledger=[x[1] for x in selected]
        counts=dict(db.execute('SELECT status,count(*) FROM disposition GROUP BY status').fetchall())
        retained=m['events'];reviewed=counts.get('reviewed',0);excluded=counts.get('excluded',0)
        families=db.execute('SELECT count(DISTINCT COALESCE(g.family,e.task)) FROM events e LEFT JOIN groups g ON e.task=g.task').fetchone()[0]
        data['review']={**review,'reviewedEvidence':[x['id'] for x in ledger],'excludedEvidence':[]};data['taskGroups']=groups
        coverage={'events':retained,'reviewed':reviewed,'excluded':excluded,'families':families,'rootSha256':m['rootSha256'],'manifest':str(manifest.resolve()),'volumes':len(m['parts']),'bytes':sum(p['bytes'] for p in m['parts']),'reviewSha256':sha(out/'review-events.private.jsonl'),'evaluationSha256':sha(evaluation)}
        result={'collection':{k:v for k,v in meta.items() if k in ['scope','stats','sources','diagnostics','discovery']},'evaluation':data,'coverage':coverage}
        result['collection']['ledger']=ledger
        db.close();return result

def main():
    mode,source,out=sys.argv[1:4]
    if mode=='pack':
        path=pack(source,out);print(json.dumps({'manifest':str(path.resolve()),'complete':True}));return
    result=prepare(source,sys.argv[4],out,mode=='manifest');print(json.dumps(result,ensure_ascii=False,separators=(',',':')))
if __name__=='__main__':
    try: main()
    except Exception:
        sys.stderr.write('Full evidence validation failed; preserve inputs and inspect format/integrity. No private details printed.\n');sys.exit(1)
