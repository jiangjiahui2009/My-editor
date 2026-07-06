/* ========================================
   我的主编 — Widget 拖拽系统
   ======================================== */

// --- State ---
const STATE = {
  config: { endpoint: "", api_key: "", model: "" },
  result: null,
  loading: false,
  widgetLayout: { middle: ["correction", "rewrite"], right: ["summary"], dock: [] },
  customStyles: {},
};

const LS_KEY = "zhubian_config";
const HIST_KEY = "zhubian_history";
const LAYOUT_KEY = "zhubian_layout";
const STYLES_KEY = "zhubian_styles";
const HIST_MAX = 50;

const WIDGET_LABELS = { correction: "细节纠错 + 延伸思考", rewrite: "风格改写", summary: "整体总结 + 评价反馈" };
const WIDGET_SHORT = { correction: "细节纠错", rewrite: "风格改写", summary: "整体总结" };

// Built-in style definitions (synced with editor_prompt.py)
const BUILTIN_STYLES = {
  yu_hua: { name: "余华", desc: "余华风格：极简、冷静、克制。用最少的词说最多的事。短句铺陈，不加修饰，不煽情，让事实本身产生力量。对话简短有力。拒绝形容词和副词，拒绝心理描写，用行动和对话推进一切。" },
  mo_yan: { name: "莫言", desc: "莫言风格：感官全开、意象密集、语言浓烈。大量使用通感——声音有颜色、气味有形状。细节铺排到极致，比喻天马行空。魔幻与现实交织，乡土气息浓重，语言有粗粝的力量感。" },
  murakami: { name: "村上春树", desc: "村上春树风格：简约、疏离、都市感。用平静的口吻讲述不平静的事。细节精确到品牌和数字，营造陌生感。大量使用第一人称，语调保持一定距离感。意象跳跃，留白很多。音乐（爵士/古典）常常出现。" },
  wang_xiaobo: { name: "王小波", desc: "王小波风格：犀利、幽默、黑色反讽。用玩笑说真理。逻辑推演到荒谬的极端。大量的我觉得、我想到，但背后是严密的思辨。语言口语化但有节奏感，时常出现理工科比喻。" },
  zhang_ailing: { name: "张爱玲", desc: "张爱玲风格：细腻、苍凉、比喻精妙。对人情世故有手术刀般的洞察力。比喻常常出入意表，将日常物件与宏大情感并置。语言华丽但不堆砌，有旧小说的韵味。情感描写绵密，善于写不彻底的人。" },
  wang_zengqi: { name: "汪曾祺", desc: "汪曾祺风格：平淡、有味、生活气息浓郁。白描手法，不着力，不渲染。写日常小事但能写出趣味和滋味。语言干净，有节奏感，像在聊天。对食物、植物、手艺人有特别的关注，文字里透着人情味。" },
};

// --- DOM Helpers ---
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

// --- Icon ---
const ICON_COUNT = 5;

function cycleIcon() {
  const icon = $("#logoIcon");
  if (!icon) return;
  const n = Math.floor(Math.random() * ICON_COUNT) + 1;
  const filename = String(n).padStart(2, "0") + ".png";
  // Avoid same icon twice in a row
  if (icon.dataset.current === filename) {
    const next = (n % ICON_COUNT) + 1;
    icon.src = "/icon/" + String(next).padStart(2, "0") + ".png";
    icon.dataset.current = String(next).padStart(2, "0") + ".png";
  } else {
    icon.src = "/icon/" + filename;
    icon.dataset.current = filename;
  }
}

// ============================================================
//  Init & Config
// ============================================================

function init() {
  loadConfig();
  loadLayout();
  loadCustomStyles();
  loadLogoName();
  initWidgets();
  bindEvents();
  updateHistoryIndicator();
  cycleIcon();
}

// --- Logo Inline Edit ---
const LOGO_NAME_KEY = "zhubian_logo_name";
const DEFAULT_LOGO_NAME = "我的主编";

function loadLogoName() {
  const saved = localStorage.getItem(LOGO_NAME_KEY);
  if (saved) {
    $(".logo").textContent = saved;
    document.title = saved + " — AI 写作教练";
  }
}

function startLogoEdit() {
  const logo = $(".logo");
  const input = document.createElement("input");
  input.type = "text";
  input.className = "logo-input";
  input.value = logo.textContent;

  const finish = () => {
    const newName = input.value.trim() || DEFAULT_LOGO_NAME;
    localStorage.setItem(LOGO_NAME_KEY, newName);
    logo.textContent = newName;
    document.title = newName + " — AI 写作教练";
    logo.style.display = "";
    input.remove();
  };

  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); finish(); }
    if (e.key === "Escape") { input.value = DEFAULT_LOGO_NAME; finish(); }
  });
  input.addEventListener("blur", finish);

  logo.style.display = "none";
  logo.parentNode.insertBefore(input, logo.nextSibling);
  input.focus();
  input.select();
}

function loadConfig() {
  try { const raw = localStorage.getItem(LS_KEY); if (raw) STATE.config = JSON.parse(raw); } catch (_) {}
  if (STATE.config.endpoint) $("#apiEndpoint").value = STATE.config.endpoint;
  if (STATE.config.api_key) $("#apiKey").value = STATE.config.api_key;
  if (STATE.config.model) $("#modelName").value = STATE.config.model;
}

