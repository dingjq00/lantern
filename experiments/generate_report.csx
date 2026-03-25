#r "nuget: DocumentFormat.OpenXml, 3.2.0"
#r "nuget: System.Text.Json, 8.0.0"

using System;
using System.IO;
using System.Linq;
using System.Text.Json;
using DocumentFormat.OpenXml;
using DocumentFormat.OpenXml.Packaging;
using DocumentFormat.OpenXml.Wordprocessing;

var dataPath = Path.Combine(Directory.GetCurrentDirectory(), "report_data.json");
var outputPath = Path.Combine(Directory.GetCurrentDirectory(), "方案A_G2路由实验报告.docx");
var json = File.ReadAllText(dataPath);
var data = JsonSerializer.Deserialize<JsonElement>(json);

using var doc = WordprocessingDocument.Create(outputPath, WordprocessingDocumentType.Document);
var mainPart = doc.AddMainDocumentPart();
mainPart.Document = new Document(new Body());
var body = mainPart.Document.Body!;

// ═══════════════════ 样式定义 ═══════════════════
var stylesPart = mainPart.AddNewPart<StyleDefinitionsPart>();
stylesPart.Styles = new Styles();
var styles = stylesPart.Styles;

styles.Append(new DocDefaults(
    new RunPropertiesDefault(new RunPropertiesBaseStyle(
        new RunFonts { Ascii = "Calibri", HighAnsi = "Calibri", EastAsia = "Microsoft YaHei", ComplexScript = "Calibri" },
        new FontSize { Val = "21" },  // 五号 10.5pt
        new FontSizeComplexScript { Val = "21" },
        new Color { Val = "333333" },
        new Languages { Val = "en-US", EastAsia = "zh-CN" }
    )),
    new ParagraphPropertiesDefault(new ParagraphPropertiesBaseStyle(
        new SpacingBetweenLines { Line = "360", LineRule = LineSpacingRuleValues.Auto, After = "120" }  // 1.5倍行距
    ))
));

// Normal
styles.Append(new Style(
    new StyleName { Val = "Normal" },
    new PrimaryStyle()
) { Type = StyleValues.Paragraph, StyleId = "Normal", Default = true });

// Heading 1
styles.Append(new Style(
    new StyleName { Val = "heading 1" },
    new BasedOn { Val = "Normal" },
    new NextParagraphStyle { Val = "Normal" },
    new PrimaryStyle(),
    new StyleParagraphProperties(
        new SpacingBetweenLines { Before = "480", After = "160" },
        new OutlineLevel { Val = 0 },
        new KeepNext(),
        new KeepLines()
    ),
    new StyleRunProperties(
        new RunFonts { Ascii = "Microsoft YaHei", HighAnsi = "Microsoft YaHei", EastAsia = "Microsoft YaHei" },
        new FontSize { Val = "36" },  // 小二 18pt
        new FontSizeComplexScript { Val = "36" },
        new Color { Val = "1F4E79" },
        new Bold()
    )
) { Type = StyleValues.Paragraph, StyleId = "Heading1" });

// Heading 2
styles.Append(new Style(
    new StyleName { Val = "heading 2" },
    new BasedOn { Val = "Normal" },
    new NextParagraphStyle { Val = "Normal" },
    new PrimaryStyle(),
    new StyleParagraphProperties(
        new SpacingBetweenLines { Before = "360", After = "120" },
        new OutlineLevel { Val = 1 },
        new KeepNext(),
        new KeepLines()
    ),
    new StyleRunProperties(
        new RunFonts { Ascii = "Microsoft YaHei", HighAnsi = "Microsoft YaHei", EastAsia = "Microsoft YaHei" },
        new FontSize { Val = "28" },  // 四号 14pt
        new FontSizeComplexScript { Val = "28" },
        new Color { Val = "1F4E79" },
        new Bold()
    )
) { Type = StyleValues.Paragraph, StyleId = "Heading2" });

