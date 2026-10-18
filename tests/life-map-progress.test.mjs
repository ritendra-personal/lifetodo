import test from 'node:test';
import assert from 'node:assert/strict';
import {lifeMapReviewProgress,reviewProgressMarkup} from '../public/life-map-progress.js';
import {baseTopics,discoveryTopics} from '../public/life-map.js';
import {assembleTopics} from '../public/life-map-discovery.js';
const topics=[{id:'area'},{id:'one',parent:'area',kind:'outcome-discovery'},{id:'two',parent:'area',kind:'outcome-discovery'},{id:'three',parent:'area',kind:'outcome-discovery'}];
test('review progress separates untouched, visited, and addressed without treating visits as completion',()=>{
 const result=lifeMapReviewProgress(topics,{one:{visitedAt:'today'},two:{status:'uninterested'}});
 assert.deepEqual([result.total,result.partial,result.addressed,result.unvisited,result.percent],[3,1,1,1,33]);
 assert.equal(lifeMapReviewProgress(topics,{}).percent,0);
});
test('one saved outcome addresses its topic regardless of task or outcome completion and duplicates do not inflate totals',()=>{
 const one=[...topics,{id:'outcome',parent:'one',isOutcome:true}];
 const two=[...one,{id:'other',parent:'one',isOutcome:true}];
 assert.equal(lifeMapReviewProgress(one,{}).addressed,1);
 assert.equal(lifeMapReviewProgress(two,{}).addressed,1);
 assert.equal(lifeMapReviewProgress(two,{}).total,3);
});
test('excluding a parent addresses its descendants without changing the denominator',()=>{
 const before=lifeMapReviewProgress(topics,{}),after=lifeMapReviewProgress(topics,{area:{status:'uninterested'}});
 assert.equal(after.total,before.total);assert.equal(after.percent,100);assert.equal(after.addressed,3);
});
test('fallbacks and inactive optional details do not add review obligations',()=>{
 const map=[...topics,{id:'fallback',parent:'area',title:'Something else',suggested:true},{id:'optional',parent:'area',group:'discovery',reviewOptional:true},{id:'detail',parent:'optional',kind:'outcome-discovery'}];
 assert.equal(lifeMapReviewProgress(map,{}).total,3);
 assert.equal(lifeMapReviewProgress(map,{area:{status:'uninterested'}}).total,3);
 assert.equal(lifeMapReviewProgress([],{}).percent,0);
});
test('progress is independent of graph filters, preserves source data and renders accessible links and progress',()=>{
 const data={answers:{'check:home:5':{status:'uninterested'}},links:{},concerns:[]};
 const before=JSON.stringify(data),all=assembleTopics(baseTopics,discoveryTopics(),data),progress=lifeMapReviewProgress(all,data.answers);
 assert(progress.addressed>0);assert(progress.total>progress.addressed);
 const markup=reviewProgressMarkup(progress);
 assert(markup.includes('<progress'));assert(markup.includes('data-review-target='));assert(markup.includes('visited / partial'));
 assert.equal(JSON.stringify(data),before);
});
