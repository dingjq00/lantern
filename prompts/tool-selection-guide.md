## 工具选择方法

### 1. 工具能力层级

工具分三个层级，选择时从上往下匹配：

**Tier 1 — 全景工具（一个工具聚合多域数据，优先选）**
- `eam.equipment.profile` — 单台设备全景（基础+故障+维修+保养+巡检+BOM+生命周期）
- `eam.repair.profile` — 单个工单全景（工单+故障+备件+工时+知识+出库）
- `eam.scope.overview` — 范围概览（车间/产线/部门的设备+各域汇总）

**Tier 2 — 搜索工具（按条件查列表，支持聚合统计）**
- 7 个域各一个 search 工具，支持 groupBy 聚合

**Tier 3 — 分析工具（全局视角）**
- `eam.dashboard` — 全局指标快照
- `eam.trend` — 时间序列趋势

### 2. 选择优先级

1. **能用全景工具就不拆成多个搜索** — "EQ-001 的故障和保养" → 直接用 equipment.profile（已包含两者），不要分别调 fault.search + maintenance.search
2. **用 search 的 groupBy 做统计** — "故障最多的设备" → fault.search(groupBy=equipment)，不要拉全量数据自己数
3. **跨域分析用多个工具组合** — "故障最多的设备保养情况" → fault.search + maintenance.search（两个域各一个工具）
4. **全局统计用 dashboard** — "总共多少设备" → dashboard，不要 equipment.search
5. **范围概览用 scope.overview** — "一车间怎么样" → scope.overview，不要多个 search 拼凑

### 3. 参数填写

- 设备/产线/部门：直接传用户说的名称或编号，工具内部自动解析
- 时间范围：转换为 {from, to} 格式，如"上月"→ {from: "2026-02-01", to: "2026-02-28"}
- groupBy：用户要统计/排名/分布时使用
- format：简单问题传 "concise" 省 token，深度分析传 "detailed"

### 4. 拿到数据后自己分析

获取数据后，自己做统计分析：计数、分组、排序、Top-N、对比。这是你的分析能力，不需要专门工具。

### 5. 常见误区

- ❌ 先查设备列表拿 ID，再用 ID 查详情 → ✅ 直接传名称，工具自动解析
- ❌ 用 search 查一个工具返回 ID，再逐个调 profile → ✅ search 已返回中等丰富度数据
- ❌ "一车间设备概况"分别调 fault.search + maintenance.search + patrol.search → ✅ 一个 scope.overview 搞定
- ❌ 跨域问题只查一个域 → ✅ 问了两个域就选两个域的工具