// Heading 3
styles.Append(new Style(
    new StyleName { Val = "heading 3" },
    new BasedOn { Val = "Normal" },
    new NextParagraphStyle { Val = "Normal" },
    new PrimaryStyle(),
    new StyleParagraphProperties(
        new SpacingBetweenLines { Before = "240", After = "80" },
        new OutlineLevel { Val = 2 },
        new KeepNext()
    ),
    new StyleRunProperties(
        new RunFonts { Ascii = "Microsoft YaHei", HighAnsi = "Microsoft YaHei", EastAsia = "Microsoft YaHei" },
        new FontSize { Val = "24" },  // 小四 12pt
        new FontSizeComplexScript { Val = "24" },
        new Color { Val = "2E75B6" },
        new Bold()
    )
) { Type = StyleValues.Paragraph, StyleId = "Heading3" });

// ═══════════════════ 辅助函数 ═══════════════════
void AddParagraph(string text, string styleId = "Normal", bool bold = false)
{
    var p = new Paragraph(new ParagraphProperties(new ParagraphStyleId { Val = styleId }));
    var rpr = new RunProperties();
    if (bold) rpr.Append(new Bold());
    p.Append(new Run(rpr, new Text(text) { Space = SpaceProcessingModeValues.Preserve }));
    body.Append(p);
}

void AddEmptyLine()
{
    body.Append(new Paragraph());
}

Table CreateTable(string[] headers, string[][] rows, string headerBg = "1F4E79", bool zebra = true)
{
    var table = new Table();
    var tblPr = new TableProperties(
        new TableWidth { Width = "5000", Type = TableWidthUnitValues.Pct },
        new TableBorders(
            new TopBorder { Val = BorderValues.Single, Size = 8, Space = 0, Color = "BFBFBF" },
            new BottomBorder { Val = BorderValues.Single, Size = 8, Space = 0, Color = "BFBFBF" },
            new LeftBorder { Val = BorderValues.Single, Size = 4, Space = 0, Color = "D9D9D9" },
            new RightBorder { Val = BorderValues.Single, Size = 4, Space = 0, Color = "D9D9D9" },
            new InsideHorizontalBorder { Val = BorderValues.Single, Size = 4, Space = 0, Color = "D9D9D9" },
            new InsideVerticalBorder { Val = BorderValues.Single, Size = 4, Space = 0, Color = "D9D9D9" }
        ),
        new TableCellMarginDefault(
            new TopMargin { Width = "28", Type = TableWidthUnitValues.Dxa },
            new StartMargin { Width = "57", Type = TableWidthUnitValues.Dxa },
            new BottomMargin { Width = "28", Type = TableWidthUnitValues.Dxa },
            new EndMargin { Width = "57", Type = TableWidthUnitValues.Dxa }
        )
    );
    table.Append(tblPr);

    var grid = new TableGrid();
    foreach (var _ in headers) grid.Append(new GridColumn());
    table.Append(grid);

    // Header row
    var hr = new TableRow();
    foreach (var h in headers)
    {
        hr.Append(new TableCell(
            new TableCellProperties(
                new Shading { Val = ShadingPatternValues.Clear, Color = "auto", Fill = headerBg }
            ),
            new Paragraph(
                new ParagraphProperties(new SpacingBetweenLines { After = "0", Line = "276", LineRule = LineSpacingRuleValues.Auto }),
                new Run(
                    new RunProperties(new Bold(), new Color { Val = "FFFFFF" }, new FontSize { Val = "20" }),
                    new Text(h) { Space = SpaceProcessingModeValues.Preserve }
                )
            )
        ));
    }
    table.Append(hr);

    // Data rows
    for (int i = 0; i < rows.Length; i++)
    {
        var tr = new TableRow();
        foreach (var cell in rows[i])
        {
            var tcPr = new TableCellProperties();
            if (zebra && i % 2 == 1)
                tcPr.Append(new Shading { Val = ShadingPatternValues.Clear, Color = "auto", Fill = "F2F7FC" });
            tr.Append(new TableCell(
                tcPr,
                new Paragraph(
                    new ParagraphProperties(new SpacingBetweenLines { After = "0", Line = "276", LineRule = LineSpacingRuleValues.Auto }),
                    new Run(
                        new RunProperties(new FontSize { Val = "20" }),
                        new Text(cell) { Space = SpaceProcessingModeValues.Preserve }
                    )
                )
            ));
        }
        table.Append(tr);
    }

    body.Append(table);
    body.Append(new Paragraph());
    return table;
}

