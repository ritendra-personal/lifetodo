import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const APP_VERSION = "1.5.0";

const densityOptions = ["compact", "comfort", "roomy"];
const densityLabels = { compact: "Compact", comfort: "Comfort", roomy: "Roomy" };
const autosaveTimers = new Map();

const defaultAreas = [
  { name: "Life", color: "#476c9b" },
  { name: "Work", color: "#0e7c74" },
  { name: "Health", color: "#2f855a" },
  { name: "Money", color: "#b1791f" },
  { name: "Home", color: "#7b5ea7" },
  { name: "Creative", color: "#d85b49" }
];

const defaultSkills = ["Acting", "AI", "Writing"].map((name, index) => ({ name, sort_order: (index + 1) * 1000 }));
const defaultRelationshipTypes = ["Strong", "OK", "Bad"].map((name, index) => ({ name, sort_order: (index + 1) * 1000 }));

const state = {
  tasks: [],
  goals: [],
  ideas: [],
  people: [],
  skills: loadNamedOptions("planner-skills", defaultSkills),
  relationshipTypes: loadNamedOptions("planner-relationship-types", defaultRelationshipTypes),
  selectedAssignmentTaskId: "",
  selectedId: null,
  view: "today",
  search: "",
  tagFilter: "",
  sort: "manual",
  showDone: localStorage.getItem("show-done") === "true",
  density: densityOptions.includes(localStorage.getItem("planner-density")) ? localStorage.getItem("planner-density") : "comfort",
  draggingId: null,
  syncError: "",
  syncMessage: "",
  peopleCloudReady: false,
  config: null,
  supabase: null,
  session: null,
  user: null,
  areas: loadAreas(),
  plannerKey: localStorage.getItem("planner-key") || "",
  timelineZoom: Number(localStorage.getItem("timeline-zoom") || 42),
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
  entryPanel: document.querySelector("#entry-panel"),
  plannerGrid: document.querySelector("#planner-grid"),
  area: document.querySelector("#area"),
  goal: document.querySelector("#goal-id"),
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
  densityDown: document.querySelector("#density-down"),
  densityUp: document.querySelector("#density-up"),
  densityLabel: document.querySelector("#density-label"),
  resizeHandle: document.querySelector("#resize-handle"),
  detailForm: document.querySelector("#detail-form"),
  emptyDetail: document.querySelector("#empty-detail"),
  completeButton: document.querySelector("#complete-button"),
  subtaskButton: document.querySelector("#subtask-button"),
  deleteButton: document.querySelector("#delete-button")
};

const detail = {
  id: document.querySelector("#detail-id"),
  title: document.querySelector("#detail-title"),
  notes: document.querySelector("#detail-notes"),
  parent: document.querySelector("#detail-parent"),
  goal: document.querySelector("#detail-goal"),
  dependencies: document.querySelector("#detail-dependencies"),
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
  goals: document.querySelector("#count-goals"),
  goalAssignments: document.querySelector("#count-goal-assignments"),
  people: document.querySelector("#count-people"),
  ideas: document.querySelector("#count-ideas"),
  graph: document.querySelector("#count-graph"),
  timeline: document.querySelector("#count-timeline"),
  areas: document.querySelector("#count-areas"),
  skills: document.querySelector("#count-skills"),
  relationships: document.querySelector("#count-relationships"),
  open: document.querySelector("#stat-open"),
  focus: document.querySelector("#stat-focus")
};

function loadAreas() {
  const raw = localStorage.getItem("planner-areas");
  if (!raw) return defaultAreas.map(normalizeArea);
  try {
    const parsed = JSON.parse(raw);
    return (parsed.length ? parsed : defaultAreas).map(normalizeArea);
  } catch {
    return defaultAreas.map(normalizeArea);
  }
}

function loadNamedOptions(key, defaults) {
  const raw = localStorage.getItem(key);
  try {
    const parsed = raw ? JSON.parse(raw) : defaults;
    return (parsed.length ? parsed : defaults).map(normalizeNamedOption);
  } catch {
    return defaults.map(normalizeNamedOption);
  }
}

function saveAreas() {
  localStorage.setItem("planner-areas", JSON.stringify(state.areas));
}

function saveNamedOptions() {
  localStorage.setItem("planner-skills", JSON.stringify(state.skills));
  localStorage.setItem("planner-relationship-types", JSON.stringify(state.relationshipTypes));
}

function setDensity(density) {
  state.density = densityOptions.includes(density) ? density : "comfort";
  localStorage.setItem("planner-density", state.density);
  document.body.dataset.density = state.density;
  if (els.densityLabel) els.densityLabel.textContent = densityLabels[state.density];
  if (els.densityDown) els.densityDown.disabled = state.density === densityOptions[0];
  if (els.densityUp) els.densityUp.disabled = state.density === densityOptions[densityOptions.length - 1];
}

function adjustDensity(direction) {
  const current = densityOptions.indexOf(state.density);
  const next = Math.min(densityOptions.length - 1, Math.max(0, current + direction));
  setDensity(densityOptions[next]);
}

function savedAtLabel() {
  return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(new Date());
}

function renderSyncStatus() {
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
}

function showSyncMessage(message) {
  state.syncError = "";
  state.syncMessage = message;
  renderSyncStatus();
}

function queueAutosave(key, callback) {
  clearTimeout(autosaveTimers.get(key));
  showSyncMessage("Autosave pending...");
  autosaveTimers.set(
    key,
    setTimeout(async () => {
      autosaveTimers.delete(key);
      showSyncMessage("Saving...");
      try {
        await callback();
        if (!state.syncError) showSyncMessage(`Saved at ${savedAtLabel()}.`);
        else renderSyncStatus();
      } catch (error) {
        state.syncError = error.message;
        renderSyncStatus();
      }
    }, 650)
  );
}

function areaColor(name) {
  return state.areas.find((area) => area.name === name)?.color || "#667085";
}

function areaById(id) {
  return state.areas.find((area) => area.id === id);
}

function areaByName(name) {
  return state.areas.find((area) => area.name === name);
}

function areaNameFor(item) {
  return areaById(item.area_id)?.name || item.area || "Life";
}

function areaIdForName(name) {
  return areaByName(name)?.id || "";
}

function areaIdForValue(value) {
  if (!value) return "";
  return areaById(value)?.id || areaIdForName(value);
}

function areaColorFor(item) {
  return areaById(item.area_id)?.color || areaColor(item.area);
}

function areaTintFor(item) {
  return areaTint(areaNameFor(item));
}

