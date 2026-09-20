// 许可证事实核对 + 发布门禁数据模型
// 所有状态以「事实」为准：包内声明（declared）与人工核验（verified）分开记录。

export type FactResult = 'match' | 'mismatch';

/** 一次人工核验记录。再次修改会产生新记录，旧记录保留在 history 中继续可查。 */
export interface CheckRecord {
  id: string;
  at: number;
  // 核验时的包内声明快照
  declaredVersion: string;
  declaredLicense: string;
  // 人工核验事实
  verifiedLicense: string;
  verifiedSource: string; // 核验渠道：npm registry / 随包 LICENSE / 官网 …
  sourceRef: string; // 具体引用：URL、包内文件路径等
  reviewer: string;
  note?: string;
  result: FactResult;
  /** result === 'mismatch' 时的差异说明 */
  diff?: string;
}

export interface Obligation {
  id: string;
  label: string;
}

export interface Dep {
  id: string;
  name: string;
  version: string;
  source: string; // 包来源：npm / 手动
  declaredLicense: string; // 包内声明的许可证
  addedAt: number;
  /** 全部核验记录，索引 0 为最新结论 */
  history: CheckRecord[];
  /** 义务确认：key = `${verifiedLicense}|${mode}|${obligationId}` */
  confirmations: Record<string, boolean>;
}

export type ModeId = 'bundle' | 'public-binary' | 'internal';

export interface ModeDef {
  id: ModeId;
  label: string;
  hint: string;
  public: boolean; // 是否对外分发（对外才产生附条件义务与著佐权兼容性判定）
}

export const MODES: ModeDef[] = [
  { id: 'bundle', label: '打包分发', hint: '依赖随产品同库打包对外发布', public: true },
  { id: 'public-binary', label: '公开发布', hint: '以二进制 / 制品形式对外分发', public: true },
  { id: 'internal', label: '仅内部使用', hint: '不对外分发，无附条件分发义务', public: false },
];

export interface LicenseMeta {
  label: string;
  color: string;
  copyleft?: 'strong' | 'weak';
  unknown?: boolean;
  obligations: Obligation[];
}

const O_NOTICE: Obligation = { id: 'notice', label: '分发时保留版权与许可声明' };
const O_ENDORSE: Obligation = { id: 'non-endorsement', label: '不得使用原贡献者名义为产品背书' };
const O_NOTICE_FILE: Obligation = { id: 'notice-file', label: '随分发提供 NOTICE 文件' };
const O_CHANGES: Obligation = { id: 'state-changes', label: '修改过的文件需标注变更声明' };
const O_SOURCE_OFFER: Obligation = { id: 'source-offer', label: '向接收者提供对应源代码（弱著佐权）' };

export const LICENSE_META: Record<string, LicenseMeta> = {
  MIT: { label: 'MIT', color: '#35b995', obligations: [O_NOTICE] },
  ISC: { label: 'ISC', color: '#35b995', obligations: [O_NOTICE] },
  'BSD-2-Clause': { label: 'BSD-2-Clause', color: '#6d9ee8', obligations: [O_NOTICE, O_ENDORSE] },
  'BSD-3-Clause': { label: 'BSD-3-Clause', color: '#6d9ee8', obligations: [O_NOTICE, O_ENDORSE] },
  'Apache-2.0': {
    label: 'Apache-2.0', color: '#b18ee4',
    obligations: [O_NOTICE, O_NOTICE_FILE, O_CHANGES],
  },
  'MPL-2.0': {
    label: 'MPL-2.0', color: '#e0a94e', copyleft: 'weak',
    obligations: [O_NOTICE, O_SOURCE_OFFER],
  },
  'LGPL-2.1-or-later': {
    label: 'LGPL-2.1-or-later', color: '#e08e4e', copyleft: 'weak',
    obligations: [O_NOTICE, O_SOURCE_OFFER],
  },
  'LGPL-3.0-or-later': {
    label: 'LGPL-3.0-or-later', color: '#e08e4e', copyleft: 'weak',
    obligations: [O_NOTICE, O_SOURCE_OFFER],
  },
  'GPL-2.0': { label: 'GPL-2.0', color: '#ec8c75', copyleft: 'strong', obligations: [O_NOTICE] },
  'GPL-3.0': { label: 'GPL-3.0', color: '#ec8c75', copyleft: 'strong', obligations: [O_NOTICE] },
  'AGPL-3.0': { label: 'AGPL-3.0', color: '#d96b8e', copyleft: 'strong', obligations: [O_NOTICE] },
  UNKNOWN: { label: '未知（包内未声明）', color: '#9aa6ab', unknown: true, obligations: [] },
};

