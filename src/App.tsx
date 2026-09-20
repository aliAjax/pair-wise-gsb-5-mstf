import {useEffect, useState} from 'react';
import {AlertTriangle, Download, History, Layers3, Plus, Scale, ShieldCheck, ShieldX} from 'lucide-react';
import {computeBlockers, depObligations, DISTRIBUTIONS, effectiveLicense, fmtTime, isMismatch} from './license';
import {load, save} from './storage';
import {seedDeps, seedRecords} from './data';
import type {CheckRecord, Dependency, Distribution, ReleaseRun} from './types';
import DepModal, {type DepFormValues} from './components/DepModal';
import DepsView from './views/DepsView';
import GateView from './views/GateView';
import RecordsView from './views/RecordsView';

type View = 'deps' | 'gate' | 'records';
type Modal = {mode: 'add'} | {mode: 'edit'; dep: Dependency} | null;

const USER = 'Zen Li';
const nextId = () => Date.now() + Math.floor(Math.random() * 1000);

export default function App() {
  const [view, setView] = useState<View>(() => load<View>('view', 'deps'));
  const [deps, setDeps] = useState<Dependency[]>(() => load('deps', seedDeps));
  const [records, setRecords] = useState<CheckRecord[]>(() => load('records', seedRecords));
  const [runs, setRuns] = useState<ReleaseRun[]>(() => load('runs', []));
  const [distribution, setDistribution] = useState<Distribution>(() => load('distribution', 'binary'));
  const [selected, setSelected] = useState<number>(() => load('selected', 1));
  const [modal, setModal] = useState<Modal>(null);

  useEffect(() => save('view', view), [view]);
  useEffect(() => save('deps', deps), [deps]);
  useEffect(() => save('records', records), [records]);
  useEffect(() => save('runs', runs), [runs]);
  useEffect(() => save('distribution', distribution), [distribution]);
  useEffect(() => save('selected', selected), [selected]);

  const blockers = computeBlockers(deps, distribution);
  const lastRun = runs[0] ?? null;

  const addRecord = (dep: Dependency, kind: CheckRecord['kind']) => {
    const mismatch = isMismatch(dep);
    const rec: CheckRecord = {
      id: nextId(), depId: dep.id, depName: dep.name, version: dep.version, kind,
      declaredLicense: dep.declaredLicense, verifiedLicense: dep.verifiedLicense,
      verifiedSource: dep.verifiedSource, mismatch,
      conclusion: mismatch
        ? `不一致：包内声明 ${dep.declaredLicense}，核验为 ${dep.verifiedLicense}`
        : `一致：${dep.verifiedLicense}`,
      createdAt: new Date().toISOString(),
    };
    setRecords(rs => [...rs, rec]);
  };

  const saveDep = (v: DepFormValues) => {
    const now = new Date().toISOString();
    if (modal?.mode === 'edit') {
      const prev = modal.dep;
      const factsChanged = prev.version !== v.version || prev.declaredLicense !== v.declaredLicense ||
        prev.declaredSource !== v.declaredSource || prev.verifiedLicense !== v.verifiedLicense ||
        prev.verifiedSource !== v.verifiedSource;
      const verifiedChanged = prev.verifiedLicense !== v.verifiedLicense || prev.verifiedSource !== v.verifiedSource;
      const licenseChanged = effectiveLicense(prev) !== (v.verifiedLicense ?? v.declaredLicense);
      const next: Dependency = {
        ...prev, ...v,
        verifiedBy: v.verifiedLicense == null ? null : (verifiedChanged || !prev.verifiedBy ? USER : prev.verifiedBy),
        verifiedAt: v.verifiedLicense == null ? null : (verifiedChanged || !prev.verifiedAt ? now : prev.verifiedAt),
        obligationConfirmed: licenseChanged ? false : prev.obligationConfirmed,
      };
      setDeps(ds => ds.map(d => (d.id === prev.id ? next : d)));
      // 已核对依赖再次修改 → 生成新的检查记录，旧记录保留可查
      if (v.verifiedLicense != null && factsChanged) {
        addRecord(next, prev.verifiedLicense != null ? 'recheck' : 'initial');
      }
    } else {
      const dep: Dependency = {
        id: nextId(), ...v,
        verifiedBy: v.verifiedLicense ? USER : null,
        verifiedAt: v.verifiedLicense ? now : null,
        obligationConfirmed: false,
      };
      setDeps(ds => [...ds, dep]);
      if (v.verifiedLicense != null) addRecord(dep, 'initial');
      setSelected(dep.id);
    }
    setModal(null);
  };

  const toggleObligation = (id: number) =>
    setDeps(ds => ds.map(d => (d.id === id ? {...d, obligationConfirmed: !d.obligationConfirmed} : d)));

  // 发布检查只追加一条检查记录，绝不清空依赖清单与当前选中项
  const runCheck = () => {
    const bl = computeBlockers(deps, distribution);
    const run: ReleaseRun = {
      id: nextId(), distribution, ranAt: new Date().toISOString(),
      result: bl.length ? 'blocked' : 'passed', blockers: bl,
      conditionalTotal: deps.filter(d => depObligations(d, distribution).length > 0).length,
    };
    setRuns(rs => [run, ...rs]);
    setView('gate');
  };

  const openDep = (id: number) => { setSelected(id); setView('deps'); };

  const exportMd = () => {
    const lines = [
      '# License Lens 发布门禁报告', '',
      `- 分发方式：${DISTRIBUTIONS[distribution].label}`,
      `- 依赖总数：${deps.length}`,
      `- 当前阻断：${blockers.length} 项`,
      lastRun ? `- 上次检查：${fmtTime(lastRun.ranAt)}（${lastRun.result === 'passed' ? '放行' : '阻止'}）` : '- 尚未运行发布检查',
      '', '## 依赖事实核对', '',
      '| 依赖 | 版本 | 包内声明 | 人工核验 | 义务确认 | 结论 |', '|---|---|---|---|---|---|',
      ...deps.map(d => `| ${d.name} | ${d.version} | ${d.declaredLicense}（${d.declaredSource}） | ${d.verifiedLicense ? `${d.verifiedLicense}（${d.verifiedSource}）` : '未核验'} | ${d.obligationConfirmed ? '已确认' : '未确认'} | ${d.verifiedLicense == null ? '缺少核验' : isMismatch(d) ? '声明不一致' : '一致'} |`),
      '', '## 阻断原因', '',
      ...(blockers.length ? blockers.map(b => `- **${b.depName}@${b.version}**：${b.detail}`) : ['- 无']),
    ];
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([lines.join('\n')], {type: 'text/markdown'}));
    a.download = 'license-gate-report.md';
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="shell">
      <aside>
        <div className="brand"><div className="brand-icon"><ShieldCheck size={18}/></div><div><b>License Lens</b><small>fact-check &amp; release gate</small></div></div>
        <div className="nav-title">WORKSPACE</div>
        <button className={view === 'deps' ? 'nav active' : 'nav'} onClick={() => setView('deps')}><Layers3 size={16}/>依赖总览 <span>{deps.length}</span></button>
        <button className={view === 'gate' ? 'nav active' : 'nav'} onClick={() => setView('gate')}><Scale size={16}/>发布门禁 <span className={blockers.length ? 'red' : ''}>{blockers.length}</span></button>
        <button className={view === 'records' ? 'nav active' : 'nav'} onClick={() => setView('records')}><History size={16}/>检查记录 <span>{records.length}</span></button>
        <div className="aside-bottom">
          <div className="mini-card">
            {lastRun ? (lastRun.result === 'passed' ? <ShieldCheck size={16}/> : <ShieldX size={16}/>) : <AlertTriangle size={16}/>}
            <div><b>{lastRun ? (lastRun.result === 'passed' ? '上次检查：放行' : '上次检查：阻止') : '尚未运行发布检查'}</b>
              <small>{lastRun ? fmtTime(lastRun.ranAt) : '发布前请先运行门禁检查'}</small></div>
          </div>
          <div className="user"><div className="avatar">ZL</div><span>{USER}</span></div>
        </div>
      </aside>

      <main>
        <header>
          <div>
            <div className="crumb">WORKSPACE / <b>LICENSE FACT-CHECK &amp; GATE</b></div>
            <h1>许可证事实核对与发布门禁</h1>
            <p>包内声明与人工核验不一致、或义务未确认时，发布一律阻止。</p>
          </div>
          <div className="head-actions">
            <select className="dist-select" value={distribution} onChange={e => setDistribution(e.target.value as Distribution)} title="当前分发方式">
              {Object.entries(DISTRIBUTIONS).map(([k, d]) => <option key={k} value={k}>{d.label}</option>)}
            </select>
            <button className="outline" onClick={exportMd}><Download size={15}/>导出报告</button>
            <button className="primary" onClick={() => setModal({mode: 'add'})}><Plus size={16}/>添加依赖</button>
          </div>
        </header>

        {view === 'deps' && (
          <DepsView deps={deps} records={records} distribution={distribution} blockers={blockers} lastRun={lastRun}
            selected={selected} onSelect={setSelected} onEdit={dep => setModal({mode: 'edit', dep})}
            onToggleObligation={toggleObligation} onGoGate={() => setView('gate')}/>
        )}
        {view === 'gate' && (
          <GateView deps={deps} distribution={distribution} onDistribution={setDistribution}
            blockers={blockers} runs={runs} onRun={runCheck} onOpenDep={openDep}/>
        )}
        {view === 'records' && <RecordsView records={records}/>}
      </main>

      {modal && (
        <DepModal
          title={modal.mode === 'add' ? '添加依赖' : `核验 / 修改 · ${modal.dep.name}`}
          initial={modal.mode === 'edit' ? modal.dep : undefined}
          onSubmit={saveDep} onClose={() => setModal(null)}/>
      )}
    </div>
  );
}
