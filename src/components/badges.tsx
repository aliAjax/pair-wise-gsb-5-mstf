import type {ReactNode} from 'react';
import {licenseColor} from '../license';

export function LicenseBadge({id}: {id: string | null}) {
  if (id == null) return <i className="license" style={{color: '#8d9ca1', background: '#8d9ca118'}}>未核验</i>;
  const c = licenseColor(id);
  return <i className="license" style={{color: c, background: c + '18'}}>{id}</i>;
}

export function Pill({className, children}: {className: string; children: ReactNode}) {
  return <span className={'pill ' + className}>{children}</span>;
}