function saveConfig() {
  STATE.config.endpoint = $("#apiEndpoint").value.trim();
  STATE.config.api_key = $("#apiKey").value.trim();
  STATE.config.model = $("#modelName").value.trim();
  localStorage.setItem(LS_KEY, JSON.stringify(STATE.config));
}

// ============================================================
//  Layout Persistence
// ============================================================

function loadLayout() {
  try {
    const raw = localStorage.getItem(LAYOUT_KEY);
    if (raw) STATE.widgetLayout = JSON.parse(raw);
  } catch (_) {}
}

function saveLayout() {
  localStorage.setItem(LAYOUT_KEY, JSON.stringify(STATE.widgetLayout));
}

// ============================================================
//  Style Management
// ============================================================

function loadCustomStyles() {
  try {
    const raw = localStorage.getItem(STYLES_KEY);
    if (raw) STATE.customStyles = JSON.parse(raw);
  } catch (_) { STATE.customStyles = {}; }
}

function saveCustomStyles() {
  localStorage.setItem(STYLES_KEY, JSON.stringify(STATE.customStyles));
}

function getAllStyles() {
  const all = {};
  Object.assign(all, BUILTIN_STYLES);
  Object.assign(all, STATE.customStyles);
  return all;
}

function getStyleLabel(key) {
  const s = getAllStyles()[key];
  if (!s) return key;
  const brief = s.desc.replace(s.name + "风格：", "").replace(s.name + "：", "").substring(0, 10);
  return brief + " · " + s.name;
}

function isBuiltinStyle(key) {
  return key in BUILTIN_STYLES;
}

function isCustomStyle(key) {
  return key in STATE.customStyles;
}

// ============================================================
//  Widget Initialization
// ============================================================

function initWidgets() {
  const layout = STATE.widgetLayout;

  // Place into middle column
  (layout.middle || []).forEach(type => placeWidget(type, "dropMiddle"));
  // Place into right column
  (layout.right || []).forEach(type => placeWidget(type, "dropRight"));
  // Place into dock
  (layout.dock || []).forEach(type => placeWidget(type, "headerDock"));

  updateDockChips();
  updateDropZoneStates();
}

function placeWidget(type, zoneId) {
  const tmpl = document.getElementById("tmpl" + type.charAt(0).toUpperCase() + type.slice(1));
  if (!tmpl) return null;

  const clone = tmpl.content.firstElementChild.cloneNode(true);
  const zone = document.getElementById(zoneId);
  if (!zone) return null;

  // Drag events on the card
  clone.addEventListener("dragstart", handleDragStart);
  clone.addEventListener("dragend", handleDragEnd);

  // Widget-specific wiring
  if (type === "rewrite") wireRewriteWidget(clone);

  // Titlebar copy button
  const titlebarCopyBtn = clone.querySelector(".widget-titlebar-copy-btn");
  if (titlebarCopyBtn) titlebarCopyBtn.addEventListener("click", () => copyWidgetContent(clone));

  zone.appendChild(clone);
  return clone;
}

function resetAllWidgets() {
  ["correction", "summary"].forEach(type => {
    const card = document.querySelector(`[data-widget="${type}"]`);
    if (card) {
      card.querySelector(".widget-body").innerHTML =
        '<div class="widget-empty">分析完成后这里将显示结果</div>';
    }
  });
}

// ============================================================
//  Drag & Drop
// ============================================================

function handleDragStart(e) {
  const card = e.target.closest(".widget-card");
  if (!card) return;
  e.dataTransfer.setData("text/plain", card.dataset.widget);
  e.dataTransfer.effectAllowed = "move";
  card.classList.add("dragging");
}

function handleDragEnd(e) {
  const card = e.target.closest(".widget-card");
  if (card) card.classList.remove("dragging");
  document.querySelectorAll(".drag-over").forEach(el => el.classList.remove("drag-over"));
}

function handleDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = "move";
  e.currentTarget.classList.add("drag-over");
}

function handleDragLeave(e) {
  if (!e.currentTarget.contains(e.relatedTarget)) {
    e.currentTarget.classList.remove("drag-over");
  }
}

function handleDrop(e) {
  e.preventDefault();
  e.currentTarget.classList.remove("drag-over");

  const widgetType = e.dataTransfer.getData("text/plain");
  if (!widgetType) return;

  const card = document.querySelector(`.widget-card.dragging[data-widget="${widgetType}"]`);
  if (!card) return;

  e.currentTarget.appendChild(card);
  updateLayoutFromDOM();
}

function updateLayoutFromDOM() {
  const layout = { middle: [], right: [], dock: [] };

  const midCards = $("#dropMiddle").querySelectorAll(":scope > .widget-card");
  midCards.forEach(c => layout.middle.push(c.dataset.widget));

  const rightCards = $("#dropRight").querySelectorAll(":scope > .widget-card");
  rightCards.forEach(c => layout.right.push(c.dataset.widget));

  const dockCards = $("#headerDock").querySelectorAll(":scope > .widget-card");
  dockCards.forEach(c => layout.dock.push(c.dataset.widget));

  STATE.widgetLayout = layout;
  saveLayout();
  updateDockChips();
  updateDropZoneStates();
}

