import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const APP_VERSION = "1.10.22";

const densityOptions = ["compact", "comfort", "roomy"];
const densityLabels = { compact: "Compact", comfort: "Comfort", roomy: "Roomy" };
const timelineZoomLevels = [1.2, 2, 3.5, 6, 10, 18, 30, 42, 60, 84, 120];
const autosaveTimers = new Map();
let assignmentDrag = null;
let suppressAssignmentClick = false;
let assignmentDrawFrame = 0;
let assignmentResizeObserver = null;
let suppressHistorySync = false;
let browserHistoryReady = false;

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
const defaultProjectTypes = ["Play", "Short Film", "Performance"].map((name, index) => ({ name, sort_order: (index + 1) * 1000 }));
const defaultProjectStatuses = ["Not started", "In progress", "Completed", "Deprioritized"].map((name, index) => ({ name, sort_order: (index + 1) * 1000 }));
const defaultRoles = ["Director", "Producer", "Writer", "Actor"].map((name, index) => ({ name, sort_order: (index + 1) * 1000 }));
const defaultVenues = [];

function loadPeopleSort() {
  try {
    const parsed = JSON.parse(localStorage.getItem("people-sort") || "{}");
    return {
      key: parsed.key || "firstName",
      direction: parsed.direction === "desc" ? "desc" : "asc"
    };
  } catch {
    return { key: "firstName", direction: "asc" };
  }
}

const state = {
  tasks: [],
  goals: [],
  ideas: [],
  projects: [],
  people: [],
  projectAssignments: [],
  goalLinks: [],
  skills: loadNamedOptions("planner-skills", defaultSkills),
  relationshipTypes: loadNamedOptions("planner-relationship-types", defaultRelationshipTypes),
  projectTypes: loadNamedOptions("planner-project-types", defaultProjectTypes),
  projectStatuses: loadNamedOptions("planner-project-statuses", defaultProjectStatuses),
  roles: loadNamedOptions("planner-roles", defaultRoles),
  venues: loadNamedOptions("planner-venues", defaultVenues),
  selectedAssignmentTaskId: "",
  selectedAssignmentPersonId: "",
  assignmentSelectedOnly: localStorage.getItem("assignment-selected-only") === "true",
  selectedId: null,
  focusedId: "",
  focusedReturnView: "home",
  view: "home",
  taskFilter: ["today", "upcoming", "backlog", "done"].includes(localStorage.getItem("task-filter")) ? localStorage.getItem("task-filter") : "today",
  search: "",
  tagFilter: "",
  sort: "manual",
  peopleSort: loadPeopleSort(),
  projectSort: ["name", "startDate"].includes(localStorage.getItem("project-sort")) ? localStorage.getItem("project-sort") : "name",
  projectViewMode: localStorage.getItem("project-view-mode") === "minimal" ? "minimal" : "full",
  showDone: localStorage.getItem("show-done") === "true",
  density: densityOptions.includes(localStorage.getItem("planner-density")) ? localStorage.getItem("planner-density") : "comfort",
  draggingId: null,
  syncError: "",
  syncMessage: "",
  peopleCloudReady: false,
  projectsCloudReady: false,
  venuesCloudReady: false,
  goalLinksCloudReady: false,
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
  taskFilterBar: document.querySelector("#task-filter-bar"),
  entryPanel: document.querySelector("#entry-panel"),
  plannerGrid: document.querySelector("#planner-grid"),
  area: document.querySelector("#area"),
  goal: document.querySelector("#goal-id"),
  project: document.querySelector("#project-id"),
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
  expandTaskButton: document.querySelector("#expand-task-button"),
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
  project: document.querySelector("#detail-project"),
  dependencies: document.querySelector("#detail-dependencies"),
  tags: document.querySelector("#detail-tags"),
  area: document.querySelector("#detail-area"),
  priority: document.querySelector("#detail-priority"),
  due: document.querySelector("#detail-due"),
  energy: document.querySelector("#detail-energy")
};

const counts = {
  tasks: document.querySelector("#count-tasks"),
  today: document.querySelector("#count-today"),
  upcoming: document.querySelector("#count-upcoming"),
  backlog: document.querySelector("#count-backlog"),
  done: document.querySelector("#count-done"),
  goals: document.querySelector("#count-goals"),
  goalAssignments: document.querySelector("#count-goal-assignments"),
  peopleProjects: document.querySelector("#count-people-projects"),
  people: document.querySelector("#count-people"),
  peopleFilter: document.querySelector("#count-people-filter"),
  projects: document.querySelector("#count-projects"),
  projectFilter: document.querySelector("#count-project-filter"),
  ideas: document.querySelector("#count-ideas"),
  graph: document.querySelector("#count-graph"),
  timeline: document.querySelector("#count-timeline"),
  areas: document.querySelector("#count-areas"),
  skills: document.querySelector("#count-skills"),
  relationships: document.querySelector("#count-relationships"),
  projectTypes: document.querySelector("#count-project-types"),
  projectStatuses: document.querySelector("#count-project-statuses"),
  roles: document.querySelector("#count-roles"),
  venues: document.querySelector("#count-venues"),
  home: document.querySelector("#count-home"),
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
  localStorage.setItem("planner-project-types", JSON.stringify(state.projectTypes));
  localStorage.setItem("planner-project-statuses", JSON.stringify(state.projectStatuses));
  localStorage.setItem("planner-roles", JSON.stringify(state.roles));
  localStorage.setItem("planner-venues", JSON.stringify(state.venues));
}

function creationDraftKey(form) {
  if (!form?.id) return "";
  const suffix = form.id === "named-settings-form" ? `:${form.dataset.optionType || "settings"}` : "";
  return `planner-draft:${form.id}${suffix}`;
}

function serializeCreationDraft(form) {
  const data = {};
  for (const element of form.elements) {
    if (!element.name || element.disabled || element.type === "submit" || element.type === "button") continue;
    if (element.type === "checkbox") {
      data[element.name] = element.checked;
    } else if (element.type === "radio") {
      if (element.checked) data[element.name] = element.value;
    } else {
      const value = element.value;
      if (data[element.name] === undefined) data[element.name] = value;
      else if (Array.isArray(data[element.name])) data[element.name].push(value);
      else data[element.name] = [data[element.name], value];
    }
  }
  return data;
}

function draftHasValue(draft) {
  return Object.values(draft).some((value) => Array.isArray(value) ? value.some(Boolean) : Boolean(value));
}

function saveCreationDraft(form) {
  const key = creationDraftKey(form);
  if (!key) return;
  const draft = serializeCreationDraft(form);
  if (draftHasValue(draft)) localStorage.setItem(key, JSON.stringify(draft));
  else localStorage.removeItem(key);
}

function clearCreationDraft(form) {
  const key = creationDraftKey(form);
  if (key) localStorage.removeItem(key);
}

function restoreCreationDraft(form) {
  const key = creationDraftKey(form);
  if (!key) return null;
  try {
    const draft = JSON.parse(localStorage.getItem(key) || "null");
    if (!draft) return null;
    for (const [name, value] of Object.entries(draft)) {
      if (name === "skillIds") continue;
      const elements = [...form.elements].filter((element) => element.name === name);
      if (!elements.length) continue;
      if (elements[0].type === "checkbox") {
        elements[0].checked = Boolean(value);
      } else if (elements[0].type === "radio") {
        elements.forEach((element) => {
          element.checked = element.value === value;
        });
      } else {
        elements[0].value = Array.isArray(value) ? value[0] || "" : value;
      }
    }
    return draft;
  } catch {
    localStorage.removeItem(key);
    return null;
  }
}

function closestCreationForm(target) {
  return target.closest("#goal-form, #idea-form, #areas-settings-form, #person-form, #project-form, #named-settings-form");
}

function normalizedNaturalKey(value) {
  return String(value || "").trim().replace(/\s+/g, " ").toLowerCase();
}

function personNameFromParts(firstName, lastName) {
  return [firstName, lastName].map((value) => String(value || "").trim()).filter(Boolean).join(" ");
}

function hasDuplicateGoalName(name, excludeId = "") {
  const key = normalizedNaturalKey(name);
  return Boolean(key) && state.goals.some((goal) => goal.id !== excludeId && normalizedNaturalKey(goal.name) === key);
}

function hasDuplicateProjectName(name, excludeId = "") {
  const key = normalizedNaturalKey(name);
  return Boolean(key) && state.projects.some((project) => project.id !== excludeId && normalizedNaturalKey(project.name) === key);
}

function hasDuplicatePersonName(firstName, lastName, excludeId = "") {
  const key = normalizedNaturalKey(personNameFromParts(firstName, lastName));
  return Boolean(key) && state.people.some((person) => (
    person.id !== excludeId && normalizedNaturalKey(personNameFromParts(person.first_name, person.last_name)) === key
  ));
}

