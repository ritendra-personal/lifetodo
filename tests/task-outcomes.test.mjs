import test from 'node:test';
import assert from 'node:assert/strict';
import {searchOutcomes,taskOutcomeIds} from '../public/outcome-picker.js';
import {ensureLifeMapLoaded,lifeMapTaskContext,setTaskOutcome,createTaskForOutcome,retryLifeMapLoad} from '../public/life-map.js';

const storage=new Map();
globalThis.localStorage={getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,value)};
let sequence=0;
function fixture(extra={}){
 const api={userKey:'task-outcome-test-'+(++sequence),tasks:[],...extra};
 storage.set('seven-lives-map:'+api.userKey,JSON.stringify({answers:{},concerns:[{id:'outcome',parent:'home',title:'Repair the roof',area:'Home'}],links:{outcome:['person:p','project:j','task:old']}}));
 return api;
}
test('outcome search matches path and title, preserves distinct IDs and limits results',()=>{
 const outcomes=Array.from({length:20},(_,i)=>({id:String(i),title:'Repair',path:'Home / Roof / Repair'}));
 assert.equal(searchOutcomes(outcomes,'home repair').length,12);
 assert.equal(searchOutcomes(outcomes,'missing').length,0);
 assert.deepEqual(taskOutcomeIds({a:['task:one'],b:['person:one'],c:['task:one']},'one'),['a','c']);
});
test('link and unlink preserve unrelated records and persist across reload',async()=>{
 const api=fixture();await ensureLifeMapLoaded(api);
 await setTaskOutcome(api,'new','outcome');await setTaskOutcome(api,'new','outcome');
 assert.deepEqual(lifeMapTaskContext(api).links.outcome,['person:p','project:j','task:old','task:new']);
 await setTaskOutcome(api,'new','outcome',true);
 await retryLifeMapLoad(api);
 assert.deepEqual(lifeMapTaskContext(api).links.outcome,['person:p','project:j','task:old']);
});
test('cloud linking waits for initial load and saves the loaded records',async()=>{
 let resolveRead,writes=[];
 const api=fixture({userId:'account',readLifeMap:()=>new Promise(resolve=>resolveRead=resolve),writeLifeMap:async value=>writes.push(value)});
 const loading=ensureLifeMapLoaded(api),linking=setTaskOutcome(api,'new','outcome');
 assert.equal(writes.length,0);
 resolveRead({data:{data:{answers:{},concerns:[{id:'outcome',parent:'home',title:'Cloud outcome'}],links:{outcome:['task:remote']}}}});
 await loading;await linking;
 assert.deepEqual(writes[0].data.links.outcome,['task:remote','task:new']);
});
test('failed initial load blocks writes and explicit retry recovers',async()=>{
 let fail=true,writes=0;
 const api=fixture({userId:'account',readLifeMap:async()=>{if(fail)throw new Error('Offline');return {data:null};},writeLifeMap:async()=>writes++});
 await ensureLifeMapLoaded(api);
 await assert.rejects(setTaskOutcome(api,'new','outcome'),/Offline/);
 assert.equal(writes,0);fail=false;await retryLifeMapLoad(api);
 await setTaskOutcome(api,'new','outcome');assert.equal(writes,1);
});
test('failed association rolls back and retry reuses the successfully created task',async()=>{
 let fail=true,created=0;
 const api=fixture({userId:'account',readLifeMap:async()=>({data:null}),writeLifeMap:async()=>{if(fail)throw new Error('Write failed');}});
 api.createTask=async fields=>{created++;const task={...fields,id:'saved'};api.tasks.push(task);return task;};
 await assert.rejects(createTaskForOutcome(api,'outcome','Book repair'),error=>error.taskId==='saved');
 assert(!lifeMapTaskContext(api).links.outcome.includes('task:saved'));
 fail=false;await createTaskForOutcome(api,'outcome','Book repair','saved');
 assert.equal(created,1);
 assert(lifeMapTaskContext(api).links.outcome.includes('task:saved'));
});