// ═══════════════════ 封面 ═══════════════════
for (int i = 0; i < 6; i++) AddEmptyLine();

var titleP = new Paragraph(
    new ParagraphProperties(new Justification { Val = JustificationValues.Center }),
    new Run(
        new RunProperties(
            new RunFonts { Ascii = "Microsoft YaHei", HighAnsi = "Microsoft YaHei", EastAsia = "Microsoft YaHei" },
            new FontSize { Val = "52" }, new FontSizeComplexScript { Val = "52" },
            new Color { Val = "1F4E79" }, new Bold()
        ),
        new Text("方案 A — G2 路由实验报告")
    )
);
body.Append(titleP);
AddEmptyLine();

var subtitleP = new Paragraph(
    new ParagraphProperties(new Justification { Val = JustificationValues.Center }),
    new Run(
        new RunProperties(
            new FontSize { Val = "28" }, new FontSizeComplexScript { Val = "28" },
            new Color { Val = "666666" }
        ),
        new Text("MES AI Explorer — MCP Tool 路由策略验证")
    )
);
body.Append(subtitleP);
AddEmptyLine();

var dateP = new Paragraph(
    new ParagraphProperties(new Justification { Val = JustificationValues.Center }),
    new Run(
        new RunProperties(new FontSize { Val = "24" }, new Color { Val = "999999" }),
        new Text("2026-03-25")
    )
);
body.Append(dateP);

// 分页
body.Append(new Paragraph(new Run(new Break { Type = BreakValues.Page })));

// ═══════════════════ 1. 实验概要 ═══════════════════
AddParagraph("1. 实验概要", "Heading1");

AddParagraph("本实验验证 MCP Tool 路由策略的准确率。通过给 LLM 提供 22 个 MCP Tool 的描述和用户的自然语言查询，测试 LLM 能否正确选择工具并填写参数。");
AddEmptyLine();

CreateTable(
    new[] { "项目", "内容" },
    new[] {
        new[] { "实验组", "G2 — MCP Tool 路由" },
        new[] { "工具集", "22 个 MCP Tools（覆盖设备/故障/维修/保养/巡检/备件/仪表盘 7 大域）" },
        new[] { "测试集", "40 题（L1×10, L2×10, L3×8, L4×6, L5×6）" },
        new[] { "评分维度", "D1 操作召回率（该调的工具都找到了吗）, D2 操作精确率（多选了无关工具吗）" },
        new[] { "LLM", "Round 1/2: gpt-5.4-mini, Round 3: gpt-5.4" },
        new[] { "LLM 来源", "codex-proxy（ChatGPT 号池代理，零额外成本）" },
    }
);

// ═══════════════════ 2. 三轮对比总览 ═══════════════════
AddParagraph("2. 三轮实验对比", "Heading1");

AddParagraph("2.1 总分对比", "Heading2");

var rounds = data.GetProperty("rounds").EnumerateArray().ToArray();
CreateTable(
    new[] { "轮次", "模型", "Prompt 版本", "D1 召回率", "D2 精确率", "全对题数" },
    rounds.Select(r => new[] {
        r.GetProperty("name").GetString()!,
        r.GetProperty("model").GetString()!,
        r.GetProperty("prompt").GetString()!,
        $"{r.GetProperty("d1").GetDouble():P1}",
        $"{r.GetProperty("d2").GetDouble():P1}",
        $"{r.GetProperty("perfect").GetInt32()}/40"
    }).ToArray()
);

