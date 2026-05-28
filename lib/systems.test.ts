// ENABLED_SYSTEMS 过滤行为测试
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { isSystemActive, getActiveSystemIds, getActiveSystems, SYSTEM_REGISTRY } from './systems'

const origEnv = process.env.ENABLED_SYSTEMS

describe('系统启用过滤 (ENABLED_SYSTEMS)', () => {
  beforeEach(() => {
    delete process.env.ENABLED_SYSTEMS
  })
  afterEach(() => {
    if (origEnv === undefined) delete process.env.ENABLED_SYSTEMS
    else process.env.ENABLED_SYSTEMS = origEnv
  })

  it('未设 env → 所有系统启用（向后兼容）', () => {
    expect(isSystemActive('eam')).toBe(true)
    expect(isSystemActive('edhr')).toBe(true)
    expect(isSystemActive('mes')).toBe(true)
    expect(isSystemActive('jsy')).toBe(true)
    expect(getActiveSystemIds().sort()).toEqual(Object.keys(SYSTEM_REGISTRY).sort())
  })

  it('空字符串 → 视同未设（防止误配吞掉所有系统）', () => {
    process.env.ENABLED_SYSTEMS = ''
    expect(isSystemActive('eam')).toBe(true)
    expect(getActiveSystemIds().length).toBe(Object.keys(SYSTEM_REGISTRY).length)
  })

  it('单系统 → 只该系统启用', () => {
    process.env.ENABLED_SYSTEMS = 'jsy'
    expect(isSystemActive('jsy')).toBe(true)
    expect(isSystemActive('eam')).toBe(false)
    expect(isSystemActive('mes')).toBe(false)
    expect(getActiveSystemIds()).toEqual(['jsy'])
  })

  it('多系统逗号分隔 → 仅列表内启用', () => {
    process.env.ENABLED_SYSTEMS = 'eam,mes,jsy'
    expect(isSystemActive('eam')).toBe(true)
    expect(isSystemActive('mes')).toBe(true)
    expect(isSystemActive('jsy')).toBe(true)
    expect(isSystemActive('edhr')).toBe(false)
    expect(getActiveSystemIds().sort()).toEqual(['eam', 'jsy', 'mes'])
  })

  it('大小写无关 + 容忍空白', () => {
    process.env.ENABLED_SYSTEMS = 'JSY,  EAM '
    expect(isSystemActive('jsy')).toBe(true)
    expect(isSystemActive('eam')).toBe(true)
    expect(isSystemActive('Jsy')).toBe(true)  // 入参也大小写无关
    expect(isSystemActive('edhr')).toBe(false)
  })

  it('getActiveSystems() 保留元数据完整性', () => {
    process.env.ENABLED_SYSTEMS = 'jsy'
    const active = getActiveSystems()
    expect(Object.keys(active)).toEqual(['jsy'])
    expect(active.jsy.label).toBe(SYSTEM_REGISTRY.jsy.label)
    expect(active.jsy.scope).toBe(SYSTEM_REGISTRY.jsy.scope)
  })

  it('未知系统名 → 不启用、不报错', () => {
    process.env.ENABLED_SYSTEMS = 'nonexistent,jsy'
    expect(isSystemActive('jsy')).toBe(true)
    expect(isSystemActive('nonexistent')).toBe(true)  // env 列表里就当启用（避免静默）
    expect(getActiveSystemIds()).toEqual(['jsy'])  // 但实际只有 SYSTEM_REGISTRY 里有的才会出现
  })
})