function updateDropZoneStates() {
  ["dropMiddle", "dropRight"].forEach(id => {
    const zone = document.getElementById(id);
    if (!zone) return;
    const count = zone.querySelectorAll(":scope > .widget-card").length;
    zone.classList.toggle("has-widgets", count > 0);
  });
}

// ============================================================
//  Dock Chips
// ============================================================

function updateDockChips() {
  const dock = $("#headerDock");
  // Remove existing chips
  dock.querySelectorAll(".dock-chip").forEach(c => c.remove());

  const dockedTypes = STATE.widgetLayout.dock || [];
  dock.classList.toggle("has-chips", dockedTypes.length > 0);

  dockedTypes.forEach(type => {
    const chip = document.createElement("span");
    chip.className = "dock-chip";
    chip.dataset.widget = type;
    chip.innerHTML = `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg> ${WIDGET_SHORT[type] || type}`;
    chip.addEventListener("click", () => restoreFromDock(type));
    dock.appendChild(chip);
  });
}

function restoreFromDock(type) {
  // Find the widget card in the dock
  const card = document.querySelector(`#headerDock > [data-widget="${type}"]`);
  if (!card) return;

  // Find the best drop zone: prefer the one with fewer widgets
  const midCount = ($("#dropMiddle").querySelectorAll(":scope > .widget-card")).length;
  const rightCount = ($("#dropRight").querySelectorAll(":scope > .widget-card")).length;

  const target = midCount <= rightCount ? $("#dropMiddle") : $("#dropRight");
  target.appendChild(card);
  updateLayoutFromDOM();
  showToast(`「${WIDGET_SHORT[type]}」已放回面板`);
}

// ============================================================
//  Rewrite Widget
// ============================================================

function wireRewriteWidget(card) {
  const btn = card.querySelector(".rewrite-btn");
  if (btn) btn.addEventListener("click", () => handleRewrite(card));

  // Titlebar copy button
  const copyBtn = card.querySelector(".rewrite-copy-btn");
  if (copyBtn) copyBtn.addEventListener("click", () => copyWidgetContent(card));

  // Populate style menu dynamically
  populateStyleMenu(card);

  // Custom style dropdown
  const dropdown = card.querySelector(".rewrite-style-dropdown");
  const menu = card.querySelector(".rewrite-style-menu");
  const label = card.querySelector(".rewrite-style-label");
  const toggle = card.querySelector(".rewrite-style-btn");

  if (toggle && menu) {
    toggle.addEventListener("click", (e) => {
      e.stopPropagation();
      menu.classList.toggle("hidden");
      dropdown.classList.toggle("open");
    });

    menu.addEventListener("click", (e) => {
      const li = e.target.closest("li");
      if (!li) return;
      const value = li.dataset.value;
      label.textContent = li.textContent;
      menu.querySelectorAll("li").forEach(l => l.classList.remove("selected"));
      li.classList.add("selected");
      menu.classList.add("hidden");
      dropdown.classList.remove("open");
    });
  }
}

function populateStyleMenu(card) {
  const menu = card.querySelector(".rewrite-style-menu");
  if (!menu) return;

  const allStyles = getAllStyles();
  const keys = Object.keys(allStyles);
  if (keys.length === 0) return;

  menu.innerHTML = keys.map((key, i) => {
    const s = allStyles[key];
    const label = getStyleLabel(key);
    const selected = i === 0 ? ' class="selected"' : "";
    return `<li data-value="${key}"${selected}>${escapeHTML(label)}</li>`;
  }).join("");

  // Update the label span to match the selected item
  const label = card.querySelector(".rewrite-style-label");
  if (label && keys.length > 0) {
    label.textContent = getStyleLabel(keys[0]);
  }
}