function alertDuplicate(label, value) {
  window.alert(`${label} "${value}" already exists.`);
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

function validView(view) {
  const views = new Set([
    "home",
    "tasks",
    "goals",
    "goal-assignments",
    "people-projects",
    "people",
    "people-filter",
    "projects",
    "project-filter",
    "ideas",
    "graph",
    "timeline",
    "areas",
    "skills",
    "relationships",
    "project-types",
    "project-statuses",
    "roles",
    "venues",
    "focus-task",
    "focus-project",
    "focus-goal",
    "focus-person"
  ]);
  if (["today", "upcoming", "backlog", "done"].includes(view)) return "tasks";
  return views.has(view) ? view : "home";
}

function routeFromState() {
  return {
    view: state.view,
    taskFilter: state.taskFilter,
    selectedId: state.selectedId || "",
    focusedId: state.focusedId || "",
    focusedReturnView: state.focusedReturnView || "home"
  };
}

function currentRouteSearch() {
  const route = routeFromState();
  const params = new URLSearchParams();
  if (route.view !== "home") params.set("view", route.view);
  if (route.view === "tasks") params.set("filter", route.taskFilter);
  if (route.selectedId && ["tasks", "graph", "timeline"].includes(route.view)) params.set("selected", route.selectedId);
  if (route.view.startsWith("focus-") && route.focusedId) {
    params.set("id", route.focusedId);
    params.set("from", route.focusedReturnView);
  }
  const query = params.toString();
  return query ? `?${query}` : "";
}

function syncBrowserHistory() {
  if (suppressHistorySync) return;
  const route = routeFromState();
  const nextUrl = `${window.location.pathname}${currentRouteSearch()}${window.location.hash || ""}`;
  const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash || ""}`;
  if (nextUrl === currentUrl) {
    if (!browserHistoryReady) {
      window.history.replaceState(route, "", nextUrl);
      browserHistoryReady = true;
    }
    return;
  }
  const method = browserHistoryReady ? "pushState" : "replaceState";
  window.history[method](route, "", nextUrl);
  browserHistoryReady = true;
}

function applyRouteFromLocation(options = {}) {
  const params = new URLSearchParams(window.location.search);
  const rawView = params.get("view") || "home";
  const view = validView(rawView);
  state.view = view;
  if (["today", "upcoming", "backlog", "done"].includes(rawView)) state.taskFilter = rawView;
  if (view === "tasks") setTaskFilter(params.get("filter") || state.taskFilter);
  state.selectedId = params.get("selected") || null;
  state.focusedId = view.startsWith("focus-") ? params.get("id") || state.selectedId || "" : "";
  state.focusedReturnView = params.get("from") || state.focusedReturnView || "home";
  if (options.render) {
    suppressHistorySync = true;
    render();
    suppressHistorySync = false;
  }
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
    els.syncError.textContent = `Save issue: ${state.syncError}. Your changes are kept in this browser; press Sync to retry.`;
    els.syncError.classList.remove("hidden");
  } else {
    els.syncError.textContent = "";
    els.syncError.classList.add("hidden");
  }
}

function refreshSharedPlannerUi() {
  renderCounts();
  renderTagFilters();
  renderAreas();
  renderParentControls();
}

function showSyncMessage(message) {
  state.syncError = "";
  state.syncMessage = message;
  renderSyncStatus();
}

function withAutosaveTimeout(callback, timeoutMs = 10000) {
  let timeoutId;
  const timeout = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error("Autosave timed out. Try Sync, or reload and try again.")), timeoutMs);
  });
  return Promise.race([Promise.resolve().then(callback), timeout]).finally(() => clearTimeout(timeoutId));
}

function setFormSaving(form, saving, label = "Saving...") {
  const button = form?.querySelector("button[type='submit'], input[type='submit']");
  if (!button) return;
  if (saving) {
    if (!button.dataset.idleText) button.dataset.idleText = button.textContent || button.value || "";
    if ("value" in button) button.value = label;
    else button.textContent = label;
    button.disabled = true;
    button.classList.add("is-saving");
  } else {
    const idleText = button.dataset.idleText;
    if (idleText) {
      if ("value" in button) button.value = idleText;
      else button.textContent = idleText;
    }
    button.disabled = false;
    button.classList.remove("is-saving");
  }
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
        await withAutosaveTimeout(callback);
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
  return state.areas.find((area) => area.name === name)?.color || "#111827";
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
  if (hex.length !== 6) return "rgba(17, 24, 39, 0.1)";
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

function startOfMonthIso(value) {
  const date = new Date(`${value}T12:00:00`);
  date.setDate(1);
  return date.toISOString().slice(0, 10);
}

function addMonthsToIso(value, months) {
  const date = new Date(`${value}T12:00:00`);
  date.setMonth(date.getMonth() + months);
  return date.toISOString().slice(0, 10);
}

function timelineMonthLabel(value, includeYear = false) {
  const date = new Date(`${value}T12:00:00`);
  return new Intl.DateTimeFormat(undefined, includeYear ? { month: "short", year: "numeric" } : { month: "short" }).format(date);
}

function timelineZoomIndex(value = state.timelineZoom) {
  const zoom = Number(value) || 42;
  let closest = 0;
  let distance = Infinity;
  timelineZoomLevels.forEach((level, index) => {
    const levelDistance = Math.abs(level - zoom);
    if (levelDistance < distance) {
      closest = index;
      distance = levelDistance;
    }
  });
  return closest;
}

function timelineZoomLabel(pixelsPerDay) {
  if (pixelsPerDay <= 2) return "Year";
  if (pixelsPerDay <= 6) return "Quarter";
  if (pixelsPerDay <= 12) return "Month";
  if (pixelsPerDay <= 30) return "Week";
  return `${pixelsPerDay}px/day`;
}

function timelineTickStep(pixelsPerDay) {
  if (pixelsPerDay <= 2) return { unit: "month", step: 3 };
  if (pixelsPerDay <= 6) return { unit: "month", step: 1 };
  if (pixelsPerDay <= 12) return { unit: "month", step: 1 };
  if (pixelsPerDay <= 30) return { unit: "day", step: 14 };
  if (pixelsPerDay <= 60) return { unit: "day", step: 7 };
  return { unit: "day", step: pixelsPerDay >= 84 ? 1 : 2 };
}

function timelineTicks(startDate, endDate, pixelsPerDay) {
  const ticks = [];
  const { unit, step } = timelineTickStep(pixelsPerDay);
  if (unit === "month") {
    let current = startOfMonthIso(startDate);
    if (pixelsPerDay <= 2) {
      const aligned = new Date(`${current}T12:00:00`);
      aligned.setMonth(Math.floor(aligned.getMonth() / 3) * 3);
      current = aligned.toISOString().slice(0, 10);
    }
    while (current <= endDate) {
      const date = new Date(`${current}T12:00:00`);
      const month = date.getMonth();
      const isJanuary = month === 0;
      const shouldLabel = pixelsPerDay <= 2 ? month % 3 === 0 : true;
      ticks.push({
        date: current,
        label: shouldLabel ? timelineMonthLabel(current, isJanuary || pixelsPerDay <= 2) : "",
        major: isJanuary
      });
      current = addMonthsToIso(current, step);
    }
    return ticks;
  }

  for (let day = 0; day <= daysBetween(startDate, endDate); day += step) {
    const date = addDaysToIso(startDate, day);
    ticks.push({ date, label: formatDate(date), major: false });
  }
  return ticks;
}

function normalizeDateRangeInputs(container, options = {}) {
  const startInput = container.querySelector("[name='startDate']");
  const endInput = container.querySelector("[name='endDate']");
  if (!startInput || !endInput) return;
  endInput.min = startInput.value || "";
  if (options.anchorEnd && startInput.value && !endInput.value) endInput.value = startInput.value;
  if (startInput.value && endInput.value && endInput.value < startInput.value) endInput.value = startInput.value;
}

function defaultDueDateForView() {
  const filter = state.view === "tasks" ? state.taskFilter : state.view;
  if (filter === "today") return todayIso();
  if (filter === "upcoming") return addDaysIso(1);
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

function goalIdsForTask(task) {
  return parseIds([...parseIds(task.goal_ids || task.goalIds), task.goal_id || task.goalId || ""]);
}

function taskHasGoal(task, goalId) {
  return goalIdsForTask(task).includes(goalId);
}

function applyGoalLinksToTasks(tasks, links) {
  const byTask = new Map();
  for (const link of links) {
    if (!byTask.has(link.task_id)) byTask.set(link.task_id, []);
    byTask.get(link.task_id).push(link.goal_id);
  }
  return tasks.map((task) => {
    const linkedIds = parseIds(byTask.get(task.id) || []);
    const goalIds = linkedIds.length ? linkedIds : goalIdsForTask(task);
    return { ...task, goal_ids: goalIds, goal_id: goalIds[0] || "" };
  });
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

function normalizeProject(project) {
  const legacyDate = project.target_date || project.targetDate || "";
  return {
    id: project.id || makeId(),
    user_id: project.user_id || project.userId || state.user?.id || null,
    name: project.name || "",
    description: project.description || "",
    project_type_id: project.project_type_id || project.projectTypeId || "",
    project_status_id: project.project_status_id || project.projectStatusId || project.status_id || projectStatusIdForName(project.status),
    venue_id: project.venue_id || project.venueId || "",
    status: project.status || "",
    start_date: project.start_date || project.startDate || "",
    end_date: project.end_date || project.endDate || legacyDate,
    target_date: legacyDate,
    created_at: project.created_at || nowIso(),
    updated_at: project.updated_at || nowIso()
  };
}

function normalizeProjectAssignment(assignment) {
  return {
    id: assignment.id || makeId(),
    user_id: assignment.user_id || assignment.userId || state.user?.id || null,
    project_id: assignment.project_id || assignment.projectId || "",
    person_id: assignment.person_id || assignment.personId || "",
    role_ids: parseIds(assignment.role_ids || assignment.roleIds),
    created_at: assignment.created_at || nowIso(),
    updated_at: assignment.updated_at || nowIso()
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
  const goalIds = parseIds(task.goal_ids || task.goalIds || task.goal_id || task.goalId);
  return {
    id: task.id || makeId(),
    owner_key: task.owner_key || state.plannerKey || "local",
    user_id: task.user_id || task.userId || null,
    goal_id: goalIds[0] || "",
    goal_ids: goalIds,
    project_id: task.project_id || task.projectId || "",
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
  const goalIds = goalIdsForTask(task);
  const payload = {
    id: task.id,
    owner_key: state.plannerKey || state.user?.id || "local",
    user_id: state.user?.id || null,
    goal_id: goalIds[0] || null,
    project_id: task.project_id || null,
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
  if (!state.projectsCloudReady) delete payload.project_id;
  return payload;
}

function databasePatchPayload(changes) {
  const payload = {};
  for (const [key, value] of Object.entries(changes)) {
    if (value !== undefined && key !== "goal_ids") payload[key] = value;
  }
  if ("goal_ids" in changes) payload.goal_id = parseIds(changes.goal_ids)[0] || null;
  if ("parent_id" in payload) payload.parent_id = payload.parent_id || null;
  if ("goal_id" in payload) payload.goal_id = payload.goal_id || null;
  if ("project_id" in payload) payload.project_id = payload.project_id || null;
  if (!state.projectsCloudReady) delete payload.project_id;
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
  const rawProjects = localStorage.getItem("planner-projects");
  const rawProjectAssignments = localStorage.getItem("planner-project-assignments");
  const rawPeople = localStorage.getItem("planner-people");
  state.tasks = ensureSortOrders(raw ? JSON.parse(raw).map(normalizeTask) : seedTasks());
  state.goals = rawGoals ? JSON.parse(rawGoals).map(normalizeGoal) : [];
  state.ideas = rawIdeas ? JSON.parse(rawIdeas).map(normalizeIdea) : [];
  state.projects = rawProjects ? JSON.parse(rawProjects).map(normalizeProject) : [];
  state.projectAssignments = rawProjectAssignments ? JSON.parse(rawProjectAssignments).map(normalizeProjectAssignment) : [];
  state.people = rawPeople ? JSON.parse(rawPeople).map(normalizePerson) : [];
  state.syncError = "";
  state.syncMessage = "Using local browser storage. Click Key, enter your planner key, and click Connect to use Supabase.";
  saveLocal();
}

function saveLocal(options = {}) {
  localStorage.setItem("planner-tasks", JSON.stringify(state.tasks));
  localStorage.setItem("planner-goals", JSON.stringify(state.goals));
  localStorage.setItem("planner-ideas", JSON.stringify(state.ideas));
  localStorage.setItem("planner-projects", JSON.stringify(state.projects));
  localStorage.setItem("planner-project-assignments", JSON.stringify(state.projectAssignments));
  localStorage.setItem("planner-people", JSON.stringify(state.people));
  if (!options.silent) state.syncMessage = "Saved locally in this browser only.";
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
    .sort((a, b) => sortByLabel(a.title, b.title));
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
  for (const task of sortedByTitle(state.tasks.filter((item) => item.id !== excludeId))) {
    const option = document.createElement("option");
    option.value = task.id;
    option.textContent = task.title;
    option.selected = values.has(task.id);
    select.append(option);
  }
}

function fillAreaSelect(select, selected = "") {
  select.innerHTML = "";
  for (const area of sortedByName(state.areas)) {
    const option = document.createElement("option");
    option.value = area.id;
    option.textContent = area.name;
    select.append(option);
  }
  select.value = selected || state.areas[0]?.id || "";
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

let loadTasksPromise = null;

async function loadTasks() {
  if (!loadTasksPromise) {
    loadTasksPromise = loadTasksNow().finally(() => {
      loadTasksPromise = null;
    });
  }
  return loadTasksPromise;
}

async function waitForInitialCloudLoad() {
  if (loadTasksPromise) await loadTasksPromise;
}

async function loadTasksNow() {
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
    const projects = await loadProjectsData();
    const goalLinks = await loadGoalLinksData();
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
    state.tasks = ensureSortOrders(applyGoalLinksToTasks(rows.map(normalizeTask), goalLinks || []));
    state.goals = goals.map(normalizeGoal);
    state.ideas = ideas.map(normalizeIdea);
    if (projects) state.projects = projects;
    if (goalLinks) {
      state.goalLinks = goalLinks;
      await seedGoalLinksFromLegacyTasks();
      state.tasks = ensureSortOrders(applyGoalLinksToTasks(state.tasks, state.goalLinks));
    }
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

async function loadGoalLinksData() {
  try {
    const { data, error } = await state.supabase
      .from("planner_task_goal_links")
      .select("*")
      .eq("user_id", state.user.id);
    if (error) throw error;
    state.goalLinksCloudReady = true;
    return data || [];
  } catch (error) {
    console.warn("Supabase task-goal links table unavailable; using legacy goal links", error);
    state.goalLinksCloudReady = false;
    state.syncMessage = state.syncMessage || "Goal links are local until you run the latest Supabase migration.";
    return null;
  }
}

async function syncTaskGoalLinks(taskId, goalIds) {
  const ids = parseIds(goalIds);
  state.goalLinks = [
    ...state.goalLinks.filter((link) => link.task_id !== taskId),
    ...ids.map((goalId) => ({ task_id: taskId, goal_id: goalId, user_id: state.user?.id || null }))
  ];
  if (!isSupabaseReady() || !state.goalLinksCloudReady) return;
  const { error: deleteError } = await state.supabase.from("planner_task_goal_links").delete().eq("task_id", taskId);
  if (deleteError) throw deleteError;
  if (!ids.length) return;
  const rows = ids.map((goalId) => ({ task_id: taskId, goal_id: goalId, user_id: state.user.id }));
  const { error } = await state.supabase.from("planner_task_goal_links").insert(rows);
  if (error) throw error;
}

async function seedGoalLinksFromLegacyTasks() {
  if (!state.goalLinksCloudReady || state.goalLinks.length) return;
  const legacyTasks = state.tasks.filter((task) => task.goal_id);
  if (!legacyTasks.length) return;
  for (const task of legacyTasks) {
    await syncTaskGoalLinks(task.id, [task.goal_id]);
  }
}

async function persistTask(task) {
  const normalizedTask = normalizeTask(task);
  if (!isSupabaseReady()) {
    const index = state.tasks.findIndex((item) => item.id === normalizedTask.id);
    if (index >= 0) state.tasks[index] = normalizedTask;
    else state.tasks.unshift(normalizedTask);
    ensureSortOrders(state.tasks);
    saveLocal();
    render();
    return;
  }

  const payload = databasePayload(normalizedTask);
  try {
    const { data: savedRow, error } = await state.supabase
      .from("planner_tasks")
      .upsert(payload)
      .select()
      .single();
    if (error) throw error;
    state.syncError = "";
    state.syncMessage = `Saved for ${keyLabel()}.`;
    const saved = normalizeTask({ ...savedRow, goal_ids: goalIdsForTask(normalizedTask) });
    await syncTaskGoalLinks(saved.id, saved.goal_ids);
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
  const optimistic = options.optimistic === true;

  if (optimistic) {
    state.tasks = state.tasks.map((task) => (task.id === id ? updated : task));
    ensureSortOrders(state.tasks);
    saveLocal();
    state.syncError = "";
    state.syncMessage = "Saving...";
    if ("goal_ids" in changes || "goal_id" in changes) {
      state.goalLinks = [
        ...state.goalLinks.filter((link) => link.task_id !== id),
        ...goalIdsForTask(updated).map((goalId) => ({ task_id: id, goal_id: goalId, user_id: state.user?.id || null }))
      ];
    }
    if (options.render !== false) render();
  }

  if (!isSupabaseReady()) {
    if (!optimistic) state.tasks = state.tasks.map((task) => (task.id === id ? updated : task));
    if ("goal_ids" in changes || "goal_id" in changes) {
      await syncTaskGoalLinks(id, goalIdsForTask(updated));
    }
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
    const saved = normalizeTask({ ...savedRow, goal_ids: goalIdsForTask(updated) });
    if ("goal_ids" in changes || "goal_id" in changes) {
      await syncTaskGoalLinks(id, saved.goal_ids);
    }
    state.tasks = state.tasks.map((task) => (task.id === id ? saved : task));
    ensureSortOrders(state.tasks);
    if (options.render !== false) render();
  } catch (error) {
    state.syncError = error.message;
    state.syncMessage = "";
    if (options.render !== false) render();
    console.error("Supabase update failed", error);
  }
}

async function patchTaskWithFeedback(id, changes, options = {}) {
  clearTimeout(autosaveTimers.get(`task:${id}`));
  autosaveTimers.delete(`task:${id}`);
  showSyncMessage("Saving...");
  try {
    await withAutosaveTimeout(() => patchTask(id, changes, { ...options, optimistic: true }), 10000);
    if (!state.syncError) showSyncMessage(`Saved at ${savedAtLabel()}.`);
    else renderSyncStatus();
  } catch (error) {
    state.syncError = error.message;
    state.syncMessage = "";
    renderSyncStatus();
  }
}

async function persistGoal(goal, options = {}) {
  const normalized = normalizeGoal({ ...goal, user_id: state.user?.id || null, updated_at: nowIso() });
  if (!isSupabaseReady()) {
    if (options.requireCloud) {
      state.syncError = "Life goal was not saved to database: database is not connected.";
      state.syncMessage = "";
      if (options.render !== false) render();
      throw new Error(state.syncError);
    }
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
    state.syncMessage = `Saved life goal to database at ${savedAtLabel()}.`;
    state.syncError = "";
    if (options.render !== false) render();
    return { savedToCloud: true };
  } catch (error) {
    state.syncError = `Life goal was not saved to database: ${error.message}`;
    state.syncMessage = "";
    if (options.render !== false) render();
    if (options.requireCloud) throw new Error(state.syncError);
    return { savedToCloud: false };
  }
}

async function loadProjectsData() {
  try {
    const [
      { data: projects, error: projectsError },
      { data: projectTypes, error: projectTypesError },
      { data: projectStatuses, error: projectStatusesError },
      { data: roles, error: rolesError },
      { data: assignments, error: assignmentsError }
    ] = await Promise.all([
      state.supabase
        .from("planner_projects")
        .select("*")
        .eq("user_id", state.user.id)
        .order("created_at", { ascending: true }),
      state.supabase
        .from("planner_project_types")
        .select("*")
        .eq("user_id", state.user.id)
        .order("sort_order", { ascending: true }),
      state.supabase
        .from("planner_project_statuses")
        .select("*")
        .eq("user_id", state.user.id)
        .order("sort_order", { ascending: true }),
      state.supabase
        .from("planner_roles")
        .select("*")
        .eq("user_id", state.user.id)
        .order("sort_order", { ascending: true }),
      state.supabase
        .from("planner_project_people")
        .select("*")
        .eq("user_id", state.user.id)
        .order("created_at", { ascending: true })
    ]);
    if (projectsError || projectTypesError || projectStatusesError || rolesError || assignmentsError) {
      throw projectsError || projectTypesError || projectStatusesError || rolesError || assignmentsError;
    }
    state.projectsCloudReady = true;
    const normalizedProjectTypes = projectTypes.map(normalizeNamedOption);
    const normalizedProjectStatuses = projectStatuses.map(normalizeNamedOption);
    const normalizedRoles = roles.map(normalizeNamedOption);
    try {
      const { data: venues, error: venuesError } = await state.supabase
        .from("planner_venues")
        .select("*")
        .eq("user_id", state.user.id)
        .order("sort_order", { ascending: true });
      if (venuesError) throw venuesError;
      state.venuesCloudReady = true;
      const normalizedVenues = venues.map(normalizeNamedOption);
      state.venues = normalizedVenues.length ? normalizedVenues : state.venues;
    } catch (error) {
      state.venuesCloudReady = false;
      state.syncMessage = state.syncMessage || "Venues are local until you run migration 012.";
      console.warn("Supabase venues table unavailable; keeping venues local", error);
    }
    if (!normalizedProjectTypes.length) {
      await Promise.all(state.projectTypes.map((type) => persistNamedOption("project-types", type, { render: false })));
    }
    if (!normalizedProjectStatuses.length) {
      await Promise.all(state.projectStatuses.map((status) => persistNamedOption("project-statuses", status, { render: false })));
    }
    if (!normalizedRoles.length) {
      await Promise.all(state.roles.map((role) => persistNamedOption("roles", role, { render: false })));
    }
    state.projectTypes = normalizedProjectTypes.length ? normalizedProjectTypes : state.projectTypes;
    state.projectStatuses = normalizedProjectStatuses.length ? normalizedProjectStatuses : state.projectStatuses;
    state.roles = normalizedRoles.length ? normalizedRoles : state.roles;
    state.projectAssignments = assignments.map(normalizeProjectAssignment);
    saveNamedOptions();
    return projects.map(normalizeProject);
  } catch (error) {
    console.warn("Supabase projects table unavailable; using local projects", error);
    state.projectsCloudReady = false;
    state.syncMessage = "Projects are local until you run the latest Supabase migration.";
    return null;
  }
}

async function persistProject(project, options = {}) {
  const normalized = normalizeProject({ ...project, user_id: state.user?.id || null, updated_at: nowIso() });
  if (!normalized.name) return;
  const previousProjects = state.projects;
  if (options.requireCloud && isSupabaseReady() && !state.projectsCloudReady) {
    const projects = await loadProjectsData();
    if (projects) state.projects = projects;
  }
  if ((!isSupabaseReady() || !state.projectsCloudReady) && options.requireCloud) {
    state.syncError = "Project was not saved to database: database is not connected or the project tables are not ready.";
    state.syncMessage = "";
    if (options.render !== false) render();
    throw new Error(state.syncError);
  }
  const exists = state.projects.some((item) => item.id === normalized.id);
  state.projects = exists
    ? state.projects.map((item) => (item.id === normalized.id ? normalized : item))
    : [normalized, ...state.projects];
  saveLocal({ silent: options.requireCloud });
  if (!isSupabaseReady() || !state.projectsCloudReady) {
    if (options.render !== false) render();
    return;
  }
  try {
    const payload = {
      id: normalized.id,
      user_id: state.user.id,
      name: normalized.name,
      description: normalized.description,
      project_type_id: normalized.project_type_id || null,
      project_status_id: normalized.project_status_id || null,
      status: projectStatusName(normalized),
      start_date: normalized.start_date || null,
      end_date: normalized.end_date || null,
      target_date: normalized.target_date || null,
      created_at: normalized.created_at,
      updated_at: normalized.updated_at
    };
    if (state.venuesCloudReady) payload.venue_id = normalized.venue_id || null;
    const { data, error } = await state.supabase
      .from("planner_projects")
      .upsert(payload)
      .select()
      .single();
    if (error) throw error;
    const saved = normalizeProject(data);
    state.projects = state.projects.map((item) => (item.id === saved.id ? saved : item));
    state.syncMessage = `Saved project to database at ${savedAtLabel()}.`;
    state.syncError = "";
    if (options.render !== false) render();
    return { savedToCloud: true };
  } catch (error) {
    if (options.requireCloud) {
      state.projects = previousProjects;
      saveLocal({ silent: true });
    }
    state.syncError = `Project was not saved to database: ${error.message}`;
    state.syncMessage = "";
    if (options.render !== false) render();
    if (options.requireCloud) throw new Error(state.syncError);
    return { savedToCloud: false };
  }
}

async function deleteProject(id) {
  const project = state.projects.find((item) => item.id === id);
  if (!project) return;
  const linkedCount = state.tasks.filter((task) => task.project_id === id).length;
  const assignedCount = state.projectAssignments.filter((assignment) => assignment.project_id === id).length;
  const message = linkedCount
    ? `Delete "${project.name}"? ${linkedCount} linked task${linkedCount === 1 ? "" : "s"} and ${assignedCount} person assignment${assignedCount === 1 ? "" : "s"} will be unlinked, not deleted.`
    : `Delete "${project.name}"?`;
  if (!window.confirm(message)) return;
  state.projects = state.projects.filter((item) => item.id !== id);
  state.projectAssignments = state.projectAssignments.filter((assignment) => assignment.project_id !== id);
  state.tasks = state.tasks.map((task) => (task.project_id === id ? { ...task, project_id: "" } : task));
  saveLocal();
  if (!isSupabaseReady() || !state.projectsCloudReady) {
    render();
    return;
  }
  try {
    await state.supabase.from("planner_tasks").update({ project_id: null, updated_at: nowIso() }).eq("project_id", id);
    await state.supabase.from("planner_project_people").delete().eq("project_id", id);
    const { error } = await state.supabase.from("planner_projects").delete().eq("id", id);
    if (error) throw error;
    state.syncMessage = `Deleted project for ${keyLabel()}.`;
    state.syncError = "";
    render();
  } catch (error) {
    state.syncError = error.message;
    render();
  }
}

async function persistProjectAssignment(assignment, options = {}) {
  const normalized = normalizeProjectAssignment({ ...assignment, user_id: state.user?.id || null, updated_at: nowIso() });
  if (!normalized.project_id || !normalized.person_id) return;
  const exists = state.projectAssignments.some((item) => item.id === normalized.id);
  state.projectAssignments = exists
    ? state.projectAssignments.map((item) => (item.id === normalized.id ? normalized : item))
    : [...state.projectAssignments, normalized];
  saveLocal();
  if (!isSupabaseReady() || !state.projectsCloudReady) {
    if (options.render !== false) render();
    return;
  }
  try {
    const { data, error } = await state.supabase
      .from("planner_project_people")
      .upsert({
        id: normalized.id,
        user_id: state.user.id,
        project_id: normalized.project_id,
        person_id: normalized.person_id,
        role_ids: normalized.role_ids,
        created_at: normalized.created_at,
        updated_at: normalized.updated_at
      })
      .select()
      .single();
    if (error) throw error;
    const saved = normalizeProjectAssignment(data);
    state.projectAssignments = state.projectAssignments.map((item) => (item.id === saved.id ? saved : item));
    state.syncMessage = `Saved project person for ${keyLabel()}.`;
    state.syncError = "";
    if (options.render !== false) render();
  } catch (error) {
    state.syncError = error.message;
    if (options.render !== false) render();
    else throw error;
  }
}

async function deleteProjectAssignment(id, options = {}) {
  const assignment = state.projectAssignments.find((item) => item.id === id);
  if (!assignment) return;
  state.projectAssignments = state.projectAssignments.filter((item) => item.id !== id);
  saveLocal();
  if (!isSupabaseReady() || !state.projectsCloudReady) {
    if (options.render !== false) render();
    return;
  }
  try {
    const { error } = await state.supabase.from("planner_project_people").delete().eq("id", id);
    if (error) throw error;
    state.syncMessage = `Removed project person for ${keyLabel()}.`;
    state.syncError = "";
    if (options.render !== false) render();
  } catch (error) {
    state.syncError = error.message;
    if (options.render !== false) render();
    else throw error;
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
    else throw error;
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
    else throw error;
  }
}

async function deleteArea(id) {
  const area = state.areas.find((item) => item.id === id);
  if (!area) return;
  const usage =
    state.tasks.filter((task) => task.area_id === id || (!task.area_id && task.area === area.name)).length +
    state.ideas.filter((idea) => idea.area_id === id || (!idea.area_id && idea.area === area.name)).length;
  const message = usage
    ? `Delete area "${area.name}"? ${usage} linked item${usage === 1 ? "" : "s"} will keep their text, but show with neutral black styling.`
    : `Delete area "${area.name}"?`;
  if (!window.confirm(message)) return;
  const previousAreas = state.areas;
  state.areas = state.areas.filter((item) => item.id !== id);
  saveAreas();
  saveLocal({ silent: true });
  showSyncMessage("Deleting area...");
  if (!isSupabaseReady()) {
    state.syncMessage = "Deleted area locally in this browser only.";
    render();
    return;
  }
  try {
    const { error } = await state.supabase.from("planner_areas").delete().eq("user_id", state.user.id).eq("id", id);
    if (error) throw error;
    state.syncError = "";
    state.syncMessage = `Deleted area for ${keyLabel()}.`;
    render();
  } catch (error) {
    state.areas = previousAreas;
    saveAreas();
    state.syncError = `Area was not deleted: ${error.message}`;
    state.syncMessage = "";
    render();
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
  if (type === "skills") {
    return { table: "planner_skills", stateKey: "skills", label: "skill", cloudFlag: "peopleCloudReady" };
  }
  if (type === "project-types") {
    return { table: "planner_project_types", stateKey: "projectTypes", label: "project type", cloudFlag: "projectsCloudReady" };
  }
  if (type === "project-statuses") {
    return { table: "planner_project_statuses", stateKey: "projectStatuses", label: "project status", cloudFlag: "projectsCloudReady" };
  }
  if (type === "roles") {
    return { table: "planner_roles", stateKey: "roles", label: "role", cloudFlag: "projectsCloudReady" };
  }
  if (type === "venues") {
    return { table: "planner_venues", stateKey: "venues", label: "venue", cloudFlag: "venuesCloudReady" };
  }
  return { table: "planner_relationship_types", stateKey: "relationshipTypes", label: "relationship", cloudFlag: "peopleCloudReady" };
}

async function persistNamedOption(type, option, options = {}) {
  const config = optionConfig(type);
  const normalized = normalizeNamedOption({ ...option, updated_at: nowIso() });
  const list = state[config.stateKey];
  state[config.stateKey] = list.some((item) => item.id === normalized.id)
    ? list.map((item) => (item.id === normalized.id ? normalized : item))
    : [...list, normalized];
  saveNamedOptions();
  if (!isSupabaseReady() || !state[config.cloudFlag]) {
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
    else throw error;
  }
}

function namedOptionUsage(type, id) {
  if (type === "skills") return state.people.filter((person) => person.skill_ids.includes(id)).length;
  if (type === "project-types") return state.projects.filter((project) => project.project_type_id === id).length;
  if (type === "project-statuses") return state.projects.filter((project) => project.project_status_id === id).length;
  if (type === "venues") return state.projects.filter((project) => project.venue_id === id).length;
  if (type === "roles") return state.projectAssignments.filter((assignment) => assignment.role_ids.includes(id)).length;
  return state.people.filter((person) => person.relationship_type_id === id).length;
}

function detachAnnotationReferences(type, id) {
  if (type === "skills") {
    state.people = state.people.map((person) => ({ ...person, skill_ids: person.skill_ids.filter((skillId) => skillId !== id) }));
  } else if (type === "project-types") {
    state.projects = state.projects.map((project) => (project.project_type_id === id ? { ...project, project_type_id: "" } : project));
  } else if (type === "project-statuses") {
    state.projects = state.projects.map((project) =>
      project.project_status_id === id ? { ...project, project_status_id: "", status: "" } : project
    );
  } else if (type === "venues") {
    state.projects = state.projects.map((project) => (project.venue_id === id ? { ...project, venue_id: "" } : project));
  } else if (type === "roles") {
    state.projectAssignments = state.projectAssignments.map((assignment) => ({
      ...assignment,
      role_ids: assignment.role_ids.filter((roleId) => roleId !== id)
    }));
  } else {
    state.people = state.people.map((person) => (person.relationship_type_id === id ? { ...person, relationship_type_id: "" } : person));
  }
}

async function deleteNamedOption(type, id) {
  const config = optionConfig(type);
  const option = state[config.stateKey].find((item) => item.id === id);
  if (!option) return;
  const usage = namedOptionUsage(type, id);
  const message = usage
    ? `Delete ${config.label} "${option.name}"? ${usage} linked item${usage === 1 ? "" : "s"} will keep their data, but show with neutral black styling where this annotation was used.`
    : `Delete ${config.label} "${option.name}"?`;
  if (!window.confirm(message)) return;
  const previousItems = state[config.stateKey];
  const previousPeople = state.people;
  const previousProjects = state.projects;
  const previousProjectAssignments = state.projectAssignments;
  state[config.stateKey] = previousItems.filter((item) => item.id !== id);
  detachAnnotationReferences(type, id);
  saveNamedOptions();
  saveLocal({ silent: true });
  showSyncMessage(`Deleting ${config.label}...`);
  if (!isSupabaseReady() || !state[config.cloudFlag]) {
    state.syncMessage = `Deleted ${config.label} locally in this browser only.`;
    render();
    return;
  }
  try {
    if (type === "project-statuses") {
      const { error: updateError } = await state.supabase
        .from("planner_projects")
        .update({ project_status_id: null, status: "", updated_at: nowIso() })
        .eq("user_id", state.user.id)
        .eq("project_status_id", id);
      if (updateError) throw updateError;
    }
    const { error } = await state.supabase.from(config.table).delete().eq("user_id", state.user.id).eq("id", id);
    if (error) throw error;
    state.syncError = "";
    state.syncMessage = `Deleted ${config.label} for ${keyLabel()}.`;
    render();
  } catch (error) {
    state[config.stateKey] = previousItems;
    state.people = previousPeople;
    state.projects = previousProjects;
    state.projectAssignments = previousProjectAssignments;
    saveNamedOptions();
    state.syncError = `${config.label} was not deleted: ${error.message}`;
    state.syncMessage = "";
    render();
  }
}

async function persistPerson(person, options = {}) {
  const normalized = normalizePerson({ ...person, user_id: state.user?.id || null, updated_at: nowIso() });
  if (!normalized.first_name) return;
  const previousPeople = state.people;
  if (options.requireCloud && isSupabaseReady() && !state.peopleCloudReady) {
    const peopleData = await loadPeopleData();
    if (peopleData) {
      state.people = peopleData.people;
      state.skills = peopleData.skills;
      state.relationshipTypes = peopleData.relationshipTypes;
      saveNamedOptions();
    }
  }
  if ((!isSupabaseReady() || !state.peopleCloudReady) && options.requireCloud) {
    state.syncError = "Person was not saved to database: database is not connected or the people tables are not ready.";
    state.syncMessage = "";
    if (options.render !== false) render();
    throw new Error(state.syncError);
  }
  const exists = state.people.some((item) => item.id === normalized.id);
  state.people = exists
    ? state.people.map((item) => (item.id === normalized.id ? normalized : item))
    : [normalized, ...state.people];
  saveLocal({ silent: options.requireCloud });
  if (!isSupabaseReady() || !state.peopleCloudReady) {
    if (options.requireCloud) {
      state.syncError = "Person was saved locally only; database is not connected or the people tables are not ready.";
      state.syncMessage = "";
      if (options.render !== false) render();
      throw new Error(state.syncError);
    }
    state.syncMessage = "Saved person locally in this browser only.";
    state.syncError = "";
    if (options.render !== false) render();
    return { savedToCloud: false };
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
    state.syncMessage = `Saved person to database at ${savedAtLabel()}.`;
    state.syncError = "";
    if (options.render !== false) render();
    return { savedToCloud: true };
  } catch (error) {
    if (options.requireCloud) {
      state.people = previousPeople;
      saveLocal({ silent: true });
    }
    state.syncError = `Person was not saved to database: ${error.message}`;
    state.syncMessage = "";
    if (options.render !== false) render();
    if (options.requireCloud) throw new Error(state.syncError);
    return { savedToCloud: false };
  }
}

async function deletePerson(id) {
  const person = state.people.find((item) => item.id === id);
  if (!person) return;
  if (!window.confirm(`Delete ${person.first_name}${person.last_name ? ` ${person.last_name}` : ""}?`)) return;
  state.people = state.people.filter((item) => item.id !== id);
  state.projectAssignments = state.projectAssignments.filter((assignment) => assignment.person_id !== id);
  saveLocal();
  if (!isSupabaseReady() || !state.peopleCloudReady) {
    render();
    return;
  }
  try {
    if (state.projectsCloudReady) await state.supabase.from("planner_project_people").delete().eq("person_id", id);
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
  const linkedCount = state.tasks.filter((task) => taskHasGoal(task, id)).length;
  const message = linkedCount
    ? `Delete "${goal.name}"? ${linkedCount} linked task${linkedCount === 1 ? "" : "s"} will be unlinked, not deleted.`
    : `Delete "${goal.name}"?`;
  if (!window.confirm(message)) return;
  if (!isSupabaseReady()) {
    state.goals = state.goals.filter((item) => item.id !== id);
    state.tasks = state.tasks.map((task) => {
      const goalIds = goalIdsForTask(task).filter((goalId) => goalId !== id);
      return { ...task, goal_ids: goalIds, goal_id: goalIds[0] || "" };
    });
    saveLocal();
    render();
    return;
  }
  try {
    const { error: unlinkError } = await state.supabase.from("planner_tasks").update({ goal_id: null }).eq("goal_id", id);
    if (unlinkError) throw unlinkError;
    if (state.goalLinksCloudReady) {
      const { error: linkError } = await state.supabase.from("planner_task_goal_links").delete().eq("goal_id", id);
      if (linkError) throw linkError;
    }
    const { error } = await state.supabase.from("planner_goals").delete().eq("id", id);
    if (error) throw error;
    state.goals = state.goals.filter((item) => item.id !== id);
    state.goalLinks = state.goalLinks.filter((link) => link.goal_id !== id);
    state.tasks = state.tasks.map((task) => {
      const goalIds = goalIdsForTask(task).filter((goalId) => goalId !== id);
      return { ...task, goal_ids: goalIds, goal_id: goalIds[0] || "" };
    });
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
  if (task.status === "done") return "done";
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
      const taskFilter = state.view === "tasks" ? state.taskFilter : state.view;
      if (taskFilter === "done") return task.status === "done";
      if (task.status === "done" && !state.showDone) return false;
      return taskBucket(task) === taskFilter;
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

  counts.tasks.textContent = state.tasks.length;
  counts.home.textContent = state.tasks.length + state.goals.length + state.projects.length + state.people.length + state.ideas.length;
  counts.today.textContent = bucketCounts.today;
  counts.upcoming.textContent = bucketCounts.upcoming;
  counts.backlog.textContent = bucketCounts.backlog;
  counts.done.textContent = bucketCounts.done;
  counts.goals.textContent = state.goals.length;
  counts.goalAssignments.textContent = state.tasks.filter((task) => !task.parent_id && task.status !== "done").length;
  counts.peopleProjects.textContent = state.projectAssignments.length;
  counts.people.textContent = state.people.length;
  counts.peopleFilter.textContent = state.people.length;
  counts.projects.textContent = state.projects.length;
  counts.projectFilter.textContent = state.projects.length;
  counts.ideas.textContent = state.ideas.length;
  counts.graph.textContent = state.tasks.filter((task) => task.status !== "done" || state.showDone).length;
  counts.timeline.textContent = state.tasks.filter((task) => task.status !== "done" || state.showDone).length;
  counts.areas.textContent = state.areas.length;
  counts.skills.textContent = state.skills.length;
  counts.relationships.textContent = state.relationshipTypes.length;
  counts.projectTypes.textContent = state.projectTypes.length;
  counts.projectStatuses.textContent = state.projectStatuses.length;
  counts.roles.textContent = state.roles.length;
  counts.venues.textContent = state.venues.length;
  counts.open.textContent = state.tasks.filter((task) => task.status !== "done").length;
  counts.focus.textContent = state.tasks.filter((task) => task.status !== "done" && task.priority === "High").length;
}

function fillGoalSelect(select, selected = "") {
  select.innerHTML = '<option value="">No goal</option>';
  for (const goal of sortedByName(state.goals)) {
    const option = document.createElement("option");
    option.value = goal.id;
    option.textContent = goal.name;
    select.append(option);
  }
  select.value = selected || "";
}

function fillProjectSelect(select, selected = "") {
  select.innerHTML = '<option value="">No project</option>';
  for (const project of sortedByName(state.projects)) {
    const option = document.createElement("option");
    option.value = project.id;
    option.textContent = project.name;
    select.append(option);
  }
  select.value = selected || "";
}

function fillProjectTypeSelect(select, selected = "") {
  select.innerHTML = '<option value="">No type</option>';
  for (const type of sortedByName(state.projectTypes)) {
    const option = document.createElement("option");
    option.value = type.id;
    option.textContent = type.name;
    select.append(option);
  }
  select.value = selected || "";
}

function fillProjectStatusSelect(select, selected = "") {
  select.innerHTML = '<option value="">No status</option>';
  for (const status of sortedByName(state.projectStatuses)) {
    const option = document.createElement("option");
    option.value = status.id;
    option.textContent = status.name;
    select.append(option);
  }
  select.value = selected || "";
}

function fillVenueSelect(select, selected = "") {
  select.innerHTML = '<option value="">No venue</option>';
  for (const venue of sortedByName(state.venues)) {
    const option = document.createElement("option");
    option.value = venue.id;
    option.textContent = venue.name;
    select.append(option);
  }
  select.value = selected || "";
}

function projectStatusName(project) {
  if (project.project_status_id) return state.projectStatuses.find((status) => status.id === project.project_status_id)?.name || "";
  return project.status || "";
}

function projectStatusNameForId(id) {
  return state.projectStatuses.find((status) => status.id === id)?.name || "";
}

function projectStatusIdForName(name) {
  return state.projectStatuses.find((status) => status.name === name)?.id || "";
}

function projectStatusTone(statusName) {
  const normalized = String(statusName || "").trim().toLowerCase();
  if (normalized === "not started") return { color: "#d85b49", tint: "rgba(216, 91, 73, 0.14)" };
  if (normalized === "in progress") return { color: "#d6a21e", tint: "rgba(214, 162, 30, 0.18)" };
  if (normalized === "completed") return { color: "#2f855a", tint: "rgba(47, 133, 90, 0.16)" };
  return { color: "#111827", tint: "rgba(17, 24, 39, 0.1)" };
}

function applyProjectStatusTone(element, statusName) {
  if (!element) return;
  const tone = projectStatusTone(statusName);
  element.style.setProperty("--project-status-color", tone.color);
  element.style.setProperty("--project-status-tint", tone.tint);
}

function applyProjectCardStatusTone(card) {
  const statusSelect = card.querySelector("[name='projectStatusId']");
  const statusName = projectStatusNameForId(statusSelect?.value || "") || "Other";
  applyProjectStatusTone(card, statusName);
  if (statusSelect) applyProjectStatusTone(statusSelect, statusName);
}

function relationshipNameForId(id) {
  return state.relationshipTypes.find((relationship) => relationship.id === id)?.name || "";
}

function relationshipTone(relationshipName) {
  const normalized = String(relationshipName || "").trim().toLowerCase();
  if (normalized === "bad") return { color: "#d85b49", tint: "rgba(216, 91, 73, 0.13)" };
  if (normalized === "ok") return { color: "#d6a21e", tint: "rgba(214, 162, 30, 0.16)" };
  if (normalized === "strong") return { color: "#2f855a", tint: "rgba(47, 133, 90, 0.14)" };
  return { color: "#111827", tint: "rgba(17, 24, 39, 0.1)" };
}

function applyPersonRelationshipTone(card, relationshipName) {
  if (!card) return;
  const tone = relationshipTone(relationshipName);
  card.style.setProperty("--person-relationship-color", tone.color);
  card.style.setProperty("--person-relationship-tint", tone.tint);
}

function applyPersonCardRelationshipTone(card) {
  const select = card.querySelector("[name='relationshipTypeId']");
  applyPersonRelationshipTone(card, relationshipNameForId(select?.value || ""));
}

function peopleSortHeader(key, label) {
  const active = state.peopleSort.key === key;
  const direction = active ? state.peopleSort.direction : "asc";
  const marker = active ? (direction === "asc" ? "↑" : "↓") : "";
  const ariaSort = active ? (direction === "asc" ? "ascending" : "descending") : "none";
  return `<button class="people-sort-button${active ? " active" : ""}" type="button" data-people-sort="${key}" aria-sort="${ariaSort}">${label}<span>${marker}</span></button>`;
}

function personSortValue(person, key) {
  if (key === "lastName") return person.last_name || "";
  if (key === "relationship") return relationshipNameForId(person.relationship_type_id);
  if (key === "skills") {
    return person.skill_ids
      .map((id) => state.skills.find((skill) => skill.id === id)?.name || "")
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b))
      .join(", ");
  }
  if (key === "projects") {
    return state.projectAssignments
      .filter((assignment) => assignment.person_id === person.id)
      .map((assignment) => state.projects.find((project) => project.id === assignment.project_id)?.name || "")
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b))
      .join(", ");
  }
  return person.first_name || "";
}

function sortedPeople(people, allowedKeys = ["firstName", "lastName", "relationship", "skills", "projects"]) {
  const key = allowedKeys.includes(state.peopleSort.key) ? state.peopleSort.key : "firstName";
  const direction = state.peopleSort.direction === "desc" ? -1 : 1;
  return people.slice().sort((a, b) => {
    const primary = personSortValue(a, key).localeCompare(personSortValue(b, key), undefined, { sensitivity: "base", numeric: true });
    if (primary) return primary * direction;
    const first = personSortValue(a, "firstName").localeCompare(personSortValue(b, "firstName"), undefined, { sensitivity: "base", numeric: true });
    if (first) return first;
    return personSortValue(a, "lastName").localeCompare(personSortValue(b, "lastName"), undefined, { sensitivity: "base", numeric: true });
  });
}

function setPeopleSort(key) {
  state.peopleSort = {
    key,
    direction: state.peopleSort.key === key && state.peopleSort.direction === "asc" ? "desc" : "asc"
  };
  localStorage.setItem("people-sort", JSON.stringify(state.peopleSort));
}

function sortByLabel(a, b) {
  return String(a || "").localeCompare(String(b || ""), undefined, { sensitivity: "base", numeric: true });
}

function sortedByName(items) {
  return items.slice().sort((a, b) => sortByLabel(a.name, b.name));
}

function sortedByTitle(items) {
  return items.slice().sort((a, b) => sortByLabel(a.title, b.title));
}

function sortedPeopleByName(people) {
  return people.slice().sort((a, b) => sortByLabel(personFullName(a), personFullName(b)));
}

function sortedProjects(projects) {
  const undatedValue = "9999-12-31";
  return projects.slice().sort((a, b) => {
    if (state.projectSort === "startDate") {
      const dateCompare = (a.start_date || undatedValue).localeCompare(b.start_date || undatedValue);
      if (dateCompare) return dateCompare;
    }
    return a.name.localeCompare(b.name, undefined, { sensitivity: "base", numeric: true });
  });
}

function projectTypeName(project) {
  return state.projectTypes.find((type) => type.id === project.project_type_id)?.name || "";
}

function venueName(project) {
  return state.venues.find((venue) => venue.id === project.venue_id)?.name || "";
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
    for (const area of sortedByName(state.areas)) {
      const option = document.createElement("option");
      option.value = area.id;
      option.textContent = area.name;
      select.append(option);
    }
  }
  els.area.value = state.areas.some((area) => area.id === selectedArea) ? selectedArea : state.areas[0]?.id || "";
  detail.area.value = state.areas.some((area) => area.id === selectedDetailArea) ? selectedDetailArea : state.areas[0]?.id || "";

  els.areaList.innerHTML = "";
  for (const area of sortedByName(state.areas)) {
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

function renderTaskFilterBar() {
  if (!els.taskFilterBar) return;
  const show = state.view === "tasks";
  els.taskFilterBar.classList.toggle("hidden", !show);
  if (!show) return;
  els.taskFilterBar.querySelectorAll("[data-task-filter]").forEach((button) => {
    button.classList.toggle("active", button.dataset.taskFilter === state.taskFilter);
  });
}

function setTaskFilter(filter) {
  const next = ["today", "upcoming", "backlog", "done"].includes(filter) ? filter : "today";
  state.taskFilter = next;
  state.view = "tasks";
  localStorage.setItem("task-filter", next);
}

function renderParentControls() {
  fillParentSelect(document.querySelector("#parent-id"), "", "");
  fillGoalSelect(els.goal, "");
  fillProjectSelect(els.project, "");
  if (state.selectedId) {
    const task = state.tasks.find((item) => item.id === state.selectedId);
    fillParentSelect(detail.parent, task?.parent_id || "", state.selectedId);
    fillGoalSelect(detail.goal, task?.goal_id || "");
    fillProjectSelect(detail.project, task?.project_id || "");
    fillDependencySelect(detail.dependencies, task?.dependency_ids || [], state.selectedId);
  }
}

function renderTasks() {
  if (state.view === "focus-task") {
    renderFocusedTaskView();
    return;
  }
  if (state.view === "focus-project") {
    renderFocusedProjectView();
    return;
  }
  if (state.view === "focus-goal") {
    renderFocusedGoalView();
    return;
  }
  if (state.view === "focus-person") {
    renderFocusedPersonView();
    return;
  }
  if (state.view === "tasks") {
    renderTaskListView();
    return;
  }
  if (state.view === "home") {
    renderHomeView();
    return;
  }
  if (state.view === "goals") {
    renderGoalsView();
    return;
  }
  if (state.view === "goal-assignments") {
    renderGoalAssignmentsView();
    return;
  }
  if (state.view === "people-projects") {
    renderPeopleProjectsView();
    return;
  }
  if (state.view === "people") {
    renderPeopleView();
    return;
  }
  if (state.view === "people-filter") {
    renderPeopleFilterView();
    return;
  }
  if (state.view === "projects") {
    renderProjectsView();
    return;
  }
  if (state.view === "project-filter") {
    renderProjectFilterView();
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
  if (state.view === "project-types") {
    renderNamedSettingsView("project-types");
    return;
  }
  if (state.view === "project-statuses") {
    renderNamedSettingsView("project-statuses");
    return;
  }
  if (state.view === "roles") {
    renderNamedSettingsView("roles");
    return;
  }
  if (state.view === "venues") {
    renderNamedSettingsView("venues");
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

  renderTaskListView();
}

function renderTaskListView() {
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
        <button class="ghost-button task-focus-button" type="button">Open</button>
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
  const related = new Set(state.tasks.filter((task) => taskHasGoal(task, goalId)).map((task) => task.id));
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

function focusObject(type, id, returnView = state.view) {
  const view = `focus-${type}`;
  state.focusedId = id;
  state.focusedReturnView = returnView && !returnView.startsWith("focus-") ? returnView : "home";
  state.view = view;
  if (type === "task") state.selectedId = id;
  render();
}

function leaveFocusView() {
  const returnView = state.focusedReturnView || "home";
  state.focusedId = "";
  state.view = returnView;
  render();
}

function renderFocusedEmpty(label) {
  els.taskList.innerHTML = `
    <section class="focus-editor">
      <button class="ghost-button focus-back-button" type="button">Back</button>
      <div class="empty-state">${label} could not be found.</div>
    </section>
  `;
}

function renderFocusedTaskView() {
  const task = state.tasks.find((item) => item.id === state.focusedId || item.id === state.selectedId);
  if (!task) {
    renderFocusedEmpty("Task");
    return;
  }
  state.selectedId = task.id;
  els.taskList.innerHTML = `
    <form class="focus-editor task-focus-editor" data-task-focus-id="${task.id}">
      <div class="focus-editor-head">
        <button class="ghost-button focus-back-button" type="button">Back</button>
        <span>Task</span>
      </div>
      <label class="field-label">Title
        <input name="title" type="text" required>
      </label>
      <label class="field-label">Notes
        <textarea name="notes" rows="5"></textarea>
      </label>
      <div class="focus-two-col">
        <label class="field-label">Parent task
          <select name="parentId"></select>
        </label>
        <label class="field-label">Life goal
          <select name="goalId"></select>
        </label>
        <label class="field-label">Project
          <select name="projectId"></select>
        </label>
        <label class="field-label">Area
          <select name="area"></select>
        </label>
        <label class="field-label">Priority
          <select name="priority">
            <option>High</option>
            <option>Medium</option>
            <option>Low</option>
          </select>
        </label>
        <label class="field-label">Due
          <input name="dueDate" type="date">
        </label>
        <label class="field-label">Energy
          <select name="energy">
            <option>Low</option>
            <option>Medium</option>
            <option>High</option>
          </select>
        </label>
        <label class="field-label">Tags
          <input name="tags" type="text" placeholder="comma separated tags">
        </label>
      </div>
      <label class="field-label">Depends on
        <select name="dependencies" multiple size="5"></select>
      </label>
      <div class="detail-actions">
        <button class="ghost-button focus-subtask-button" type="button">Add subtask</button>
        <button class="complete-action-button focus-toggle-task-button ${task.status === "done" ? "reopen" : ""}" type="button">
          <span aria-hidden="true">${task.status === "done" ? "↺" : "✓"}</span>
          ${task.status === "done" ? "Reopen task" : "Mark done"}
        </button>
        <button class="danger-button focus-delete-task-button" type="button">Delete</button>
      </div>
    </form>
  `;
  const form = els.taskList.querySelector("[data-task-focus-id]");
  form.querySelector("[name='title']").value = task.title;
  form.querySelector("[name='notes']").value = task.notes;
  fillParentSelect(form.querySelector("[name='parentId']"), task.parent_id || "", task.id);
  fillGoalSelect(form.querySelector("[name='goalId']"), task.goal_id || "");
  fillProjectSelect(form.querySelector("[name='projectId']"), task.project_id || "");
  fillAreaSelect(form.querySelector("[name='area']"), task.area_id || areaIdForName(task.area));
  form.querySelector("[name='priority']").value = task.priority;
  form.querySelector("[name='dueDate']").value = task.due_date || "";
  form.querySelector("[name='energy']").value = task.energy;
  form.querySelector("[name='tags']").value = task.tags.join(", ");
  fillDependencySelect(form.querySelector("[name='dependencies']"), task.dependency_ids, task.id);
}

function renderFocusedGoalView() {
  const goal = state.goals.find((item) => item.id === state.focusedId);
  if (!goal) {
    renderFocusedEmpty("Life goal");
    return;
  }
  const index = state.goals.findIndex((item) => item.id === goal.id);
  els.taskList.innerHTML = `
    <section class="focus-editor">
      <div class="focus-editor-head">
        <button class="ghost-button focus-back-button" type="button">Back</button>
        <span>Life Goal</span>
      </div>
      <article class="planning-card goal-card focused-goal-card" data-goal-id="${goal.id}">
        <input class="goal-title-input" name="name" type="text" required aria-label="Life goal name">
        <input class="goal-description-input" name="description" type="text" aria-label="Life goal description">
        <div class="goal-task-outline"></div>
        <div class="detail-actions">
          <button class="danger-button delete-goal-button" type="button">Delete</button>
        </div>
      </article>
    </section>
  `;
  const card = els.taskList.querySelector("[data-goal-id]");
  card.style.setProperty("--goal-color", goalAccent(index));
  card.querySelector("[name='name']").value = goal.name;
  card.querySelector("[name='description']").value = goal.description;
  const outline = card.querySelector(".goal-task-outline");
  outline.append(makeGoalTaskOutline(goal.id, "active"));
  outline.append(makeGoalTaskOutline(goal.id, "done"));
}

function renderFocusedPersonView() {
  const person = state.people.find((item) => item.id === state.focusedId);
  if (!person) {
    renderFocusedEmpty("Person");
    return;
  }
  els.taskList.innerHTML = `
    <section class="focus-editor">
      <div class="focus-editor-head">
        <button class="ghost-button focus-back-button" type="button">Back</button>
        <span>Person</span>
      </div>
      <article class="person-card focused-person-card" data-person-id="${person.id}">
        <label class="field-label">First name
          <input name="firstName" type="text" required aria-label="First name">
        </label>
        <label class="field-label">Last name
          <input name="lastName" type="text" aria-label="Last name">
        </label>
        <label class="field-label">Relationship
          <select name="relationshipTypeId" aria-label="Relationship"></select>
        </label>
        <div class="field-label">Skills
          <div class="skill-picker" role="group" aria-label="Skills"></div>
        </div>
        <div class="person-focus-projects">
          <strong>Projects</strong>
          <div class="person-projects"></div>
        </div>
        <button class="danger-button delete-person-button" type="button">Delete</button>
      </article>
    </section>
  `;
  const card = els.taskList.querySelector("[data-person-id]");
  card.querySelector("[name='firstName']").value = person.first_name;
  card.querySelector("[name='lastName']").value = person.last_name;
  fillRelationshipSelect(card.querySelector("[name='relationshipTypeId']"), person.relationship_type_id);
  fillSkillPicker(card.querySelector(".skill-picker"), person.skill_ids);
  card.querySelector(".person-projects").append(...personProjectPills(person));
  applyPersonRelationshipTone(card, relationshipNameForId(person.relationship_type_id));
}

function renderFocusedProjectView() {
  const project = state.projects.find((item) => item.id === state.focusedId);
  if (!project) {
    renderFocusedEmpty("Project");
    return;
  }
  els.taskList.innerHTML = `
    <section class="focus-editor">
      <div class="focus-editor-head">
        <button class="ghost-button focus-back-button" type="button">Back</button>
        <span>Project</span>
      </div>
      <article class="planning-card project-card focused-project-card" data-project-id="${project.id}">
        <div class="project-identity">
          <input name="name" type="text" required aria-label="Project name">
          <div class="project-task-count"></div>
        </div>
        <select name="projectTypeId" aria-label="Project type"></select>
        <select name="projectStatusId" aria-label="Project status"></select>
        <select name="venueId" aria-label="Project venue"></select>
        <input class="project-description-input" name="description" type="text" aria-label="Project description">
        <div class="project-date-pair">
          <label>
            Start
            <input name="startDate" type="date" aria-label="Project start date">
          </label>
          <label>
            End
            <input name="endDate" type="date" aria-label="Project end date">
          </label>
        </div>
        <div class="project-people">
          <div class="project-people-head">
            <strong>People</strong>
            <div class="project-person-add">
              <select name="projectPersonId" aria-label="Add project person"></select>
              <button class="ghost-button add-project-person-button" type="button">Add</button>
            </div>
          </div>
          <div class="project-person-list"></div>
        </div>
        <button class="danger-button delete-project-button" type="button">Delete</button>
      </article>
    </section>
  `;
  const card = els.taskList.querySelector("[data-project-id]");
  applyProjectStatusTone(card, projectStatusName(project));
  card.querySelector("[name='name']").value = project.name;
  fillProjectTypeSelect(card.querySelector("[name='projectTypeId']"), project.project_type_id);
  fillProjectStatusSelect(card.querySelector("[name='projectStatusId']"), project.project_status_id);
  fillVenueSelect(card.querySelector("[name='venueId']"), project.venue_id);
  applyProjectCardStatusTone(card);
  card.querySelector("[name='description']").value = project.description;
  card.querySelector("[name='startDate']").value = project.start_date || "";
  card.querySelector("[name='endDate']").value = project.end_date || "";
  normalizeDateRangeInputs(card);
  const count = state.tasks.filter((task) => task.project_id === project.id).length;
  card.querySelector(".project-task-count").textContent = `${count} task${count === 1 ? "" : "s"}`;
  fillProjectPersonSelect(card.querySelector("[name='projectPersonId']"), project.id);
  renderProjectPersonList(card, project.id);
}

function renderHomeView() {
  const openTasks = state.tasks.filter((task) => task.status !== "done");
  const doneTasks = state.tasks.filter((task) => task.status === "done");
  const todayTasks = state.tasks.filter((task) => taskBucket(task) === "today");
  const upcomingTasks = state.tasks.filter((task) => taskBucket(task) === "upcoming");
  const activeProjects = state.projects.filter((project) => projectStatusName(project) !== "Completed" && projectStatusName(project) !== "Deprioritized");
  const assignedPeople = new Set(state.projectAssignments.map((assignment) => assignment.person_id));
  const linkedTopTasks = state.tasks.filter((task) => !task.parent_id && task.goal_ids.length);
  const datedProjects = state.projects.filter((project) => projectTimelineStart(project));
  const upcomingFocus = openTasks
    .filter((task) => task.due_date)
    .sort((a, b) => a.due_date.localeCompare(b.due_date) || a.sort_order - b.sort_order)
    .slice(0, 5);
  const areaStats = state.areas
    .map((area) => ({
      area,
      count: openTasks.filter((task) => task.area_id === area.id || task.area === area.name).length
    }))
    .filter((item) => item.count)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  els.taskList.innerHTML = `
    <section class="home-view">
      <div class="home-overview">
        <button class="home-stat-card primary" data-home-view="today" type="button">
          <span>Today</span>
          <strong>${todayTasks.length}</strong>
          <small>${openTasks.length} open tasks</small>
        </button>
        <button class="home-stat-card" data-home-view="goals" type="button">
          <span>Life Goals</span>
          <strong>${state.goals.length}</strong>
          <small>${linkedTopTasks.length} linked top-level tasks</small>
        </button>
        <button class="home-stat-card" data-home-view="projects" type="button">
          <span>Projects</span>
          <strong>${state.projects.length}</strong>
          <small>${activeProjects.length} active or uncategorized</small>
        </button>
        <button class="home-stat-card" data-home-view="people" type="button">
          <span>People</span>
          <strong>${state.people.length}</strong>
          <small>${assignedPeople.size} assigned to projects</small>
        </button>
      </div>

      <div class="home-layout">
        <section class="home-panel home-focus-panel">
          <div class="home-panel-head">
            <div>
              <span class="home-kicker">Focus</span>
              <h3>Next dated tasks</h3>
            </div>
            <button class="ghost-button home-link" data-home-view="upcoming" type="button">Upcoming</button>
          </div>
          <div class="home-focus-list"></div>
        </section>

        <section class="home-panel">
          <div class="home-panel-head">
            <div>
              <span class="home-kicker">Structure</span>
              <h3>Planning map</h3>
            </div>
          </div>
          <div class="home-map-grid">
            <button class="home-map-item" data-home-view="goal-assignments" type="button">
              <strong>${state.goalLinks.length}</strong>
              <span>goal-task links</span>
            </button>
            <button class="home-map-item" data-home-view="graph" type="button">
              <strong>${state.tasks.filter((task) => task.parent_id || task.dependency_ids.length).length}</strong>
              <span>task relationships</span>
            </button>
            <button class="home-map-item" data-home-view="timeline" type="button">
              <strong>${datedProjects.length + state.tasks.filter((task) => task.due_date).length}</strong>
              <span>dated items</span>
            </button>
            <button class="home-map-item" data-home-view="ideas" type="button">
              <strong>${state.ideas.length}</strong>
              <span>ideas waiting</span>
            </button>
          </div>
        </section>

        <section class="home-panel">
          <div class="home-panel-head">
            <div>
              <span class="home-kicker">Areas</span>
              <h3>Open task mix</h3>
            </div>
            <button class="ghost-button home-link" data-home-view="areas" type="button">Areas</button>
          </div>
          <div class="home-area-list"></div>
        </section>

        <section class="home-panel">
          <div class="home-panel-head">
            <div>
              <span class="home-kicker">Progress</span>
              <h3>Task flow</h3>
            </div>
            <button class="ghost-button home-link" data-home-view="done" type="button">Done</button>
          </div>
          <div class="home-flow">
            <div><strong>${todayTasks.length}</strong><span>today</span></div>
            <div><strong>${upcomingTasks.length}</strong><span>upcoming</span></div>
            <div><strong>${openTasks.filter((task) => taskBucket(task) === "backlog").length}</strong><span>backlog</span></div>
            <div><strong>${doneTasks.length}</strong><span>done</span></div>
          </div>
        </section>
      </div>
    </section>
  `;

  const focusList = els.taskList.querySelector(".home-focus-list");
  if (upcomingFocus.length) {
    for (const task of upcomingFocus) {
      const button = document.createElement("button");
      button.className = "home-focus-item";
      button.type = "button";
      button.dataset.homeTaskId = task.id;
      button.style.borderLeftColor = areaColorFor(task);
      button.innerHTML = `
        <span></span>
        <small></small>
      `;
      button.querySelector("span").textContent = task.title;
      button.querySelector("small").textContent = `${formatDate(task.due_date)} · ${areaNameFor(task)} · ${task.priority}`;
      focusList.append(button);
    }
  } else {
    const empty = document.createElement("div");
    empty.className = "home-empty";
    empty.textContent = "No dated open tasks yet.";
    focusList.append(empty);
  }

  const areaList = els.taskList.querySelector(".home-area-list");
  if (areaStats.length) {
    const max = Math.max(...areaStats.map((item) => item.count));
    for (const item of areaStats) {
      const row = document.createElement("div");
      row.className = "home-area-row";
      row.innerHTML = `
        <span class="home-area-name"></span>
        <span class="home-area-bar"><span></span></span>
        <strong></strong>
      `;
      row.querySelector(".home-area-name").textContent = item.area.name;
      row.querySelector(".home-area-bar span").style.width = `${Math.max(10, (item.count / max) * 100)}%`;
      row.querySelector(".home-area-bar span").style.background = item.area.color;
      row.querySelector("strong").textContent = item.count;
      areaList.append(row);
    }
  } else {
    const empty = document.createElement("div");
    empty.className = "home-empty";
    empty.textContent = "No open tasks by area.";
    areaList.append(empty);
  }
}

function renderGoalsView() {
  els.taskList.innerHTML = `
    <section class="creation-panel">
      <div class="planning-section-head">
        <h4>Add new Life Goal</h4>
      </div>
      <form id="goal-form" class="planning-form">
        <label class="field-label">Name
          <input name="name" type="text" placeholder="Life goal" required>
        </label>
        <label class="field-label">Description
          <input name="description" type="text" placeholder="Description">
        </label>
        <button class="primary-button form-submit" type="submit">Add goal</button>
      </form>
    </section>
    <section class="directory-panel">
      <div class="planning-section-head">
        <h4>Life Goals</h4>
        <span>${state.goals.length} ${state.goals.length === 1 ? "goal" : "goals"}</span>
      </div>
      <div class="planning-list goal-grid"></div>
    </section>
  `;
  restoreCreationDraft(els.taskList.querySelector("#goal-form"));
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
      <input class="goal-description-input" name="description" type="text" aria-label="Life goal description">
      <div class="goal-task-outline"></div>
      <div class="detail-actions">
        <button class="ghost-button goal-focus-button" type="button">Open</button>
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
    <section class="creation-panel">
      <div class="planning-section-head">
        <h4>Add new Idea</h4>
      </div>
      <form id="idea-form" class="planning-form idea-form">
        <label class="field-label">Idea
          <input name="text" type="text" placeholder="Capture an idea" required>
        </label>
        <label class="field-label">Area
          <select name="area" aria-label="Idea area"></select>
        </label>
        <button class="primary-button form-submit" type="submit">Add idea</button>
      </form>
    </section>
    <section class="directory-panel">
      <div class="planning-section-head">
        <h4>Ideas Inbox</h4>
        <span>${state.ideas.length} ${state.ideas.length === 1 ? "idea" : "ideas"}</span>
      </div>
      <div class="planning-list"></div>
    </section>
  `;
  const areaSelect = els.taskList.querySelector("select[name='area']");
  for (const area of sortedByName(state.areas)) {
    const option = document.createElement("option");
    option.value = area.id;
    option.textContent = area.name;
    areaSelect.append(option);
  }
  restoreCreationDraft(els.taskList.querySelector("#idea-form"));
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
    for (const area of sortedByName(state.areas)) {
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
      <label class="field-label">Area
        <input name="name" type="text" placeholder="New area" required>
      </label>
      <label class="field-label">Color
        <input name="color" type="color" value="#39ff14" aria-label="Area color">
      </label>
      <button class="primary-button form-submit" type="submit">Add area</button>
    </form>
    <div class="planning-list area-settings-list"></div>
  `;
  restoreCreationDraft(els.taskList.querySelector("#areas-settings-form"));
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
      <button class="danger-button delete-area-button" type="button">Delete</button>
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
  const titles = { skills: "Skills", relationships: "Relationships", "project-types": "Project Types", "project-statuses": "Project Statuses", roles: "Roles", venues: "Venues" };
  const title = titles[type] || "Settings";
  const items = state[config.stateKey];
  const fieldLabel = config.label.charAt(0).toUpperCase() + config.label.slice(1);
  els.taskList.innerHTML = `
    <form id="named-settings-form" class="planning-form named-settings-form" data-option-type="${type}">
      <label class="field-label">${fieldLabel}
        <input name="name" type="text" placeholder="New ${config.label}" required>
      </label>
      <button class="primary-button form-submit" type="submit">Add ${config.label}</button>
    </form>
    <div class="planning-list area-settings-list"></div>
  `;
  restoreCreationDraft(els.taskList.querySelector("#named-settings-form"));
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
      <input class="named-option-input" type="text" aria-label="${fieldLabel} name">
      <span class="area-usage"></span>
      <button class="danger-button delete-option-button" type="button">Delete</button>
    `;
    row.querySelector(".named-option-input").value = item.name;
    const usage = namedOptionUsage(type, item.id);
    row.querySelector(".area-usage").textContent = `${usage} ${["project-types", "project-statuses", "venues"].includes(type) ? "project" : type === "roles" ? "assignment" : "person"}${usage === 1 ? "" : "s"}`;
    list.append(row);
  }
}