AddParagraph("2.2 按难度级别对比", "Heading2");

var levels = data.GetProperty("levels").EnumerateArray().ToArray();
CreateTable(
    new[] { "级别", "题数", "R1 D1", "R2 D1", "R3 D1", "R1 D2", "R2 D2", "R3 D2" },
    levels.Select(l => new[] {
        l.GetProperty("level").GetString()!,
        l.GetProperty("count").GetInt32().ToString(),
        $"{l.GetProperty("r1_d1").GetDouble():P1}",
        $"{l.GetProperty("r2_d1").GetDouble():P1}",
        $"{l.GetProperty("r3_d1").GetDouble():P1}",
        $"{l.GetProperty("r1_d2").GetDouble():P1}",
        $"{l.GetProperty("r2_d2").GetDouble():P1}",
        $"{l.GetProperty("r3_d2").GetDouble():P1}",
    }).ToArray()
);

AddParagraph("2.3 Round 1 → Round 2 修复内容", "Heading2");
AddParagraph("仅修改 System Prompt，未修改工具集和测试集：");

CreateTable(
    new[] { "修复项", "具体改动", "解决的失败模式" },
    new[] {
        new[] { "日期上下文", "添加「当前日期: 2026-03-25」+ 常用时间段映射", "T18、T37 等「不知道今天几号」" },
        new[] { "多步编排指令", "明确「允许且鼓励多步编排」，允许 {{step1.result}} 占位符", "L3-L5 大量 unsupported" },
        new[] { "编号支持", "参数类型从 int 改为 int/string，说明支持业务编号", "T12 WO-001、T27 WO-005 等" },
        new[] { "工具描述增强", "补充用途说明（如 get_dashboard_summary 包含分类 TOP10）", "T09、T10 找不到对应工具" },
    }
);

AddParagraph("2.4 Round 2 → Round 3 变量", "Heading2");
AddParagraph("仅更换模型从 gpt-5.4-mini 到 gpt-5.4，Prompt 不变。目的是验证模型推理深度对多步编排的影响。");
AddParagraph("结论：gpt-5.4 的 D1 召回率几乎没变（72.5% → 73.1%），但 D2 精确率反而下降（80.4% → 75.2%）。原因是 gpt-5.4 试图「展开循环」（如 T09 对每个状态发起独立调用、T38 生成 16 次调用），导致冗余。", bold: true);

// ═══════════════════ 3. 失败模式分析 ═══════════════════
AddParagraph("3. 失败模式分析", "Heading1");

AddParagraph("3.1 Round 1 的四大失败模式", "Heading2");

CreateTable(
    new[] { "模式", "影响题数", "原因", "修复效果" },
    new[] {
        new[] { "拒绝多步组合", "~18 题", "LLM 认为「无法在一次调用中完成」就直接 unsupported", "Round 2 修复后 L3 从 12.5% → 60.4%" },
        new[] { "缺少日期上下文", "2 题", "「本月」「今年Q1」无法解析", "Round 2 完全修复" },
        new[] { "编号 vs ID", "2 题", "工具要 int ID，用户给编号如 WO-001", "Round 2 完全修复" },
        new[] { "工具覆盖盲区", "2 题", "没有直接的状态统计和分类统计工具", "Round 2 通过工具描述增强修复" },
    }
);

AddParagraph("3.2 Round 2 剩余失败模式", "Heading2");

AddParagraph("模式 A：多步编排不完整（8 题）", "Heading3");
AddParagraph("LLM 理解了需要多步，但只输出了前 1-2 步，没走完全链路。根因是 gpt-5.4-mini 的推理深度有限，倾向于「先查一步看看」。");

