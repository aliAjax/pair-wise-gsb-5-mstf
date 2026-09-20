import {useState} from 'react';
import {AlertTriangle, Check, ChevronDown, Play, ShieldCheck, ShieldX} from 'lucide-react';
import {BLOCKER_META, depObligations, DISTRIBUTIONS, effectiveLicense, fmtTime} from '../license';
import type {Blocker, Dependency, Distribution, ReleaseRun} from '../types';
import {LicenseBadge, Pill} from '../components/badges';

interface Props {
  deps: Dependency[];
  distribution: Distribution;
  onDistribution: (d: Distribution) => void;
  blockers: Blocker[];
  runs: ReleaseRun[];
  onRun: () => void;
  onOpenDep: (id: number) => void;
}

export default function GateView(p: Props) {
  const [openRun, setOpenRun] = useState<number | null>(null);
  const conditional = p.deps.filter(d => depObligations(d, p.distribution).length > 0);
  const lastRun = p.runs[0] ?? null;

  return <>
    <section className="gate-grid">
      <div className="panel">
        <div className="pane-head"><div><h2>当前分发方式</h2><p>附条件义务随分发方式变化</p></div></div>
        <div className="dist-cards">
          {(Object.entries(DISTRIBUTIONS) as [Distribution, {label: string; desc: string}][]).map(([key, d]) => (
            <button key={key} className={'dist-card' + (p.distribution === key ? ' active' : '')} onClick={() => p.onDistribution(key)}>
              <b>{d.label}</b><small>{d.desc}</small>
            </button>
          ))}
        </div>

        <div className="pane-head sub"><div><h2>附条件依赖汇总</h2><p>{DISTRIBUTIONS[p.distribution].label}下共 {conditional.length} 个依赖附带义务</p></div></div>
        {conditional.length === 0 && <p className="obl-hint pad">当前分发方式下没有附条件依赖。</p>}
        {conditional.map(d => (
          <div className="cond-row" key={d.id}>
            <button className="cond-name" onClick={() => p.onOpenDep(d.id)}>{d.name} <small>v{d.version}</small></button>
            <LicenseBadge id={effectiveLicense(d)}/>
            <div className="cond-obs">{depObligations(d, p.distribution).map(o => <span key={o}>{o}</span>)}</div>
            {d.obligationConfirmed
              ? <Pill className="ok"><Check size={12}/> 已确认</Pill>
              : <Pill className="warn"><AlertTriangle size={12}/> 待确认</Pill>}
          </div>
        ))}
      </div>

      <div className="panel">
        <div className="pane-head">
          <div><h2>发布检查</h2><p>不一致、未核验或义务未确认都会阻止发布</p></div>
          <button className="primary" onClick={p.onRun}><Play size={15}/>运行发布检查</button>
        </div>

        {lastRun && (
          <div className={'gate-result ' + lastRun.result}>
            {lastRun.result === 'passed' ? <ShieldCheck size={22}/> : <ShieldX size={22}/>}
            <div>
              <b>{lastRun.result === 'passed' ? '允许发布' : '阻止发布'}</b>
              <small>{fmtTime(lastRun.ranAt)} · {DISTRIBUTIONS[lastRun.distribution].label} · 附条件依赖 {lastRun.conditionalTotal} 个 · 阻断 {lastRun.blockers.length} 项</small>
            </div>
          </div>
        )}
        {!lastRun && <p className="obl-hint pad">尚未运行发布检查。检查结果会留档，且不会改动依赖清单与当前选中项。</p>}

        <div className="pane-head sub"><div><h2>当前阻断原因</h2><p>{p.blockers.length === 0 ? '无阻断，可放行' : `${p.blockers.length} 项阻断`}</p></div></div>
        {p.blockers.map((b, i) => (
          <button className="blocker" key={b.depId + b.reason + i} onClick={() => p.onOpenDep(b.depId)}>
            <Pill className={BLOCKER_META[b.reason].className}>{BLOCKER_META[b.reason].label}</Pill>
            <div><b>{b.depName} <small>v{b.version}</small></b><small>{b.detail}</small></div>
          </button>
        ))}
        {p.blockers.length === 0 && <p className="obl-hint pad">所有依赖声明一致、义务已确认。</p>}
      </div>
    </section>

    <section className="panel runs">
      <div className="pane-head"><div><h2>检查历史</h2><p>每次发布检查的结果与阻断快照，旧结论持续可查</p></div></div>
      {p.runs.length === 0 && <p className="obl-hint pad">暂无检查记录。</p>}
      {p.runs.map(r => (
        <div className="run" key={r.id}>
          <button className="run-head" onClick={() => setOpenRun(openRun === r.id ? null : r.id)}>
            <Pill className={r.result === 'passed' ? 'ok' : 'risk'}>{r.result === 'passed' ? '放行' : '阻止'}</Pill>
            <b>{fmtTime(r.ranAt)}</b>
            <small>{DISTRIBUTIONS[r.distribution].label} · 附条件 {r.conditionalTotal} · 阻断 {r.blockers.length}</small>
            <ChevronDown size={14} className={openRun === r.id ? 'flip' : ''}/>
          </button>
          {openRun === r.id && (
            <div className="run-body">
              {r.blockers.length === 0 && <p className="obl-hint">本次检查无阻断项。</p>}
              {r.blockers.map((b, i) => (
                <div className="blocker static" key={b.depId + b.reason + i}>
                  <Pill className={BLOCKER_META[b.reason].className}>{BLOCKER_META[b.reason].label}</Pill>
                  <div><b>{b.depName} <small>v{b.version}</small></b><small>{b.detail}</small></div>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </section>
  </>;
}
