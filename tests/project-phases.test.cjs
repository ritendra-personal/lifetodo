const fs = require("node:fs");
const vm = require("node:vm");
const assert = require("node:assert/strict");
const source = fs.readFileSync("public/app.js", "utf8");
const names = ["saveProjectPhaseCell", "projectPhaseEntryFor", "renderProjectPhaseMatrixView", "projectPhaseLinksFor", "phaseStatusTone", "phaseStatusNameForId", "phaseStatusIdForName", "selectedPhaseProjectTypeId", "phasesForProjectType", "phaseProjectTypeControl", "orderedPhaseStatuses", "phaseStatusChoices", "projectPhaseCompletion"];
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
  projectTypes: [], phaseProjectTypeId: "",
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
  state, els: { taskList: { innerHTML: "", querySelector: () => null } },
  makeId: () => "entry", nowIso: () => "2026-01-01T00:00:00Z",
  isSupabaseReady: () => cloud, saveLocal: () => {}, savedAtLabel: () => "now",
  sortedByName: (items) => [...items].sort((a, b) => a.name.localeCompare(b.name)),
  escapeHtml: (value) => String(value ?? "").replaceAll("<", "&lt;"),
  upsertRowDirect: async (table, payload) => {
    if (fail) throw new Error("Database unavailable");
    writes.push({ table, payload }); return payload;
  }
});
vm.runInContext(source.slice(source.indexOf("const defaultPhaseStatuses ="), source.indexOf("const defaultRoles =")) + functions, context);
const form = {
  dataset: { matrixProjectId: "p", matrixPhaseId: "phase" },
  querySelector: (selector) => ({ value: selector.includes("Notes") ? "Phase notes" : "green" })
};
(async () => {
  context.renderProjectPhaseMatrixView();
  assert.match(context.els.taskList.innerHTML, /Not reviewed/);
  assert.equal(context.phaseStatusTone('Not reviewed').color,'#94a3b8');
  assert.equal(context.phaseStatusChoices()[0].name,'Not reviewed');
  assert.match(context.els.taskList.innerHTML, /name="phaseStatusId" value=""/);
  assert.equal(state.projectPhaseEntries.length,0,'Rendering untouched cells does not create entries');
  assert.match(context.els.taskList.innerHTML, /2 tasks/);
  assert.doesNotMatch(context.els.taskList.innerHTML, /phaseTaskTitle|Save phase task/);
  assert.match(context.els.taskList.innerHTML, /<dialog/);
  assert.match(context.els.taskList.innerHTML, /<details class="phase-dialog-tasks">/);
  await context.saveProjectPhaseCell(form);
  assert.equal(state.projectPhaseEntries.length, 1);
  assert.equal(state.tasks.length, 2);
  assert.equal(state.projectPhaseLinks.length, 2);
  cloud = true;
  await context.saveProjectPhaseCell(form);
  assert.equal(writes[0].table, "planner_project_phase_entries");
  assert.equal(writes[0].payload.notes, "Phase notes");
  const unreviewedForm={...form,querySelector:selector=>({value:selector.includes('Notes')?'Keep these notes':''})};
  await context.saveProjectPhaseCell(unreviewedForm);
  assert.equal(writes.at(-1).payload.status_id,null,'Not reviewed uses the existing nullable status field');
  assert.equal(state.projectPhaseEntries[0].notes,'Keep these notes');
  await context.saveProjectPhaseCell(form);
  fail = true;
  await assert.rejects(context.saveProjectPhaseCell(form), /Database unavailable/);
  state.projectPhaseEntriesCloudReady = false;
  await assert.rejects(context.saveProjectPhaseCell(form), /027/);
  context.renderProjectPhaseMatrixView();
  assert.match(context.els.taskList.innerHTML, /--phase-status-color:#00ff00/);
  state.projectTypes = [{ id: "film", name: "Film" }, { id: "play", name: "Play" }];
  state.projects.push({ id: "movie", name: "Movie", project_type_id: "film" }, { id: "stage", name: "Stage", project_type_id: "play" });
  state.projectPhases.push({ id: "shoot", name: "Shooting", project_type_id: "film", sort_order: 2000 }, { id: "write", name: "Writing", project_type_id: "film", sort_order: 1000 }, { id: "rehearse", name: "Rehearsals", project_type_id: "play" });
  state.phaseProjectTypeId = "film";
  state.matrixProjectId = "";
  state.matrixPhaseId = "";
  context.renderProjectPhaseMatrixView();
  assert.match(context.els.taskList.innerHTML, /Movie/);
  assert.doesNotMatch(context.els.taskList.innerHTML, /Stage|Rehearsals/);
  assert.ok(context.els.taskList.innerHTML.indexOf(">Writing</th>") < context.els.taskList.innerHTML.indexOf(">Shooting</th>"));
  state.phaseProjectTypeId = "play";
  context.renderProjectPhaseMatrixView();
  assert.match(context.els.taskList.innerHTML, /Stage|Rehearsals/);
  assert.doesNotMatch(context.els.taskList.innerHTML, /Movie|Shooting/);
  state.phaseStatuses.push({ id: "na", name: "Not relevant", color: "#666666" });
  state.projectPhaseEntries.push({ project_id: "movie", phase_id: "write", status_id: "green" }, { project_id: "movie", phase_id: "shoot", status_id: "na" });
  const result = context.projectPhaseCompletion("movie", context.phasesForProjectType("film"));
  assert.equal(result.fraction, 1);
  assert.equal(result.total, 1);
  assert.equal(context.projectPhaseCompletion("stage", context.phasesForProjectType("play")).fraction, 0);
  state.projects.push({ id: "unfinished", name: "Unfinished", project_type_id: "film" });
  state.phaseProjectTypeId = "film";
  state.phaseProjectSort = "least";
  state.phaseProjectOrders = {};
  context.renderProjectPhaseMatrixView();
  assert.ok(context.els.taskList.innerHTML.indexOf(">Unfinished</button>") < context.els.taskList.innerHTML.indexOf(">Movie</button>"));
  assert.match(context.els.taskList.innerHTML, /100% complete/);
  state.phaseProjectSort = "most";
  context.renderProjectPhaseMatrixView();
  assert.ok(context.els.taskList.innerHTML.indexOf(">Unfinished</button>") < context.els.taskList.innerHTML.indexOf("Completed projects"));
  assert.ok(context.els.taskList.innerHTML.indexOf("Completed projects") < context.els.taskList.innerHTML.indexOf(">Movie</button>"));
  state.projectPhaseEntries.find((entry) => entry.project_id === "movie" && entry.phase_id === "write").status_id = "";
  context.renderProjectPhaseMatrixView();
  assert.match(context.els.taskList.innerHTML, /Completed projects/);
  state.phaseProjectOrders = {};
  context.renderProjectPhaseMatrixView();
  assert.doesNotMatch(context.els.taskList.innerHTML, /Completed projects/);
  assert.match(context.els.taskList.innerHTML, />Movie<\/button>/);
  state.projectPhaseEntries.push({ project_id: "stage", phase_id: "rehearse", status_id: "na" });
  assert.equal(context.projectPhaseCompletion("stage", context.phasesForProjectType("play")).fraction, null);
  console.log("Project phases: independent status/notes, multiple links, no task creation, cloud failure and migration guard passed.");
})().catch((error) => { console.error(error); process.exit(1); });
