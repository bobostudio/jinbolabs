const state = {
  sites: [],
  defaultSites: [],
  categories: [],
  activeCategory: "all",
  query: "",
  customization: {
    siteOrder: [],
    categoryBySiteId: {},
  },
  appearance: {
    backgroundPosition: "center center",
    glassOpacity: 28,
  },
};

const uiState = {
  hasRenderedSites: false,
  categoryPillFrame: 0,
  dragSiteId: "",
  dropSiteId: "",
  dropPosition: "after",
  dropCategoryId: "",
  dropToEnd: false,
  suppressClick: false,
  autoScrollSpeed: 0,
  autoScrollFrame: 0,
  layoutFeedbackTimer: 0,
};

const elements = {
  root: document.documentElement,
  categoryBar: document.querySelector("#categoryBar"),
  appGrid: document.querySelector("#appGrid"),
  searchInput: document.querySelector("#site-search"),
  resultCount: document.querySelector("#resultCount"),
  resetButton: document.querySelector("#resetButton"),
  emptyState: document.querySelector("#emptyState"),
  appearanceButton: document.querySelector("#appearanceButton"),
  appearancePanel: document.querySelector("#appearancePanel"),
  bgPositionGrid: document.querySelector("#bgPositionGrid"),
  glassOpacityInput: document.querySelector("#glassOpacityInput"),
  glassOpacityValue: document.querySelector("#glassOpacityValue"),
  resetLayoutButton: document.querySelector("#resetLayoutButton"),
  exportLayoutButton: document.querySelector("#exportLayoutButton"),
  importLayoutButton: document.querySelector("#importLayoutButton"),
  importLayoutInput: document.querySelector("#importLayoutInput"),
  layoutFeedback: document.querySelector("#layoutFeedback"),
  beijingTime: document.querySelector("#beijingTime"),
  beijingDate: document.querySelector("#beijingDate"),
};

const appearanceStorageKey = "nav-bobostudio-vip-appearance";
const customizationStorageKey = "nav-bobostudio-vip-customization";
const beijingTimeZone = "Asia/Shanghai";
const beijingDateFormatter = new Intl.DateTimeFormat("zh-CN", {
  timeZone: beijingTimeZone,
  year: "numeric",
  month: "long",
  day: "numeric",
  weekday: "long",
});
const beijingTimeFormatter = new Intl.DateTimeFormat("zh-CN", {
  timeZone: beijingTimeZone,
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});
const beijingDateTimeValueFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: beijingTimeZone,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
  hourCycle: "h23",
});

const colorPool = [
  "#1aa891",
  "#d6526c",
  "#3d7cbe",
  "#f4b63f",
  "#6c55ba",
  "#2f9a4f",
  "#df7045",
  "#2e9ca6",
];
const dragAutoScrollEdge = 84;
const dragAutoScrollMaxSpeed = 18;
const layoutExportVersion = 1;

async function loadSites() {
  try {
    const response = await fetch("./sites.json", { cache: "no-store" });

    if (!response.ok) {
      throw new Error(`读取 sites.json 失败：${response.status}`);
    }

    const data = await response.json();
    state.categories = normalizeCategories(data.categories);
    state.defaultSites = normalizeSites(data.sites);
    state.sites = applySiteCustomization(state.defaultSites);
    render({ animateCards: true });
  } catch (error) {
    elements.resultCount.textContent = "数据载入失败，请检查 sites.json";
    elements.appGrid.innerHTML = "";
    console.error(error);
  }
}

function normalizeCategories(categories = []) {
  const result = [{ id: "all", name: "全部" }];

  categories.forEach((category) => {
    if (!category?.id || !category?.name) return;
    result.push({
      id: String(category.id),
      name: String(category.name),
    });
  });

  return result;
}

function normalizeSites(sites = []) {
  return sites
    .filter((site) => site?.name && site?.url)
    .map((site, index) => ({
      id: site.id ? String(site.id) : `site-${index}`,
      name: String(site.name),
      url: String(site.url),
      category: site.category ? String(site.category) : "other",
      description: site.description ? String(site.description) : "",
      tags: Array.isArray(site.tags) ? site.tags.map(String) : [],
      icon: site.icon ? String(site.icon) : getFaviconUrl(site.url),
      color: site.color || colorPool[index % colorPool.length],
    }));
}

function loadSiteCustomization() {
  try {
    const saved = JSON.parse(
      localStorage.getItem(customizationStorageKey) || "{}",
    );

    state.customization.siteOrder = Array.isArray(saved.siteOrder)
      ? saved.siteOrder.map(String)
      : [];
    state.customization.categoryBySiteId =
      saved.categoryBySiteId && typeof saved.categoryBySiteId === "object"
        ? Object.fromEntries(
            Object.entries(saved.categoryBySiteId).map(([siteId, categoryId]) => [
              String(siteId),
              String(categoryId),
            ]),
          )
        : {};
  } catch {
    localStorage.removeItem(customizationStorageKey);
    state.customization.siteOrder = [];
    state.customization.categoryBySiteId = {};
  }
}

