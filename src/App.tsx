import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle, Check, ChevronDown, ClipboardCheck, Download, FileCode2, GitCompare,
  History, Info, Layers3, Lock, Plus, RefreshCw, Rocket, Search, ShieldCheck,
  Sparkles, Upload, X,
} from 'lucide-react';
import {
  CheckRecord, ConditionalRow, Dep, GateIssue, GateResult, LICENSE_CHOICES,
  LICENSE_META, MODES, ModeId, confirmationKey, evaluateGate, factOf, formatTime,
  licenseColor, licenseLabel, newId, seedDeps,
} from './licenseModel';

// ---- 持久化：清单 / 已选 / 门禁结果 / 分发方式 / 修订号 分开存储，刷新后保持一致 ----
const K_DEPS = 'license-lens-deps-v2';
const K_SELECTED = 'license-lens-selected-v2';
const K_GATE = 'license-lens-gate-v2';
const K_MODE = 'license-lens-mode-v2';
const K_REVISION = 'license-lens-revision-v2';

function loadDeps(): Dep[] {
  try {
    const raw = localStorage.getItem(K_DEPS);
    if (raw) {
      const parsed = JSON.parse(raw) as Dep[];
      if (Array.isArray(parsed) && parsed.length) return parsed;
    }
  } catch { /* 损坏时回落到内置清单，绝不清空 */ }
  return seedDeps(Date.now());
}
function loadNum(key: string, fallback: number): number {
  const v = Number(localStorage.getItem(key));
  return Number.isFinite(v) && v > 0 ? v : fallback;
}
function loadGate(): GateResult | null {
  try {
    const raw = localStorage.getItem(K_GATE);
    return raw ? (JSON.parse(raw) as GateResult) : null;
  } catch { return null; }
}

type Modal =
  | { type: 'add' }
  | { type: 'verify'; depId: string }
  | { type: 'gate' }
  | null;

type Filter = 'all' | 'match' | 'mismatch' | 'unverified';

const GROUPS: { id: GateIssue['group']; title: string; tone: 'red' | 'orange' }[] = [
  { id: 'fact', title: '事实核对未通过（声明与核验不一致 / 未核验）', tone: 'red' },
  { id: 'unknown', title: '许可证无法识别，需法律复核', tone: 'red' },
  { id: 'compatible', title: '许可证与当前分发方式不兼容', tone: 'red' },
  { id: 'obligation', title: '附条件分发义务尚未全部确认', tone: 'orange' },
];