function personFullName(person) {
  return `${person.first_name}${person.last_name ? ` ${person.last_name}` : ""}`;
}

function renderPeopleView() {
  els.taskList.innerHTML = `
    <section class="creation-panel">
      <div class="planning-section-head">
        <h4>Add new People</h4>
      </div>
      <form id="person-form" class="planning-form people-form">
        <label class="field-label">First name
          <input name="firstName" type="text" placeholder="First name" required>
        </label>
        <label class="field-label">Last name
          <input name="lastName" type="text" placeholder="Last name">
        </label>
        <label class="field-label">Relationship
          <select name="relationshipTypeId" aria-label="Relationship"></select>
        </label>
        <div class="field-label">Skills
          <div class="skill-picker" role="group" aria-label="Skills"></div>
        </div>
        <button class="primary-button form-submit" type="submit">Add person</button>
      </form>
    </section>
    <section class="directory-panel">
      <div class="planning-section-head">
        <h4>People Directory</h4>
        <span>${state.people.length} ${state.people.length === 1 ? "person" : "people"}</span>
      </div>
      <div class="people-table">
        <div class="people-table-head">
          <span>#</span>
          ${peopleSortHeader("firstName", "First Name")}
          ${peopleSortHeader("lastName", "Last Name")}
          ${peopleSortHeader("relationship", "Relationship")}
          ${peopleSortHeader("skills", "Skills")}
          <span></span>
        </div>
        <div class="planning-list people-list"></div>
      </div>
    </section>
  `;
  fillRelationshipSelect(els.taskList.querySelector("select[name='relationshipTypeId']"), "");
  const personDraft = restoreCreationDraft(els.taskList.querySelector("#person-form"));
  fillSkillPicker(els.taskList.querySelector("#person-form .skill-picker"), personDraft?.skillIds || []);
  const list = els.taskList.querySelector(".people-list");
  if (!state.people.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state people-empty";
    empty.textContent = "No people yet.";
    list.append(empty);
    return;
  }
  for (const [index, person] of sortedPeople(state.people, ["firstName", "lastName", "relationship", "skills"]).entries()) {
    const card = document.createElement("div");
    card.className = "person-card";
    card.dataset.personId = person.id;
    card.innerHTML = `
      <div class="person-sequence" aria-label="Person sequence">${index + 1}</div>
      <input name="firstName" type="text" required aria-label="First name">
      <input name="lastName" type="text" aria-label="Last name">
      <select name="relationshipTypeId" aria-label="Relationship"></select>
      <div class="skill-picker" role="group" aria-label="Skills"></div>
      <div class="row-actions">
        <button class="ghost-button person-focus-button" type="button">Open</button>
        <button class="danger-button delete-person-button" type="button">Delete</button>
      </div>
    `;
    card.querySelector("[name='firstName']").value = person.first_name;
    card.querySelector("[name='lastName']").value = person.last_name;
    fillRelationshipSelect(card.querySelector("[name='relationshipTypeId']"), person.relationship_type_id);
    fillSkillPicker(card.querySelector(".skill-picker"), person.skill_ids);
    applyPersonRelationshipTone(card, relationshipNameForId(person.relationship_type_id));
    list.append(card);
  }
}

