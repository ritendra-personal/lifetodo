import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {baseTopics,discoveryTopics,topicPath,topicReviewState,interviewCandidates,nextReviewTopic} from '../public/life-map.js';
import {assembleTopics} from '../public/life-map-discovery.js';
import {existingOutcome} from '../public/life-map-structure.js';
import {concreteAction} from '../public/life-map-actions.js';

test('all original discovery identities and saved information survive the audit regrouping',()=>{
 const original=discoveryTopics({refine:false}),revised=discoveryTopics();
 const byId=new Map(revised.map(topic=>[topic.id,topic]));
 assert.equal(original.length,659);
 for(const topic of original){
  assert(byId.has(topic.id),'Lost topic: '+topic.id);
  assert.equal(byId.get(topic.id).area,topic.area,'Changed area: '+topic.id);
 }
 const data={answers:{},links:{},concerns:[],priorityOrder:['custom'],prioritySort:'urgency'};
 for(const topic of original){
  data.answers[topic.id]={status:'progress',notes:'Keep note '+topic.id,timing:'month'};
  data.links[topic.id]=['task:'+topic.id,'project:existing','person:existing'];
 }
 data.concerns.push({id:'custom',parent:'care:heart:0',area:'Health and wellbeing',title:'My private outcome',customField:'preserved'});
 const before=JSON.stringify(data),topics=assembleTopics(baseTopics,revised,data);
 assert.equal(JSON.stringify(data),before,'Assembly must not rewrite saved data');
 for(const topic of original)assert(topics.some(item=>item.id===topic.id));
 assert.deepEqual(topics.find(topic=>topic.id==='custom'),{...data.concerns[0],isOutcome:true});
 for(const topic of topics)assert(baseTopics.some(area=>area.id===topicPath(topic.id,topics)[0]?.id),'Unreachable: '+topic.id);
});

test('condition details remain accessible but are not mandatory review or random questions',()=>{
 const topics=[...baseTopics,...discoveryTopics()];
 assert(topics.find(topic=>topic.id==='care:diabetes:0'));
 const optional=topics.find(topic=>topic.id==='health:conditions');
 assert(optional.reviewOptional);
 assert.equal(topicReviewState(optional.id,topics,{}).total,0);
 assert(!interviewCandidates(topics,{}).some(topic=>topicPath(topic.id,topics).some(parent=>parent.id===optional.id)));
 assert.notEqual(nextReviewTopic('check:health:4',topics,{})?.id,optional.id);
 const withOutcome=assembleTopics(baseTopics,discoveryTopics(),{answers:{},links:{},concerns:[{id:'mine',parent:'care:diabetes:0',title:'My care outcome'}]});
 assert.equal(topicReviewState('care:diabetes:0',withOutcome,{}).key,'reviewed');
 assert(topicReviewState(optional.id,withOutcome,{}).reviewed>0);
});

test('suggestions do not reverse stopping or assign another person’s care to the user',()=>{
 for(const title of ['Cancel a rehearsal','Stop writing this script','Leave a community group','Pause film production','Do not renew insurance','Reduce medication costs','Support a friend after surgery','Help my parent with dental care']){
  assert.equal(concreteAction({title}),'',title);
 }
 assert.equal(concreteAction({title:'Cancel rehearsal'},{next:'Notify the cast'}),'Notify the cast');
 assert.match(concreteAction({title:'Apply for a new job'}),/^Read the job requirements/);
 assert.match(concreteAction({title:'Back up caregiver contacts'}),/^Run a backup/);
});

test('existing outcomes are discovered without merging or rewriting their information',()=>{
 const topics=[{id:'topic',title:'A result'},{id:'mine',isOutcome:true,title:'A result',notes:'Keep this'}];
 const before=JSON.stringify(topics);
 assert.equal(existingOutcome(topics,'  a   RESULT ').id,'mine');
 assert.equal(existingOutcome(topics,'Different result'),undefined);
 assert.equal(JSON.stringify(topics),before);
});

test('relationship and learning creation ask for the result and preserve the entered title',()=>{
 const source=readFileSync(new URL('../public/life-map.js',import.meta.url),'utf8');
 assert(source.includes('What would you like to change or maintain with'));
 assert(source.includes('What would you like to be able to do?'));
 assert(source.includes('Open an existing outcome'));
 assert(!source.includes('Win an Oscar'));
 const relationship=source.slice(source.indexOf('async function createRelationship'),source.indexOf("root.querySelector('#lm-relationship-custom')?.addEventListener"));
 assert(relationship.includes('title,personId:'));
 assert(!relationship.includes('const outcomeTitle='));
});
