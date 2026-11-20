from __future__ import annotations

import importlib.util
import json
from dataclasses import dataclass, asdict
from datetime import date, timedelta
from pathlib import Path
from typing import Iterable


PROJECT_DIR = Path(__file__).resolve().parents[1]
DATA_DIR = Path(__file__).resolve().parent / "data"
CONCEPTS_DIR = PROJECT_DIR / "concepts"
BUILD_DIR = Path(__file__).resolve().parent / "build"
START_DATE = date(2026, 11, 23)

DOMAIN_FILES = [
    "sociology.py",
    "psychology.py",
    "economics.py",
    "communication.py",
    "management.py",
    "cognitive_science.py",
]


@dataclass
class Concept:
    id: str
    domain_code: str
    domain_name: str
    theme: str
    name: str
    definition: str
    example: str
    contrast: str
    related: str
    priority: str
    phenomenon: str
    deep_mechanism: str = ""
    deep_boundary: str = ""
    deep_counterexample: str = ""
    deep_source: str = ""


@dataclass
class DayTask:
    day_number: int
    date: str
    week: int
    phase: str
    domain: str
    topic: str
    task: str
    output: str
    minutes: int = 60


@dataclass
class WeekPlan:
    week: int
    start_date: str
    end_date: str
    phase: str
    domain: str
    title: str
    output: str