function renderPeopleFilterView() {
  els.taskList.innerHTML = `
    <div class="people-filter-bar">
      <select name="skillFilter" aria-label="Filter by skill"></select>
      <select name="relationshipFilter" aria-label="Filter by relationship"></select>
      <select name="projectFilter" aria-label="Filter by project"></select>
      <select name="roleFilter" aria-label="Filter by role"></select>
      <button class="ghost-button clear-people-filters" type="button">Clear filters</button>
    </div>
    <div class="people-table people-filter-table">
      <div class="people-table-head">
        <span>#</span>
        ${peopleSortHeader("firstName", "First Name")}
        ${peopleSortHeader("lastName", "Last Name")}
        ${peopleSortHeader("relationship", "Relationship")}
        ${peopleSortHeader("skills", "Skills")}
        ${peopleSortHeader("projects", "Projects")}
        <span></span>
      </div>
      <div class="planning-list people-list"></div>
    </div>
  `;
  const skillSelect = els.taskList.querySelector("[name='skillFilter']");
  const relationshipSelect = els.taskList.querySelector("[name='relationshipFilter']");
  const projectSelect = els.taskList.querySelector("[name='projectFilter']");
  const roleSelect = els.taskList.querySelector("[name='roleFilter']");
  skillSelect.innerHTML = '<option value="">All skills</option>';
  for (const skill of sortedByName(state.skills)) {
    const option = document.createElement("option");
    option.value = skill.id;
    option.textContent = skill.name;
    skillSelect.append(option);
  }
  relationshipSelect.innerHTML = '<option value="">All relationships</option>';
  for (const relationship of sortedByName(state.relationshipTypes)) {
    const option = document.createElement("option");
    option.value = relationship.id;
    option.textContent = relationship.name;
    relationshipSelect.append(option);
  }
  projectSelect.innerHTML = '<option value="">All projects</option>';
  for (const project of sortedByName(state.projects)) {
    const option = document.createElement("option");
    option.value = project.id;
    option.textContent = project.name || "Untitled project";
    projectSelect.append(option);
  }
  roleSelect.innerHTML = '<option value="">All roles</option>';
  for (const role of sortedByName(state.roles)) {
    const option = document.createElement("option");
    option.value = role.id;
    option.textContent = role.name;
    roleSelect.append(option);
  }
  const skillFilter = sessionStorage.getItem("people-skill-filter") || "";
  const relationshipFilter = sessionStorage.getItem("people-relationship-filter") || "";
  const projectFilter = sessionStorage.getItem("people-project-filter") || "";
  const roleFilter = sessionStorage.getItem("people-role-filter") || "";
  skillSelect.value = skillFilter;
  relationshipSelect.value = relationshipFilter;
  projectSelect.value = projectFilter;
  roleSelect.value = roleFilter;
  const people = sortedPeople(filteredPeople(skillFilter, relationshipFilter, projectFilter, roleFilter));
  const list = els.taskList.querySelector(".people-list");
  if (!people.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state people-empty";
    empty.textContent = "No people match these filters.";
    list.append(empty);
    return;
  }
  for (const [index, person] of people.entries()) {
    list.append(makePeopleReadRow(person, index));
  }
}

