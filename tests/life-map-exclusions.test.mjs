import test from 'node:test';
import assert from 'node:assert/strict';
import {baseTopics,discoveryTopics,topicReviewState,interviewCandidates,nextReviewTopic,nextGuidedTopic} from '../public/life-map.js';
import {assembleTopics} from '../public/life-map-discovery.js';
import {createTopicExclusionResolver,reopenTopicInterest} from '../public/life-map-review.js';
import {buildLifeGraph,layoutLifeGraph} from '../public/life-map-graph.js';
const childcare='check:care:2:choice:1';
const legacy='discover:'+childcare;
const templates=discoveryTopics();
const assemble=data=>assembleTopics(baseTopics,templates,data);

for(const [label,answers] of [
 ['current childcare opt-out',{[childcare]:{status:'uninterested',notes:'Keep this choice'}}],
 ['legacy-only opt-out',{[legacy]:{status:'uninterested',notes:'Keep this choice'}}],
 ['legacy menu with an existing saved answer',{[childcare]:{status:'progress'},[legacy]:{status:'uninterested'}}],
 ['excluded care parent',{'check:care:2':{status:'uninterested'}}],
 ['excluded legacy care parent',{'discover:check:care:2':{status:'uninterested'}}]
]){
 test(label+' suppresses all automatic paths after reloading saved data',()=>{
  const data=JSON.parse(JSON.stringify({answers,links:{[childcare]:['task:existing']},concerns:[{id:'saved-child',parent:childcare,title:'An existing outcome'}]}));
  const before=JSON.stringify(data),topics=assemble(data);
  const excluded=createTopicExclusionResolver(topics,data.answers);
  assert.ok(excluded(childcare));
  assert.ok(excluded('saved-child'));
  assert.equal(topicReviewState(childcare,topics,data.answers).key,'uninterested');
  const candidates=interviewCandidates(topics,data.answers);
  assert.ok(!candidates.some(topic=>excluded(topic.id)));
  for(const topic of topics){
   const next=nextGuidedTopic(topic.id,topics,data.answers);
   assert.ok(!next||!excluded(next.id),'Guided next offered '+next?.id);
   const review=nextReviewTopic(topic.id,topics,data.answers);
   assert.ok(!review||!excluded(review.id),'Review offered '+review?.id);
  }
  const map=buildLifeGraph({topics,answers:data.answers,links:data.links});
  assert.ok(!layoutLifeGraph(map).nodes.some(node=>node.sourceId===childcare||node.sourceId==='saved-child'));
  assert.equal(JSON.stringify(data),before,'Selections, notes, and links must not be reset');
 });
}

test('sibling-next skips an excluded branch even when its direct status is empty',()=>{
 const topics=[{id:'care'},{id:'first',parent:'care'},{id:'childcare',parent:'care'},{id:'later',parent:'care'}];
 const answers={'discover:childcare':{status:'uninterested'}};
 assert.equal(nextGuidedTopic('first',topics,answers).id,'later');
 assert.equal(nextReviewTopic('care',topics,{...answers,first:{reviewedAt:'2026-10-16'}}).id,'later');
});

test('explicit reactivation handles both IDs and does not reopen independently excluded children',()=>{
 const answers={[childcare]:{status:'uninterested',previousStatus:'progress',notes:'Retained'},[legacy]:{status:'uninterested'},child:{status:'uninterested'}};
 const topics=[{id:'care'},{id:childcare,parent:'care'},{id:'child',parent:childcare}];
 reopenTopicInterest(legacy,answers);
 assert.equal(answers[childcare].status,'progress');
 assert.equal(answers[childcare].notes,'Retained');
 assert.equal(answers[legacy].status,null);
 assert.equal(createTopicExclusionResolver(topics,answers)(childcare),null);
 assert.ok(createTopicExclusionResolver(topics,answers)('child'));
});