def load_domain(filename: str) -> dict:
    path = DATA_DIR / filename
    spec = importlib.util.spec_from_file_location(path.stem, path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"无法加载数据文件：{path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module.DOMAIN


def parse_lines(raw: str) -> list[list[str]]:
    rows = []
    for line in raw.strip().splitlines():
        if not line.strip():
            continue
        parts = [part.strip() for part in line.split("|")]
        if len(parts) != 4 or any(not part for part in parts):
            raise ValueError(f"数据行必须包含 4 个非空字段：{line}")
        rows.append(parts)
    return rows


def build_domains() -> list[dict]:
    domains = []
    for filename in DOMAIN_FILES:
        raw_domain = load_domain(filename)
        rows = parse_lines(raw_domain["concepts"])
        deep_rows = parse_lines(raw_domain["deep"])
        if len(raw_domain["themes"]) != 10:
            raise ValueError(f"{raw_domain['name']}必须设置 10 个主题")
        if len(rows) != 100:
            raise ValueError(f"{raw_domain['name']}必须有 100 个概念，实际为 {len(rows)}")
        if len(deep_rows) != 12:
            raise ValueError(f"{raw_domain['name']}必须有 12 张深度卡，实际为 {len(deep_rows)}")

        names = [row[0] for row in rows]
        if len(set(names)) != 100:
            raise ValueError(f"{raw_domain['name']}存在重复概念")

        deep_map = {row[0]: row[1:] for row in deep_rows}
        missing = sorted(set(deep_map) - set(names))
        if missing:
            raise ValueError(f"{raw_domain['name']}深度卡引用了不存在的概念：{missing}")

        concepts = []
        for index, (name, definition, example, contrast) in enumerate(rows):
            theme_index = index // 10
            position = index % 10
            theme = raw_domain["themes"][theme_index][0]
            theme_names = names[theme_index * 10 : theme_index * 10 + 10]
            related = [theme_names[(position - 1) % 10], theme_names[(position + 1) % 10]]
            priority = "A" if name in deep_map else ("B" if position in {1, 2, 3, 4} else "C")
            deep = deep_map.get(name, ["", "", "", ""])
            concepts.append(
                Concept(
                    id=f"{raw_domain['code']}-{index + 1:03d}",
                    domain_code=raw_domain["code"],
                    domain_name=raw_domain["name"],
                    theme=theme,
                    name=name,
                    definition=definition,
                    example=example,
                    contrast=contrast,
                    related="、".join(related),
                    priority=priority,
                    phenomenon=definition,
                    deep_mechanism=deep[0],
                    deep_boundary=deep[1],
                    deep_counterexample=deep[2],
                    deep_source=raw_domain["sources"][len(concepts) % 3][0] if deep[0] else "",
                )
            )

        domains.append(
            {
                "code": raw_domain["code"],
                "name": raw_domain["name"],
                "file": raw_domain["file"],
                "intro": raw_domain["intro"],
                "themes": raw_domain["themes"],
                "sources": raw_domain["sources"],
                "concepts": concepts,
            }
        )
    return domains


def md_cell(value: object) -> str:
    return str(value).replace("|", "\\|").replace("\n", "<br>")


def write_concept_file(domain: dict) -> None:
    lines = [
        f"# {domain['name']}概念库",
        "",
        domain["intro"],
        "",
        "## 使用方法",
        "",
        "- 第一轮只求认识：看概念、通俗解释和一个案例，不要求背定义。",
        "- 第二轮抓住 A 级重点：阅读深度卡，回答机制、边界、反例和迁移题。",
        "- 每个概念至少补充一个你亲眼见过、读过或经历过的真实案例。",
        "- 掌握状态以“能否脱离原文解释和使用”为准，不以阅读次数为准。",
        "",
    ]
    for theme_index, (theme_name, theme_desc) in enumerate(domain["themes"], start=1):
        lines.extend(
            [
                f"## {theme_index}. {theme_name}",
                "",
                theme_desc,
                "",
                "| 编号 | 概念 | 通俗解释（现象/机制） | 案例 | 易混概念 | 关联概念 | 优先级 |",
                "|---|---|---|---|---|---|---|",
            ]
        )
        theme_concepts = domain["concepts"][(theme_index - 1) * 10 : theme_index * 10]
        for concept in theme_concepts:
            lines.append(
                "| "
                + " | ".join(
                    md_cell(value)
                    for value in [
                        concept.id,
                        concept.name,
                        concept.definition,
                        concept.example,
                        concept.contrast,
                        concept.related,
                        concept.priority,
                    ]
                )
                + " |"
            )
        lines.append("")

    lines.extend(
        [
            "## 重点概念深度卡",
            "",
            "深度卡用于理解、验证和迁移，不要求逐字记忆。每次复习先遮住答案，用 60 秒口述。",
            "",
        ]
    )
    for concept in [item for item in domain["concepts"] if item.priority == "A"]:
        lines.extend(
            [
                f"### {concept.id} {concept.name}",
                "",
                f"- **一句话解释**：{concept.definition}",
                f"- **作用机制**：{concept.deep_mechanism}",
                f"- **适用边界**：{concept.deep_boundary}",
                f"- **反例检查**：{concept.deep_counterexample}",
                f"- **生活案例**：{concept.example}",
                f"- **易混概念**：{concept.contrast}",
                f"- **关联概念**：{concept.related}",
                f"- **定位来源**：{concept.deep_source}",
                "",
                "**三次练习**",
                "",
                f"1. 不用原文，用 60 秒解释“{concept.name}”解释了什么现象。",
                f"2. 找一个与“{concept.example}”不同领域的案例，并说明机制是否仍然成立。",
                f"3. 找一个可能推翻或限制该解释的反例，写出还缺少什么证据。",
                "",
            ]
        )

    lines.extend(["## 参考资料", ""])
    for title, use in domain["sources"]:
        lines.append(f"- {title}：{use}")
    lines.append("")
    (CONCEPTS_DIR / domain["file"]).write_text("\n".join(lines), encoding="utf-8")


def build_schedule(domains: list[dict]) -> tuple[list[WeekPlan], list[DayTask], list[dict]]:
    weeks: list[WeekPlan] = []
    days: list[DayTask] = []
    week_outputs = []
    day_number = 1

    for week_offset, domain in enumerate(domains):
        for cycle in range(1, 4):
            week = week_offset * 3 + cycle
            start = START_DATE + timedelta(days=(week - 1) * 7)
            end = start + timedelta(days=6)
            deep = [concept.name for concept in domain["concepts"] if concept.priority == "A"]

            if cycle == 1:
                title = f"{domain['name']}：100 个概念扫描与主题建图"
                tasks = [
                    ("主题 1-2：扫描 20 个概念", "为 20 个概念填写一句话解释，标出最陌生的 3 个。"),
                    ("主题 3-4：扫描 20 个概念", "为 20 个概念补一个现实案例，写下 2 组易混概念。"),
                    ("主题 5-6：扫描 20 个概念", "为 20 个概念标记 A/B/C 关注度，找出与前一领域相连的概念。"),
                    ("主题 7-8：扫描 20 个概念", "为 20 个概念各写一个可观察现象，删掉无法解释具体问题的空泛表述。"),
                    ("主题 9-10、收束与筛选", "完成最后 20 个概念，绘制本领域 10 主题地图，自测 10 个随机概念。"),
                ]
                output = "100 个概念初筛、10 主题地图、300-500 字周综合"
            elif cycle == 2:
                title = f"{domain['name']}：前 6 个重点概念精读"
                tasks = [
                    (f"精读 {deep[0]}、{deep[1]}", "分别写出机制、边界、一个反例，并各配一个生活案例。"),
                    (f"精读 {deep[2]}、{deep[3]}", "比较两组相邻概念，说明它们解释对象和证据要求有何不同。"),
                    (f"精读 {deep[4]}、{deep[5]}", "分别寻找一个不同于教材案例的现实事件，检查是否满足机制。"),
                    ("证据核验与反例练习", "回看本领域参考资料，核对 6 个重点概念，修正至少 2 处模糊表述。"),
                    ("口头解释与周综合", "闭卷做 10 分钟口头解释，完成 300-500 字综合并列出未解决的问题。"),
                ]
                output = "前 6 张深度卡、证据核验记录、300-500 字周综合"
            else:
                title = f"{domain['name']}：后 6 个重点概念与领域框架"
                tasks = [
                    (f"精读 {deep[6]}、{deep[7]}", "分别写出机制、边界、一个反例，并各配一个生活案例。"),
                    (f"精读 {deep[8]}、{deep[9]}", "比较两组相邻概念，说明哪些现象单一概念无法解释。"),
                    (f"精读 {deep[10]}、{deep[11]}", "把 12 个重点概念按机制、情境和结果重新分组。"),
                    ("构建领域概念网络", "绘制一页关系图，至少标出 5 组因果、对比或条件关系。"),
                    ("领域测验与框架输出", "随机抽测 20 个概念，完成一页领域框架和 300-500 字总复盘。"),
                ]
                output = "后 6 张深度卡、一页领域框架、20 题自测、300-500 字周综合"

            week_plan = WeekPlan(
                week=week,
                start_date=start.isoformat(),
                end_date=end.isoformat(),
                phase=domain["name"],
                domain=domain["name"],
                title=title,
                output=output,
            )
            weeks.append(week_plan)
            week_outputs.append(
                {
                    "id": f"OUT-W{week:02d}",
                    "week": week,
                    "phase": domain["name"],
                    "type": "周综合/领域输出",
                    "title": output,
                    "target": "300-500 字及对应框架或卡片",
                    "status": "未开始",
                }
            )

            for day_index, (topic, task) in enumerate(tasks, start=1):
                days.append(
                    DayTask(
                        day_number=day_number,
                        date=(start + timedelta(days=day_index - 1)).isoformat(),
                        week=week,
                        phase=domain["name"],
                        domain=domain["name"],
                        topic=topic,
                        task=f"10 分钟回忆；35 分钟完成“{task}”；10 分钟案例迁移；5 分钟记录。",
                        output=topic,
                    )
                )
                day_number += 1

    integration_weeks = [
        {
            "title": "跨领域专题一：注意力、信息与判断",
            "tasks": [
                ("问题界定", "用传播学、认知科学和心理学概念解释“为什么信息越多不一定判断越好”。"),
                ("机制筛选", "从 600 概念库挑选 8 个相关概念，区分个人加工、媒介机制和社会反馈。"),
                ("证据与反例", "找 3 个现实案例和 2 个反例，说明概念在什么条件下不成立。"),
                ("框架整合", "绘制“平台排序-注意选择-情绪反应-判断结果”关系图。"),
                ("案例分析", "完成 800-1000 字案例分析，并列出 3 个仍待验证的问题。"),
            ],
            "output": "信息环境诊断 800-1000 字与关系图",
        },
        {
            "title": "跨领域专题二：决策、激励与组织",
            "tasks": [
                ("问题界定", "解释一个“个人明知不优却仍重复”的决策或组织行为。"),
                ("机制筛选", "结合经济学、心理学和管理学，区分激励、认知偏差、流程与权力因素。"),
                ("替代解释", "写出至少 3 种相互竞争的解释，并说明各自可观察证据。"),
                ("方案设计", "基于分析设计一个不依赖意志力的改进行动。"),
                ("案例分析", "完成 800-1000 字案例分析，检查方案是否产生新的激励副作用。"),
            ],
            "output": "决策与激励分析 800-1000 字及改进行动",
        },
        {
            "title": "跨领域专题三：群体、制度与公共行动",
            "tasks": [
                ("问题界定", "选择一个群体冲突、公共议题或组织协作问题。"),
                ("结构分析", "结合社会学、传播学和管理学，画出自上而下、横向网络和反馈路径。"),
                ("证据审查", "区分当事人叙述、平台呈现、统计数据和制度规则，标注来源限制。"),
                ("方案比较", "设计两种干预思路，比较效果、公平、成本和意外后果。"),
                ("案例分析", "完成 800-1000 字案例分析，明确推荐、前提和失败条件。"),
            ],
            "output": "群体与制度事件分析 800-1000 字及方案比较",
        },
    ]
    for offset, spec in enumerate(integration_weeks, start=19):
        week = offset
        start = START_DATE + timedelta(days=(week - 1) * 7)
        end = start + timedelta(days=6)
        weeks.append(
            WeekPlan(
                week=week,
                start_date=start.isoformat(),
                end_date=end.isoformat(),
                phase="跨领域整合",
                domain="六领域综合",
                title=spec["title"],
                output=spec["output"],
            )
        )
        week_outputs.append(
            {
                "id": f"OUT-W{week:02d}",
                "week": week,
                "phase": "跨领域整合",
                "type": "跨领域案例",
                "title": spec["output"],
                "target": "800-1000 字",
                "status": "未开始",
            }
        )
        for day_index, (topic, task) in enumerate(spec["tasks"], start=1):
            days.append(
                DayTask(
                    day_number=day_number,
                    date=(start + timedelta(days=day_index - 1)).isoformat(),
                    week=week,
                    phase="跨领域整合",
                    domain="六领域综合",
                    topic=topic,
                    task=f"10 分钟回顾；40 分钟完成“{task}”；10 分钟记录证据与反例。",
                    output=topic,
                )
            )
            day_number += 1

    capstone_weeks = [
        {
            "title": "综合项目：问题、证据与解释框架",
            "tasks": [
                ("确定结项问题", "选一个真实问题，写出受影响对象、决策情境和判断标准。"),
                ("概念选择", "从六个领域选出 12-18 个概念，删除不能增加解释力的概念。"),
                ("证据矩阵", "列出事实、数据、当事人经验和媒体材料，标注来源及限制。"),
                ("替代解释", "写出至少 3 种竞争解释，说明如何用证据区分。"),
                ("开题检查", "完成一页项目说明，确认问题、解释框架、证据和输出计划。"),
            ],
            "output": "结项说明书一页、概念清单、证据矩阵",
        },
        {
            "title": "综合项目：分析、反例与概念关系图",
            "tasks": [
                ("主论证", "写出核心判断、机制链条和适用条件。"),
                ("证据整合", "将证据按支持和挑战主论证分组，写出证据强度差异。"),
                ("反例压力测试", "用最强反例修正主论证，删除无法支持的因果关系。"),
                ("概念关系图", "绘制最终关系图，标出六领域之间的输入、反馈和约束。"),
                ("报告初稿", "完成 3000-5000 字分析初稿并做一次逻辑删减。"),
            ],
            "output": "3000-5000 字初稿、反例记录、最终概念关系图",
        },
        {
            "title": "综合项目：结项表达与长期复习",
            "tasks": [
                ("证据复核", "逐条核对关键事实、数字、概念和来源，标记不确定项。"),
                ("报告定稿", "完成 3000-5000 字最终稿，压缩重复内容并补足限制条件。"),
                ("口头预演", "进行 10 分钟讲解，要求不用术语堆砌并回答 3 个质疑。"),
                ("个人框架", "写出一页个人决策与分析方法，包含使用步骤和不适用情形。"),
                ("30 天复习计划", "从 A 级概念中选 30 个安排到未来 30 天，明确每周检验方式。"),
            ],
            "output": "最终报告、10 分钟讲解、个人框架、30 天复习计划",
        },
    ]
    for offset, spec in enumerate(capstone_weeks, start=22):
        week = offset
        start = START_DATE + timedelta(days=(week - 1) * 7)
        end = start + timedelta(days=6)
        weeks.append(
            WeekPlan(
                week=week,
                start_date=start.isoformat(),
                end_date=end.isoformat(),
                phase="综合项目",
                domain="六领域综合",
                title=spec["title"],
                output=spec["output"],
            )
        )
        week_outputs.append(
            {
                "id": f"OUT-W{week:02d}",
                "week": week,
                "phase": "综合项目",
                "type": "综合项目",
                "title": spec["output"],
                "target": "按任务说明",
                "status": "未开始",
            }
        )
        for day_index, (topic, task) in enumerate(spec["tasks"], start=1):
            days.append(
                DayTask(
                    day_number=day_number,
                    date=(start + timedelta(days=day_index - 1)).isoformat(),
                    week=week,
                    phase="综合项目",
                    domain="六领域综合",
                    topic=topic,
                    task=f"10 分钟检查；40 分钟完成“{task}”；10 分钟记录修改理由。",
                    output=topic,
                )
            )
            day_number += 1

    if len(weeks) != 24 or len(days) != 120:
        raise ValueError(f"计划数量错误：{len(weeks)} 周，{len(days)} 天")
    return weeks, days, week_outputs


def write_learning_plan(domains: list[dict], weeks: list[WeekPlan], days: list[DayTask]) -> None:
    end = START_DATE + timedelta(days=24 * 7 - 1)
    lines = [
        "# 跨学科概念系统 24 周学习计划",
        "",
        f"学习周期：{START_DATE.isoformat()} 至 {end.isoformat()}，共 24 周、120 个学习日、120 小时。",
        "",
        "## 学习目标",
        "",
        "- 认识六个领域各 100 个核心概念，总计 600 个。",
        "- 对每个领域 12 个重点概念达到“能解释机制、说明边界、识别反例、迁移案例”的程度。",
        "- 能围绕生活、新闻和组织问题，联用至少两个领域的概念提出有证据的解释。",
        "- 完成个人决策框架、跨领域概念关系图和一次 10 分钟口头讲解。",
        "",
        "## 六个学习维度",
        "",
        "1. 认识：知道概念存在，能判断它大致解释什么。",
        "2. 理解：能用自己的话解释机制，而不复述术语。",
        "3. 应用：能把概念匹配到具体生活、工作或公共案例。",
        "4. 关联：能说明概念之间的因果、对比、条件和层级关系。",
        "5. 批判：能说出适用边界、竞争解释和可能反例。",
        "6. 输出：能用短报告、关系图和口头表达完成迁移。",
        "",
        "## 每日节奏",
        "",
        "- 10 分钟：闭卷回忆前一天重点，写下忘记的内容。",
        "- 35 分钟：完成当天新学习任务。",
        "- 10 分钟：找一个现实案例或反例，检验概念是否真的适用。",
        "- 5 分钟：在 Excel 中记录时间、状态、问题与下次复习日期。",
        "",
        "## 24 周安排",
        "",
        "| 周次 | 日期 | 阶段 | 学习主题 | 本周输出 |",
        "|---|---|---|---|---|",
    ]
    for week in weeks:
        lines.append(
            f"| {week.week} | {week.start_date} 至 {week.end_date} | {week.phase} | {week.title} | {week.output} |"
        )

    lines.extend(
        [
            "",
            "## 120 个每日任务",
            "",
            "| 天数 | 日期 | 周次 | 主题 | 当日任务 | 当日产出 |",
            "|---|---|---|---|---|---|",
        ]
    )
    for day in days:
        lines.append(
            f"| {day.day_number} | {day.date} | {day.week} | {day.topic} | {day.task} | {day.output} |"
        )

    lines.extend(
        [
            "",
            "## 阶段里程碑",
            "",
            "- 第 3、6、9、12、15、18 周：完成领域框架与 20 题随机自测。",
            "- 第 19-21 周：各完成一篇 800-1000 字跨领域案例。",
            "- 第 22 周：锁定结项问题、概念和证据矩阵。",
            "- 第 23 周：完成报告初稿和概念关系图。",
            "- 第 24 周：完成最终稿、口头讲解、个人框架和 30 天复习计划。",
            "",
            "## 中断处理",
            "",
            "- 某日中断：下一次学习先完成 10 分钟回忆，再用 20 分钟补核心任务。",
            "- 某周积压：压缩低优先级 C 级概念的扫描时间，不跳过 A 级重点、周输出和复习。",
            "- 连续中断两周以上：保留原结束日期，优先完成重点卡与阶段输出，C 级概念改为后续补读。",
            "- 不看“读过多少”，只看能否在闭卷、换案例和存在反例时继续使用概念。",
            "",
            "## 评分标准",
            "",
            "| 等级 | 标准 |",
            "|---|---|",
            "| 未掌握 | 只能认出词语，离开原文无法解释。 |",
            "| 认识 | 能说出大致含义和解释对象，但案例与边界模糊。 |",
            "| 理解 | 能说明机制、条件和至少一个正确案例。 |",
            "| 应用 | 能把概念迁移到新案例，并与相邻概念区分。 |",
            "| 能迁移 | 能提出反例、竞争解释，并在跨领域问题中稳定调用。 |",
            "",
            "## 六领域参考资料",
            "",
        ]
    )
    for domain in domains:
        lines.append(f"### {domain['name']}")
        lines.append("")
        for title, use in domain["sources"]:
            lines.append(f"- {title}：{use}")
        lines.append("")

    (PROJECT_DIR / "learning-plan.md").write_text("\n".join(lines), encoding="utf-8")


def write_practice_file(weeks: list[WeekPlan]) -> None:
    lines = [
        "# 练习、复习与综合项目",
        "",
        "## 概念掌握标准",
        "",
        "一个概念只有同时满足以下四项，才从“未接触”升级为“理解”或“应用”：",
        "",
        "1. 能用自己的话解释它解决什么问题。",
        "2. 能指出触发条件、作用过程或可观察结果。",
        "3. 能提出一个与原文不同情境的案例。",
        "4. 能说出至少一个不适用情形、竞争解释或反例。",
        "",
        "## 间隔复习阶梯",
        "",
        "- 首次学习后第 1 天：闭卷解释，不通过则重新阅读深度卡。",
        "- 第 1 天通过后第 7 天：换一个案例并区分易混概念。",
        "- 第 7 天通过后第 30 天：放入跨领域问题，检查是否仍能调用。",
        "- 第 30 天仍通过：标记“能迁移”，在月末复盘中再次抽检。",
        "",
        "## 24 个每周练习",
        "",
        "| 周次 | 练习与输出 |",
        "|---|---|",
    ]
    for week in weeks:
        lines.append(f"| {week.week} | {week.title}；完成：{week.output}。 |")

    lines.extend(
        [
            "",
            "## 每周复盘问题",
            "",
            "1. 本周哪个概念真正改变了我对某个现象的解释？",
            "2. 哪个概念只记住了名字，却说不出机制？",
            "3. 哪一个案例存在替代解释，我还缺什么证据？",
            "4. 本周概念与前面哪个领域形成了新连接？",
            "5. 哪个判断可能受确认偏误、可得性启发或利益激励影响？",
            "6. 下周应减少哪类低价值重复，增加哪类闭卷提取和反例练习？",
            "",
            "## 五类结项选题",
            "",
            "1. 为什么信息更多、选择更多，有时反而让判断更差？",
            "2. 为什么明知长期更有利，仍会重复短期不利行为？",
            "3. 团队中的沉默、冲突和激励如何共同影响决策质量？",
            "4. 平台推荐如何与用户选择共同塑造舆论和社会分层？",
            "5. 新工具或人工智能进入组织后，效率、能力和责任如何重新分配？",
            "",
            "可把选题改写为具体对象和时间，但不能只写宏观口号。结项问题必须包含：受影响对象、需要做出的判断、证据要求和失败条件。",
            "",
            "## 综合项目评分",
            "",
            "| 项目 | 通过标准 |",
            "|---|---|",
            "| 问题 | 具体、可分析、不是概念名词拼接。 |",
            "| 概念 | 至少来自 3 个领域，数量控制在 12-18 个，每个都真正参与解释。 |",
            "| 机制 | 明确说明条件、过程和结果，不只罗列现象。 |",
            "| 证据 | 区分事实、解释、推测和个人经验，标注来源及限制。 |",
            "| 反例 | 包含最强竞争解释，并说明证据如何区分。 |",
            "| 表达 | 3000-5000 字，术语不过载，结论有前提和失败条件。 |",
            "| 口头讲解 | 10 分钟内说清问题、框架、证据、结论和不确定性。 |",
            "",
            "## 每日记录模板",
            "",
            "```text",
            "日期：",
            "今日概念：",
            "一句话解释：",
            "机制或条件：",
            "现实案例：",
            "反例或边界：",
            "仍未解决的问题：",
            "次日 10 分钟回忆题：",
            "```",
            "",
        ]
    )
    (PROJECT_DIR / "practice-and-review.md").write_text("\n".join(lines), encoding="utf-8")


def write_readme(domains: list[dict]) -> None:
    end = START_DATE + timedelta(days=24 * 7 - 1)
    lines = [
        "# 跨学科概念系统学习项目",
        "",
        f"这是一个 24 周、120 小时的自学项目，覆盖社会学、心理学、经济学、传播学、管理学、认知科学，共 600 个概念和 72 张重点概念深度卡。",
        "",
        f"计划周期：{START_DATE.isoformat()} 至 {end.isoformat()}。",
        "",
        "## 第一次使用",
        "",
        "1. 打开 `learning-plan.md`，找到今天的日期和对应任务。",
        "2. 从 `concepts/` 打开当前领域，先阅读当日概念。",
        "3. 按 `practice-and-review.md` 完成案例、反例和复习。",
        "4. 打开 `learning-progress.xlsx`，记录实际分钟、完成状态、掌握状态和最近复习日期。",
        "5. 每周最后一天完成周综合，再阅读一次本周概念关系图。",
        "",
        "## 文件说明",
        "",
        "- `learning-plan.md`：24 周安排、120 个每日任务、里程碑、评分和参考资料。",
        "- `concepts/`：六个领域的概念库与重点概念深度卡。",
        "- `practice-and-review.md`：复习阶梯、每周练习、结项选题和表达要求。",
        "- `learning-progress.xlsx`：学习看板、每日任务、600 概念库、复习队列、周复盘和输出记录。",
        "",
        "## 六领域导航",
        "",
        "| 领域 | 概念数 | 重点卡 | 文件 |",
        "|---|---:|---:|---|",
    ]
    for domain in domains:
        lines.append(
            f"| {domain['name']} | 100 | 12 | [打开](concepts/{domain['file']}) |"
        )

    lines.extend(
        [
            "",
            "## 完成标准",
            "",
            "- 600 个概念至少达到“认识”，72 个 A 级概念至少达到“应用”。",
            "- 六个领域各完成一页概念框架，三次跨领域案例全部完成。",
            "- 结项报告达到 3000-5000 字，能够完成 10 分钟口头讲解。",
            "- 能说明主要概念的机制、案例、易混点、适用边界和至少一个反例。",
            "",
            "## 执行原则",
            "",
            "- 知道名词不等于理解，理解也不等于能使用；状态升级以闭卷解释和换案例应用为准。",
            "- 先扫描全貌，再把时间集中在与生活和工作密切相关的 A 级概念。",
            "- 概念、案例、替代解释和反例必须同时记录。",
            "- 中断不重置进度，优先恢复复习、A 级概念和阶段输出。",
            "",
        ]
    )
    (PROJECT_DIR / "README.md").write_text("\n".join(lines), encoding="utf-8")


def write_build_json(domains: list[dict], weeks: list[WeekPlan], days: list[DayTask], outputs: list[dict]) -> None:
    BUILD_DIR.mkdir(parents=True, exist_ok=True)
    concepts = [asdict(concept) for domain in domains for concept in domain["concepts"]]
    payload = {
        "start_date": START_DATE.isoformat(),
        "end_date": (START_DATE + timedelta(days=24 * 7 - 1)).isoformat(),
        "domains": [
            {
                "code": domain["code"],
                "name": domain["name"],
                "file": domain["file"],
                "sources": domain["sources"],
            }
            for domain in domains
        ],
        "concepts": concepts,
        "weeks": [asdict(week) for week in weeks],
        "days": [asdict(day) for day in days],
        "outputs": outputs,
    }
    (BUILD_DIR / "content.json").write_text(
        json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8"
    )


def main() -> None:
    CONCEPTS_DIR.mkdir(parents=True, exist_ok=True)
    domains = build_domains()
    weeks, days, outputs = build_schedule(domains)
    for domain in domains:
        write_concept_file(domain)
    write_learning_plan(domains, weeks, days)
    write_practice_file(weeks)
    write_readme(domains)
    write_build_json(domains, weeks, days, outputs)
    print(
        json.dumps(
            {
                "domains": len(domains),
                "concepts": sum(len(domain["concepts"]) for domain in domains),
                "deep_cards": sum(
                    1 for domain in domains for concept in domain["concepts"] if concept.priority == "A"
                ),
                "weeks": len(weeks),
                "days": len(days),
            },
            ensure_ascii=False,
        )
    )


if __name__ == "__main__":
    main()
