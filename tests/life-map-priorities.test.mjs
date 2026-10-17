import test from 'node:test';
import assert from 'node:assert/strict';
import {priorityItems,reorderPriorities,setOutcomeStatus,renderPriorityView,priorityStatuses,urgencyDate,setOutcomeUrgency} from '../public/life-map-priorities.js';
import {topicReviewState,lifeMapPanelFromHash,renderLifeMap} from '../public/life-map.js';

const topics=[{id:'home',title:'Home'},{id:'room',title:'Room',parent:'home',group:'discovery'},{id:'a',title:'Organize room',parent:'room'},{id:'b',title:'Repair shelf',parent:'home'},{id:'c',title:'Paint wall',parent:'home'},{id:'template',title:'Unanswered topic',parent:'home',kind:'outcome-discovery'}];
function data(){return {answers:{a:{status:'unstarted'},b:{status:'progress'},c:{status:'unsure'}},links:{a:['task:t']},concerns:[],priorityOrder:['b','a','c']};}
test('urgency ranks overdue then nearest due, keeping manual importance order unchanged',()=>{
 const state=data();
 setOutcomeUrgency(state,'a','date','2026-10-16');
 setOutcomeUrgency(state,'b','month','','2026-10-17T12:00:00');
 state.prioritySort='urgency';
 assert.deepEqual(priorityItems(topics,state,new Date('2026-10-17T12:00:00')).active.map(t=>t.id),['a','b','c']);
 assert.deepEqual(state.priorityOrder,['b','a','c']);
 state.prioritySort='importance';
 assert.deepEqual(priorityItems(topics,state).active.map(t=>t.id),['b','a','c']);
 assert.equal(state.answers.a.status,'unstarted');
});
test('timeframes stay anchored and handle month ends and missing dates',()=>{
 assert.equal(urgencyDate({timing:'day',timingSetAt:'2026-12-31T12:00:00'}),new Date('2027-01-01T12:00:00').getTime());
 assert.equal(urgencyDate({timing:'month',timingSetAt:'2026-01-31T12:00:00'}),new Date('2026-02-28T12:00:00').getTime());
 assert.equal(urgencyDate({timing:'week',reviewedAt:'2026-10-01T12:00:00'},new Date('2027-01-01')),new Date('2026-10-08T12:00:00').getTime());
 assert.equal(urgencyDate({deadline:'2026-02-30'}),Infinity);
 assert.equal(urgencyDate({timing:'someday'}),Infinity);
 const state=data();setOutcomeUrgency(state,'a','date','2026-10-20');setOutcomeUrgency(state,'a','week');
 assert.equal(state.answers.a.deadline,'');
 assert.throws(()=>setOutcomeUrgency(state,'a','date','2026-02-30'));
});
test('within a day ranks before a week and survives save and reload',()=>{
 const state=data();const now='2026-10-17T12:00:00';
 setOutcomeUrgency(state,'a','day','',now);setOutcomeUrgency(state,'b','week','',now);
 state.prioritySort='urgency';
 assert.deepEqual(priorityItems(topics,JSON.parse(JSON.stringify(state))).active.map(t=>t.id),['a','b','c']);
});
test('urgency view hides manual movement and exposes editable timeframe and date controls',()=>{
 const state=data();state.prioritySort='urgency';setOutcomeUrgency(state,'a','date','2026-10-20');
 const root={innerHTML:'',querySelectorAll:()=>[]};
 renderPriorityView(root,{topics,data:state,tasks:[],notice:'',save:async()=>{},openOutcome(){},openTask(){},changePanel(){}});
 assert.match(root.innerHTML,/Outcome priorities/);
 assert.match(root.innerHTML,/data-priority-sort/);
 assert.match(root.innerHTML,/data-priority-deadline="a"/);
 assert.doesNotMatch(root.innerHTML,/data-priority-move=/);
 assert.doesNotMatch(root.innerHTML,/data-priority-drag=/);
});
test('leaf outcomes flatten in independent order while structural parents and untouched templates stay out',()=>{
 const state=data();
 assert.deepEqual(priorityItems(topics,state).active.map(topic=>topic.id),['b','a','c']);
 const parentAnswered={...state,answers:{...state.answers,home:{status:'progress'}}};
 assert.ok(!priorityItems(topics,parentAnswered).active.some(topic=>topic.id==='home'));
});
test('reordering persists after serialization; newly created outcomes append to bottom',()=>{
 const state=data();
 assert.equal(reorderPriorities(state,priorityItems(topics,state).active,'b','c'),true);
 assert.deepEqual(priorityItems(topics,state).active.map(topic=>topic.id),['a','c','b']);
 const restored=JSON.parse(JSON.stringify(state));
 const created={id:'new',title:'New outcome',parent:'home'};restored.concerns.push(created);
 assert.deepEqual(priorityItems([...topics,created],restored).active.map(topic=>topic.id),['a','c','b','new']);
 assert.equal(reorderPriorities(state,priorityItems(topics,state).active,'missing','a'),false);
});
test('priority status writes and Life Map status writes share canonical answers in both directions',()=>{
 const state=data();
 setOutcomeStatus(state,'a','done','2026-10-17T10:00:00Z');
 assert.equal(topicReviewState('a',topics,state.answers).key,'reviewed');
 assert.equal(state.answers.a.status,'done');
 assert.deepEqual(priorityItems(topics,state).completed.map(topic=>topic.id),['a']);
 state.answers.a={...state.answers.a,status:'progress',completedAt:null};
 assert.ok(priorityItems(topics,state).active.some(topic=>topic.id==='a'));
 assert.equal(state.links.a[0],'task:t');
 assert.throws(()=>setOutcomeStatus(state,'a','irrelevant'));
 assert.deepEqual(priorityStatuses.map(([value])=>value),['done','unstarted','progress','unsure']);
});
test('completed section is newest first and reopening then completing creates a new completion time',()=>{
 const state=data();
 setOutcomeStatus(state,'a','done','2026-10-16T10:00:00Z');
 setOutcomeStatus(state,'b','done','2026-10-17T10:00:00Z');
 assert.deepEqual(priorityItems(topics,state).completed.map(topic=>topic.id),['b','a']);
 setOutcomeStatus(state,'a','progress','2026-10-18T10:00:00Z');
 assert.equal(state.answers.a.completedAt,null);
 setOutcomeStatus(state,'a','done','2026-10-19T10:00:00Z');
 assert.deepEqual(priorityItems(topics,state).completed.map(topic=>topic.id),['a','b']);
 setOutcomeStatus(state,'a','done','2026-10-20T10:00:00Z');
 assert.equal(state.answers.a.completedAt,'2026-10-19T10:00:00Z');
});
test('excluded branches and irrelevant outcomes do not become active priorities',()=>{
 const state=data();state.answers.room={status:'uninterested'};state.answers.b={status:'irrelevant'};
 assert.deepEqual(priorityItems(topics,state).active.map(topic=>topic.id),['c']);
});
test('view includes parent context, task edit links, four status controls and accessible movement controls',()=>{
 const root={innerHTML:'',querySelectorAll:()=>[]},state=data();
 renderPriorityView(root,{topics,data:state,tasks:[{id:'t',title:'Buy boxes',status:'active'}],notice:'Saved',save:async()=>{},openOutcome(){},openTask(){},changePanel(){}});
 assert.match(root.innerHTML,/Home \/ Room/);
 assert.match(root.innerHTML,/Buy boxes/);
 assert.match(root.innerHTML,/data-priority-task="t"/);
 assert.match(root.innerHTML,/aria-label="Move Repair shelf up" disabled/);
 assert.match(root.innerHTML,/data-priority-status="unsure"/);
 assert.doesNotMatch(root.innerHTML,/Not relevant/);
 assert.doesNotMatch(root.innerHTML,/No linked tasks/);
 assert.match(root.innerHTML,/Completed/);
 assert.equal(lifeMapPanelFromHash('#priorities'),'priorities');
});
test('pointer dragging commits the target order and cancels without changes',async()=>{
 const state=data(),button={dataset:{priorityDrag:'b'},focus(){},setPointerCapture(){}};
 const target={dataset:{priorityId:'c'},classList:{add(){}}};
 let saves=0;
 const root={innerHTML:'',ownerDocument:{elementFromPoint:()=>({closest:()=>target})},querySelectorAll:selector=>selector==='[data-priority-drag]'?[button]:[]};
 renderPriorityView(root,{topics,data:state,tasks:[],notice:'',save:async()=>{saves++;},openOutcome(){},openTask(){},changePanel(){}});
 assert.equal(button.draggable,false);
 const event={button:0,pointerId:1,clientX:10,clientY:20,preventDefault(){}};
 button.onpointerdown(event);button.onpointercancel();await button.onpointerup(event);
 assert.equal(saves,0);
 button.onpointerdown(event);await button.onpointerup(event);
 assert.equal(saves,1);
 assert.deepEqual(priorityItems(topics,state).active.map(topic=>topic.id),['a','c','b']);
});
test('priority order persists through the existing Life Map local and cloud JSON save path',async()=>{
 const storage=new Map(),beforeWindow=globalThis.window,beforeStorage=globalThis.localStorage;
 const record={id:'saved-outcome',parent:'home',area:'Home',title:'Repair gate',question:'Gate status?'};
 const seed={answers:{[record.id]:{status:'progress'}},links:{[record.id]:['task:gate']},concerns:[record]};
 let written;
 const client={from:table=>{
  assert.equal(table,'planner_life_map');
  return {select:()=>({eq:()=>({maybeSingle:async()=>({data:{data:structuredClone(seed)},error:null})})}),upsert:async payload=>{written=payload;return {error:null};}};
 }};
 globalThis.window={location:{hash:'#priorities'}};
 globalThis.localStorage={getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,value)};
 try{
  const root={innerHTML:'',isConnected:true,querySelectorAll:()=>[]};
  const api={userKey:'priority-test',userId:'owner',client,tasks:[],projects:[],goals:[],people:[],render(){},openTask(){}};
  renderLifeMap(root,api);
  assert.equal(written,undefined,'do not overwrite cloud data before loading completes');
  await new Promise(resolve=>setImmediate(resolve));
  renderLifeMap(root,api);
  await new Promise(resolve=>setImmediate(resolve));
  assert.deepEqual(written.data.priorityOrder,['saved-outcome']);
  assert.equal(written.user_id,'owner');
  assert.equal(written.data.answers['saved-outcome'].status,'progress');
  assert.deepEqual(written.data.links['saved-outcome'],['task:gate']);
  assert.deepEqual(JSON.parse(storage.get('seven-lives-map:priority-test')).priorityOrder,['saved-outcome']);
 }finally{globalThis.window=beforeWindow;globalThis.localStorage=beforeStorage;}
});