async function handleRewrite(card, silent) {
  const article = ($("#articleInput").textContent || "").trim();
  if (!article) {
    if (!silent) showToast("请先粘贴文章内容");
    return;
  }

  saveConfig();
  if (!STATE.config.endpoint || !STATE.config.api_key || !STATE.config.model) {
    if (!silent) { $("#configOverlay").classList.remove("hidden"); showToast("请先配置 API 信息"); }
    return;
  }

  const selected = card.querySelector(".rewrite-style-menu li.selected");
  const style = selected ? selected.dataset.value : "yu_hua";

  // Build request body with custom style support
  const body = { article, style, config: STATE.config };
  const allStyles = getAllStyles();
  if (isCustomStyle(style)) {
    body.style_name = allStyles[style].name;
    body.style_desc = allStyles[style].desc;
  }

  // UI: show loading
  const emptyEl = card.querySelector(".rewrite-empty");
  const loadingEl = card.querySelector(".rewrite-loading");
  const resultEl = card.querySelector(".rewrite-result");

  if (emptyEl) emptyEl.classList.add("hidden");
  if (loadingEl) loadingEl.classList.remove("hidden");
  if (resultEl) resultEl.classList.add("hidden");

  try {
    const resp = await fetch("/api/rewrite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await resp.json();

    if (!resp.ok) {
      showToast(data.error || `改写失败 (${resp.status})`);
      if (loadingEl) loadingEl.classList.add("hidden");
      if (emptyEl) emptyEl.classList.remove("hidden");
      return;
    }

    if (resultEl) {
      resultEl.innerHTML = marked.parse(data.content);
      resultEl.classList.remove("hidden");
    }
  } catch (err) {
    showToast(`网络错误：${err.message}`);
    if (emptyEl) emptyEl.classList.remove("hidden");
  } finally {
    if (loadingEl) loadingEl.classList.add("hidden");
  }
}

// ============================================================
//  Copy
// ============================================================

function copyWidgetContent(card) {
  const body = card.querySelector(".widget-body");
  const text = (body?.textContent || "").trim();
  if (!text) { showToast("暂无内容可复制"); return; }
  copyToClipboard(text, "已复制");
}

async function copyToClipboard(text, msg) {
  try {
    await navigator.clipboard.writeText(text);
    showToast(msg);
  } catch (_) {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.cssText = "position:fixed;opacity:0;";
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    document.body.removeChild(ta);
    showToast(msg);
  }
}

// ============================================================
//  Analysis
// ============================================================

async function analyze() {
  const article = ($("#articleInput").textContent || "").trim();
  if (!article) { showToast("请先粘贴文章内容"); return; }

  saveConfig();
  if (!STATE.config.endpoint || !STATE.config.api_key || !STATE.config.model) {
    $("#configOverlay").classList.remove("hidden");
    showToast("请先配置 API 信息");
    return;
  }

  STATE.result = null;
  setLoading(true);

  try {
    const resp = await fetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ article, config: STATE.config, article_type: getArticleType() }),
    });

    const data = await resp.json();

    if (!resp.ok) {
      showError(data.error || `请求失败 (${resp.status})`);
      return;
    }

    STATE.result = data;
    renderResults();
    annotateArticle();
    saveToHistory(article);
    cycleIcon();

    // Auto-trigger rewrite after analysis
    const rewriteCard = document.querySelector('[data-widget="rewrite"]');
    if (rewriteCard) handleRewrite(rewriteCard, true);
  } catch (err) {
    showError(`网络错误：${err.message}`);
  } finally {
    setLoading(false);
  }
}

let loadingTimer = null;

function setLoading(active) {
  STATE.loading = active;
  const btn = $("#analyzeBtn");

  if (active) {
    btn.classList.add("loading");
    btn.disabled = true;

    // Show loading spinners in correction + summary widgets
    ["correction", "summary"].forEach(type => {
      const card = document.querySelector(`[data-widget="${type}"]`);
      if (card) {
        card.querySelector(".widget-body").innerHTML =
          '<div class="rewrite-loading"><div class="loading-spinner"></div><p>分析中...</p></div>';
      }
    });

    loadingTimer = setTimeout(() => {
      // Could update to "still waiting" if needed
    }, 15000);
  } else {
    btn.classList.remove("loading");
    btn.disabled = false;
    if (loadingTimer) { clearTimeout(loadingTimer); loadingTimer = null; }
  }
}

function renderResults() {
  if (!STATE.result) return;

  // Correction widget: sections 2 (细节纠错) + 3 (延伸思考)
  renderIntoWidget("correction", [STATE.result.sections[2], STATE.result.sections[3]]);

  // Summary widget: sections 0 (整体总结) + 1 (评价反馈)
  renderIntoWidget("summary", [STATE.result.sections[0], STATE.result.sections[1]]);
}

