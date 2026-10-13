import test from 'node:test';
import assert from 'node:assert/strict';
import {interviewCandidates,pickInterviewQuestion,baseTopics,discoveryTopics,topicReviewState} from '../public/life-map.js';
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
