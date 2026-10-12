import test from 'node:test';
import assert from 'node:assert/strict';
import {baseTopics, recommendation, branchStats} from '../public/life-map.js';
test('broad discovery starts without assumed personal obligations',()=>{
 assert.equal(baseTopics.length,12);
 assert(!baseTopics.some(t=>/estate|oci|play story/i.test(t.title)));
 for(const status of [undefined,'well','irrelevant','defer','done'])assert.equal(recommendation(baseTopics[0],{status}),null);
});
test('deadline and importance inform suggestions without inventing dates',()=>{
 const ordinary=recommendation(baseTopics[0],{status:'unstarted'});
 const important=recommendation(baseTopics[0],{status:'unstarted',impact:'high'});
 const urgent=recommendation(baseTopics[0],{status:'unstarted',deadline:'2020-01-01'});
 assert(urgent.score>important.score&&important.score>ordinary.score);
 assert.equal(ordinary.answer.deadline,undefined);
});
test('nested progress counts linked tasks once and excludes unrelated work',()=>{
 const topics=[{id:'home'},{id:'roof',parent:'home'},{id:'quote',parent:'roof'},{id:'work'}];
 const links={home:['task:1','project:p'],roof:['task:1'],quote:['goal:g']};
 const tasks=[{id:'1',status:'done'},{id:'2',project_id:'p',status:'todo'},{id:'3',goal_ids:['g'],status:'done'},{id:'4',status:'done'}];
 const result=branchStats('home',topics,{roof:{status:'stuck'}},links,tasks);
 assert.equal(result.total,3);assert.equal(result.done,2);assert.equal(result.attention,1);
 assert.equal(result.topics.length,3);
});

test('discovery offers document reminders and tracks accomplishments without tasks',async()=>{
 const {discoveryTopics,coverageStats}=await import('../public/life-map.js');
 const topics=[...baseTopics,...discoveryTopics()];
 assert(topics.find(t=>t.id==='check:admin:real-id'));
 assert(topics.find(t=>t.id==='check:admin:oci'));
 assert.equal(new Set(topics.map(t=>t.id)).size,topics.length);
 const answers={'check:admin:real-id':{status:'done'},'check:admin:oci':{status:'irrelevant'}};
 const stats=coverageStats('admin',topics,answers);
 assert.equal(stats.complete,1);assert.equal(stats.reviewed,2);assert.equal(stats.notRelevant,1);
 assert.equal(recommendation(topics.find(t=>t.id==='check:admin:real-id'),answers['check:admin:real-id']),null);
});

test('support discovery separates people and needs before asking completion status',async()=>{
 const {discoveryTopics,coverageStats,supportOutcome}=await import('../public/life-map.js');
 const hub=discoveryTopics().find(t=>t.id==='check:care:0');
 assert.equal(hub.kind,'support-discovery');
 const one=supportOutcome({id:'a',parent:hub.id,area:hub.area,personName:'Parent',kind:'housing',title:'Help with a house sale'});
 const two=supportOutcome({id:'b',parent:hub.id,area:hub.area,personId:'existing-person',personName:'Partner',kind:'career',title:'Support a job change'});
 assert.equal(two.personId,'existing-person');assert.equal(one.personId,null);
 assert.match(one.action,/housing/);assert.match(two.action,/job or learning/);
 const topics=[...baseTopics,...discoveryTopics(),one,two];
 const counts=coverageStats('care',topics,{[hub.id]:{status:'well'},a:{status:'done'}});
 assert.equal(counts.complete,1,'Broad support category must not count as a completed outcome');
});

test('visual map distinguishes attention, progress, completion and unknown',async()=>{
 const {mapState}=await import('../public/life-map.js');
 assert.equal(mapState({}).key,'unknown');
 assert.equal(mapState({},{status:'progress'}).key,'progress');
 assert.equal(mapState({},{status:'stuck'}).label,'Blocked');
 assert.equal(mapState({},{status:'done',deadline:'2000-01-01'}).key,'complete');
 assert.equal(mapState({},{status:'progress'},[{status:'active',due_date:'2000-01-01'}]).label,'Overdue');
 assert.equal(mapState({},{},[{status:'done'}]).key,'planned','Completing an action does not silently complete an outcome');
});

test('every broad reminder identifies an outcome before asking status',async()=>{
 const {discoveryTopics}=await import('../public/life-map.js');
 const topics=discoveryTopics();
 const direct=topics.filter(t=>!t.group&&!t.kind);
 assert.deepEqual(direct.map(t=>t.id).sort(),['check:admin:oci','check:admin:passport','check:admin:real-id']);
 for(const area of baseTopics)assert(topics.some(t=>t.parent===area.id&&(t.group||t.kind)),area.id);
 for(const t of topics.filter(t=>t.kind==='outcome-discovery')){
  assert(Array.isArray(t.choices),t.id);
  assert(t.parent,t.id);
 }
 assert.equal(new Set(topics.map(t=>t.id)).size,topics.length);
});

test('dental needs are discoverable through appointments and ongoing care',async()=>{
 const {discoveryTopics}=await import('../public/life-map.js');
 const topics=discoveryTopics();
 for(const id of ['appointment:dental','care:dental']){
  const dental=topics.find(t=>t.id===id);assert.equal(dental.group,'discovery');
  assert(topics.some(t=>t.parent===id&&t.title==='Root canal treatment'));
  assert(topics.some(t=>t.parent===id&&t.title==='Gum health assessment'));
 }
 assert.equal(topics.find(t=>t.id==='check:health:0').group,'appointments');
});

test('upgrading reviewed categories preserves existing answers, task links and children',async()=>{
 const {discoveryTopics}=await import('../public/life-map.js');
 const {assembleTopics}=await import('../public/life-map-discovery.js');
 const data={answers:{'check:health:0':{status:'progress'},'check:home:0':{status:'done'}},links:{'check:health:0':['task:existing']},concerns:[{id:'child',parent:'check:health:0',title:'Existing need'}]};
 const before=JSON.stringify(data);
 const topics=assembleTopics(baseTopics,discoveryTopics(),data);
 for(const id of Object.keys(data.answers)){
  const old=topics.find(t=>t.id===id);assert(!old.kind&&!old.group);assert.equal(old.parent,'discover:'+id);
  assert(topics.find(t=>t.id==='discover:'+id));
 }
 assert.equal(topics.find(t=>t.id==='appointment:dental').parent,'discover:check:health:0');
 assert.equal(topics.find(t=>t.id==='child').parent,'check:health:0');
 assert.equal(JSON.stringify(data),before);
 assert.equal(coverageStatsForTest(),2);
 function coverageStatsForTest(){return topics.filter(t=>!t.group&&!t.kind&&data.answers[t.id]).length;}
});