function saveSiteCustomization() {
  localStorage.setItem(
    customizationStorageKey,
    JSON.stringify(state.customization),
  );
}

function syncSiteCustomization() {
  state.customization.siteOrder = state.sites.map((site) => site.id);
  state.customization.categoryBySiteId = Object.fromEntries(
    state.sites.map((site) => [site.id, site.category]),
  );
  saveSiteCustomization();
  syncResetLayoutButton();
}

function applySiteCustomization(sites) {
  const validCategories = new Set(
    state.categories.map((category) => category.id).filter((id) => id !== "all"),
  );
  const customizedSites = sites.map((site) => {
    const customizedCategory = state.customization.categoryBySiteId[site.id];
    if (!customizedCategory || !validCategories.has(customizedCategory)) {
      return site;
    }

    return {
      ...site,
      category: customizedCategory,
    };
  });
  const sitesById = new Map(customizedSites.map((site) => [site.id, site]));
  const orderedSites = [];

  state.customization.siteOrder.forEach((siteId) => {
    const site = sitesById.get(siteId);
    if (!site) return;
    orderedSites.push(site);
    sitesById.delete(siteId);
  });

  customizedSites.forEach((site) => {
    if (!sitesById.has(site.id)) return;
    orderedSites.push(site);
    sitesById.delete(site.id);
  });

  return orderedSites;
}

function hasSiteCustomization() {
  if (state.defaultSites.length !== state.sites.length) {
    return state.defaultSites.length > 0 || state.sites.length > 0;
  }

  return state.defaultSites.some((site, index) => {
    const currentSite = state.sites[index];
    return (
      !currentSite ||
      currentSite.id !== site.id ||
      currentSite.category !== site.category
    );
  });
}

function syncResetLayoutButton() {
  if (!elements.resetLayoutButton) return;

  const hasCustomization = hasSiteCustomization();
  elements.resetLayoutButton.disabled = !hasCustomization;
  elements.resetLayoutButton.setAttribute(
    "aria-disabled",
    String(!hasCustomization),
  );
}

function resetSiteCustomization() {
  if (!state.defaultSites.length || !hasSiteCustomization()) {
    syncResetLayoutButton();
    return false;
  }

  state.sites = state.defaultSites.map((site) => ({ ...site }));
  state.customization.siteOrder = [];
  state.customization.categoryBySiteId = {};
  localStorage.removeItem(customizationStorageKey);
  syncResetLayoutButton();
  return true;
}

function setLayoutFeedback(message, tone = "default") {
  if (!elements.layoutFeedback) return;

  clearTimeout(uiState.layoutFeedbackTimer);
  elements.layoutFeedback.textContent = message;
  elements.layoutFeedback.dataset.tone = tone;

  if (!message) {
    return;
  }

  uiState.layoutFeedbackTimer = window.setTimeout(() => {
    elements.layoutFeedback.textContent = "";
    elements.layoutFeedback.dataset.tone = "default";
  }, 3200);
}

function getCurrentLayoutPayload() {
  return {
    version: layoutExportVersion,
    exportedAt: new Date().toISOString(),
    siteOrder: state.sites.map((site) => site.id),
    categoryBySiteId: Object.fromEntries(
      state.sites.map((site) => [site.id, site.category]),
    ),
  };
}

