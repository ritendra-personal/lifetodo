const state = {
  tasks: [],
  selectedId: null,
  view: "today",
  search: "",
  tagFilter: "",
  sort: "due",
  config: null,
  plannerKey: localStorage.getItem("planner-key") || ""
};

const els = {
  storageStatus: document.querySelector("#storage-status"),
  todayLabel: document.querySelector("#today-label"),
  viewTitle: document.querySelector("#view-title"),
  boardTitle: document.querySelector("#board-title"),
  taskList: document.querySelector("#task-list"),
  taskForm: document.querySelector("#task-form"),
  search: document.querySelector("#search"),
  sort: document.querySelector("#sort"),
  tagFilters: document.querySelector("#tag-filters"),
  syncButton: document.querySelector("#sync-button"),
  detailForm: document.querySelector("#detail-form"),
  emptyDetail: document.querySelector("#empty-detail"),
  keyDialog: document.querySelector("#key-dialog"),
  keyForm: document.querySelector("#key-form"),
  plannerKey: document.querySelector("#planner-key"),
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
  open: document.querySelector("#stat-open"),
  focus: document.querySelector("#stat-focus")
};

const areaColors = {
  Work: "#476c9b",
  Health: "#0e7c74",
  Money: "#b1791f",
  Home: "#7b5ea7",
  Creative: "#d85b49",
  Life: "#667085"
};

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
    tags: parseTags(task.tags)
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
  return payload;
}

function isSupabaseReady() {
  return Boolean(state.config?.supabaseUrl && state.config?.supabaseAnonKey && state.plannerKey);
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
    authorization: `Bearer ${state.config.supabaseAnonKey}`,
    "x-planner-key": state.plannerKey,
    "content-type": "application/json",
    prefer: "return=representation",
    ...(options.headers || {})
  };

  const response = await fetch(`${base}/rest/v1/${path}`, { ...options, headers });
  if (!response.ok) {
    throw new Error(await response.text());
  }
  return response.status === 204 ? null : response.json();
}

function loadLocal() {
  const raw = localStorage.getItem("planner-tasks");
  state.tasks = raw ? JSON.parse(raw).map(normalizeTask) : seedTasks();
  saveLocal();
}

function saveLocal() {
  localStorage.setItem("planner-tasks", JSON.stringify(state.tasks));
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
      energy: "Low"
    }),
    normalizeTask({
      title: "Set up Supabase database",
      notes: "Run the schema and add Vercel environment variables.",
      tags: ["setup", "database"],
      area: "Work",
      priority: "Medium",
      due_date: tomorrow.toISOString().slice(0, 10),
      energy: "Medium"
    })
  ];
}

async function loadTasks() {
  if (!isSupabaseReady()) {
    loadLocal();
    render();
    return;
  }

  const rows = await supabaseRequest(
    `planner_tasks?select=*&owner_key=eq.${encodeURIComponent(state.plannerKey)}&order=created_at.desc`
  );
  state.tasks = rows.map(normalizeTask);
  render();
}

async function persistTask(task) {
  if (!isSupabaseReady()) {
    const index = state.tasks.findIndex((item) => item.id === task.id);
    if (index >= 0) state.tasks[index] = task;
    else state.tasks.unshift(task);
    saveLocal();
    render();
    return;
  }

  const payload = databasePayload(task);
  const rows = await supabaseRequest("planner_tasks", {
    method: "POST",
    headers: { prefer: "resolution=merge-duplicates,return=representation" },
    body: JSON.stringify(payload)
  });
  const saved = normalizeTask(rows[0]);
  const index = state.tasks.findIndex((item) => item.id === saved.id);
  if (index >= 0) state.tasks[index] = saved;
  else state.tasks.unshift(saved);
  render();
}

async function patchTask(id, changes) {
  const current = state.tasks.find((task) => task.id === id);
  if (!current) return;
  const updated = normalizeTask({ ...current, ...changes, updated_at: nowIso() });

  if (!isSupabaseReady()) {
    state.tasks = state.tasks.map((task) => (task.id === id ? updated : task));
    saveLocal();
    render();
    return;
  }

  const rows = await supabaseRequest(`planner_tasks?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(databasePatchPayload({ ...changes, updated_at: updated.updated_at }))
  });
  state.tasks = state.tasks.map((task) => (task.id === id ? normalizeTask(rows[0]) : task));
  render();
}

async function deleteTask(id) {
  const ids = [id, ...descendantIds(id)];
  if (!isSupabaseReady()) {
    state.tasks = state.tasks.filter((task) => !ids.includes(task.id));
    saveLocal();
    render();
    return;
  }

  await supabaseRequest(`planner_tasks?id=in.(${ids.map(encodeURIComponent).join(",")})`, { method: "DELETE" });
  state.tasks = state.tasks.filter((task) => !ids.includes(task.id));
  render();
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
  if (task.status === "done") return "done";
  if (!task.due_date) return "backlog";
  if (task.due_date <= today) return "today";
  return "upcoming";
}

function filteredTasks() {
  const search = state.search.trim().toLowerCase();
  const priorityOrder = { High: 0, Medium: 1, Low: 2 };

  return state.tasks
    .filter((task) => taskBucket(task) === state.view)
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

function renderParentControls() {
  fillParentSelect(document.querySelector("#parent-id"), "", "");
  if (state.selectedId) {
    const task = state.tasks.find((item) => item.id === state.selectedId);
    fillParentSelect(detail.parent, task?.parent_id || "", state.selectedId);
  }
}

function renderTasks() {
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
    const button = document.createElement("button");
    button.className = `task-item ${task.id === state.selectedId ? "active" : ""} depth-${Math.min(depth, 5)}`;
    button.type = "button";
    button.dataset.id = task.id;
    button.style.setProperty("--depth", depth);

    const areaColor = areaColors[task.area] || areaColors.Life;
    button.innerHTML = `
      <div class="task-line">
        <span class="check" aria-hidden="true"></span>
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
    pills[0].style.borderLeft = `4px solid ${areaColor}`;
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
  const titles = { today: "Today", upcoming: "Upcoming", backlog: "Backlog", done: "Done" };

  els.todayLabel.textContent = label;
  els.viewTitle.textContent = titles[state.view];
  els.boardTitle.textContent = `${titles[state.view]} tasks`;
  els.storageStatus.textContent = isSupabaseReady() ? "Supabase database" : "Local storage";
  document.querySelectorAll(".view-button").forEach((button) => {
    button.classList.toggle("active", button.dataset.view === state.view);
  });

  renderCounts();
  renderTagFilters();
  renderParentControls();
  renderTasks();
  renderDetail();
}

els.taskForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = new FormData(els.taskForm);
  const task = normalizeTask({
    title: form.get("title").trim(),
    parent_id: form.get("parentId") || "",
    area: form.get("area"),
    priority: form.get("priority"),
    due_date: form.get("dueDate") || defaultDueDateForView(),
    tags: parseTags(form.get("tags")),
    energy: "Medium"
  });
  els.taskForm.reset();
  document.querySelector("#area").value = "Life";
  document.querySelector("#priority").value = "Medium";
  document.querySelector("#parent-id").value = "";
  state.selectedId = task.id;
  await persistTask(task);
});

els.taskList.addEventListener("click", (event) => {
  const item = event.target.closest(".task-item");
  if (!item) return;
  state.selectedId = item.dataset.id;
  render();
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
    area: detail.area.value,
    priority: detail.priority.value,
    due_date: detail.due.value || null,
    energy: detail.energy.value
  });
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
    energy: parent.energy
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

els.keyForm.addEventListener("submit", async (event) => {
  const submitter = event.submitter?.value;
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