export default function App() {
  const [deps, setDeps] = useState<Dep[]>(loadDeps);
  const [revision, setRevision] = useState<number>(() => loadNum(K_REVISION, 1));
  const [selectedId, setSelectedId] = useState<string>(() => {
    const saved = localStorage.getItem(K_SELECTED);
    const list = loadDeps();
    return saved && list.some((d) => d.id === saved) ? saved : list[0]?.id ?? '';
  });
  const [mode, setMode] = useState<ModeId>(() => (localStorage.getItem(K_MODE) as ModeId) || 'bundle');
  const [gate, setGate] = useState<GateResult | null>(loadGate);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [modal, setModal] = useState<Modal>(null);

  useEffect(() => { localStorage.setItem(K_DEPS, JSON.stringify(deps)); }, [deps]);
  useEffect(() => { localStorage.setItem(K_REVISION, String(revision)); }, [revision]);
  useEffect(() => { localStorage.setItem(K_SELECTED, selectedId); }, [selectedId]);
  useEffect(() => { localStorage.setItem(K_MODE, mode); }, [mode]);
  useEffect(() => {
    if (gate) localStorage.setItem(K_GATE, JSON.stringify(gate));
  }, [gate]);

  const bump = () => setRevision((r) => r + 1);

  // 切换分发方式会改变附条件义务集合与兼容性判定，旧门禁结果同样失效
  const changeMode = (m: ModeId) => {
    if (m === mode) return;
    setMode(m);
    bump();
  };

  const current = deps.find((d) => d.id === selectedId) ?? deps[0];
  const counts = useMemo(() => {
    const c = { match: 0, mismatch: 0, unverified: 0 };
    deps.forEach((d) => { c[factOf(d).kind] += 1; });
    return c;
  }, [deps]);
  const pending = counts.mismatch + counts.unverified;

  const filtered = useMemo(() => deps.filter((d) => {
    const kind = factOf(d).kind;
    const q = query.trim().toLowerCase();
    return (filter === 'all' || kind === filter)
      && (!q || `${d.name} ${d.version} ${d.declaredLicense}`.toLowerCase().includes(q));
  }), [deps, filter, query]);

  const gateStale = !!gate && gate.revision !== revision;

  // ---- 变更：新增 / 重新核验 / 义务确认，都会推进修订号，使旧门禁结果失效 ----
  const addDep = (name: string, version: string, declaredLicense: string, source: string) => {
    const dep: Dep = {
      id: newId('dep'), name: name.trim(), version: version.trim() || '0.0.0',
      source, declaredLicense, addedAt: Date.now(), history: [], confirmations: {},
    };
    setDeps((ds) => [...ds, dep]);
    setSelectedId(dep.id);
    setModal(null);
    bump();
  };

  const saveCheck = (
    depId: string, declaredVersion: string, declaredLicense: string,
    verifiedLicense: string, verifiedSource: string, sourceRef: string,
    reviewer: string, note: string,
  ) => {
    const record: CheckRecord = {
      id: newId('chk'), at: Date.now(),
      declaredVersion, declaredLicense, verifiedLicense,
      verifiedSource: verifiedSource.trim() || '未填写', sourceRef: sourceRef.trim() || '未填写',
      reviewer: reviewer.trim() || '未署名', note: note.trim() || undefined,
      result: declaredLicense === verifiedLicense ? 'match' : 'mismatch',
      diff: declaredLicense === verifiedLicense ? undefined
        : `包内声明 ${declaredLicense}，人工核验（${verifiedSource}：${sourceRef}）为 ${verifiedLicense}`,
    };
    setDeps((ds) => ds.map((d) => d.id === depId
      ? { ...d, version: declaredVersion, declaredLicense, history: [record, ...d.history] }
      : d));
    setModal(null);
    bump();
  };

  const toggleConfirm = (dep: Dep, license: string, obId: string) => {
    const key = confirmationKey(license, mode, obId);
    setDeps((ds) => ds.map((d) => d.id === dep.id
      ? { ...d, confirmations: { ...d.confirmations, [key]: !d.confirmations[key] } }
      : d));
    bump();
  };

  const runGate = () => {
    setGate(evaluateGate(deps, mode, revision, Date.now()));
  };
  const release = () => {
    if (!gate || !gate.pass || gateStale) return;
    setGate({ ...gate, releasedAt: Date.now() });
  };

  const exportMd = () => {
    const rows = deps.map((d) => {
      const { kind, record } = factOf(d);
      const fact = kind === 'match' ? '一致 ✅' : kind === 'mismatch' ? '不一致 🚫' : '待核验 ⏳';
      const verified = record ? record.verifiedLicense : '—';
      const diff = kind === 'mismatch' ? `差异：${record!.diff}` : '';
      return `| ${d.name} | ${d.version} | ${d.declaredLicense} | ${verified} | ${fact} | ${diff} |`;
    });
    const modeDef = MODES.find((m) => m.id === mode)!;
    const gatePart = gate
      ? [`## 最近一次发布检查（${modeDef.label}，修订 #${gate.revision}）`,
        gate.revision !== revision ? '> ⚠️ 检查后清单已变更，结果失效，需重新检查。' : '',
        gate.pass ? '结论：**可以放行**' : `结论：**阻断发布**，共 ${gate.issues.length} 条阻断原因`,
        ...gate.issues.map((i) => `- [${i.group}] ${i.title} — ${i.detail}`),
      ].join('\n')
      : '## 尚未执行发布检查';
    const text = `# License Lens 许可证事实核对报告\n\n`
      + `## 依赖清单（${deps.length} 个）\n\n`
      + `| 依赖 | 版本 | 包内声明 | 人工核验 | 事实结论 | 差异 |\n|---|---|---|---|---|---|\n`
      + `${rows.join('\n')}\n\n${gatePart}\n`;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: 'text/markdown' }));
    a.download = 'license-fact-report.md';
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="shell">
      <aside>
        <div className="brand">
          <div className="brand-icon"><ShieldCheck size={18} /></div>
          <div><b>License Lens</b><small>fact &amp; release gate</small></div>
        </div>
        <div className="nav-title">WORKSPACE</div>
        <button className="nav active"><Layers3 size={16} />依赖总览</button>
        <button className="nav"><FileCode2 size={16} />许可证清单 <span>{deps.length}</span></button>
        <button className="nav"><AlertTriangle size={16} />待核对 <span className="red">{pending}</span></button>
        <div className="aside-bottom">
          <div className="mini-card">
            <GitCompare size={16} />
            <div><b>事实核对模式</b><small>包内声明 vs 人工核验来源</small></div>
          </div>
          <div className="user"><div className="avatar">ZL</div><span>Zen Li</span><ChevronDown size={14} /></div>
        </div>
      </aside>

      <main>
        <header>
          <div>
            <div className="crumb">WORKSPACE / <b>PROJECT SCAN</b></div>
            <h1>许可证事实核对与发布门禁</h1>
            <p>逐项核对包内声明与人工核验，按分发方式汇总附条件义务，全部通过才放行。</p>
          </div>
          <div className="head-actions">
            <button className="outline" onClick={exportMd}><Download size={15} />导出报告</button>
            <button className="primary" onClick={() => setModal({ type: 'add' })}><Plus size={16} />添加依赖</button>
          </div>
        </header>

        <section className="hero">
          <div>
            <span className="tag">PROJECT · AURORA-WEB · REV #{revision}</span>
            <h2>发布前，先把事实核对清楚。</h2>
            <p>
              共 <b>{deps.length} 个依赖</b>：<b className="teal2">{counts.match} 个声明与核验一致</b>，
              <b className="warning"> {pending} 个待处理</b>
              {counts.mismatch > 0 && <>，其中 <b className="red2">{counts.mismatch} 个两者不一致，不能放行</b></>}。
            </p>
          </div>
          <div className="scan-score">
            <div className="score-ring" style={{ borderColor: pending ? '#e0a94e' : '#39b294' }}>
              <strong>{deps.length ? Math.round((counts.match / deps.length) * 100) : 0}<small>%</small></strong>
            </div>
            <div><span>事实一致率</span><b>{pending ? '需处理' : '全部一致'}</b><small>修订号随每次变更递增</small></div>
          </div>
        </section>

        <section className="summary">
          <div><span>全部依赖</span><b>{deps.length}</b><small>原清单保留，不可清空</small></div>
          <div><span>核对一致</span><b className="teal">{counts.match}</b><small>声明与人工核验相同</small></div>
          <div><span>不一致 · 阻断</span><b className="red">{counts.mismatch}</b><small>差异处置前不得放行</small></div>
          <div><span>待核验</span><b className="orange">{counts.unverified}</b><small>缺少人工核验来源</small></div>
        </section>

        {/* 发布门禁条 */}
        <GateBanner gate={gate} stale={gateStale} revision={revision} mode={mode} onMode={changeMode}
          onRun={runGate} onOpen={() => setModal({ type: 'gate' })} />

        <section className="workspace">
          <div className="table-pane">
            <div className="pane-head">
              <div><h2>依赖清单</h2><p>包内声明许可证 → 人工核验事实</p></div>
              <div className="tools">
                <div className="search">
                  <Search size={15} />
                  <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="搜索依赖" />
                </div>
                <select value={filter} onChange={(e) => setFilter(e.target.value as Filter)}>
                  <option value="all">全部结论</option>
                  <option value="match">一致</option>
                  <option value="mismatch">不一致</option>
                  <option value="unverified">待核验</option>
                </select>
              </div>
            </div>
            <div className="table">
              <div className="tr th fact-tr">
                <span>依赖名称</span><span>版本</span><span>声明 / 核验</span><span>事实结论</span>
              </div>
              {filtered.map((d) => {
                const { kind, record } = factOf(d);
                return (
                  <button key={d.id}
                    className={`tr fact-tr ${current?.id === d.id ? 'selected' : ''}`}
                    onClick={() => setSelectedId(d.id)}>
                    <span className="dep-name"><span className="pkg-dot" /> {d.name}</span>
                    <span className="muted">{d.version}</span>
                    <span className="lic-pair">
                      <i className="license" style={licStyle(d.declaredLicense)}>{licenseLabel(d.declaredLicense)}</i>
                      <span className="arrow">→</span>
                      <i className="license" style={licStyle(record?.verifiedLicense ?? '')}>
                        {record ? licenseLabel(record.verifiedLicense) : '未核验'}
                      </i>
                    </span>
                    <FactBadge kind={kind} />
                  </button>
                );
              })}
              {filtered.length === 0 && <div className="empty-row">没有匹配的依赖</div>}
            </div>
          </div>

          {current && (
            <DetailPane dep={current} mode={mode} onMode={changeMode}
              onVerify={() => setModal({ type: 'verify', depId: current.id })}
              onToggle={(obId) => {
                const rec = current.history[0];
                if (rec) toggleConfirm(current, rec.verifiedLicense, obId);
              }} />
          )}
        </section>
      </main>

      {modal?.type === 'add' && <AddModal onClose={() => setModal(null)} onAdd={addDep} />}
      {modal?.type === 'verify' && (() => {
        const dep = deps.find((d) => d.id === modal.depId);
        return dep ? <VerifyModal dep={dep} onClose={() => setModal(null)} onSave={saveCheck} /> : null;
      })()}
      {modal?.type === 'gate' && (
        <GateModal gate={gate} stale={gateStale} revision={revision} mode={mode} onMode={changeMode}
          onRun={runGate} onRelease={release} onClose={() => setModal(null)}
          onToggle={(depId, license, obId) => {
            const dep = deps.find((d) => d.id === depId);
            if (dep) toggleConfirm(dep, license, obId);
          }} />
      )}
    </div>
  );
}