function downloadLayoutCustomization() {
  if (!state.sites.length) {
    setLayoutFeedback("当前没有可导出的布局数据。", "error");
    return;
  }

  const payload = JSON.stringify(getCurrentLayoutPayload(), null, 2);
  const blob = new Blob([payload], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = `bobonav-layout-${new Date()
    .toISOString()
    .replace(/[:.]/g, "-")}.json`;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  setLayoutFeedback("布局文件已导出。", "success");
}

function sanitizeImportedCustomization(payload) {
  if (!payload || typeof payload !== "object") {
    throw new Error("布局文件格式不正确。");
  }

  const rawSiteOrder = Array.isArray(payload.siteOrder)
    ? payload.siteOrder
    : Array.isArray(payload.customization?.siteOrder)
      ? payload.customization.siteOrder
      : [];
  const rawCategoryBySiteId =
    payload.categoryBySiteId && typeof payload.categoryBySiteId === "object"
      ? payload.categoryBySiteId
      : payload.customization?.categoryBySiteId &&
          typeof payload.customization.categoryBySiteId === "object"
        ? payload.customization.categoryBySiteId
        : {};
  const validSiteIds = new Set(state.defaultSites.map((site) => site.id));
  const validCategories = new Set(
    state.categories.map((category) => category.id).filter((id) => id !== "all"),
  );
  const siteOrder = [];
  const seenSiteIds = new Set();

  rawSiteOrder.forEach((siteId) => {
    const normalizedSiteId = String(siteId);
    if (!validSiteIds.has(normalizedSiteId) || seenSiteIds.has(normalizedSiteId)) {
      return;
    }

    seenSiteIds.add(normalizedSiteId);
    siteOrder.push(normalizedSiteId);
  });

  state.defaultSites.forEach((site) => {
    if (seenSiteIds.has(site.id)) return;
    siteOrder.push(site.id);
  });

  const categoryBySiteId = {};
  Object.entries(rawCategoryBySiteId).forEach(([siteId, categoryId]) => {
    const normalizedSiteId = String(siteId);
    const normalizedCategoryId = String(categoryId);
    if (
      !validSiteIds.has(normalizedSiteId) ||
      !validCategories.has(normalizedCategoryId)
    ) {
      return;
    }

    categoryBySiteId[normalizedSiteId] = normalizedCategoryId;
  });

  return {
    siteOrder,
    categoryBySiteId,
  };
}

function applyImportedCustomization(payload) {
  const customization = sanitizeImportedCustomization(payload);
  state.customization.siteOrder = customization.siteOrder;
  state.customization.categoryBySiteId = customization.categoryBySiteId;
  state.sites = applySiteCustomization(state.defaultSites);
  syncSiteCustomization();
}

async function importLayoutCustomization(file) {
  if (!file) return false;

  const content = await file.text();
  const payload = JSON.parse(content);
  applyImportedCustomization(payload);
  setLayoutFeedback("布局文件已导入。", "success");
  return true;
}

function render({
  animateCards = !uiState.hasRenderedSites,
  animateGrid = false,
  gridDirection = 0,
  animateLayout = false,
} = {}) {
  syncResetLayoutButton();
  renderCategories();
  renderSites({ animateCards, animateGrid, gridDirection, animateLayout });
}

function loadAppearance() {
  try {
    const saved = JSON.parse(
      localStorage.getItem(appearanceStorageKey) || "{}",
    );
    if (typeof saved.backgroundPosition === "string") {
      state.appearance.backgroundPosition = saved.backgroundPosition;
    }
    if (Number.isFinite(Number(saved.glassOpacity))) {
      state.appearance.glassOpacity = clamp(Number(saved.glassOpacity), 0, 100);
    }
  } catch {
    localStorage.removeItem(appearanceStorageKey);
  }

  applyAppearance();
}

function saveAppearance() {
  localStorage.setItem(appearanceStorageKey, JSON.stringify(state.appearance));
}

function applyAppearance() {
  const { backgroundPosition, glassOpacity } = state.appearance;
  elements.root.style.setProperty("--wallpaper-position", backgroundPosition);
  elements.root.style.setProperty("--glass-alpha", String(glassOpacity / 100));
  elements.glassOpacityInput.value = String(glassOpacity);
  elements.glassOpacityValue.textContent = String(glassOpacity);

  elements.bgPositionGrid
    .querySelectorAll("[data-bg-position]")
    .forEach((button) => {
      button.setAttribute(
        "aria-pressed",
        String(button.dataset.bgPosition === backgroundPosition),
      );
    });
}

function setBackgroundPosition(position) {
  state.appearance.backgroundPosition = position;
  applyAppearance();
  saveAppearance();
}

function setGlassOpacity(opacity) {
  state.appearance.glassOpacity = clamp(Number(opacity), 0, 100);
  applyAppearance();
  saveAppearance();
}

function toggleAppearancePanel(forceOpen) {
  const shouldOpen = forceOpen ?? elements.appearancePanel.hidden;
  elements.appearancePanel.hidden = !shouldOpen;
  elements.appearanceButton.setAttribute("aria-expanded", String(shouldOpen));
}

function updateBeijingClock() {
  const now = new Date();
  const dateText = beijingDateFormatter.format(now);
  const timeText = beijingTimeFormatter.format(now);
  elements.beijingDate.textContent = dateText;
  elements.beijingTime.textContent = timeText;
  elements.beijingTime.dateTime = getBeijingDateTimeValue(now);
  elements.beijingTime.parentElement.setAttribute(
    "aria-label",
    `北京时间 ${dateText} ${timeText}`,
  );
}

function renderCategories() {
  const renderedButtons =
    elements.categoryBar.querySelectorAll(".category-button").length;

  if (renderedButtons !== state.categories.length) {
    const buttonsMarkup = state.categories
      .map(
        (category) => `
          <button
            class="category-button"
            type="button"
            data-category="${escapeHtml(category.id)}"
            aria-pressed="false"
          >
            ${escapeHtml(category.name)}
          </button>
        `,
      )
      .join("");

    elements.categoryBar.innerHTML =
      `${buttonsMarkup}<span class="category-pill" aria-hidden="true"></span>`;
  }

  syncCategoryButtons();
  queueCategoryPillUpdate();
}

function renderSites({
  animateCards = false,
  animateGrid = false,
  gridDirection = 0,
  animateLayout = false,
} = {}) {
  const previousRects = animateLayout ? captureSiteCardRects() : null;
  const filteredSites = getFilteredSites();
  const suffix =
    state.activeCategory === "all"
      ? ""
      : ` · ${getCategoryName(state.activeCategory)}`;
  elements.resultCount.textContent = `${filteredSites.length} 个网站${suffix}`;
  elements.emptyState.hidden = filteredSites.length > 0;
  elements.appGrid.hidden = filteredSites.length === 0;

  elements.appGrid.innerHTML = filteredSites
    .map((site, i) => renderSiteCard(site, i, animateCards))
    .join("");

  if (animateGrid) {
    animateGridRefresh(filteredSites.length > 0 ? elements.appGrid : elements.emptyState, gridDirection);
  }

  if (animateLayout && previousRects?.size) {
    animateSiteCardReorder(previousRects);
  }

  uiState.hasRenderedSites = true;
}

function renderSiteCard(site, index = 0, animateCards = false) {
  const fallback = getInitial(site.name);
  const tags = [...site.tags, site.description, getCategoryName(site.category)]
    .filter(Boolean)
    .join(" ");
  const staggerDelay = animateCards ? Math.min(index * 35, 600) : 0;
  const tooltip = [site.name, site.description].filter(Boolean).join(" - ");
  const siteCardClass = animateCards ? "site-card is-entering" : "site-card";
  const inlineStyle = animateCards
    ? `--site-color: ${escapeAttribute(site.color)}; --stagger: ${staggerDelay}ms`
    : `--site-color: ${escapeAttribute(site.color)}`;

  return `
    <a
      class="${siteCardClass}"
      href="${escapeAttribute(site.url)}"
      title="${escapeAttribute(tooltip)}"
      aria-label="${escapeAttribute(tooltip)}"
      target="_blank"
      rel="noopener noreferrer"
      draggable="true"
      data-site-id="${escapeAttribute(site.id)}"
      data-site-category="${escapeAttribute(site.category)}"
      data-search="${escapeAttribute(tags)}"
      style="${inlineStyle}"
    >
      <span class="icon-frame" aria-hidden="true">
        <img src="${escapeAttribute(site.icon)}" alt="" loading="lazy" onerror="this.replaceWith(createFallbackIcon('${escapeAttribute(fallback)}'))" />
      </span>
      <span class="site-copy">
        <span class="site-name" title="${escapeAttribute(site.name)}">${escapeHtml(site.name)}</span>
        <span class="site-description" title="${escapeAttribute(site.description || getCategoryName(site.category))}">${escapeHtml(site.description || getCategoryName(site.category))}</span>
      </span>
    </a>
  `;
}

function getFilteredSites() {
  const query = state.query.trim().toLowerCase();

  return state.sites.filter((site) => {
    const categoryMatched =
      state.activeCategory === "all" || site.category === state.activeCategory;
    const haystack = [
      site.name,
      site.description,
      site.url,
      site.category,
      ...site.tags,
    ]
      .join(" ")
      .toLowerCase();
    return categoryMatched && (!query || haystack.includes(query));
  });
}

function setActiveCategory(categoryId) {
  if (!categoryId || categoryId === state.activeCategory) return;
  const previousIndex = getCategoryIndex(state.activeCategory);
  const nextIndex = getCategoryIndex(categoryId);
  state.activeCategory = categoryId;
  render({
    animateGrid: true,
    gridDirection: getSlideDirection(previousIndex, nextIndex),
  });
}

function moveSiteWithinVisibleList(sourceSiteId, targetSiteId, position = "after") {
  if (!sourceSiteId || !targetSiteId || sourceSiteId === targetSiteId) {
    return false;
  }

  const visibleSiteIds = getFilteredSites().map((site) => site.id);
  if (
    !visibleSiteIds.includes(sourceSiteId) ||
    !visibleSiteIds.includes(targetSiteId)
  ) {
    return false;
  }

  const nextVisibleIds = visibleSiteIds.filter((siteId) => siteId !== sourceSiteId);
  const targetIndex = nextVisibleIds.indexOf(targetSiteId);
  if (targetIndex === -1) return false;

  const insertionIndex = position === "before" ? targetIndex : targetIndex + 1;
  nextVisibleIds.splice(insertionIndex, 0, sourceSiteId);
  return applyVisibleSiteOrder(visibleSiteIds, nextVisibleIds);
}

function moveSiteToVisibleEnd(sourceSiteId) {
  if (!sourceSiteId) return false;

  const visibleSiteIds = getFilteredSites().map((site) => site.id);
  if (!visibleSiteIds.includes(sourceSiteId) || visibleSiteIds.length < 2) {
    return false;
  }

  const nextVisibleIds = visibleSiteIds.filter((siteId) => siteId !== sourceSiteId);
  nextVisibleIds.push(sourceSiteId);
  return applyVisibleSiteOrder(visibleSiteIds, nextVisibleIds);
}

function applyVisibleSiteOrder(visibleSiteIds, orderedVisibleIds) {
  if (
    visibleSiteIds.length !== orderedVisibleIds.length ||
    visibleSiteIds.every((siteId, index) => siteId === orderedVisibleIds[index])
  ) {
    return false;
  }

  const visibleSet = new Set(visibleSiteIds);
  const sitesById = new Map(state.sites.map((site) => [site.id, site]));
  let visibleIndex = 0;

  state.sites = state.sites.map((site) => {
    if (!visibleSet.has(site.id)) {
      return site;
    }

    const nextSite = sitesById.get(orderedVisibleIds[visibleIndex]);
    visibleIndex += 1;
    return nextSite || site;
  });

  syncSiteCustomization();
  return true;
}

function moveSiteToCategory(siteId, targetCategoryId) {
  if (!siteId || !targetCategoryId || targetCategoryId === "all") return false;

  const sourceIndex = state.sites.findIndex((site) => site.id === siteId);
  if (sourceIndex === -1) return false;

  const sourceSite = state.sites[sourceIndex];
  if (sourceSite.category === targetCategoryId) {
    return false;
  }

  const nextSites = state.sites.slice();
  const [removedSite] = nextSites.splice(sourceIndex, 1);
  const movedSite = { ...removedSite, category: targetCategoryId };
  const targetIndex = getCategoryAppendIndex(nextSites, targetCategoryId);

  nextSites.splice(targetIndex, 0, movedSite);
  state.sites = nextSites;
  syncSiteCustomization();
  return true;
}

function resetFilters() {
  if (state.activeCategory === "all" && !state.query) return;
  const previousIndex = getCategoryIndex(state.activeCategory);
  const nextIndex = getCategoryIndex("all");
  state.activeCategory = "all";
  state.query = "";
  elements.searchInput.value = "";
  render({
    animateGrid: true,
    gridDirection: getSlideDirection(previousIndex, nextIndex),
  });
}

function getCategoryAppendIndex(sites, targetCategoryId) {
  for (let index = sites.length - 1; index >= 0; index -= 1) {
    if (sites[index].category === targetCategoryId) {
      return index + 1;
    }
  }

  return sites.length;
}

function getCategoryName(categoryId) {
  return (
    state.categories.find((category) => category.id === categoryId)?.name ||
    "其他"
  );
}

function getInitial(name) {
  return String(name).trim().slice(0, 1).toUpperCase() || "A";
}

function getFaviconUrl(url) {
  try {
    const domain = new URL(url).hostname;
    return `https://favicon.im/${domain}?larger=true`;
  } catch {
    return "";
  }
}

function createFallbackIcon(text) {
  const span = document.createElement("span");
  span.className = "fallback-icon";
  span.textContent = text;
  return span;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => {
    const map = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;",
    };
    return map[char];
  });
}

