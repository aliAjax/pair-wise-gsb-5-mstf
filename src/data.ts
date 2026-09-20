import type {CheckRecord, Dependency} from './types';

export const seedDeps: Dependency[] = [
  {id: 1, name: 'react', version: '18.3.1', declaredLicense: 'MIT', declaredSource: 'package.json', verifiedLicense: 'MIT', verifiedSource: 'LICENSE 文件', verifiedBy: 'Zen Li', verifiedAt: '2026-09-18T09:20:00', obligationConfirmed: true, note: '宽松许可，可商用'},
  {id: 2, name: 'lodash', version: '4.17.21', declaredLicense: 'MIT', declaredSource: 'package.json', verifiedLicense: 'MIT', verifiedSource: 'LICENSE 文件', verifiedBy: 'Zen Li', verifiedAt: '2026-09-18T09:22:00', obligationConfirmed: true, note: '宽松许可，可商用'},
  {id: 3, name: 'chart.js', version: '4.4.4', declaredLicense: 'MIT', declaredSource: 'package.json', verifiedLicense: 'MIT', verifiedSource: '上游仓库', verifiedBy: 'Zen Li', verifiedAt: '2026-09-18T09:25:00', obligationConfirmed: true, note: '宽松许可，可商用'},
  {id: 4, name: 'highlight.js', version: '11.10.0', declaredLicense: 'BSD-3-Clause', declaredSource: 'package.json', verifiedLicense: 'BSD-3-Clause', verifiedSource: 'LICENSE 文件', verifiedBy: 'Zen Li', verifiedAt: '2026-09-18T09:30:00', obligationConfirmed: false, note: '再发布需保留版权声明'},
  {id: 5, name: 'legacy-parser', version: '2.1.0', declaredLicense: 'MIT', declaredSource: 'package.json', verifiedLicense: 'GPL-3.0', verifiedSource: '仓库 LICENSE 文件', verifiedBy: 'Zen Li', verifiedAt: '2026-09-19T14:02:00', obligationConfirmed: false, note: 'package.json 声明与 LICENSE 文件不一致，以 LICENSE 文本为准'},
];

export const seedRecords: CheckRecord[] = [
  {id: 101, depId: 1, depName: 'react', version: '18.3.1', kind: 'initial', declaredLicense: 'MIT', verifiedLicense: 'MIT', verifiedSource: 'LICENSE 文件', mismatch: false, conclusion: '一致：MIT', createdAt: '2026-09-18T09:20:00'},
  {id: 102, depId: 2, depName: 'lodash', version: '4.17.21', kind: 'initial', declaredLicense: 'MIT', verifiedLicense: 'MIT', verifiedSource: 'LICENSE 文件', mismatch: false, conclusion: '一致：MIT', createdAt: '2026-09-18T09:22:00'},
  {id: 103, depId: 3, depName: 'chart.js', version: '4.4.4', kind: 'initial', declaredLicense: 'MIT', verifiedLicense: 'MIT', verifiedSource: '上游仓库', mismatch: false, conclusion: '一致：MIT', createdAt: '2026-09-18T09:25:00'},
  {id: 104, depId: 4, depName: 'highlight.js', version: '11.10.0', kind: 'initial', declaredLicense: 'BSD-3-Clause', verifiedLicense: 'BSD-3-Clause', verifiedSource: 'LICENSE 文件', mismatch: false, conclusion: '一致：BSD-3-Clause', createdAt: '2026-09-18T09:30:00'},
  {id: 105, depId: 5, depName: 'legacy-parser', version: '2.0.0', kind: 'initial', declaredLicense: 'GPL-3.0', verifiedLicense: 'GPL-3.0', verifiedSource: '仓库 LICENSE 文件', mismatch: false, conclusion: '一致：GPL-3.0', createdAt: '2026-08-02T10:00:00'},
  {id: 106, depId: 5, depName: 'legacy-parser', version: '2.1.0', kind: 'recheck', declaredLicense: 'MIT', verifiedLicense: 'GPL-3.0', verifiedSource: '仓库 LICENSE 文件', mismatch: true, conclusion: '不一致：包内声明 MIT，核验为 GPL-3.0', createdAt: '2026-09-19T14:02:00'},
];
