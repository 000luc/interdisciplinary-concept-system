# 跨学科概念学习站实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将现有学习资料发布为可在 GitHub Pages 在线使用、具有本地进度和概念检索能力的静态学习站。

**Architecture:** 使用 `docs/` 下的无构建静态 HTML、CSS 和 JavaScript。`scripts/build_site_data.py` 把现有 `content.json` 转为浏览器可直接加载的 `docs/data.js`；`app.js` 统一管理路由、`localStorage`、概念筛选、复习和表单；GitHub Pages 从 `main` 分支 `/docs` 发布。

**Tech Stack:** HTML5、CSS、原生 JavaScript、Canvas 2D、Python 标准库、Playwright CLI、GitHub Pages。

---

### Task 1: 生成站点数据与静态校验

**Files:**
- Create: `scripts/build_site_data.py`
- Create: `scripts/validate_site.py`
- Create: `docs/data.js`
- Modify: `.gitignore`

- [ ] **Step 1: 写数据生成器**

读取 `scripts/build/content.json`，原样放入 `window.LEARNING_DATA`，同时生成 `siteMeta`，包含生成时间和版本 `1`。输出使用 UTF-8。

- [ ] **Step 2: 写静态校验器**

检查 `docs/data.js` 中 600 个概念、120 个学习日、24 周、24 个输出；检查六个领域各 100 个概念、72 个 `A` 级概念；检查 HTML 引用的本地文件存在；检查源码中无 `C:\\Users\\`、`D:\\BaiduSyncdisk\\` 等本机路径。

- [ ] **Step 3: 运行生成和校验**

Run: `python scripts/build_site_data.py`

Run: `python scripts/validate_site.py`

Expected: 输出 `site_data_ok 600 120 24 72`。

- [ ] **Step 4: 提交**

```bash
git add .gitignore scripts/build_site_data.py scripts/validate_site.py docs/data.js
git commit -m "feat: add learning site data pipeline"
```

### Task 2: 建立应用骨架与设计系统

**Files:**
- Create: `docs/index.html`
- Create: `docs/styles.css`
- Create: `docs/.nojekyll`

- [ ] **Step 1: 创建语义化 HTML**

建立侧栏、顶部栏、六个视图容器、概念详情对话框、确认对话框、Toast、数据状态提示和脚本入口。所有按钮有清晰文字或 `aria-label`。

- [ ] **Step 2: 建立响应式视觉系统**

使用深墨、暖白、青绿和琥珀配色；正文不小于 16px；卡片圆角不超过 8px；桌面使用侧栏，手机改为顶部横向导航。所有交互控件触控高度不小于 44px。

- [ ] **Step 3: 检查静态结构**

Run: `python scripts/validate_site.py`

Expected: HTML 必要 ID、脚本和样式文件全部存在。

- [ ] **Step 4: 提交**

```bash
git add docs/index.html docs/styles.css docs/.nojekyll
git commit -m "feat: add learning site shell"
```

### Task 3: 实现状态、路由与通用渲染

**Files:**
- Create: `docs/app.js`

- [ ] **Step 1: 建立本地状态接口**

实现 `createEmptyProgress()`、`loadProgress()`、`saveProgress()`、`updateDay()`、`updateConcept()`、`updateWeek()`、`importProgress()`、`exportProgress()` 和 `resetProgress()`。默认计划开始日期来自 `LEARNING_DATA.start_date`。

- [ ] **Step 2: 建立路由**

支持 `#overview`、`#today`、`#plan`、`#library`、`#review`、`#records`。刷新页面保留当前视图，未知 hash 回到总览。

- [ ] **Step 3: 建立计算层**

实现当前学习日、日期偏移、完成率、领域统计、到期复习、状态标签和格式化函数。日期早于开始日时定位第 1 天，晚于结束日时定位第 120 天。

- [ ] **Step 4: 执行语法检查**

Run: `node --check docs/app.js`

