import type {Blocker, Dependency, Distribution} from './types';

export const DISTRIBUTIONS: Record<Distribution, {label: string; desc: string}> = {
  binary: {label: '闭源二进制分发', desc: '软件以二进制/安装包形式交付第三方'},
  saas: {label: 'SaaS / 网络服务', desc: '仅通过网络提供服务，不交付副本'},
  internal: {label: '内部使用', desc: '仅在组织内部运行，不对外分发'},
};

interface LicenseInfo {
  color: string;
  /** 各分发方式下需要履行的义务；无条目表示该方式下无附加义务 */
  obligations: Partial<Record<Distribution, string[]>>;
}

export const LICENSES: Record<string, LicenseInfo> = {
  MIT: {color: '#35b995', obligations: {binary: ['保留版权与许可声明']}},
  'BSD-3-Clause': {color: '#6d9ee8', obligations: {binary: ['再分发时保留版权声明', '不得使用作者姓名背书']}},
  'Apache-2.0': {color: '#b18ee4', obligations: {binary: ['保留版权与许可声明', '保留 NOTICE 文件', '声明修改之处']}},
  'MPL-2.0': {color: '#7fb3d5', obligations: {binary: ['MPL 覆盖的文件公开源码', '保留版权与许可声明']}},
  'LGPL-3.0': {color: '#e8a06d', obligations: {binary: ['允许用户替换库（动态链接或提供目标文件）', '保留版权与许可声明']}},
  'GPL-3.0': {color: '#ec8c75', obligations: {binary: ['公开对应源代码', '衍生作品以 GPL-3.0 授权', '保留版权与许可声明']}},
  'AGPL-3.0': {color: '#d97762', obligations: {binary: ['公开对应源代码', '衍生作品以 AGPL-3.0 授权'], saas: ['向网络用户提供对应源代码']}},
};

export const LICENSE_IDS = Object.keys(LICENSES);

export const licenseColor = (id: string | null) => (id && LICENSES[id]?.color) || '#8d9ca1';

const normalize = (s: string) => s.trim().toLowerCase();

/** 包内声明与人工核验是否不一致 */
export const isMismatch = (d: Dependency) =>
  d.verifiedLicense != null && normalize(d.verifiedLicense) !== normalize(d.declaredLicense);

/** 用于义务判断的有效许可证：人工核验优先，未核验时退回包内声明 */
export const effectiveLicense = (d: Dependency) => d.verifiedLicense ?? d.declaredLicense;

export function obligationsFor(license: string, dist: Distribution): string[] {
  const info = LICENSES[license];
  if (!info) return dist === 'binary' ? ['许可证未收录，需人工确认分发义务'] : [];
  return info.obligations[dist] ?? [];
}

/** 该依赖在当前分发方式下需要履行的义务 */
export const depObligations = (d: Dependency, dist: Distribution) =>
  obligationsFor(effectiveLicense(d), dist);

export type DepStatus = 'clear' | 'pending' | 'mismatch' | 'unverified';

export const STATUS_META: Record<DepStatus, {label: string; className: string}> = {
  clear: {label: '核验一致', className: 'ok'},
  pending: {label: '待确认义务', className: 'warn'},
  mismatch: {label: '声明不一致', className: 'risk'},
  unverified: {label: '未核验', className: 'muted'},
};

export function depStatus(d: Dependency, dist: Distribution): DepStatus {
  if (d.verifiedLicense == null) return 'unverified';
  if (isMismatch(d)) return 'mismatch';
  if (depObligations(d, dist).length > 0 && !d.obligationConfirmed) return 'pending';
  return 'clear';
}

/**
 * 发布门禁：汇总当前分发方式下的全部阻断原因。
 * 声明不一致或许可证未收录时，义务判断不可靠，不再重复计义务阻断。
 */
export function computeBlockers(deps: Dependency[], dist: Distribution): Blocker[] {
  const blockers: Blocker[] = [];
  for (const d of deps) {
    if (d.verifiedLicense == null) {
      blockers.push({
        depId: d.id, depName: d.name, version: d.version, reason: 'unverified',
        detail: `缺少人工核验（包内声明 ${d.declaredLicense}，来源：${d.declaredSource}）`,
      });
      continue;
    }
    if (isMismatch(d)) {
      blockers.push({
        depId: d.id, depName: d.name, version: d.version, reason: 'mismatch',
        detail: `包内声明 ${d.declaredLicense}（${d.declaredSource}）≠ 人工核验 ${d.verifiedLicense}（${d.verifiedSource}）`,
      });
      continue;
    }
    const obs = depObligations(d, dist);
    if (obs.length > 0 && !d.obligationConfirmed) {
      blockers.push({
        depId: d.id, depName: d.name, version: d.version, reason: 'obligation',
        detail: `缺少义务确认：${obs.join('；')}`,
      });
    }
  }
  return blockers;
}

export const BLOCKER_META: Record<Blocker['reason'], {label: string; className: string}> = {
  mismatch: {label: '声明不一致', className: 'risk'},
  unverified: {label: '未核验', className: 'muted'},
  obligation: {label: '义务未确认', className: 'warn'},
};

export const fmtTime = (iso: string) =>
  new Date(iso).toLocaleString('zh-CN', {year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'});
