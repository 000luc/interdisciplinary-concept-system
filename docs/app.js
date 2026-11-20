(() => {
  "use strict";

  const DATA = window.LEARNING_DATA;
  const SITE_META = window.SITE_META || { version: 1 };
  if (!DATA) {
    document.body.innerHTML = '<div class="empty-state">学习数据加载失败，请刷新页面。</div>';
    return;
  }
  const STORAGE_KEY = "interdisciplinary-learning-v1";
  const STATUS_NAMES = ["未接触", "认识", "理解", "应用", "能迁移"];
  const STATUS_INTERVALS = [1, 7, 30, 60, 90];
  const PRIORITY_NAMES = { A: "重点", B: "关联", C: "拓展" };
  const VIEW_META = {
    overview: { title: "总览", kicker: "学习总览" },
    today: { title: "今日学习", kicker: "当前任务" },
    plan: { title: "24 周计划", kicker: "学习路径" },
    library: { title: "概念库", kicker: "600 个概念" },
    review: { title: "复习队列", kicker: "间隔复习" },
    records: { title: "学习记录", kicker: "进度与复盘" },
  };

  const conceptById = new Map(DATA.concepts.map((concept) => [concept.id, concept]));
  const conceptsByDomain = new Map();
  for (const concept of DATA.concepts) {
    if (!conceptsByDomain.has(concept.domain_name)) {
      conceptsByDomain.set(concept.domain_name, []);
    }
    conceptsByDomain.get(concept.domain_name).push(concept);
  }

  const ui = {
    view: "overview",
    libraryQuery: "",
    libraryDomain: "all",
    libraryTheme: "all",
    libraryPriority: "all",
    libraryStatus: "all",
    libraryPage: 1,
    expandedWeek: null,
    recordWeek: null,
    reviewDomain: "all",
    reviewPriority: "all",
    currentConceptId: null,
  };

  let storageAvailable = true;
  let progress = createEmptyProgress();
  let toastTimer = null;
  let canvasObserver = null;

  function createEmptyProgress() {
    return {
      version: 1,
      settings: { startDate: DATA.start_date },
      days: {},
      concepts: {},
      weeks: {},
    };
  }

  function checkStorage() {
    try {
      const testKey = `${STORAGE_KEY}-test`;
      localStorage.setItem(testKey, "1");
      localStorage.removeItem(testKey);
      return true;
    } catch {
      return false;
    }
  }

  function isValidDate(value) {
    return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(parseDate(value).getTime());
  }

  function normalizeProgress(raw) {
    if (!raw || raw.version !== 1) {
      throw new Error("进度文件版本不受支持");
    }
    const normalized = createEmptyProgress();
    if (raw.settings && isValidDate(raw.settings.startDate || "")) {
      normalized.settings.startDate = raw.settings.startDate;
    }
    if (raw.days && typeof raw.days === "object") {
      for (const day of DATA.days) {
        const item = raw.days[String(day.day_number)];
        if (!item || typeof item !== "object") continue;
        normalized.days[String(day.day_number)] = {
          completed: Boolean(item.completed),
          minutes: clampNumber(item.minutes, 0, 1440, 0),
          note: cleanText(item.note, 5000),
        };
      }
    }
    if (raw.concepts && typeof raw.concepts === "object") {
      for (const [id, item] of Object.entries(raw.concepts)) {
        if (!conceptById.has(id) || !item || typeof item !== "object") continue;
        normalized.concepts[id] = {
          status: Math.round(clampNumber(item.status, 0, 4, 0)),
          confidence: Math.round(clampNumber(item.confidence, 0, 5, 0)),
          lastReviewed: isValidDate(item.lastReviewed || "") ? item.lastReviewed : "",
          nextReview: isValidDate(item.nextReview || "") ? item.nextReview : "",
          note: cleanText(item.note, 5000),
        };
      }
    }
    if (raw.weeks && typeof raw.weeks === "object") {
      for (const week of DATA.weeks) {
        const item = raw.weeks[String(week.week)];
        if (!item || typeof item !== "object") continue;
        normalized.weeks[String(week.week)] = {
          gain: cleanText(item.gain, 4000),
          confusion: cleanText(item.confusion, 4000),
          connection: cleanText(item.connection, 4000),
          score: Math.round(clampNumber(item.score, 0, 5, 0)),
          nextAction: cleanText(item.nextAction, 4000),
        };
      }
    }
    return normalized;
  }

  function loadProgress() {
    storageAvailable = checkStorage();
    const warning = document.getElementById("storage-warning");
    if (warning) warning.hidden = storageAvailable;
    if (!storageAvailable) return createEmptyProgress();
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? normalizeProgress(JSON.parse(raw)) : createEmptyProgress();
    } catch {
      return createEmptyProgress();
    }
  }

  function saveProgress() {
    if (!storageAvailable) return false;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
      return true;
    } catch {
      storageAvailable = false;
      document.getElementById("storage-warning").hidden = false;
      showToast("无法保存进度，请先导出备份");
      return false;
    }
  }

  function clampNumber(value, min, max, fallback) {
    const number = Number(value);
    if (!Number.isFinite(number)) return fallback;
    return Math.min(max, Math.max(min, number));
  }

  function cleanText(value, maxLength) {
    return String(value || "").slice(0, maxLength);
  }

  function parseDate(value) {
    return new Date(`${value}T00:00:00`);
  }

  function localDateISO(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function addDays(iso, amount) {
    const date = parseDate(iso);
    date.setDate(date.getDate() + amount);
    return localDateISO(date);
  }

  function formatDate(iso, includeWeekday = true) {
    const date = parseDate(iso);
    const options = { month: "short", day: "numeric" };
    if (includeWeekday) options.weekday = "short";
    return new Intl.DateTimeFormat("zh-CN", options).format(date);
  }

  function formatFullDate(iso) {
    return new Intl.DateTimeFormat("zh-CN", {
      year: "numeric",
      month: "long",
      day: "numeric",
      weekday: "short",
    }).format(parseDate(iso));
  }

  function todayISO() {
    return localDateISO(new Date());
  }

  function adjustedDayDate(dayNumber) {
    const start = progress.settings.startDate;
    const weekOffset = Math.floor((dayNumber - 1) / 5) * 7;
    const weekdayOffset = (dayNumber - 1) % 5;
    return addDays(start, weekOffset + weekdayOffset);
  }

  function currentDayInfo() {
    const start = parseDate(progress.settings.startDate);
    const today = parseDate(todayISO());
    const elapsed = Math.floor((today.getTime() - start.getTime()) / 86400000);
    if (elapsed < 0) {
      return { dayNumber: 1, week: 1, beforeStart: true, afterEnd: false, offset: elapsed };
    }
    if (elapsed >= 168) {
      return { dayNumber: 120, week: 24, beforeStart: false, afterEnd: true, offset: elapsed };
    }
    const week = Math.floor(elapsed / 7) + 1;
    const weekday = elapsed % 7;
    return {
      dayNumber: (week - 1) * 5 + Math.min(weekday + 1, 5),
      week,
      beforeStart: false,
      afterEnd: false,
      offset: elapsed,
    };
  }

  function getDay(dayNumber) {
    return DATA.days.find((day) => day.day_number === dayNumber) || DATA.days[0];
  }

  function getConceptState(id) {
    return progress.concepts[id] || { status: 0, confidence: 0, lastReviewed: "", nextReview: "", note: "" };
  }

  function getDayState(dayNumber) {
    return progress.days[String(dayNumber)] || { completed: false, minutes: 0, note: "" };
  }

  function getWeekState(weekNumber) {
    return (
      progress.weeks[String(weekNumber)] || {
        gain: "",
        confusion: "",
        connection: "",
        score: 0,
        nextAction: "",
      }
    );
  }

  function getStats() {
    const completedDays = DATA.days.filter((day) => getDayState(day.day_number).completed).length;
    const totalMinutes = DATA.days.reduce((sum, day) => sum + Number(getDayState(day.day_number).minutes || 0), 0);
    const statusCounts = [0, 0, 0, 0, 0];
    let touched = 0;
    let masteredA = 0;
    for (const concept of DATA.concepts) {
      const state = getConceptState(concept.id);
      statusCounts[state.status] += 1;
      if (state.status > 0) touched += 1;
      if (concept.priority === "A" && state.status >= 3) masteredA += 1;
    }
    return {
      completedDays,
      totalMinutes,
      statusCounts,
      touched,
      masteredA,
      completionRate: completedDays / DATA.days.length,
    };
  }

  function getDomainStats() {
    return DATA.domains.map((domain, index) => {
      const domainConcepts = conceptsByDomain.get(domain.name) || [];
      const touched = domainConcepts.filter((concept) => getConceptState(concept.id).status > 0).length;
      const masteredA = domainConcepts.filter(
        (concept) => concept.priority === "A" && getConceptState(concept.id).status >= 3,
      ).length;
      return {
        ...domain,
        index,
        total: domainConcepts.length,
        touched,
        masteredA,
        rate: domainConcepts.length ? touched / domainConcepts.length : 0,
      };
    });
  }

  function getReviewBuckets() {
    const today = todayISO();
    const due = [];
    const unscheduled = [];
    for (const concept of DATA.concepts) {
      const state = getConceptState(concept.id);
      if (state.status === 0) continue;
      if (!state.nextReview) {
        unscheduled.push({ concept, state });
        continue;
      }
      if (state.nextReview <= today) {
        const overdueDays = Math.max(
          0,
          Math.floor((parseDate(today).getTime() - parseDate(state.nextReview).getTime()) / 86400000),
        );
        due.push({ concept, state, overdueDays });
      }
    }
    due.sort((a, b) => b.overdueDays - a.overdueDays || a.concept.id.localeCompare(b.concept.id));
    unscheduled.sort((a, b) => a.concept.id.localeCompare(b.concept.id));
    return { due, unscheduled };
  }

  function getRecommendedConcepts(day) {
    const domainConcepts = conceptsByDomain.get(day.domain) || [];
    if (domainConcepts.length) {
      const themeMatch = day.topic.match(/主题\s*(\d+)-(\d+)/);
      if (themeMatch) {
        const start = Number(themeMatch[1]);
        const end = Number(themeMatch[2]);
        const themeNames = new Set(DATA.concepts
          .filter((concept) => concept.domain_name === day.domain)
          .map((concept) => concept.theme)
          .filter((theme, index, list) => list.indexOf(theme) === index)
          .slice(start - 1, end));
        return domainConcepts.filter((concept) => themeNames.has(concept.theme));
      }
      const deepMatch = day.topic.match(/精读\s+(.+)/);
      if (deepMatch) {
        const names = deepMatch[1].split("、").map((name) => name.trim());
        return names.map((name) => domainConcepts.find((concept) => concept.name === name)).filter(Boolean);
      }
      return domainConcepts.filter((concept) => concept.priority === "A").slice(0, 8);
    }
    const offset = (day.week - 1) % 6;
    return DATA.concepts.filter((concept) => concept.priority === "A").slice(offset, offset + 8);
  }

  function conceptStatusBadge(status) {
    return `<span class="badge badge-status-${status}">${STATUS_NAMES[status]}</span>`;
  }

  function priorityBadge(priority) {
    return `<span class="badge badge-priority-${priority.toLowerCase()}">${PRIORITY_NAMES[priority]}</span>`;
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function formatMinutes(minutes) {
    const value = Number(minutes || 0);
    if (value < 60) return `${value} 分钟`;
    const hours = Math.floor(value / 60);
    const remainder = value % 60;
    return remainder ? `${hours} 小时 ${remainder} 分钟` : `${hours} 小时`;
  }

  function showToast(message) {
    const toast = document.getElementById("toast");
    toast.textContent = message;
    toast.hidden = false;
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => {
      toast.hidden = true;
    }, 2600);
  }

  function renderIcons() {
    if (window.lucide) {
      window.lucide.createIcons({
        attrs: { "stroke-width": "1.8", "aria-hidden": "true" },
      });
    }
  }

  function renderShell() {
    const info = currentDayInfo();
    const stats = getStats();
    const reviewCount = getReviewBuckets().due.length;
    const percentage = Math.round(stats.completionRate * 100);
    document.documentElement.dataset.view = ui.view;
    document.querySelectorAll("[data-view-panel]").forEach((panel) => {
      panel.hidden = panel.dataset.viewPanel !== ui.view;
    });
    document.querySelectorAll(".nav-item").forEach((button) => {
      const active = button.dataset.view === ui.view;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-current", active ? "page" : "false");
    });
    document.getElementById("page-title").textContent = VIEW_META[ui.view].title;
    document.getElementById("page-kicker").textContent = VIEW_META[ui.view].kicker;
    document.getElementById("sidebar-week").textContent = `第 ${info.week} 周`;
    document.getElementById("sidebar-progress").textContent = `${percentage}%`;
    document.getElementById("sidebar-progress-bar").style.width = `${percentage}%`;
    document.getElementById("sidebar-date").textContent = info.beforeStart
      ? `距计划开始 ${Math.abs(info.offset)} 天`
      : info.afterEnd
        ? "计划周期已结束"
        : `${formatDate(adjustedDayDate(info.dayNumber))} · 第 ${info.dayNumber} 天`;
    const reviewBadge = document.getElementById("review-nav-count");
    reviewBadge.hidden = reviewCount === 0;
    reviewBadge.textContent = String(reviewCount);
  }

  function renderCurrentView() {
    renderShell();
    if (ui.view === "overview") renderOverview();
    if (ui.view === "today") renderToday();
    if (ui.view === "plan") renderPlan();
    if (ui.view === "library") renderLibrary();
    if (ui.view === "review") renderReview();
    if (ui.view === "records") renderRecords();
    renderIcons();
  }

  function getViewFromHash() {
    const value = window.location.hash.replace("#", "");
    return VIEW_META[value] ? value : "overview";
  }

  function navigate(view) {
    if (!VIEW_META[view]) view = "overview";
    if (getViewFromHash() === view) {
      ui.view = view;
      renderCurrentView();
    } else {
      window.location.hash = view;
    }
  }

  function renderOverview() {
    const info = currentDayInfo();
    const stats = getStats();
    const due = getReviewBuckets().due;
    const domains = getDomainStats();
    const currentWeek = DATA.weeks.find((week) => week.week === info.week);
    const weekDays = DATA.days.filter((day) => day.week === info.week);
    const statusText = info.beforeStart
      ? `距计划开始 ${Math.abs(info.offset)} 天`
      : info.afterEnd
        ? "计划周期已结束"
        : `第 ${info.dayNumber} 个学习日`;

    document.getElementById("view-overview").innerHTML = `
      <div class="page-intro">
        <div>
          <h2>${escapeHtml(currentWeek.title)}</h2>
          <p>${escapeHtml(currentWeek.start_date)} 至 ${escapeHtml(currentWeek.end_date)} · ${escapeHtml(statusText)}</p>
        </div>
        <span class="date-badge">${escapeHtml(formatFullDate(todayISO()))}</span>
      </div>
      <div class="metric-grid">
        ${metricCard("总完成率", `${Math.round(stats.completionRate * 100)}%`, `${stats.completedDays} / 120 个学习日`, true)}
        ${metricCard("累计学习", `${(stats.totalMinutes / 60).toFixed(1)} 小时`, "按实际分钟累计")}
        ${metricCard("已接触概念", String(stats.touched), "共 600 个")}
        ${metricCard("A级掌握", String(stats.masteredA), "目标 72 个")}
        ${metricCard("今日到期", String(due.length), due.length ? "需要安排复习" : "队列已清空")}
        ${metricCard("当前阶段", currentWeek.phase, `第 ${info.week} 周`)}
      </div>
      <div class="dashboard-grid">
        <section class="panel">
          <div class="panel-heading">
            <div>
              <h2>本周学习</h2>
              <p>${escapeHtml(currentWeek.output)}</p>
            </div>
            <button class="panel-link" type="button" data-route="plan">查看完整计划</button>
          </div>
          <ol class="task-list">
            ${weekDays.map((day) => {
              const state = getDayState(day.day_number);
              return `
                <li class="task-preview ${state.completed ? "is-complete" : ""}">
                  <span class="task-index">${state.completed ? '<i data-lucide="check"></i>' : day.day_number}</span>
                  <div>
                    <strong>${escapeHtml(day.topic)}</strong>
                    <p>${escapeHtml(day.task)}</p>
                  </div>
                  <span class="task-duration">${state.completed ? "已完成" : "60 分钟"}</span>
                </li>`;
            }).join("")}
          </ol>
        </section>
        <section class="panel">
          <div class="panel-heading">
            <div>
              <h2>复习提醒</h2>
              <p>${due.length ? `${due.length} 个概念已到期` : "今天没有到期概念"}</p>
            </div>
            <button class="panel-link" type="button" data-route="review">打开队列</button>
          </div>
          ${
            due.length
              ? `<ul class="review-preview-list">
                  ${due.slice(0, 4).map(({ concept, overdueDays }) => `
                    <li class="review-preview">
                      <div>
                        <strong>${escapeHtml(concept.name)}</strong>
                        <span>${escapeHtml(concept.domain_name)} · ${overdueDays ? `逾期 ${overdueDays} 天` : "今日到期"}</span>
                      </div>
                      <button class="button button-small button-quiet" type="button" data-concept-id="${concept.id}">复习</button>
                    </li>`).join("")}
                </ul>`
              : '<div class="empty-state">当前没有需要复习的概念</div>'
          }
        </section>
      </div>
      <section class="panel panel-dark network-panel">
        <div class="panel-heading">
          <div>
            <h2>领域概念网络</h2>
            <p>节点亮度表示已接触概念比例，中央连线表示跨领域调用。</p>
          </div>
          <button class="panel-link" type="button" data-route="library">浏览概念库</button>
        </div>
        <div class="network-layout">
          <div class="network-stage">
            <canvas id="knowledge-canvas" role="img" aria-label="六个领域的学习进度网络图"></canvas>
            <span class="network-caption">概念覆盖率</span>
          </div>
          <div class="domain-list">
            ${domains.map((domain) => `
              <div class="domain-row">
                <div class="domain-row-head">
                  <strong>${escapeHtml(domain.name)}</strong>
                  <span>${domain.touched} / ${domain.total}</span>
                </div>
                <div class="domain-bar">
                  <span style="width:${Math.round(domain.rate * 100)}%;background:${domainColor(domain.index)}"></span>
                </div>
              </div>`).join("")}
          </div>
        </div>
      </section>
    `;

    document.querySelectorAll("#view-overview [data-route]").forEach((button) => {
      button.addEventListener("click", () => navigate(button.dataset.route));
    });
    document.querySelectorAll("#view-overview [data-concept-id]").forEach((button) => {
      button.addEventListener("click", () => openConceptDialog(button.dataset.conceptId));
    });
    requestAnimationFrame(() => setupKnowledgeCanvas(domains));
  }

  function metricCard(label, value, note, accent = false) {
    return `
      <article class="metric-card ${accent ? "metric-card-accent" : ""}">
        <span class="metric-label">${escapeHtml(label)}</span>
        <strong class="metric-value">${escapeHtml(value)}</strong>
        <span class="metric-note">${escapeHtml(note)}</span>
      </article>`;
  }

  function domainColor(index) {
    return ["#61d2bd", "#e4b35c", "#7bb5df", "#d68672", "#b9a6df", "#9fca74"][index] || "#61d2bd";
  }

  function setupKnowledgeCanvas(domains) {
    const canvas = document.getElementById("knowledge-canvas");
    if (!canvas) return;
    if (canvasObserver) canvasObserver.disconnect();
    const draw = () => drawKnowledgeCanvas(canvas, domains);
    canvasObserver = new ResizeObserver(draw);
    canvasObserver.observe(canvas.parentElement);
    draw();
  }

  function drawKnowledgeCanvas(canvas, domains) {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    const context = canvas.getContext("2d");
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.clearRect(0, 0, rect.width, rect.height);

    const center = { x: rect.width / 2, y: rect.height / 2 };
    const radius = Math.max(78, Math.min(rect.width, rect.height) * 0.34);
    const nodes = domains.map((domain, index) => {
      const angle = -Math.PI / 2 + (index * Math.PI * 2) / domains.length;
      return {
        ...domain,
        x: center.x + Math.cos(angle) * radius,
        y: center.y + Math.sin(angle) * radius,
        color: domainColor(index),
      };
    });

    context.lineWidth = 1;
    context.strokeStyle = "rgba(153, 210, 198, 0.22)";
    for (const node of nodes) {
      context.beginPath();
      context.moveTo(center.x, center.y);
      context.lineTo(node.x, node.y);
      context.stroke();
    }
    for (let index = 0; index < nodes.length; index += 1) {
      const next = nodes[(index + 1) % nodes.length];
      context.beginPath();
      context.moveTo(nodes[index].x, nodes[index].y);
      context.lineTo(next.x, next.y);
      context.strokeStyle = "rgba(153, 210, 198, 0.09)";
      context.stroke();
    }

    context.fillStyle = "#173a39";
    context.strokeStyle = "rgba(196, 239, 230, 0.4)";
    context.lineWidth = 1.5;
    context.beginPath();
    context.arc(center.x, center.y, 34, 0, Math.PI * 2);
    context.fill();
    context.stroke();
    context.fillStyle = "#d8fff5";
    context.font = '700 13px "Microsoft YaHei", sans-serif';
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText("概念", center.x, center.y);

    for (const node of nodes) {
      const nodeRadius = 20 + node.rate * 12;
      context.globalAlpha = 0.22;
      context.fillStyle = node.color;
      context.beginPath();
      context.arc(node.x, node.y, nodeRadius + 8, 0, Math.PI * 2);
      context.fill();
      context.globalAlpha = 1;
      context.fillStyle = "#102a2b";
      context.strokeStyle = node.color;
      context.lineWidth = 2.5;
      context.beginPath();
      context.arc(node.x, node.y, nodeRadius, 0, Math.PI * 2);
      context.fill();
      context.stroke();
      context.fillStyle = node.color;
      context.font = '700 12px "Microsoft YaHei", sans-serif';
      context.fillText(`${Math.round(node.rate * 100)}%`, node.x, node.y + 1);
      context.fillStyle = "#d8e9e4";
      context.font = '600 12px "Microsoft YaHei", sans-serif';
      const labelY = node.y > center.y ? node.y + nodeRadius + 18 : node.y - nodeRadius - 13;
      context.fillText(node.name, node.x, labelY);
    }
  }

  function renderToday() {
    const info = currentDayInfo();
    const day = getDay(info.dayNumber);
    const state = getDayState(day.day_number);
    const date = adjustedDayDate(day.day_number);
    const concepts = getRecommendedConcepts(day);
    const statusCopy = info.beforeStart
      ? `计划还有 ${Math.abs(info.offset)} 天开始，当前显示第 1 天预览`
      : info.afterEnd
        ? "计划周期已结束，当前显示第 120 天"
        : `第 ${day.day_number} 个学习日`;
    document.getElementById("view-today").innerHTML = `
      <div class="today-header">
        <div class="today-header-main">
          <span class="section-kicker">${escapeHtml(day.phase)} · 第 ${day.week} 周</span>
          <h2>${escapeHtml(day.topic)}</h2>
          <p>${escapeHtml(formatDate(date))} · ${escapeHtml(statusCopy)}</p>
        </div>
        <div class="day-status">
          <div class="progress-ring" style="--value:${state.completed ? 100 : 0}">
            <strong>${state.completed ? "完成" : "0%"}</strong>
          </div>
          <span class="toolbar-text">${state.completed ? "已记录完成" : "今日目标"}</span>
        </div>
      </div>
      <div class="today-layout">
        <section class="panel">
          <div class="panel-heading">
            <div>
              <h2>60 分钟安排</h2>
              <p>${escapeHtml(day.output)}</p>
            </div>
          </div>
          <div class="daily-steps">
            ${dailyStep("10 分钟", "闭卷回忆", "回忆上一次学习中最容易混淆的两个概念，不先翻资料。")}
            ${dailyStep("35 分钟", "核心任务", day.task)}
            ${dailyStep("10 分钟", "案例迁移", "选一个与资料不同的现实案例，说明机制、边界和一个替代解释。")}
            ${dailyStep("5 分钟", "记录复习", "记录实际分钟、未解决问题，并给下一次复习留一道回忆题。")}
          </div>
          <div class="today-form">
            <div class="two-fields">
              <div class="form-row">
                <label for="today-minutes">实际分钟</label>
                <input class="input" id="today-minutes" type="number" min="0" max="1440" value="${Number(state.minutes || 0)}" />
              </div>
              <div class="form-row">
                <span class="field-label">完成状态</span>
                <button class="button ${state.completed ? "button-quiet" : "button-primary"} button-block" id="toggle-today" type="button">
                  <i data-lucide="${state.completed ? "rotate-ccw" : "check"}"></i>
                  <span>${state.completed ? "取消今日完成" : "标记今日完成"}</span>
                </button>
              </div>
            </div>
            <div class="form-row">
              <label for="today-note">今日笔记</label>
              <textarea class="textarea" id="today-note" placeholder="机制、案例、反例或仍未解决的问题">${escapeHtml(state.note)}</textarea>
            </div>
            <button class="button button-primary" id="save-today" type="button">
              <i data-lucide="save"></i><span>保存今日记录</span>
            </button>
          </div>
        </section>
        <section class="panel">
          <div class="panel-heading">
            <div>
              <h2>今日相关概念</h2>
              <p>${concepts.length} 个概念参与今天的学习</p>
            </div>
          </div>
          <div class="focus-concepts">
            ${concepts.map((concept) => {
              const conceptState = getConceptState(concept.id);
              return `
                <button class="concept-chip" type="button" data-concept-id="${concept.id}">
                  <strong>${escapeHtml(concept.name)}</strong>
                  <span>${escapeHtml(concept.theme)} · ${STATUS_NAMES[conceptState.status]}</span>
                </button>`;
            }).join("")}
          </div>
        </section>
      </div>
    `;
    document.getElementById("save-today").addEventListener("click", () => saveToday(day.day_number));
    document.getElementById("toggle-today").addEventListener("click", () => toggleDay(day.day_number));
    document.querySelectorAll("#view-today [data-concept-id]").forEach((button) => {
      button.addEventListener("click", () => openConceptDialog(button.dataset.conceptId));
    });
  }

  function dailyStep(time, title, copy) {
    return `
      <div class="daily-step">
        <span class="step-time">${escapeHtml(time)}</span>
        <div>
          <h3>${escapeHtml(title)}</h3>
          <p>${escapeHtml(copy)}</p>
        </div>
      </div>`;
  }

  function saveToday(dayNumber) {
    const minutes = clampNumber(document.getElementById("today-minutes").value, 0, 1440, 0);
    const note = cleanText(document.getElementById("today-note").value, 5000);
    const existing = getDayState(dayNumber);
    progress.days[String(dayNumber)] = { ...existing, minutes, note };
    saveProgress();
    renderShell();
    showToast("今日记录已保存");
  }

  function toggleDay(dayNumber) {
    const existing = getDayState(dayNumber);
    const minutesInput = document.getElementById("today-minutes");
    const minutes = minutesInput
      ? clampNumber(minutesInput.value, 0, 1440, existing.minutes || 0)
      : existing.minutes || 0;
    progress.days[String(dayNumber)] = {
      ...existing,
      completed: !existing.completed,
      minutes: minutes || (!existing.completed ? 60 : existing.minutes || 0),
    };
    saveProgress();
    renderCurrentView();
    showToast(progress.days[String(dayNumber)].completed ? "已标记今日完成" : "已取消今日完成");
  }

  function renderPlan() {
    const info = currentDayInfo();
    if (ui.expandedWeek === null) ui.expandedWeek = info.week;
    document.getElementById("view-plan").innerHTML = `
      <div class="page-intro">
        <div>
          <h2>24 周学习路径</h2>
          <p>${escapeHtml(progress.settings.startDate)} 至 ${escapeHtml(addDays(progress.settings.startDate, 167))}</p>
        </div>
        <span class="date-badge">第 ${info.week} 周</span>
      </div>
      <div class="plan-toolbar">
        <span class="toolbar-text">${getStats().completedDays} / 120 个学习日已完成</span>
        <button class="button button-small button-quiet" type="button" data-route="today">进入今日学习</button>
      </div>
      <div class="week-list">
        ${DATA.weeks.map((week) => renderWeekCard(week, info.week)).join("")}
      </div>
    `;
    document.querySelectorAll("#view-plan [data-route]").forEach((button) => {
      button.addEventListener("click", () => navigate(button.dataset.route));
    });
    document.querySelectorAll("#view-plan .week-toggle").forEach((button) => {
      button.addEventListener("click", () => {
        const week = Number(button.dataset.week);
        ui.expandedWeek = ui.expandedWeek === week ? null : week;
        renderPlan();
      });
    });
    document.querySelectorAll("#view-plan [data-check-day]").forEach((button) => {
      button.addEventListener("click", (event) => {
        event.stopPropagation();
        toggleDay(Number(button.dataset.checkDay));
      });
    });
  }

  function renderWeekCard(week, currentWeek) {
    const days = DATA.days.filter((day) => day.week === week.week);
    const completed = days.filter((day) => getDayState(day.day_number).completed).length;
    const expanded = ui.expandedWeek === week.week;
    return `
      <article class="week-card">
        <button class="week-toggle" type="button" data-week="${week.week}" aria-expanded="${expanded}">
          <span class="week-number">第 ${week.week} 周${week.week === currentWeek ? " · 当前" : ""}</span>
          <span class="week-copy">
            <strong>${escapeHtml(week.title)}</strong>
            <span>${escapeHtml(week.start_date)} 至 ${escapeHtml(week.end_date)}</span>
          </span>
          <span class="week-percent">${completed} / 5</span>
          <i class="week-chevron" data-lucide="chevron-down" aria-hidden="true"></i>
        </button>
        <div class="week-body" ${expanded ? "" : "hidden"}>
          <div class="week-output">
            <i data-lucide="flag" aria-hidden="true"></i>
            <span>${escapeHtml(week.output)}</span>
          </div>
          ${days.map((day) => {
            const state = getDayState(day.day_number);
            return `
              <div class="plan-day">
                <button class="check-button ${state.completed ? "is-checked" : ""}" type="button" data-check-day="${day.day_number}" aria-label="${state.completed ? "取消完成" : "标记完成"}第 ${day.day_number} 天">
                  <i data-lucide="check" aria-hidden="true"></i>
                </button>
                <div class="plan-day-copy">
                  <strong>${escapeHtml(day.topic)}</strong>
                  <p>${escapeHtml(day.output)}</p>
                </div>
                <span class="plan-day-date">${escapeHtml(formatDate(adjustedDayDate(day.day_number)))}</span>
              </div>`;
          }).join("")}
        </div>
      </article>`;
  }

  function filteredConcepts() {
    const query = ui.libraryQuery.trim().toLowerCase();
    return DATA.concepts.filter((concept) => {
      const state = getConceptState(concept.id);
      if (ui.libraryDomain !== "all" && concept.domain_name !== ui.libraryDomain) return false;
      if (ui.libraryTheme !== "all" && concept.theme !== ui.libraryTheme) return false;
      if (ui.libraryPriority !== "all" && concept.priority !== ui.libraryPriority) return false;
      if (ui.libraryStatus !== "all" && String(state.status) !== ui.libraryStatus) return false;
      if (!query) return true;
      return [
        concept.name,
        concept.definition,
        concept.example,
        concept.contrast,
        concept.related,
        concept.theme,
        concept.domain_name,
      ].some((value) => String(value).toLowerCase().includes(query));
    });
  }

  function renderLibrary() {
    const themes = DATA.concepts
      .filter((concept) => ui.libraryDomain === "all" || concept.domain_name === ui.libraryDomain)
      .map((concept) => concept.theme)
      .filter((theme, index, list) => list.indexOf(theme) === index);
    if (ui.libraryTheme !== "all" && !themes.includes(ui.libraryTheme)) {
      ui.libraryTheme = "all";
    }
    document.getElementById("view-library").innerHTML = `
      <div class="page-intro">
        <div>
          <h2>跨学科概念库</h2>
          <p>搜索概念、案例、易混点和关联关系；点击结果查看深度卡并更新掌握状态。</p>
        </div>
        <span class="date-badge">${getStats().touched} / 600 已接触</span>
      </div>
      <div class="library-controls">
        <div class="search-wrap">
          <i data-lucide="search" aria-hidden="true"></i>
          <input class="input" id="library-search" type="search" value="${escapeHtml(ui.libraryQuery)}" placeholder="搜索概念、解释、案例或关联" aria-label="搜索概念" />
        </div>
        <select class="select" id="filter-domain" aria-label="按领域筛选">
          <option value="all">全部领域</option>
          ${DATA.domains.map((domain) => `<option value="${escapeHtml(domain.name)}" ${ui.libraryDomain === domain.name ? "selected" : ""}>${escapeHtml(domain.name)}</option>`).join("")}
        </select>
        <select class="select" id="filter-theme" aria-label="按主题筛选">
          <option value="all">全部主题</option>
          ${themes.map((theme) => `<option value="${escapeHtml(theme)}" ${ui.libraryTheme === theme ? "selected" : ""}>${escapeHtml(theme)}</option>`).join("")}
        </select>
        <select class="select" id="filter-priority" aria-label="按优先级筛选">
          <option value="all">全部优先级</option>
          <option value="A" ${ui.libraryPriority === "A" ? "selected" : ""}>A · 重点</option>
          <option value="B" ${ui.libraryPriority === "B" ? "selected" : ""}>B · 关联</option>
          <option value="C" ${ui.libraryPriority === "C" ? "selected" : ""}>C · 拓展</option>
        </select>
        <select class="select" id="filter-status" aria-label="按掌握状态筛选">
          <option value="all">全部状态</option>
          ${STATUS_NAMES.map((status, index) => `<option value="${index}" ${ui.libraryStatus === String(index) ? "selected" : ""}>${status}</option>`).join("")}
        </select>
      </div>
      <div id="library-results"></div>
    `;
    const search = document.getElementById("library-search");
    search.addEventListener("input", () => {
      ui.libraryQuery = search.value;
      ui.libraryPage = 1;
      renderLibraryResults();
    });
    for (const [id, key] of [
      ["filter-domain", "libraryDomain"],
      ["filter-theme", "libraryTheme"],
      ["filter-priority", "libraryPriority"],
      ["filter-status", "libraryStatus"],
    ]) {
      document.getElementById(id).addEventListener("change", (event) => {
        ui[key] = event.target.value;
        ui.libraryPage = 1;
        if (key === "libraryDomain") renderLibrary();
        else renderLibraryResults();
      });
    }
    renderLibraryResults();
  }

  function renderLibraryResults() {
    const container = document.getElementById("library-results");
    if (!container) return;
    const results = filteredConcepts();
    const perPage = 30;
    const pageCount = Math.max(1, Math.ceil(results.length / perPage));
    ui.libraryPage = Math.min(ui.libraryPage, pageCount);
    const start = (ui.libraryPage - 1) * perPage;
    const pageItems = results.slice(start, start + perPage);
    container.innerHTML = `
      <div class="results-summary">
        <span>找到 ${results.length} 个概念</span>
        <button class="button button-small button-quiet" id="clear-library-filters" type="button">清除筛选</button>
      </div>
      ${
        pageItems.length
          ? `<div class="concept-grid">
              ${pageItems.map((concept) => renderConceptCard(concept)).join("")}
            </div>
            <div class="pagination">
              <button class="button button-small button-quiet" type="button" id="library-prev" ${ui.libraryPage <= 1 ? "disabled" : ""}>上一页</button>
              <span class="page-indicator">第 ${ui.libraryPage} / ${pageCount} 页</span>
              <button class="button button-small button-quiet" type="button" id="library-next" ${ui.libraryPage >= pageCount ? "disabled" : ""}>下一页</button>
            </div>`
          : `<div class="empty-state">没有符合当前条件的概念</div>`
      }
    `;
    document.getElementById("clear-library-filters").addEventListener("click", () => {
      ui.libraryQuery = "";
      ui.libraryDomain = "all";
      ui.libraryTheme = "all";
      ui.libraryPriority = "all";
      ui.libraryStatus = "all";
      ui.libraryPage = 1;
      renderLibrary();
    });
    document.querySelectorAll("#library-results [data-concept-id]").forEach((card) => {
      card.addEventListener("click", () => openConceptDialog(card.dataset.conceptId));
      card.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          openConceptDialog(card.dataset.conceptId);
        }
      });
    });
    const previous = document.getElementById("library-prev");
    const next = document.getElementById("library-next");
    if (previous) {
      previous.addEventListener("click", () => {
        ui.libraryPage -= 1;
        renderLibraryResults();
      });
    }
    if (next) {
      next.addEventListener("click", () => {
        ui.libraryPage += 1;
        renderLibraryResults();
      });
    }
    renderIcons();
  }

  function renderConceptCard(concept) {
    const state = getConceptState(concept.id);
    return `
      <article class="concept-card" tabindex="0" role="button" data-concept-id="${concept.id}" aria-label="查看${escapeHtml(concept.name)}详情">
        <span class="concept-meta">
          <span class="concept-code">${concept.id}</span>
          <span class="inline-actions">
            ${priorityBadge(concept.priority)}
            ${conceptStatusBadge(state.status)}
          </span>
        </span>
        <h3>${escapeHtml(concept.name)}</h3>
        <p>${escapeHtml(concept.definition)}</p>
        <span class="concept-card-footer">
          <span>${escapeHtml(concept.domain_name)} · ${escapeHtml(concept.theme)}</span>
          <span>${escapeHtml(concept.related)}</span>
        </span>
      </article>`;
  }

  function renderReview() {
    const buckets = getReviewBuckets();
    const due = buckets.due.filter(({ concept }) => {
      if (ui.reviewDomain !== "all" && concept.domain_name !== ui.reviewDomain) return false;
      if (ui.reviewPriority !== "all" && concept.priority !== ui.reviewPriority) return false;
      return true;
    });
    const unscheduled = buckets.unscheduled.filter(({ concept }) => {
      if (ui.reviewDomain !== "all" && concept.domain_name !== ui.reviewDomain) return false;
      if (ui.reviewPriority !== "all" && concept.priority !== ui.reviewPriority) return false;
      return true;
    });
    document.getElementById("view-review").innerHTML = `
      <div class="page-intro">
        <div>
          <h2>复习队列</h2>
          <p>到期概念优先处理；严重逾期超过 7 天的记录会显示红色提示。</p>
        </div>
        <span class="date-badge">${due.length} 个到期</span>
      </div>
      <div class="review-toolbar">
        <div class="inline-actions">
          <select class="select" id="review-domain" aria-label="复习领域">
            <option value="all">全部领域</option>
            ${DATA.domains.map((domain) => `<option value="${escapeHtml(domain.name)}" ${ui.reviewDomain === domain.name ? "selected" : ""}>${escapeHtml(domain.name)}</option>`).join("")}
          </select>
          <select class="select" id="review-priority" aria-label="复习优先级">
            <option value="all">全部优先级</option>
            <option value="A" ${ui.reviewPriority === "A" ? "selected" : ""}>A · 重点</option>
            <option value="B" ${ui.reviewPriority === "B" ? "selected" : ""}>B · 关联</option>
            <option value="C" ${ui.reviewPriority === "C" ? "selected" : ""}>C · 拓展</option>
          </select>
        </div>
        <span class="toolbar-text">${unscheduled.length} 个概念尚未安排复习</span>
      </div>
      <section class="panel">
        <div class="panel-heading">
          <div>
            <h2>今日到期</h2>
            <p>复习结束后选择真实回忆结果，系统会更新下次日期。</p>
          </div>
        </div>
        ${
          due.length
            ? `<div class="review-list">
                ${due.map(({ concept, state, overdueDays }) => renderReviewItem(concept, state, overdueDays, false)).join("")}
              </div>`
            : '<div class="empty-state">当前筛选下没有到期概念</div>'
        }
      </section>
      <section class="panel" style="margin-top:16px">
        <div class="panel-heading">
          <div>
            <h2>待安排</h2>
            <p>已经学习但还没有设置下次复习日期的概念。</p>
          </div>
        </div>
        ${
          unscheduled.length
            ? `<div class="review-list">
                ${unscheduled.slice(0, 40).map(({ concept, state }) => renderReviewItem(concept, state, 0, true)).join("")}
              </div>`
            : '<div class="empty-state">没有待安排的概念</div>'
        }
      </section>
    `;
    document.getElementById("review-domain").addEventListener("change", (event) => {
      ui.reviewDomain = event.target.value;
      renderReview();
    });
    document.getElementById("review-priority").addEventListener("change", (event) => {
      ui.reviewPriority = event.target.value;
      renderReview();
    });
    document.querySelectorAll("#view-review [data-review-id]").forEach((button) => {
      button.addEventListener("click", () => {
        scheduleReview(button.dataset.reviewId, button.dataset.outcome);
      });
    });
  }

  function renderReviewItem(concept, state, overdueDays, unscheduled) {
    const detail = unscheduled
      ? `${concept.domain_name} · ${STATUS_NAMES[state.status]} · 尚未安排`
      : `${concept.domain_name} · ${overdueDays ? `逾期 ${overdueDays} 天` : "今天到期"}`;
    return `
      <article class="review-item">
        <div class="review-item-main">
          <div class="review-item-head">
            <h3>${escapeHtml(concept.name)}</h3>
            ${priorityBadge(concept.priority)}
            ${overdueDays > 7 ? '<span class="badge badge-overdue">严重逾期</span>' : ""}
          </div>
          <p>${escapeHtml(detail)}</p>
        </div>
        <div class="review-actions">
          <button class="button button-small button-quiet" type="button" data-review-id="${concept.id}" data-outcome="forgot">忘记</button>
          <button class="button button-small button-quiet" type="button" data-review-id="${concept.id}" data-outcome="fuzzy">模糊</button>
          <button class="button button-small button-primary" type="button" data-review-id="${concept.id}" data-outcome="remembered">记住</button>
        </div>
      </article>`;
  }

  function scheduleReview(id, outcome) {
    const concept = conceptById.get(id);
    if (!concept) return;
    const state = { ...getConceptState(id) };
    const today = todayISO();
    let interval = 1;
    if (outcome === "forgot") {
      state.status = Math.max(1, state.status - 1);
      state.confidence = Math.max(1, state.confidence - 1);
      interval = 1;
    } else if (outcome === "fuzzy") {
      state.status = Math.max(1, state.status);
      state.confidence = Math.max(1, state.confidence);
      interval = 3;
    } else {
      state.status = Math.min(4, Math.max(1, state.status));
      state.confidence = Math.min(5, Math.max(1, state.confidence + 1));
      interval = STATUS_INTERVALS[state.status] || 1;
    }
    state.lastReviewed = today;
    state.nextReview = addDays(today, interval);
    progress.concepts[id] = state;
    saveProgress();
    renderCurrentView();
    showToast(`${concept.name} 已安排在 ${formatDate(state.nextReview)} 复习`);
  }

  function renderRecords() {
    const stats = getStats();
    if (ui.recordWeek === null) ui.recordWeek = currentDayInfo().week;
    const record = getWeekState(ui.recordWeek);
    const completedOutputs = new Set();
    for (const week of DATA.weeks) {
      const complete = DATA.days
        .filter((day) => day.week === week.week)
        .every((day) => getDayState(day.day_number).completed);
      if (complete) completedOutputs.add(week.week);
    }
    document.getElementById("view-records").innerHTML = `
      <div class="page-intro">
        <div>
          <h2>学习记录</h2>
          <p>进度保存在当前浏览器；重要节点请导出 JSON 备份。</p>
        </div>
        <span class="date-badge">${formatMinutes(stats.totalMinutes)}</span>
      </div>
      <div class="record-grid">
        <section class="panel">
          <div class="panel-heading">
            <div>
              <h2>概念状态分布</h2>
              <p>${stats.touched} 个概念已接触，${stats.masteredA} 个 A 级概念达到“应用”或以上。</p>
            </div>
          </div>
          <div class="status-grid">
            ${STATUS_NAMES.map((name, index) => `
              <div class="status-stat">
                <span>${name}</span>
                <strong>${stats.statusCounts[index]}</strong>
              </div>`).join("")}
          </div>
          <div class="panel-heading" style="margin-top:22px;margin-bottom:8px">
            <div>
              <h2>输出记录</h2>
              <p>${completedOutputs.size} / 24 个周输出随全部学习日完成。</p>
            </div>
          </div>
          <div class="output-list">
            ${DATA.outputs.map((output) => `
              <div class="output-row">
                <div>
                  <strong>第 ${output.week} 周 · ${escapeHtml(output.title)}</strong>
                  <span>${escapeHtml(output.phase)}</span>
                </div>
                ${completedOutputs.has(output.week) ? '<span class="badge badge-status-3">可归档</span>' : '<span class="badge badge-status-0">未完成</span>'}
              </div>`).join("")}
          </div>
        </section>
        <div class="record-stack">
          <section class="panel">
            <div class="panel-heading">
              <div>
                <h2>每周复盘</h2>
                <p>第 ${ui.recordWeek} 周 · ${escapeHtml(DATA.weeks[ui.recordWeek - 1].title)}</p>
              </div>
            </div>
            <form class="dialog-form" id="week-review-form">
              <div class="form-row">
                <label for="record-week">选择周次</label>
                <select class="select" id="record-week">
                  ${DATA.weeks.map((week) => `<option value="${week.week}" ${week.week === ui.recordWeek ? "selected" : ""}>第 ${week.week} 周 · ${escapeHtml(week.phase)}</option>`).join("")}
                </select>
              </div>
              <div class="form-row">
                <label for="week-gain">最大收获</label>
                <textarea class="textarea" id="week-gain">${escapeHtml(record.gain)}</textarea>
              </div>
              <div class="form-row">
                <label for="week-confusion">最大困惑</label>
                <textarea class="textarea" id="week-confusion">${escapeHtml(record.confusion)}</textarea>
              </div>
              <div class="form-row">
                <label for="week-connection">跨领域连接</label>
                <textarea class="textarea" id="week-connection">${escapeHtml(record.connection)}</textarea>
              </div>
              <div class="two-fields">
                <div class="form-row">
                  <label for="week-score">自评分（0-5）</label>
                  <input class="input" id="week-score" type="number" min="0" max="5" value="${Number(record.score || 0)}" />
                </div>
                <div class="form-row">
                  <label for="week-next-action">下周动作</label>
                  <input class="input" id="week-next-action" value="${escapeHtml(record.nextAction)}" />
                </div>
              </div>
              <button class="button button-primary" type="submit">保存本周复盘</button>
            </form>
          </section>
          <section class="panel">
            <div class="panel-heading">
              <div>
                <h2>数据管理</h2>
                <p>本地进度不会自动上传。</p>
              </div>
            </div>
            <form class="dialog-form" id="start-date-form">
              <div class="form-row">
                <label for="start-date">计划开始日期</label>
                <input class="input" id="start-date" type="date" value="${escapeHtml(progress.settings.startDate)}" />
              </div>
              <button class="button button-quiet" type="submit">更新开始日期</button>
            </form>
            <div class="data-actions" style="margin-top:16px">
              <button class="button button-quiet" id="export-data" type="button">
                <i data-lucide="download"></i><span>导出进度 JSON</span>
              </button>
              <button class="button button-quiet" id="import-data" type="button">
                <i data-lucide="upload"></i><span>导入进度 JSON</span>
              </button>
              <input id="import-file" type="file" accept="application/json,.json" hidden />
              <button class="button button-danger" id="reset-data" type="button">
                <i data-lucide="trash-2"></i><span>清空本地进度</span>
              </button>
              <p class="data-note">数据版本 ${SITE_META.version} · ${escapeHtml(SITE_META.generatedAt || "")}</p>
            </div>
          </section>
        </div>
      </div>
    `;
    document.getElementById("record-week").addEventListener("change", (event) => {
      ui.recordWeek = Number(event.target.value);
      renderRecords();
    });
    document.getElementById("week-review-form").addEventListener("submit", (event) => {
      event.preventDefault();
      progress.weeks[String(ui.recordWeek)] = {
        gain: cleanText(document.getElementById("week-gain").value, 4000),
        confusion: cleanText(document.getElementById("week-confusion").value, 4000),
        connection: cleanText(document.getElementById("week-connection").value, 4000),
        score: Math.round(clampNumber(document.getElementById("week-score").value, 0, 5, 0)),
        nextAction: cleanText(document.getElementById("week-next-action").value, 4000),
      };
      saveProgress();
      showToast("本周复盘已保存");
    });
    document.getElementById("start-date-form").addEventListener("submit", (event) => {
      event.preventDefault();
      const value = document.getElementById("start-date").value;
      if (!isValidDate(value)) {
        showToast("请选择有效的开始日期");
        return;
      }
      progress.settings.startDate = value;
      saveProgress();
      renderCurrentView();
      showToast("计划开始日期已更新");
    });
    document.getElementById("export-data").addEventListener("click", exportProgress);
    document.getElementById("import-data").addEventListener("click", () => {
      document.getElementById("import-file").click();
    });
    document.getElementById("import-file").addEventListener("change", importProgressFile);
    document.getElementById("reset-data").addEventListener("click", () => {
      document.getElementById("confirm-dialog").showModal();
    });
    renderIcons();
  }

  function exportProgress() {
    const blob = new Blob([JSON.stringify(progress, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `learning-progress-${todayISO()}.json`;
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    showToast("进度文件已导出");
  }

  async function importProgressFile(event) {
    const file = event.target.files && event.target.files[0];
    event.target.value = "";
    if (!file) return;
    try {
      const raw = JSON.parse(await file.text());
      progress = normalizeProgress(raw);
      saveProgress();
      renderCurrentView();
      showToast("进度已导入");
    } catch (error) {
      showToast(`导入失败：${error.message}`);
    }
  }

  function openConceptDialog(id) {
    const concept = conceptById.get(id);
    if (!concept) return;
    ui.currentConceptId = id;
    renderConceptDialog(concept);
    const dialog = document.getElementById("concept-dialog");
    if (!dialog.open) dialog.showModal();
    renderIcons();
  }

  function renderConceptDialog(concept) {
    const state = getConceptState(concept.id);
    const container = document.getElementById("concept-dialog-content");
    container.innerHTML = `
      <div class="dialog-heading">
        <div>
          <span class="section-kicker">${concept.id} · ${escapeHtml(concept.domain_name)} · ${escapeHtml(concept.theme)}</span>
          <h2 id="concept-title">${escapeHtml(concept.name)}</h2>
          <p>${priorityBadge(concept.priority)} ${conceptStatusBadge(state.status)}</p>
        </div>
        <button class="icon-button" id="close-concept-dialog" type="button" aria-label="关闭概念详情">
          <i data-lucide="x"></i>
        </button>
      </div>
      <div class="dialog-body">
        <section class="dialog-section">
          <h3>通俗解释</h3>
          <p>${escapeHtml(concept.definition)}</p>
        </section>
        <section class="dialog-section">
          <div class="detail-grid">
            <div class="detail-box">
              <span>现实案例</span>
              <strong>${escapeHtml(concept.example)}</strong>
            </div>
            <div class="detail-box">
              <span>易混概念</span>
              <strong>${escapeHtml(concept.contrast)}</strong>
            </div>
            <div class="detail-box">
              <span>关联概念</span>
              <strong>${escapeHtml(concept.related)}</strong>
            </div>
            <div class="detail-box">
              <span>定位来源</span>
              <strong>${escapeHtml(concept.deep_source || "概念库参考资料")}</strong>
            </div>
          </div>
        </section>
        ${
          concept.deep_mechanism
            ? `<section class="dialog-section">
                <h3>重点概念深度卡</h3>
                <div class="deep-notes">
                  <div class="deep-note"><strong>作用机制：</strong>${escapeHtml(concept.deep_mechanism)}</div>
                  <div class="deep-note"><strong>适用边界：</strong>${escapeHtml(concept.deep_boundary)}</div>
                  <div class="deep-note deep-note-warning"><strong>反例检查：</strong>${escapeHtml(concept.deep_counterexample)}</div>
                </div>
              </section>`
            : ""
        }
        <section class="dialog-section">
          <form class="dialog-form" id="concept-form">
            <div class="two-fields">
              <div class="form-row">
                <label for="concept-status">掌握状态</label>
                <select class="select" id="concept-status">
                  ${STATUS_NAMES.map((name, index) => `<option value="${index}" ${state.status === index ? "selected" : ""}>${name}</option>`).join("")}
                </select>
              </div>
              <div class="form-row">
                <label for="concept-review-date">最近复习日期</label>
                <input class="input" id="concept-review-date" type="date" value="${escapeHtml(state.lastReviewed)}" />
              </div>
            </div>
            <div class="form-row">
              <label for="concept-confidence">信心评分：<span id="confidence-value">${state.confidence || 0}</span> / 5</label>
              <div class="range-row">
                <input id="concept-confidence" type="range" min="0" max="5" step="1" value="${state.confidence || 0}" />
                <span class="range-value" id="range-display">${state.confidence || 0}</span>
              </div>
            </div>
            <div class="form-row">
              <label for="concept-note">个人备注</label>
              <textarea class="textarea" id="concept-note">${escapeHtml(state.note)}</textarea>
            </div>
            <div class="inline-actions">
              <button class="button button-primary" type="submit">保存概念记录</button>
              <button class="button button-quiet" type="button" data-dialog-review="forgot">忘记</button>
              <button class="button button-quiet" type="button" data-dialog-review="fuzzy">模糊</button>
              <button class="button button-quiet" type="button" data-dialog-review="remembered">记住</button>
            </div>
          </form>
        </section>
      </div>
    `;
    document.getElementById("close-concept-dialog").addEventListener("click", () => {
      document.getElementById("concept-dialog").close();
    });
    const confidence = document.getElementById("concept-confidence");
    confidence.addEventListener("input", () => {
      document.getElementById("range-display").textContent = confidence.value;
      document.getElementById("confidence-value").textContent = confidence.value;
    });
    document.getElementById("concept-form").addEventListener("submit", (event) => {
      event.preventDefault();
      const lastReviewed = document.getElementById("concept-review-date").value;
      progress.concepts[concept.id] = {
        status: Number(document.getElementById("concept-status").value),
        confidence: Number(confidence.value),
        lastReviewed: isValidDate(lastReviewed) ? lastReviewed : "",
        nextReview: state.nextReview || "",
        note: cleanText(document.getElementById("concept-note").value, 5000),
      };
      saveProgress();
      renderCurrentView();
      showToast("概念记录已保存");
      document.getElementById("concept-dialog").close();
    });
    document.querySelectorAll("[data-dialog-review]").forEach((button) => {
      button.addEventListener("click", () => {
        scheduleReview(concept.id, button.dataset.dialogReview);
        document.getElementById("concept-dialog").close();
      });
    });
  }

  function setupGlobalEvents() {
    document.querySelectorAll(".nav-item").forEach((button) => {
      button.addEventListener("click", () => navigate(button.dataset.view));
    });
    document.getElementById("quick-today").addEventListener("click", () => navigate("today"));
    document.getElementById("quick-export").addEventListener("click", exportProgress);
    window.addEventListener("hashchange", () => {
      ui.view = getViewFromHash();
      renderCurrentView();
      document.getElementById("main-content").focus({ preventScroll: true });
    });
    const confirmDialog = document.getElementById("confirm-dialog");
    confirmDialog.addEventListener("close", () => {
      if (confirmDialog.returnValue === "confirm") {
        progress = createEmptyProgress();
        saveProgress();
        renderCurrentView();
        showToast("本地进度已清空");
      }
      confirmDialog.returnValue = "";
    });
    document.getElementById("concept-dialog").addEventListener("close", () => {
      ui.currentConceptId = null;
    });
  }

  function init() {
    if (!DATA) {
      document.body.innerHTML = '<div class="empty-state">学习数据加载失败。</div>';
      return;
    }
    progress = loadProgress();
    ui.view = getViewFromHash();
    setupGlobalEvents();
    renderCurrentView();
  }

  init();
})();