export const LICENSE_CHOICES = Object.keys(LICENSE_META);

export function licenseColor(id: string): string {
  return LICENSE_META[id]?.color ?? '#9aa6ab';
}
export function licenseLabel(id: string): string {
  return LICENSE_META[id]?.label ?? id;
}

// ---- 核对事实 ----

export type FactKind = 'match' | 'mismatch' | 'unverified';

export function factOf(dep: Dep): { kind: FactKind; record?: CheckRecord } {
  const record = dep.history[0];
  if (!record) return { kind: 'unverified' };
  return { kind: record.result, record };
}

export function confirmationKey(license: string, mode: ModeId, obId: string): string {
  return `${license}|${mode}|${obId}`;
}

// ---- 发布门禁 ----

export type IssueGroup = 'fact' | 'unknown' | 'compatible' | 'obligation';

export interface GateIssue {
  depId: string;
  depName: string;
  group: IssueGroup;
  title: string;
  detail: string;
}

export interface ConditionalRow {
  depId: string;
  name: string;
  version: string;
  license: string;
  obligations: { id: string; label: string; confirmed: boolean }[];
}

export interface GateResult {
  mode: ModeId;
  at: number;
  revision: number;
  pass: boolean;
  issues: GateIssue[];
  rows: ConditionalRow[];
  releasedAt?: number;
}

/**
 * 按当前分发方式评估门禁：
 * - 未核验、声明与核验不一致：事实层硬阻断（与分发方式无关）
 * - 许可证未知：要求人工法律复核，阻断
 * - 对外分发：强著佐权（及打包模式下弱著佐权）不兼容，阻断
 * - 对外分发：附条件义务逐项确认，缺失即阻断；内部使用无此要求
 */
export function evaluateGate(deps: Dep[], mode: ModeId, revision: number, at: number): GateResult {
  const def = MODES.find((m) => m.id === mode)!;
  const issues: GateIssue[] = [];
  const rows: ConditionalRow[] = [];

  for (const dep of deps) {
    const { kind, record } = factOf(dep);
    if (kind === 'unverified') {
      issues.push({
        depId: dep.id, depName: dep.name, group: 'fact',
        title: `${dep.name}@${dep.version} 尚未人工核验`,
        detail: '只有包内声明、缺少人工核验来源，不能放行。',
      });
      continue;
    }
    if (kind === 'mismatch') {
      issues.push({
        depId: dep.id, depName: dep.name, group: 'fact',
        title: `${dep.name}@${dep.version} 包内声明与人工核验不一致`,
        detail: record!.diff || `声明 ${record!.declaredLicense}，核验为 ${record!.verifiedLicense}`,
      });
      continue;
    }

    const meta = LICENSE_META[record!.verifiedLicense];
    if (!meta || meta.unknown) {
      issues.push({
        depId: dep.id, depName: dep.name, group: 'unknown',
        title: `${dep.name}@${dep.version} 许可证无法识别`,
        detail: `核验结论为「${record!.verifiedLicense}」，需人工法律复核后才能放行。`,
      });
      continue;
    }

    if (def.public) {
      if (meta.copyleft === 'strong') {
        issues.push({
          depId: dep.id, depName: dep.name, group: 'compatible',
          title: `${dep.name}@${dep.version} 使用强著佐权许可证 ${meta.label}`,
          detail: `${def.label}场景下与闭源 / 专有分发不兼容，需替换或改为内部使用。`,
        });
      } else if (meta.copyleft === 'weak' && mode === 'bundle') {
        issues.push({
          depId: dep.id, depName: dep.name, group: 'compatible',
          title: `${dep.name}@${dep.version} 弱著佐权（${meta.label}）不适合打包分发`,
          detail: '同库打包会触发源代码开放义务，建议动态隔离或替换。',
        });
      }

      const obligations = meta.obligations.map((o) => ({
        ...o,
        confirmed: !!dep.confirmations[confirmationKey(record!.verifiedLicense, mode, o.id)],
      }));
      if (obligations.length) {
        rows.push({
          depId: dep.id, name: dep.name, version: record!.declaredVersion,
          license: record!.verifiedLicense, obligations,
        });
        const missing = obligations.filter((o) => !o.confirmed);
        if (missing.length) {
          issues.push({
            depId: dep.id, depName: dep.name, group: 'obligation',
            title: `${dep.name}@${record!.declaredVersion} 有 ${missing.length} 项分发义务未确认`,
            detail: `待确认：${missing.map((o) => o.label).join('；')}`,
          });
        }
      }
    }
  }

  return { mode, at, revision, pass: issues.length === 0, issues, rows };
}

