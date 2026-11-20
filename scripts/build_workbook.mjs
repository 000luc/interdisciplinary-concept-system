import path from "node:path";
import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";

const COLORS = {
  ink: "#1F2937",
  navy: "#17324D",
  teal: "#0F766E",
  amber: "#B45309",
  lightTeal: "#DDF4EF",
  paleTeal: "#F0FDFA",
  lightAmber: "#FEF3C7",
  paleAmber: "#FFFBEB",
  lightGray: "#F3F4F6",
  border: "#D1D5DB",
  white: "#FFFFFF",
  green: "#166534",
  lightGreen: "#DCFCE7",
  red: "#991B1B",
  lightRed: "#FEE2E2",
  blue: "#1D4ED8",
  lightBlue: "#DBEAFE",
};

const FONT = "Microsoft YaHei";

function applyTitle(sheet, title, note, lastColumn = "H") {
  sheet.getRange("A1").values = [[title]];
  sheet.getRange("A1").format.font = { name: FONT, size: 16, bold: true, color: COLORS.ink };
  sheet.getRange("A2").values = [[note]];
  sheet.getRange("A2").format.font = { name: FONT, size: 10, italic: true, color: "#6B7280" };
  sheet.getRange(`A3:${lastColumn}3`).format.borders = {
    bottom: { style: "thin", color: COLORS.teal },
  };
}

function styleHeader(range) {
  range.format.fill = COLORS.navy;
  range.format.font = { name: FONT, size: 10, bold: true, color: COLORS.white };
  range.format.verticalAlignment = "center";
  range.format.horizontalAlignment = "center";
  range.format.wrapText = true;
  range.format.borders = { preset: "all", style: "thin", color: COLORS.white };
}

function styleBody(range, height = 24) {
  range.format.font = { name: FONT, size: 10, color: COLORS.ink };
  range.format.verticalAlignment = "center";
  range.format.wrapText = true;
  range.format.rowHeight = height;
}

function applyInputStyle(range) {
  range.format.fill = COLORS.lightAmber;
  range.format.font = { name: FONT, size: 10, color: COLORS.ink };
}

function setColumnWidths(sheet, widths) {
  for (const [column, width] of Object.entries(widths)) {
    sheet.getRange(`${column}1`).format.columnWidth = width;
  }
}

function addStatusFormats(range, statusColors) {
  for (const [text, fill, color] of statusColors) {
    range.conditionalFormats.add("containsText", {
      text,
      format: {
        fill,
        font: { name: FONT, bold: true, color },
      },
    });
  }
}

function addTable(sheet, range, name, style = "TableStyleMedium2") {
  const table = sheet.tables.add(range, true, name);
  table.style = style;
  table.showFilterButton = true;
  return table;
}

