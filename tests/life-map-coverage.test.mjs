import test from 'node:test';
import assert from 'node:assert/strict';
import {baseTopics,discoveryTopics,topicReviewState,interviewCandidates,nextReviewTopic} from '../public/life-map.js';
import {assembleTopics} from '../public/life-map-discovery.js';

test('every generated node has a coherent path, readable prompt, and supported interaction',()=>{
 const topics=[...baseTopics,...discoveryTopics()],byId=new Map(topics.map(topic=>[topic.id,topic]));
 assert.equal(byId.size,topics.length);
 const kinds=new Set(['relationship-discovery','support-discovery','learning-choice','milestone-discovery','care-outcome','outcome-discovery']);
 for(const topic of topics){
  assert.ok(topic.title?.trim(),topic.id);
  assert.ok(!/undefined|null/i.test(topic.title),topic.id);
  if(topic.kind)assert.ok(kinds.has(topic.kind),topic.id);
  else assert.ok(topic.question?.trim(),topic.id);
  if(topic.group)assert.ok(topics.some(child=>child.parent===topic.id),topic.id);
  const visited=new Set();let cursor=topic;
  while(cursor.parent){
   assert.ok(!visited.has(cursor.id),'Cycle: '+topic.id);visited.add(cursor.id);
   assert.ok(byId.has(cursor.parent),'Missing parent: '+topic.id);cursor=byId.get(cursor.parent);
  }
  assert.ok(baseTopics.some(area=>area.id===cursor.id),topic.id);
  assert.equal(topic.area,cursor.area,topic.id);
 }
});

test('new review coverage is discoverable without replacing old choice identities',()=>{
 const topics=[...baseTopics,...discoveryTopics()],byId=new Map(topics.map(topic=>[topic.id,topic]));
 for(const id of ['career','check:money:6','check:money:7','check:admin:6','appointment:preventive:extra:vaccines','check:health:3:extra:habits-support','check:admin:2:extra:privacy','check:future:0:extra:decision-support']){
  assert.ok(byId.has(id),id);
 }
 assert.equal(byId.get('check:money:5:choice:5').title,'Something else');
 assert.equal(byId.get('appointment:preventive:choice:2').title,'Something else');
 assert.equal(byId.get('check:admin:2:choice:3').title,'Device security');
 assert.match(byId.get('check:admin:real-id').title,/if applicable/);
 assert.match(byId.get('check:admin:oci').title,/if applicable/);
});

test('additional choices respect opt-outs, and assembly preserves stored answers and links',()=>{
 const data={answers:{'check:admin:2':{status:'uninterested'},'check:money:5:choice:5':{status:'done'}},links:{'check:money:5:choice:5':['task:existing']},concerns:[{id:'mine',parent:'check:money:5',title:'My own concern'}]};
 const before=JSON.stringify(data);
 const topics=assembleTopics(baseTopics,discoveryTopics(),data);
 assert.equal(topicReviewState('check:admin:2:extra:privacy',topics,data.answers).key,'uninterested');
 assert.ok(!interviewCandidates(topics,data.answers).some(topic=>topic.id==='check:admin:2'));
 assert.equal(JSON.stringify(data),before);
 assert.ok(topics.some(topic=>topic.id==='mine'));
});
test('guided review skips reviewed or opted-out topics but returns partially reviewed branches',()=>{
 const topics=[{id:'area'},{id:'reviewed',parent:'area'},{id:'excluded',parent:'area'},{id:'partial',parent:'area'},{id:'child',parent:'partial'}];
 const answers={reviewed:{reviewedAt:'2026-10-16'},excluded:{status:'uninterested'},child:{status:'progress'}};
 assert.equal(nextReviewTopic('area',topics,answers).id,'partial');
 answers.partial={reviewedAt:'2026-10-16'};
 assert.equal(nextReviewTopic('area',topics,answers),null);
});
