import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {topicReviewState,nextReviewTopic,discoveryTopics,removeCustomOutcome} from '../public/life-map.js';
import {assembleTopics} from '../public/life-map-discovery.js';

test('creating an outcome addresses a leaf without completing it; parents derive review from every child',()=>{
 const base=[{id:'root',title:'Root'}];
 const templates=[{id:'one',parent:'root',title:'One',kind:'outcome-discovery',suggested:true},{id:'two',parent:'root',title:'Two',kind:'outcome-discovery',suggested:true},{id:'fallback',parent:'root',title:'Something else',kind:'outcome-discovery',suggested:true}];
 const data={answers:{root:{reviewedAt:'2026-10-17'},two:{reviewedAt:'2026-10-17'}},links:{},concerns:[]};
 let topics=assembleTopics(base,templates,data);
 assert.equal(topicReviewState('root',topics,data.answers).key,'unreviewed');
 data.concerns.push({id:'outcome',parent:'one',title:'My outcome'});
 topics=assembleTopics(base,templates,data);
 assert.equal(topicReviewState('one',topics,data.answers).key,'reviewed');
 assert.equal(data.answers.outcome,undefined,'creation does not invent completion or progress');
 assert.equal(topicReviewState('root',topics,data.answers).key,'partial');
 assert.equal(nextReviewTopic('root',topics,data.answers).id,'two');
 data.answers.two={status:'uninterested'};
 assert.equal(topicReviewState('root',topics,data.answers).key,'reviewed');
 assert.equal(topicReviewState('root',topics,data.answers).total,2,'hidden fallback is not an extra review obligation');
 removeCustomOutcome(data,'outcome');topics=assembleTopics(base,templates,data);
 assert.equal(topicReviewState('root',topics,data.answers).key,'partial');
 assert.equal(nextReviewTopic('root',topics,data.answers).id,'one');
});

test('art collaborators has stable producer, filmmaker, actor and crew branches',()=>{
 const topics=discoveryTopics();
 assert.equal(topics.find(t=>t.id==='connections:art').parent,'check:relationships:4');
 assert.deepEqual(topics.filter(t=>t.parent==='connections:art').map(t=>t.title),['Producers','Filmmakers','Actors','Crew']);
 for(const topic of topics.filter(t=>t.parent==='connections:art'))assert.equal(topic.kind,'outcome-discovery');
});

test('obsolete manual review and misleading back controls are removed from the app',()=>{
 const source=readFileSync(new URL('../public/life-map.js',import.meta.url),'utf8');
 assert(!source.includes('lm-mark-reviewed'));
 assert(!source.includes('Nothing to add here right now'));
});
