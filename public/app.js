const APP_VERSION = "0.7.0";

const defaultAreas = [
  { name: "Life", color: "#476c9b" },
  { name: "Work", color: "#0e7c74" },
  { name: "Health", color: "#2f855a" },
  { name: "Money", color: "#b1791f" },
  { name: "Home", color: "#7b5ea7" },
  { name: "Creative", color: "#d85b49" }
];

const state = {
  tasks: [],
  selectedId: null,
  view: "today",
  search: "",
  tagFilter: "",
  sort: "manual",
  showDone: localStorage.getItem("show-done") === "true",
  draggingId: null,
  syncError: "",
  syncMessage: "",
  config: null,
  areas: loadAreas(),
  plannerKey: localStorage.getItem("planner-key") || "",
  detailWidth: Number(localStorage.getItem("detail-width") || 360)
};

const els = {
  storageStatus: document.querySelector("#storage-status"),
  appVersion: document.querySelector("#app-version"),
  todayLabel: document.querySelector("#today-label"),
  viewTitle: document.querySelector("#view-title"),
  boardTitle: document.querySelector("#board-title"),
  syncStatus: document.querySelector("#sync-status"),
  syncError: document.querySelector("#sync-error"),
  taskList: document.querySelector("#task-list"),
  taskForm: document.querySelector("#task-form"),
  area: document.querySelector("#area"),
  manageAreasButton: document.querySelector("#manage-areas-button"),
  areasDialog: document.querySelector("#areas-dialog"),
  areaList: document.querySelector("#area-list"),
  newAreaName: document.querySelector("#new-area-name"),
  newAreaColor: document.querySelector("#new-area-color"),
  addAreaButton: document.querySelector("#add-area-button"),
  search: document.querySelector("#search"),
  sort: document.querySelector("#sort"),
  showDone: document.querySelector("#show-done"),
  tagFilters: document.querySelector("#tag-filters"),
  keyButton: document.querySelector("#key-button"),
  syncButton: document.querySelector("#sync-button"),
  resizeHandle: document.querySelector("#resize-handle"),
  detailForm: document.querySelector("#detail-form"),
  emptyDetail: document.querySelector("#empty-detail"),
  keyDialog: document.querySelector("#key-dialog"),
  keyForm: document.querySelector("#key-form"),
  plannerKey: document.querySelector("#planner-key"),
  clearLocalButton: document.querySelector("#clear-local-button"),
  completeButton: document.querySelector("#complete-button"),
  subtaskButton: document.querySelector("#subtask-button"),
  deleteButton: document.querySelector("#delete-button")
};

const detail = {
  id: document.querySelector("#detail-id"),
  title: document.querySelector("#detail-title"),
  notes: document.querySelector("#detail-notes"),
  parent: document.querySelector("#detail-parent"),
  tags: document.querySelector("#detail-tags"),
  area: document.querySelector("#detail-area"),
  priority: document.querySelector("#detail-priority"),
  due: document.querySelector("#detail-due"),
  energy: document.querySelector("#detail-energy")
};

const counts = {
  today: document.querySelector("#count-today"),
  upcoming: document.querySelector("#count-upcoming"),
  backlog: document.querySelector("#count-backlog"),
  done: document.querySelector("#count-done"),
  graph: document.querySelector("#count-graph"),
  timeline: document.querySelector("#count-timeline"),
  open: document.querySelector("#stat-open"),
  focus: document.querySelector("#stat-focus")
};

function loadAreas() {
  const raw = localStorage.getItem("planner-areas");
  if (!raw) return defaultAreas;
  try {
    const parsed = JSON.parse(raw);
    return parsed.length ? parsed : defaultAreas;
  } catch {
    return defaultAreas;
  }
}

function saveAreas() {
  localStorage.setItem("planner-areas", JSON.stringify(state.areas));
}

function areaColor(name) {
  return state.areas.find((area) => area.name === name)?.color || "#667085";
}