function areaTint(name) {
  const color = areaColor(name);
  const hex = color.replace("#", "");
  if (hex.length !== 6) return "rgba(102, 112, 133, 0.1)";
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, 0.11)`;
}

function ensureArea(name, color = "#667085") {
  const normalized = String(name || "").trim();
  if (!normalized) return null;
  if (!state.areas.some((area) => area.name.toLowerCase() === normalized.toLowerCase())) {
    const area = normalizeArea({ name: normalized, color, sort_order: nextAreaSortOrder() });
    state.areas.push(area);
    saveAreas();
    return area;
  }
  return state.areas.find((area) => area.name.toLowerCase() === normalized.toLowerCase()) || null;
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

function addDaysToIso(value, days) {
  const date = new Date(`${value}T12:00:00`);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function daysBetween(start, end) {
  const startDate = new Date(`${start}T12:00:00`);
  const endDate = new Date(`${end}T12:00:00`);
  return Math.round((endDate - startDate) / 86400000);
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

function parseIds(value) {
  if (Array.isArray(value)) return [...new Set(value.map((id) => String(id).trim()).filter(Boolean))];
  return [...new Set(String(value || "").split(",").map((id) => id.trim()).filter(Boolean))];
}

function normalizeGoal(goal) {
  return {
    id: goal.id || makeId(),
    user_id: goal.user_id || goal.userId || state.user?.id || null,
    name: goal.name || "",
    description: goal.description || "",
    created_at: goal.created_at || nowIso(),
    updated_at: goal.updated_at || nowIso()
  };
}

function normalizeIdea(idea) {
  const areaName = idea.area || "Life";
  return {
    id: idea.id || makeId(),
    user_id: idea.user_id || idea.userId || state.user?.id || null,
    text: idea.text || "",
    area_id: idea.area_id || idea.areaId || areaIdForName(areaName),
    area: areaName,
    created_at: idea.created_at || nowIso(),
    updated_at: idea.updated_at || nowIso()
  };
}

function normalizeArea(area, index = 0) {
  return {
    id: area.id || makeId(),
    name: area.name || "",
    color: area.color || "#667085",
    sort_order: Number(area.sort_order ?? area.sortOrder ?? index * 1000) || 0,
    created_at: area.created_at || nowIso(),
    updated_at: area.updated_at || nowIso()
  };
}

function normalizeNamedOption(option, index = 0) {
  if (typeof option === "string") option = { name: option };
  return {
    id: option.id || makeId(),
    name: option.name || "",
    sort_order: Number(option.sort_order ?? option.sortOrder ?? index * 1000) || 0,
    created_at: option.created_at || nowIso(),
    updated_at: option.updated_at || nowIso()
  };
}

function normalizePerson(person) {
  return {
    id: person.id || makeId(),
    user_id: person.user_id || person.userId || state.user?.id || null,
    first_name: person.first_name || person.firstName || "",
    last_name: person.last_name || person.lastName || "",
    skill_ids: parseIds(person.skill_ids || person.skillIds),
    relationship_type_id: person.relationship_type_id || person.relationshipTypeId || "",
    created_at: person.created_at || nowIso(),
    updated_at: person.updated_at || nowIso()
  };
}

function normalizeTask(task) {
  const order = Number(task.sort_order ?? task.sortOrder);
  const areaName = task.area || "Life";
  return {
    id: task.id || makeId(),
    owner_key: task.owner_key || state.plannerKey || "local",
    user_id: task.user_id || task.userId || null,
    goal_id: task.goal_id || task.goalId || "",
    parent_id: task.parent_id || task.parentId || "",
    title: task.title || "",
    notes: task.notes || "",
    tags: parseTags(task.tags),
    dependency_ids: parseIds(task.dependency_ids || task.dependencyIds),
    area_id: task.area_id || task.areaId || areaIdForName(areaName),
    area: areaName,
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
  const payload = {
    id: task.id,
    owner_key: state.plannerKey || state.user?.id || "local",
    user_id: state.user?.id || null,
    goal_id: task.goal_id || null,
    parent_id: task.parent_id || null,
    title: task.title,
    notes: task.notes,
    due_date: task.due_date || null,
    tags: parseTags(task.tags),
    area_id: task.area_id || areaIdForName(task.area) || null,
    area: areaNameFor(task),
    priority: task.priority,
    status: task.status,
    energy: task.energy,
    sort_order: task.sort_order || 0,
    created_at: task.created_at,
    updated_at: task.updated_at,
    completed_at: task.completed_at
  };
  if (task.dependency_ids?.length) payload.dependency_ids = parseIds(task.dependency_ids);
  return payload;
}

function databasePatchPayload(changes) {
  const payload = {};
  for (const [key, value] of Object.entries(changes)) {
    if (value !== undefined) payload[key] = value;
  }
  if ("parent_id" in payload) payload.parent_id = payload.parent_id || null;
  if ("goal_id" in payload) payload.goal_id = payload.goal_id || null;
  if ("due_date" in payload) payload.due_date = payload.due_date || null;
  if ("area_id" in payload) payload.area_id = payload.area_id || null;
  if ("area" in payload) payload.area = areaNameFor(payload);
  if ("tags" in payload) payload.tags = parseTags(payload.tags);
  if ("dependency_ids" in payload) payload.dependency_ids = parseIds(payload.dependency_ids);
  if ("sort_order" in payload) payload.sort_order = Number(payload.sort_order) || 0;
  return payload;
}

function isSupabaseReady() {
  return Boolean(state.supabase && state.user);
}

function keyLabel() {
  return state.user?.email || "Not signed in";
}

async function loadConfig() {
  try {
    const response = await fetch("/api/config");
    state.config = response.ok ? await response.json() : {};
  } catch {
    state.config = {};
  }
}

async function initSupabase() {
  if (!state.config?.supabaseUrl || !state.config?.supabaseAnonKey) return;
  state.supabase = createClient(state.config.supabaseUrl, state.config.supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    }
  });
  const { data } = await state.supabase.auth.getSession();
  state.session = data.session;
  state.user = data.session?.user || null;
  state.supabase.auth.onAuthStateChange(async (_event, session) => {
    state.session = session;
    state.user = session?.user || null;
    state.selectedId = null;
    await claimLegacyTasks();
    await loadTasks();
  });
}

async function signInWithGoogle() {
  if (!state.supabase) {
    state.syncError = "Supabase is not configured yet.";
    render();
    return;
  }
  const { error } = await state.supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: window.location.origin }
  });
  if (error) {
    state.syncError = error.message;
    render();
  }
}

async function signOut() {
  if (!state.supabase) return;
  await state.supabase.auth.signOut();
  state.session = null;
  state.user = null;
  state.tasks = [];
  state.selectedId = null;
  loadLocal();
}

async function claimLegacyTasks() {
  if (!state.supabase || !state.user || !state.plannerKey) return;
  try {
    const { data, error } = await state.supabase.rpc("claim_planner_tasks", {
      legacy_owner_key: state.plannerKey
    });
    if (error) throw error;
    if (data) {
      state.syncMessage = `Moved ${data} legacy task${data === 1 ? "" : "s"} into your Google login.`;
    }
  } catch (error) {
    console.warn("Legacy task claim failed", error);
  }
}

function loadLocal() {
  const raw = localStorage.getItem("planner-tasks");
  const rawGoals = localStorage.getItem("planner-goals");
  const rawIdeas = localStorage.getItem("planner-ideas");
  const rawPeople = localStorage.getItem("planner-people");
  state.tasks = ensureSortOrders(raw ? JSON.parse(raw).map(normalizeTask) : seedTasks());
  state.goals = rawGoals ? JSON.parse(rawGoals).map(normalizeGoal) : [];
  state.ideas = rawIdeas ? JSON.parse(rawIdeas).map(normalizeIdea) : [];
  state.people = rawPeople ? JSON.parse(rawPeople).map(normalizePerson) : [];
  state.syncError = "";
  state.syncMessage = "Using local browser storage. Click Key, enter your planner key, and click Connect to use Supabase.";
  saveLocal();
}

function saveLocal() {
  localStorage.setItem("planner-tasks", JSON.stringify(state.tasks));
  localStorage.setItem("planner-goals", JSON.stringify(state.goals));
  localStorage.setItem("planner-ideas", JSON.stringify(state.ideas));
  localStorage.setItem("planner-people", JSON.stringify(state.people));
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

function nextAreaSortOrder() {
  if (!state.areas.length) return 1000;
  return Math.max(...state.areas.map((area) => Number(area.sort_order) || 0)) + 1000;
}

function nextNamedOptionSortOrder(items) {
  if (!items.length) return 1000;
  return Math.max(...items.map((item) => Number(item.sort_order) || 0)) + 1000;
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

function fillDependencySelect(select, selected = [], excludeId = "") {
  const values = new Set(parseIds(selected).filter((id) => id !== excludeId));
  select.innerHTML = "";
  for (const task of state.tasks.filter((item) => item.id !== excludeId).sort((a, b) => a.title.localeCompare(b.title))) {
    const option = document.createElement("option");
    option.value = task.id;
    option.textContent = task.title;
    option.selected = values.has(task.id);
    select.append(option);
  }
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
    state.syncMessage = state.supabase
      ? "Working locally. Sign in with Google to sync your planner."
      : "Using local browser storage. Configure Supabase to enable Google sign-in.";
    render();
    return;
  }

  try {
    const { data: rows, error } = await state.supabase
      .from("planner_tasks")
      .select("*")
      .eq("user_id", state.user.id)
      .order("created_at", { ascending: false });
    if (error) throw error;
    const { data: goals, error: goalsError } = await state.supabase
      .from("planner_goals")
      .select("*")
      .eq("user_id", state.user.id)
      .order("created_at", { ascending: true });
    if (goalsError) throw goalsError;
    const { data: ideas, error: ideasError } = await state.supabase
      .from("planner_ideas")
      .select("*")
      .eq("user_id", state.user.id)
      .order("created_at", { ascending: false });
    if (ideasError) throw ideasError;
    let areas = [];
    const { data: areaRows, error: areasError } = await state.supabase
      .from("planner_areas")
      .select("*")
      .eq("user_id", state.user.id)
      .order("sort_order", { ascending: true });
    if (areasError) {
      console.warn("Supabase areas load failed; using local areas", areasError);
      state.syncMessage = "Areas are local until you run the latest Supabase schema.";
    } else {
      areas = areaRows.map(normalizeArea);
      if (!areas.length) {
        areas = state.areas.map((area, index) => normalizeArea(area, index));
        await Promise.all(areas.map((area) => persistArea(area, { render: false })));
      }
    }
    const peopleData = await loadPeopleData();
    state.syncError = "";
    state.syncMessage = state.syncMessage || `Loaded ${rows.length} task${rows.length === 1 ? "" : "s"} for ${keyLabel()}.`;
    if (areas.length) {
      state.areas = areas;
      saveAreas();
    }
    state.tasks = ensureSortOrders(rows.map(normalizeTask));
    state.goals = goals.map(normalizeGoal);
    state.ideas = ideas.map(normalizeIdea);
    if (peopleData) {
      state.people = peopleData.people;
      state.skills = peopleData.skills;
      state.relationshipTypes = peopleData.relationshipTypes;
      saveNamedOptions();
    }
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
    const { data: savedRow, error } = await state.supabase
      .from("planner_tasks")
      .upsert(payload)
      .select()
      .single();
    if (error) throw error;
    state.syncError = "";
    state.syncMessage = `Saved for ${keyLabel()}.`;
    const saved = normalizeTask(savedRow);
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

async function patchTask(id, changes, options = {}) {
  const current = state.tasks.find((task) => task.id === id);
  if (!current) return;
  const updated = normalizeTask({ ...current, ...changes, updated_at: nowIso() });

  if (!isSupabaseReady()) {
    state.tasks = state.tasks.map((task) => (task.id === id ? updated : task));
    ensureSortOrders(state.tasks);
    saveLocal();
    if (options.render !== false) render();
    return;
  }

  try {
    const { data: savedRow, error } = await state.supabase
      .from("planner_tasks")
      .update(databasePatchPayload({ ...changes, updated_at: updated.updated_at }))
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    state.syncError = "";
    state.syncMessage = `Updated for ${keyLabel()}.`;
    state.tasks = state.tasks.map((task) => (task.id === id ? normalizeTask(savedRow) : task));
    ensureSortOrders(state.tasks);
    if (options.render !== false) render();
  } catch (error) {
    state.syncError = error.message;
    state.syncMessage = "";
    if (options.render !== false) render();
    console.error("Supabase update failed", error);
  }
}

async function persistGoal(goal, options = {}) {
  const normalized = normalizeGoal({ ...goal, user_id: state.user?.id || null, updated_at: nowIso() });
  if (!isSupabaseReady()) {
    const exists = state.goals.some((item) => item.id === normalized.id);
    state.goals = exists
      ? state.goals.map((item) => (item.id === normalized.id ? normalized : item))
      : [normalized, ...state.goals];
    saveLocal();
    if (options.render !== false) render();
    return;
  }
  try {
    const { data, error } = await state.supabase.from("planner_goals").upsert(normalized).select().single();
    if (error) throw error;
    state.goals = [normalizeGoal(data), ...state.goals.filter((item) => item.id !== data.id)];
    state.syncMessage = `Saved goal for ${keyLabel()}.`;
    state.syncError = "";
    if (options.render !== false) render();
  } catch (error) {
    state.syncError = error.message;
    if (options.render !== false) render();
  }
}

async function persistIdea(idea, options = {}) {
  const normalized = normalizeIdea({ ...idea, user_id: state.user?.id || null, updated_at: nowIso() });
  if (!isSupabaseReady()) {
    const exists = state.ideas.some((item) => item.id === normalized.id);
    state.ideas = exists
      ? state.ideas.map((item) => (item.id === normalized.id ? normalized : item))
      : [normalized, ...state.ideas];
    saveLocal();
    if (options.render !== false) render();
    return;
  }
  try {
    const { data, error } = await state.supabase.from("planner_ideas").upsert(normalized).select().single();
    if (error) throw error;
    state.ideas = [normalizeIdea(data), ...state.ideas.filter((item) => item.id !== data.id)];
    state.syncMessage = `Saved idea for ${keyLabel()}.`;
    state.syncError = "";
    if (options.render !== false) render();
  } catch (error) {
    state.syncError = error.message;
    if (options.render !== false) render();
  }
}

async function persistArea(area, options = {}) {
  const normalized = normalizeArea({ ...area, updated_at: nowIso() });
  if (!isSupabaseReady()) {
    const exists = state.areas.some((item) => item.id === normalized.id);
    state.areas = exists
      ? state.areas.map((item) => (item.id === normalized.id ? normalized : item))
      : [...state.areas, normalized];
    saveAreas();
    saveLocal();
    if (options.render !== false) render();
    return;
  }
  try {
    const payload = {
      id: normalized.id,
      user_id: state.user.id,
      name: normalized.name,
      color: normalized.color,
      sort_order: normalized.sort_order,
      created_at: normalized.created_at,
      updated_at: normalized.updated_at
    };
    const { data, error } = await state.supabase.from("planner_areas").upsert(payload).select().single();
    if (error) throw error;
    const saved = normalizeArea(data);
    state.areas = state.areas.some((item) => item.id === saved.id)
      ? state.areas.map((item) => (item.id === saved.id ? saved : item))
      : [...state.areas, saved];
    await state.supabase
      .from("planner_tasks")
      .update({ area: saved.name, area_id: saved.id, updated_at: nowIso() })
      .eq("user_id", state.user.id)
      .eq("area_id", saved.id);
    await state.supabase
      .from("planner_ideas")
      .update({ area: saved.name, area_id: saved.id, updated_at: nowIso() })
      .eq("user_id", state.user.id)
      .eq("area_id", saved.id);
    if (options.oldName && options.oldName !== saved.name) {
      await state.supabase
        .from("planner_tasks")
        .update({ area: saved.name, area_id: saved.id, updated_at: nowIso() })
        .eq("user_id", state.user.id)
        .eq("area", options.oldName);
      await state.supabase
        .from("planner_ideas")
        .update({ area: saved.name, area_id: saved.id, updated_at: nowIso() })
        .eq("user_id", state.user.id)
        .eq("area", options.oldName);
    }
    saveAreas();
    state.syncMessage = `Saved area for ${keyLabel()}.`;
    state.syncError = "";
    if (options.render !== false) render();
  } catch (error) {
    state.syncError = error.message;
    if (options.render !== false) render();
  }
}

async function loadPeopleData() {
  try {
    const [{ data: skills, error: skillsError }, { data: relationshipTypes, error: relationshipError }, { data: people, error: peopleError }] =
      await Promise.all([
        state.supabase.from("planner_skills").select("*").eq("user_id", state.user.id).order("sort_order", { ascending: true }),
        state.supabase.from("planner_relationship_types").select("*").eq("user_id", state.user.id).order("sort_order", { ascending: true }),
        state.supabase.from("planner_people").select("*").eq("user_id", state.user.id).order("first_name", { ascending: true })
      ]);
    if (skillsError || relationshipError || peopleError) throw skillsError || relationshipError || peopleError;
    state.peopleCloudReady = true;
    const normalizedSkills = skills.map(normalizeNamedOption);
    const normalizedRelationships = relationshipTypes.map(normalizeNamedOption);
    if (!normalizedSkills.length) {
      await Promise.all(state.skills.map((skill) => persistNamedOption("skills", skill, { render: false })));
    }
    if (!normalizedRelationships.length) {
      await Promise.all(state.relationshipTypes.map((relationship) => persistNamedOption("relationships", relationship, { render: false })));
    }
    return {
      skills: normalizedSkills.length ? normalizedSkills : state.skills,
      relationshipTypes: normalizedRelationships.length ? normalizedRelationships : state.relationshipTypes,
      people: people.map(normalizePerson)
    };
  } catch (error) {
    console.warn("Supabase people tables unavailable; using local people data", error);
    state.peopleCloudReady = false;
    state.syncMessage = "People are local until you run the latest Supabase migration.";
    return null;
  }
}

function optionConfig(type) {
  return type === "skills"
    ? { table: "planner_skills", stateKey: "skills", label: "skill" }
    : { table: "planner_relationship_types", stateKey: "relationshipTypes", label: "relationship" };
}

async function persistNamedOption(type, option, options = {}) {
  const config = optionConfig(type);
  const normalized = normalizeNamedOption({ ...option, updated_at: nowIso() });
  const list = state[config.stateKey];
  state[config.stateKey] = list.some((item) => item.id === normalized.id)
    ? list.map((item) => (item.id === normalized.id ? normalized : item))
    : [...list, normalized];
  saveNamedOptions();
  if (!isSupabaseReady() || !state.peopleCloudReady) {
    if (options.render !== false) render();
    return;
  }
  try {
    const { data, error } = await state.supabase
      .from(config.table)
      .upsert({ ...normalized, user_id: state.user.id })
      .select()
      .single();
    if (error) throw error;
    const saved = normalizeNamedOption(data);
    state[config.stateKey] = state[config.stateKey].map((item) => (item.id === saved.id ? saved : item));
    state.syncMessage = `Saved ${config.label} for ${keyLabel()}.`;
    state.syncError = "";
    if (options.render !== false) render();
  } catch (error) {
    state.syncError = error.message;
    if (options.render !== false) render();
  }
}

async function persistPerson(person, options = {}) {
  const normalized = normalizePerson({ ...person, user_id: state.user?.id || null, updated_at: nowIso() });
  if (!normalized.first_name) return;
  const exists = state.people.some((item) => item.id === normalized.id);
  state.people = exists
    ? state.people.map((item) => (item.id === normalized.id ? normalized : item))
    : [normalized, ...state.people];
  saveLocal();
  if (!isSupabaseReady() || !state.peopleCloudReady) {
    if (options.render !== false) render();
    return;
  }
  try {
    const { data, error } = await state.supabase
      .from("planner_people")
      .upsert({
        id: normalized.id,
        user_id: state.user.id,
        first_name: normalized.first_name,
        last_name: normalized.last_name,
        skill_ids: normalized.skill_ids,
        relationship_type_id: normalized.relationship_type_id || null,
        created_at: normalized.created_at,
        updated_at: normalized.updated_at
      })
      .select()
      .single();
    if (error) throw error;
    const saved = normalizePerson(data);
    state.people = state.people.map((item) => (item.id === saved.id ? saved : item));
    state.syncMessage = `Saved person for ${keyLabel()}.`;
    state.syncError = "";
    if (options.render !== false) render();
  } catch (error) {
    state.syncError = error.message;
    if (options.render !== false) render();
  }
}

async function deletePerson(id) {
  const person = state.people.find((item) => item.id === id);
  if (!person) return;
  if (!window.confirm(`Delete ${person.first_name}${person.last_name ? ` ${person.last_name}` : ""}?`)) return;
  state.people = state.people.filter((item) => item.id !== id);
  saveLocal();
  if (!isSupabaseReady() || !state.peopleCloudReady) {
    render();
    return;
  }
  try {
    const { error } = await state.supabase.from("planner_people").delete().eq("id", id);
    if (error) throw error;
    state.syncMessage = `Deleted person for ${keyLabel()}.`;
    state.syncError = "";
    render();
  } catch (error) {
    state.syncError = error.message;
    render();
  }
}

async function deleteGoal(id) {
  const goal = state.goals.find((item) => item.id === id);
  if (!goal) return;
  const linkedCount = state.tasks.filter((task) => task.goal_id === id).length;
  const message = linkedCount
    ? `Delete "${goal.name}"? ${linkedCount} linked task${linkedCount === 1 ? "" : "s"} will be unlinked, not deleted.`
    : `Delete "${goal.name}"?`;
  if (!window.confirm(message)) return;
  if (!isSupabaseReady()) {
    state.goals = state.goals.filter((item) => item.id !== id);
    state.tasks = state.tasks.map((task) => (task.goal_id === id ? { ...task, goal_id: "" } : task));
    saveLocal();
    render();
    return;
  }
  try {
    const { error: unlinkError } = await state.supabase.from("planner_tasks").update({ goal_id: null }).eq("goal_id", id);
    if (unlinkError) throw unlinkError;
    const { error } = await state.supabase.from("planner_goals").delete().eq("id", id);
    if (error) throw error;
    state.goals = state.goals.filter((item) => item.id !== id);
    state.tasks = state.tasks.map((task) => (task.goal_id === id ? { ...task, goal_id: "" } : task));
    state.syncMessage = `Deleted goal for ${keyLabel()}.`;
    render();
  } catch (error) {
    state.syncError = error.message;
    render();
  }
}

async function deleteIdea(id) {
  const idea = state.ideas.find((item) => item.id === id);
  if (!idea || !window.confirm(`Delete this idea? "${idea.text}"`)) return;
  if (!isSupabaseReady()) {
    state.ideas = state.ideas.filter((item) => item.id !== id);
    saveLocal();
    render();
    return;
  }
  try {
    const { error } = await state.supabase.from("planner_ideas").delete().eq("id", id);
    if (error) throw error;
    state.ideas = state.ideas.filter((item) => item.id !== id);
    state.syncMessage = `Deleted idea for ${keyLabel()}.`;
    render();
  } catch (error) {
    state.syncError = error.message;
    render();
  }
}

async function deleteTask(id) {
  const ids = [id, ...descendantIds(id)];
  if (!isSupabaseReady()) {
    state.tasks = state.tasks.filter((task) => !ids.includes(task.id));
    state.tasks = state.tasks.map((task) => ({
      ...task,
      dependency_ids: task.dependency_ids.filter((dependencyId) => !ids.includes(dependencyId))
    }));
    saveLocal();
    render();
    return;
  }

  try {
    const { error: deleteError } = await state.supabase.from("planner_tasks").delete().in("id", ids);
    if (deleteError) throw deleteError;
    state.syncError = "";
    state.syncMessage = `Deleted for ${keyLabel()}.`;
    state.tasks = state.tasks.filter((task) => !ids.includes(task.id));
    const cleanup = state.tasks
      .map((task) => ({
        ...task,
        dependency_ids: task.dependency_ids.filter((dependencyId) => !ids.includes(dependencyId))
      }))
      .filter((task, index) => task.dependency_ids.length !== state.tasks[index].dependency_ids.length);
    await Promise.all(
      cleanup.map(async (task) => {
        const { error } = await state.supabase
          .from("planner_tasks")
          .update(databasePatchPayload({ dependency_ids: task.dependency_ids, updated_at: nowIso() }))
          .eq("id", task.id);
        if (error) throw error;
      })
    );
    state.tasks = state.tasks.map((task) => cleanup.find((item) => item.id === task.id) || task);
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
      return `${task.title} ${task.notes} ${areaNameFor(task)} ${task.tags.join(" ")}`.toLowerCase().includes(search);
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
  counts.goals.textContent = state.goals.length;
  counts.goalAssignments.textContent = state.tasks.filter((task) => !task.parent_id && task.status !== "done").length;
  counts.people.textContent = state.people.length;
  counts.ideas.textContent = state.ideas.length;
  counts.graph.textContent = state.tasks.filter((task) => task.status !== "done" || state.showDone).length;
  counts.timeline.textContent = state.tasks.filter((task) => task.status !== "done" || state.showDone).length;
  counts.areas.textContent = state.areas.length;
  counts.skills.textContent = state.skills.length;
  counts.relationships.textContent = state.relationshipTypes.length;
  counts.open.textContent = state.tasks.filter((task) => task.status !== "done").length;
  counts.focus.textContent = state.tasks.filter((task) => task.status !== "done" && task.priority === "High").length;
}

function fillGoalSelect(select, selected = "") {
  select.innerHTML = '<option value="">No goal</option>';
  for (const goal of state.goals) {
    const option = document.createElement("option");
    option.value = goal.id;
    option.textContent = goal.name;
    select.append(option);
  }
  select.value = selected || "";
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
  const selectedArea = areaIdForValue(els.area.value) || areaIdForName("Life");
  const selectedDetailArea = areaIdForValue(detail.area.value) || areaIdForName("Life");
  for (const select of [els.area, detail.area]) {
    select.innerHTML = "";
    for (const area of state.areas) {
      const option = document.createElement("option");
      option.value = area.id;
      option.textContent = area.name;
      select.append(option);
    }
  }
  els.area.value = state.areas.some((area) => area.id === selectedArea) ? selectedArea : state.areas[0]?.id || "";
  detail.area.value = state.areas.some((area) => area.id === selectedDetailArea) ? selectedDetailArea : state.areas[0]?.id || "";

  els.areaList.innerHTML = "";
  for (const area of state.areas) {
    const row = document.createElement("div");
    row.className = "area-row";
    row.innerHTML = `
      <input class="area-name-input" type="text">
      <input class="area-color-input" type="color" aria-label="Area color">
    `;
    row.dataset.area = area.name;
    row.dataset.areaId = area.id;
    row.dataset.persistedArea = area.name;
    row.querySelector(".area-name-input").value = area.name;
    row.querySelector(".area-color-input").value = area.color;
    els.areaList.append(row);
  }
}

function renderParentControls() {
  fillParentSelect(document.querySelector("#parent-id"), "", "");
  fillGoalSelect(els.goal, "");
  if (state.selectedId) {
    const task = state.tasks.find((item) => item.id === state.selectedId);
    fillParentSelect(detail.parent, task?.parent_id || "", state.selectedId);
    fillGoalSelect(detail.goal, task?.goal_id || "");
    fillDependencySelect(detail.dependencies, task?.dependency_ids || [], state.selectedId);
  }
}

function renderTasks() {
  if (state.view === "goals") {
    renderGoalsView();
    return;
  }
  if (state.view === "goal-assignments") {
    renderGoalAssignmentsView();
    return;
  }
  if (state.view === "people") {
    renderPeopleView();
    return;
  }
  if (state.view === "ideas") {
    renderIdeasView();
    return;
  }
  if (state.view === "areas") {
    renderAreasView();
    return;
  }
  if (state.view === "skills") {
    renderNamedSettingsView("skills");
    return;
  }
  if (state.view === "relationships") {
    renderNamedSettingsView("relationships");
    return;
  }
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

    const color = areaColorFor(task);
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
    pills[0].textContent = areaNameFor(task);
    pills[0].style.borderLeft = `4px solid ${color}`;
    pills[0].style.background = areaTintFor(task);
    button.style.borderLeft = `6px solid ${color}`;
    button.style.background = `linear-gradient(90deg, ${areaTintFor(task)}, #fff 42%)`;
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

function tasksForGoal(goalId) {
  const related = new Set(state.tasks.filter((task) => task.goal_id === goalId).map((task) => task.id));
  const children = childMap();
  const rows = [];
  const visit = (parentId, depth) => {
    for (const task of sortedSiblings(children.get(parentId) || [])) {
      const childRows = [];
      const collectChild = (child) => {
        childRows.push(child.id);
        for (const next of children.get(child.id) || []) collectChild(next);
      };
      for (const child of children.get(task.id) || []) collectChild(child);
      const include = related.has(task.id) || childRows.some((id) => related.has(id));
      if (include) rows.push({ task, depth });
      visit(task.id, depth + 1);
    }
  };
  visit("", 0);
  return rows.filter(({ task }) => related.has(task.id));
}

function makeGoalTaskOutline(goalId, status) {
  const rows = tasksForGoal(goalId).filter(({ task }) => (status === "done" ? task.status === "done" : task.status !== "done"));
  const section = document.createElement("div");
  section.className = "goal-task-section";
  const heading = document.createElement("h5");
  heading.textContent = status === "done" ? "Done tasks" : "Active tasks";
  section.append(heading);
  if (!rows.length) {
    const empty = document.createElement("p");
    empty.className = "goal-task-empty";
    empty.textContent = status === "done" ? "No done tasks yet." : "No active tasks linked.";
    section.append(empty);
    return section;
  }
  for (const { task, depth } of rows) {
    const button = document.createElement("button");
    button.className = `goal-task-link ${task.status === "done" ? "done" : ""}`;
    button.type = "button";
    button.dataset.taskId = task.id;
    button.style.setProperty("--depth", depth);
    button.innerHTML = `
      <span></span>
      <small></small>
    `;
    button.querySelector("span").textContent = task.title;
    button.querySelector("small").textContent = `${areaNameFor(task)} · ${formatDate(task.due_date)}`;
    section.append(button);
  }
  return section;
}

function goalAccent(index) {
  const colors = ["#39ff14", "#5cc8ff", "#f0b35a", "#d85b49", "#7b5ea7", "#0e7c74"];
  return colors[index % colors.length];
}

function renderGoalsView() {
  els.taskList.innerHTML = `
    <form id="goal-form" class="planning-form">
      <input name="name" type="text" placeholder="Life goal" required>
      <textarea name="description" placeholder="Description"></textarea>
      <button class="primary-button" type="submit">Add goal</button>
    </form>
    <div class="planning-list goal-grid"></div>
  `;
  const list = els.taskList.querySelector(".planning-list");
  if (!state.goals.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "No life goals yet.";
    list.append(empty);
    return;
  }
  state.goals.forEach((goal, index) => {
    const card = document.createElement("article");
    card.className = "planning-card goal-card";
    card.dataset.goalId = goal.id;
    card.style.setProperty("--goal-color", goalAccent(index));
    card.innerHTML = `
      <input class="goal-title-input" name="name" type="text" required aria-label="Life goal name">
      <textarea class="goal-description-input" name="description" aria-label="Life goal description"></textarea>
      <div class="goal-task-outline"></div>
      <div class="detail-actions">
        <button class="danger-button delete-goal-button" type="button">Delete</button>
      </div>
    `;
    card.querySelector("[name='name']").value = goal.name;
    card.querySelector("[name='description']").value = goal.description;
    const outline = card.querySelector(".goal-task-outline");
    outline.append(makeGoalTaskOutline(goal.id, "active"));
    outline.append(makeGoalTaskOutline(goal.id, "done"));
    list.append(card);
  });
}

function renderIdeasView() {
  els.taskList.innerHTML = `
    <form id="idea-form" class="planning-form idea-form">
      <input name="text" type="text" placeholder="Capture an idea" required>
      <select name="area" aria-label="Idea area"></select>
      <button class="primary-button" type="submit">Add idea</button>
    </form>
    <div class="planning-list"></div>
  `;
  const areaSelect = els.taskList.querySelector("select[name='area']");
  for (const area of state.areas) {
    const option = document.createElement("option");
    option.value = area.id;
    option.textContent = area.name;
    areaSelect.append(option);
  }
  const list = els.taskList.querySelector(".planning-list");
  if (!state.ideas.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "No ideas captured yet.";
    list.append(empty);
    return;
  }
  for (const idea of state.ideas) {
    const card = document.createElement("article");
    card.className = "planning-card idea-card";
    card.dataset.ideaId = idea.id;
    card.style.borderLeftColor = areaColorFor(idea);
    card.style.background = `linear-gradient(90deg, ${areaTintFor(idea)}, #fff 46%)`;
    card.innerHTML = `
      <input name="text" type="text" required aria-label="Idea text">
      <select name="area" aria-label="Idea area"></select>
      <button class="danger-button delete-idea-button" type="button">Delete</button>
    `;
    card.querySelector("[name='text']").value = idea.text;
    const select = card.querySelector("select");
    for (const area of state.areas) {
      const option = document.createElement("option");
      option.value = area.id;
      option.textContent = area.name;
      select.append(option);
    }
    select.value = idea.area_id || areaIdForName(idea.area);
    list.append(card);
  }
}

function renderAreasView() {
  els.taskList.innerHTML = `
    <form id="areas-settings-form" class="planning-form area-settings-form">
      <input name="name" type="text" placeholder="New area" required>
      <input name="color" type="color" value="#39ff14" aria-label="Area color">
      <button class="primary-button" type="submit">Add area</button>
    </form>
    <div class="planning-list area-settings-list"></div>
  `;
  const list = els.taskList.querySelector(".area-settings-list");
  for (const area of state.areas) {
    const row = document.createElement("div");
    row.className = "area-settings-row";
    row.dataset.area = area.name;
    row.dataset.areaId = area.id;
    row.dataset.persistedArea = area.name;
    row.style.borderLeftColor = area.color;
    row.innerHTML = `
      <input class="area-name-input" type="text" aria-label="Area name">
      <input class="area-color-input" type="color" aria-label="Area color">
      <span class="area-usage"></span>
    `;
    row.querySelector(".area-name-input").value = area.name;
    row.querySelector(".area-color-input").value = area.color;
    const usage =
      state.tasks.filter((task) => task.area_id === area.id || (!task.area_id && task.area === area.name)).length +
      state.ideas.filter((idea) => idea.area_id === area.id || (!idea.area_id && idea.area === area.name)).length;
    row.querySelector(".area-usage").textContent = `${usage} item${usage === 1 ? "" : "s"}`;
    list.append(row);
  }
}

function renderNamedSettingsView(type) {
  const config = optionConfig(type);
  const title = type === "skills" ? "Skills" : "Relationships";
  const items = state[config.stateKey];
  els.taskList.innerHTML = `
    <form id="named-settings-form" class="planning-form named-settings-form" data-option-type="${type}">
      <input name="name" type="text" placeholder="New ${config.label}" required>
      <button class="primary-button" type="submit">Add ${config.label}</button>
    </form>
    <div class="planning-list area-settings-list"></div>
  `;
  const list = els.taskList.querySelector(".area-settings-list");
  if (!items.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = `No ${title.toLowerCase()} yet.`;
    list.append(empty);
    return;
  }
  for (const item of items) {
    const row = document.createElement("div");
    row.className = "area-settings-row named-settings-row";
    row.dataset.optionId = item.id;
    row.dataset.optionType = type;
    row.innerHTML = `
      <input class="named-option-input" type="text" aria-label="${title.slice(0, -1)} name">
      <span class="area-usage"></span>
    `;
    row.querySelector(".named-option-input").value = item.name;
    const usage = type === "skills"
      ? state.people.filter((person) => person.skill_ids.includes(item.id)).length
      : state.people.filter((person) => person.relationship_type_id === item.id).length;
    row.querySelector(".area-usage").textContent = `${usage} person${usage === 1 ? "" : "s"}`;
    list.append(row);
  }
}

function personFullName(person) {
  return `${person.first_name}${person.last_name ? ` ${person.last_name}` : ""}`;
}

function renderPeopleView() {
  els.taskList.innerHTML = `
    <form id="person-form" class="planning-form people-form">
      <input name="firstName" type="text" placeholder="First name" required>
      <input name="lastName" type="text" placeholder="Last name">
      <select name="relationshipTypeId" aria-label="Relationship"></select>
      <div class="skill-picker" role="group" aria-label="Skills"></div>
      <button class="primary-button" type="submit">Add person</button>
    </form>
    <div class="planning-list people-list"></div>
  `;
  fillRelationshipSelect(els.taskList.querySelector("select[name='relationshipTypeId']"), "");
  fillSkillPicker(els.taskList.querySelector(".skill-picker"), []);
  const list = els.taskList.querySelector(".people-list");
  if (!state.people.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "No people yet.";
    list.append(empty);
    return;
  }
  for (const person of state.people) {
    const card = document.createElement("article");
    card.className = "planning-card person-card";
    card.dataset.personId = person.id;
    card.innerHTML = `
      <input name="firstName" type="text" required aria-label="First name">
      <input name="lastName" type="text" aria-label="Last name">
      <select name="relationshipTypeId" aria-label="Relationship"></select>
      <div class="skill-picker" role="group" aria-label="Skills"></div>
      <button class="danger-button delete-person-button" type="button">Delete</button>
    `;
    card.querySelector("[name='firstName']").value = person.first_name;
    card.querySelector("[name='lastName']").value = person.last_name;
    fillRelationshipSelect(card.querySelector("[name='relationshipTypeId']"), person.relationship_type_id);
    fillSkillPicker(card.querySelector(".skill-picker"), person.skill_ids);
    list.append(card);
  }
}

function renderGoalAssignmentsView() {
  const topLevelTasks = state.tasks
    .filter((task) => !task.parent_id && task.status !== "done")
    .sort((a, b) => a.sort_order - b.sort_order || a.title.localeCompare(b.title));
  if (!state.selectedAssignmentTaskId || !topLevelTasks.some((task) => task.id === state.selectedAssignmentTaskId)) {
    state.selectedAssignmentTaskId = topLevelTasks[0]?.id || "";
  }
  const selectedTask = topLevelTasks.find((task) => task.id === state.selectedAssignmentTaskId);
  els.taskList.innerHTML = `
    <div class="assignment-view">
      <section class="assignment-panel">
        <h4>Top-level tasks</h4>
        <div class="assignment-task-list"></div>
      </section>
      <section class="assignment-panel">
        <h4>Life goals</h4>
        <div class="assignment-goal-list"></div>
      </section>
    </div>
  `;
  const taskList = els.taskList.querySelector(".assignment-task-list");
  const goalList = els.taskList.querySelector(".assignment-goal-list");
  if (!topLevelTasks.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "No top-level tasks to assign.";
    taskList.append(empty);
  }
  for (const task of topLevelTasks) {
    const button = document.createElement("button");
    button.className = `assignment-task ${task.id === state.selectedAssignmentTaskId ? "active" : ""}`;
    button.type = "button";
    button.dataset.assignmentTaskId = task.id;
    button.innerHTML = `<span></span><small></small>`;
    button.querySelector("span").textContent = task.title;
    button.querySelector("small").textContent = task.goal_id ? state.goals.find((goal) => goal.id === task.goal_id)?.name || "Linked goal" : "No goal";
    taskList.append(button);
  }
  const unassigned = document.createElement("button");
  unassigned.className = `assignment-goal ${selectedTask && !selectedTask.goal_id ? "active" : ""}`;
  unassigned.type = "button";
  unassigned.dataset.assignmentGoalId = "";
  unassigned.innerHTML = `<strong>No goal</strong><span>Leave selected task unassigned</span>`;
  goalList.append(unassigned);
  for (const goal of state.goals) {
    const button = document.createElement("button");
    button.className = `assignment-goal ${selectedTask?.goal_id === goal.id ? "active" : ""}`;
    button.type = "button";
    button.dataset.assignmentGoalId = goal.id;
    const count = state.tasks.filter((task) => !task.parent_id && task.goal_id === goal.id).length;
    button.innerHTML = `<strong></strong><span></span>`;
    button.querySelector("strong").textContent = goal.name;
    button.querySelector("span").textContent = `${count} top-level task${count === 1 ? "" : "s"}`;
    goalList.append(button);
  }
}

function fillSkillPicker(container, selected = []) {
  const values = new Set(parseIds(selected));
  container.innerHTML = "";
  const select = document.createElement("select");
  select.className = "skill-add-select";
  select.name = "skillAdd";
  select.setAttribute("aria-label", "Add skill");
  select.innerHTML = '<option value="">Add skill...</option>';
  for (const skill of state.skills.filter((item) => !values.has(item.id))) {
    const option = document.createElement("option");
    option.value = skill.id;
    option.textContent = skill.name;
    select.append(option);
  }
  container.append(select);
  const pills = document.createElement("div");
  pills.className = "skill-pills";
  container.append(pills);
  for (const skill of state.skills) {
    if (!values.has(skill.id)) continue;
    const pill = document.createElement("span");
    pill.className = "skill-pill";
    pill.innerHTML = `
      <input name="skillIds" type="hidden">
      <span></span>
      <button class="skill-remove-button" type="button" aria-label="Remove skill">x</button>
    `;
    const input = pill.querySelector("input");
    input.value = skill.id;
    pill.querySelector("span").textContent = skill.name;
    pills.append(pill);
  }
}

function fillRelationshipSelect(select, selected = "") {
  select.innerHTML = '<option value="">No relationship</option>';
  for (const relationship of state.relationshipTypes) {
    const option = document.createElement("option");
    option.value = relationship.id;
    option.textContent = relationship.name;
    select.append(option);
  }
  select.value = selected || "";
}

function taskMatchesGlobalFilters(task) {
  const search = state.search.trim().toLowerCase();
  if (task.status === "done" && !state.showDone) return false;
  if (state.tagFilter && !task.tags.includes(state.tagFilter)) return false;
  if (!search) return true;
  return `${task.title} ${task.notes} ${areaNameFor(task)} ${task.tags.join(" ")}`.toLowerCase().includes(search);
}

function makeMiniTask(task) {
  const node = document.createElement("button");
  node.className = `mini-task ${task.id === state.selectedId ? "active" : ""} ${task.status === "done" ? "done" : ""}`;
  node.type = "button";
  node.dataset.id = task.id;
  node.style.borderLeftColor = areaColorFor(task);
  node.innerHTML = `
    <span class="mini-title"></span>
    <span class="mini-meta"></span>
  `;
  node.querySelector(".mini-title").textContent = task.title;
  node.querySelector(".mini-meta").textContent = `${areaNameFor(task)} · ${formatDate(task.due_date)}`;
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
    if (visible.has(task.id)) {
      for (const dependencyId of task.dependency_ids) {
        if (byId.has(dependencyId)) visible.add(dependencyId);
      }
    }
  }

  if (!visible.size) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "Nothing here right now.";
    els.taskList.append(empty);
    return;
  }

  const children = childMap();
  const rows = [];
  const visited = new Set();
  const walk = (parentId, depth) => {
    for (const task of sortedSiblings(children.get(parentId) || [])) {
      if (!visible.has(task.id)) continue;
      visited.add(task.id);
      rows.push({ task, depth });
      walk(task.id, depth + 1);
    }
  };
  walk("", 0);
  for (const task of sortedSiblings(state.tasks.filter((item) => visible.has(item.id) && !visited.has(item.id)))) {
    rows.push({ task, depth: 0 });
  }

  const nodeWidth = 210;
  const nodeHeight = 66;
  const columnGap = 72;
  const rowGap = 30;
  const margin = 24;
  const maxDepth = rows.reduce((depth, row) => Math.max(depth, row.depth), 0);
  const graphWidth = margin * 2 + (maxDepth + 1) * nodeWidth + maxDepth * columnGap;
  const graphHeight = margin * 2 + rows.length * nodeHeight + Math.max(0, rows.length - 1) * rowGap;
  const positions = new Map();

  const graph = document.createElement("div");
  graph.className = "graph-canvas";
  graph.style.width = `${Math.max(graphWidth, 720)}px`;
  graph.style.height = `${Math.max(graphHeight, 420)}px`;

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("class", "graph-links");
  svg.setAttribute("width", Math.max(graphWidth, 720));
  svg.setAttribute("height", Math.max(graphHeight, 420));
  svg.setAttribute("viewBox", `0 0 ${Math.max(graphWidth, 720)} ${Math.max(graphHeight, 420)}`);
  svg.innerHTML = `
    <defs>
      <marker id="graph-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
        <path d="M 0 0 L 10 5 L 0 10 z"></path>
      </marker>
      <marker id="graph-dot-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
        <path d="M 0 0 L 10 5 L 0 10 z"></path>
      </marker>
    </defs>
  `;
  graph.append(svg);

  rows.forEach(({ task, depth }, index) => {
    const x = margin + depth * (nodeWidth + columnGap);
    const y = margin + index * (nodeHeight + rowGap);
    positions.set(task.id, { x, y, width: nodeWidth, height: nodeHeight });
    const node = document.createElement("button");
    node.className = `graph-node ${task.id === state.selectedId ? "active" : ""} ${task.status === "done" ? "done" : ""}`;
    node.type = "button";
    node.dataset.id = task.id;
    node.style.left = `${x}px`;
    node.style.top = `${y}px`;
    node.style.borderTopColor = areaColorFor(task);
    node.style.background = `linear-gradient(180deg, ${areaTintFor(task)}, #fff 58%)`;
    node.innerHTML = `
      <span class="graph-node-title"></span>
      <span class="graph-node-meta"></span>
    `;
    node.querySelector(".graph-node-title").textContent = task.title;
    node.querySelector(".graph-node-meta").textContent = `${areaNameFor(task)} · ${formatDate(task.due_date)}`;
    graph.append(node);
  });

  const makePath = (fromId, toId, className) => {
    const from = positions.get(fromId);
    const to = positions.get(toId);
    if (!from || !to) return;
    const startX = from.x + from.width;
    const startY = from.y + from.height / 2;
    const endX = to.x;
    const endY = to.y + to.height / 2;
    const curve = Math.max(36, Math.abs(endX - startX) / 2);
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("class", className);
    path.setAttribute("d", `M ${startX} ${startY} C ${startX + curve} ${startY}, ${endX - curve} ${endY}, ${endX} ${endY}`);
    svg.append(path);
  };

  for (const task of rows.map((row) => row.task)) {
    if (task.parent_id && visible.has(task.parent_id)) makePath(task.parent_id, task.id, "graph-link parent-link");
    for (const dependencyId of task.dependency_ids) {
      if (visible.has(dependencyId)) makePath(dependencyId, task.id, "graph-link dependency-link");
    }
  }

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

  const datedTasks = tasks.filter((task) => task.due_date);
  const noDateTasks = tasks.filter((task) => !task.due_date);
  const today = todayIso();
  const minDate = datedTasks.length ? datedTasks[0].due_date : today;
  const maxDate = datedTasks.length ? datedTasks[datedTasks.length - 1].due_date : today;
  const startDate = addDaysToIso(minDate < today ? minDate : today, -5);
  const endDate = addDaysToIso(maxDate > today ? maxDate : today, 10);
  const dayCount = Math.max(1, daysBetween(startDate, endDate));
  const pixelsPerDay = Math.min(120, Math.max(18, state.timelineZoom));
  const margin = 120;
  const rowHeight = 86;
  const axisTop = 78;
  const laneTop = 128;
  const noDateTop = laneTop + Math.max(1, datedTasks.length) * rowHeight + 44;
  const width = margin * 2 + dayCount * pixelsPerDay;
  const height = noDateTop + Math.max(1, noDateTasks.length) * 74 + 60;
  const tickInterval = pixelsPerDay >= 76 ? 1 : pixelsPerDay >= 42 ? 2 : pixelsPerDay >= 26 ? 4 : 7;

  const timeline = document.createElement("div");
  timeline.className = "timeline-view";
  timeline.innerHTML = `
    <div class="timeline-controls">
      <button class="ghost-button timeline-zoom" data-zoom="-8" type="button">-</button>
      <span>${pixelsPerDay}px/day</span>
      <button class="ghost-button timeline-zoom" data-zoom="8" type="button">+</button>
      <button class="ghost-button timeline-today" type="button">Today</button>
    </div>
    <div class="timeline-scroller">
      <div class="timeline-canvas"></div>
    </div>
  `;

  const canvas = timeline.querySelector(".timeline-canvas");
  canvas.style.width = `${width}px`;
  canvas.style.height = `${Math.max(height, 460)}px`;

  const axis = document.createElement("div");
  axis.className = "timeline-axis";
  axis.style.top = `${axisTop}px`;
  axis.style.left = `${margin}px`;
  axis.style.width = `${dayCount * pixelsPerDay}px`;
  canvas.append(axis);

  for (let day = 0; day <= dayCount; day += 1) {
    const date = addDaysToIso(startDate, day);
    const left = margin + day * pixelsPerDay;
    const line = document.createElement("div");
    line.className = `timeline-tick ${date === today ? "today" : ""}`;
    line.style.left = `${left}px`;
    line.style.top = `${axisTop - 22}px`;
    line.style.height = `${Math.max(height, 460) - axisTop - 24}px`;
    canvas.append(line);
    if (day % tickInterval === 0 || date === today) {
      const label = document.createElement("div");
      label.className = `timeline-date ${date === today ? "today" : ""}`;
      label.style.left = `${left}px`;
      label.style.top = `${axisTop - 46}px`;
      label.textContent = formatDate(date);
      canvas.append(label);
    }
  }

  datedTasks.forEach((task, index) => {
    const x = margin + daysBetween(startDate, task.due_date) * pixelsPerDay;
    const y = laneTop + index * rowHeight;
    canvas.append(makeTimelineTask(task, x, y));
  });

  if (noDateTasks.length) {
    const label = document.createElement("div");
    label.className = "timeline-undated-label";
    label.style.left = `${margin}px`;
    label.style.top = `${noDateTop - 30}px`;
    label.textContent = "No date";
    canvas.append(label);
    noDateTasks.forEach((task, index) => {
      canvas.append(makeTimelineTask(task, margin + index * 232, noDateTop));
    });
  }

  els.taskList.append(timeline);
  const scroller = timeline.querySelector(".timeline-scroller");
  requestAnimationFrame(() => {
    const todayLeft = margin + daysBetween(startDate, today) * pixelsPerDay;
    scroller.scrollLeft = Math.max(0, todayLeft - scroller.clientWidth / 2);
  });
}

