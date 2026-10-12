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