function ensureArea(name, color = "#667085") {
  const normalized = String(name || "").trim();
  if (!normalized) return;
  if (!state.areas.some((area) => area.name.toLowerCase() === normalized.toLowerCase())) {
    state.areas.push({ name: normalized, color });
    saveAreas();
  }
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function formatDate(value) {
  if (!value) return "No date";
  const date = new Date(`${value}T12:00:00`);
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(date);
}

function nowIso() {
  return new Date().toISOString();
}

function addDaysIso(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function defaultDueDateForView() {
  if (state.view === "today") return todayIso();
  if (state.view === "upcoming") return addDaysIso(1);
  return "";
}

function makeId() {
  return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function parseTags(value) {
  if (Array.isArray(value)) return [...new Set(value.map((tag) => String(tag).trim()).filter(Boolean))];
  return [...new Set(String(value || "").split(",").map((tag) => tag.trim()).filter(Boolean))];
}

function normalizeTask(task) {
  const order = Number(task.sort_order ?? task.sortOrder);
  return {
    id: task.id || makeId(),
    owner_key: task.owner_key || state.plannerKey || "local",
    parent_id: task.parent_id || task.parentId || "",
    title: task.title || "",
    notes: task.notes || "",
    tags: parseTags(task.tags),
    area: task.area || "Life",
    priority: task.priority || "Medium",
    status: task.status || "active",
    due_date: task.due_date || task.dueDate || "",
    energy: task.energy || "Medium",
    sort_order: Number.isFinite(order) ? order : 0,
    created_at: task.created_at || nowIso(),
    updated_at: task.updated_at || nowIso(),
    completed_at: task.completed_at || null
  };
}

function databasePayload(task) {
  return {
    ...task,
    owner_key: state.plannerKey,
    parent_id: task.parent_id || null,
    due_date: task.due_date || null,
    tags: parseTags(task.tags),
    sort_order: task.sort_order || 0
  };
}

function databasePatchPayload(changes) {
  const payload = {};
  for (const [key, value] of Object.entries(changes)) {
    if (value !== undefined) payload[key] = value;
  }
  if ("parent_id" in payload) payload.parent_id = payload.parent_id || null;
  if ("due_date" in payload) payload.due_date = payload.due_date || null;
  if ("tags" in payload) payload.tags = parseTags(payload.tags);
  if ("sort_order" in payload) payload.sort_order = Number(payload.sort_order) || 0;
  return payload;
}

function isSupabaseReady() {
  return Boolean(state.config?.supabaseUrl && state.config?.supabaseAnonKey && state.plannerKey);
}

function keyLabel() {
  if (!state.plannerKey) return "No planner key";
  return `Key ending ${state.plannerKey.slice(-4)}`;
}

async function loadConfig() {
  try {
    const response = await fetch("/api/config");
    state.config = response.ok ? await response.json() : {};
  } catch {
    state.config = {};
  }
}

async function supabaseRequest(path, options = {}) {
  const base = state.config.supabaseUrl.replace(/\/$/, "");
  const headers = {
    apikey: state.config.supabaseAnonKey,
    "x-planner-key": state.plannerKey,
    "content-type": "application/json",
    prefer: "return=representation",
    ...(options.headers || {})
  };
  if (state.config.supabaseAnonKey.startsWith("eyJ")) {
    headers.authorization = `Bearer ${state.config.supabaseAnonKey}`;
  }

  const response = await fetch(`${base}/rest/v1/${path}`, { ...options, headers });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`${response.status} ${text || response.statusText}`);
  }
  return response.status === 204 ? null : response.json();
}

function loadLocal() {
  const raw = localStorage.getItem("planner-tasks");
  state.tasks = ensureSortOrders(raw ? JSON.parse(raw).map(normalizeTask) : seedTasks());
  state.syncError = "";
  state.syncMessage = "Using local browser storage. Click Key, enter your planner key, and click Connect to use Supabase.";
  saveLocal();
}

function saveLocal() {
  localStorage.setItem("planner-tasks", JSON.stringify(state.tasks));
  state.syncMessage = "Saved locally in this browser only.";
}

function ensureSortOrders(tasks) {
  const groups = new Map();
  for (const task of tasks) {
    const parent = task.parent_id || "";
    if (!groups.has(parent)) groups.set(parent, []);
    groups.get(parent).push(task);
  }
  for (const siblings of groups.values()) {
    siblings
      .sort((a, b) => {
        if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
        return new Date(a.created_at) - new Date(b.created_at);
      })
      .forEach((task, index) => {
        if (!task.sort_order) task.sort_order = (index + 1) * 1000;
      });
  }
  return tasks;
}

function nextSortOrder(parentId = "") {
  const siblings = state.tasks.filter((task) => (task.parent_id || "") === (parentId || ""));
  if (!siblings.length) return 1000;
  return Math.max(...siblings.map((task) => Number(task.sort_order) || 0)) + 1000;
}

function selectableParents(excludeId = "") {
  const blocked = excludeId ? new Set([excludeId, ...descendantIds(excludeId)]) : new Set();
  return state.tasks
    .filter((task) => !blocked.has(task.id))
    .sort((a, b) => a.title.localeCompare(b.title));
}

function fillParentSelect(select, selected = "", excludeId = "") {
  const value = selected || "";
  select.innerHTML = '<option value="">No parent</option>';
  for (const task of selectableParents(excludeId)) {
    const option = document.createElement("option");
    option.value = task.id;
    option.textContent = task.title;
    select.append(option);
  }
  select.value = value;
}

function seedTasks() {
  const today = todayIso();
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return [
    normalizeTask({
      title: "Plan the day",
      notes: "Choose three things worth protecting.",
      tags: ["daily", "focus"],
      area: "Life",
      priority: "High",
      due_date: today,
      energy: "Low",
      sort_order: 1000
    }),
    normalizeTask({
      title: "Set up Supabase database",
      notes: "Run the schema and add Vercel environment variables.",
      tags: ["setup", "database"],
      area: "Work",
      priority: "Medium",
      due_date: tomorrow.toISOString().slice(0, 10),
      energy: "Medium",
      sort_order: 2000
    })
  ];
}

async function loadTasks() {
  if (!isSupabaseReady()) {
    loadLocal();
    render();
    return;
  }

  try {
    const rows = await supabaseRequest(
      `planner_tasks?select=*&owner_key=eq.${encodeURIComponent(state.plannerKey)}&order=created_at.desc`
    );
    state.syncError = "";
    state.syncMessage = `Loaded ${rows.length} task${rows.length === 1 ? "" : "s"} from Supabase. ${keyLabel()}.`;
    state.tasks = ensureSortOrders(rows.map(normalizeTask));
    render();
  } catch (error) {
    state.syncError = error.message;
    state.syncMessage = "";
    render();
    console.error("Supabase load failed", error);
  }
}

async function persistTask(task) {
  if (!isSupabaseReady()) {
    const index = state.tasks.findIndex((item) => item.id === task.id);
    if (index >= 0) state.tasks[index] = task;
    else state.tasks.unshift(task);
    ensureSortOrders(state.tasks);
    saveLocal();
    render();
    return;
  }

  const payload = databasePayload(task);
  try {
    const rows = await supabaseRequest("planner_tasks", {
      method: "POST",
      headers: { prefer: "resolution=merge-duplicates,return=representation" },
      body: JSON.stringify(payload)
    });
    state.syncError = "";
    state.syncMessage = `Saved to Supabase. ${keyLabel()}.`;
    const saved = normalizeTask(rows[0]);
    const index = state.tasks.findIndex((item) => item.id === saved.id);
    if (index >= 0) state.tasks[index] = saved;
    else state.tasks.unshift(saved);
    ensureSortOrders(state.tasks);
    render();
  } catch (error) {
    state.syncError = error.message;
    state.syncMessage = "";
    render();
    console.error("Supabase save failed", error);
  }
}

async function patchTask(id, changes) {
  const current = state.tasks.find((task) => task.id === id);
  if (!current) return;
  const updated = normalizeTask({ ...current, ...changes, updated_at: nowIso() });

  if (!isSupabaseReady()) {
    state.tasks = state.tasks.map((task) => (task.id === id ? updated : task));
    ensureSortOrders(state.tasks);
    saveLocal();
    render();
    return;
  }

  try {
    const rows = await supabaseRequest(`planner_tasks?id=eq.${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify(databasePatchPayload({ ...changes, updated_at: updated.updated_at }))
    });
    state.syncError = "";
    state.syncMessage = `Updated in Supabase. ${keyLabel()}.`;
    state.tasks = state.tasks.map((task) => (task.id === id ? normalizeTask(rows[0]) : task));
    ensureSortOrders(state.tasks);
    render();
  } catch (error) {
    state.syncError = error.message;
    state.syncMessage = "";
    render();
    console.error("Supabase update failed", error);
  }
}

async function deleteTask(id) {
  const ids = [id, ...descendantIds(id)];
  if (!isSupabaseReady()) {
    state.tasks = state.tasks.filter((task) => !ids.includes(task.id));
    saveLocal();
    render();
    return;
  }

  try {
    await supabaseRequest(`planner_tasks?id=in.(${ids.map(encodeURIComponent).join(",")})`, { method: "DELETE" });
    state.syncError = "";
    state.syncMessage = `Deleted from Supabase. ${keyLabel()}.`;
    state.tasks = state.tasks.filter((task) => !ids.includes(task.id));
    render();
  } catch (error) {
    state.syncError = error.message;
    state.syncMessage = "";
    render();
    console.error("Supabase delete failed", error);
  }
}

function childMap() {
  const map = new Map();
  const ids = new Set(state.tasks.map((task) => task.id));
  for (const task of state.tasks) {
    const parent = task.parent_id && ids.has(task.parent_id) ? task.parent_id : "";
    if (!map.has(parent)) map.set(parent, []);
    map.get(parent).push(task);
  }
  return map;
}

function descendantIds(id) {
  const map = childMap();
  const ids = [];
  const visit = (parentId) => {
    for (const child of map.get(parentId) || []) {
      ids.push(child.id);
      visit(child.id);
    }
  };
  visit(id);
  return ids;
}

function taskBucket(task) {
  const today = todayIso();
  if (task.status === "done" && !state.showDone) return "done";
  if (!task.due_date) return "backlog";
  if (task.due_date <= today) return "today";
  return "upcoming";
}

function filteredTasks() {
  const search = state.search.trim().toLowerCase();
  const priorityOrder = { High: 0, Medium: 1, Low: 2 };

  return state.tasks
    .filter((task) => {
      if (state.view === "graph" || state.view === "timeline") return task.status !== "done" || state.showDone;
      if (state.view === "done") return task.status === "done";
      if (task.status === "done" && !state.showDone) return false;
      return taskBucket(task) === state.view;
    })
    .filter((task) => {
      if (!search) return true;
      return `${task.title} ${task.notes} ${task.area} ${task.tags.join(" ")}`.toLowerCase().includes(search);
    })
    .filter((task) => {
      if (!state.tagFilter) return true;
      return task.tags.includes(state.tagFilter);
    })
    .sort((a, b) => {
      if (state.sort === "priority") return priorityOrder[a.priority] - priorityOrder[b.priority];
      if (state.sort === "created") return new Date(b.created_at) - new Date(a.created_at);
      return (a.due_date || "9999-12-31").localeCompare(b.due_date || "9999-12-31");
    });
}

function visibleTaskIds() {
  const visible = new Set();
  const byId = new Map(state.tasks.map((task) => [task.id, task]));
  for (const task of filteredTasks()) {
    let current = task;
    while (current) {
      visible.add(current.id);
      current = current.parent_id ? byId.get(current.parent_id) : null;
    }
  }
  return visible;
}

function sortedSiblings(tasks) {
  const priorityOrder = { High: 0, Medium: 1, Low: 2 };
  return [...tasks].sort((a, b) => {
    if (state.sort === "manual") {
      if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
      return new Date(a.created_at) - new Date(b.created_at);
    }
    if (state.sort === "priority") return priorityOrder[a.priority] - priorityOrder[b.priority];
    if (state.sort === "created") return new Date(b.created_at) - new Date(a.created_at);
    return (a.due_date || "9999-12-31").localeCompare(b.due_date || "9999-12-31");
  });
}

function renderCounts() {
  const bucketCounts = { today: 0, upcoming: 0, backlog: 0, done: 0 };
  for (const task of state.tasks) bucketCounts[taskBucket(task)] += 1;

  counts.today.textContent = bucketCounts.today;
  counts.upcoming.textContent = bucketCounts.upcoming;
  counts.backlog.textContent = bucketCounts.backlog;
  counts.done.textContent = bucketCounts.done;
  counts.graph.textContent = state.tasks.filter((task) => task.status !== "done" || state.showDone).length;
  counts.timeline.textContent = state.tasks.filter((task) => task.status !== "done" || state.showDone).length;
  counts.open.textContent = state.tasks.filter((task) => task.status !== "done").length;
  counts.focus.textContent = state.tasks.filter((task) => task.status !== "done" && task.priority === "High").length;
}

function renderTagFilters() {
  const tags = [...new Set(state.tasks.flatMap((task) => task.tags))].sort((a, b) => a.localeCompare(b));
  els.tagFilters.innerHTML = "";
  for (const tag of ["", ...tags]) {
    const button = document.createElement("button");
    button.className = `tag-filter ${state.tagFilter === tag ? "active" : ""}`;
    button.type = "button";
    button.dataset.tag = tag;
    button.textContent = tag || "All";
    els.tagFilters.append(button);
  }
}

function renderAreas() {
  const selectedArea = els.area.value || "Life";
  const selectedDetailArea = detail.area.value || "Life";
  for (const select of [els.area, detail.area]) {
    select.innerHTML = "";
    for (const area of state.areas) {
      const option = document.createElement("option");
      option.value = area.name;
      option.textContent = area.name;
      select.append(option);
    }
  }
  els.area.value = state.areas.some((area) => area.name === selectedArea) ? selectedArea : state.areas[0]?.name || "Life";
  detail.area.value = state.areas.some((area) => area.name === selectedDetailArea) ? selectedDetailArea : state.areas[0]?.name || "Life";

  els.areaList.innerHTML = "";
  for (const area of state.areas) {
    const row = document.createElement("div");
    row.className = "area-row";
    row.innerHTML = `
      <input class="area-name-input" type="text">
      <input class="area-color-input" type="color" aria-label="Area color">
    `;
    row.dataset.area = area.name;
    row.querySelector(".area-name-input").value = area.name;
    row.querySelector(".area-color-input").value = area.color;
    els.areaList.append(row);
  }
}

function renderParentControls() {
  fillParentSelect(document.querySelector("#parent-id"), "", "");
  if (state.selectedId) {
    const task = state.tasks.find((item) => item.id === state.selectedId);
    fillParentSelect(detail.parent, task?.parent_id || "", state.selectedId);
  }
}

function renderTasks() {
  if (state.view === "graph") {
    renderGraphView();
    return;
  }
  if (state.view === "timeline") {
    renderTimelineView();
    return;
  }

  const visible = visibleTaskIds();
  els.taskList.innerHTML = "";

  if (!visible.size) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "Nothing here right now.";
    els.taskList.append(empty);
    return;
  }

  const children = childMap();
  const renderBranch = (parentId, depth) => {
    for (const task of sortedSiblings(children.get(parentId) || [])) {
      if (!visible.has(task.id)) continue;
      renderTask(task, depth, children.get(task.id)?.length || 0);
      renderBranch(task.id, depth + 1);
    }
  };

  renderBranch("", 0);
}

function renderTask(task, depth, childCount) {
    const button = document.createElement("div");
    button.className = `task-item ${task.id === state.selectedId ? "active" : ""} ${task.status === "done" ? "done" : ""} depth-${Math.min(depth, 5)}`;
    button.dataset.id = task.id;
    button.draggable = true;
    button.role = "button";
    button.tabIndex = 0;
    button.style.setProperty("--depth", depth);

    const color = areaColor(task.area);
    button.innerHTML = `
      <div class="task-line">
        <button class="check" type="button" aria-label="${task.status === "done" ? "Reopen task" : "Mark task done"}"></button>
        <div>
          <div class="task-title"><span class="task-title-text"></span></div>
          ${task.notes ? '<p class="task-notes"></p>' : ""}
        </div>
      </div>
      <div class="meta">
        <span class="pill area"></span>
        <span class="pill ${task.priority.toLowerCase()}"></span>
        <span class="pill"></span>
        <span class="pill"></span>
        ${childCount ? '<span class="pill branch-pill"></span>' : ""}
      </div>
      ${task.tags.length ? '<div class="task-tags"></div>' : ""}
    `;

    button.querySelector(".task-title-text").textContent = task.title;
    const notes = button.querySelector(".task-notes");
    if (notes) notes.textContent = task.notes;
    const pills = button.querySelectorAll(".pill");
    pills[0].textContent = task.area;
    pills[0].style.borderLeft = `4px solid ${color}`;
    button.style.borderLeft = `6px solid ${color}`;
    pills[1].textContent = task.priority;
    pills[2].textContent = formatDate(task.due_date);
    pills[3].textContent = `${task.energy} energy`;
    if (childCount) pills[4].textContent = `${childCount} subtask${childCount === 1 ? "" : "s"}`;
    const tagContainer = button.querySelector(".task-tags");
    if (tagContainer) {
      for (const tag of task.tags) {
        const chip = document.createElement("span");
        chip.className = "tag-chip";
        chip.textContent = tag;
        tagContainer.append(chip);
      }
    }
    els.taskList.append(button);
}

function taskMatchesGlobalFilters(task) {
  const search = state.search.trim().toLowerCase();
  if (task.status === "done" && !state.showDone) return false;
  if (state.tagFilter && !task.tags.includes(state.tagFilter)) return false;
  if (!search) return true;
  return `${task.title} ${task.notes} ${task.area} ${task.tags.join(" ")}`.toLowerCase().includes(search);
}

function makeMiniTask(task) {
  const node = document.createElement("button");
  node.className = `mini-task ${task.id === state.selectedId ? "active" : ""} ${task.status === "done" ? "done" : ""}`;
  node.type = "button";
  node.dataset.id = task.id;
  node.style.borderLeftColor = areaColor(task.area);
  node.innerHTML = `
    <span class="mini-title"></span>
    <span class="mini-meta"></span>
  `;
  node.querySelector(".mini-title").textContent = task.title;
  node.querySelector(".mini-meta").textContent = `${task.area} · ${formatDate(task.due_date)}`;
  return node;
}

function renderGraphView() {
  els.taskList.innerHTML = "";
  const visible = new Set(state.tasks.filter(taskMatchesGlobalFilters).map((task) => task.id));
  const byId = new Map(state.tasks.map((task) => [task.id, task]));
  for (const task of state.tasks) {
    let current = task;
    while (visible.has(task.id) && current?.parent_id) {
      visible.add(current.parent_id);
      current = byId.get(current.parent_id);
    }
  }

  if (!visible.size) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "Nothing here right now.";
    els.taskList.append(empty);
    return;
  }

  const graph = document.createElement("div");
  graph.className = "graph-view";
  const children = childMap();
  const renderBranch = (parentId, container) => {
    for (const task of sortedSiblings(children.get(parentId) || [])) {
      if (!visible.has(task.id)) continue;
      const branch = document.createElement("div");
      branch.className = "graph-branch";
      branch.append(makeMiniTask(task));
      const childContainer = document.createElement("div");
      childContainer.className = "graph-children";
      renderBranch(task.id, childContainer);
      if (childContainer.children.length) branch.append(childContainer);
      container.append(branch);
    }
  };
  renderBranch("", graph);
  els.taskList.append(graph);
}

function renderTimelineView() {
  els.taskList.innerHTML = "";
  const tasks = state.tasks
    .filter(taskMatchesGlobalFilters)
    .sort((a, b) => (a.due_date || "9999-12-31").localeCompare(b.due_date || "9999-12-31") || a.sort_order - b.sort_order);

  if (!tasks.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "Nothing here right now.";
    els.taskList.append(empty);
    return;
  }

  const timeline = document.createElement("div");
  timeline.className = "timeline-view";
  const groups = new Map();
  for (const task of tasks) {
    const key = task.due_date || "No date";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(task);
  }

  for (const [date, items] of groups) {
    const group = document.createElement("section");
    group.className = "timeline-group";
    const label = document.createElement("h4");
    label.textContent = date === "No date" ? "No date" : formatDate(date);
    group.append(label);
    const list = document.createElement("div");
    list.className = "timeline-items";
    for (const task of items) list.append(makeMiniTask(task));
    group.append(list);
    timeline.append(group);
  }
  els.taskList.append(timeline);
}

function renderDetail() {
  const task = state.tasks.find((item) => item.id === state.selectedId);

  if (!task) {
    els.emptyDetail.classList.remove("hidden");
    els.detailForm.classList.add("hidden");
    return;
  }

  els.emptyDetail.classList.add("hidden");
  els.detailForm.classList.remove("hidden");
  detail.id.value = task.id;
  detail.title.value = task.title;
  detail.notes.value = task.notes;
  detail.parent.value = task.parent_id || "";
  detail.tags.value = task.tags.join(", ");
  detail.area.value = task.area;
  detail.priority.value = task.priority;
  detail.due.value = task.due_date || "";
  detail.energy.value = task.energy;
  els.completeButton.textContent = task.status === "done" ? "Reopen" : "Done";
}

function render() {
  const label = new Intl.DateTimeFormat(undefined, { weekday: "long", month: "long", day: "numeric" }).format(new Date());
  const titles = { today: "Today", upcoming: "Upcoming", backlog: "Backlog", done: "Done", graph: "Graph", timeline: "Timeline" };

  document.documentElement.style.setProperty("--detail-width", `${state.detailWidth}px`);
  els.todayLabel.textContent = label;
  els.viewTitle.textContent = titles[state.view];
  els.boardTitle.textContent = `${titles[state.view]} tasks`;
  els.storageStatus.textContent = isSupabaseReady() ? "Supabase database" : "Local storage";
  els.appVersion.textContent = `Version ${APP_VERSION}`;
  els.showDone.checked = state.showDone;
  els.storageStatus.title = state.syncError || "";
  els.storageStatus.textContent = state.syncError ? "Database error" : els.storageStatus.textContent;
  if (state.syncMessage && !state.syncError) {
    els.syncStatus.textContent = state.syncMessage;
    els.syncStatus.classList.remove("hidden");
  } else {
    els.syncStatus.textContent = "";
    els.syncStatus.classList.add("hidden");
  }
  if (state.syncError) {
    els.syncError.textContent = `Database error: ${state.syncError}`;
    els.syncError.classList.remove("hidden");
  } else {
    els.syncError.textContent = "";
    els.syncError.classList.add("hidden");
  }
  document.querySelectorAll(".view-button").forEach((button) => {
    button.classList.toggle("active", button.dataset.view === state.view);
  });

  renderCounts();
  renderTagFilters();
  renderAreas();
  renderParentControls();
  renderTasks();
  renderDetail();
}

function toggleTaskStatus(id) {
  const task = state.tasks.find((item) => item.id === id);
  if (!task) return;
  const done = task.status !== "done";
  return patchTask(task.id, { status: done ? "done" : "active", completed_at: done ? nowIso() : null });
}

async function persistReorder(changedTasks) {
  if (!changedTasks.length) return;

  if (!isSupabaseReady()) {
    state.tasks = state.tasks.map((task) => changedTasks.find((changed) => changed.id === task.id) || task);
    saveLocal();
    state.syncMessage = "Reordered locally in this browser only.";
    render();
    return;
  }

  try {
    await Promise.all(
      changedTasks.map((task) =>
        supabaseRequest(`planner_tasks?id=eq.${encodeURIComponent(task.id)}`, {
          method: "PATCH",
          body: JSON.stringify(databasePatchPayload({ sort_order: task.sort_order, updated_at: nowIso() }))
        })
      )
    );
    state.syncError = "";
    state.syncMessage = `Reordered in Supabase. ${keyLabel()}.`;
    render();
  } catch (error) {
    state.syncError = error.message;
    state.syncMessage = "";
    render();
    console.error("Supabase reorder failed", error);
  }
}

async function reorderTask(draggedId, targetId, placement) {
  if (!draggedId || !targetId || draggedId === targetId) return;
  const dragged = state.tasks.find((task) => task.id === draggedId);
  const target = state.tasks.find((task) => task.id === targetId);
  if (!dragged || !target) return;

  if ((dragged.parent_id || "") !== (target.parent_id || "")) {
    state.syncError = "";
    state.syncMessage = "Drag reordering currently works among sibling tasks. To move a task under another parent, edit its Parent task field.";
    render();
    return;
  }

  const siblings = sortedSiblings(state.tasks.filter((task) => (task.parent_id || "") === (target.parent_id || "")));
  const withoutDragged = siblings.filter((task) => task.id !== draggedId);
  const targetIndex = withoutDragged.findIndex((task) => task.id === targetId);
  const insertIndex = placement === "after" ? targetIndex + 1 : targetIndex;
  withoutDragged.splice(insertIndex, 0, dragged);

  const changed = [];
  withoutDragged.forEach((task, index) => {
    const nextOrder = (index + 1) * 1000;
    if (task.sort_order !== nextOrder) {
      task.sort_order = nextOrder;
      task.updated_at = nowIso();
      changed.push(task);
    }
  });

  state.sort = "manual";
  els.sort.value = "manual";
  render();
  await persistReorder(changed);
}

els.taskForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = new FormData(els.taskForm);
  const task = normalizeTask({
    title: form.get("title").trim(),
    parent_id: form.get("parentId") || "",
    area: form.get("area") || "Life",
    priority: form.get("priority"),
    due_date: form.get("dueDate") || defaultDueDateForView(),
    tags: parseTags(form.get("tags")),
    energy: "Medium",
    sort_order: nextSortOrder(form.get("parentId") || "")
  });
  els.taskForm.reset();
  els.area.value = state.areas.some((area) => area.name === "Life") ? "Life" : state.areas[0]?.name || "";
  document.querySelector("#priority").value = "Medium";
  document.querySelector("#parent-id").value = "";
  state.selectedId = task.id;
  await persistTask(task);
});

els.taskList.addEventListener("click", (event) => {
  const mini = event.target.closest(".mini-task");
  if (mini) {
    state.selectedId = mini.dataset.id;
    render();
    return;
  }
  const check = event.target.closest(".check");
  if (check) {
    const item = check.closest(".task-item");
    if (item) {
      event.stopPropagation();
      toggleTaskStatus(item.dataset.id);
    }
    return;
  }
  const item = event.target.closest(".task-item");
  if (!item) return;
  state.selectedId = item.dataset.id;
  render();
});

els.taskList.addEventListener("keydown", (event) => {
  const item = event.target.closest(".task-item");
  if (!item) return;
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    state.selectedId = item.dataset.id;
    render();
  }
});

els.taskList.addEventListener("dragstart", (event) => {
  const item = event.target.closest(".task-item");
  if (!item) return;
  state.draggingId = item.dataset.id;
  item.classList.add("dragging");
  event.dataTransfer.effectAllowed = "move";
  event.dataTransfer.setData("text/plain", item.dataset.id);
});

els.taskList.addEventListener("dragover", (event) => {
  const item = event.target.closest(".task-item");
  if (!item || item.dataset.id === state.draggingId) return;
  event.preventDefault();
  const rect = item.getBoundingClientRect();
  const placement = event.clientY > rect.top + rect.height / 2 ? "after" : "before";
  item.classList.toggle("drag-over-after", placement === "after");
  item.classList.toggle("drag-over-before", placement === "before");
});

els.taskList.addEventListener("dragleave", (event) => {
  const item = event.target.closest(".task-item");
  if (!item) return;
  item.classList.remove("drag-over-before", "drag-over-after");
});

els.taskList.addEventListener("drop", async (event) => {
  const item = event.target.closest(".task-item");
  if (!item) return;
  event.preventDefault();
  const rect = item.getBoundingClientRect();
  const placement = event.clientY > rect.top + rect.height / 2 ? "after" : "before";
  document.querySelectorAll(".drag-over-before, .drag-over-after").forEach((node) => {
    node.classList.remove("drag-over-before", "drag-over-after");
  });
  await reorderTask(state.draggingId || event.dataTransfer.getData("text/plain"), item.dataset.id, placement);
});

els.taskList.addEventListener("dragend", () => {
  state.draggingId = null;
  document.querySelectorAll(".dragging, .drag-over-before, .drag-over-after").forEach((node) => {
    node.classList.remove("dragging", "drag-over-before", "drag-over-after");
  });
});

document.querySelectorAll(".view-button").forEach((button) => {
  button.addEventListener("click", () => {
    state.view = button.dataset.view;
    render();
  });
});

els.search.addEventListener("input", () => {
  state.search = els.search.value;
  renderTasks();
});

els.sort.addEventListener("change", () => {
  state.sort = els.sort.value;
  renderTasks();
});

els.showDone.addEventListener("change", () => {
  state.showDone = els.showDone.checked;
  localStorage.setItem("show-done", String(state.showDone));
  render();
});

els.tagFilters.addEventListener("click", (event) => {
  const button = event.target.closest(".tag-filter");
  if (!button) return;
  state.tagFilter = button.dataset.tag || "";
  render();
});

els.detailForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  await patchTask(detail.id.value, {
    title: detail.title.value.trim(),
    notes: detail.notes.value.trim(),
    parent_id: detail.parent.value || null,
    tags: parseTags(detail.tags.value),
    area: detail.area.value || "Life",
    priority: detail.priority.value,
    due_date: detail.due.value || null,
    energy: detail.energy.value
  });
});

els.manageAreasButton.addEventListener("click", () => {
  renderAreas();
  els.areasDialog.showModal();
});

els.addAreaButton.addEventListener("click", () => {
  const name = els.newAreaName.value.trim();
  if (!name) return;
  ensureArea(name, els.newAreaColor.value);
  els.newAreaName.value = "";
  render();
});

els.areaList.addEventListener("input", (event) => {
  const row = event.target.closest(".area-row");
  if (!row) return;
  const original = row.dataset.area;
  const area = state.areas.find((item) => item.name === original);
  if (!area) return;
  const nextName = row.querySelector(".area-name-input").value.trim();
  if (event.target.classList.contains("area-name-input") && nextName) {
    state.tasks = state.tasks.map((task) => task.area === area.name ? { ...task, area: nextName } : task);
    area.name = nextName;
    row.dataset.area = nextName;
  }
  if (event.target.classList.contains("area-color-input")) {
    area.color = event.target.value;
  }
  saveAreas();
  render();
});

els.completeButton.addEventListener("click", async () => {
  const task = state.tasks.find((item) => item.id === state.selectedId);
  if (!task) return;
  const done = task.status !== "done";
  await patchTask(task.id, { status: done ? "done" : "active", completed_at: done ? nowIso() : null });
});

els.subtaskButton.addEventListener("click", async () => {
  const parent = state.tasks.find((item) => item.id === state.selectedId);
  if (!parent) return;
  const task = normalizeTask({
    title: `Subtask of ${parent.title}`,
    parent_id: parent.id,
    area: parent.area,
    priority: parent.priority,
    due_date: parent.due_date,
    tags: parent.tags,
    energy: parent.energy,
    sort_order: nextSortOrder(parent.id)
  });
  state.selectedId = task.id;
  await persistTask(task);
});

els.deleteButton.addEventListener("click", async () => {
  if (!state.selectedId) return;
  const id = state.selectedId;
  state.selectedId = null;
  await deleteTask(id);
});

els.syncButton.addEventListener("click", async () => {
  if (state.config?.supabaseUrl && state.config?.supabaseAnonKey && !state.plannerKey) {
    els.keyDialog.showModal();
    return;
  }
  await loadTasks();
});

els.keyButton.addEventListener("click", () => {
  els.plannerKey.value = "";
  els.keyDialog.showModal();
});

els.clearLocalButton.addEventListener("click", () => {
  localStorage.removeItem("planner-tasks");
  localStorage.removeItem("planner-key");
  state.plannerKey = "";
  state.selectedId = null;
  state.syncError = "";
  state.syncMessage = "Local browser data cleared. Enter your planner key and click Connect to use Supabase.";
  state.tasks = [];
  render();
});

els.keyForm.addEventListener("submit", async (event) => {
  const submitter = event.submitter?.value;
  if (submitter === "local") {
    state.plannerKey = "";
    localStorage.removeItem("planner-key");
    loadLocal();
    render();
    return;
  }
  if (submitter === "save") {
    state.plannerKey = els.plannerKey.value;
    localStorage.setItem("planner-key", state.plannerKey);
    await loadTasks();
  }
});

await loadConfig();
if (state.config?.supabaseUrl && state.config?.supabaseAnonKey && !state.plannerKey) {
  els.keyDialog.showModal();
}
await loadTasks();

let resizing = false;

els.resizeHandle.addEventListener("pointerdown", (event) => {
  resizing = true;
  els.resizeHandle.setPointerCapture(event.pointerId);
  document.body.classList.add("resizing");
});

els.resizeHandle.addEventListener("pointermove", (event) => {
  if (!resizing) return;
  const grid = document.querySelector(".planner-grid").getBoundingClientRect();
  state.detailWidth = Math.min(620, Math.max(280, grid.right - event.clientX));
  document.documentElement.style.setProperty("--detail-width", `${state.detailWidth}px`);
});

els.resizeHandle.addEventListener("pointerup", (event) => {
  if (!resizing) return;
  resizing = false;
  localStorage.setItem("detail-width", String(Math.round(state.detailWidth)));
  els.resizeHandle.releasePointerCapture(event.pointerId);
  document.body.classList.remove("resizing");
});
