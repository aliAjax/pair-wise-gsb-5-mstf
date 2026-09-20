import {useMemo, useState} from 'react';
import {Search} from 'lucide-react';
import {fmtTime} from '../license';
import type {CheckRecord} from '../types';
import {Pill} from '../components/badges';

export default function RecordsView({records}: {records: CheckRecord[]}) {
  const [query, setQuery] = useState('');
  const sorted = useMemo(
    () => [...records]
      .filter(r => `${r.depName}${r.conclusion}`.toLowerCase().includes(query.toLowerCase()))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [records, query]);

  return (
    <section className="panel">
      <div className="pane-head">
        <div><h2>检查记录</h2><p>每次核验与修改都会生成新记录，旧结论不会被覆盖</p></div>
        <div className="tools">
          <div className="search"><Search size={15}/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="搜索依赖或结论"/></div>
        </div>
      </div>
      <div className="table records-table">
        <div className="tr th"><span>时间</span><span>依赖</span><span>类型</span><span>包内声明</span><span>人工核验</span><span>结论</span></div>
        {sorted.map(r => (
          <div className="tr" key={r.id}>
            <span className="muted">{fmtTime(r.createdAt)}</span>
            <span className="dep-name">{r.depName} <small className="muted">v{r.version}</small></span>
            <span><Pill className={r.kind === 'initial' ? 'muted' : 'warn'}>{r.kind === 'initial' ? '首次核验' : '复核'}</Pill></span>
            <span>{r.declaredLicense}</span>
            <span>{r.verifiedLicense ?? '—'}{r.verifiedSource ? <small className="muted">（{r.verifiedSource}）</small> : null}</span>
            <span><Pill className={r.mismatch ? 'risk' : 'ok'}>{r.conclusion}</Pill></span>
          </div>
        ))}
        {sorted.length === 0 && <div className="empty">没有匹配的检查记录</div>}
      </div>
    </section>
  );
}