function renderIntoWidget(widgetType, sections) {
  const card = document.querySelector(`[data-widget="${widgetType}"]`);
  if (!card) return;

  const body = card.querySelector(".widget-body");
  if (!body) return;

  const html = sections.map(s => {
    const cleaned = s.content.replace(/^##\s+[一二三四]、[^\n]*\n?/, "").trim();
    return marked.parse(cleaned);
  }).join("\n<hr>\n");

  body.innerHTML = html;
  body.classList.add("rendered-markdown");
}

function showError(msg) {
  showToast(msg);
  ["correction", "summary"].forEach(type => {
    const card = document.querySelector(`[data-widget="${type}"]`);
    if (card) {
      card.querySelector(".widget-body").innerHTML =
        '<div class="widget-empty">分析出错</div>';
    }
  });
}

// ============================================================
//  Article Annotation
// ============================================================

function annotateArticle() {
  clearIssueMarkers();
  if (!STATE.result || !STATE.result.sections[2]) return;

  const correctionText = STATE.result.sections[2].content;
  const issues = parseIssueQuotes(correctionText);
  if (issues.length === 0) return;

  const editor = $("#articleInput");
  if (!editor) return;

  let annotated = 0;
  for (const issue of issues) {
    if (findAndWrapText(editor, issue.quote, issue)) annotated++;
  }

  if (annotated > 0) showToast(`已在原文标注 ${annotated} 处问题`);
}

function parseIssueQuotes(correctionText) {
  const issues = [];
  const regex = /「([^」]+)」/g;
  let match;

  while ((match = regex.exec(correctionText)) !== null) {
    const quote = match[1].trim();
    if (!quote || quote.length < 2) continue;

    const beforeQuote = correctionText.substring(0, match.index);
    const afterQuote = correctionText.substring(match.index + match[0].length);

    const typeMatch = beforeQuote.match(/问题类型[：:]\s*(.+?)(?:\n|$)/);
    const problemType = typeMatch ? typeMatch[1].trim() : "";

    const descMatch = afterQuote.match(/问题说明[：:]\s*(.+?)(?:\n|$)/);
    const description = descMatch ? descMatch[1].trim() : "";

    const tip = problemType ? `[${problemType}] ${description}` : description;

    issues.push({ quote, tip: tip || "问题位置" });
  }

  return issues;
}

function clearIssueMarkers() {
  document.querySelectorAll(".issue-marker").forEach(span => {
    const parent = span.parentNode;
    while (span.firstChild) parent.insertBefore(span.firstChild, span);
    parent.removeChild(span);
  });
  const editor = $("#articleInput");
  if (editor) editor.normalize();
}

function findAndWrapText(rootElement, searchText, issue) {
  const walker = document.createTreeWalker(rootElement, NodeFilter.SHOW_TEXT);
  const textNodes = [];
  while (walker.nextNode()) textNodes.push(walker.currentNode);

  for (const node of textNodes) {
    const text = node.textContent;
    const idx = text.indexOf(searchText);
    if (idx === -1) continue;

    try {
      const range = document.createRange();
      range.setStart(node, idx);
      range.setEnd(node, idx + searchText.length);

      const span = document.createElement("span");
      span.className = "issue-marker";
      span.setAttribute("data-tip", issue.tip);
      range.surroundContents(span);
      return true;
    } catch (_) {
      try {
        const range = document.createRange();
        range.setStart(node, idx);
        range.setEnd(node, idx + searchText.length);

        const contents = range.extractContents();
        const span = document.createElement("span");
        span.className = "issue-marker";
        span.setAttribute("data-tip", issue.tip);
        span.appendChild(contents);
        range.insertNode(span);
        return true;
      } catch (_2) { continue; }
    }
  }
  return false;
}

// ============================================================
//  Highlight
// ============================================================

function handleSelection(e) {
  if (e.target.closest("#highlightToolbar")) return;

  const sel = window.getSelection();
  if (!sel || sel.isCollapsed || !sel.toString().trim()) { hideToolbar(); return; }

  const node = sel.anchorNode;
  if (!node) { hideToolbar(); return; }
  const inApp = node.parentElement?.closest(".col") || node.parentElement?.closest(".widget-card");
  if (!inApp) { hideToolbar(); return; }

  const range = sel.getRangeAt(0);
  const rect = range.getBoundingClientRect();
  const toolbar = $("#highlightToolbar");

  let top = rect.top - toolbar.offsetHeight - 8;
  let left = rect.left + rect.width / 2;

  if (top < 8) top = rect.bottom + 8;

  const halfW = toolbar.offsetWidth / 2;
  if (left - halfW < 8) left = halfW + 8;
  if (left + halfW > window.innerWidth - 8) left = window.innerWidth - halfW - 8;

  toolbar.style.top = top + "px";
  toolbar.style.left = left + "px";
  toolbar.classList.remove("hidden");
}

function hideToolbar() {
  const toolbar = $("#highlightToolbar");
  if (toolbar) toolbar.classList.add("hidden");
}

function wrapSelectionWithMark() {
  const sel = window.getSelection();
  if (!sel || sel.isCollapsed) return;

  const range = sel.getRangeAt(0);

  try {
    const mark = document.createElement("mark");
    mark.className = "highlight-mark";
    range.surroundContents(mark);
    sel.removeAllRanges();
    hideToolbar();
    showToast("已高亮");
  } catch (_) {
    try {
      const contents = range.extractContents();
      const mark = document.createElement("mark");
      mark.className = "highlight-mark";
      mark.appendChild(contents);
      range.insertNode(mark);
      sel.removeAllRanges();
      hideToolbar();
      showToast("已高亮");
    } catch (_2) {
      showToast("所选区域无法高亮，请在同一段落内选择");
    }
  }
}

function clearAllHighlights() {
  const marks = document.querySelectorAll("mark.highlight-mark");
  let count = marks.length;
  marks.forEach(mark => {
    const parent = mark.parentNode;
    while (mark.firstChild) parent.insertBefore(mark.firstChild, mark);
    parent.removeChild(mark);
  });
  document.querySelectorAll(".col").forEach(col => col.normalize());
  hideToolbar();
  showToast(count > 0 ? `已清除 ${count} 处高亮` : "当前页面没有高亮标记");
}

// ============================================================
//  History
// ============================================================

function getHistory() {
  try { return JSON.parse(localStorage.getItem(HIST_KEY)) || []; } catch (_) { return []; }
}

function setHistory(arr) {
  localStorage.setItem(HIST_KEY, JSON.stringify(arr));
}

function saveToHistory(articleText) {
  if (!STATE.result) return;

  const history = getHistory();
  const lines = articleText.split("\n").filter(l => l.trim());
  const title = lines[0] ? lines[0].trim().substring(0, 50) : articleText.substring(0, 50);

  // Capture rewrite result
  const rewriteCard = document.querySelector('[data-widget="rewrite"]');
  let rewriteHTML = "";
  let rewriteStyle = "";
  let rewriteStyleLabel = "";
  if (rewriteCard) {
    const resultEl = rewriteCard.querySelector(".rewrite-result");
    if (resultEl && !resultEl.classList.contains("hidden")) {
      rewriteHTML = resultEl.innerHTML;
    }
    const selected = rewriteCard.querySelector(".rewrite-style-menu li.selected");
    if (selected) {
      rewriteStyle = selected.dataset.value;
      rewriteStyleLabel = selected.textContent;
    }
  }

  const entry = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    title: title || "（无标题）",
    articleHTML: $("#articleInput").innerHTML,
    articleText: articleText,
    sections: STATE.result.sections,
    raw: STATE.result.raw,
    rewriteHTML: rewriteHTML,
    rewriteStyle: rewriteStyle,
    rewriteStyleLabel: rewriteStyleLabel,
    createdAt: new Date().toLocaleString("zh-CN", {
      month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
    }),
    charCount: articleText.length,
  };

  const filtered = history.filter(h => h.articleText !== articleText);
  filtered.unshift(entry);
  if (filtered.length > HIST_MAX) filtered.length = HIST_MAX;

  setHistory(filtered);
  updateHistoryIndicator();
}

