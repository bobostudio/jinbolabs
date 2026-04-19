const state = {
  sites: [],
  categories: [],
  activeCategory: "all",
  query: "",
};

const elements = {
  categoryBar: document.querySelector("#categoryBar"),
  appGrid: document.querySelector("#appGrid"),
  searchInput: document.querySelector("#site-search"),
  resultCount: document.querySelector("#resultCount"),
  resetButton: document.querySelector("#resetButton"),
  emptyState: document.querySelector("#emptyState"),
};

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

async function loadSites() {
  try {
    const response = await fetch("./sites.json", { cache: "no-store" });

    if (!response.ok) {
      throw new Error(`读取 sites.json 失败：${response.status}`);
    }

    const data = await response.json();
    state.categories = normalizeCategories(data.categories);
    state.sites = normalizeSites(data.sites);
    render();
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

function render() {
  renderCategories();
  renderSites();
}

function renderCategories() {
  elements.categoryBar.innerHTML = state.categories
    .map(
      (category) => `
        <button
          class="category-button"
          type="button"
          data-category="${escapeHtml(category.id)}"
          aria-pressed="${state.activeCategory === category.id}"
        >
          ${escapeHtml(category.name)}
        </button>
      `,
    )
    .join("");
}

function renderSites() {
  const filteredSites = getFilteredSites();
  const suffix = state.activeCategory === "all" ? "" : ` · ${getCategoryName(state.activeCategory)}`;
  elements.resultCount.textContent = `${filteredSites.length} 个网站${suffix}`;
  elements.emptyState.hidden = filteredSites.length > 0;
  elements.appGrid.hidden = filteredSites.length === 0;

  elements.appGrid.innerHTML = filteredSites.map((site, i) => renderSiteCard(site, i)).join("");
}

function renderSiteCard(site, index = 0) {
  const fallback = getInitial(site.name);
  const tags = [...site.tags, site.description, getCategoryName(site.category)].filter(Boolean).join(" ");
  const staggerDelay = Math.min(index * 35, 600);

  return `
    <a
      class="site-card"
      href="${escapeAttribute(site.url)}"
      target="_blank"
      rel="noopener noreferrer"
      data-search="${escapeAttribute(tags)}"
      style="--site-color: ${escapeAttribute(site.color)}; --stagger: ${staggerDelay}ms"
    >
      <span class="icon-frame" aria-hidden="true">
        <img src="${escapeAttribute(site.icon)}" alt="" loading="lazy" onerror="this.replaceWith(createFallbackIcon('${escapeAttribute(fallback)}'))" />
      </span>
      <span class="site-copy">
        <span class="site-name">${escapeHtml(site.name)}</span>
        <span class="site-description">${escapeHtml(site.description || getCategoryName(site.category))}</span>
      </span>
    </a>
  `;
}

function getFilteredSites() {
  const query = state.query.trim().toLowerCase();

  return state.sites.filter((site) => {
    const categoryMatched = state.activeCategory === "all" || site.category === state.activeCategory;
    const haystack = [site.name, site.description, site.url, site.category, ...site.tags]
      .join(" ")
      .toLowerCase();
    return categoryMatched && (!query || haystack.includes(query));
  });
}

function setActiveCategory(categoryId) {
  state.activeCategory = categoryId;
  render();
}

function resetFilters() {
  state.activeCategory = "all";
  state.query = "";
  elements.searchInput.value = "";
  render();
}

function getCategoryName(categoryId) {
  return state.categories.find((category) => category.id === categoryId)?.name || "其他";
}

function getInitial(name) {
  return String(name).trim().slice(0, 1).toUpperCase() || "A";
}

function getFaviconUrl(url) {
  try {
    const domain = new URL(url).hostname;
    return `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;
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

elements.categoryBar.addEventListener("click", (event) => {
  const button = event.target.closest("[data-category]");
  if (!button) return;
  setActiveCategory(button.dataset.category);
});

elements.searchInput.addEventListener("input", (event) => {
  state.query = event.target.value;
  renderSites();
});

elements.resetButton.addEventListener("click", resetFilters);

document.addEventListener("keydown", (event) => {
  const isMac = navigator.platform.toLowerCase().includes("mac");
  const modKey = isMac ? event.metaKey : event.ctrlKey;
  if (modKey && event.key.toLowerCase() === "k") {
    event.preventDefault();
    elements.searchInput.focus();
    elements.searchInput.select();
  }
  if (event.key === "Escape" && document.activeElement === elements.searchInput) {
    elements.searchInput.blur();
  }
});

loadSites();
