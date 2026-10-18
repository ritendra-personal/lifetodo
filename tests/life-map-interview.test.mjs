import test from 'node:test';
import assert from 'node:assert/strict';
import {interviewCandidates,pickInterviewQuestion,baseTopics,discoveryTopics,topicReviewState,topicPath,removeCustomOutcome,placeQuestionSkip} from '../public/life-map.js';
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
test('working life uses concrete choices and specific follow-up questions without changing record IDs',()=>{
 const templates=discoveryTopics();
 const topic=templates.find(t=>t.id==='check:career:0');
 assert.equal(topic.title,'Work satisfaction and development');
 assert.match(topic.question,/improve or change.*working life/);
 for(let index=0;index<4;index++){
  const choice=templates.find(t=>t.id==='check:career:0:choice:'+index);
  assert.ok(choice);
  assert.ok(choice.outcomeQuestion.endsWith('?'));
 }
 const saved={answers:{'check:career:0:choice:0':{status:'uninterested'}},links:{},concerns:[]};
 const assembled=assembleTopics(baseTopics,templates,saved);
 assert.ok(assembled.some(t=>t.id==='check:career:0:choice:0'));
 assert.equal(saved.answers['check:career:0:choice:0'].status,'uninterested');
});
test('Ask me has one skip immediately after the question, without competing review navigation',()=>{
 for(const hasSkip of [true,false]){
  let removed=false,placed;
  const existing={};
  const section={ownerDocument:{createElement:()=>({})},querySelector:selector=>selector==='#lm-guide'?{remove:()=>{removed=true;}}:selector==='#lm-next'?(hasSkip?existing:null):{after:node=>{placed=node;}}};
  placeQuestionSkip(section);
  assert.equal(removed,true);
  assert.equal(placed.textContent,'Skip question');
  assert.equal(placed.id,'lm-next');
  assert.equal(placed.type,'button');
  if(hasSkip)assert.equal(placed,existing);
  placeQuestionSkip(section,'action');
  assert.equal(placed.textContent,'Next question');
 }
});
test('outcome deletion removes its branch and links, not linked task records',()=>{
 const task={id:'task'};
 const data={concerns:[{id:'a',parent:'home'},{id:'b',parent:'a'},{id:'c',parent:'home'}],answers:{a:{notes:'note'},b:{status:'progress'},c:{status:'done'}},links:{a:['task:'+task.id],b:['person:p'],c:['task:other']}};
 assert.equal(removeCustomOutcome(data,'home'),false);
 assert.equal(removeCustomOutcome(data,'a'),true);
 assert.deepEqual(data.concerns.map(topic=>topic.id),['c']);
 assert.deepEqual(Object.keys(data.answers),['c']);
 assert.deepEqual(Object.keys(data.links),['c']);
 assert.equal(task.id,'task');
});
test('breadcrumb includes every ancestor and the current topic',()=>{
 assert.deepEqual(topicPath('detail',topics).map(topic=>topic.id),['home','repair','detail']);
 assert.deepEqual(topicPath('home',topics).map(topic=>topic.id),['home']);
 assert.deepEqual(topicPath('missing',topics),[]);
 assert.equal(topicPath('a',[{id:'a',parent:'b'},{id:'b',parent:'a'}]).length,2);
});
test('chooses unanswered questions, excluding skips and context-dependent branches',()=>{
 assert.deepEqual(interviewCandidates(topics.map(topic=>topic.id==='repair'?{...topic,isOutcome:true}:topic),{repair:{status:'done'}},['clutter','group','discovery']),[]);
 assert.equal(pickInterviewQuestion(topics,{},[],()=>0).id,'repair');
 assert.equal(pickInterviewQuestion(topics,{},[],()=>0.99).id,'discovery');
 assert.equal(pickInterviewQuestion(topics,{home:{status:'irrelevant'}}),null);
});
test('unfinished groups and deferred topics remain eligible and skipping does not change answers',()=>{
 const answers={repair:{status:'progress'},clutter:{status:'defer'}};
 assert.equal(pickInterviewQuestion(topics,answers,[],()=>0).id,'repair');
 assert.equal(pickInterviewQuestion(topics,answers,['repair','detail','group','discovery'],()=>0).id,'clutter');
 assert.deepEqual(answers,{repair:{status:'progress'},clutter:{status:'defer'}});
});
test('a new life map has questions available without pre-existing outcomes',()=>{
 const assembled=assembleTopics(baseTopics,discoveryTopics(),{answers:{},concerns:[]});
 assert.ok(interviewCandidates(assembled,{}).length>10);
});
test('old review timestamps do not suppress unanswered topics',()=>{
 assert.equal(pickInterviewQuestion(topics,{repair:{reviewedAt:'2026-10-13'}},[],()=>0).id,'repair');
});
test('nested review markers identify the branch, independently of completion',()=>{
 const branch=[{id:'health'},{id:'appointments',parent:'health'},{id:'dentist',parent:'appointments'},{id:'sleep',parent:'health'}];
 const answers={dentist:{status:'progress'}};
 assert.equal(topicReviewState('appointments',branch,answers).key,'reviewed');
 assert.equal(topicReviewState('health',branch,answers).key,'partial');
 assert.match(topicReviewState('health',branch,answers).label,/1 topic/);
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
