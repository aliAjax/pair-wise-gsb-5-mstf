import {useMemo, useState} from 'react';
import {AlertTriangle, Check, FileCode2, History, Pencil, Scale, Search, X} from 'lucide-react';
import {depObligations, depStatus, DISTRIBUTIONS, fmtTime, isMismatch, STATUS_META} from '../license';
import type {Blocker, CheckRecord, Dependency, Distribution, ReleaseRun} from '../types';
import {LicenseBadge, Pill} from '../components/badges';

interface Props {
  deps: Dependency[];
  records: CheckRecord[];
  distribution: Distribution;
  blockers: Blocker[];
  lastRun: ReleaseRun | null;
  selected: number;
  onSelect: (id: number) => void;
  onEdit: (dep: Dependency) => void;
  onToggleObligation: (id: number) => void;
  onGoGate: () => void;
}

export default function DepsView(p: Props) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('全部');
  const current = p.deps.find(d => d.id === p.selected);

  const filtered = useMemo(
    () => p.deps.filter(d =>
      (filter === '全部' || depStatus(d, p.distribution) === filter) &&
      `${d.name}${d.declaredLicense}${d.verifiedLicense ?? ''}`.toLowerCase().includes(query.toLowerCase())),
    [p.deps, p.distribution, filter, query]);

  const count = (s: string) => p.deps.filter(d => depStatus(d, p.distribution) === s).length;

  return <>
    <section className="hero">
      <div>
        <span className="tag">RELEASE GATE · {DISTRIBUTIONS[p.distribution].label}</span>
        <h2>{p.blockers.length === 0 ? '事实核对通过，可以发布。' : `发布被阻止：${p.blockers.length} 项待处理。`}</h2>
        <p>扫描了 <b>{p.deps.length} 个依赖</b>，<b className="warning">{count('mismatch')} 个声明不一致</b>、<b className="warning">{count('pending')} 个义务待确认</b>。
          {p.lastRun ? `上次发布检查：${fmtTime(p.lastRun.ranAt)}（${p.lastRun.result === 'passed' ? '放行' : '阻止'}）` : '尚未运行发布检查'}</p>
      </div>
      <div className="scan-score">
        <div className={'score-ring' + (p.blockers.length ? ' blocked' : '')}>
          <strong>{p.deps.length ? Math.round(count('clear') / p.deps.length * 100) : 0}<small>%</small></strong>
        </div>
        <div><span>核验通过率</span><b>{p.blockers.length ? '未达标' : '达标'}</b><small>阻断项 {p.blockers.length} 个</small></div>
        <button className="primary" onClick={p.onGoGate}><Scale size={15}/>发布门禁</button>
      </div>
    </section>

    <section className="summary">
      <div><span>全部依赖</span><b>{p.deps.length}</b><small>含 {count('unverified')} 个未核验</small></div>
      <div><span>核验一致</span><b className="teal">{count('clear')}</b><small>声明与核验相符</small></div>
      <div><span>声明不一致</span><b className="red">{count('mismatch')}</b><small>不一致不得放行</small></div>
      <div><span>阻断项</span><b className="orange">{p.blockers.length}</b><small>按当前分发方式汇总</small></div>
    </section>

    <section className="workspace">
      <div className="table-pane">
        <div className="pane-head">
          <div><h2>依赖清单</h2><p>包内声明 vs 人工核验，逐项事实核对</p></div>
          <div className="tools">
            <div className="search"><Search size={15}/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="搜索依赖"/></div>
            <select value={filter} onChange={e => setFilter(e.target.value)}>
              <option value="全部">全部状态</option>
              {Object.entries(STATUS_META).map(([k, m]) => <option key={k} value={k}>{m.label}</option>)}
            </select>
          </div>
        </div>
        <div className="table">
          <div className="tr th"><span>依赖名称</span><span>版本</span><span>包内声明</span><span>人工核验</span><span>状态</span></div>
          {filtered.map(d => {
            const st = depStatus(d, p.distribution);
            return (
              <button className={d.id === p.selected ? 'tr selected' : 'tr'} key={d.id} onClick={() => p.onSelect(d.id)}>
                <span className="dep-name"><span className="pkg-dot"/> {d.name}</span>
                <span className="muted">{d.version}</span>
                <span><LicenseBadge id={d.declaredLicense}/></span>
                <span><LicenseBadge id={d.verifiedLicense}/></span>
                <span className={'status ' + STATUS_META[st].className}>
                  {st === 'clear' ? <Check size={13}/> : <AlertTriangle size={13}/>} {STATUS_META[st].label}
                </span>
              </button>
            );
          })}
          {filtered.length === 0 && <div className="empty">没有匹配的依赖</div>}
        </div>
      </div>
      {current && <Detail dep={current} records={p.records} distribution={p.distribution}
        onClose={() => p.onSelect(0)} onEdit={() => p.onEdit(current)} onToggle={() => p.onToggleObligation(current.id)}/>}
    </section>
  </>;
}