function makeTimelineTask(task, x, y) {
  const node = document.createElement("button");
  node.className = `timeline-task ${task.id === state.selectedId ? "active" : ""} ${task.status === "done" ? "done" : ""}`;
  node.type = "button";
  node.dataset.id = task.id;
  node.style.left = `${x}px`;
  node.style.top = `${y}px`;
  node.style.borderLeftColor = areaColorFor(task);
  node.style.background = `linear-gradient(90deg, ${areaTintFor(task)}, #fff 55%)`;
  node.innerHTML = `
    <span class="timeline-dot"></span>
    <span class="timeline-task-title"></span>
    <span class="timeline-task-meta"></span>
  `;
  node.querySelector(".timeline-dot").style.background = areaColorFor(task);
  node.querySelector(".timeline-task-title").textContent = task.title;
  node.querySelector(".timeline-task-meta").textContent = `${areaNameFor(task)} · ${task.priority} · ${formatDate(task.due_date)}`;
  return node;
}

function renderDetail() {
  const task = state.tasks.find((item) => item.id === state.selectedId);

  const detailHiddenViews = ["goals", "goal-assignments", "people", "ideas", "areas", "skills", "relationships"];
  if (!task || detailHiddenViews.includes(state.view)) {
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
  detail.goal.value = task.goal_id || "";
  detail.tags.value = task.tags.join(", ");
  detail.area.value = task.area_id || areaIdForName(task.area);
  detail.priority.value = task.priority;
  detail.due.value = task.due_date || "";
  detail.energy.value = task.energy;
  els.completeButton.textContent = task.status === "done" ? "Reopen" : "Done";
}

function render() {
  const label = new Intl.DateTimeFormat(undefined, { weekday: "long", month: "long", day: "numeric" }).format(new Date());
  const titles = {
    goals: "Life Goals",
    "goal-assignments": "Assign Tasks",
    today: "Today",
    upcoming: "Upcoming",
    backlog: "Backlog",
    done: "Done",
    people: "People",
    ideas: "Ideas",
    graph: "Graph",
    timeline: "Timeline",
    areas: "Areas",
    skills: "Skills",
    relationships: "Relationships"
  };
  const isPlanningView = ["goals", "goal-assignments", "people", "ideas", "areas", "skills", "relationships"].includes(state.view);

  setDensity(state.density);
  document.documentElement.style.setProperty("--detail-width", `${state.detailWidth}px`);
  els.plannerGrid.classList.toggle("graph-mode", state.view === "graph");
  els.plannerGrid.classList.toggle("timeline-mode", state.view === "timeline");
  els.plannerGrid.classList.toggle("planning-mode", isPlanningView);
  els.entryPanel.classList.toggle("hidden", state.view === "graph" || state.view === "timeline" || isPlanningView);
  els.todayLabel.textContent = label;
  els.viewTitle.textContent = titles[state.view];
  els.boardTitle.textContent = state.view === "graph" ? "Task graph" : state.view === "timeline" ? "Task timeline" : titles[state.view];
  els.storageStatus.textContent = isSupabaseReady() ? state.user.email : "Local storage";
  els.appVersion.textContent = `Version ${APP_VERSION}`;
  els.keyButton.textContent = state.user ? "Sign out" : "Google";
  els.keyButton.title = state.user ? `Signed in as ${state.user.email}` : "Sign in with Google";
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
      changedTasks.map(async (task) => {
        const { error } = await state.supabase
          .from("planner_tasks")
          .update(databasePatchPayload({ sort_order: task.sort_order, updated_at: nowIso() }))
          .eq("id", task.id);
        if (error) throw error;
      })
    );
    state.syncError = "";
    state.syncMessage = `Reordered for ${keyLabel()}.`;
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
    goal_id: form.get("goalId") || "",
    area_id: form.get("area") || null,
    area: areaById(form.get("area"))?.name || "Life",
    priority: form.get("priority"),
    due_date: form.get("dueDate") || defaultDueDateForView(),
    tags: parseTags(form.get("tags")),
    energy: "Medium",
    sort_order: nextSortOrder(form.get("parentId") || "")
  });
  els.taskForm.reset();
  els.area.value = areaIdForName("Life") || state.areas[0]?.id || "";
  document.querySelector("#priority").value = "Medium";
  document.querySelector("#parent-id").value = "";
  document.querySelector("#goal-id").value = "";
  state.selectedId = task.id;
  await persistTask(task);
});