export async function buildWorkbook({ workbook, content, SpreadsheetFile, fs, outputPath, previewDir }) {
  const dashboard = workbook.worksheets.add("学习看板");
  const daily = workbook.worksheets.add("120日任务");
  const concepts = workbook.worksheets.add("600概念库");
  const review = workbook.worksheets.add("复习队列");
  const weekly = workbook.worksheets.add("每周复盘");
  const outputs = workbook.worksheets.add("输出记录");

  for (const sheet of [dashboard, daily, concepts, review, weekly, outputs]) {
    sheet.showGridLines = false;
  }

  dashboard.tabColor = COLORS.teal;
  daily.tabColor = COLORS.navy;
  concepts.tabColor = "#6B7280";
  review.tabColor = COLORS.amber;
  weekly.tabColor = "#7C3AED";
  outputs.tabColor = "#334155";

  // 学习看板
  applyTitle(
    dashboard,
    "跨学科概念系统学习看板",
    "24 周，每天约 1 小时。黄色单元格由学习者维护，其他指标自动计算。",
    "J",
  );
  dashboard.getRange("A4").values = [["计划开始"]];
  dashboard.getRange("B4").values = [[new Date("2026-11-23T00:00:00")]];
  dashboard.getRange("A4").format.font = { name: FONT, size: 10, bold: true, color: COLORS.ink };
  dashboard.getRange("B4").setNumberFormat("yyyy-mm-dd");
  applyInputStyle(dashboard.getRange("B4"));
  dashboard.getRange("D4").values = [["计划结束"]];
  dashboard.getRange("E4").formulas = [["=IF(B4=\"\",\"\",B4+167)"]];
  dashboard.getRange("E4").setNumberFormat("yyyy-mm-dd");
  dashboard.getRange("D4").format.font = { name: FONT, size: 10, bold: true, color: COLORS.ink };

  dashboard.getRange("A7:C7").values = [["指标", "当前值", "目标或说明"]];
  styleHeader(dashboard.getRange("A7:C7"));
  dashboard.getRange("A8:C18").values = [
    ["总任务数", null, "120 个学习日"],
    ["已完成任务", null, "0"],
    ["任务完成率", null, "100%"],
    ["计划总小时", null, "120 小时"],
    ["实际学习小时", null, "按实际分钟累计"],
    ["已接触概念", null, "600"],
    ["A级已应用或迁移", null, "72"],
    ["周复盘完成", null, "24"],
    ["输出完成", null, "24"],
    ["待复习概念", null, "到期与逾期"],
    ["当前周次", null, "按今天自动显示"],
  ];
  const dashboardFormulas = [
    ["=COUNTA('120日任务'!$A$5:$A$124)"],
    ["=COUNTIFS('120日任务'!$J$5:$J$124,\"已完成\")"],
    ["=IF(B8=0,0,B9/B8)"],
    ["=SUM('120日任务'!$H$5:$H$124)/60"],
    ["=SUM('120日任务'!$I$5:$I$124)/60"],
    ["=COUNTIFS('600概念库'!$K$5:$K$604,\"<>未接触\")"],
    ["=COUNTIFS('600概念库'!$J$5:$J$604,\"A\",'600概念库'!$K$5:$K$604,\"应用\")+COUNTIFS('600概念库'!$J$5:$J$604,\"A\",'600概念库'!$K$5:$K$604,\"能迁移\")"],
    ["=COUNTIFS('每周复盘'!$O$5:$O$28,\"已完成\")"],
    ["=COUNTIFS('输出记录'!$G$5:$G$28,\"已完成\")"],
    ["=COUNTIFS('复习队列'!$H$5:$H$604,\">0\")"],
    ["=IF(TODAY()<B4,1,MIN(24,ROUNDUP((TODAY()-B4+1)/7,0)))"],
  ];
  dashboard.getRange("B8:B18").formulas = dashboardFormulas;
  dashboard.getRange("B10").setNumberFormat("0.0%");
  dashboard.getRange("B11:B12").setNumberFormat("0.0");
  dashboard.getRange("B13:B17").setNumberFormat("#,##0");
  dashboard.getRange("B18").setNumberFormat("0");
  styleBody(dashboard.getRange("A8:C18"), 25);
  dashboard.getRange("A8:A18").format.font = { name: FONT, size: 10, bold: true, color: COLORS.ink };
  dashboard.getRange("B8:C18").format.horizontalAlignment = "center";
  dashboard.getRange("A8:C18").format.borders = { preset: "all", style: "thin", color: COLORS.border };

  dashboard.getRange("E7:J7").values = [["领域", "概念数", "已接触", "A级掌握", "覆盖率", "A级掌握率"]];
  styleHeader(dashboard.getRange("E7:J7"));
  const domainNames = content.domains.map((domain) => domain.name);
  dashboard.getRange("E8:E13").values = domainNames.map((name) => [name]);
  dashboard.getRange("F8:F13").formulas = domainNames.map(
    (_, index) => [`=COUNTIFS('600概念库'!$C$5:$C$604,$E${8 + index})`],
  );
  dashboard.getRange("G8:G13").formulas = domainNames.map(
    (_, index) => [`=COUNTIFS('600概念库'!$C$5:$C$604,$E${8 + index},'600概念库'!$K$5:$K$604,"<>未接触")`],
  );
  dashboard.getRange("H8:H13").formulas = domainNames.map(
    (_, index) =>
      `=COUNTIFS('600概念库'!$C$5:$C$604,$E${8 + index},'600概念库'!$J$5:$J$604,"A",'600概念库'!$K$5:$K$604,"应用")+COUNTIFS('600概念库'!$C$5:$C$604,$E${8 + index},'600概念库'!$J$5:$J$604,"A",'600概念库'!$K$5:$K$604,"能迁移")`,
  ).map((formula) => [formula]);
  dashboard.getRange("I8:I13").formulas = domainNames.map(
    (_, index) => [`=IF(F${8 + index}=0,0,G${8 + index}/F${8 + index})`],
  );
  dashboard.getRange("J8:J13").formulas = domainNames.map(
    (_, index) =>
      `=IF(COUNTIFS('600概念库'!$C$5:$C$604,E${8 + index},'600概念库'!$J$5:$J$604,"A")=0,0,H${8 + index}/COUNTIFS('600概念库'!$C$5:$C$604,E${8 + index},'600概念库'!$J$5:$J$604,"A"))`,
  ).map((formula) => [formula]);
  dashboard.getRange("F8:H13").setNumberFormat("#,##0");
  dashboard.getRange("I8:J13").setNumberFormat("0.0%");
  styleBody(dashboard.getRange("E8:J13"), 25);
  dashboard.getRange("E8:E13").format.font = { name: FONT, size: 10, bold: true, color: COLORS.ink };
  dashboard.getRange("E8:J13").format.borders = { preset: "all", style: "thin", color: COLORS.border };
  dashboard.getRange("F8:J13").format.horizontalAlignment = "center";

  setColumnWidths(dashboard, { A: 18, B: 14, C: 18, D: 14, E: 14, F: 12, G: 12, H: 14, I: 12, J: 14 });

  // 120日任务
  applyTitle(
    daily,
    "120 个每日学习任务",
    "日期跟随“学习看板”的开始日期。实际分钟、完成状态和记录由学习者维护。",
    "L",
  );
  const dailyHeaders = [["天数", "日期", "周次", "阶段", "领域", "学习主题", "当日任务", "计划分钟", "实际分钟", "完成状态", "要点记录", "复习安排"]];
  daily.getRange("A4:L4").values = dailyHeaders;
  styleHeader(daily.getRange("A4:L4"));
  const dayRows = content.days.map((day) => [
    day.day_number,
    null,
    day.week,
    day.phase,
    day.domain,
    day.topic,
    day.task,
    day.minutes,
    null,
    "未开始",
    "",
    "次日回忆；第7天换案例；第30天迁移",
  ]);
  daily.getRange("A5:L124").values = dayRows;
  daily.getRange("B5").formulas = [["=IF('学习看板'!$B$4=\"\",\"\",'学习看板'!$B$4+A5-1)"]];
  daily.getRange("B5:B124").fillDown();
  daily.getRange("B5:B124").setNumberFormat("yyyy-mm-dd");
  daily.getRange("A5:A124").setNumberFormat("0");
  daily.getRange("H5:I124").setNumberFormat("0");
  styleBody(daily.getRange("A5:L124"), 48);
  daily.getRange("A5:A124").format.horizontalAlignment = "center";
  daily.getRange("B5:B124").format.horizontalAlignment = "center";
  daily.getRange("C5:C124").format.horizontalAlignment = "center";
  daily.getRange("H5:J124").format.horizontalAlignment = "center";
  applyInputStyle(daily.getRange("I5:I124"));
  applyInputStyle(daily.getRange("J5:J124"));
  applyInputStyle(daily.getRange("K5:K124"));
  daily.dataValidations.add({
    range: "J5:J124",
    rule: { type: "list", values: ["未开始", "进行中", "已完成", "顺延"] },
  });
  addStatusFormats(daily.getRange("J5:J124"), [
    ["已完成", COLORS.lightGreen, COLORS.green],
    ["进行中", COLORS.lightBlue, COLORS.blue],
    ["顺延", COLORS.lightAmber, COLORS.amber],
  ]);
  daily.getRange("A4:L124").format.borders = { preset: "all", style: "thin", color: COLORS.border };
  addTable(daily, "A4:L124", "DailyTasksTable", "TableStyleMedium2");
  daily.freezePanes.freezeRows(4);
  daily.freezePanes.freezeColumns(3);
  setColumnWidths(daily, { A: 8, B: 13, C: 8, D: 12, E: 12, F: 28, G: 72, H: 11, I: 11, J: 12, K: 34, L: 28 });

  // 600概念库
  applyTitle(
    concepts,
    "600 个跨学科概念库",
    "先扫描认识，再重点理解。掌握状态、信心评分和最近复习日期由学习者维护。",
    "O",
  );
  const conceptHeaders = [[
    "概念ID",
    "领域代码",
    "领域",
    "主题",
    "概念",
    "通俗解释（现象/机制）",
    "案例",
    "易混概念",
    "关联概念",
    "优先级",
    "掌握状态",
    "信心评分",
    "最近复习日期",
    "下次复习日期",
    "备注",
  ]];
  concepts.getRange("A4:O4").values = conceptHeaders;
  styleHeader(concepts.getRange("A4:O4"));
  const conceptRows = content.concepts.map((concept) => [
    concept.id,
    concept.domain_code,
    concept.domain_name,
    concept.theme,
    concept.name,
    concept.definition,
    concept.example,
    concept.contrast,
    concept.related,
    concept.priority,
    "未接触",
    null,
    null,
    null,
    "",
  ]);
  concepts.getRange("A5:O604").values = conceptRows;
  concepts.getRange("N5").formulas = [["=IF(M5=\"\",\"\",M5+IF(K5=\"认识\",1,IF(K5=\"理解\",7,IF(OR(K5=\"应用\",K5=\"能迁移\"),30,1))))"]];
  concepts.getRange("N5:N604").fillDown();
  concepts.getRange("M5:N604").setNumberFormat("yyyy-mm-dd");
  concepts.getRange("L5:L604").setNumberFormat("0");
  styleBody(concepts.getRange("A5:O604"), 38);
  for (const column of ["A", "B", "J", "K", "L", "M", "N"]) {
    concepts.getRange(`${column}5:${column}604`).format.horizontalAlignment = "center";
  }
  applyInputStyle(concepts.getRange("K5:M604"));
  applyInputStyle(concepts.getRange("O5:O604"));
  concepts.dataValidations.add({
    range: "J5:J604",
    rule: { type: "list", values: ["A", "B", "C"] },
  });
  concepts.dataValidations.add({
    range: "K5:K604",
    rule: { type: "list", values: ["未接触", "认识", "理解", "应用", "能迁移"] },
  });
  concepts.dataValidations.add({
    range: "L5:L604",
    rule: { type: "whole", operator: "between", formula1: 1, formula2: 5 },
  });
  addStatusFormats(concepts.getRange("J5:J604"), [
    ["A", COLORS.lightAmber, COLORS.amber],
    ["B", COLORS.lightBlue, COLORS.blue],
  ]);
  addStatusFormats(concepts.getRange("K5:K604"), [
    ["能迁移", COLORS.lightGreen, COLORS.green],
    ["应用", COLORS.lightTeal, COLORS.teal],
    ["理解", COLORS.lightBlue, COLORS.blue],
  ]);
  concepts.getRange("A4:O604").format.borders = { preset: "all", style: "thin", color: COLORS.border };
  addTable(concepts, "A4:O604", "ConceptBankTable", "TableStyleMedium4");
  concepts.freezePanes.freezeRows(4);
  concepts.freezePanes.freezeColumns(4);
  setColumnWidths(concepts, {
    A: 11,
    B: 10,
    C: 10,
    D: 20,
    E: 16,
    F: 44,
    G: 42,
    H: 42,
    I: 24,
    J: 8,
    K: 11,
    L: 10,
    M: 13,
    N: 13,
    O: 28,
  });

  // 复习队列
  applyTitle(
    review,
    "复习队列",
    "自动读取概念库。逾期天数大于 0 时优先处理；完成复习后在概念库更新最近复习日期。",
    "I",
  );
  review.getRange("A4:I4").values = [[
    "概念ID",
    "概念",
    "领域",
    "优先级",
    "掌握状态",
    "最近复习日期",
    "下次复习日期",
    "逾期天数",
    "建议动作",
  ]];
  styleHeader(review.getRange("A4:I4"));
  const reviewFormulas = content.concepts.map((_, index) => {
    const row = index + 5;
    const source = index + 5;
    return [
      `='600概念库'!A${source}`,
      `='600概念库'!E${source}`,
      `='600概念库'!C${source}`,
      `='600概念库'!J${source}`,
      `='600概念库'!K${source}`,
      `=IF('600概念库'!M${source}="","",'600概念库'!M${source})`,
      `=IF('600概念库'!N${source}="","",'600概念库'!N${source})`,
      `=IF(G${row}="","",MAX(0,TODAY()-G${row}))`,
      `=IF(G${row}="","待首次学习",IF(H${row}>0,"今日复习","按计划"))`,
    ];
  });
  review.getRange("A5:I604").formulas = reviewFormulas;
  review.getRange("F5:G604").setNumberFormat("yyyy-mm-dd");
  review.getRange("H5:H604").setNumberFormat("0");
  styleBody(review.getRange("A5:I604"), 28);
  for (const column of ["A", "D", "E", "F", "G", "H", "I"]) {
    review.getRange(`${column}5:${column}604`).format.horizontalAlignment = "center";
  }
  addStatusFormats(review.getRange("D5:D604"), [["A", COLORS.lightAmber, COLORS.amber]]);
  addStatusFormats(review.getRange("I5:I604"), [
    ["今日复习", COLORS.lightRed, COLORS.red],
    ["待首次学习", COLORS.lightAmber, COLORS.amber],
    ["按计划", COLORS.lightGreen, COLORS.green],
  ]);
  review.getRange("A4:I604").format.borders = { preset: "all", style: "thin", color: COLORS.border };
  addTable(review, "A4:I604", "ReviewQueueTable", "TableStyleMedium6");
  review.freezePanes.freezeRows(4);
  review.freezePanes.freezeColumns(3);
  setColumnWidths(review, { A: 11, B: 18, C: 12, D: 9, E: 11, F: 14, G: 14, H: 10, I: 14 });

  // 每周复盘
  applyTitle(
    weekly,
    "24 周复盘",
    "周次和任务完成情况自动计算。最大收获、最大困惑、跨领域连接、自评分和下周动作由学习者填写。",
    "O",
  );
  weekly.getRange("A4:O4").values = [[
    "周次",
    "日期范围",
    "开始日期",
    "结束日期",
    "阶段",
    "学习主题",
    "本周输出",
    "完成任务数",
    "实际分钟",
    "最大收获",
    "最大困惑",
    "跨领域连接",
    "自评分",
    "下周动作",
    "复盘完成",
  ]];
  styleHeader(weekly.getRange("A4:O4"));
  const weeklyRows = content.weeks.map((week) => [
    week.week,
    null,
    null,
    null,
    week.phase,
    week.title,
    week.output,
    null,
    null,
    "",
    "",
    "",
    null,
    "",
    "未完成",
  ]);
  weekly.getRange("A5:O28").values = weeklyRows;
  weekly.getRange("C5").formulas = [["=IF('学习看板'!$B$4=\"\",\"\",'学习看板'!$B$4+(A5-1)*7)"]];
  weekly.getRange("C5:C28").fillDown();
  weekly.getRange("D5").formulas = [["=IF(C5=\"\",\"\",C5+6)"]];
  weekly.getRange("D5:D28").fillDown();
  weekly.getRange("B5").formulas = [["=IF(C5=\"\",\"\",TEXT(C5,\"yyyy-mm-dd\")&\" 至 \"&TEXT(D5,\"yyyy-mm-dd\"))"]];
  weekly.getRange("B5:B28").fillDown();
  weekly.getRange("H5").formulas = [["=COUNTIFS('120日任务'!$C$5:$C$124,A5,'120日任务'!$J$5:$J$124,\"已完成\")"]];
  weekly.getRange("H5:H28").fillDown();
  weekly.getRange("I5").formulas = [["=SUMIFS('120日任务'!$I$5:$I$124,'120日任务'!$C$5:$C$124,A5)"]];
  weekly.getRange("I5:I28").fillDown();
  weekly.getRange("C5:D28").setNumberFormat("yyyy-mm-dd");
  weekly.getRange("H5:I28").setNumberFormat("0");
  weekly.getRange("M5:M28").setNumberFormat("0");
  styleBody(weekly.getRange("A5:O28"), 42);
  for (const column of ["A", "B", "C", "D", "H", "I", "M", "O"]) {
    weekly.getRange(`${column}5:${column}28`).format.horizontalAlignment = "center";
  }
  applyInputStyle(weekly.getRange("J5:N28"));
  weekly.dataValidations.add({
    range: "M5:M28",
    rule: { type: "whole", operator: "between", formula1: 1, formula2: 5 },
  });
  weekly.dataValidations.add({
    range: "O5:O28",
    rule: { type: "list", values: ["未完成", "已完成"] },
  });
  addStatusFormats(weekly.getRange("O5:O28"), [["已完成", COLORS.lightGreen, COLORS.green]]);
  weekly.getRange("A4:O28").format.borders = { preset: "all", style: "thin", color: COLORS.border };
  addTable(weekly, "A4:O28", "WeeklyReviewTable", "TableStyleMedium9");
  weekly.freezePanes.freezeRows(4);
  weekly.freezePanes.freezeColumns(2);
  setColumnWidths(weekly, {
    A: 8,
    B: 24,
    C: 13,
    D: 13,
    E: 14,
    F: 40,
    G: 44,
    H: 12,
    I: 12,
    J: 30,
    K: 30,
    L: 32,
    M: 9,
    N: 28,
    O: 11,
  });

  // 输出记录
  applyTitle(
    outputs,
    "输出记录",
    "每周输出、跨领域案例和最终项目都在这里登记。状态和完成日期由学习者维护。",
    "J",
  );
  outputs.getRange("A4:J4").values = [[
    "输出ID",
    "周次",
    "阶段",
    "类型",
    "输出内容",
    "目标",
    "状态",
    "完成日期",
    "文件位置",
    "备注",
  ]];
  styleHeader(outputs.getRange("A4:J4"));
  const outputRows = content.outputs.map((output) => [
    output.id,
    output.week,
    output.phase,
    output.type,
    output.title,
    output.target,
    output.status,
    null,
    "",
    "",
  ]);
  outputs.getRange("A5:J28").values = outputRows;
  outputs.getRange("H5:H28").setNumberFormat("yyyy-mm-dd");
  styleBody(outputs.getRange("A5:J28"), 42);
  for (const column of ["A", "B", "G", "H"]) {
    outputs.getRange(`${column}5:${column}28`).format.horizontalAlignment = "center";
  }
  applyInputStyle(outputs.getRange("G5:I28"));
  outputs.dataValidations.add({
    range: "G5:G28",
    rule: { type: "list", values: ["未开始", "进行中", "已完成", "需重做"] },
  });
  addStatusFormats(outputs.getRange("G5:G28"), [
    ["已完成", COLORS.lightGreen, COLORS.green],
    ["进行中", COLORS.lightBlue, COLORS.blue],
    ["需重做", COLORS.lightRed, COLORS.red],
  ]);
  outputs.getRange("A4:J28").format.borders = { preset: "all", style: "thin", color: COLORS.border };
  addTable(outputs, "A4:J28", "OutputLogTable", "TableStyleMedium7");
  outputs.freezePanes.freezeRows(4);
  outputs.freezePanes.freezeColumns(2);
  setColumnWidths(outputs, { A: 12, B: 8, C: 14, D: 16, E: 48, F: 24, G: 11, H: 13, I: 34, J: 30 });

  workbook.recalculate();

  const qa = {};
  const checks = [
    ["学习看板", "A1:J18"],
    ["120日任务", "A1:L18"],
    ["600概念库", "A1:O14"],
    ["复习队列", "A1:I14"],
    ["每周复盘", "A1:O14"],
    ["输出记录", "A1:J14"],
  ];
  for (const [sheetName, range] of checks) {
    const inspection = await workbook.inspect({
      kind: "table",
      range: `${sheetName}!${range}`,
      include: "values,formulas",
      tableMaxRows: 18,
      tableMaxCols: 15,
      tableMaxCellChars: 100,
    });
    qa[sheetName] = inspection.ndjson;
  }
  const errors = await workbook.inspect({
    kind: "match",
    searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A|#NUM!|#NULL!|#SPILL!|#CALC!",
    options: { useRegex: true, maxResults: 300 },
    summary: "最终公式错误扫描",
  });
  qa.formulaErrors = errors.ndjson;

  await fs.mkdir(previewDir, { recursive: true });
  const previews = [];
  for (const [sheetName, range] of checks) {
    const preview = await workbook.render({
      sheetName,
      range,
      scale: 1.5,
      format: "png",
    });
    const fileName = `${String(previews.length + 1).padStart(2, "0")}-${sheetName}.png`;
    const fullPath = path.join(previewDir, fileName);
    await fs.writeFile(fullPath, new Uint8Array(await preview.arrayBuffer()));
    previews.push(fullPath);
  }

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  const output = await SpreadsheetFile.exportXlsx(workbook);
  await output.save(outputPath);

  return {
    outputPath,
    previews,
    qa,
    counts: {
      sheets: workbook.worksheets.items.length,
      concepts: content.concepts.length,
      days: content.days.length,
      weeks: content.weeks.length,
      outputs: content.outputs.length,
    },
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { Workbook, SpreadsheetFile } = await import("@oai/artifact-tool");
  const projectDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const content = JSON.parse(
    await fs.readFile(path.join(projectDir, "scripts", "build", "content.json"), "utf8"),
  );
  const workbook = Workbook.create();
  const result = await buildWorkbook({
    workbook,
    content,
    SpreadsheetFile,
    fs,
    outputPath: path.join(projectDir, "learning-progress.xlsx"),
    previewDir: path.join(projectDir, "qa"),
  });
  console.log(
    JSON.stringify(
      {
        outputPath: result.outputPath,
        previews: result.previews,
        counts: result.counts,
        qa: result.qa,
      },
      null,
      2,
    ),
  );
}
