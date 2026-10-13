import test from 'node:test';
import assert from 'node:assert/strict';
import {interviewCandidates,pickInterviewQuestion,baseTopics,discoveryTopics,topicReviewState,topicPath} from '../public/life-map.js';
import {assembleTopics} from '../public/life-map-discovery.js';

const topics=[
 {id:'home'},
 {id:'repair',parent:'home',question:'Any repairs?'},
 {id:'clutter',parent:'home',question:'Any clutter?'},
 {id:'detail',parent:'repair'},
 {id:'group',parent:'home',group:'care'},
 {id:'specific',parent:'group'},
 {id:'discovery',parent:'home',kind:'support-discovery'}
];
test('breadcrumb includes every ancestor and the current topic',()=>{
 assert.deepEqual(topicPath('detail',topics).map(topic=>topic.id),['home','repair','detail']);
 assert.deepEqual(topicPath('home',topics).map(topic=>topic.id),['home']);
 assert.deepEqual(topicPath('missing',topics),[]);
 assert.equal(topicPath('a',[{id:'a',parent:'b'},{id:'b',parent:'a'}]).length,2);
});
test('chooses unanswered questions, excluding skips and context-dependent branches',()=>{
 assert.deepEqual(interviewCandidates(topics,{repair:{status:'done'}},['clutter','group','discovery']),[]);
 assert.equal(pickInterviewQuestion(topics,{},[],()=>0).id,'repair');
 assert.equal(pickInterviewQuestion(topics,{},[],()=>0.99).id,'discovery');
 assert.equal(pickInterviewQuestion(topics,{home:{status:'irrelevant'}}),null);
});
test('reviewed questions do not repeat and skipping does not change answers',()=>{
 const answers={repair:{status:'progress'},clutter:{status:'defer'}};
 assert.equal(pickInterviewQuestion(topics,answers,[],()=>0).id,'detail');
 assert.equal(pickInterviewQuestion(topics,answers,['detail','group','discovery']),null);
 assert.deepEqual(answers,{repair:{status:'progress'},clutter:{status:'defer'}});
});
test('a new life map has questions available without pre-existing outcomes',()=>{
 const assembled=assembleTopics(baseTopics,discoveryTopics(),{answers:{},concerns:[]});
 assert.ok(interviewCandidates(assembled,{}).length>10);
});
test('explicitly reviewed topics are not repeated',()=>{
 assert.equal(pickInterviewQuestion(topics,{repair:{reviewedAt:'2026-10-13'}},[],()=>0).id,'clutter');
});
test('nested review markers identify the branch, independently of completion',()=>{
 const branch=[{id:'health'},{id:'appointments',parent:'health'},{id:'dentist',parent:'appointments'},{id:'sleep',parent:'health'}];
 const answers={dentist:{status:'progress'}};
 assert.equal(topicReviewState('appointments',branch,answers).key,'partial');
 assert.match(topicReviewState('appointments',branch,answers).label,/1 topic/);
 assert.equal(topicReviewState('sleep',branch,answers).key,'unreviewed');
 assert.equal(topicReviewState('dentist',branch,answers).key,'reviewed');
 assert.equal(answers.dentist.status,'progress');
});
test('not of interest explicitly reviews a branch and suppresses its questions',()=>{
 const answers={home:{status:'uninterested',reviewedAt:'2026-10-13'}};
 assert.equal(pickInterviewQuestion(topics,answers),null);
 assert.equal(topicReviewState('repair',topics,answers).key,'uninterested');
 assert.match(topicReviewState('home',topics,answers).label,/Reviewed/);
 delete answers.home;
 assert.ok(pickInterviewQuestion(topics,answers));
});
test('opting out of Pets keeps its parent identity rather than creating a sibling outcome',()=>{
 const data={answers:{'check:home:5':{status:'uninterested',reviewedAt:'2026-10-13'}},concerns:[{id:'existing',parent:'discover:check:home:5',title:'Existing note'}]};
 const assembled=assembleTopics(baseTopics,discoveryTopics(),data);
 const pets=assembled.find(topic=>topic.id==='check:home:5');
 assert.equal(pets.parent,'home');
 assert.ok(pets.group||pets.kind);
 assert.ok(!assembled.some(topic=>topic.id==='discover:check:home:5'));
 const children=assembled.filter(topic=>topic.parent===pets.id);
 assert.ok(children.length>1);
 for(const child of children)assert.equal(topicReviewState(child.id,assembled,data.answers).key,'uninterested');
 assert.equal(assembled.find(topic=>topic.id==='existing').parent,pets.id);
 assert.ok(!interviewCandidates(assembled,data.answers).some(topic=>children.some(child=>child.id===topic.id)));
});