Expected: 无输出并返回 0。

- [ ] **Step 5: 提交**

```bash
git add docs/app.js
git commit -m "feat: add learning state and routing"
```

### Task 4: 实现六个学习视图

**Files:**
- Modify: `docs/index.html`
- Modify: `docs/styles.css`
- Modify: `docs/app.js`

- [ ] **Step 1: 总览与知识网络**

渲染指标、当前周、领域进度和 Canvas 六节点网络。Canvas 使用设备像素比缩放，节点亮度与覆盖率绑定，尺寸随窗口变化。

- [ ] **Step 2: 今日学习**

显示当前日、60 分钟任务、输出和当日相关概念；允许完成任务、填写实际分钟和笔记。

- [ ] **Step 3: 24 周计划**

渲染 24 周和 120 个每日任务；支持展开、完成切换和每周输出展示。

- [ ] **Step 4: 概念库**

实现全文搜索、领域/主题/优先级/状态筛选、30 条分页和概念详情对话框；详情中可更新状态、信心评分、最近复习日期和备注。

- [ ] **Step 5: 复习队列**

计算待安排、今日到期和严重逾期概念；实现忘记、模糊、记住三种复习动作及对应下次复习间隔。

- [ ] **Step 6: 学习记录**

实现周复盘表单、开始日期调整、统计、JSON 导入导出和二次确认清空。

- [ ] **Step 7: 运行静态检查与语法检查**

Run: `node --check docs/app.js`

Run: `python scripts/validate_site.py`

Expected: 两项均返回 0。

- [ ] **Step 8: 提交**

```bash
git add docs/index.html docs/styles.css docs/app.js
git commit -m "feat: implement interactive learning views"
```

### Task 5: 更新仓库入口与部署配置

**Files:**
- Modify: `README.md`

- [ ] **Step 1: 增加在线入口**

README 首屏加入 `https://000luc.github.io/interdisciplinary-concept-system/`，并把 Markdown、Excel 和脚本说明改为可点击链接。

- [ ] **Step 2: 本地预览**

Run: `python -m http.server 8765 --directory docs`

Open: `http://127.0.0.1:8765/`

Expected: HTTP 200，页面加载 600 个概念。

- [ ] **Step 3: 提交**

```bash
git add README.md
git commit -m "docs: link online learning site"
```

### Task 6: Playwright 验收

**Files:**
- Create: `output/playwright/desktop-overview.png`
- Create: `output/playwright/mobile-library.png`

- [ ] **Step 1: 桌面验证**

以 1440×1000 打开本地页；切换六个视图；搜索“框架效应”；打开详情；更新为“理解”并设信心 4；刷新页面确认状态保留。

- [ ] **Step 2: 手机验证**

以 390×844 打开；确认导航可滚动、概念库可筛选、详情对话框不溢出、按钮可点击。

- [ ] **Step 3: 导入导出验证**

导出 JSON，清空后导入同一文件，确认学习日、概念和复盘记录恢复。

- [ ] **Step 4: 视觉检查**

检查截图中的文字截断、重叠、横向滚动、空白画布和遮挡；发现问题后修复并重复相关验证。

- [ ] **Step 5: 提交 QA 修复**

```bash
git add docs
git commit -m "fix: polish learning site from browser QA"
```

### Task 7: 发布 GitHub Pages

**Files:**
- No source changes expected.

- [ ] **Step 1: 推送**

Run: `git push origin main`

Expected: 远端 `main` 与本地提交一致。

- [ ] **Step 2: 启用 Pages**

通过 GitHub API 将 Pages 来源设为 `main` 与 `/docs`。

- [ ] **Step 3: 等待部署并验证线上页面**

轮询 Pages 构建；访问 `https://000luc.github.io/interdisciplinary-concept-system/`，完成一次搜索和状态更新。

- [ ] **Step 4: 完成**

报告线上地址、提交哈希、验证结果和仍存在的限制。