function Detail({dep, records, distribution, onClose, onEdit, onToggle}:
  {dep: Dependency; records: CheckRecord[]; distribution: Distribution; onClose: () => void; onEdit: () => void; onToggle: () => void}) {
  const mismatch = isMismatch(dep);
  const obligations = depObligations(dep, distribution);
  const mine = records.filter(r => r.depId === dep.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const factBlocked = dep.verifiedLicense == null || mismatch;

  return (
    <div className="detail">
      <div className="detail-head">
        <div className="detail-icon"><FileCode2 size={20}/></div>
        <div><span>SELECTED DEPENDENCY</span><h2>{dep.name} <small className="ver">v{dep.version}</small></h2></div>
        <button className="close" onClick={onClose}><X size={16}/></button>
      </div>

      <div className="fact-grid">
        <div className="fact">
          <label>包内声明 · {dep.declaredSource}</label>
          <LicenseBadge id={dep.declaredLicense}/>
        </div>
        <div className="fact">
          <label>人工核验{dep.verifiedSource ? ` · ${dep.verifiedSource}` : ''}</label>
          <LicenseBadge id={dep.verifiedLicense}/>
          {dep.verifiedBy && <small>{dep.verifiedBy} · {dep.verifiedAt ? fmtTime(dep.verifiedAt) : ''}</small>}
        </div>
      </div>

      {mismatch && (
        <div className="finding risk">
          <div className="finding-icon"><AlertTriangle size={16}/></div>
          <div><b>声明不一致，不能放行</b>
            <p>差异：包内声明 <b>{dep.declaredLicense}</b>（{dep.declaredSource}）≠ 人工核验 <b>{dep.verifiedLicense}</b>（{dep.verifiedSource}）。{dep.note && ` ${dep.note}。`}</p>
          </div>
        </div>
      )}
      {dep.verifiedLicense == null && (
        <div className="finding warn">
          <div className="finding-icon"><AlertTriangle size={16}/></div>
          <div><b>缺少人工核验</b><p>仅有包内声明（{dep.declaredLicense}），发布前需对照 LICENSE 文本完成核验。</p></div>
        </div>
      )}
      {!factBlocked && !mismatch && (
        <div className="finding ok">
          <div className="finding-icon"><Check size={16}/></div>
          <div><b>声明与核验一致</b><p>{dep.note || '两处来源相符'}。详细义务请参考项目仓库中的 LICENSE 文件。</p></div>
        </div>
      )}

      <div className="obl">
        <div className="obl-head"><span>分发义务 · {DISTRIBUTIONS[distribution].label}</span>
          {obligations.length > 0 && !factBlocked && (
            <label className="confirm">
              <input type="checkbox" checked={dep.obligationConfirmed} onChange={onToggle}/> 已确认履行
            </label>
          )}
        </div>
        {factBlocked
          ? <p className="obl-hint">请先完成核验并解决声明差异，再确认分发义务。</p>
          : obligations.length === 0
            ? <p className="obl-hint">当前分发方式下无附加义务。</p>
            : <ul>{obligations.map(o => <li key={o} className={dep.obligationConfirmed ? 'done' : ''}>{o}</li>)}</ul>}
      </div>

      <div className="dep-history">
        <div className="obl-head"><span><History size={13}/> 检查记录（{mine.length}）</span>
          <button className="link" onClick={onEdit}><Pencil size={13}/>核验 / 修改</button>
        </div>
        {mine.length === 0 && <p className="obl-hint">暂无记录，完成一次核验后在此留痕。</p>}
        {mine.map(r => (
          <div className="record" key={r.id}>
            <Pill className={r.mismatch ? 'risk' : 'ok'}>{r.kind === 'initial' ? '首次核验' : '复核'}</Pill>
            <div>
              <b>v{r.version} · {r.conclusion}</b>
              <small>{fmtTime(r.createdAt)} · 声明 {r.declaredLicense} / 核验 {r.verifiedLicense ?? '—'}{r.verifiedSource ? `（${r.verifiedSource}）` : ''}</small>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