CreateTable(
    new[] { "题目", "问题", "LLM 走了", "缺失的步骤" },
    new[] {
        new[] { "T22", "BOM 备件库存不足", "get_equipment_spare_bom", "get_spare_stock" },
        new[] { "T24", "B 线巡检异常", "query_anomaly_records", "query_equipment（产线→设备）" },
        new[] { "T26", "A 线保养执行率", "query_equipment", "query_maintenance_tasks" },
        new[] { "T27", "工单出库单仓库", "get_repair_detail", "query_spare_transactions" },
        new[] { "T30", "维修成本最高+异常", "query_repair_orders", "get_repair_detail + query_anomaly_records" },
        new[] { "T31", "库存预警+维修设备", "get_spare_alerts", "get_equipment_spare_bom + query_equipment" },
        new[] { "T38", "维修频次+周期", "query_repair_orders", "get_equipment_detail" },
    }
);

AddParagraph("模式 B：工具选择偏差（4 题）", "Heading3");
AddParagraph("工具语义有重叠区域，LLM 选了「能用但不是最佳」的工具。部分属于 Ground Truth 过严。");

AddParagraph("模式 C：工具覆盖缺口（3 题）", "Heading3");
CreateTable(
    new[] { "题目", "问题", "缺失的工具" },
    new[] {
        new[] { "T34", "外协维修的重点设备", "无外协工单查询工具" },
        new[] { "T35", "产线故障趋势+库存不足", "无产线列表查询工具" },
        new[] { "T39", "备件月消耗量环比", "需通过 repair_detail 获取，但 LLM 选了 spare_transactions" },
    }
);

// ═══════════════════ 4. 逐题明细 ═══════════════════
body.Append(new Paragraph(new Run(new Break { Type = BreakValues.Page })));

AddParagraph("4. 逐题测试明细", "Heading1");
AddParagraph("以下列出全部 40 题的测试问题、期望答案、三轮 LLM 输出及评分。");

var details = data.GetProperty("details").EnumerateArray().ToArray();
string currentLevel = "";

foreach (var d in details)
{
    var level = d.GetProperty("level").GetString()!;
    if (level != currentLevel)
    {
        currentLevel = level;
        var levelName = level switch {
            "L1" => "L1 — 单操作直查",
            "L2" => "L2 — 双操作关联",
            "L3" => "L3 — 链式多跳",
            "L4" => "L4 — 跨域关联",
            "L5" => "L5 — 聚合+时间推理",
            _ => level
        };
        AddParagraph($"4.{level.Substring(1)}  {levelName}", "Heading2");
    }

    var id = d.GetProperty("id").GetString()!;
    var question = d.GetProperty("question").GetString()!;
    AddParagraph($"{id}: {question}", "Heading3");

    var gt = d.GetProperty("gt_tools").GetString()!;
    if (string.IsNullOrEmpty(gt)) gt = "(无)";

    var r1t = d.GetProperty("r1_tools").GetString()!;
    var r2t = d.GetProperty("r2_tools").GetString()!;
    var r3t = d.GetProperty("r3_tools").GetString()!;
    if (string.IsNullOrEmpty(r1t)) r1t = "(空/unsupported)";
    if (string.IsNullOrEmpty(r2t)) r2t = "(空/unsupported)";
    if (string.IsNullOrEmpty(r3t)) r3t = "(空/unsupported)";

    string fmtScore(JsonElement dd, string prefix)
    {
        var d1 = dd.GetProperty($"{prefix}_d1").GetDouble();
        var d2 = dd.GetProperty($"{prefix}_d2").GetDouble();
        var st = dd.GetProperty($"{prefix}_status").GetString()!;
        return $"D1={d1:P0} D2={d2:P0} [{st}]";
    }

    CreateTable(
        new[] { "项目", "内容" },
        new[] {
            new[] { "期望工具", gt },
            new[] { "R1 输出 (mini+V1)", r1t },
            new[] { "R1 评分", fmtScore(d, "r1") },
            new[] { "R2 输出 (mini+V2)", r2t },
            new[] { "R2 评分", fmtScore(d, "r2") },
            new[] { "R3 输出 (5.4+V2)", r3t },
            new[] { "R3 评分", fmtScore(d, "r3") },
        },
        headerBg: "2E75B6"
    );

    // 如果 R1 有 unsupported reason，加一行说明
    var reason = d.GetProperty("r1_reason").GetString()!;
    if (!string.IsNullOrEmpty(reason))
    {
        AddParagraph($"R1 拒绝原因: {reason}");
    }
}

