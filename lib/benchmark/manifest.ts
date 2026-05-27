// 评测基线版本 — 用例集与运行元数据分离，便于前后对比
import { execSync } from 'child_process'

export const BENCHMARK_DATASETS = {
  eamEdhr: { id: 'eam-edhr-v1', path: 'data/test-cases', description: 'EAM/EDHR 深度用例' },
  platform: { id: 'platform-v2', path: 'data/platform-test-cases', description: '平台三层用例（含扩展跨系统）' },
  platformV1: { id: 'platform-v1', path: 'data/platform-test-cases', description: '平台三层用例（R2 前 30 题基线）' },
} as const

export type BenchmarkDatasetId = keyof typeof BENCHMARK_DATASETS

/** 当前 git commit（短 SHA），非 git 环境返回 unknown */
export function getCommitSha(): string {
  try {
    return execSync('git rev-parse --short HEAD', { encoding: 'utf-8' }).trim()
  } catch {
    return 'unknown'
  }
}

export function buildBenchmarkConfig(params: {
  model: string
  escalationModel: string
  promptVersion: string
  datasetVersion: string
  maxChaseRounds?: number
  notes?: string
}) {
  return {
    model: params.model,
    escalationModel: params.escalationModel,
    maxChaseRounds: params.maxChaseRounds ?? 2,
    promptVersion: params.promptVersion,
    datasetVersion: params.datasetVersion,
    commitSha: getCommitSha(),
    notes: params.notes,
  }
}
