// 通用时间间隔计算 — 计算同一实体的同类事件之间的平均间隔
// 继承模式：handler 传 groupByField + timeField，这里做纯计算
// 新系统只需调用 enrichGroupsWithIntervals(list, groups, 'entityId', 'timestamp')

/**
 * 为 groupBy 结果注入时间间隔数据
 * 在 enrichGroupNames 之前调用（此时 group key 仍为原始 ID）
 */
export function enrichGroupsWithIntervals(
  list: Record<string, unknown>[],
  groups: Array<{ group: string; [k: string]: unknown }>,
  groupByField: string,
  timeField: string,
): void {
  // 按实体分组收集时间戳
  const timesByGroup = new Map<string, number[]>()
  for (const item of list) {
    const key = String(item[groupByField] ?? '')
    const time = item[timeField]
    if (typeof time !== 'number' || !key) continue
    if (!timesByGroup.has(key)) timesByGroup.set(key, [])
    timesByGroup.get(key)!.push(time)
  }

  // 注入每个 group 的平均间隔（天）
  for (const g of groups) {
    const times = timesByGroup.get(g.group)
    if (!times || times.length < 2) continue
    times.sort((a, b) => a - b)
    let totalDays = 0
    for (let i = 1; i < times.length; i++) {
      totalDays += (times[i] - times[i - 1]) / (1000 * 60 * 60 * 24)
    }
    g.avgIntervalDays = Math.round(totalDays / (times.length - 1) * 10) / 10
  }
}