function escapeAttribute(value) {
  return escapeHtml(value).replace(/`/g, "&#096;");
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function getCategoryIndex(categoryId) {
  return state.categories.findIndex((category) => category.id === categoryId);
}

function getSlideDirection(previousIndex, nextIndex) {
  if (previousIndex === -1 || nextIndex === -1 || previousIndex === nextIndex) {
    return 0;
  }

  return nextIndex > previousIndex ? 1 : -1;
}

function syncCategoryButtons() {
  elements.categoryBar
    .querySelectorAll(".category-button")
    .forEach((button) => {
      button.setAttribute(
        "aria-pressed",
        String(button.dataset.category === state.activeCategory),
      );
    });
}

function clearCardDropTarget() {
  if (!uiState.dropSiteId) return;

  const selector = `.site-card[data-site-id="${escapeCssSelector(uiState.dropSiteId)}"]`;
  elements.appGrid
    .querySelector(selector)
    ?.classList.remove("is-drop-before", "is-drop-after");
  uiState.dropSiteId = "";
}

function setCardDropTarget(siteId, position = "after") {
  if (!siteId || siteId === uiState.dragSiteId) {
    clearCardDropTarget();
    return;
  }

  if (uiState.dropSiteId && uiState.dropSiteId !== siteId) {
    clearCardDropTarget();
  }

  const selector = `.site-card[data-site-id="${escapeCssSelector(siteId)}"]`;
  const card = elements.appGrid.querySelector(selector);
  if (!card) return;

  uiState.dropSiteId = siteId;
  uiState.dropPosition = position;
  card.classList.remove("is-drop-before", "is-drop-after");
  card.classList.add(position === "before" ? "is-drop-before" : "is-drop-after");
}

function clearCategoryDropTarget() {
  if (!uiState.dropCategoryId) return;

  const selector = `.category-button[data-category="${escapeCssSelector(uiState.dropCategoryId)}"]`;
  elements.categoryBar.querySelector(selector)?.classList.remove("is-drop-target");
  uiState.dropCategoryId = "";
}

function clearGridAppendDropTarget() {
  elements.appGrid.classList.remove("is-drop-append");
  uiState.dropToEnd = false;
}

function setGridAppendDropTarget() {
  clearCardDropTarget();
  uiState.dropToEnd = true;
  elements.appGrid.classList.add("is-drop-append");
}

function setCategoryDropTarget(categoryId) {
  if (!categoryId || categoryId === "all") {
    clearCategoryDropTarget();
    return;
  }

  if (uiState.dropCategoryId && uiState.dropCategoryId !== categoryId) {
    clearCategoryDropTarget();
  }

  clearGridAppendDropTarget();
  const selector = `.category-button[data-category="${escapeCssSelector(categoryId)}"]`;
  const button = elements.categoryBar.querySelector(selector);
  if (!button) return;

  uiState.dropCategoryId = categoryId;
  button.classList.add("is-drop-target");
}

function clearDragState() {
  elements.appGrid
    .querySelectorAll(".site-card.is-dragging")
    .forEach((card) => card.classList.remove("is-dragging"));
  clearCardDropTarget();
  clearCategoryDropTarget();
  clearGridAppendDropTarget();
  stopGridAutoScroll();
  uiState.dragSiteId = "";
  uiState.dropPosition = "after";
  window.setTimeout(() => {
    uiState.suppressClick = false;
  }, 0);
}

function queueCategoryPillUpdate() {
  cancelAnimationFrame(uiState.categoryPillFrame);
  uiState.categoryPillFrame = requestAnimationFrame(updateCategoryPill);
}

function updateCategoryPill() {
  const pill = elements.categoryBar.querySelector(".category-pill");
  const activeButton = elements.categoryBar.querySelector(
    '.category-button[aria-pressed="true"]',
  );

  if (!pill || !activeButton) return;

  pill.style.width = `${activeButton.offsetWidth}px`;
  pill.style.height = `${activeButton.offsetHeight}px`;
  pill.style.transform = `translate3d(${activeButton.offsetLeft}px, ${activeButton.offsetTop}px, 0)`;
  pill.style.opacity = "1";
}

function getDropPosition(card, clientX, clientY) {
  const rect = card.getBoundingClientRect();
  const xOffset = clientX - (rect.left + rect.width / 2);
  const yOffset = clientY - (rect.top + rect.height / 2);

  if (Math.abs(xOffset) >= Math.abs(yOffset)) {
    return xOffset < 0 ? "before" : "after";
  }

  return yOffset < 0 ? "before" : "after";
}

function updateGridAutoScroll(clientY) {
  if (!uiState.dragSiteId) {
    stopGridAutoScroll();
    return;
  }

  const rect = elements.appGrid.getBoundingClientRect();
  if (clientY < rect.top || clientY > rect.bottom) {
    stopGridAutoScroll();
    return;
  }

  let speed = 0;

  if (clientY < rect.top + dragAutoScrollEdge) {
    speed = -Math.ceil(
      ((rect.top + dragAutoScrollEdge - clientY) / dragAutoScrollEdge) *
        dragAutoScrollMaxSpeed,
    );
  } else if (clientY > rect.bottom - dragAutoScrollEdge) {
    speed = Math.ceil(
      ((clientY - (rect.bottom - dragAutoScrollEdge)) / dragAutoScrollEdge) *
        dragAutoScrollMaxSpeed,
    );
  }

  setGridAutoScrollSpeed(speed);
}

function setGridAutoScrollSpeed(speed) {
  uiState.autoScrollSpeed = speed;

  if (!speed) {
    stopGridAutoScroll();
    return;
  }

  if (uiState.autoScrollFrame) {
    return;
  }

  uiState.autoScrollFrame = requestAnimationFrame(stepGridAutoScroll);
}

function stepGridAutoScroll() {
  uiState.autoScrollFrame = 0;

  if (!uiState.dragSiteId || !uiState.autoScrollSpeed) {
    return;
  }

  elements.appGrid.scrollTop += uiState.autoScrollSpeed;
  uiState.autoScrollFrame = requestAnimationFrame(stepGridAutoScroll);
}

function stopGridAutoScroll() {
  uiState.autoScrollSpeed = 0;

  if (!uiState.autoScrollFrame) {
    return;
  }

  cancelAnimationFrame(uiState.autoScrollFrame);
  uiState.autoScrollFrame = 0;
}

function captureSiteCardRects() {
  const cards = elements.appGrid.querySelectorAll(".site-card[data-site-id]");
  return new Map(
    Array.from(cards, (card) => [
      card.dataset.siteId,
      card.getBoundingClientRect(),
    ]),
  );
}

function animateSiteCardReorder(previousRects) {
  if (
    window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
    typeof Element.prototype.animate !== "function"
  ) {
    return;
  }

  elements.appGrid
    .querySelectorAll(".site-card[data-site-id]")
    .forEach((card) => {
      const previousRect = previousRects.get(card.dataset.siteId || "");
      if (!previousRect) return;

      const nextRect = card.getBoundingClientRect();
      const deltaX = previousRect.left - nextRect.left;
      const deltaY = previousRect.top - nextRect.top;

      if (!deltaX && !deltaY) return;

      card.animate(
        [
          {
            transform: `translate3d(${deltaX}px, ${deltaY}px, 0) scale(0.985)`,
          },
          {
            transform: "translate3d(0, 0, 0) scale(1)",
          },
        ],
        {
          duration: 360,
          easing: "cubic-bezier(0.22, 1, 0.36, 1)",
        },
      );
    });
}

function animateGridRefresh(target, direction = 0) {
  if (
    window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
    !target ||
    target.hidden ||
    typeof target.animate !== "function"
  ) {
    return;
  }

  const offset = direction === 0 ? 0 : direction * 30;

  target.animate(
    [
      {
        opacity: 0,
        transform: `translate3d(${offset}px, 0, 0) scale(0.985)`,
      },
      {
        opacity: 1,
        transform: "translate3d(0, 0, 0) scale(1)",
      },
    ],
    {
      duration: 240,
      easing: "cubic-bezier(0.22, 1, 0.36, 1)",
    },
  );
}

function getBeijingDateTimeValue(date) {
  const parts = beijingDateTimeValueFormatter
    .formatToParts(date)
    .reduce((result, part) => {
      result[part.type] = part.value;
      return result;
    }, {});

  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}+08:00`;
}

function escapeCssSelector(value) {
  if (typeof CSS !== "undefined" && typeof CSS.escape === "function") {
    return CSS.escape(String(value));
  }

  return String(value).replace(/["\\]/g, "\\$&");
}

elements.categoryBar.addEventListener("click", (event) => {
  const button = event.target.closest("[data-category]");
  if (!button) return;
  setActiveCategory(button.dataset.category);
});

elements.categoryBar.addEventListener("dragover", (event) => {
  if (!uiState.dragSiteId) return;

  const button = event.target.closest(".category-button[data-category]");
  if (!button || button.dataset.category === "all") return;

  event.preventDefault();
  stopGridAutoScroll();
  clearCardDropTarget();
  setCategoryDropTarget(button.dataset.category);
  event.dataTransfer.dropEffect = "move";
});

elements.categoryBar.addEventListener("drop", (event) => {
  if (!uiState.dragSiteId) return;

  const button = event.target.closest(".category-button[data-category]");
  if (!button || button.dataset.category === "all") return;

  event.preventDefault();
  const previousIndex = getCategoryIndex(state.activeCategory);
  moveSiteToCategory(uiState.dragSiteId, button.dataset.category);
  state.activeCategory = button.dataset.category;
  render({
    animateGrid: true,
    gridDirection: getSlideDirection(
      previousIndex,
      getCategoryIndex(button.dataset.category),
    ),
  });

  clearDragState();
});

elements.searchInput.addEventListener("input", (event) => {
  state.query = event.target.value;
  renderSites();
});

elements.appGrid.addEventListener("click", (event) => {
  const card = event.target.closest(".site-card[data-site-id]");
  if (!card || !uiState.suppressClick) return;
  event.preventDefault();
});

elements.appGrid.addEventListener("dragstart", (event) => {
  const card = event.target.closest(".site-card[data-site-id]");
  if (!card) return;

  uiState.dragSiteId = card.dataset.siteId || "";
  uiState.suppressClick = true;
  card.classList.add("is-dragging");
  event.dataTransfer.clearData();
  event.dataTransfer.effectAllowed = "move";
  event.dataTransfer.setData("text/plain", uiState.dragSiteId);
});

elements.appGrid.addEventListener("dragover", (event) => {
  if (!uiState.dragSiteId) return;

  event.preventDefault();
  updateGridAutoScroll(event.clientY);
  clearCategoryDropTarget();
  const card = event.target.closest(".site-card[data-site-id]");
  const visibleSiteIds = getFilteredSites().map((site) => site.id);

  if (!card) {
    if (visibleSiteIds.includes(uiState.dragSiteId)) {
      setGridAppendDropTarget();
    }
    event.dataTransfer.dropEffect = "move";
    return;
  }

  clearGridAppendDropTarget();
  const targetSiteId = card.dataset.siteId || "";
  if (!targetSiteId || targetSiteId === uiState.dragSiteId) {
    clearCardDropTarget();
    event.dataTransfer.dropEffect = "move";
    return;
  }

  setCardDropTarget(
    targetSiteId,
    getDropPosition(card, event.clientX, event.clientY),
  );
  event.dataTransfer.dropEffect = "move";
});

elements.appGrid.addEventListener("drop", (event) => {
  if (!uiState.dragSiteId) return;

  event.preventDefault();
  let hasMoved = false;

  if (uiState.dropSiteId) {
    hasMoved = moveSiteWithinVisibleList(
      uiState.dragSiteId,
      uiState.dropSiteId,
      uiState.dropPosition,
    );
  } else if (uiState.dropToEnd) {
    hasMoved = moveSiteToVisibleEnd(uiState.dragSiteId);
  }

  if (hasMoved) {
    renderSites({ animateLayout: true });
  }

  clearDragState();
});

elements.appGrid.addEventListener("dragend", clearDragState);

document.addEventListener("dragover", (event) => {
  if (!uiState.dragSiteId) return;

  if (event.target.closest("#appGrid, #categoryBar")) {
    return;
  }

  event.preventDefault();
  stopGridAutoScroll();
  clearCardDropTarget();
  clearCategoryDropTarget();
  clearGridAppendDropTarget();
});

document.addEventListener("drop", (event) => {
  if (!uiState.dragSiteId) return;

  if (event.target.closest("#appGrid, #categoryBar")) {
    return;
  }

  event.preventDefault();
  clearDragState();
});

elements.resetButton.addEventListener("click", resetFilters);

elements.appearanceButton.addEventListener("click", (event) => {
  event.stopPropagation();
  toggleAppearancePanel();
});

elements.appearancePanel.addEventListener("click", (event) => {
  event.stopPropagation();
  const positionButton = event.target.closest("[data-bg-position]");
  if (positionButton) {
    setBackgroundPosition(positionButton.dataset.bgPosition);
  }
});

elements.glassOpacityInput.addEventListener("input", (event) => {
  setGlassOpacity(event.target.value);
});

elements.resetLayoutButton?.addEventListener("click", () => {
  const previousIndex = getCategoryIndex(state.activeCategory);
  const hasReset = resetSiteCustomization();
  if (!hasReset) return;

  render({
    animateGrid: true,
    gridDirection: getSlideDirection(
      previousIndex,
      getCategoryIndex(state.activeCategory),
    ),
    animateLayout: true,
  });
});

elements.exportLayoutButton?.addEventListener("click", () => {
  downloadLayoutCustomization();
});

elements.importLayoutButton?.addEventListener("click", () => {
  elements.importLayoutInput?.click();
});

elements.importLayoutInput?.addEventListener("change", async (event) => {
  const [file] = Array.from(event.target.files || []);
  event.target.value = "";
  if (!file) return;

  try {
    const previousIndex = getCategoryIndex(state.activeCategory);
    const hasImported = await importLayoutCustomization(file);
    if (!hasImported) return;

    render({
      animateGrid: true,
      gridDirection: getSlideDirection(
        previousIndex,
        getCategoryIndex(state.activeCategory),
      ),
      animateLayout: true,
    });
  } catch (error) {
    console.error(error);
    setLayoutFeedback(
      error instanceof Error ? error.message : "导入布局失败，请检查文件内容。",
      "error",
    );
  }
});

document.addEventListener("click", () => {
  toggleAppearancePanel(false);
});

window.addEventListener("resize", queueCategoryPillUpdate);

document.addEventListener("keydown", (event) => {
  const isMac = navigator.platform.toLowerCase().includes("mac");
  const modKey = isMac ? event.metaKey : event.ctrlKey;
  if (modKey && event.key.toLowerCase() === "k") {
    event.preventDefault();
    elements.searchInput.focus();
    elements.searchInput.select();
  }
  if (
    event.key === "Escape" &&
    document.activeElement === elements.searchInput
  ) {
    elements.searchInput.blur();
  }
  if (event.key === "Escape" && !elements.appearancePanel.hidden) {
    toggleAppearancePanel(false);
    elements.appearanceButton.focus();
  }
});

loadAppearance();
loadSiteCustomization();
updateBeijingClock();
setInterval(updateBeijingClock, 1000);
document.fonts?.ready.then(queueCategoryPillUpdate);
loadSites();
