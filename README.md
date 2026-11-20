# 跨学科概念系统学习项目

这是一个 24 周、120 小时的自学项目，覆盖社会学、心理学、经济学、传播学、管理学、认知科学，共 600 个概念和 72 张重点概念深度卡。

计划周期：2026-11-23 至 2027-05-09。

## 在线学习

直接打开学习站：[https://000luc.github.io/interdisciplinary-concept-system/](https://000luc.github.io/interdisciplinary-concept-system/)

在线学习站支持每日任务、600 概念搜索筛选、间隔复习、周复盘及浏览器本地进度。网站不需要登录，个人进度只保存在当前浏览器。

## 第一次使用

1. 打开[在线学习站](https://000luc.github.io/interdisciplinary-concept-system/)，进入“今日学习”。
2. 按当日任务阅读相关概念，并在概念详情中更新掌握状态。
3. 按[练习与复习规则](practice-and-review.md)完成案例、反例和复盘。
4. 需要离线表格时，使用[学习进度工作簿](learning-progress.xlsx)；网页进度可通过 JSON 导入导出。
5. 每周最后一天完成周综合，再阅读一次本周概念关系图。

## 文件说明

- [learning-plan.md](learning-plan.md)：24 周安排、120 个每日任务、里程碑、评分和参考资料。
- [concepts/](concepts/)：六个领域的概念库与重点概念深度卡。
- [practice-and-review.md](practice-and-review.md)：复习阶梯、每周练习、结项选题和表达要求。
- [learning-progress.xlsx](learning-progress.xlsx)：学习看板、每日任务、600 概念库、复习队列、周复盘和输出记录。

## 本地预览与重新生成

```bash
python -m http.server 8765 --directory docs
```

打开 `http://127.0.0.1:8765/`。

内容更新后重新生成数据和检查：

```bash
python scripts/build_materials.py
python scripts/build_site_data.py
python scripts/validate_site.py
```

## 六领域导航

| 领域 | 概念数 | 重点卡 | 文件 |
|---|---:|---:|---|
| 社会学 | 100 | 12 | [打开](concepts/01-sociology.md) |
| 心理学 | 100 | 12 | [打开](concepts/02-psychology.md) |
| 经济学 | 100 | 12 | [打开](concepts/03-economics.md) |
| 传播学 | 100 | 12 | [打开](concepts/04-communication.md) |
| 管理学 | 100 | 12 | [打开](concepts/05-management.md) |
| 认知科学 | 100 | 12 | [打开](concepts/06-cognitive-science.md) |

## 完成标准

- 600 个概念至少达到“认识”，72 个 A 级概念至少达到“应用”。
- 六个领域各完成一页概念框架，三次跨领域案例全部完成。
- 结项报告达到 3000-5000 字，能够完成 10 分钟口头讲解。
- 能说明主要概念的机制、案例、易混点、适用边界和至少一个反例。

## 执行原则

- 知道名词不等于理解，理解也不等于能使用；状态升级以闭卷解释和换案例应用为准。
- 先扫描全貌，再把时间集中在与生活和工作密切相关的 A 级概念。
- 概念、案例、替代解释和反例必须同时记录。
- 中断不重置进度，优先恢复复习、A 级概念和阶段输出。
