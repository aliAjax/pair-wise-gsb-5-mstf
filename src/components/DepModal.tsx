import {useState} from 'react';
import {LICENSE_IDS} from '../license';
import type {Dependency} from '../types';

export interface DepFormValues {
  name: string;
  version: string;
  declaredLicense: string;
  declaredSource: string;
  verifiedLicense: string | null;
  verifiedSource: string | null;
  note: string;
}

interface Props {
  title: string;
  initial?: Dependency;
  onSubmit: (values: DepFormValues) => void;
  onClose: () => void;
}

const UNVERIFIED = '__none__';

export default function DepModal({title, initial, onSubmit, onClose}: Props) {
  const [name, setName] = useState(initial?.name ?? '');
  const [version, setVersion] = useState(initial?.version ?? '1.0.0');
  const [declaredLicense, setDeclaredLicense] = useState(initial?.declaredLicense ?? 'MIT');
  const [declaredSource, setDeclaredSource] = useState(initial?.declaredSource ?? 'package.json');
  const [verifiedLicense, setVerifiedLicense] = useState(initial?.verifiedLicense ?? UNVERIFIED);
  const [verifiedSource, setVerifiedSource] = useState(initial?.verifiedSource ?? 'LICENSE 文件');
  const [note, setNote] = useState(initial?.note ?? '');

  const submit = () => {
    if (!name.trim() || !version.trim() || !declaredLicense.trim()) return;
    onSubmit({
      name: name.trim(),
      version: version.trim(),
      declaredLicense: declaredLicense.trim(),
      declaredSource: declaredSource.trim() || 'package.json',
      verifiedLicense: verifiedLicense === UNVERIFIED ? null : verifiedLicense.trim(),
      verifiedSource: verifiedLicense === UNVERIFIED ? null : verifiedSource.trim() || '人工核验',
      note: note.trim(),
    });
  };

  return (
    <div className="backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-head"><h2>{title}</h2><button onClick={onClose}>×</button></div>
        <div className="modal-2col">
          <label>依赖名称
            <input autoFocus value={name} onChange={e => setName(e.target.value)} placeholder="例如 date-fns"/>
          </label>
          <label>版本
            <input value={version} onChange={e => setVersion(e.target.value)} placeholder="例如 3.2.1"/>
          </label>
        </div>
        <fieldset>
          <legend>包内声明（机器读取）</legend>
          <div className="modal-2col">
            <label>声明许可证
              <input list="license-ids" value={declaredLicense} onChange={e => setDeclaredLicense(e.target.value)}/>
            </label>
            <label>声明来源
              <input value={declaredSource} onChange={e => setDeclaredSource(e.target.value)} placeholder="package.json"/>
            </label>
          </div>
        </fieldset>
        <fieldset>
          <legend>人工核验（事实核对）</legend>
          <div className="modal-2col">
            <label>核验结论
              <select value={verifiedLicense} onChange={e => setVerifiedLicense(e.target.value)}>
                <option value={UNVERIFIED}>未核验</option>
                {LICENSE_IDS.map(id => <option key={id} value={id}>{id}</option>)}
              </select>
            </label>
            <label>核验来源
              <input value={verifiedSource} onChange={e => setVerifiedSource(e.target.value)} disabled={verifiedLicense === UNVERIFIED} placeholder="LICENSE 文件 / 上游仓库"/>
            </label>
          </div>
        </fieldset>
        <label>备注
          <input value={note} onChange={e => setNote(e.target.value)} placeholder="核对过程、差异说明等"/>
        </label>
        <datalist id="license-ids">{LICENSE_IDS.map(id => <option key={id} value={id}/>)}</datalist>
        <button className="primary full" onClick={submit}>{initial ? '保存并生成检查记录' : '加入清单'}</button>
      </div>
    </div>
  );
}
