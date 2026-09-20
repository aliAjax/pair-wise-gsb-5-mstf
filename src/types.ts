export type Distribution = 'binary' | 'saas' | 'internal';

export interface Dependency {
  id: number;
  name: string;
  version: string;
  /** 包内声明的许可证（来自 package 元数据） */
  declaredLicense: string;
  declaredSource: string;
  /** 人工核验结论；null 表示尚未核验 */
  verifiedLicense: string | null;
  verifiedSource: string | null;
  verifiedBy: string | null;
  verifiedAt: string | null;
  /** 当前分发方式下的义务是否已确认履行 */
  obligationConfirmed: boolean;
  note: string;
}

export type BlockerReason = 'mismatch' | 'unverified' | 'obligation';

export interface Blocker {
  depId: number;
  depName: string;
  version: string;
  reason: BlockerReason;
  detail: string;
}

export interface CheckRecord {
  id: number;
  depId: number;
  depName: string;
  version: string;
  kind: 'initial' | 'recheck';
  declaredLicense: string;
  verifiedLicense: string | null;
  verifiedSource: string | null;
  mismatch: boolean;
  conclusion: string;
  createdAt: string;
}

export interface ReleaseRun {
  id: number;
  distribution: Distribution;
  ranAt: string;
  result: 'blocked' | 'passed';
  blockers: Blocker[];
  /** 本次检查汇总到的附条件依赖数量 */
  conditionalTotal: number;
}