function filteredPeople(skillId, relationshipId, projectId = "", roleId = "") {
  return state.people.filter((person) => {
    if (skillId && !person.skill_ids.includes(skillId)) return false;
    if (relationshipId && person.relationship_type_id !== relationshipId) return false;
    if (projectId && !state.projectAssignments.some((assignment) => assignment.person_id === person.id && assignment.project_id === projectId)) return false;
    if (roleId && !state.projectAssignments.some((assignment) => assignment.person_id === person.id && assignment.role_ids.includes(roleId))) return false;
    return true;
  });
}

function filteredProjects(projectTypeId = "", projectStatusId = "", personId = "") {
  return state.projects.filter((project) => {
    if (projectTypeId && project.project_type_id !== projectTypeId) return false;
    if (projectStatusId && project.project_status_id !== projectStatusId) return false;
    if (personId && !state.projectAssignments.some((assignment) => assignment.project_id === project.id && assignment.person_id === personId)) return false;
    return true;
  });
}

function projectPeopleNames(project) {
  return state.projectAssignments
    .filter((assignment) => assignment.project_id === project.id)
    .map((assignment) => state.people.find((person) => person.id === assignment.person_id))
    .filter(Boolean)
    .map(personFullName)
    .sort((a, b) => a.localeCompare(b));
}

function renderProjectFilterView() {
  els.taskList.innerHTML = `
    <div class="people-filter-bar project-filter-bar">
      <select name="projectTypeFilter" aria-label="Filter by project type"></select>
      <select name="projectStatusFilter" aria-label="Filter by project status"></select>
      <select name="projectPersonFilter" aria-label="Filter by project person"></select>
      <button class="ghost-button clear-project-filters" type="button">Clear filters</button>
    </div>
    <div class="project-filter-table">
      <div class="project-filter-head">
        <span>#</span>
        <span>Name</span>
        <span>Type</span>
        <span>Status</span>
        <span>Venue</span>
        <span>Dates</span>
        <span>People</span>
        <span></span>
      </div>
      <div class="planning-list project-filter-list"></div>
    </div>
  `;
  const typeSelect = els.taskList.querySelector("[name='projectTypeFilter']");
  const statusSelect = els.taskList.querySelector("[name='projectStatusFilter']");
  const personSelect = els.taskList.querySelector("[name='projectPersonFilter']");
  typeSelect.innerHTML = '<option value="">All types</option>';
  for (const type of sortedByName(state.projectTypes)) {
    const option = document.createElement("option");
    option.value = type.id;
    option.textContent = type.name;
    typeSelect.append(option);
  }
  statusSelect.innerHTML = '<option value="">All statuses</option>';
  for (const status of sortedByName(state.projectStatuses)) {
    const option = document.createElement("option");
    option.value = status.id;
    option.textContent = status.name;
    statusSelect.append(option);
  }
  personSelect.innerHTML = '<option value="">All people</option>';
  for (const person of sortedPeopleByName(state.people)) {
    const option = document.createElement("option");
    option.value = person.id;
    option.textContent = personFullName(person);
    personSelect.append(option);
  }
  const typeFilter = sessionStorage.getItem("project-type-filter") || "";
  const statusFilter = sessionStorage.getItem("project-status-filter") || "";
  const personFilter = sessionStorage.getItem("project-person-filter") || "";
  typeSelect.value = typeFilter;
  statusSelect.value = statusFilter;
  personSelect.value = personFilter;
  const projects = sortedProjects(filteredProjects(typeFilter, statusFilter, personFilter));
  const list = els.taskList.querySelector(".project-filter-list");
  if (!projects.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state people-empty";
    empty.textContent = "No projects match these filters.";
    list.append(empty);
    return;
  }
  for (const [index, project] of projects.entries()) {
    const row = document.createElement("div");
    row.className = "project-filter-row";
    row.dataset.projectId = project.id;
    applyProjectStatusTone(row, projectStatusName(project));
    row.innerHTML = `
      <div class="project-sequence" aria-label="Project sequence">${index + 1}</div>
      <strong></strong>
      <span></span>
      <span></span>
      <span></span>
      <span></span>
      <span></span>
      <button class="ghost-button project-focus-button" type="button">Open</button>
    `;
    row.querySelector("strong").textContent = project.name;
    row.querySelectorAll("span")[0].textContent = projectTypeName(project) || "No type";
    row.querySelectorAll("span")[1].textContent = projectStatusName(project) || "No status";
    row.querySelectorAll("span")[2].textContent = venueName(project) || "No venue";
    row.querySelectorAll("span")[3].textContent = [project.start_date || "No start", project.end_date || "No end"].join(" - ");
    row.querySelectorAll("span")[4].textContent = projectPeopleNames(project).join(", ") || "No people";
    list.append(row);
  }
}

function makePeopleReadRow(person, index = 0) {
  const row = document.createElement("div");
  row.className = "person-card person-read-row";
  row.innerHTML = `
    <div class="person-sequence" aria-label="Person sequence">${index + 1}</div>
    <span></span>
    <span></span>
    <span></span>
    <span></span>
    <span class="person-projects"></span>
    <button class="ghost-button person-edit-button" type="button">Edit</button>
  `;
  row.querySelectorAll("span")[0].textContent = person.first_name;
  row.querySelectorAll("span")[1].textContent = person.last_name || "";
  row.querySelectorAll("span")[2].textContent = state.relationshipTypes.find((item) => item.id === person.relationship_type_id)?.name || "";
  row.querySelectorAll("span")[3].textContent = person.skill_ids
    .map((id) => state.skills.find((skill) => skill.id === id)?.name)
    .filter(Boolean)
    .join(", ");
  row.querySelector(".person-projects").append(...personProjectPills(person));
  row.querySelector("button").dataset.personEditId = person.id;
  applyPersonRelationshipTone(row, relationshipNameForId(person.relationship_type_id));
  return row;
}

function personProjectPills(person) {
  const assignments = state.projectAssignments.filter((assignment) => assignment.person_id === person.id);
  if (!assignments.length) return [document.createTextNode("No projects")];
  return assignments.map((assignment) => {
    const project = state.projects.find((item) => item.id === assignment.project_id);
    const roles = assignment.role_ids
      .map((id) => state.roles.find((role) => role.id === id)?.name)
      .filter(Boolean);
    const pill = document.createElement("span");
    pill.className = "person-project-pill";
    pill.textContent = `${project?.name || "Unknown project"}${roles.length ? ` (${roles.join(", ")})` : ""}`;
    return pill;
  });
}

function renderProjectsView() {
  const isMinimal = state.projectViewMode === "minimal";
  els.taskList.innerHTML = `
    <section class="creation-panel">
      <div class="planning-section-head">
        <h4>Add new Project</h4>
      </div>
      <form id="project-form" class="planning-form project-form">
        <label class="field-label">Name
          <input name="name" type="text" placeholder="Project name" required>
        </label>
        <label class="field-label">Type
          <select name="projectTypeId" aria-label="Project type"></select>
        </label>
        <label class="field-label">Status
          <select name="projectStatusId" aria-label="Project status"></select>
        </label>
        <label class="field-label">Venue
          <select name="venueId" aria-label="Project venue"></select>
        </label>
        <label class="field-label">Description
          <input name="description" type="text" placeholder="Description">
        </label>
        <label class="field-label">Start
          <input name="startDate" type="date" aria-label="Project start date">
        </label>
        <label class="field-label">End
          <input name="endDate" type="date" aria-label="Project end date">
        </label>
        <button class="primary-button form-submit" type="submit">Add project</button>
      </form>
    </section>
    <section class="directory-panel">
      <div class="planning-section-head">
        <h4>Projects</h4>
        <div class="section-head-tools">
          <span>${state.projects.length} ${state.projects.length === 1 ? "project" : "projects"}</span>
          <label class="compact-select-label">Sort
            <select class="project-sort-select" name="projectSort" aria-label="Sort projects">
              <option value="name" ${state.projectSort === "name" ? "selected" : ""}>Name</option>
              <option value="startDate" ${state.projectSort === "startDate" ? "selected" : ""}>Start date</option>
            </select>
          </label>
          <div class="view-mode-toggle" aria-label="Project view mode">
            <button class="${isMinimal ? "" : "active"}" type="button" data-project-view-mode="full">Full</button>
            <button class="${isMinimal ? "active" : ""}" type="button" data-project-view-mode="minimal">Minimal</button>
          </div>
        </div>
      </div>
      <div class="planning-list project-list${isMinimal ? " minimal-project-list" : ""}"></div>
    </section>
  `;
  fillProjectTypeSelect(els.taskList.querySelector("select[name='projectTypeId']"), "");
  fillProjectStatusSelect(els.taskList.querySelector("select[name='projectStatusId']"), state.projectStatuses[0]?.id || "");
  fillVenueSelect(els.taskList.querySelector("select[name='venueId']"), "");
  applyProjectStatusTone(els.taskList.querySelector("select[name='projectStatusId']"), projectStatusNameForId(state.projectStatuses[0]?.id || ""));
  restoreCreationDraft(els.taskList.querySelector("#project-form"));
  applyProjectStatusTone(els.taskList.querySelector("select[name='projectStatusId']"), projectStatusNameForId(els.taskList.querySelector("select[name='projectStatusId']")?.value || ""));
  normalizeDateRangeInputs(els.taskList.querySelector("#project-form"));
  const list = els.taskList.querySelector(".project-list");
  if (!state.projects.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "No projects yet.";
    list.append(empty);
    return;
  }
  for (const [index, project] of sortedProjects(state.projects).entries()) {
    const card = document.createElement("article");
    card.className = `planning-card project-card${isMinimal ? " minimal-project-card" : ""}`;
    card.dataset.projectId = project.id;
    applyProjectStatusTone(card, projectStatusName(project));
    card.innerHTML = `
      <div class="project-sequence" aria-label="Project sequence">${index + 1}</div>
      <div class="project-identity">
        <input name="name" type="text" required aria-label="Project name">
        <div class="project-task-count"></div>
      </div>
      <select name="projectTypeId" aria-label="Project type"></select>
      <select name="projectStatusId" aria-label="Project status"></select>
      <select name="venueId" aria-label="Project venue"></select>
      <input class="project-description-input" name="description" type="text" aria-label="Project description">
      <div class="project-date-pair">
        <label>
          Start
          <input name="startDate" type="date" aria-label="Project start date">
        </label>
        <label>
          End
          <input name="endDate" type="date" aria-label="Project end date">
        </label>
      </div>
      <div class="project-people">
        <div class="project-people-head">
          <strong>People</strong>
          <div class="project-person-add">
            <select name="projectPersonId" aria-label="Add project person"></select>
            <button class="ghost-button add-project-person-button" type="button">Add</button>
          </div>
        </div>
        <div class="project-person-list"></div>
      </div>
      <div class="row-actions">
        <button class="ghost-button project-focus-button" type="button">Open</button>
        <button class="danger-button delete-project-button" type="button">Delete</button>
      </div>
    `;
    card.querySelector("[name='name']").value = project.name;
    fillProjectTypeSelect(card.querySelector("[name='projectTypeId']"), project.project_type_id);
    fillProjectStatusSelect(card.querySelector("[name='projectStatusId']"), project.project_status_id);
    fillVenueSelect(card.querySelector("[name='venueId']"), project.venue_id);
    applyProjectCardStatusTone(card);
    card.querySelector("[name='description']").value = project.description;
    card.querySelector("[name='startDate']").value = project.start_date || "";
    card.querySelector("[name='endDate']").value = project.end_date || "";
    normalizeDateRangeInputs(card);
    const count = state.tasks.filter((task) => task.project_id === project.id).length;
    card.querySelector(".project-task-count").textContent = `${count} task${count === 1 ? "" : "s"}`;
    if (!isMinimal) {
      fillProjectPersonSelect(card.querySelector("[name='projectPersonId']"), project.id);
      renderProjectPersonList(card, project.id);
    }
    list.append(card);
  }
}

function fillProjectPersonSelect(select, projectId) {
  const assigned = new Set(state.projectAssignments.filter((assignment) => assignment.project_id === projectId).map((assignment) => assignment.person_id));
  select.innerHTML = '<option value="">Add person...</option>';
  for (const person of sortedPeopleByName(state.people.filter((item) => !assigned.has(item.id)))) {
    const option = document.createElement("option");
    option.value = person.id;
    option.textContent = personFullName(person);
    select.append(option);
  }
}

function fillRolePicker(container, selected = []) {
  const values = new Set(parseIds(selected));
  container.innerHTML = "";
  const select = document.createElement("select");
  select.className = "role-add-select";
  select.name = "roleAdd";
  select.setAttribute("aria-label", "Add role");
  select.innerHTML = '<option value="">Add role...</option>';
  for (const role of sortedByName(state.roles.filter((item) => !values.has(item.id)))) {
    const option = document.createElement("option");
    option.value = role.id;
    option.textContent = role.name;
    select.append(option);
  }
  container.append(select);
  const pills = document.createElement("div");
  pills.className = "role-pills";
  container.append(pills);
  for (const role of sortedByName(state.roles)) {
    if (!values.has(role.id)) continue;
    const pill = document.createElement("span");
    pill.className = "role-pill";
    pill.innerHTML = `
      <input name="roleIds" type="hidden">
      <span></span>
      <button class="role-remove-button" type="button" aria-label="Remove role">x</button>
    `;
    pill.querySelector("input").value = role.id;
    pill.querySelector("span").textContent = role.name;
    pills.append(pill);
  }
}