// ---- 初始清单（原 License Lens 清单，补齐事实来源与核验记录） ----

const DAY = 86_400_000;

export function seedDeps(now: number): Dep[] {
  const mk = (
    id: string, name: string, version: string, source: string,
    declaredLicense: string, daysAgo: number,
    verifiedLicense: string, verifiedSource: string, sourceRef: string,
    note?: string,
  ): Dep => {
    const result: FactResult = declaredLicense === verifiedLicense ? 'match' : 'mismatch';
    return {
      id, name, version, source, declaredLicense, addedAt: now - (daysAgo + 2) * DAY,
      confirmations: {},
      history: [{
        id: `chk-seed-${id}`, at: now - daysAgo * DAY,
        declaredVersion: version, declaredLicense,
        verifiedLicense, verifiedSource, sourceRef, reviewer: 'Zen Li', note,
        result,
        diff: result === 'mismatch'
          ? `包内 ${source === '手动' ? '元数据' : 'package.json'} 声明 ${declaredLicense}；${verifiedSource}（${sourceRef}）实际为 ${verifiedLicense}`
          : undefined,
      }],
    };
  };
  return [
    mk('dep-1', 'react', '18.3.1', 'npm', 'MIT', 12, 'MIT',
      'npm registry 包元数据与 LICENSE',
      'https://www.npmjs.com/package/react/v/18.3.1?activeTab=code'),
    mk('dep-2', 'lodash', '4.17.21', 'npm', 'MIT', 12, 'MIT',
      'npm registry 包元数据与 LICENSE',
      'https://www.npmjs.com/package/lodash/v/4.17.21?activeTab=code'),
    mk('dep-3', 'chart.js', '4.4.4', 'npm', 'MIT', 9, 'MIT',
      'npm registry 包元数据与 LICENSE',
      'https://www.npmjs.com/package/chart.js/v/4.4.4?activeTab=code'),
    mk('dep-4', 'highlight.js', '11.10.0', 'npm', 'BSD-3-Clause', 6, 'BSD-3-Clause',
      '随包 LICENSE 文件',
      'node_modules/highlight.js/LICENSE',
      '再发布需保留版权声明与禁用背书条款'),
    mk('dep-5', 'legacy-parser', '2.1.0', '手动', 'GPL-3.0', 3, 'LGPL-2.1-or-later',
      '重新解包 vendor 制品核对 LICENSE',
      'vendor/legacy-parser-2.1.0/LICENSE',
      '包内元数据与实际 LICENSE 不一致，已挂起等待处置'),
  ];
}

export function newId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export function formatTime(at: number): string {
  return new Date(at).toLocaleString('zh-CN', { hour12: false });
}