function licStyle(license: string): React.CSSProperties {
  const c = licenseColor(license);
  return { color: c, background: `${c}18` };
}

function FactBadge({ kind }: { kind: 'match' | 'mismatch' | 'unverified' }) {
  if (kind === 'match')
    return <span className="status ok"><Check size={13} /> 一致</span>;
  if (kind === 'mismatch')
    return <span className="status risk"><GitCompare size={13} /> 不一致</span>;
  return <span className="status warn"><ClipboardCheck size={13} /> 待核验</span>;
}

// ---------------- 发布门禁条 ----------------

function GateBanner({ gate, stale, revision, mode, onMode, onRun, onOpen }: {
  gate: GateResult | null; stale: boolean; revision: number; mode: ModeId;
  onMode: (m: ModeId) => void; onRun: () => void; onOpen: () => void;
}) {
  return (
    <section className={`gate-banner ${gate && !stale ? (gate.pass ? 'pass' : 'block') : 'idle'}`}>
      <div className="gate-main">
        <div className="gate-title">
          {gate
            ? stale
              ? <><AlertTriangle size={17} /><b>检查结果已失效</b></>
              : gate.pass
                ? <><ShieldCheck size={17} /><b>检查通过，可以放行</b></>
                : <><AlertTriangle size={17} /><b>发布被阻断：{gate.issues.length} 条原因</b></>
            : <><Info size={17} /><b>尚未执行发布检查</b></>}
        </div>
        <div className="gate-meta">
          {gate && <>最近检查 {formatTime(gate.at)} · 修订 #{gate.revision}{stale && `（当前 #${revision}）`}</>}
          {gate && !stale && gate.releasedAt && <span className="released"><Rocket size={13} /> 已于 {formatTime(gate.releasedAt)} 放行</span>}
        </div>
      </div>
      <div className="gate-controls">
        <div className="seg">
          {MODES.map((m) => (
            <button key={m.id} className={mode === m.id ? 'on' : ''} onClick={() => onMode(m.id)}
              title={m.hint}>{m.label}</button>
          ))}
        </div>
        <button className="outline" onClick={onRun}><RefreshCw size={14} /> 执行发布检查</button>
        <button className="primary" onClick={onOpen}>查看阻断原因</button>
      </div>
    </section>
  );
}

// ---------------- 依赖详情 ----------------

function DetailPane({ dep, mode, onMode, onVerify, onToggle }: {
  dep: Dep; mode: ModeId; onMode: (m: ModeId) => void; onVerify: () => void;
  onToggle: (obId: string) => void;
}) {
  const { kind, record } = factOf(dep);
  const meta = record ? LICENSE_META[record.verifiedLicense] : undefined;
  const modeDef = MODES.find((m) => m.id === mode)!;
  const verified = kind === 'match';

  return (
    <div className="detail">
      <div className="detail-head">
        <div className="detail-icon" style={licStyle(record?.verifiedLicense ?? dep.declaredLicense)}>
          <FileCode2 size={20} />
        </div>
        <div>
          <span>SELECTED DEPENDENCY · {dep.source === '手动' ? '手动登记' : 'npm'}</span>
          <h2>{dep.name}</h2>
        </div>
        <button className="verify-btn" onClick={onVerify}>
          {kind === 'unverified' ? <><ClipboardCheck size={14} /> 人工核验</> : <><RefreshCw size={14} /> 修订并重新核验</>}
        </button>
      </div>

      <div className="detail-grid">
        <div><label>版本</label><b>{dep.version}</b></div>
        <div><label>包内声明许可证</label><b style={{ color: licenseColor(dep.declaredLicense) }}>{licenseLabel(dep.declaredLicense)}</b></div>
        <div>
          <label>人工核验许可证</label>
          <b style={{ color: licenseColor(record?.verifiedLicense ?? '') }}>
            {record ? licenseLabel(record.verifiedLicense) : '尚未核验'}
          </b>
        </div>
      </div>

      {/* 事实核对结论：不一致时列出依赖、版本与差异 */}
      <div className={`finding ${kind === 'match' ? 'ok' : kind === 'mismatch' ? 'risk' : 'warn'}`}>
        <div className="finding-icon">
          {kind === 'match' ? <Check size={16} /> : <GitCompare size={16} />}
        </div>
        <div>
          <b>{kind === 'match' ? '声明与人工核验一致' : kind === 'mismatch' ? '包内声明与人工核验不一致 —— 不能放行' : '缺少人工核验来源 —— 不能放行'}</b>
          {kind === 'mismatch' && record && (
            <div className="diff-box">
              <div><b>依赖：</b>{dep.name} <b>版本：</b>{record.declaredVersion}</div>
              <div><b>包内声明：</b>{record.declaredLicense} ｜ <b>人工核验：</b>{record.verifiedLicense}</div>
              <div className="diff-text">差异：{record.diff}</div>
            </div>
          )}
          {kind === 'unverified' && <p>请人工核对包内 LICENSE / registry 元数据后登记核验来源。</p>}
          {kind === 'match' && record && <p>核验来源：{record.verifiedSource}（{record.sourceRef}），{record.reviewer} 于 {formatTime(record.at)} 登记。</p>}
        </div>
      </div>

      {/* 按当前分发方式的附条件义务确认 */}
      {verified && meta && !meta.unknown && (
        <div className="obligations">
          <div className="obl-head">
            <Lock size={14} />
            <b>附条件分发义务</b>
            <span className="obl-mode">{modeDef.label}</span>
          </div>
          <div className="seg small">
            {MODES.map((m) => (
              <button key={m.id} className={mode === m.id ? 'on' : ''} onClick={() => onMode(m.id)}>{m.label}</button>
            ))}
          </div>
          {!modeDef.public
            ? <p className="obl-note">仅内部使用、不对外分发：无附条件分发义务，但事实核对仍须一致。</p>
            : meta.obligations.map((o) => {
              const key = confirmationKey(record!.verifiedLicense, mode, o.id);
              const done = !!dep.confirmations[key];
              return (
                <label key={o.id} className={`obl-item ${done ? 'done' : ''}`}>
                  <input type="checkbox" checked={done} onChange={() => onToggle(o.id)} />
                  <span>{o.label}</span>
                  {!done && <em>未确认 · 阻断发布</em>}
                </label>
              );
            })}
          {modeDef.public && (
            (meta.copyleft === 'strong' || (meta.copyleft === 'weak' && mode === 'bundle'))
              ? <p className="obl-warn"><AlertTriangle size={13} /> {meta.copyleft === 'strong'
                ? '强著佐权许可证与对外分发不兼容。'
                : '弱著佐权在打包分发时触发源代码开放义务。'}</p>
              : (meta.copyleft === 'weak'
                ? <p className="obl-note"><Info size={13} /> 弱著佐权：公开发布制品需履行源代码提供义务。</p>
                : null)
          )}
        </div>
      )}

      {/* 核验历史：旧结论继续可查 */}
      <div className="history">
        <div className="obl-head"><History size={14} /><b>检查记录（{dep.history.length}）</b><small>最新在前，历史结论保留</small></div>
        {dep.history.length === 0 && <p className="obl-note">暂无核验记录。</p>}
        {dep.history.map((r, i) => (
          <div key={r.id} className={`hist-item ${r.result} ${i === 0 ? 'latest' : ''}`}>
            <div className="hist-top">
              {r.result === 'match'
                ? <span className="status ok"><Check size={12} /> 一致</span>
                : <span className="status risk"><GitCompare size={12} /> 不一致</span>}
              {i === 0 && <span className="latest-tag">当前结论</span>}
              <span className="hist-time">{formatTime(r.at)}</span>
            </div>
            <div className="hist-body">
              <div>版本 {r.declaredVersion} · 声明 {r.declaredLicense} → 核验 {r.verifiedLicense}</div>
              <div className="muted">{r.verifiedSource} · {r.sourceRef} · {r.reviewer}</div>
              {r.diff && <div className="diff-text">{r.diff}</div>}
              {r.note && <div className="muted">备注：{r.note}</div>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------- 添加依赖 ----------------

function AddModal({ onClose, onAdd }: { onClose: () => void; onAdd: (n: string, v: string, l: string, s: string) => void }) {
  const [name, setName] = useState('');
  const [version, setVersion] = useState('');
  const [license, setLicense] = useState('MIT');
  const [source, setSource] = useState('npm');
  return (
    <div className="backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2><Plus size={17} /> 添加依赖</h2>
          <button onClick={onClose}>×</button>
        </div>
        <p className="modal-note">新登记的依赖只有包内声明，必须完成人工核验后才可能放行。</p>
        <label>依赖名称<input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="例如 date-fns" /></label>
        <label>版本<input value={version} onChange={(e) => setVersion(e.target.value)} placeholder="例如 3.6.0" /></label>
        <label>包内声明许可证
          <select value={license} onChange={(e) => setLicense(e.target.value)}>
            {LICENSE_CHOICES.map((l) => <option key={l} value={l}>{licenseLabel(l)}</option>)}
          </select>
        </label>
        <label>来源
          <select value={source} onChange={(e) => setSource(e.target.value)}>
            <option value="npm">npm</option>
            <option value="手动">手动登记</option>
          </select>
        </label>
        <button className="primary full" disabled={!name.trim()}
          onClick={() => onAdd(name, version, license, source)}>加入清单（待核验）</button>
      </div>
    </div>
  );
}

// ---------------- 核验 / 重新核验（生成新记录，旧记录保留） ----------------

function VerifyModal({ dep, onClose, onSave }: {
  dep: Dep; onClose: () => void;
  onSave: (depId: string, ver: string, dl: string, vl: string, src: string, ref: string, rv: string, note: string) => void;
}) {
  const latest = dep.history[0];
  const [declaredVersion, setDeclaredVersion] = useState(latest?.declaredVersion ?? dep.version);
  const [declaredLicense, setDeclaredLicense] = useState(latest?.declaredLicense ?? dep.declaredLicense);
  const [verifiedLicense, setVerifiedLicense] = useState(latest?.verifiedLicense ?? dep.declaredLicense);
  const [verifiedSource, setVerifiedSource] = useState(latest?.verifiedSource ?? '');
  const [sourceRef, setSourceRef] = useState(latest?.sourceRef ?? '');
  const [reviewer, setReviewer] = useState(latest?.reviewer ?? 'Zen Li');
  const [note, setNote] = useState(latest?.note ?? '');
  const mismatch = declaredLicense !== verifiedLicense;

  return (
    <div className="backdrop" onClick={onClose}>
      <div className="modal wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2><ClipboardCheck size={17} /> {latest ? '修订并重新核验' : '人工核验'} · {dep.name}</h2>
          <button onClick={onClose}>×</button>
        </div>
        <p className="modal-note">
          {latest ? '已核对依赖再次修改会生成一条新的检查记录，旧结论在「检查记录」中继续可查。' : '请分别填写包内声明与人工核验事实，两者不一致将阻断放行。'}
        </p>
        <div className="form-cols">
          <label>包内声明版本<input value={declaredVersion} onChange={(e) => setDeclaredVersion(e.target.value)} /></label>
          <label>包内声明许可证
            <select value={declaredLicense} onChange={(e) => setDeclaredLicense(e.target.value)}>
              {LICENSE_CHOICES.map((l) => <option key={l} value={l}>{licenseLabel(l)}</option>)}
            </select>
          </label>
          <label>人工核验许可证
            <select value={verifiedLicense} onChange={(e) => setVerifiedLicense(e.target.value)}>
              {LICENSE_CHOICES.map((l) => <option key={l} value={l}>{licenseLabel(l)}</option>)}
            </select>
          </label>
          <label>核验渠道<input value={verifiedSource} onChange={(e) => setVerifiedSource(e.target.value)}
            placeholder="npm registry / 随包 LICENSE / 官网 …" /></label>
          <label>引用位置（URL 或包内路径）<input value={sourceRef} onChange={(e) => setSourceRef(e.target.value)}
            placeholder="https://… 或 node_modules/…/LICENSE" /></label>
          <label>核验人<input value={reviewer} onChange={(e) => setReviewer(e.target.value)} /></label>
        </div>
        <label>备注<input value={note} onChange={(e) => setNote(e.target.value)} placeholder="差异原因 / 处置建议（可选）" /></label>
        <div className={`verdict ${mismatch ? 'risk' : 'ok'}`}>
          {mismatch ? <GitCompare size={15} /> : <Check size={15} />}
          {mismatch
            ? `结论：不一致（${declaredLicense} ≠ ${verifiedLicense}），保存后阻断放行`
            : `结论：一致（${verifiedLicense}），保存后进入义务确认`}
        </div>
        <button className="primary full" onClick={() => onSave(dep.id, declaredVersion.trim() || dep.version,
          declaredLicense, verifiedLicense, verifiedSource, sourceRef, reviewer, note)}>
          <Upload size={14} /> 生成检查记录
        </button>
      </div>
    </div>
  );
}

// ---------------- 发布门禁弹窗 ----------------

function GateModal({ gate, stale, revision, mode, onMode, onRun, onRelease, onClose, onToggle }: {
  gate: GateResult | null; stale: boolean; revision: number; mode: ModeId;
  onMode: (m: ModeId) => void; onRun: () => void; onRelease: () => void; onClose: () => void;
  onToggle: (depId: string, license: string, obId: string) => void;
}) {
  return (
    <div className="backdrop" onClick={onClose}>
      <div className="modal gate-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2><ShieldCheck size={17} /> 发布门禁</h2>
          <button onClick={onClose}>×</button>
        </div>

        <div className="gate-runbar">
          <div className="seg">
            {MODES.map((m) => (
              <button key={m.id} className={mode === m.id ? 'on' : ''} onClick={() => onMode(m.id)} title={m.hint}>{m.label}</button>
            ))}
          </div>
          <span className="rev-tag">清单修订 #{revision}</span>
          <button className="primary" onClick={onRun}><RefreshCw size={14} /> {gate ? '重新检查' : '执行检查'}</button>
        </div>
        <p className="modal-note">{MODES.find((m) => m.id === mode)!.hint}。附条件义务按此分发方式汇总。</p>

        {!gate && <div className="gate-empty">选择分发方式后执行检查，未通过时将列出依赖、版本与阻断原因。</div>}

        {gate && stale && (
          <div className="finding warn stale-note">
            <div className="finding-icon"><AlertTriangle size={16} /></div>
            <div><b>检查结果已失效</b>
              <p>检查（修订 #{gate.revision}）之后清单或义务确认发生了变化（当前修订 #{revision}），阻断原因可能已改变，请重新检查。</p>
            </div>
          </div>
        )}

        {gate && (
          <>
            <div className={`gate-verdict ${gate.pass && !stale ? 'ok' : 'bad'}`}>
              {gate.pass && !stale ? <ShieldCheck size={18} /> : <AlertTriangle size={18} />}
              <div>
                <b>{gate.pass ? (stale ? '上次检查通过，但结果已失效' : '检查通过，可以放行发布') : `阻断发布：${gate.issues.length} 条阻断原因`}</b>
                <small>{formatTime(gate.at)} · 分发方式：{MODES.find((m) => m.id === gate.mode)!.label} · 修订 #{gate.revision}</small>
              </div>
            </div>

            {GROUPS.map((g) => {
              const list = gate.issues.filter((i) => i.group === g.id);
              if (!list.length) return null;
              return (
                <div key={g.id} className="issue-group">
                  <h3 className={g.tone}>{g.title}（{list.length}）</h3>
                  {list.map((i, idx) => (
                    <div key={`${i.depId}-${idx}`} className="issue">
                      <AlertTriangle size={14} />
                      <div><b>{i.title}</b><p>{i.detail}</p></div>
                    </div>
                  ))}
                </div>
              );
            })}

            <ConditionalSection rows={gate.rows} mode={gate.mode} onToggle={onToggle} />

            {gate.pass && !stale && (
              gate.releasedAt
                ? <div className="released-box"><Rocket size={16} /> 已放行：{formatTime(gate.releasedAt)}</div>
                : <button className="primary full release-btn" onClick={onRelease}><Rocket size={15} /> 确认放行发布</button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function ConditionalSection({ rows, mode, onToggle }: {
  rows: ConditionalRow[]; mode: ModeId; onToggle: (depId: string, license: string, obId: string) => void;
}) {
  if (!MODES.find((m) => m.id === mode)!.public)
    return <p className="obl-note">仅内部使用：不产生附条件分发义务。</p>;
  if (!rows.length)
    return <p className="obl-note">当前没有需要履行分发义务的许可证（强著佐权项见上方阻断原因）。</p>;
  return (
    <div className="issue-group">
      <h3 className="teal">附条件依赖汇总（{rows.length}）</h3>
      {rows.map((r) => (
        <div key={r.depId} className="cond-row">
          <div className="cond-head">
            <b>{r.name}</b><span className="muted">{r.version}</span>
            <i className="license" style={licStyle(r.license)}>{licenseLabel(r.license)}</i>
            {r.obligations.every((o) => o.confirmed)
              ? <span className="status ok"><Check size={12} /> 义务已确认</span>
              : <span className="status risk"><AlertTriangle size={12} /> 义务待确认</span>}
          </div>
          {r.obligations.map((o) => (
            <label key={o.id} className={`obl-item ${o.confirmed ? 'done' : ''}`}>
              <input type="checkbox" checked={o.confirmed} onChange={() => onToggle(r.depId, r.license, o.id)} />
              <span>{o.label}</span>
              {!o.confirmed && <em>缺少义务确认</em>}
            </label>
          ))}
        </div>
      ))}
      <p className="modal-note">勾选确认即修改清单，修订号递增，需要重新执行检查后才能放行。</p>
    </div>
  );
}