function renderHistoryList() {
  const list = $("#historyList");
  const countEl = $("#historyCount");
  const history = getHistory();

  countEl.textContent = history.length ? `${history.length} 篇` : "";

  if (!history.length) {
    list.innerHTML = '<div class="history-empty">暂无历史记录<br><span style="font-size:12px;color:var(--text-muted)">分析文章后会自动保存</span></div>';
    return;
  }

  list.innerHTML = history.map((h, i) => `
    <div class="history-item${i === 0 ? ' active' : ''}" data-id="${h.id}">
      <div class="history-item-title">${escapeHTML(h.title)}</div>
      <div class="history-item-meta">
        <span>${h.createdAt}</span>
        <span>${h.charCount} 字</span>
      </div>
      <button class="history-item-delete" title="删除">&times;</button>
    </div>`
  ).join("");
}

function restoreHistoryItem(id) {
  const history = getHistory();
  const entry = history.find(h => h.id === id);
  if (!entry) return;

  clearIssueMarkers();
  $("#articleInput").innerHTML = entry.articleHTML;
  $("#charCount").textContent = `${entry.charCount} 字`;

  STATE.result = { sections: entry.sections, raw: entry.raw };
  renderResults();

  // Restore rewrite result
  if (entry.rewriteHTML) {
    const rewriteCard = document.querySelector('[data-widget="rewrite"]');
    if (rewriteCard) {
      const resultEl = rewriteCard.querySelector(".rewrite-result");
      const emptyEl = rewriteCard.querySelector(".rewrite-empty");
      if (resultEl) {
        resultEl.innerHTML = entry.rewriteHTML;
        resultEl.classList.remove("hidden");
      }
      if (emptyEl) emptyEl.classList.add("hidden");
      // Restore style selection
      if (entry.rewriteStyle) {
        const menu = rewriteCard.querySelector(".rewrite-style-menu");
        const label = rewriteCard.querySelector(".rewrite-style-label");
        if (menu) {
          menu.querySelectorAll("li").forEach(l => l.classList.remove("selected"));
          const target = menu.querySelector(`[data-value="${entry.rewriteStyle}"]`);
          if (target) target.classList.add("selected");
        }
        if (label && entry.rewriteStyleLabel) label.textContent = entry.rewriteStyleLabel;
      }
    }
  }

  const filtered = history.filter(h => h.id !== id);
  filtered.unshift(entry);
  setHistory(filtered);

  showToast("已恢复历史分析");
}

function deleteHistoryItem(id) {
  const filtered = getHistory().filter(h => h.id !== id);
  setHistory(filtered);
  renderHistoryList();
  updateHistoryIndicator();
  showToast("已删除");
}

function clearAllHistory() {
  setHistory([]);
  renderHistoryList();
  updateHistoryIndicator();
  showToast("历史记录已清空");
}

function updateHistoryIndicator() {
  const btn = $("#historyToggle");
  const history = getHistory();
  btn.classList.toggle("has-history", history.length > 0);
}