function renderProjectPersonList(card, projectId) {
  const list = card.querySelector(".project-person-list");
  list.innerHTML = "";
  const assignments = state.projectAssignments.filter((assignment) => assignment.project_id === projectId);
  if (!assignments.length) {
    const empty = document.createElement("div");
    empty.className = "project-person-empty";
    empty.textContent = "No people assigned.";
    list.append(empty);
    return;
  }
  for (const assignment of assignments) {
    const person = state.people.find((item) => item.id === assignment.person_id);
    const row = document.createElement("div");
    row.className = "project-person-row";
    row.dataset.projectAssignmentId = assignment.id;
    row.innerHTML = `
      <span class="project-person-name"></span>
      <div class="role-picker" role="group" aria-label="Project roles"></div>
      <button class="ghost-button remove-project-person-button" type="button">Remove</button>
    `;
    row.querySelector(".project-person-name").textContent = person ? personFullName(person) : "Unknown person";
    fillRolePicker(row.querySelector(".role-picker"), assignment.role_ids);
    list.append(row);
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
  const selectedGoalIds = new Set(selectedTask ? goalIdsForTask(selectedTask) : []);
  els.taskList.innerHTML = `
    <div class="assignment-view assignment-map">
      <svg class="assignment-lines" aria-hidden="true"></svg>
      <section class="assignment-panel">
        <h4>Top-level tasks</h4>
        <div class="assignment-task-list"></div>
      </section>
      <section class="assignment-panel">
        <div class="assignment-panel-head">
          <h4>Life goals</h4>
          <div class="assignment-toolbar">
            <label class="toggle">
              <input class="assignment-selected-only" type="checkbox" ${state.assignmentSelectedOnly ? "checked" : ""}>
              <span>Selected only</span>
            </label>
          </div>
        </div>
        <div class="assignment-goal-list"></div>
      </section>
    </div>
  `;
  const taskList = els.taskList.querySelector(".assignment-task-list");
  const goalList = els.taskList.querySelector(".assignment-goal-list");
  const lines = els.taskList.querySelector(".assignment-lines");
  if (!topLevelTasks.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "No top-level tasks to assign.";
    taskList.append(empty);
  }
  for (const task of topLevelTasks) {
    const button = document.createElement("button");
    const goalCount = goalIdsForTask(task).length;
    button.className = `assignment-task ${task.id === state.selectedAssignmentTaskId ? "active" : ""} ${goalCount ? "linked" : ""}`;
    button.type = "button";
    button.dataset.assignmentTaskId = task.id;
    button.innerHTML = `<span class="assignment-title"></span><small></small><span class="connector-handle task-handle" title="Drag to a life goal" aria-hidden="true"></span>`;
    button.querySelector("span").textContent = task.title;
    button.querySelector("small").textContent = `${goalCount} linked goal${goalCount === 1 ? "" : "s"}`;
    taskList.append(button);
  }
  state.goals.forEach((goal, index) => {
    const button = document.createElement("button");
    button.className = `assignment-goal ${selectedGoalIds.has(goal.id) ? "active" : ""}`;
    button.type = "button";
    button.dataset.assignmentGoalId = goal.id;
    button.title = selectedGoalIds.has(goal.id) ? "Click to remove this link" : "Click to link selected task";
    button.style.setProperty("--goal-color", goalAccent(index));
    const count = state.tasks.filter((task) => !task.parent_id && taskHasGoal(task, goal.id)).length;
    button.innerHTML = `<span class="connector-handle goal-handle" aria-hidden="true"></span><strong></strong><span></span>`;
    button.querySelector("strong").textContent = goal.name;
    button.querySelector("strong + span").textContent = `${count} top-level task${count === 1 ? "" : "s"}`;
    goalList.append(button);
  });
  if (!state.goals.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "No life goals yet.";
    goalList.append(empty);
  }
  watchAssignmentLayout();
  if (topLevelTasks.length && state.goals.length) scheduleAssignmentLines();
  else lines.innerHTML = "";
}

function renderPeopleProjectsView() {
  if (!state.selectedAssignmentPersonId || !state.people.some((person) => person.id === state.selectedAssignmentPersonId)) {
    state.selectedAssignmentPersonId = state.people[0]?.id || "";
  }
  const selectedAssignments = state.projectAssignments.filter((assignment) => assignment.person_id === state.selectedAssignmentPersonId);
  const selectedProjectIds = new Set(selectedAssignments.map((assignment) => assignment.project_id));
  els.taskList.innerHTML = `
    <div class="assignment-view assignment-map people-project-map">
      <svg class="assignment-lines" aria-hidden="true"></svg>
      <section class="assignment-panel">
        <h4>People</h4>
        <div class="assignment-person-list"></div>
      </section>
      <section class="assignment-panel">
        <div class="assignment-panel-head">
          <h4>Projects</h4>
          <div class="assignment-toolbar">
            <label class="toggle">
              <input class="assignment-selected-only" type="checkbox" ${state.assignmentSelectedOnly ? "checked" : ""}>
              <span>Selected only</span>
            </label>
          </div>
        </div>
        <div class="assignment-project-list"></div>
      </section>
    </div>
  `;
  const personList = els.taskList.querySelector(".assignment-person-list");
  const projectList = els.taskList.querySelector(".assignment-project-list");
  const lines = els.taskList.querySelector(".assignment-lines");
  if (!state.people.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "No people yet.";
    personList.append(empty);
  }
  for (const person of sortedPeople(state.people, ["firstName", "lastName", "relationship", "skills"])) {
    const assignmentCount = state.projectAssignments.filter((assignment) => assignment.person_id === person.id).length;
    const button = document.createElement("button");
    button.className = `assignment-task assignment-person ${person.id === state.selectedAssignmentPersonId ? "active" : ""} ${assignmentCount ? "linked" : ""}`;
    button.type = "button";
    button.dataset.assignmentPersonId = person.id;
    button.innerHTML = `<span class="assignment-title"></span><small></small><span class="connector-handle person-handle" aria-hidden="true"></span>`;
    button.querySelector(".assignment-title").textContent = personFullName(person);
    button.querySelector("small").textContent = `${relationshipNameForId(person.relationship_type_id) || "No relationship"} · ${assignmentCount} project${assignmentCount === 1 ? "" : "s"}`;
    applyPersonRelationshipTone(button, relationshipNameForId(person.relationship_type_id));
    personList.append(button);
  }
  if (!state.projects.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "No projects yet.";
    projectList.append(empty);
  }
  for (const project of state.projects) {
    const assignment = selectedAssignments.find((item) => item.project_id === project.id);
    const active = selectedProjectIds.has(project.id);
    const button = document.createElement("div");
    button.className = `assignment-goal assignment-project ${active ? "active" : ""}`;
    button.tabIndex = 0;
    button.setAttribute("role", "button");
    button.dataset.assignmentProjectId = project.id;
    if (assignment) button.dataset.projectAssignmentId = assignment.id;
    button.title = active ? "Click to remove this assignment" : "Click to assign selected person";
    applyProjectStatusTone(button, projectStatusName(project));
    button.innerHTML = `
      <span class="connector-handle project-handle" aria-hidden="true"></span>
      <strong></strong>
      <span></span>
      <div class="role-picker assignment-role-picker" role="group" aria-label="Project roles"></div>
    `;
    button.querySelector("strong").textContent = project.name || "Untitled project";
    button.querySelector("strong + span").textContent = `${projectTypeName(project) || "No type"} · ${projectStatusName(project) || "No status"}`;
    if (assignment) fillRolePicker(button.querySelector(".role-picker"), assignment.role_ids);
    else button.querySelector(".role-picker").remove();
    projectList.append(button);
  }
  watchAssignmentLayout();
  if (state.people.length && state.projects.length) scheduleAssignmentLines();
  else lines.innerHTML = "";
}

function scheduleAssignmentLines() {
  if (!["goal-assignments", "people-projects"].includes(state.view) || assignmentDrag) return;
  if (assignmentDrawFrame) return;
  assignmentDrawFrame = requestAnimationFrame(() => {
    assignmentDrawFrame = 0;
    if (state.view === "people-projects") drawPeopleProjectLines();
    else drawAssignmentLines();
  });
}

function watchAssignmentLayout() {
  if (assignmentResizeObserver) assignmentResizeObserver.disconnect();
  assignmentResizeObserver = null;
  const map = els.taskList.querySelector(".assignment-map");
  if (!map || typeof ResizeObserver === "undefined") return;
  assignmentResizeObserver = new ResizeObserver(scheduleAssignmentLines);
  assignmentResizeObserver.observe(map);
  map.querySelectorAll(".assignment-panel, .assignment-task, .assignment-goal").forEach((element) => {
    assignmentResizeObserver.observe(element);
  });
}

function drawAssignmentLines() {
  const svg = els.taskList.querySelector(".assignment-lines");
  if (!svg) return;
  const rect = svg.getBoundingClientRect();
  if (!rect.width || !rect.height) return;
  svg.setAttribute("viewBox", `0 0 ${rect.width} ${rect.height}`);
  svg.innerHTML = assignmentMarkerDefs();
  for (const task of state.tasks.filter((item) => !item.parent_id && item.status !== "done")) {
    if (state.assignmentSelectedOnly && task.id !== state.selectedAssignmentTaskId) continue;
    const taskHandle = els.taskList.querySelector(`[data-assignment-task-id="${CSS.escape(task.id)}"] .task-handle`);
    if (!taskHandle) continue;
    const start = assignmentHandlePoint(taskHandle, svg);
    for (const goalId of goalIdsForTask(task)) {
      const goalHandle = els.taskList.querySelector(`[data-assignment-goal-id="${CSS.escape(goalId)}"] .goal-handle`);
      if (!goalHandle) continue;
      const end = assignmentGoalArrowPoint(goalHandle, svg);
      const isActive = task.id === state.selectedAssignmentTaskId;
      const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      path.setAttribute("d", assignmentCurvePath(start, end));
      path.setAttribute("class", isActive ? "assignment-line active" : "assignment-line");
      path.setAttribute("marker-end", `url(#${isActive ? "assignment-arrow-active" : "assignment-arrow"})`);
      svg.append(path);
    }
  }
}

function drawPeopleProjectLines() {
  const svg = els.taskList.querySelector(".assignment-lines");
  if (!svg) return;
  const rect = svg.getBoundingClientRect();
  if (!rect.width || !rect.height) return;
  svg.setAttribute("viewBox", `0 0 ${rect.width} ${rect.height}`);
  svg.innerHTML = assignmentMarkerDefs();
  for (const assignment of state.projectAssignments) {
    if (state.assignmentSelectedOnly && assignment.person_id !== state.selectedAssignmentPersonId) continue;
    const personHandle = els.taskList.querySelector(`[data-assignment-person-id="${CSS.escape(assignment.person_id)}"] .person-handle`);
    const projectHandle = els.taskList.querySelector(`[data-assignment-project-id="${CSS.escape(assignment.project_id)}"] .project-handle`);
    if (!personHandle || !projectHandle) continue;
    const start = assignmentHandlePoint(personHandle, svg);
    const end = assignmentGoalArrowPoint(projectHandle, svg);
    const isActive = assignment.person_id === state.selectedAssignmentPersonId;
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", assignmentCurvePath(start, end));
    path.setAttribute("class", isActive ? "assignment-line active" : "assignment-line");
    path.setAttribute("marker-end", `url(#${isActive ? "assignment-arrow-active" : "assignment-arrow"})`);
    svg.append(path);
  }
}

function assignmentMarkerDefs() {
  return `
    <defs>
      <marker id="assignment-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" markerUnits="userSpaceOnUse" orient="auto">
        <path d="M 1 1 L 9 5 L 1 9 z"></path>
      </marker>
      <marker id="assignment-arrow-active" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="9" markerHeight="9" markerUnits="userSpaceOnUse" orient="auto">
        <path d="M 1 1 L 9 5 L 1 9 z"></path>
      </marker>
    </defs>
  `;
}

function assignmentCurvePath(start, end) {
  const distance = Math.max(40, Math.abs(end.x - start.x) * 0.45);
  const control1 = { x: start.x + distance, y: start.y };
  const control2 = { x: end.x - distance, y: end.y };
  return `M ${start.x} ${start.y} C ${control1.x} ${control1.y}, ${control2.x} ${control2.y}, ${end.x} ${end.y}`;
}

function assignmentSvgPoint(svg, clientX, clientY) {
  const rect = svg.getBoundingClientRect();
  if (!rect.width || !rect.height) return { x: 0, y: 0 };
  return {
    x: clientX - rect.left,
    y: clientY - rect.top
  };
}

function assignmentHandlePoint(handle, svg) {
  const rect = handle.getBoundingClientRect();
  return assignmentSvgPoint(svg, rect.left + rect.width / 2, rect.top + rect.height / 2);
}

function assignmentGoalArrowPoint(handle, svg) {
  const rect = handle.getBoundingClientRect();
  return assignmentSvgPoint(svg, rect.left - 5, rect.top + rect.height / 2);
}

function clearAssignmentDragTarget() {
  els.taskList.querySelectorAll(".assignment-goal.drag-target").forEach((goal) => {
    goal.classList.remove("drag-target");
  });
}

function setAssignmentDragTarget(goal) {
  clearAssignmentDragTarget();
  if (goal) goal.classList.add("drag-target");
}

function updateAssignmentDraft(clientX, clientY) {
  if (!assignmentDrag) return;
  const target = document.elementFromPoint(clientX, clientY)?.closest(assignmentDrag.targetSelector);
  const targetHandle = target?.querySelector(assignmentDrag.targetHandleSelector);
  setAssignmentDragTarget(target || null);
  const point = targetHandle ? assignmentGoalArrowPoint(targetHandle, assignmentDrag.svg) : assignmentSvgPoint(assignmentDrag.svg, clientX, clientY);
  const end = {
    x: Math.max(0, Math.min(assignmentDrag.bounds.width, point.x)),
    y: Math.max(0, Math.min(assignmentDrag.bounds.height, point.y))
  };
  assignmentDrag.line.setAttribute("d", assignmentCurvePath(assignmentDrag.start, end));
}

function beginAssignmentDrag(handle, event) {
  const task = handle.closest("[data-assignment-task-id]");
  const person = handle.closest("[data-assignment-person-id]");
  const svg = els.taskList.querySelector(".assignment-lines");
  const map = els.taskList.querySelector(".assignment-map");
  if ((!task && !person) || !svg) return;
  const bounds = svg.getBoundingClientRect();
  map?.classList.add("dragging-assignment");
  svg.setAttribute("viewBox", `0 0 ${bounds.width} ${bounds.height}`);
  if (task) state.selectedAssignmentTaskId = task.dataset.assignmentTaskId;
  if (person) state.selectedAssignmentPersonId = person.dataset.assignmentPersonId;
  const start = assignmentHandlePoint(handle, svg);
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("class", "assignment-line assignment-line-draft");
  path.setAttribute("d", assignmentCurvePath(start, start));
  path.setAttribute("marker-end", "url(#assignment-arrow-active)");
  svg.append(path);
  assignmentDrag = task
    ? {
        sourceType: "task",
        sourceId: task.dataset.assignmentTaskId,
        targetSelector: "[data-assignment-goal-id]",
        targetHandleSelector: ".goal-handle",
        line: path,
        start,
        svg,
        bounds,
        map
      }
    : {
        sourceType: "person",
        sourceId: person.dataset.assignmentPersonId,
        targetSelector: "[data-assignment-project-id]",
        targetHandleSelector: ".project-handle",
        line: path,
        start,
        svg,
        bounds,
        map
      };
  updateAssignmentDraft(event.clientX, event.clientY);
}

async function toggleAssignmentLink(taskId, goalId) {
  const task = state.tasks.find((item) => item.id === taskId);
  if (!task || !goalId) return;
  const goals = new Set(goalIdsForTask(task));
  if (goals.has(goalId)) goals.delete(goalId);
  else goals.add(goalId);
  const goalIds = [...goals];
  await patchTask(taskId, { goal_ids: goalIds, goal_id: goalIds[0] || null });
}

async function togglePeopleProjectAssignment(personId, projectId) {
  if (!personId || !projectId) return;
  const existing = state.projectAssignments.find((assignment) => assignment.person_id === personId && assignment.project_id === projectId);
  if (existing) {
    await deleteProjectAssignment(existing.id);
    return;
  }
  await persistProjectAssignment({ person_id: personId, project_id: projectId, role_ids: [] });
}

async function finishAssignmentDrag(event) {
  if (!assignmentDrag) return;
  const drag = assignmentDrag;
  assignmentDrag = null;
  drag.map?.classList.remove("dragging-assignment");
  clearAssignmentDragTarget();
  drag.line.remove();
  const target = document.elementFromPoint(event.clientX, event.clientY)?.closest(drag.targetSelector);
  if (target) {
    suppressAssignmentClick = true;
    if (drag.sourceType === "task") {
      await toggleAssignmentLink(drag.sourceId, target.dataset.assignmentGoalId);
    } else {
      await togglePeopleProjectAssignment(drag.sourceId, target.dataset.assignmentProjectId);
    }
    setTimeout(() => {
      suppressAssignmentClick = false;
    }, 0);
  } else {
    renderTasks();
  }
}

function cancelAssignmentDrag() {
  if (!assignmentDrag) return;
  const drag = assignmentDrag;
  assignmentDrag = null;
  drag.map?.classList.remove("dragging-assignment");
  clearAssignmentDragTarget();
  drag.line.remove();
}

function fillSkillPicker(container, selected = []) {
  const values = new Set(parseIds(selected));
  container.innerHTML = "";
  const select = document.createElement("select");
  select.className = "skill-add-select";
  select.name = "skillAdd";
  select.setAttribute("aria-label", "Add skill");
  select.innerHTML = '<option value="">Add skill...</option>';
  for (const skill of sortedByName(state.skills.filter((item) => !values.has(item.id)))) {
    const option = document.createElement("option");
    option.value = skill.id;
    option.textContent = skill.name;
    select.append(option);
  }
  container.append(select);
  const pills = document.createElement("div");
  pills.className = "skill-pills";
  container.append(pills);
  for (const skill of sortedByName(state.skills)) {
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
  for (const relationship of sortedByName(state.relationshipTypes)) {
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
      <marker id="graph-dot-arrow" viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="5.5" markerHeight="5.5" orient="auto-start-reverse">
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
    const dependency = className.includes("dependency-link");
    let startX = from.x + from.width;
    let startY = from.y + from.height / 2;
    let endX = to.x;
    let endY = to.y + to.height / 2;
    let d = "";

    if (dependency && Math.abs(from.x - to.x) < 8 && to.y > from.y) {
      startX = from.x + from.width / 2;
      startY = from.y + from.height;
      endX = to.x + to.width / 2;
      endY = to.y;
      const curve = Math.max(20, (endY - startY) / 2);
      d = `M ${startX} ${startY} C ${startX} ${startY + curve}, ${endX} ${endY - curve}, ${endX} ${endY}`;
    } else if (dependency && endX <= startX + 20) {
      endX = to.x + to.width;
      const bendX = Math.max(startX, endX) + 56;
      d = `M ${startX} ${startY} C ${bendX} ${startY}, ${bendX} ${endY}, ${endX} ${endY}`;
    } else {
      const curve = Math.max(36, Math.abs(endX - startX) / 2);
      d = `M ${startX} ${startY} C ${startX + curve} ${startY}, ${endX - curve} ${endY}, ${endX} ${endY}`;
    }

    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("class", className);
    path.setAttribute("d", d);
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
  const timelineProjects = state.projects
    .filter((project) => projectTimelineStart(project))
    .sort((a, b) => projectTimelineStart(a).localeCompare(projectTimelineStart(b)) || a.name.localeCompare(b.name));

  if (!tasks.length && !timelineProjects.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "Nothing here right now.";
    els.taskList.append(empty);
    return;
  }

  const datedTasks = tasks.filter((task) => task.due_date);
  const noDateTasks = tasks.filter((task) => !task.due_date);
  const today = todayIso();
  const timelineDates = [
    today,
    ...datedTasks.map((task) => task.due_date),
    ...timelineProjects.flatMap(projectTimelineDates)
  ];
  const minDate = timelineDates.reduce((min, date) => (date < min ? date : min), timelineDates[0]);
  const maxDate = timelineDates.reduce((max, date) => (date > max ? date : max), timelineDates[0]);
  const zoomIndex = timelineZoomIndex();
  const pixelsPerDay = timelineZoomLevels[zoomIndex];
  state.timelineZoom = pixelsPerDay;
  const rangePad = pixelsPerDay <= 2 ? 45 : pixelsPerDay <= 6 ? 28 : pixelsPerDay <= 12 ? 14 : 10;
  const startDate = addDaysToIso(minDate < today ? minDate : today, -rangePad);
  const endDate = addDaysToIso(maxDate > today ? maxDate : today, rangePad);
  const dayCount = Math.max(1, daysBetween(startDate, endDate));
  const margin = 120;
  const compactTimeline = pixelsPerDay <= 6;
  const broadTimeline = pixelsPerDay <= 2;
  const projectRowHeight = broadTimeline ? 42 : compactTimeline ? 50 : 62;
  const rowHeight = broadTimeline ? 52 : compactTimeline ? 64 : 86;
  const axisTop = 78;
  const projectLabelTop = 118;
  const projectLaneTop = broadTimeline ? 142 : 150;
  const projectBandHeight = Math.max(1, timelineProjects.length) * projectRowHeight;
  const dividerTop = projectLaneTop + projectBandHeight + 28;
  const taskLabelTop = dividerTop + 24;
  const laneTop = taskLabelTop + 34;
  const noDateTop = laneTop + Math.max(1, datedTasks.length) * rowHeight + 44;
  const width = margin * 2 + dayCount * pixelsPerDay;
  const height = noDateTop + Math.max(1, noDateTasks.length) * (broadTimeline ? 50 : 74) + 60;
  const ticks = timelineTicks(startDate, endDate, pixelsPerDay);

  const timeline = document.createElement("div");
  timeline.className = `timeline-view ${compactTimeline ? "compact-timeline" : ""} ${broadTimeline ? "broad-timeline" : ""}`;
  timeline.innerHTML = `
    <div class="timeline-controls">
      <button class="ghost-button timeline-zoom" data-zoom-dir="-1" type="button" ${zoomIndex === 0 ? "disabled" : ""}>-</button>
      <span>${timelineZoomLabel(pixelsPerDay)}</span>
      <button class="ghost-button timeline-zoom" data-zoom-dir="1" type="button" ${zoomIndex === timelineZoomLevels.length - 1 ? "disabled" : ""}>+</button>
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

  for (const tick of ticks) {
    const left = margin + daysBetween(startDate, tick.date) * pixelsPerDay;
    const line = document.createElement("div");
    line.className = `timeline-tick ${tick.major ? "major" : ""}`;
    line.style.left = `${left}px`;
    line.style.top = `${axisTop - 22}px`;
    line.style.height = `${Math.max(height, 460) - axisTop - 24}px`;
    canvas.append(line);
    if (tick.label) {
      const label = document.createElement("div");
      label.className = `timeline-date ${tick.major ? "major" : ""}`;
      label.style.left = `${left}px`;
      label.style.top = `${axisTop - 46}px`;
      label.textContent = tick.label;
      canvas.append(label);
    }
  }

  const todayLeft = margin + daysBetween(startDate, today) * pixelsPerDay;
  if (todayLeft >= margin && todayLeft <= margin + dayCount * pixelsPerDay) {
    const todayLine = document.createElement("div");
    todayLine.className = "timeline-tick today";
    todayLine.style.left = `${todayLeft}px`;
    todayLine.style.top = `${axisTop - 22}px`;
    todayLine.style.height = `${Math.max(height, 460) - axisTop - 24}px`;
    canvas.append(todayLine);
    if (pixelsPerDay > 6) {
      const todayLabel = document.createElement("div");
      todayLabel.className = "timeline-date today";
      todayLabel.style.left = `${todayLeft}px`;
      todayLabel.style.top = `${axisTop - 46}px`;
      todayLabel.textContent = "Today";
      canvas.append(todayLabel);
    }
  }

  canvas.append(makeTimelineSectionLabel("Projects", margin, projectLabelTop));
  if (timelineProjects.length) {
    timelineProjects.forEach((project, index) => {
      const projectStart = projectTimelineStart(project);
      const projectEnd = projectTimelineEnd(project);
      const startX = margin + daysBetween(startDate, projectStart) * pixelsPerDay;
      const endX = margin + daysBetween(startDate, projectEnd) * pixelsPerDay;
      const y = projectLaneTop + index * projectRowHeight;
      canvas.append(makeTimelineProject(project, startX, y, Math.max(broadTimeline ? 44 : compactTimeline ? 76 : 140, endX - startX + Math.max(2, pixelsPerDay))));
    });
  } else {
    const emptyProjects = document.createElement("div");
    emptyProjects.className = "timeline-empty-band";
    emptyProjects.style.left = `${margin}px`;
    emptyProjects.style.top = `${projectLaneTop}px`;
    emptyProjects.textContent = "No dated projects";
    canvas.append(emptyProjects);
  }

  const divider = document.createElement("div");
  divider.className = "timeline-divider";
  divider.style.left = `${margin}px`;
  divider.style.top = `${dividerTop}px`;
  divider.style.width = `${dayCount * pixelsPerDay}px`;
  canvas.append(divider);
  canvas.append(makeTimelineSectionLabel("Tasks", margin, taskLabelTop));

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
      canvas.append(makeTimelineTask(task, margin + index * (broadTimeline ? 132 : 232), noDateTop));
    });
  }

  els.taskList.append(timeline);
  const scroller = timeline.querySelector(".timeline-scroller");
  requestAnimationFrame(() => {
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

function projectTimelineStart(project) {
  return project.start_date || project.end_date || project.target_date || "";
}

function projectTimelineEnd(project) {
  const start = projectTimelineStart(project);
  const end = project.end_date || project.start_date || project.target_date || start;
  return end < start ? start : end;
}

function projectTimelineDates(project) {
  const start = projectTimelineStart(project);
  const end = projectTimelineEnd(project);
  return [start, end].filter(Boolean);
}

function makeTimelineSectionLabel(text, x, y) {
  const label = document.createElement("div");
  label.className = "timeline-section-label";
  label.style.left = `${x}px`;
  label.style.top = `${y}px`;
  label.textContent = text;
  return label;
}

function makeTimelineProject(project, x, y, width) {
  const node = document.createElement("button");
  const status = projectStatusName(project);
  const type = projectTypeName(project);
  node.className = "timeline-project";
  node.type = "button";
  node.dataset.projectId = project.id;
  node.style.left = `${x}px`;
  node.style.top = `${y}px`;
  node.style.width = `${width}px`;
  applyProjectStatusTone(node, status);
  node.innerHTML = `
    <span class="timeline-project-title"></span>
    <span class="timeline-project-meta"></span>
  `;
  node.querySelector(".timeline-project-title").textContent = project.name || "Untitled project";
  node.querySelector(".timeline-project-meta").textContent = [type, status, `${formatDate(projectTimelineStart(project))} - ${formatDate(projectTimelineEnd(project))}`]
    .filter(Boolean)
    .join(" · ");
  return node;
}

function openTaskFromTimeline(taskId) {
  const task = state.tasks.find((item) => item.id === taskId);
  if (!task) return;
  focusObject("task", task.id, "timeline");
}

function openProjectFromTimeline(projectId) {
  const project = state.projects.find((item) => item.id === projectId);
  if (!project) return;
  focusObject("project", project.id, "timeline");
}

function renderDetail() {
  const task = state.tasks.find((item) => item.id === state.selectedId);

  const detailHiddenViews = ["home", "goals", "goal-assignments", "people-projects", "people", "people-filter", "projects", "project-filter", "ideas", "areas", "skills", "relationships", "project-types", "project-statuses", "roles", "venues", "focus-task", "focus-project", "focus-goal", "focus-person"];
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
  detail.project.value = task.project_id || "";
  detail.tags.value = task.tags.join(", ");
  detail.area.value = task.area_id || areaIdForName(task.area);
  detail.priority.value = task.priority;
  detail.due.value = task.due_date || "";
  detail.energy.value = task.energy;
  els.completeButton.classList.toggle("reopen", task.status === "done");
  els.completeButton.innerHTML = `<span aria-hidden="true">${task.status === "done" ? "↺" : "✓"}</span>${task.status === "done" ? "Reopen task" : "Mark done"}`;
}

function render() {
  const label = new Intl.DateTimeFormat(undefined, { weekday: "long", month: "long", day: "numeric" }).format(new Date());
  const titles = {
    home: "Home",
    tasks: "Tasks",
    today: "Tasks",
    upcoming: "Tasks",
    backlog: "Tasks",
    done: "Tasks",
    goals: "Life Goals",
    "goal-assignments": "Tasks to Life Goals",
    "people-projects": "People to Projects",
    people: "People",
    "people-filter": "People Filter",
    projects: "Projects",
    "project-filter": "Project Filter",
    ideas: "Ideas",
    graph: "Task Graph",
    timeline: "Timeline",
    "focus-task": "Task",
    "focus-project": "Project",
    "focus-goal": "Life Goal",
    "focus-person": "Person",
    areas: "Areas",
    skills: "Skills",
    relationships: "Relationships",
    "project-types": "Project Types",
    "project-statuses": "Project Status",
    roles: "Roles",
    venues: "Venues"
  };
  const focusViews = ["focus-task", "focus-project", "focus-goal", "focus-person"];
  const isFocusView = focusViews.includes(state.view);
  const isPlanningView = ["home", "goals", "goal-assignments", "people-projects", "people", "people-filter", "projects", "project-filter", "ideas", "areas", "skills", "relationships", "project-types", "project-statuses", "roles", "venues", ...focusViews].includes(state.view);

  setDensity(state.density);
  document.documentElement.style.setProperty("--detail-width", `${state.detailWidth}px`);
  els.plannerGrid.classList.toggle("graph-mode", state.view === "graph");
  els.plannerGrid.classList.toggle("timeline-mode", state.view === "timeline");
  els.plannerGrid.classList.toggle("planning-mode", isPlanningView);
  els.plannerGrid.classList.toggle("focus-mode", isFocusView);
  els.entryPanel.classList.toggle("hidden", state.view === "graph" || state.view === "timeline" || isPlanningView);
  els.todayLabel.textContent = label;
  els.viewTitle.textContent = titles[state.view] || "Planner";
  els.boardTitle.textContent = state.view === "graph" ? "Task Graph" : state.view === "timeline" ? "Task timeline" : titles[state.view] || "Planner";
  els.storageStatus.textContent = isSupabaseReady() ? state.user.email : "Local storage";
  els.appVersion.textContent = `Version ${APP_VERSION}`;
  els.keyButton.textContent = state.user ? "Sign out" : "Google";
  els.keyButton.title = state.user ? `Signed in as ${state.user.email}` : "Sign in with Google";
  els.showDone.checked = state.showDone;
  els.storageStatus.title = state.syncError || "";
  els.storageStatus.textContent = state.syncError ? "Sync issue" : els.storageStatus.textContent;
  if (state.syncMessage && !state.syncError) {
    els.syncStatus.textContent = state.syncMessage;
    els.syncStatus.classList.remove("hidden");
  } else {
    els.syncStatus.textContent = "";
    els.syncStatus.classList.add("hidden");
  }
  if (state.syncError) {
    els.syncError.textContent = `Save issue: ${state.syncError}. Your changes are kept in this browser; press Sync to retry.`;
    els.syncError.classList.remove("hidden");
  } else {
    els.syncError.textContent = "";
    els.syncError.classList.add("hidden");
  }
  document.querySelectorAll(".view-button").forEach((button) => {
    button.classList.toggle("active", button.dataset.view === state.view);
  });

  renderCounts();
  renderTaskFilterBar();
  renderTagFilters();
  renderAreas();
  renderParentControls();
  renderTasks();
  renderDetail();
  syncBrowserHistory();
}

function toggleTaskStatus(id) {
  const task = state.tasks.find((item) => item.id === id);
  if (!task) return;
  const done = task.status !== "done";
  return patchTaskWithFeedback(task.id, { status: done ? "done" : "active", completed_at: done ? nowIso() : null });
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
  setFormSaving(els.taskForm, true);
  showSyncMessage("Saving task...");
  try {
    await waitForInitialCloudLoad();
    const form = new FormData(els.taskForm);
    const task = normalizeTask({
      title: form.get("title").trim(),
      parent_id: form.get("parentId") || "",
      goal_id: form.get("goalId") || "",
      goal_ids: parseIds(form.get("goalId") || ""),
      project_id: form.get("projectId") || "",
      area_id: form.get("area") || null,
      area: areaById(form.get("area"))?.name || "Life",
      priority: form.get("priority"),
      due_date: form.get("dueDate") || defaultDueDateForView(),
      tags: parseTags(form.get("tags")),
      energy: "Medium",
      sort_order: nextSortOrder(form.get("parentId") || "")
    });
    state.selectedId = task.id;
    await persistTask(task);
    if (state.syncError) return;
    els.taskForm.reset();
    els.area.value = areaIdForName("Life") || state.areas[0]?.id || "";
    document.querySelector("#priority").value = "Medium";
    document.querySelector("#parent-id").value = "";
    document.querySelector("#goal-id").value = "";
    document.querySelector("#project-id").value = "";
  } finally {
    setFormSaving(els.taskForm, false);
  }
});

els.taskList.addEventListener("click", (event) => {
  if (suppressAssignmentClick) {
    suppressAssignmentClick = false;
    return;
  }
  if (event.target.closest(".connector-handle")) return;
  const homeViewButton = event.target.closest("[data-home-view]");
  if (homeViewButton) {
    if (["today", "upcoming", "backlog", "done"].includes(homeViewButton.dataset.homeView)) {
      setTaskFilter(homeViewButton.dataset.homeView);
    } else {
      state.view = homeViewButton.dataset.homeView;
    }
    render();
    return;
  }
  const homeTaskButton = event.target.closest("[data-home-task-id]");
  if (homeTaskButton) {
    focusObject("task", homeTaskButton.dataset.homeTaskId, state.view);
    return;
  }
  const assignmentTask = event.target.closest("[data-assignment-task-id]");
  if (assignmentTask) {
    state.selectedAssignmentTaskId = assignmentTask.dataset.assignmentTaskId;
    renderTasks();
    return;
  }
  const assignmentPerson = event.target.closest("[data-assignment-person-id]");
  if (assignmentPerson) {
    state.selectedAssignmentPersonId = assignmentPerson.dataset.assignmentPersonId;
    renderTasks();
    return;
  }
  const assignmentGoal = event.target.closest("[data-assignment-goal-id]");
  if (assignmentGoal) {
    if (state.selectedAssignmentTaskId) {
      toggleAssignmentLink(state.selectedAssignmentTaskId, assignmentGoal.dataset.assignmentGoalId);
    }
    return;
  }
  const deletePersonButton = event.target.closest(".delete-person-button");
  if (deletePersonButton) {
    const card = deletePersonButton.closest("[data-person-id]");
    if (card) {
      const wasFocus = state.view === "focus-person";
      deletePerson(card.dataset.personId).then(() => {
        if (wasFocus && !state.people.some((person) => person.id === card.dataset.personId)) leaveFocusView();
      });
    }
    return;
  }
  const personFocusButton = event.target.closest(".person-focus-button, [data-person-edit-id]");
  if (personFocusButton) {
    const personId = personFocusButton.dataset.personEditId || personFocusButton.closest("[data-person-id]")?.dataset.personId;
    if (personId) focusObject("person", personId, state.view);
    return;
  }
  const clearPeopleFiltersButton = event.target.closest(".clear-people-filters");
  if (clearPeopleFiltersButton) {
    sessionStorage.removeItem("people-skill-filter");
    sessionStorage.removeItem("people-relationship-filter");
    sessionStorage.removeItem("people-project-filter");
    sessionStorage.removeItem("people-role-filter");
    renderTasks();
    return;
  }
  const clearProjectFiltersButton = event.target.closest(".clear-project-filters");
  if (clearProjectFiltersButton) {
    sessionStorage.removeItem("project-type-filter");
    sessionStorage.removeItem("project-status-filter");
    sessionStorage.removeItem("project-person-filter");
    renderTasks();
    return;
  }
  const deleteAreaButton = event.target.closest(".delete-area-button");
  if (deleteAreaButton) {
    const row = deleteAreaButton.closest("[data-area-id]");
    if (row) deleteArea(row.dataset.areaId);
    return;
  }
  const deleteOptionButton = event.target.closest(".delete-option-button");
  if (deleteOptionButton) {
    const row = deleteOptionButton.closest("[data-option-id]");
    if (row) deleteNamedOption(row.dataset.optionType, row.dataset.optionId);
    return;
  }
  const projectViewModeButton = event.target.closest("[data-project-view-mode]");
  if (projectViewModeButton) {
    state.projectViewMode = projectViewModeButton.dataset.projectViewMode === "minimal" ? "minimal" : "full";
    localStorage.setItem("project-view-mode", state.projectViewMode);
    renderTasks();
    return;
  }
  const deleteProjectButton = event.target.closest(".delete-project-button");
  if (deleteProjectButton) {
    const card = deleteProjectButton.closest("[data-project-id]");
    if (card) {
      const wasFocus = state.view === "focus-project";
      deleteProject(card.dataset.projectId).then(() => {
        if (wasFocus && !state.projects.some((project) => project.id === card.dataset.projectId)) leaveFocusView();
      });
    }
    return;
  }
  const projectFocusButton = event.target.closest(".project-focus-button");
  if (projectFocusButton) {
    const card = projectFocusButton.closest("[data-project-id]");
    if (card) focusObject("project", card.dataset.projectId, state.view);
    return;
  }
  const addProjectPersonButton = event.target.closest(".add-project-person-button");
  if (addProjectPersonButton) {
    const card = addProjectPersonButton.closest("[data-project-id]");
    const personId = card?.querySelector("[name='projectPersonId']")?.value || "";
    if (card && personId) {
      persistProjectAssignment({ project_id: card.dataset.projectId, person_id: personId, role_ids: [] });
    }
    return;
  }
  const removeProjectPersonButton = event.target.closest(".remove-project-person-button");
  if (removeProjectPersonButton) {
    const row = removeProjectPersonButton.closest("[data-project-assignment-id]");
    if (row) deleteProjectAssignment(row.dataset.projectAssignmentId);
    return;
  }
  const removeRoleButton = event.target.closest(".role-remove-button");
  if (removeRoleButton) {
    const picker = removeRoleButton.closest(".role-picker");
    const row = removeRoleButton.closest("[data-project-assignment-id]");
    removeRoleButton.closest(".role-pill")?.remove();
    if (row) autosaveProjectAssignmentRow(row);
    else if (picker) fillRolePicker(picker, [...picker.querySelectorAll("[name='roleIds']")].map((input) => input.value));
    return;
  }
  const assignmentProject = event.target.closest("[data-assignment-project-id]");
  if (assignmentProject && !event.target.closest(".role-picker")) {
    togglePeopleProjectAssignment(state.selectedAssignmentPersonId, assignmentProject.dataset.assignmentProjectId);
    return;
  }
  const removeSkillButton = event.target.closest(".skill-remove-button");
  if (removeSkillButton) {
    const picker = removeSkillButton.closest(".skill-picker");
    const card = removeSkillButton.closest("[data-person-id]");
    const form = removeSkillButton.closest("#person-form");
    removeSkillButton.closest(".skill-pill")?.remove();
    if (card) autosavePersonCard(card);
    else if (picker) {
      fillSkillPicker(picker, [...picker.querySelectorAll("[name='skillIds']")].map((input) => input.value));
      if (form) saveCreationDraft(form);
    }
    return;
  }
  const goalTaskLink = event.target.closest(".goal-task-link");
  if (goalTaskLink) {
    focusObject("task", goalTaskLink.dataset.taskId, state.view);
    return;
  }
  const deleteGoalButton = event.target.closest(".delete-goal-button");
  if (deleteGoalButton) {
    const card = deleteGoalButton.closest("[data-goal-id]");
    if (card) {
      const wasFocus = state.view === "focus-goal";
      deleteGoal(card.dataset.goalId).then(() => {
        if (wasFocus && !state.goals.some((goal) => goal.id === card.dataset.goalId)) leaveFocusView();
      });
    }
    return;
  }
  const goalFocusButton = event.target.closest(".goal-focus-button");
  if (goalFocusButton) {
    const card = goalFocusButton.closest("[data-goal-id]");
    if (card) focusObject("goal", card.dataset.goalId, state.view);
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
    const nextIndex = Math.min(timelineZoomLevels.length - 1, Math.max(0, timelineZoomIndex() + Number(zoomButton.dataset.zoomDir)));
    state.timelineZoom = timelineZoomLevels[nextIndex];
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
    openTaskFromTimeline(timelineTask.dataset.id);
    return;
  }
  const timelineProject = event.target.closest(".timeline-project");
  if (timelineProject) {
    openProjectFromTimeline(timelineProject.dataset.projectId);
    return;
  }
  const graphNode = event.target.closest(".graph-node");
  if (graphNode) {
    focusObject("task", graphNode.dataset.id, "graph");
    return;
  }
  const mini = event.target.closest(".mini-task");
  if (mini) {
    focusObject("task", mini.dataset.id, state.view);
    return;
  }
  const focusBackButton = event.target.closest(".focus-back-button");
  if (focusBackButton) {
    leaveFocusView();
    return;
  }
  const taskFocusButton = event.target.closest(".task-focus-button");
  if (taskFocusButton) {
    const item = taskFocusButton.closest(".task-item");
    if (item) focusObject("task", item.dataset.id, state.view);
    return;
  }
  const focusToggleTaskButton = event.target.closest(".focus-toggle-task-button");
  if (focusToggleTaskButton) {
    const form = focusToggleTaskButton.closest("[data-task-focus-id]");
    if (form) toggleTaskStatus(form.dataset.taskFocusId);
    return;
  }
  const focusSubtaskButton = event.target.closest(".focus-subtask-button");
  if (focusSubtaskButton) {
    const form = focusSubtaskButton.closest("[data-task-focus-id]");
    const parent = state.tasks.find((item) => item.id === form?.dataset.taskFocusId);
    if (parent) {
      const task = normalizeTask({
        title: `Subtask of ${parent.title}`,
        parent_id: parent.id,
        goal_id: parent.goal_id,
        goal_ids: goalIdsForTask(parent),
        project_id: parent.project_id,
        area_id: parent.area_id || areaIdForName(parent.area),
        area: areaNameFor(parent),
        priority: parent.priority,
        due_date: parent.due_date,
        tags: parent.tags,
        energy: parent.energy,
        sort_order: nextSortOrder(parent.id)
      });
      state.focusedId = task.id;
      state.selectedId = task.id;
      persistTask(task);
    }
    return;
  }
  const focusDeleteTaskButton = event.target.closest(".focus-delete-task-button");
  if (focusDeleteTaskButton) {
    const form = focusDeleteTaskButton.closest("[data-task-focus-id]");
    const task = state.tasks.find((item) => item.id === form?.dataset.taskFocusId);
    if (!task) return;
    const childCount = descendantIds(task.id).length;
    const message = childCount
      ? `Delete "${task.title}" and ${childCount} subtask${childCount === 1 ? "" : "s"}? This cannot be undone.`
      : `Delete "${task.title}"? This cannot be undone.`;
    if (window.confirm(message)) {
      deleteTask(task.id).then(() => leaveFocusView());
    }
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
  const projectForm = event.target.closest("#project-form");
  const namedSettingsForm = event.target.closest("#named-settings-form");
  const taskFocusForm = event.target.closest("[data-task-focus-id]");
  if (!goalForm && !ideaForm && !areasForm && !personForm && !projectForm && !namedSettingsForm && !taskFocusForm) return;
  event.preventDefault();
  const form = new FormData(event.target);
  if (taskFocusForm) {
    await patchTask(taskFocusForm.dataset.taskFocusId, focusedTaskPayload(taskFocusForm));
  } else if (goalForm) {
    setFormSaving(event.target, true);
    showSyncMessage("Saving life goal...");
    try {
      await waitForInitialCloudLoad();
      const latestForm = new FormData(event.target);
      const name = latestForm.get("name").trim();
      if (hasDuplicateGoalName(name)) {
        alertDuplicate("Life goal", name);
        saveCreationDraft(event.target);
        state.syncMessage = "";
        renderSyncStatus();
        return;
      }
      await persistGoal({ name, description: latestForm.get("description").trim() }, { requireCloud: true, render: false });
      clearCreationDraft(event.target);
      event.target.reset();
      render();
    } catch (error) {
      saveCreationDraft(event.target);
      state.syncError = state.syncError || error.message || "Life goal was not saved to database.";
      state.syncMessage = "";
      renderSyncStatus();
    } finally {
      setFormSaving(event.target, false);
    }
  } else if (ideaForm) {
    setFormSaving(event.target, true);
    showSyncMessage("Saving idea...");
    try {
      await waitForInitialCloudLoad();
      const latestForm = new FormData(event.target);
      await persistIdea({
        text: latestForm.get("text").trim(),
        area_id: latestForm.get("area") || null,
        area: areaById(latestForm.get("area"))?.name || "Life"
      }, { render: false });
      clearCreationDraft(event.target);
      event.target.reset();
      render();
    } catch (error) {
      saveCreationDraft(event.target);
      state.syncError = state.syncError || error.message || "Idea was not saved.";
      state.syncMessage = "";
      renderSyncStatus();
    } finally {
      setFormSaving(event.target, false);
    }
  } else if (areasForm) {
    setFormSaving(event.target, true);
    showSyncMessage("Saving area...");
    try {
      await waitForInitialCloudLoad();
      const latestForm = new FormData(event.target);
      const area = ensureArea(latestForm.get("name").trim(), latestForm.get("color") || "#39ff14");
      if (area) await persistArea(area, { render: false });
      clearCreationDraft(event.target);
      event.target.reset();
      event.target.querySelector("[name='color']").value = "#39ff14";
      render();
    } catch (error) {
      saveCreationDraft(event.target);
      state.syncError = state.syncError || error.message || "Area was not saved.";
      state.syncMessage = "";
      renderSyncStatus();
    } finally {
      setFormSaving(event.target, false);
    }
  } else if (personForm) {
    setFormSaving(event.target, true);
    showSyncMessage("Saving person...");
    try {
      await waitForInitialCloudLoad();
      const latestForm = new FormData(event.target);
      const firstName = latestForm.get("firstName").trim();
      const lastName = latestForm.get("lastName").trim();
      const fullName = personNameFromParts(firstName, lastName);
      if (hasDuplicatePersonName(firstName, lastName)) {
        alertDuplicate("Person", fullName);
        saveCreationDraft(event.target);
        state.syncMessage = "";
        renderSyncStatus();
        return;
      }
      await persistPerson(
        {
          first_name: firstName,
          last_name: lastName,
          relationship_type_id: latestForm.get("relationshipTypeId") || "",
          skill_ids: latestForm.getAll("skillIds")
        },
        { requireCloud: true, render: false }
      );
      clearCreationDraft(event.target);
      event.target.reset();
      render();
    } catch (error) {
      saveCreationDraft(event.target);
      state.syncError = state.syncError || error.message || "Person was not saved to database.";
      state.syncMessage = "";
      renderSyncStatus();
    } finally {
      setFormSaving(event.target, false);
    }
  } else if (projectForm) {
    setFormSaving(event.target, true);
    showSyncMessage("Saving project...");
    try {
      await waitForInitialCloudLoad();
      normalizeDateRangeInputs(projectForm, { anchorEnd: Boolean(projectForm.querySelector("[name='startDate']")?.value) });
      const projectFormData = new FormData(projectForm);
      const name = projectFormData.get("name").trim();
      if (hasDuplicateProjectName(name)) {
        alertDuplicate("Project", name);
        saveCreationDraft(event.target);
        state.syncMessage = "";
        renderSyncStatus();
        return;
      }
      await persistProject({
        name,
        description: projectFormData.get("description").trim(),
        project_type_id: projectFormData.get("projectTypeId") || "",
        project_status_id: projectFormData.get("projectStatusId") || "",
        venue_id: projectFormData.get("venueId") || "",
        start_date: projectFormData.get("startDate") || "",
        end_date: projectFormData.get("endDate") || ""
      }, { requireCloud: true, render: false });
      clearCreationDraft(event.target);
      event.target.reset();
      render();
    } catch (error) {
      saveCreationDraft(event.target);
      state.syncError = state.syncError || error.message || "Project was not saved to database.";
      state.syncMessage = "";
      renderSyncStatus();
    } finally {
      setFormSaving(event.target, false);
    }
  } else if (namedSettingsForm) {
    setFormSaving(event.target, true);
    try {
      await waitForInitialCloudLoad();
      const latestForm = new FormData(event.target);
      const type = namedSettingsForm.dataset.optionType;
      const config = optionConfig(type);
      showSyncMessage(`Saving ${config.label}...`);
      const option = normalizeNamedOption({
        name: latestForm.get("name").trim(),
        sort_order: nextNamedOptionSortOrder(state[config.stateKey])
      });
      await persistNamedOption(type, option, { render: false });
      clearCreationDraft(event.target);
      event.target.reset();
      render();
    } catch (error) {
      saveCreationDraft(event.target);
      state.syncError = state.syncError || error.message || "Annotation was not saved.";
      state.syncMessage = "";
      renderSyncStatus();
    } finally {
      setFormSaving(event.target, false);
    }
  }
});

els.taskList.addEventListener("pointerdown", (event) => {
  if (!["goal-assignments", "people-projects"].includes(state.view)) return;
  const sourceButton = state.view === "goal-assignments"
    ? event.target.closest("[data-assignment-task-id]")
    : event.target.closest("[data-assignment-person-id]");
  if (!sourceButton) return;
  const handle = sourceButton.querySelector(state.view === "goal-assignments" ? ".task-handle" : ".person-handle") || sourceButton;
  event.preventDefault();
  event.stopPropagation();
  beginAssignmentDrag(handle, event);
});

document.addEventListener("pointermove", (event) => {
  if (!assignmentDrag) return;
  event.preventDefault();
  updateAssignmentDraft(event.clientX, event.clientY);
});

document.addEventListener("pointerup", (event) => {
  if (!assignmentDrag) return;
  event.preventDefault();
  finishAssignmentDrag(event);
});

document.addEventListener("pointercancel", cancelAssignmentDrag);

window.addEventListener("resize", scheduleAssignmentLines);

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
    refreshSharedPlannerUi();
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

function autosaveProjectCard(card) {
  const project = state.projects.find((item) => item.id === card.dataset.projectId);
  if (!project) return;
  const name = card.querySelector("[name='name']").value.trim();
  if (!name) return;
  queueAutosave(`project:${project.id}`, () =>
    persistProject(
      {
        id: project.id,
        name,
        description: card.querySelector("[name='description']").value.trim(),
        project_type_id: card.querySelector("[name='projectTypeId']").value || "",
        project_status_id: card.querySelector("[name='projectStatusId']").value || "",
        venue_id: card.querySelector("[name='venueId']").value || "",
        start_date: card.querySelector("[name='startDate']").value || "",
        end_date: card.querySelector("[name='endDate']").value || "",
        created_at: project.created_at
      },
      { render: false }
    )
  );
}

function autosaveProjectAssignmentRow(row) {
  const assignment = state.projectAssignments.find((item) => item.id === row.dataset.projectAssignmentId);
  if (!assignment) return;
  queueAutosave(`project-assignment:${assignment.id}`, () =>
    persistProjectAssignment(
      {
        id: assignment.id,
        project_id: assignment.project_id,
        person_id: assignment.person_id,
        role_ids: [...row.querySelectorAll("[name='roleIds']")].map((input) => input.value),
        created_at: assignment.created_at
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
  queueAutosave(`${row.dataset.optionType}:${option.id}`, async () => {
    await persistNamedOption(row.dataset.optionType, option, { render: false });
    refreshSharedPlannerUi();
  });
  if (shouldRender) render();
}

els.taskList.addEventListener("input", (event) => {
  const taskFocusForm = event.target.closest("[data-task-focus-id]");
  if (taskFocusForm) {
    queueFocusedTaskAutosave(taskFocusForm);
    return;
  }
  const creationForm = closestCreationForm(event.target);
  if (creationForm && !event.target.closest(".skill-add-select") && !event.target.closest(".role-add-select")) {
    if (creationForm.id === "project-form") {
      normalizeDateRangeInputs(creationForm, { anchorEnd: event.target.name === "startDate" });
      if (event.target.name === "projectStatusId") applyProjectStatusTone(event.target, projectStatusNameForId(event.target.value));
    }
    saveCreationDraft(creationForm);
    return;
  }
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
    applyPersonCardRelationshipTone(personCard);
    autosavePersonCard(personCard);
    return;
  }
  const projectCard = event.target.closest("[data-project-id]");
  if (projectCard) {
    normalizeDateRangeInputs(projectCard, { anchorEnd: event.target.name === "startDate" });
    applyProjectCardStatusTone(projectCard);
    autosaveProjectCard(projectCard);
    return;
  }
  const areaRow = event.target.closest(".area-settings-row");
  if (areaRow) {
    updateAreaRow(areaRow, false);
  }
});

els.taskList.addEventListener("change", (event) => {
  const taskFocusForm = event.target.closest("[data-task-focus-id]");
  if (taskFocusForm) {
    queueFocusedTaskAutosave(taskFocusForm);
    return;
  }
  if (event.target.name === "projectStatusId") {
    applyProjectStatusTone(event.target, projectStatusNameForId(event.target.value));
  }
  const creationForm = closestCreationForm(event.target);
  if (creationForm && !event.target.closest(".skill-add-select") && !event.target.closest(".role-add-select")) {
    if (creationForm.id === "project-form") normalizeDateRangeInputs(creationForm, { anchorEnd: event.target.name === "startDate" });
    saveCreationDraft(creationForm);
    return;
  }
  const selectedOnlyToggle = event.target.closest(".assignment-selected-only");
  if (selectedOnlyToggle) {
    state.assignmentSelectedOnly = selectedOnlyToggle.checked;
    localStorage.setItem("assignment-selected-only", String(state.assignmentSelectedOnly));
    scheduleAssignmentLines();
    return;
  }
  const projectSort = event.target.closest("[name='projectSort']");
  if (projectSort) {
    state.projectSort = projectSort.value === "startDate" ? "startDate" : "name";
    localStorage.setItem("project-sort", state.projectSort);
    renderTasks();
    return;
  }
  const peopleFilter = event.target.closest("[name='skillFilter'], [name='relationshipFilter'], [name='projectFilter'], [name='roleFilter']");
  if (peopleFilter) {
    const skillFilter = els.taskList.querySelector("[name='skillFilter']")?.value || "";
    const relationshipFilter = els.taskList.querySelector("[name='relationshipFilter']")?.value || "";
    const projectFilter = els.taskList.querySelector("[name='projectFilter']")?.value || "";
    const roleFilter = els.taskList.querySelector("[name='roleFilter']")?.value || "";
    sessionStorage.setItem("people-skill-filter", skillFilter);
    sessionStorage.setItem("people-relationship-filter", relationshipFilter);
    sessionStorage.setItem("people-project-filter", projectFilter);
    sessionStorage.setItem("people-role-filter", roleFilter);
    renderTasks();
    return;
  }
  const projectFilter = event.target.closest("[name='projectTypeFilter'], [name='projectStatusFilter'], [name='projectPersonFilter']");
  if (projectFilter) {
    sessionStorage.setItem("project-type-filter", els.taskList.querySelector("[name='projectTypeFilter']")?.value || "");
    sessionStorage.setItem("project-status-filter", els.taskList.querySelector("[name='projectStatusFilter']")?.value || "");
    sessionStorage.setItem("project-person-filter", els.taskList.querySelector("[name='projectPersonFilter']")?.value || "");
    renderTasks();
    return;
  }
  const skillAdd = event.target.closest(".skill-add-select");
  if (skillAdd) {
    const picker = skillAdd.closest(".skill-picker");
    const card = skillAdd.closest("[data-person-id]");
    const form = skillAdd.closest("#person-form");
    const selected = [...picker.querySelectorAll("[name='skillIds']")].map((input) => input.value);
    if (skillAdd.value && !selected.includes(skillAdd.value)) selected.push(skillAdd.value);
    fillSkillPicker(picker, selected);
    if (card) autosavePersonCard(card);
    else if (form) saveCreationDraft(form);
    return;
  }
  const roleAdd = event.target.closest(".role-add-select");
  if (roleAdd) {
    const picker = roleAdd.closest(".role-picker");
    const row = roleAdd.closest("[data-project-assignment-id]");
    const selected = [...picker.querySelectorAll("[name='roleIds']")].map((input) => input.value);
    if (roleAdd.value && !selected.includes(roleAdd.value)) selected.push(roleAdd.value);
    fillRolePicker(picker, selected);
    if (row) autosaveProjectAssignmentRow(row);
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
    applyPersonCardRelationshipTone(personCard);
    autosavePersonCard(personCard);
    return;
  }
  const projectCard = event.target.closest("[data-project-id]");
  if (projectCard) {
    normalizeDateRangeInputs(projectCard, { anchorEnd: event.target.name === "startDate" });
    applyProjectCardStatusTone(projectCard);
    autosaveProjectCard(projectCard);
    return;
  }
  const areaRow = event.target.closest(".area-settings-row");
  if (areaRow) {
    updateAreaRow(areaRow, true);
  }
});

els.taskList.addEventListener("click", (event) => {
  const sortButton = event.target.closest("[data-people-sort]");
  if (!sortButton) return;
  setPeopleSort(sortButton.dataset.peopleSort);
  renderTasks();
});

els.taskList.addEventListener("focusin", (event) => {
  if (event.target.name !== "endDate") return;
  const container = event.target.closest("[data-project-id]") || event.target.closest("#project-form");
  if (container) normalizeDateRangeInputs(container, { anchorEnd: true });
});

els.taskList.addEventListener("keydown", (event) => {
  const timelineTask = event.target.closest(".timeline-task");
  if (timelineTask && (event.key === "Enter" || event.key === " ")) {
    event.preventDefault();
    openTaskFromTimeline(timelineTask.dataset.id);
    return;
  }
  const timelineProject = event.target.closest(".timeline-project");
  if (timelineProject && (event.key === "Enter" || event.key === " ")) {
    event.preventDefault();
    openProjectFromTimeline(timelineProject.dataset.projectId);
    return;
  }
  const graphNode = event.target.closest(".graph-node");
  if (graphNode && (event.key === "Enter" || event.key === " ")) {
    event.preventDefault();
    focusObject("task", graphNode.dataset.id, "graph");
    return;
  }
  const assignmentProject = event.target.closest("[data-assignment-project-id]");
  if (assignmentProject && !event.target.closest(".role-picker") && (event.key === "Enter" || event.key === " ")) {
    event.preventDefault();
    togglePeopleProjectAssignment(state.selectedAssignmentPersonId, assignmentProject.dataset.assignmentProjectId);
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
    state.focusedId = "";
    state.view = button.dataset.view;
    if (state.view === "tasks") localStorage.setItem("task-filter", state.taskFilter);
    render();
  });
});

window.addEventListener("popstate", () => {
  applyRouteFromLocation({ render: true });
});

els.taskFilterBar?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-task-filter]");
  if (!button) return;
  setTaskFilter(button.dataset.taskFilter);
  render();
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
    goal_ids: parseIds(detail.goal.value || ""),
    project_id: detail.project.value || null,
    dependency_ids: [...detail.dependencies.selectedOptions].map((option) => option.value),
    tags: parseTags(detail.tags.value),
    area_id: detail.area.value || null,
    area: areaById(detail.area.value)?.name || "Life",
    priority: detail.priority.value,
    due_date: detail.due.value || null,
    energy: detail.energy.value
  };
}

function focusedTaskPayload(form) {
  return {
    title: form.querySelector("[name='title']").value.trim(),
    notes: form.querySelector("[name='notes']").value.trim(),
    parent_id: form.querySelector("[name='parentId']").value || null,
    goal_id: form.querySelector("[name='goalId']").value || null,
    goal_ids: parseIds(form.querySelector("[name='goalId']").value || ""),
    project_id: form.querySelector("[name='projectId']").value || null,
    dependency_ids: [...form.querySelector("[name='dependencies']").selectedOptions].map((option) => option.value),
    tags: parseTags(form.querySelector("[name='tags']").value),
    area_id: form.querySelector("[name='area']").value || null,
    area: areaById(form.querySelector("[name='area']").value)?.name || "Life",
    priority: form.querySelector("[name='priority']").value,
    due_date: form.querySelector("[name='dueDate']").value || null,
    energy: form.querySelector("[name='energy']").value
  };
}

function queueFocusedTaskAutosave(form) {
  if (!form?.dataset.taskFocusId || !form.querySelector("[name='title']").value.trim()) return;
  queueAutosave(`task:${form.dataset.taskFocusId}`, () => patchTask(form.dataset.taskFocusId, focusedTaskPayload(form), { render: false }));
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
  await patchTaskWithFeedback(task.id, { status: done ? "done" : "active", completed_at: done ? nowIso() : null });
});

els.expandTaskButton?.addEventListener("click", () => {
  if (!state.selectedId) return;
  focusObject("task", state.selectedId, state.view);
});

els.subtaskButton.addEventListener("click", async () => {
  const parent = state.tasks.find((item) => item.id === state.selectedId);
  if (!parent) return;
  const task = normalizeTask({
    title: `Subtask of ${parent.title}`,
    parent_id: parent.id,
    goal_id: parent.goal_id,
    goal_ids: goalIdsForTask(parent),
    project_id: parent.project_id,
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

applyRouteFromLocation();
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
  const maxWidth = Math.max(280, Math.min(900, grid.width - 180));
  state.detailWidth = Math.min(maxWidth, Math.max(280, grid.right - event.clientX));
  document.documentElement.style.setProperty("--detail-width", `${state.detailWidth}px`);
});

els.resizeHandle.addEventListener("pointerup", (event) => {
  if (!resizing) return;
  resizing = false;
  localStorage.setItem("detail-width", String(Math.round(state.detailWidth)));
  els.resizeHandle.releasePointerCapture(event.pointerId);
  document.body.classList.remove("resizing");
});