// ═══════════════════ 5. 关键发现 ═══════════════════
body.Append(new Paragraph(new Run(new Break { Type = BreakValues.Page })));

AddParagraph("5. 关键发现与结论", "Heading1");

AddParagraph("5.1 Prompt 工程的杠杆效应", "Heading2");
AddParagraph("仅通过 Prompt 修改（零代码），D1 召回率从 39.6% 提升到 72.5%，提升近一倍。证明工具设计本身是合理的，问题在于如何引导 LLM 使用。System Prompt 中的约束和鼓励措辞对 LLM 行为影响巨大。");

AddParagraph("5.2 L1/L2 已达生产可用水平", "Heading2");
AddParagraph("L1 90%、L2 90% 的准确率已经足够支撑简单查询场景上线。22 个 MCP Tool 的设计覆盖了大部分单步/双步查询需求。gpt-5.4-mini 对于简单路由+填参数完全够用。");

AddParagraph("5.3 模型升级效果有限", "Heading2");
AddParagraph("gpt-5.4 相比 gpt-5.4-mini，在同一 Prompt 下总分几乎没有提升（73.1% vs 72.5%），精确率反而下降。原因是 gpt-5.4 倾向于「展开循环」（逐状态/逐月独立调用），导致冗余。结论：瓶颈在 Prompt 引导方式，不在模型能力。");

AddParagraph("5.4 工具集覆盖缺口已精确定位", "Heading2");
CreateTable(
    new[] { "缺口", "影响题目", "建议修复" },
    new[] {
        new[] { "无外协工单查询", "T34", "增加 query_outsource_orders 或在 repair_orders 加 type 参数" },
        new[] { "无产线列表查询", "T35", "增加 query_production_lines 工具" },
        new[] { "产线维度过滤不够", "T24, T26, T32", "anomaly_records/maintenance_tasks 增加 productionLineId" },
    }
);

AddParagraph("5.5 决策状态", "Heading2");
AddParagraph("G2 MCP Tool 路由方案方向正确。L1/L2 已可用（90%），L3-L5 需要 Prompt 优化（few-shot 示例）和工具集补缺继续推进。按 spec 决策规则，G2 = 72.5%，接近但未达 80% 目标线。预期 P1 优先级修复后可达标。", bold: true);

// ═══════════════════ 6. 下一步 ═══════════════════
AddParagraph("6. 下一步优化方向", "Heading1");

CreateTable(
    new[] { "优先级", "内容", "预期提升" },
    new[] {
        new[] { "P0", "Prompt V3: 加 few-shot 多步编排示例，限制调用次数", "5-10pp" },
        new[] { "P0", "调整 Ground Truth: 放宽「也算对」的替代答案", "3-5pp" },
        new[] { "P1", "工具集补缺: 产线列表、外协工单、产线维度参数", "3-5pp" },
        new[] { "P2", "G1/G3 对比实验: 提供基线对比数据做最终决策", "—" },
        new[] { "P2", "调查型 Agent: L4/L5 类问题评估多轮对话模式", "—" },
    }
);

// ═══════════════════ 页面设置 ═══════════════════
body.Append(new SectionProperties(
    new DocumentFormat.OpenXml.Wordprocessing.PageSize { Width = 11906U, Height = 16838U },  // A4
    new PageMargin { Top = 1440, Bottom = 1440, Left = 1440U, Right = 1440U, Header = 720U, Footer = 720U, Gutter = 0U }
));

Console.WriteLine($"报告已生成: {outputPath}");