function escapeHTML(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

// ============================================================
//  Toast
// ============================================================

function showToast(message) {
  const el = document.createElement("div");
  el.className = "toast";
  el.textContent = message;
  $("#toastContainer").appendChild(el);
  setTimeout(() => { if (el.parentNode) el.parentNode.removeChild(el); }, 2200);
}

// ============================================================
//  Clear All
// ============================================================

function clearAll() {
  clearIssueMarkers();
  clearAllHighlights();
  $("#articleInput").innerHTML = "";
  $("#charCount").textContent = "0 字";
  STATE.result = null;
  resetAllWidgets();
  if (STATE.loading) setLoading(false);
  showToast("已清除");
}

// ============================================================
//  Article Type
// ============================================================

function getArticleType() {
  const selected = document.querySelector("#articleTypeMenu li.selected");
  return selected ? selected.dataset.value : "auto";
}

// ============================================================
//  Style Settings UI
// ============================================================

function renderStyleSettings() {
  // Built-in styles
  const builtinList = $("#builtinStyleList");
  if (builtinList) {
    builtinList.innerHTML = Object.keys(BUILTIN_STYLES).map(key => {
      const s = BUILTIN_STYLES[key];
      return `<div class="style-item">
        <div class="style-item-info">
          <div class="style-item-name">${escapeHTML(s.name)}</div>
          <div class="style-item-desc">${escapeHTML(s.desc)}</div>
        </div>
        <div class="style-item-actions">
          <button data-preview="${key}" data-custom="0">预览</button>
        </div>
      </div>`;
    }).join("");
  }

  // Custom styles
  const customList = $("#customStyleList");
  if (customList) {
    const keys = Object.keys(STATE.customStyles);
    if (keys.length === 0) {
      customList.innerHTML = '<div style="font-size:12px;color:var(--text-muted);padding:8px 0;">暂无自定义风格</div>';
    } else {
      customList.innerHTML = keys.map(key => {
        const s = STATE.customStyles[key];
        return `<div class="style-item">
          <div class="style-item-info">
            <div class="style-item-name">${escapeHTML(s.name)}</div>
            <div class="style-item-desc">${escapeHTML(s.desc)}</div>
          </div>
          <div class="style-item-actions">
            <button data-preview="${key}" data-custom="1">预览</button>
            <button class="style-delete-btn" data-delete="${key}">删除</button>
          </div>
        </div>`;
      }).join("");
    }
  }
}

function showStylePreview(key, isCustom) {
  const styles = isCustom ? STATE.customStyles : BUILTIN_STYLES;
  const s = styles[key];
  if (!s) return;

  // Generate the system prompt
  const promptText = `你是一位精通多种文学风格的作家。请将用户提交的文章，用「${s.name}」的风格完全重写。

${s.desc}

要求：
1. 保留原文的核心观点、故事情节和关键信息
2. 用 ${s.name} 的写作手法和语言风格重新表达
3. 不是简单替换几个词，而是从句子结构、节奏、意象到整体气质全面转换
4. 用 Markdown 格式输出，用 ## 标题分隔
5. 重写后的文章应该让人一读就能感受到 ${s.name} 的味道
6. 文章末尾加一段简短的"改写说明"，列出你做了哪些关键调整`;

  $("#previewContent").textContent = promptText;
  $("#stylePreview").classList.remove("hidden");
}

function hideStylePreview() {
  $("#stylePreview").classList.add("hidden");
}

function addCustomStyle() {
  const nameInput = $("#newStyleName");
  const descInput = $("#newStyleDesc");
  const name = nameInput.value.trim();
  const desc = descInput.value.trim();

  if (!name) { showToast("请输入风格名称"); return; }
  if (!desc) { showToast("请输入风格描述"); return; }

  const key = "custom_" + Date.now().toString(36);
  STATE.customStyles[key] = { name, desc };
  saveCustomStyles();

  // Refresh UI
  renderStyleSettings();
  refreshAllStyleMenus();
  nameInput.value = "";
  descInput.value = "";
  showToast(`已添加风格「${name}」`);
}

function deleteCustomStyle(key) {
  const s = STATE.customStyles[key];
  if (!s) return;
  delete STATE.customStyles[key];
  saveCustomStyles();
  renderStyleSettings();
  refreshAllStyleMenus();
  showToast(`已删除风格「${s.name}」`);
}

function refreshAllStyleMenus() {
  document.querySelectorAll('[data-widget="rewrite"]').forEach(card => {
    const menu = card.querySelector(".rewrite-style-menu");
    if (!menu) return;

    // Remember currently selected
    const selected = menu.querySelector("li.selected");
    const currentKey = selected ? selected.dataset.value : "yu_hua";

    populateStyleMenu(card);

    // Try to restore selection
    const newSelected = menu.querySelector(`[data-value="${currentKey}"]`);
    if (newSelected) {
      menu.querySelectorAll("li").forEach(l => l.classList.remove("selected"));
      newSelected.classList.add("selected");
      const label = card.querySelector(".rewrite-style-label");
      if (label) label.textContent = newSelected.textContent;
    }
  });
}

// ============================================================
//  Event Binding
// ============================================================

function bindEvents() {
  // ── Logo Edit ──
  $(".logo").addEventListener("click", startLogoEdit);

  // ── Config Modal ──
  $("#configToggle").addEventListener("click", () => {
    $("#historyPanel").classList.add("hidden");
    $("#configOverlay").classList.remove("hidden");
  });
  $("#closeConfig").addEventListener("click", () => {
    $("#configOverlay").classList.add("hidden");
    hideStylePreview();
  });
  $("#configOverlay").addEventListener("click", (e) => {
    if (e.target === $("#configOverlay")) $("#configOverlay").classList.add("hidden");
  });
  $("#saveConfig").addEventListener("click", () => {
    saveConfig();
    showToast("设置已保存");
    $("#configOverlay").classList.add("hidden");
  });
  $("#resetConfig").addEventListener("click", () => {
    $("#apiEndpoint").value = "";
    $("#apiKey").value = "";
    $("#modelName").value = "";
    STATE.config = { endpoint: "", api_key: "", model: "" };
    localStorage.removeItem(LS_KEY);
    showToast("已恢复默认设置");
  });

  // ── Config Modal Tabs ──
  document.querySelectorAll(".modal-tab").forEach(tab => {
    tab.addEventListener("click", () => {
      const targetTab = tab.dataset.tab;
      // Update tab buttons
      document.querySelectorAll(".modal-tab").forEach(t => t.classList.remove("active"));
      tab.classList.add("active");
      // Show/hide panels
      document.querySelectorAll(".modal-tab-panel").forEach(p => p.classList.add("hidden"));
      const panel = document.querySelector(`[data-panel="${targetTab}"]`);
      if (panel) panel.classList.remove("hidden");
      // Hide preview when switching tabs
      hideStylePreview();
      // Render style settings when switching to styles tab
      if (targetTab === "styles") renderStyleSettings();
    });
  });

  // ── Style Settings: Preview ──
  document.addEventListener("click", (e) => {
    const previewBtn = e.target.closest("[data-preview]");
    if (!previewBtn) return;
    const key = previewBtn.dataset.preview;
    const isCustom = previewBtn.dataset.custom === "1";
    showStylePreview(key, isCustom);
  });

  // ── Style Settings: Preview close ──
  $("#closePreview").addEventListener("click", hideStylePreview);

  // ── Style Settings: Add custom style ──
  $("#addStyleBtn").addEventListener("click", addCustomStyle);

  // ── Style Settings: Delete custom style ──
  document.addEventListener("click", (e) => {
    const delBtn = e.target.closest("[data-delete]");
    if (!delBtn) return;
    deleteCustomStyle(delBtn.dataset.delete);
  });

  // ── Char Count ──
  $("#articleInput").addEventListener("input", () => {
    const len = ($("#articleInput").textContent || "").length;
    $("#charCount").textContent = `${len} 字`;
  });

  // ── Clear All ──
  $("#clearAllBtn").addEventListener("click", clearAll);

  // ── Article Type Dropdown ──
  const typeBtn = $("#articleTypeBtn");
  const typeMenu = $("#articleTypeMenu");
  const typeLabel = $("#articleTypeLabel");
  const typeDropdown = $("#articleTypeDropdown");

  typeBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    typeMenu.classList.toggle("hidden");
    typeDropdown.classList.toggle("open");
  });
  typeMenu.addEventListener("click", (e) => {
    const li = e.target.closest("li");
    if (!li) return;
    typeLabel.textContent = li.textContent;
    typeMenu.querySelectorAll("li").forEach(l => l.classList.remove("selected"));
    li.classList.add("selected");
    typeMenu.classList.add("hidden");
    typeDropdown.classList.remove("open");
  });
  document.addEventListener("click", (e) => {
    // Close article type dropdown
    if (!e.target.closest("#articleTypeDropdown")) {
      typeMenu.classList.add("hidden");
      typeDropdown.classList.remove("open");
    }
    // Close rewrite style dropdown
    document.querySelectorAll(".rewrite-style-dropdown").forEach(dd => {
      if (!e.target.closest(".rewrite-style-dropdown")) {
        dd.querySelector(".rewrite-style-menu")?.classList.add("hidden");
        dd.classList.remove("open");
      }
    });
  });

  // ── Analyze ──
  $("#analyzeBtn").addEventListener("click", analyze);

  // ── Drop Zones ──
  ["dropMiddle", "dropRight", "headerDock"].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener("dragover", handleDragOver);
    el.addEventListener("dragleave", handleDragLeave);
    el.addEventListener("drop", handleDrop);
  });

  // ── Highlight ──
  document.addEventListener("mouseup", (e) => { setTimeout(() => handleSelection(e), 10); });
  $("#highlightBtn").addEventListener("mousedown", (e) => { e.preventDefault(); wrapSelectionWithMark(); });
  $("#clearHighlightsBtn").addEventListener("mousedown", (e) => { e.preventDefault(); clearAllHighlights(); });
  document.addEventListener("mousedown", (e) => {
    if (!e.target.closest("#highlightToolbar")) hideToolbar();
  });
  document.addEventListener("scroll", () => hideToolbar(), true);

  // ── History ──
  $("#historyToggle").addEventListener("click", (e) => {
    e.stopPropagation();
    const panel = $("#historyPanel");
    $("#configOverlay").classList.add("hidden");
    panel.classList.toggle("hidden");
    if (!panel.classList.contains("hidden")) renderHistoryList();
  });
  document.addEventListener("click", (e) => {
    const panel = $("#historyPanel");
    if (!panel.classList.contains("hidden") &&
        !e.target.closest("#historyPanel") &&
        !e.target.closest("#historyToggle")) {
      panel.classList.add("hidden");
    }
  });
  $("#historyList").addEventListener("click", (e) => {
    const item = e.target.closest(".history-item");
    const delBtn = e.target.closest(".history-item-delete");
    if (delBtn) { e.stopPropagation(); const id = item?.dataset.id; if (id) deleteHistoryItem(id); return; }
    if (item && item.dataset.id) { restoreHistoryItem(item.dataset.id); $("#historyPanel").classList.add("hidden"); }
  });
  $("#clearHistory").addEventListener("click", () => {
    if (confirm("确定清空所有历史分析记录？此操作不可恢复。")) clearAllHistory();
  });

  // ── Keyboard Shortcuts ──
  document.addEventListener("keydown", (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); analyze(); }
    if (e.key === "Escape") {
      if (!$("#stylePreview").classList.contains("hidden")) {
        hideStylePreview();
      } else {
        $("#configOverlay").classList.add("hidden");
        $("#historyPanel").classList.add("hidden");
      }
    }
  });
}

// ============================================================
//  Boot
// ============================================================

document.addEventListener("DOMContentLoaded", init);
