import { describe, it, expect } from 'vitest'
import { BENCHMARK_DATASETS, buildBenchmarkConfig, getCommitSha } from './manifest'

describe('benchmark manifest', () => {
  it('数据集版本常量', () => {
    expect(BENCHMARK_DATASETS.platform.id).toBe('platform-v2')
    expect(BENCHMARK_DATASETS.eamEdhr.id).toBe('eam-edhr-v1')
  })

  it('buildBenchmarkConfig 包含 datasetVersion 与 commitSha', () => {
    const cfg = buildBenchmarkConfig({
      model: 'm',
      escalationModel: 'e',
      promptVersion: 'p1',
      datasetVersion: 'platform-v1',
    })
    expect(cfg.datasetVersion).toBe('platform-v1')
    expect(cfg.commitSha).toBeTruthy()
    expect(typeof getCommitSha()).toBe('string')
  })
})