els.taskList.addEventListener("click", (event) => {
  const assignmentTask = event.target.closest("[data-assignment-task-id]");
  if (assignmentTask) {
    state.selectedAssignmentTaskId = assignmentTask.dataset.assignmentTaskId;
    renderTasks();
    return;
  }
  const assignmentGoal = event.target.closest("[data-assignment-goal-id]");
  if (assignmentGoal) {
    if (state.selectedAssignmentTaskId) {
      patchTask(state.selectedAssignmentTaskId, { goal_id: assignmentGoal.dataset.assignmentGoalId || null });
    }
    return;
  }
  const deletePersonButton = event.target.closest(".delete-person-button");
  if (deletePersonButton) {
    const card = deletePersonButton.closest("[data-person-id]");
    if (card) deletePerson(card.dataset.personId);
    return;
  }
  const removeSkillButton = event.target.closest(".skill-remove-button");
  if (removeSkillButton) {
    const picker = removeSkillButton.closest(".skill-picker");
    const card = removeSkillButton.closest("[data-person-id]");
    removeSkillButton.closest(".skill-pill")?.remove();
    if (card) autosavePersonCard(card);
    else if (picker) fillSkillPicker(picker, [...picker.querySelectorAll("[name='skillIds']")].map((input) => input.value));
    return;
  }
  const goalTaskLink = event.target.closest(".goal-task-link");
  if (goalTaskLink) {
    state.selectedId = goalTaskLink.dataset.taskId;
    state.view = "today";
    render();
    return;
  }
  const deleteGoalButton = event.target.closest(".delete-goal-button");
  if (deleteGoalButton) {
    const card = deleteGoalButton.closest("[data-goal-id]");
    if (card) deleteGoal(card.dataset.goalId);
    return;
  }
  const deleteIdeaButton = event.target.closest(".delete-idea-button");
  if (deleteIdeaButton) {
    const card = deleteIdeaButton.closest("[data-idea-id]");
    if (card) deleteIdea(card.dataset.ideaId);
    return;
  }
  const zoomButton = event.target.closest(".timeline-zoom");
  if (zoomButton) {
    state.timelineZoom = Math.min(120, Math.max(18, state.timelineZoom + Number(zoomButton.dataset.zoom)));
    localStorage.setItem("timeline-zoom", String(state.timelineZoom));
    renderTasks();
    return;
  }
  const todayButton = event.target.closest(".timeline-today");
  if (todayButton) {
    const scroller = event.target.closest(".timeline-view")?.querySelector(".timeline-scroller");
    const todayTick = event.target.closest(".timeline-view")?.querySelector(".timeline-tick.today");
    if (scroller && todayTick) scroller.scrollLeft = Math.max(0, todayTick.offsetLeft - scroller.clientWidth / 2);
    return;
  }
  const timelineTask = event.target.closest(".timeline-task");
  if (timelineTask) {
    state.selectedId = timelineTask.dataset.id;
    renderTasks();
    return;
  }
  const graphNode = event.target.closest(".graph-node");
  if (graphNode) {
    state.selectedId = graphNode.dataset.id;
    render();
    return;
  }
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

els.taskList.addEventListener("submit", async (event) => {
  const goalForm = event.target.closest("#goal-form");
  const ideaForm = event.target.closest("#idea-form");
  const areasForm = event.target.closest("#areas-settings-form");
  const personForm = event.target.closest("#person-form");
  const namedSettingsForm = event.target.closest("#named-settings-form");
  if (!goalForm && !ideaForm && !areasForm && !personForm && !namedSettingsForm) return;
  event.preventDefault();
  const form = new FormData(event.target);
  if (goalForm) {
    await persistGoal({ name: form.get("name").trim(), description: form.get("description").trim() });
  } else if (ideaForm) {
    await persistIdea({
      text: form.get("text").trim(),
      area_id: form.get("area") || null,
      area: areaById(form.get("area"))?.name || "Life"
    });
  } else if (areasForm) {
    const area = ensureArea(form.get("name").trim(), form.get("color") || "#39ff14");
    if (area) await persistArea(area, { render: false });
    event.target.reset();
    event.target.querySelector("[name='color']").value = "#39ff14";
    render();
  } else if (personForm) {
    await persistPerson({
      first_name: form.get("firstName").trim(),
      last_name: form.get("lastName").trim(),
      relationship_type_id: form.get("relationshipTypeId") || "",
      skill_ids: form.getAll("skillIds")
    });
  } else if (namedSettingsForm) {
    const type = namedSettingsForm.dataset.optionType;
    const config = optionConfig(type);
    const option = normalizeNamedOption({
      name: form.get("name").trim(),
      sort_order: nextNamedOptionSortOrder(state[config.stateKey])
    });
    await persistNamedOption(type, option);
  }
});

function autosaveGoalCard(card) {
  const goal = state.goals.find((item) => item.id === card.dataset.goalId);
  if (!goal) return;
  const name = card.querySelector("[name='name']").value.trim();
  if (!name) return;
  queueAutosave(`goal:${goal.id}`, () =>
    persistGoal(
      {
        id: goal.id,
        name,
        description: card.querySelector("[name='description']").value.trim(),
        created_at: goal.created_at
      },
      { render: false }
    )
  );
}

function autosaveIdeaCard(card) {
  const idea = state.ideas.find((item) => item.id === card.dataset.ideaId);
  if (!idea) return;
  const text = card.querySelector("[name='text']").value.trim();
  if (!text) return;
  queueAutosave(`idea:${idea.id}`, () =>
    persistIdea(
      {
        id: idea.id,
        text,
        area_id: card.querySelector("[name='area']").value || null,
        area: areaById(card.querySelector("[name='area']").value)?.name || "Life",
        created_at: idea.created_at
      },
      { render: false }
    )
  );
}

function updateAreaRow(row, shouldRender = false) {
  const original = row.dataset.area;
  const persistedName = row.dataset.persistedArea || original;
  const area = state.areas.find((item) => item.id === row.dataset.areaId) || state.areas.find((item) => item.name === original);
  if (!area) return;
  const nextName = row.querySelector(".area-name-input").value.trim();
  if (nextName && nextName !== area.name) {
    state.tasks = state.tasks.map((task) =>
      task.area_id === area.id || (!task.area_id && task.area === area.name) ? { ...task, area: nextName, area_id: area.id } : task
    );
    state.ideas = state.ideas.map((idea) =>
      idea.area_id === area.id || (!idea.area_id && idea.area === area.name) ? { ...idea, area: nextName, area_id: area.id } : idea
    );
    area.name = nextName;
    row.dataset.area = nextName;
  }
  area.color = row.querySelector(".area-color-input").value;
  saveAreas();
  saveLocal();
  queueAutosave(`area:${area.id}`, async () => {
    await persistArea(area, { render: false, oldName: persistedName });
    row.dataset.persistedArea = area.name;
  });
  if (shouldRender) render();
}

function autosavePersonCard(card) {
  const person = state.people.find((item) => item.id === card.dataset.personId);
  if (!person) return;
  const firstName = card.querySelector("[name='firstName']").value.trim();
  if (!firstName) return;
  queueAutosave(`person:${person.id}`, () =>
    persistPerson(
      {
        id: person.id,
        first_name: firstName,
        last_name: card.querySelector("[name='lastName']").value.trim(),
        relationship_type_id: card.querySelector("[name='relationshipTypeId']").value || "",
        skill_ids: [...card.querySelectorAll("[name='skillIds']")].map((input) => input.value),
        created_at: person.created_at
      },
      { render: false }
    )
  );
}

function updateNamedOptionRow(row, shouldRender = false) {
  const config = optionConfig(row.dataset.optionType);
  const option = state[config.stateKey].find((item) => item.id === row.dataset.optionId);
  if (!option) return;
  const name = row.querySelector(".named-option-input").value.trim();
  if (!name) return;
  option.name = name;
  saveNamedOptions();
  queueAutosave(`${row.dataset.optionType}:${option.id}`, () => persistNamedOption(row.dataset.optionType, option, { render: false }));
  if (shouldRender) render();
}

els.taskList.addEventListener("input", (event) => {
  const goalCard = event.target.closest("[data-goal-id]");
  if (goalCard) {
    autosaveGoalCard(goalCard);
    return;
  }
  const ideaCard = event.target.closest("[data-idea-id]");
  if (ideaCard) {
    autosaveIdeaCard(ideaCard);
    return;
  }
  const optionRow = event.target.closest("[data-option-id]");
  if (optionRow) {
    updateNamedOptionRow(optionRow, false);
    return;
  }
  const personCard = event.target.closest("[data-person-id]");
  if (personCard) {
    autosavePersonCard(personCard);
    return;
  }
  const areaRow = event.target.closest(".area-settings-row");
  if (areaRow) {
    updateAreaRow(areaRow, false);
  }
});

els.taskList.addEventListener("change", (event) => {
  const skillAdd = event.target.closest(".skill-add-select");
  if (skillAdd) {
    const picker = skillAdd.closest(".skill-picker");
    const card = skillAdd.closest("[data-person-id]");
    const selected = [...picker.querySelectorAll("[name='skillIds']")].map((input) => input.value);
    if (skillAdd.value && !selected.includes(skillAdd.value)) selected.push(skillAdd.value);
    fillSkillPicker(picker, selected);
    if (card) autosavePersonCard(card);
    return;
  }
  const ideaCard = event.target.closest("[data-idea-id]");
  if (ideaCard) {
    autosaveIdeaCard(ideaCard);
    return;
  }
  const optionRow = event.target.closest("[data-option-id]");
  if (optionRow) {
    updateNamedOptionRow(optionRow, true);
    return;
  }
  const personCard = event.target.closest("[data-person-id]");
  if (personCard) {
    autosavePersonCard(personCard);
    return;
  }
  const areaRow = event.target.closest(".area-settings-row");
  if (areaRow) {
    updateAreaRow(areaRow, true);
  }
});

els.taskList.addEventListener("keydown", (event) => {
  const timelineTask = event.target.closest(".timeline-task");
  if (timelineTask && (event.key === "Enter" || event.key === " ")) {
    event.preventDefault();
    state.selectedId = timelineTask.dataset.id;
    renderTasks();
    return;
  }
  const graphNode = event.target.closest(".graph-node");
  if (graphNode && (event.key === "Enter" || event.key === " ")) {
    event.preventDefault();
    state.selectedId = graphNode.dataset.id;
    render();
    return;
  }
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

let timelinePanning = false;
let timelinePanStartX = 0;
let timelinePanStartScroll = 0;

els.taskList.addEventListener("pointerdown", (event) => {
  const scroller = event.target.closest(".timeline-scroller");
  if (!scroller || event.target.closest("button")) return;
  timelinePanning = true;
  timelinePanStartX = event.clientX;
  timelinePanStartScroll = scroller.scrollLeft;
  scroller.setPointerCapture(event.pointerId);
  scroller.classList.add("panning");
});

els.taskList.addEventListener("pointermove", (event) => {
  if (!timelinePanning) return;
  const scroller = event.target.closest(".timeline-scroller");
  if (!scroller) return;
  scroller.scrollLeft = timelinePanStartScroll - (event.clientX - timelinePanStartX);
});

els.taskList.addEventListener("pointerup", (event) => {
  const scroller = event.target.closest(".timeline-scroller");
  if (!scroller || !timelinePanning) return;
  timelinePanning = false;
  scroller.releasePointerCapture(event.pointerId);
  scroller.classList.remove("panning");
});

els.taskList.addEventListener("pointercancel", (event) => {
  const scroller = event.target.closest(".timeline-scroller");
  timelinePanning = false;
  scroller?.classList.remove("panning");
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

function detailPayload() {
  return {
    title: detail.title.value.trim(),
    notes: detail.notes.value.trim(),
    parent_id: detail.parent.value || null,
    goal_id: detail.goal.value || null,
    dependency_ids: [...detail.dependencies.selectedOptions].map((option) => option.value),
    tags: parseTags(detail.tags.value),
    area_id: detail.area.value || null,
    area: areaById(detail.area.value)?.name || "Life",
    priority: detail.priority.value,
    due_date: detail.due.value || null,
    energy: detail.energy.value
  };
}

function queueDetailAutosave() {
  if (!detail.id.value || !detail.title.value.trim()) return;
  queueAutosave(`task:${detail.id.value}`, () => patchTask(detail.id.value, detailPayload(), { render: false }));
}

els.detailForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  await patchTask(detail.id.value, detailPayload());
});

els.detailForm.addEventListener("input", queueDetailAutosave);

els.detailForm.addEventListener("change", queueDetailAutosave);

els.addAreaButton.addEventListener("click", () => {
  const name = els.newAreaName.value.trim();
  if (!name) return;
  const area = ensureArea(name, els.newAreaColor.value);
  if (area) persistArea(area, { render: false });
  els.newAreaName.value = "";
  render();
});

els.areaList.addEventListener("input", (event) => {
  const row = event.target.closest(".area-row");
  if (!row) return;
  updateAreaRow(row, true);
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
    area_id: parent.area_id || areaIdForName(parent.area),
    area: areaNameFor(parent),
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
  const task = state.tasks.find((item) => item.id === id);
  if (!task) return;
  const childCount = descendantIds(id).length;
  const message = childCount
    ? `Delete "${task.title}" and ${childCount} subtask${childCount === 1 ? "" : "s"}? This cannot be undone.`
    : `Delete "${task.title}"? This cannot be undone.`;
  if (!window.confirm(message)) return;
  state.selectedId = null;
  await deleteTask(id);
});

els.syncButton.addEventListener("click", async () => {
  if (state.supabase && !state.user) {
    await signInWithGoogle();
    return;
  }
  await loadTasks();
});

els.densityDown.addEventListener("click", () => {
  adjustDensity(-1);
});

els.densityUp.addEventListener("click", () => {
  adjustDensity(1);
});

els.keyButton.addEventListener("click", async () => {
  if (state.user) {
    await signOut();
    return;
  }
  await signInWithGoogle();
});

await loadConfig();
await initSupabase();
await claimLegacyTasks();
saveNamedOptions();
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
