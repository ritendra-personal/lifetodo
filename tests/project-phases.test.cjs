const fs = require("node:fs");
const vm = require("node:vm");
const assert = require("node:assert/strict");
const source = fs.readFileSync("public/app.js", "utf8");
const names = ["saveProjectPhaseCell", "projectPhaseEntryFor", "renderProjectPhaseMatrixView", "projectPhaseLinksFor", "phaseStatusTone", "phaseStatusNameForId", "phaseStatusIdForName"];
const functions = names.map((name) => {
  const start = source.search(new RegExp("(?:async )?function " + name + "\\("));
  assert.ok(start >= 0, name);
  const next = source.indexOf("\nfunction ", start + 1);
  const nextAsync = source.indexOf("\nasync function ", start + 1);
  const ends = [next, nextAsync].filter((value) => value >= 0);
  return source.slice(start, Math.min(...ends));
}).join("\n");
let cloud = false;
let fail = false;
const writes = [];
const state = {
  projects: [{ id: "p", name: "Project" }],
  projectPhases: [{ id: "phase", name: "Writing", sort_order: 0 }],
  phaseStatuses: [{ id: "green", name: "Completed", color: "#00ff00" }],
  tasks: [{ id: "t1", project_id: "p", title: "One", status: "done" }, { id: "t2", project_id: "p", title: "Two" }],
  projectPhaseLinks: [{ id: "l1", project_id: "p", phase_id: "phase", task_id: "t1" }, { id: "l2", project_id: "p", phase_id: "phase", task_id: "t2" }],
  projectPhaseEntries: [],
  matrixProjectId: "p", matrixPhaseId: "phase", matrixProjectColumnWidth: 200,
  projectPhaseEntriesCloudReady: true, user: { id: "user" }
};
const context = vm.createContext({
  state, els: { taskList: { innerHTML: "" } },
  makeId: () => "entry", nowIso: () => "2026-01-01T00:00:00Z",
  isSupabaseReady: () => cloud, saveLocal: () => {}, savedAtLabel: () => "now",
  sortedByName: (items) => [...items].sort((a, b) => a.name.localeCompare(b.name)),
  escapeHtml: (value) => String(value ?? "").replaceAll("<", "&lt;"),
  upsertRowDirect: async (table, payload) => {
    if (fail) throw new Error("Database unavailable");
    writes.push({ table, payload }); return payload;
  }
});
vm.runInContext(functions, context);
const form = {
  dataset: { matrixProjectId: "p", matrixPhaseId: "phase" },
  querySelector: (selector) => ({ value: selector.includes("Notes") ? "Phase notes" : "green" })
};
(async () => {
  context.renderProjectPhaseMatrixView();
  assert.match(context.els.taskList.innerHTML, /Not started/);
  assert.match(context.els.taskList.innerHTML, /2 tasks/);
  assert.doesNotMatch(context.els.taskList.innerHTML, /phaseTaskTitle|Save phase task/);
  await context.saveProjectPhaseCell(form);
  assert.equal(state.projectPhaseEntries.length, 1);
  assert.equal(state.tasks.length, 2);
  assert.equal(state.projectPhaseLinks.length, 2);
  cloud = true;
  await context.saveProjectPhaseCell(form);
  assert.equal(writes[0].table, "planner_project_phase_entries");
  assert.equal(writes[0].payload.notes, "Phase notes");
  fail = true;
  await assert.rejects(context.saveProjectPhaseCell(form), /Database unavailable/);
  state.projectPhaseEntriesCloudReady = false;
  await assert.rejects(context.saveProjectPhaseCell(form), /027/);
  context.renderProjectPhaseMatrixView();
  assert.match(context.els.taskList.innerHTML, /--phase-status-color:#00ff00/);
  console.log("Project phases: independent status/notes, multiple links, no task creation, cloud failure and migration guard passed.");
})().catch((error) => { console.error(error); process.exit(1); });
