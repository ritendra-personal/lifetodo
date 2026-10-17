import {expandDiscovery,assembleTopics} from './life-map-discovery.js?v=1.14.62';
import {concreteAction} from './life-map-actions.js?v=1.14.63';
import {priorityItems,renderPriorityView,setOutcomeStatus,setOutcomeUrgency,urgencyChoices} from './life-map-priorities.js?v=1.14.69';
import {createTopicExclusionResolver,reopenTopicInterest} from './life-map-review.js?v=1.14.44';
import {buildLifeGraph,buildOutcomeTaskGraph,graphMarkup,bindGraph} from './life-map-graph.js?v=1.14.44';
export function linkCandidates(records,type,linked=[],query='') {
 const needle=query.trim().toLocaleLowerCase();
 return records.filter(([kind,item])=>kind===type && !(type==='task'&&item.parent_id) && !linked.includes(`${type}:${item.id}`) && labelFor(item).toLocaleLowerCase().includes(needle)).sort((a,b)=>labelFor(a[1]).localeCompare(labelFor(b[1])));
}
export const baseTopics = [
 ['home','Home and everyday life','Home','How well is your home supporting everyday life?','Identify the home issue causing the most friction and one practical next step.'],
 ['money','Financial wellbeing','Finances','How confident do you feel about your financial responsibilities and plans?','Identify one financial question or responsibility that needs attention.'],
 ['health','Health and wellbeing','Health','How well are your health needs and everyday wellbeing being looked after?','Identify one health need or routine you want to address.'],
 ['relationships','Relationships and belonging','Relationships','Are your important relationships getting the attention you want to give them?','Choose one relationship you would like to give attention to.'],
 ['care','Care and responsibilities','People depending on you','Are the responsibilities you carry for other people manageable and covered?','Identify one responsibility that needs support, sharing, or a next step.'],
 ['admin','Life administration','Life admin','Are your paperwork, renewals, and practical arrangements under control?','Identify one administrative issue and clarify its next step.'],
 ['creative','Creative life','Creative ambitions','Are your creative ambitions moving forward in a way that feels meaningful?','Choose one creative outcome and define a small next milestone.'],
 ['growth','Personal growth','Learning and growth','Is there something you want to become better at or explore?','Choose a small experiment toward something you want to learn.'],
 ['future','Long-term security','Future planning','Are there future risks or major life decisions you want to prepare for?','Identify one unresolved future decision and the information you need.'],
 ['rest','Rest and enjoyment','Rest and enjoyment','Do you have enough space for rest and things you enjoy?','Identify one commitment to reduce or one enjoyable activity to make room for.'],
 ['community','Community and contribution','Community','Does your involvement in community or causes feel right for you?','Identify whether you want to contribute more, less, or differently.'],
 ['experiences','Experiences and possibilities','Experiences','Are there experiences or changes you keep hoping to make time for?','Choose one possibility worth exploring without committing to it yet.'],
 ['career','Work and career','Work and career','If work is part of your life, does your current direction and working life fit what you want?','Identify one work-related responsibility, change, or possibility you want to review.']
].map(([id,area,title,question,action])=>({id,area,title,question,action}));
export const probes={
 home:['Repairs, maintenance, or safety','Clutter, cleaning, or possessions','Meals, groceries, and household routines','Housing, rent, or an upcoming move','Transport, vehicle upkeep, and getting around','Pets and animal care'],
 money:['Bills, taxes, or renewals','Savings and a financial buffer','Debt and ongoing commitments','Insurance and financial protection','Longer-term plans and retirement','Subscriptions or spending I want to review'],
 health:['Appointments, dental care, or follow-ups','Sleep, energy, and recovery','Movement, nutrition, and everyday habits','Emotional wellbeing and support','Ongoing care, medication routines, or accessibility','A health concern I have been postponing'],
 relationships:['People I want to reconnect with','Time with my partner, family, or friends','An unresolved conversation or repair','Boundaries and relationships that drain me','Loneliness or finding connection','Grief, loss, or changing relationships'],
 care:['Children, parents, or other dependents','Sharing the caring and household load','School, care, or support arrangements','Upcoming family commitments','Backup care and emergency contacts','My own limits and support needs'],
 admin:['Identity documents, renewals, or applications','Travel permissions and practical arrangements','Unfinished paperwork or official correspondence','Passwords, account recovery, and digital security','Backups, photos, and important records','Appointments, bookings, or things I am waiting on'],
 creative:['An idea I want to develop','A project or performance to finish','A deadline, collaborator, or commitment','A creative practice to maintain','Sharing or publishing my work','Deciding what to pause or stop'],
 growth:['A skill or subject I want to learn','A habit I want to develop','Education or a personal qualification','Confidence, values, or personal direction','A small experiment to explore an interest','Something I no longer want to pursue'],
 future:['Long-term personal and family arrangements','Preparing for dependents or changing care needs','A move, family change, or major transition','Emergency readiness and important instructions','A major decision I have been avoiding','What I want the next chapter of life to look like'],
 rest:['Too many commitments or not enough downtime','Time to recharge without feeling guilty','Play, hobbies, and enjoyable activities','Boundaries around screens and availability','A break or holiday I want to plan','Something to simplify, delegate, or stop'],
 community:['Friends, groups, and local belonging','Volunteering, causes, or civic commitments','Faith, cultural life, or spiritual practices','Promises I have made to a group','Contributing in a sustainable way','Reducing involvement that no longer fits'],
 experiences:['Places I would like to visit','An experience or adventure to make possible','A lifestyle change I want to explore','A celebration or meaningful occasion','An idea for someday','Making time with people part of the experience'],
 career:['Your working life','Responsibilities and working boundaries','Opportunities and work transitions','Pay, benefits, and work arrangements']
};
export function suggestedAction(topic, answer={}) {
 return concreteAction(topic,answer);
}
export const statuses={unstarted:'Not started / needs attention',stuck:'Started, but stuck',progress:'In progress',well:'Working well / in place',review:'Needs updating',unsure:'Not sure',irrelevant:'Not relevant',uninterested:'Not of interest',defer:'Not now',done:'Completed'};
export function recommendation(topic,answer={}){
 if(!answer.status||['well','irrelevant','uninterested','defer','done'].includes(answer.status))return null;
 const reason=answer.deadline?`Deadline: ${answer.deadline}`:answer.timing==='day'?'You want to address this within a day':['soon','week'].includes(answer.timing)?'You want to address this within a week':answer.timing==='month'?'You want progress within a month':answer.timing==='quarter'?'You want progress within three months':answer.timing==='year'?'You want progress within a year':answer.timing==='two-years'?'You want progress within two years':answer.timing==='someday'?'Longer term, with no fixed deadline':answer.timing==='decade'?'You want progress within a decade':answer.status==='stuck'?'A blocked next step needs clarification':answer.impact==='high'?'You said this protects something important':'Timing still needs clarification';
 const days=answer.deadline?Math.ceil((Date.parse(answer.deadline+'T12:00:00')-Date.now())/86400000):Infinity;
 const score=(days<=7?100:days<=30?60:0)+(({day:60,soon:40,week:40,month:20,quarter:10,year:5,'two-years':1,someday:0,decade:1}[answer.timing]||0))+(answer.status==='stuck'?10:0)+(answer.impact==='high'?25:answer.impact==='medium'?10:0);
 return {topic,answer,score,reason,action:suggestedAction(topic,answer)};
}
export function branchStats(id, topics, answers, links, tasks) {
 const ids=new Set([id]); let changed=true;
 while(changed){changed=false;for(const topic of topics)if(ids.has(topic.parent)&&!ids.has(topic.id)){ids.add(topic.id);changed=true;}}
 const refs=new Set([...ids].flatMap(key=>links[key]||[]).filter(ref=>ref.startsWith('task:')).map(ref=>ref.slice(5)));
 const allRefs=new Set([...ids].flatMap(key=>links[key]||[]));
 const linked=tasks.filter(task=>refs.has(task.id)||allRefs.has('project:'+task.project_id)||(task.goal_ids||[task.goal_id]).some(goal=>allRefs.has('goal:'+goal)));
 return {tasks:linked,topics:topics.filter(topic=>ids.has(topic.id)), total:linked.length,done:linked.filter(task=>task.status==='done').length,attention:[...ids].filter(key=>['unstarted','stuck','review'].includes(answers[key]?.status)).length};
}

// Specific reminders are possibilities to review, never assumed obligations.
const reminders = {
 home: [
  ['Repairs and safety','Is there a repair, leak, broken appliance, or safety issue at home that needs attention?','List the most pressing home repair and arrange the next step.'],
  ['Home organization','Is there a space or pile of possessions that keeps making daily life harder?','Choose one small area to clear or organize.'],
  ['Household routines','Are groceries, meals, cleaning, and laundry manageable right now?','Choose one household routine to simplify or share.'],
  ['Housing arrangements','Is a lease, housing decision, or move coming up?','Check the next date or decision for your housing arrangements.'],
  ['Transport','Is vehicle maintenance, registration, or another transport arrangement due?','Check your next transport-related renewal or maintenance need.'],
  ['Pets','If you care for pets, are their care and backup arrangements covered?','Identify the next pet-care need or backup arrangement.']
 ],
 money: [
  ['Bills and taxes','Are any bills, tax paperwork, or financial deadlines still unresolved?','List the unresolved financial deadline and the next step.'],
  ['Financial buffer','Are you comfortable with the savings available for unexpected expenses?','Review what financial buffer would feel adequate for your circumstances.'],
  ['Debt and commitments','Is there a debt, payment plan, or ongoing commitment you want to review?','Gather the details of one financial commitment to review.'],
  ['Insurance','Are there changes in your life that make your existing insurance worth reviewing?','List recent changes to discuss with your insurance provider.'],
  ['Longer-term plans','Do you have a financial goal or retirement question you have been putting off?','Write down the question you want to resolve about your longer-term finances.'],
  ['Subscriptions','Are you paying for subscriptions or services you no longer want?','Review recurring charges and identify one you no longer need.'],
  ['Everyday money management','Is there anything about cash flow, banking, or managing money that you want to review?','Choose one money-management question and gather the information you need.'],
  ['Investments and financial choices','If investing is relevant to you, is there a decision or arrangement you want to review?','Write down the investment question and decide whether you want qualified advice.']
 ],
 health: [
  ['Appointments','Is there a medical, dental, vision, or other appointment you have been meaning to arrange?','Find the contact information and arrange the outstanding appointment.'],
  ['Follow-ups','Is there a recommended follow-up, result, or care instruction you still need to act on?','Review the follow-up instructions and contact your care team if unclear.'],
  ['Daily wellbeing','Is sleep, food, movement, or energy making daily life difficult?','Choose one manageable wellbeing change or source of support.'],
  ['Emotional support','Do you have enough support for how you have been feeling?','Identify one person or service you would feel comfortable asking for support.'],
  ['Ongoing care','Are ongoing care routines, supplies, and accessibility needs manageable?','Identify one care routine or supply that needs attention.'],
  ['Postponed concerns','Is there a health concern you keep postponing or are unsure how to address?','Write down the concern to discuss with an appropriate health professional.']
 ],
 relationships: [
  ['Staying in touch','Is there someone you want to reconnect with but keep putting it off?','Choose a person and send a message suggesting time to catch up.'],
  ['Time together','Are you making the time you want with the people closest to you?','Choose a small shared activity or time to spend together.'],
  ['Unfinished conversations','Is there an apology, thank-you, or important conversation you want to have?','Write down what you want to communicate and choose a good time.'],
  ['Boundaries','Is a relationship asking more of you than you can comfortably give?','Identify a boundary you would like to communicate.'],
  ['New connections','Would you like more friendship, companionship, or a sense of belonging?','Choose one low-pressure opportunity to connect with people.'],
  ['Life changes','Has a loss or change affected a relationship or the support you need?','Identify the kind of support or connection that would help now.']
 ],
 admin: [
  ['Identity and travel documents','Would you like to check your identity and travel documents?','Review your identity and travel document needs.','documents'],
  ['Outstanding paperwork','Is there a form, application, or official letter you have been putting off?','Find the outstanding paperwork and identify its next step.'],
  ['Digital security','Are account recovery, important passwords, and device access arranged the way you want?','Review recovery access for one important account.'],
  ['Records and backups','Can you find important documents and recover important files if a device is lost?','Choose one set of important records to organize or back up.'],
  ['Bookings and follow-ups','Is there an appointment, booking, refund, or response you are waiting on?','Check the status of one outstanding request.'],
  ['Recurring renewals','Are there recurring renewals you tend to remember at the last minute?','Record the next known renewal date.'],
  ['Legal matters and agreements','Is there an agreement, legal matter, or rights-related question you want to clarify?','Gather the relevant documents and identify whether qualified legal help would be useful.']
 ]
};
export const supportKinds={
 housing:{label:'Home or housing',hint:'For example: a move, repairs, or selling a home',action:name=>`Talk with ${name} about the desired outcome, timing, and the help they want with housing.`},
 career:{label:'Job search or learning',hint:'For example: choosing a direction, applications, or training',action:name=>`Agree with ${name} on their job or learning goal and one useful next step.`},
 care:{label:'Health or everyday care',hint:'For example: appointments, transport, or daily routines',action:name=>`Ask ${name} what practical support would help most and agree on the next step.`},
 paperwork:{label:'Paperwork or finances',hint:'For example: an application, documents, or organizing bills',action:name=>`Identify the specific paperwork or financial task ${name} wants help with and its next deadline.`},
 connection:{label:'Emotional support or connection',hint:'For example: listening, checking in, or spending time together',action:name=>`Arrange time with ${name} and ask what kind of support would feel helpful.`},
 other:{label:'Something else',hint:'Describe the outcome in your own words',action:name=>`Agree with ${name} on the first useful step and who will do it.`}
};
export function supportOutcome({id,parent,area,personId,personName,kind,title}){
 return {id,parent,area,title,personId:personId||null,personName,supportKind:kind,question:`Where are you with “${title}”?`,action:(supportKinds[kind]||supportKinds.other).action(personName)};
}
const documentReminders = [
 ['passport','Passport','If you use a passport, is it current and suitable for your planned travel?','Check the passport details and any trip-specific requirements.'],
 ['real-id','REAL ID (United States, if applicable)','If a United States REAL ID is relevant to your circumstances, do you want to arrange or review it?','Check the official issuing agency’s REAL ID application guidance.'],
 ['oci','OCI card (India, if applicable)','If overseas ties to India are relevant to you, is an OCI card something you want to arrange or update?','Check official OCI guidance to establish which application, if any, fits your circumstances.'],
 ['residency','Other residency or travel documents','Is there another citizenship, residency, visa, or travel document you need to arrange?','Identify the document and check the relevant official guidance.'],
 ['family-documents','Family documents','Are identity or travel documents for anyone you help care for taken care of?','Check whether someone you support needs help with an upcoming document.']
];
export function discoveryTopics(){
 const items=[];
 for(const area of baseTopics){
  const rows=reminders[area.id]||probes[area.id].map(label=>[label,`Is “${label.toLowerCase()}” something you would like to address, or is it already taken care of?`,`Identify one manageable next step for ${label.toLowerCase()}.`]);
  rows.forEach(([title,question,action,group],index)=>{
   const id=`check:${area.id}:${group||index}`;
   items.push(area.id==='care'&&index===0
    ?{id,parent:area.id,area:area.area,title:'People you want to support',question:'Does someone close to you need your help with something?',kind:'support-discovery'}
    :{id,parent:area.id,area:area.area,title,question,action,group,...(area.id==='growth'?{kind:'learning-discovery'}:area.id==='relationships'&&index<4?{kind:'relationship-discovery'}:{})});
   if(group==='documents')for(const [slug,title,question,action] of documentReminders)items.push({id:`check:admin:${slug}`,parent:id,area:area.area,title,question,action});
  });
 }
 const learning=items.find(t=>t.id==='check:growth:0');
 Object.assign(learning,{title:'Learn a skill or subject',kind:null,group:'learning',question:'What would you like to explore?'});
 const categories={arts:['Dance','Singing','An instrument','Drawing and painting','Photography','Writing','Acting'],academic:['History','Science','Mathematics','Literature','Philosophy'],languages:['A new language','Improve a language I know'],practical:['Cooking','Gardening','Technology','Home repairs','Personal finance']};
 const labels={arts:'Arts',academic:'Academic subjects',languages:'Languages',practical:'Practical skills'};
 for(const [category,subjects] of Object.entries(categories)){
  const parent='learn:'+category;
  items.push({id:parent,parent:learning.id,area:learning.area,title:labels[category],group:'learning',question:'What interests you?'});
  for(const subject of subjects)items.push({id:parent+':'+subject.toLowerCase().replaceAll(' ','-'),parent,area:learning.area,title:subject,kind:'learning-choice',question:`What would you like to do with ${subject.toLowerCase()}?`});
 }
 items.push({id:'check:creative:milestone',parent:'creative',area:baseTopics.find(t=>t.id==='creative').area,title:'Achieve a creative milestone',kind:'milestone-discovery'});
 const ongoing=items.find(t=>t.id==='check:health:4');Object.assign(ongoing,{group:'care',question:'Which condition or care need would you like to organize?'});
 for(const [slug,title] of [['diabetes','Diabetes'],['heart','Heart or blood pressure care'],['breathing','Asthma or breathing care'],['pain','Pain or mobility'],['vision','Vision or hearing care'],['digestive','Digestive care'],['skin','Skin care'],['neurological','Neurological care'],['reproductive','Reproductive or hormonal care'],['accessibility','Accessibility and daily assistance'],['other','Another condition or care need']]){
  const parent='care:'+slug;items.push({id:parent,parent:ongoing.id,area:ongoing.area,title,group:'care',question:'Which part needs attention?'});
  const needs=slug==='diabetes'?['Glucose monitoring','Medication routine','Supplies and refills','Appointments and tests','Questions for my care team','Something else']:['Monitoring or equipment','Medication routine','Supplies and refills','Appointments and follow-ups','Everyday support or accessibility','Something else'];
  needs.forEach((need,index)=>items.push({id:parent+':'+index,parent,area:ongoing.area,title:need,kind:'care-outcome'}));
 }
 return expandDiscovery(items).map(item=>({...item,suggested:true}));
}
export function coverageStats(id,topics,answers){
 const branch=branchStats(id,topics,answers,{},[]).topics.filter(t=>t.id!==id&&!t.group&&!t.kind);
 return {reviewed:branch.filter(t=>answers[t.id]?.status||answers[t.id]?.reviewedAt).length,complete:branch.filter(t=>['well','done'].includes(answers[t.id]?.status)).length,notRelevant:branch.filter(t=>answers[t.id]?.status==='irrelevant').length,total:branch.length};
}
export function topicReviewState(id,topics,answers={}) {
 if(createTopicExclusionResolver(topics,answers)(id))return {key:'uninterested',label:'Not of interest · Reviewed',reviewed:1,total:1};
 const ids=new Set([id]);let changed=true;
 while(changed){changed=false;for(const topic of topics)if(ids.has(topic.parent)&&!ids.has(topic.id)){ids.add(topic.id);changed=true;}}
 const branch=topics.filter(topic=>ids.has(topic.id));
 const reviewed=branch.filter(topic=>answers[topic.id]?.reviewedAt||answers[topic.id]?.status).length;
 const own=Boolean(answers[id]?.reviewedAt||answers[id]?.status);
 if(!reviewed)return {key:'unreviewed',label:'Not reviewed',reviewed:0,total:branch.length};
 if(reviewed===branch.length)return {key:'reviewed',label:'Reviewed',reviewed,total:branch.length};
 return {key:'partial',label:own&&reviewed===1?'Reviewed · subtopics not reviewed':`Partially reviewed · ${reviewed} topic${reviewed===1?'':'s'}`,reviewed,total:branch.length};
}
export function topicSecondaryStatus(id,topics,answers={}){
 if(createTopicExclusionResolver(topics,answers)(id))return '';
 return statuses[answers[id]?.status]||'';
}
export function orderTopicsByReview(items,topics,answers={}){
 const rank={unreviewed:0,partial:0,reviewed:1,uninterested:2};
 return items.map((topic,index)=>({topic,index,rank:rank[topicReviewState(topic.id,topics,answers).key]??0}))
  .sort((a,b)=>a.rank-b.rank||a.index-b.index).map(item=>item.topic);
}
export function hasFallbackChoice(children){
 return children.some(topic=>/^something else$/i.test(topic.title.trim()));
}
export function outcomeMenuChildren(parent,topics){
 const result=[],seen=new Set();
 function visit(id){
  if(seen.has(id))return;seen.add(id);
  for(const topic of topics.filter(item=>item.parent===id)){
   if(topic.suggested&&hasFallbackChoice([topic]))visit(topic.id);
   else result.push(topic);
  }
 }
 visit(parent);return result;
}
export function topicPath(id,topics){
 const byId=new Map(topics.map(topic=>[topic.id,topic])),path=[],seen=new Set();let current=byId.get(id);
 while(current&&!seen.has(current.id)){seen.add(current.id);path.unshift(current);current=byId.get(current.parent);}
 return path;
}
export function nextReviewTopic(id,topics,answers={}){
 return topics.find(topic=>topic.parent===id&&['unreviewed','partial'].includes(topicReviewState(topic.id,topics,answers).key))||null;
}
export function nextGuidedTopic(id,topics,answers={}){
 const current=topics.find(topic=>topic.id===id);if(!current)return null;
 const excluded=createTopicExclusionResolver(topics,answers);
 let parent=topics.find(topic=>topic.id===current.parent);const seen=new Set();
 while(parent&&excluded(parent.id)&&!seen.has(parent.id)){seen.add(parent.id);parent=topics.find(topic=>topic.id===parent.parent);}
 if(topics.find(topic=>topic.id===current.parent)?.kind?.endsWith('discovery'))return parent||null;
 const siblings=topics.filter(topic=>topic.parent===current.parent&&!topic.group);
 const index=siblings.findIndex(topic=>topic.id===id);
 return [...siblings.slice(index+1),...siblings.slice(0,index)].find(topic=>!excluded(topic.id)&&!answers[topic.id]?.status&&!answers[topic.id]?.reviewedAt)||parent||null;
}
export function removeCustomOutcome(map,id){
 if(!map.concerns.some(topic=>topic.id===id))return false;
 const ids=new Set([id]);let changed=true;
 while(changed){changed=false;for(const topic of map.concerns)if(ids.has(topic.parent)&&!ids.has(topic.id)){ids.add(topic.id);changed=true;}}
 map.concerns=map.concerns.filter(topic=>!ids.has(topic.id));
 for(const key of ids){delete map.answers[key];delete map.links[key];}
 return true;
}
export function interviewCandidates(topics,answers={},skipped=[]) {
 const byId=new Map(topics.map(topic=>[topic.id,topic])),excluded=new Set(skipped);
 const isExcluded=createTopicExclusionResolver(topics,answers);
 return topics.filter(topic=>{
  if(!topic.parent||answers[topic.id]?.status||answers[topic.id]?.reviewedAt||excluded.has(topic.id)||isExcluded(topic.id))return false;
  const directAreaChild=!byId.get(topic.parent)?.parent;
  if((topic.group||topic.kind)&&!directAreaChild)return false;
  let parent=byId.get(topic.parent);const seen=new Set([topic.id]);
  while(parent){
   if(seen.has(parent.id))return false;seen.add(parent.id);
   if(['irrelevant','uninterested','defer','done','well'].includes(answers[parent.id]?.status))return false;
   // Detailed branches require context established by the guided review.
   if(parent.parent&&(parent.group||parent.kind)&&!topics.some(child=>child.parent===parent.id&&answers[child.id]?.status))return false;
   parent=byId.get(parent.parent);
  }
  return true;
 });
}
export function pickInterviewQuestion(topics,answers,skipped=[],random=Math.random) {
 const candidates=interviewCandidates(topics,answers,skipped);
 return candidates.length?candidates[Math.min(candidates.length-1,Math.floor(random()*candidates.length))]:null;
}
export function mapState(topic,answer={},tasks=[],now=Date.now()){
 if(answer.status==='uninterested')return {key:'inactive',label:'Not of interest'};
 if(['done','well'].includes(answer.status))return {key:'complete',label:'Taken care of'};
 if(answer.status==='irrelevant')return {key:'inactive',label:'Not relevant'};
 const deadline=answer.deadline?Date.parse(answer.deadline+'T23:59:59'):NaN;
 if((Number.isFinite(deadline)&&deadline<now)||tasks.some(t=>t.status!=='done'&&t.due_date&&Date.parse(t.due_date+'T23:59:59')<now))return {key:'attention',label:'Overdue'};
 if(answer.status==='stuck')return {key:'attention',label:'Blocked'};
 if(['unstarted','review','unsure'].includes(answer.status))return {key:'attention',label:answer.status==='unsure'?'Needs clarification':'Needs attention'};
 if(answer.status==='defer')return {key:'inactive',label:'Later'};
 if(answer.status==='progress')return {key:'progress',label:'In progress'};
 if(tasks.length)return {key:'planned',label:tasks.every(t=>t.status==='done')?'Actions done · review outcome':'Actions planned'};
 return {key:'unknown',label:'Not reviewed'};
}
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function outcomeEntryMarkup(){
 return '<section class="lm-add-outcome" aria-label="Add an outcome"><h4>Add an outcome</h4><form id="lm-custom"><label>Outcome<input name="title" required maxlength="200" placeholder="What result would you like to achieve?"></label><button type="submit">Add outcome</button></form></section>';
}
export function taskEntryMarkup(current,tasks,suggestion='',overview=false){
 const already=tasks.some(task=>task.title===suggestion);
 return `${overview?'':`<h3>${esc(current.title)}</h3>`}<form id="lm-create"><label>Task<input name="title" required maxlength="300" value="${esc(already?'':suggestion)}" placeholder="What will you do next?"></label><button class="lm-primary">Add task</button></form>${tasks.length?`<section class="lm-added-tasks" aria-label="Tasks for this outcome"><h4>Tasks (${tasks.length})</h4><ol>${tasks.map(task=>`<li><a data-open-task="${esc(task.id)}" href="?view=focus-task&id=${encodeURIComponent(task.id)}">${esc(task.title)}</a>${task.status==='done'?' <small>Completed</small>':''}</li>`).join('')}</ol></section>`:''}${overview?'':'<button class="lm-next-prompt" id="lm-next">Next question →</button>'}`;
}
let supportDraft={};
let loadedKey='',data={answers:{},links:{},concerns:[]},notice='',loading=false;
let selected='admin',panel='map',step='question',saveQueue=Promise.resolve();
export function placeQuestionSkip(section,step='question'){
 section.querySelector('#lm-guide')?.remove();
 const existing=section.querySelector('#lm-next');
 const skip=existing||section.ownerDocument.createElement('button');
 skip.id='lm-next';
 skip.type='button';
 skip.className='lm-next-prompt';
 skip.textContent=step==='action'?'Next question':'Skip question';
 section.querySelector('h3')?.after(skip);
}
let interviewSkipped=[];
export function lifeMapPanelFromHash(hash){
 return ({'#ask-me':'interview','#guided-review':'explore','#my-map':'map','#priorities':'priorities'})[hash]||'map';
}
let lastPanelHash=null;
let renderForHash;
if(typeof window!=='undefined'){
 window.addEventListener('hashchange',()=>renderForHash?.());
 window.addEventListener('popstate',()=>renderForHash?.());
}
let mapInterestFilter='active';
let mapHideCompleted=false;
const labelFor=(item)=>item?.title||item?.name||[item?.first_name,item?.last_name].filter(Boolean).join(' ')||'Unavailable record';

export function renderLifeMap(root,api){
 renderForHash=()=>{if(root.isConnected)api.render();};
 const key='seven-lives-map:'+api.userKey;
 if(loadedKey!==key){
  loadedKey=key;supportDraft={};selected='admin';panel='map';step='question';interviewSkipped=[];mapInterestFilter='active';mapHideCompleted=false;lastPanelHash=null;
  try{data=JSON.parse(localStorage.getItem(key))||{answers:{},links:{},concerns:[]};}catch{data={answers:{},links:{},concerns:[]};}
  notice='Saved in this browser.';
  if(api.client&&api.userId){loading=true;api.client.from('planner_life_map').select('data').eq('user_id',api.userId).maybeSingle().then(({data:row,error})=>{
   if(loadedKey!==key)return;
   if(!error&&row?.data)data=row.data;
   notice=error?'Cloud unavailable; changes will also be kept in this browser.':'Connected to your account.';loading=false;api.render();
  }).catch(()=>{if(loadedKey===key){loading=false;notice='Cloud unavailable; browser storage is available.';api.render();}});}
 }
 data.answers ||= {};data.links ||= {};data.concerns ||= [];
 const topics=assembleTopics(baseTopics,discoveryTopics(),data);
 const panelHash=window.location.hash;
 if(panelHash!==lastPanelHash){
  lastPanelHash=panelHash;panel=lifeMapPanelFromHash(panelHash);step='question';
  if(panel==='interview'){interviewSkipped=[];selected=pickInterviewQuestion(topics,data.answers)?.id||'interview-empty';interviewSkipped.push(selected);}
 }
 if(selected.startsWith('discover:')&&!topics.some(topic=>topic.id===selected)&&topics.some(topic=>topic.id===selected.slice(9)))selected=selected.slice(9);
 const excludedTopic=createTopicExclusionResolver(topics,data.answers);
 if(panel==='interview'&&excludedTopic(selected)){selected=pickInterviewQuestion(topics,data.answers,interviewSkipped)?.id||'interview-empty';step='question';}
 for(const topic of topics){if(topic.parent==='check:relationships:0'&&/^(Arrange a call|Send a message|Meet up) — /.test(topic.title)){topic.action=topic.action||topic.title;topic.title=`Stay connected with ${topic.personName||topic.title.split(' — ').slice(1).join(' — ')}`;topic.question=`Where are you with “${topic.title}”?`;}}
 const current=topics.find(t=>t.id===selected)||baseTopics[0];
 let area=current;const seen=new Set();while(area.parent&&!seen.has(area.id)){seen.add(area.id);area=topics.find(t=>t.id===area.parent)||area;}
 const answer=data.answers[current.id]||{};
 const exclusion=excludedTopic(current.id);
 const isArea=baseTopics.some(t=>t.id===current.id);
 const allChildren=orderTopicsByReview(outcomeMenuChildren(current.id,topics),topics,data.answers);
 const excludedChildren=allChildren.filter(topic=>excludedTopic(topic.id));
 const children=allChildren.filter(topic=>!excludedTopic(topic.id));
 const branch=branchStats(area.id,topics,data.answers,data.links,api.tasks);
 const coverage=coverageStats(area.id,topics,data.answers);
 const records=[...api.tasks.map(x=>['task',x]),...api.projects.map(x=>['project',x]),...(api.people||[]).map(x=>['person',x])];
 if(panel==='priorities'){
  const model=priorityItems(topics,data),changed=JSON.stringify(model.order)!==JSON.stringify(data.priorityOrder||[]);
  if(!loading)data.priorityOrder=model.order;
  renderPriorityView(root,{topics,data,tasks:api.tasks,notice:loading?'Loading…':notice,save:()=>save(false),openOutcome:go,openTask:api.openTask,changePanel});
  if(loading)root.querySelectorAll('[data-priority-status],[data-priority-move],[data-priority-drag],[data-priority-sort],[data-priority-timing],[data-priority-deadline]').forEach(button=>{button.disabled=true;button.draggable=false;});
  if(changed&&!loading)void save(false);
  return;
 }
 function suggestion(topic){
  if(topicReviewState(topic.id,topics,data.answers).key==='uninterested')return null;
  const a=data.answers[topic.id]||{};const r=recommendation(topic,a);if(!r)return null;
  const people=records.filter(([type,item])=>type==='person'&&(data.links[topic.id]||[]).includes('person:'+item.id)).map(([,item])=>labelFor(item));
  if(people.length&&a.support==='person'&&!a.next)r.action=`Message ${people.join(', ')} to arrange a time to discuss: ${topic.title}`;
  return r;
 }
 function reviewMarker(topic){
  const review=topicReviewState(topic.id,topics,data.answers);
  return `<span class="lm-review-badge lm-review-${review.key}">${esc(review.label)}</span>`;
 }
 const recs=topics.filter(t=>t.parent&&!t.group&&!t.kind).map(suggestion).filter(Boolean).sort((a,b)=>b.score-a.score);
 function linkPicker(type,id){
  const names={person:['People involved','Search people','Link person'],project:['Supporting projects','Search projects','Link project'],task:['Link existing task','Search top-level tasks','Link task']};
  const [heading,searchLabel]=names[type];
  const linked=(data.links[id]||[]).filter(ref=>ref.startsWith(type+':'));
  const selected=type==='task'?'':linked.map(ref=>{const record=records.find(([kind,item])=>ref===kind+':'+item.id);return `<li>${esc(record?labelFor(record[1]):'Unavailable record')} <button data-unlink="${esc(ref)}" data-link-outcome="${esc(id)}">Unlink</button></li>`;}).join('');
  return `<details class="lm-secondary lm-link-picker" data-link-type="${type}" data-link-outcome="${esc(id)}"><summary>${heading}${linked.length?' ('+linked.length+')':''}</summary>${selected?`<ul>${selected}</ul>`:''}<label>${searchLabel}<input type="search" data-link-search autocomplete="off" placeholder="Type a name or title"></label><div data-link-results role="status"><p class="lm-subtle">Type to find ${type==='person'?'a person':type==='project'?'a project':'an existing top-level task'}.</p></div></details>`;
 }
 const linksMarkup=!isArea&&!current.group&&!current.kind?`<div class="lm-connections">${linkPicker('person',current.id)}${linkPicker('project',current.id)}</div>`:'';

 const notesMarkup=`<details class="lm-secondary"><summary>Add a note</summary><form id="lm-note"><label>Note<textarea name="notes" rows="3">${esc(answer.notes||'')}</textarea></label><button>Save note</button></form></details>`;
 const addMarkup=outcomeEntryMarkup();
 function outcomeList(items,expanded=false){if(!expanded)return items.length?`<h4>Outcomes</h4>${items.map(topic=>{const count=(data.links[topic.id]||[]).filter(ref=>ref.startsWith('task:')).length;return `<button class="lm-review-row" data-go="${esc(topic.id)}"><strong>${esc(topic.title)}</strong><span class="lm-topic-review">${reviewMarker(topic)}<small>${esc(statuses[data.answers[topic.id]?.status]||'Status not set')} · ${count} task${count===1?'':'s'}</small></span></button>`;}).join('')}`:'';return items.length?`<h4>Outcomes under this topic</h4>${items.map(t=>{const tasks=api.tasks.filter(task=>(data.links[t.id]||[]).includes('task:'+task.id));return `<div class="lm-outcome-item"><button class="lm-review-row" data-go="${esc(t.id)}"><strong>${esc(t.title)}</strong><small>Outcome · Review →</small></button>${tasks.length?`<p>Tasks — concrete actions</p>${tasks.map(task=>`<a class="lm-review-row" data-open-task="${esc(task.id)}" href="?view=focus-task&id=${encodeURIComponent(task.id)}">${esc(task.title)} — Open task</a><button data-unlink="task:${esc(task.id)}" data-link-outcome="${esc(t.id)}">Unlink task</button>`).join('')}`:`<p>No tasks yet</p>`}<details><summary>Add task</summary><form data-inline-task="${esc(t.id)}"><label>Task title<input name="title" required maxlength="300" placeholder="What concrete action will you take?"></label><button class="lm-primary">Create task</button></form></details>${linkPicker('task',t.id)}</div>`;}).join('')}`:'';}
 const nav=`<aside class="lm-area-nav">${baseTopics.map(t=>{const c=coverageStats(t.id,topics,data.answers);return `<button class="lm-topic ${panel!=='map'&&area.id===t.id?'selected':''}" data-go="${t.id}"><strong>${esc(t.title)}</strong><small>${data.answers[t.id]?.status==='uninterested'?'Not of interest · Reviewed':c.complete+' taken care of'+(c.reviewed?' · '+c.reviewed+' reviewed':'')}</small></button>`;}).join('')}</aside>`;
 const mapAreas=baseTopics.map(domain=>{
  const b=branchStats(domain.id,topics,data.answers,data.links,api.tasks);
  const outcomes=b.topics.filter(t=>t.id!==domain.id&&!t.group&&!t.kind&&(data.answers[t.id]?.status||data.concerns.some(c=>c.id===t.id)||(data.links[t.id]||[]).length));
  return {domain,branch:b,outcomes:outcomes.map(t=>{const tasks=branchStats(t.id,topics,data.answers,data.links,api.tasks).tasks;return {topic:t,tasks,state:mapState(t,data.answers[t.id],tasks)};})};
 });
 const mapped=mapAreas.flatMap(a=>a.outcomes);
 const allTasks=[...new Map(mapAreas.flatMap(a=>a.branch.tasks).map(t=>[t.id,t])).values()];
 const compactOutcome=panel!=='map'&&!isArea&&!current.kind&&!current.group&&step==='question'&&!exclusion;
 const questionDetails=compactOutcome?'':notesMarkup+linksMarkup+addMarkup;
 let content='';
 if(api.outcomeTaskGraph){
  const tree=buildOutcomeTaskGraph({topics,answers:data.answers,links:data.links,tasks:api.tasks,stateFor:mapState});
  root.innerHTML=`<div class="life-map lm-guided"><p>Leaf outcomes → tasks → subtasks. Click a task to edit it.</p>${graphMarkup(tree)}</div>`;
  bindGraph(root,tree,api.render,api.tasks);
  root.querySelectorAll('[data-go]').forEach(b=>b.onclick=()=>{selected=b.dataset.go;panel='explore';step='question';api.openOutcome();});
  root.querySelectorAll('[data-graph-task]').forEach(b=>b.onclick=()=>api.openTask(b.dataset.graphTask));
  return;
 }
 const graph=buildLifeGraph({topics,answers:data.answers,links:data.links,tasks:api.tasks,projects:api.projects,goals:api.goals,people:api.people,stateFor:mapState,interestFilter:mapInterestFilter,hideCompleted:mapHideCompleted});
 if(panel==='interview'&&selected==='interview-empty'){
  content=`<h3>No more questions in this round</h3><p>${interviewCandidates(topics,data.answers).length?'You skipped the remaining questions.':'The available questions have been reviewed. You can explore more topics in Guided review.'}</p><button id="lm-interview-restart">Start another round</button>`;
 }else if(panel==='map'){
  content=`<div class="lm-map-filters"><label class="lm-interest-filter">Show<select id="lm-interest-filter">${[['active','Active topics'],['all','All topics'],['excluded','Not interested only']].map(([value,label])=>`<option value="${value}"${value===mapInterestFilter?' selected':''}>${label}</option>`).join('')}</select></label><label class="lm-hide-completed"><input id="lm-hide-completed" type="checkbox"${mapHideCompleted?' checked':''}>Hide completed</label></div>`+graphMarkup(graph);
  }else if(current.kind==='outcome-discovery'){
  content=`<small>${esc(current.title)}</small><h3>${esc(current.outcomeQuestion||'What specific result would you like?')}</h3><form id="lm-specific-outcome"><label>Specific outcome<input name="title" required maxlength="200" value="${esc(current.preset||'')}" placeholder="${esc(current.title==='Something else'?'Name one specific result you want':'What specifically would you like for '+current.title.toLowerCase()+'?')}"></label><button class="lm-primary">Save outcome and continue</button></form><p class="lm-subtle">Add separate outcomes for separate needs. Next: progress, timing, and tasks.</p><button data-go="${esc(current.parent)}" class="lm-next-prompt">Nothing to add here right now</button>${outcomeList(children)}`;
 }else if(current.kind==='care-outcome'){
  content=`<small>${esc(topics.find(t=>t.id===current.parent)?.title)} · ${esc(current.title)}</small><h3>What specifically do you want to have in place?</h3><form id="lm-care-outcome"><label>Outcome<input name="title" required maxlength="200" placeholder="${current.title==='Glucose monitoring'?'For example: Have my glucose monitor set up and in use':'Name one specific care need or result'}"></label><button class="lm-primary">Save outcome and continue</button></form><p class="lm-subtle">Track each need separately, using the care plan agreed with your clinician.</p>${outcomeList(children)}`;
 }else if(current.kind==='milestone-discovery'){
  content=`<h3>What creative milestone would you like to reach?</h3><form id="lm-milestone"><label>Milestone<input name="title" required maxlength="200" placeholder="For example: Win an Oscar, publish a book, or hold a solo exhibition"></label><button class="lm-primary">Continue</button></form><p class="lm-subtle">An ambition can be uncertain. Connect it to projects and actions you can influence.</p>${outcomeList(children)}`;
 }else if(current.kind==='learning-choice'){
  content=`<h3>${esc(current.question)}</h3><div class="lm-answer-buttons"><button data-learning-intent="Explore">Explore it</button><button data-learning-intent="Learn">Start learning</button><button data-learning-intent="Improve">Improve my skills</button></div>${outcomeList(children)}${addMarkup}`;
 }else if(current.kind==='learning-discovery'){
  const prompts=[['What would you like to learn?','For example: Learn to dance'],['What habit would you like to develop?','For example: Read regularly'],['What qualification would you like to work toward?','Name a course or qualification'],['What would you like to feel more confident about?','Describe a change that matters to you'],['What interest would you like to try?','For example: Try pottery'],['What would you like to stop pursuing?','Name something you want to let go of']];
  const [question,placeholder]=prompts[Number(current.id.split(':').at(-1))]||prompts[0];
  content=`<h3>${question}</h3><form id="lm-learning-outcome"><label>Your goal<input name="title" required maxlength="200" placeholder="${placeholder}"></label><button class="lm-primary">Continue</button></form><p class="lm-subtle">Start with a few words. Next we’ll work out where you are and a manageable next step.</p>${children.length?`<h4>Your goals</h4>${children.map(t=>`<button class="lm-review-row" data-go="${esc(t.id)}"><strong>${esc(t.title)}</strong><small>${esc(statuses[data.answers[t.id]?.status]||'Continue →')}</small></button>`).join('')}`:''}${linksMarkup}`;
 }else if(current.kind==='relationship-discovery'){
  if(step==='relationship-action'){
   const choices=current.id.endsWith(':2')?['Have a conversation','Say thank you','Apologize','Something else']:current.id.endsWith(':3')?['Discuss a boundary','Make time for myself','Something else']:['Send a message','Arrange a call','Meet up','Something else'];
   content=`<small>${esc(supportDraft.personName)}</small><h3>How would you like to connect?</h3><div class="lm-answer-buttons">${choices.map(label=>`<button data-relationship-action="${esc(label)}">${esc(label)}</button>`).join('')}</div>${step==='relationship-custom'?'':''}`;
  }else if(step==='relationship-custom'){
   content=`<h3>What would you like to do with ${esc(supportDraft.personName)}?</h3><form id="lm-relationship-custom"><label>Outcome<input name="title" required maxlength="200"></label><button>Continue</button></form>`;
  }else{
   content=`<h3>Who is this about?</h3><form id="lm-relationship-person"><label>Choose an existing person<select name="personId"><option value="">Choose a person…</option>${(api.people||[]).map(p=>`<option value="${esc(p.id)}">${esc(labelFor(p))}</option>`).join('')}</select></label><fieldset><legend>Or create a person</legend><label>First name<input name="firstName" maxlength="120"></label><label>Last name (optional)<input name="lastName" maxlength="120"></label></fieldset><p class="lm-subtle">Continue creates a People record. You can add other details in People later.</p><button class="lm-primary">Continue</button></form>${outcomeList(children)}<button id="lm-next">Skip for now</button>`;
  }
 }else if(current.kind==='support-discovery'){
  const outcomes=children.filter(t=>!t.kind);
  if(step==='person'){
   content=`<h3>Who would you like to support?</h3><form id="lm-support-person"><label>Choose an existing person<select name="personId"><option value="">Choose a person…</option>${(api.people||[]).map(p=>`<option value="${esc(p.id)}" ${supportDraft.personId===p.id?'selected':''}>${esc(labelFor(p))}</option>`).join('')}</select></label><fieldset><legend>Or create a person</legend><label>First name<input name="firstName" maxlength="120"></label><label>Last name (optional)<input name="lastName" maxlength="120"></label></fieldset><button class="lm-primary">Continue</button></form><p class="lm-subtle">Continue creates a People record. You can add other details in People later.</p>`;
  }else if(step==='support-kind'){
   content=`<small>${esc(supportDraft.personName)}</small><h3>What kind of help do they need?</h3><div class="lm-topic-menu">${Object.entries(supportKinds).map(([id,item])=>`<button data-support-kind="${id}"><strong>${esc(item.label)}</strong><small>${esc(item.hint)}</small></button>`).join('')}</div><button data-support-back="person" class="lm-next-prompt">← Change person</button>`;
  }else if(step==='support-outcome'){
   const kind=supportKinds[supportDraft.kind];
   content=`<small>${esc(supportDraft.personName)} · ${esc(kind.label)}</small><h3>What would you like to help them accomplish?</h3><form id="lm-support-outcome"><label>Outcome<input name="title" required maxlength="200" placeholder="${esc(supportDraft.kind==='housing'?'Help them sell their house':supportDraft.kind==='career'?'Support their next job move':'Describe the help they need')}" value="${esc(supportDraft.title||'')}"></label><button class="lm-primary">Save outcome and continue</button></form><button data-support-back="support-kind" class="lm-next-prompt">← Change kind of help</button>`;
  }else{
   content=`<h3>${esc(current.question)}</h3><div class="lm-answer-buttons"><button id="lm-support-yes">Yes — choose a person</button><button data-support-answer="well">Everyone is supported for now</button><button id="lm-support-unsure">Help me think</button><button data-support-answer="defer">Come back to this later</button></div>${step==='support-think'?'<p>Think about a parent managing a change, a partner pursuing a goal, a child needing guidance, or a friend who could use practical help. Is there someone you want to check in with?</p>':''}${outcomeList(outcomes)}`;
  }
 }else if(isArea||current.group){
  content=`<h3>${isArea?'What would you like to check?':esc(current.question)}</h3><button class="lm-primary" id="lm-guide">Review next topic</button><div class="lm-topic-menu">${children.map(t=>`<button data-go="${esc(t.id)}"><span>${esc(t.title)}</span><span class="lm-topic-review">${reviewMarker(t)}${topicSecondaryStatus(t.id,topics,data.answers)?`<small>${esc(topicSecondaryStatus(t.id,topics,data.answers))}</small>`:''}</span></button>`).join('')}</div>${addMarkup}${linksMarkup}`;
 }else if(step==='timing'){
  content=`<small>${esc(current.title)}</small><h3>How soon does this need attention?</h3><div class="lm-answer-buttons">${urgencyChoices.filter(([value])=>value&&value!=='date').map(([v,l])=>`<button data-timing="${v}">${l}</button>`).join('')}</div><details class="lm-secondary"><summary>There is a specific deadline</summary><form id="lm-deadline"><label>Deadline<input type="date" name="deadline" required value="${esc(answer.deadline||'')}"></label><button>Continue</button></form></details>`;
 }else if(step==='action'){
  const refs=data.links[current.id]||[];
  const tasks=refs.filter(ref=>ref.startsWith('task:')).map(ref=>api.tasks.find(task=>task.id===ref.slice(5))).filter(Boolean);
  content=taskEntryMarkup(current,tasks,suggestion(current)?.action||'');
 }else{
  content=`<small>${esc(current.personName?current.personName+' · '+current.title:current.title)}</small><h3>${esc(current.question)}</h3>${answer.status?`<p class="lm-current-answer">${esc(statuses[answer.status])} · change your answer below</p>`:''}<div class="lm-answer-buttons">${[['done','Already taken care of'],['unstarted','I need to do this'],['progress','I have started'],['unsure','Not sure'],['irrelevant','Not relevant'],['defer','Ask me later']].map(([v,l])=>`<button data-answer="${v}" aria-pressed="${answer.status===v}">${l}</button>`).join('')}</div><button class="lm-next-prompt" id="lm-next">Skip for now →</button>${questionDetails}`;
 }
 if(compactOutcome){
  const tasks=(data.links[current.id]||[]).filter(ref=>ref.startsWith('task:')).map(ref=>api.tasks.find(task=>task.id===ref.slice(5))).filter(Boolean);
  content+=taskEntryMarkup(current,tasks,'',true)+addMarkup+`<details class="lm-secondary lm-outcome-details"><summary>Details</summary>${notesMarkup}${linksMarkup}${linkPicker('task',current.id)}`;
 }
 if(panel==='explore'&&!isArea&&!current.kind&&!current.group&&step!=='action'&&!compactOutcome)content+=`<details class="lm-secondary lm-outcome-tasks"><summary>Tasks</summary>${outcomeList([current],true)}</details>`;
 if(panel!=='map'&&selected!=='interview-empty'){
  if(exclusion)content=`<h3>${esc(current.title)}</h3><p>Not of interest · Reviewed</p>${exclusion.topicId===current.id?'<button id="lm-reopen-interest">Reopen this topic</button>':`<button data-go="${esc(exclusion.topicId)}">Manage excluded topic: ${esc(exclusion.title)}</button>`}`;
  else if(step!=='action')content+='<button id="lm-not-interested" class="lm-next-prompt">Not of interest</button>';
 }
 if(panel!=='map'&&step!=='action'&&data.concerns.some(topic=>topic.id===current.id)){
  content+=`<details class="lm-secondary"><summary>Edit outcome</summary><form id="lm-edit-outcome"><label>Title<input name="title" required maxlength="200" value="${esc(current.title)}"></label><label>Notes<textarea name="notes" rows="3">${esc(answer.notes||'')}</textarea></label><button class="lm-primary">Save changes</button></form><button id="lm-delete-outcome" class="danger-button" type="button">Delete outcome</button></details><dialog id="lm-delete-confirm" aria-labelledby="lm-delete-heading"><h3 id="lm-delete-heading">Delete this outcome?</h3><p>${esc(current.title)}</p><p>This removes the outcome, its nested outcomes, notes, and links. Tasks, projects, and people are not deleted.</p><form method="dialog"><button value="cancel">Cancel</button><button value="delete" class="danger-button">Delete outcome</button></form></dialog>`;
 }
 if(panel!=='map'&&step!=='action'&&selected!=='interview-empty')content+=`<div class="lm-review-marker">${answer.reviewedAt||answer.status?`<small>Reviewed${answer.reviewedAt?' · '+esc(new Date(answer.reviewedAt).toLocaleDateString()):''}</small>`:'<button id="lm-mark-reviewed">Mark reviewed</button>'}</div>`;
 if(compactOutcome)content+='</details>';
 if(panel!=='map'&&!exclusion&&excludedChildren.length)content+=`<section class="lm-excluded-topics" aria-label="Excluded topics"><h4>Not of interest</h4><div class="lm-topic-menu">${excludedChildren.map(topic=>`<button data-go="${esc(topic.id)}"><span>${esc(topic.title)}</span>${reviewMarker(topic)}</button>`).join('')}</div></section>`;
 root.innerHTML=`<div class="life-map lm-guided"><div class="lm-toolbar"><div role="tablist" aria-label="Life map views">${[['map','My map'],['explore','Guided review'],['interview','Ask me']].map(([v,l])=>`<button role="tab" aria-selected="${panel===v}" data-panel="${v}">${l}</button>`).join('')}</div><span class="lm-storage" role="status">${esc(loading?'Loading…':notice)}</span></div><div class="lm-layout ${panel==='interview'?'lm-random-layout':''}">${panel==='interview'?'':nav}<section class="lm-interview ${panel==='map'?'lm-map-canvas':''}"><nav class="lm-breadcrumb" ${panel==='map'||selected==='interview-empty'?'hidden':''}><button data-go="${area.id}">${esc(area.title)}</button>${current.parent&&current.parent!==area.id?`<span> / </span><button data-go="${esc(current.parent)}">${esc(topics.find(t=>t.id===current.parent)?.title)}</button>`:''}</nav>${panel==='interview'&&selected!=='interview-empty'?`<p class="lm-subtle">${interviewCandidates(topics,data.answers).length} questions remaining</p>`:''}${content}</section></div><details class="lm-backup"><summary>Backup</summary><button id="lm-export">Export life map</button></details></div>`;
 root.querySelector('[role="tablist"]').insertAdjacentHTML('beforeend','<button type="button" role="tab" aria-selected="false" data-panel="priorities">Priorities</button>');
 const breadcrumb=root.querySelector('.lm-breadcrumb');
 if(panel==='interview'&&selected!=='interview-empty')placeQuestionSkip(root.querySelector('.lm-interview'),step);
 breadcrumb.innerHTML=topicPath(current.id,topics).map((topic,index,path)=>
  (index?'<span aria-hidden="true"> / </span>':'')+(index===path.length-1?`<span aria-current="page">${esc(topic.title)}</span>`:`<button data-go="${esc(topic.id)}">${esc(topic.title)}</button>`)
 ).join('');
 if(panel==='interview'&&selected!=='interview-empty'){
  breadcrumb.classList.add('lm-question-context');
  const count=root.querySelector('.lm-interview > p.lm-subtle');
  if(count){count.className='lm-question-count';root.querySelector('.lm-toolbar').append(count);}
  root.querySelector('.lm-interview > small')?.remove();
 }
 if(panel==='explore'&&!isArea&&!current.kind&&!current.group&&step==='question'){
  const heading=root.querySelector('.lm-interview h3');
  if(heading)heading.textContent=current.title;
  const repeatedTitle=root.querySelector('.lm-interview > small');
  repeatedTitle?.remove();
  const extraOutcome=root.querySelector('.lm-outcome-tasks .lm-outcome-item > .lm-review-row');
  extraOutcome?.remove();
  const repeatedHeading=root.querySelector('.lm-outcome-tasks h4');
  repeatedHeading?.remove();
 }
 async function save(markReviewed=true){
  if(markReviewed)data.answers[current.id]={...(data.answers[current.id]||{}),reviewedAt:data.answers[current.id]?.reviewedAt||new Date().toISOString()};
  const snapshot=JSON.parse(JSON.stringify(data));const owner=api.userId;const client=api.client;
  const write=async()=>{try{localStorage.setItem(key,JSON.stringify(snapshot));notice='Saved in this browser.';if(client&&owner){const {error}=await client.from('planner_life_map').upsert({user_id:owner,data:snapshot,updated_at:new Date().toISOString()});notice=error?'Saved here; account sync failed.':'Saved.';}if(loadedKey===key)api.render();}catch{notice='Save failed. Please retry.';api.render();}};
  saveQueue=saveQueue.then(write,write);return saveQueue;
 }
 function go(id){selected=id;step='question';if(panel==='priorities'){changePanel('explore');return;}if(panel!=='interview')panel='explore';api.render();}
 function next(){
  if(panel==='interview'){interviewSkipped.push(current.id);const candidate=pickInterviewQuestion(topics,data.answers,interviewSkipped);selected=candidate?.id||'interview-empty';interviewSkipped.push(selected);step='question';api.render();return;}
  const candidate=nextGuidedTopic(current.id,topics,data.answers);
  if(candidate)go(candidate.id);else{selected=area.id;step='question';api.render();}
 }
 root.querySelectorAll('[data-inline-task]').forEach(form=>form.onsubmit=async e=>{e.preventDefault();const title=new FormData(form).get('title').trim();if(!title)return;const id=form.dataset.inlineTask;const topic=topics.find(t=>t.id===id);const refs=data.links[id]||[];form.querySelector('button').disabled=true;try{const task=await api.createTask({title,area:topic.area,notes:`Life map outcome: ${topic.title}`,goal_ids:refs.filter(r=>r.startsWith('goal:')).map(r=>r.slice(5)),project_id:refs.find(r=>r.startsWith('project:'))?.slice(8)||'',priority:'Medium'});if(!task)throw Error();data.links[id]=[...new Set([...(data.links[id]||[]),'task:'+task.id])];await save();notice='Task created and linked to this outcome.';api.render();}catch{notice='Task could not be created. Please retry.';api.render();}});

 root.querySelectorAll('[data-open-task]').forEach(link=>link.onclick=e=>{e.preventDefault();api.openTask(link.dataset.openTask);});
 root.querySelectorAll('[data-go]').forEach(b=>b.onclick=()=>go(b.dataset.go));
 function changePanel(value){
  const hash=({map:'#my-map',explore:'#guided-review',interview:'#ask-me',priorities:'#priorities'})[value];
  if(window.location.hash!==hash)window.history.pushState(null,'',hash);
  lastPanelHash=null;
  api.render();
 }
 root.querySelectorAll('[data-panel]').forEach(b=>b.onclick=()=>changePanel(b.dataset.panel));
 root.querySelector('#lm-interview-restart')?.addEventListener('click',()=>{interviewSkipped=[];selected=pickInterviewQuestion(topics,data.answers)?.id||'interview-empty';interviewSkipped.push(selected);step='question';api.render();});
 root.querySelector('#lm-interest-filter')?.addEventListener('change',e=>{mapInterestFilter=e.target.value;api.render();});
 root.querySelector('#lm-hide-completed')?.addEventListener('change',e=>{mapHideCompleted=e.target.checked;api.render();});
 root.querySelector('#lm-guide')?.addEventListener('click',()=>{
  const pending=nextReviewTopic(current.id,topics,data.answers);
  if(pending)go(pending.id);
  else{notice='All topics here have been reviewed or excluded.';api.render();}
 });
 root.querySelector('#lm-specific-outcome')?.addEventListener('submit',async e=>{
  e.preventDefault();const title=new FormData(e.target).get('title').trim();if(!title)return;
  const existing=children.find(t=>t.title.toLowerCase()===title.toLowerCase());if(existing){go(existing.id);return;}
  e.target.querySelector('button').disabled=true;const id=crypto.randomUUID();
  data.concerns.push({id,parent:current.id,area:area.area,title,question:`Where are you with “${title}”?`,action:current.action||`Identify the first practical step toward: ${title}.`});
  selected=id;step='question';await save();
 });
 root.querySelector('#lm-care-outcome')?.addEventListener('submit',async e=>{e.preventDefault();const title=new FormData(e.target).get('title').trim();if(!title)return;e.target.querySelector('button').disabled=true;const id=crypto.randomUUID();data.concerns.push({id,parent:current.id,area:area.area,title,question:`Where are you with “${title}”?`,action:`Identify the next practical step for ${title}, following your agreed care plan.`});selected=id;step='question';await save();});
 root.querySelector('#lm-milestone')?.addEventListener('submit',async e=>{e.preventDefault();const title=new FormData(e.target).get('title').trim();if(!title)return;e.target.querySelector('button').disabled=true;const id=crypto.randomUUID();data.concerns.push({id,parent:current.id,area:area.area,title,question:`Where are you with “${title}”?`,action:`Identify one project or measurable step you can influence toward: ${title}.`});selected=id;step='question';await save();});
 async function savePersonSelection(e,nextStep){
  e.preventDefault();const values=Object.fromEntries(new FormData(e.target));let person=(api.people||[]).find(p=>p.id===values.personId);
  if(!person){const first_name=values.firstName.trim(),last_name=values.lastName.trim();if(!first_name){notice='Choose a person or enter their first name.';api.render();return;}
   const normalize=value=>value.trim().replace(/\s+/g,' ').toLowerCase();person=(api.people||[]).find(p=>normalize(labelFor(p))===normalize(`${first_name} ${last_name}`));
   if(!person){const button=e.target.querySelector('button');button.disabled=true;button.textContent='Saving person…';try{const result=await api.createPerson({id:crypto.randomUUID(),first_name,last_name,created_at:new Date().toISOString()});if(!result?.person)throw new Error('Not saved');person=result.person;}catch{notice='Person could not be saved. Your name fields are still here; please retry.';button.disabled=false;button.textContent='Continue';root.querySelector('.lm-storage').textContent=notice;return;}}
  }
  supportDraft={personId:person.id,personName:labelFor(person)};step=nextStep;api.render();
 }
 root.querySelector('#lm-relationship-person')?.addEventListener('submit',e=>savePersonSelection(e,'relationship-action'));
 root.querySelector('#lm-support-person')?.addEventListener('submit',e=>savePersonSelection(e,'support-kind'));

 async function createRelationship(title){const id=crypto.randomUUID();const outcomeTitle=current.id.endsWith(':0')?`Stay connected with ${supportDraft.personName}`:current.id.endsWith(':1')?`Spend meaningful time with ${supportDraft.personName}`:current.id.endsWith(':2')?`Resolve an important conversation with ${supportDraft.personName}`:`Maintain healthy boundaries with ${supportDraft.personName}`;data.concerns.push({id,parent:current.id,area:area.area,title:outcomeTitle,personId:supportDraft.personId,personName:supportDraft.personName,question:`Where are you with “${outcomeTitle}”?`,action:title});if(supportDraft.personId)data.links[id]=['person:'+supportDraft.personId];selected=id;step='timing';data.answers[id]={status:'unstarted'};await save();}
 root.querySelectorAll('[data-relationship-action]').forEach(b=>b.onclick=async()=>{const action=b.dataset.relationshipAction;if(action==='Something else'){step='relationship-custom';api.render();return;}b.disabled=true;await createRelationship(`${action} — ${supportDraft.personName}`);});
 root.querySelector('#lm-relationship-custom')?.addEventListener('submit',async e=>{e.preventDefault();const title=new FormData(e.target).get('title').trim();if(title){e.target.querySelector('button').disabled=true;await createRelationship(title);}});
 root.querySelectorAll('[data-learning-intent]').forEach(b=>b.onclick=async()=>{b.disabled=true;const intent=b.dataset.learningIntent;const title=`${intent} ${current.title.toLowerCase()}`;const existing=children.find(t=>t.title===title);if(existing){go(existing.id);return;}const id=crypto.randomUUID();data.concerns.push({id,parent:current.id,area:area.area,title,question:`Where are you with “${title}”?`,action:intent==='Explore'?`Try one introductory ${current.title.toLowerCase()} session to see if you enjoy it.`:intent==='Improve'?`Choose one ${current.title.toLowerCase()} skill to practise this week.`:`Find a beginner ${current.title.toLowerCase()} lesson and choose a first session.`});selected=id;step='question';await save();});
 root.querySelector('#lm-learning-outcome')?.addEventListener('submit',async e=>{e.preventDefault();const title=new FormData(e.target).get('title').trim();if(!title)return;e.target.querySelector('button').disabled=true;const id=crypto.randomUUID();data.concerns.push({id,parent:current.id,area:area.area,title,question:`Where are you with “${title}”?`,action:`Choose one small practice session, introductory lesson, or resource to begin: ${title}.`});selected=id;step='question';await save();});
 root.querySelector('#lm-support-yes')?.addEventListener('click',()=>{supportDraft={};step='person';api.render();});
 root.querySelector('#lm-support-unsure')?.addEventListener('click',()=>{step='support-think';api.render();});
 root.querySelectorAll('[data-support-answer]').forEach(b=>b.onclick=async()=>{data.answers[current.id]={...answer,status:b.dataset.supportAnswer,updatedAt:new Date().toISOString()};await save();next();});
 root.querySelectorAll('[data-support-back]').forEach(b=>b.onclick=()=>{step=b.dataset.supportBack;api.render();});

 root.querySelectorAll('[data-support-kind]').forEach(b=>b.onclick=()=>{supportDraft.kind=b.dataset.supportKind;step='support-outcome';api.render();});
 root.querySelector('#lm-support-outcome')?.addEventListener('submit',async e=>{e.preventDefault();const title=new FormData(e.target).get('title').trim();if(!title)return;e.target.querySelector('button').disabled=true;const id=crypto.randomUUID();const outcome=supportOutcome({...supportDraft,id,title,parent:current.id,area:area.area});data.concerns.push(outcome);if(supportDraft.personId)data.links[id]=['person:'+supportDraft.personId];data.answers[current.id]={...answer,status:'progress'};selected=id;step='question';await save();});
 root.querySelectorAll('[data-answer]').forEach(b=>b.onclick=async()=>{
  if(excludedTopic(current.id)){api.render();return;}
 root.querySelectorAll('[data-answer]').forEach(x=>x.disabled=true);
  const status=b.dataset.answer;
  if(['done','unstarted','progress','unsure'].includes(status))setOutcomeStatus(data,current.id,status);
  else data.answers[current.id]={...answer,status,updatedAt:new Date().toISOString(),completedAt:null};
  if(['unstarted','progress','unsure'].includes(status))step='timing';
  await save();
  if(['done','irrelevant','defer'].includes(status)){notice=status==='done'?`${current.title} recorded as taken care of.`:'Answer saved.';next();}
 });
 root.querySelectorAll('[data-timing]').forEach(b=>b.onclick=async()=>{setOutcomeUrgency(data,current.id,b.dataset.timing);step='action';await save();});
 root.querySelector('#lm-deadline')?.addEventListener('submit',async e=>{e.preventDefault();setOutcomeUrgency(data,current.id,'date',new FormData(e.target).get('deadline'));step='action';await save();});

 root.querySelector('#lm-note')?.addEventListener('submit',async e=>{e.preventDefault();data.answers[current.id]={...answer,notes:new FormData(e.target).get('notes')};await save();});
 root.querySelector('#lm-mark-reviewed')?.addEventListener('click',async e=>{e.target.disabled=true;await save();});
 root.querySelector('#lm-edit-outcome')?.addEventListener('submit',async e=>{
  e.preventDefault();const values=new FormData(e.target),title=values.get('title').trim();if(!title)return;
  const outcome=data.concerns.find(topic=>topic.id===current.id);if(!outcome)return;
  e.target.querySelector('button').disabled=true;
  outcome.title=title;outcome.question=`Where are you with “${title}”?`;
  data.answers[current.id]={...answer,notes:values.get('notes'),updatedAt:new Date().toISOString()};await save();
 });
 root.querySelector('#lm-delete-outcome')?.addEventListener('click',()=>{
  const dialog=root.querySelector('#lm-delete-confirm');
  dialog.addEventListener('close',async()=>{
   if(dialog.returnValue!=='delete')return;
   if(removeCustomOutcome(data,current.id)){selected=current.parent||area.id;step='question';await save(false);}
  },{once:true});
  dialog.showModal();
 });
 root.querySelector('#lm-not-interested')?.addEventListener('click',async e=>{
  e.target.disabled=true;
  data.answers[current.id]={...answer,status:'uninterested',previousStatus:answer.status||null,reviewedAt:answer.reviewedAt||new Date().toISOString(),updatedAt:new Date().toISOString()};
  await save();if(panel==='interview')next();
 });
 root.querySelector('#lm-reopen-interest')?.addEventListener('click',async e=>{
  e.target.disabled=true;
  reopenTopicInterest(current.id,data.answers);step='question';await save(false);
 });
 root.querySelector('#lm-next')?.addEventListener('click',next);
 root.querySelector('#lm-custom')?.addEventListener('submit',async e=>{e.preventDefault();const title=new FormData(e.target).get('title').trim();if(!title)return;const id=crypto.randomUUID();data.concerns.push({id,parent:current.id,area:area.area,title,question:`What is the status of ${title.toLowerCase()}?`,action:`Choose one next step for ${title.toLowerCase()}.`});selected=id;step='question';await save();});
 root.querySelectorAll('.lm-link-picker').forEach(picker=>{
  const type=picker.dataset.linkType,id=picker.dataset.linkOutcome,input=picker.querySelector('[data-link-search]'),results=picker.querySelector('[data-link-results]');
  input.addEventListener('input',()=>{
   if(!input.value.trim()){results.innerHTML='<p class="lm-subtle">Type a name or title to search.</p>';return;}
   const matches=linkCandidates(records,type,data.links[id]||[],input.value);
   results.innerHTML=matches.length?matches.slice(0,8).map(([,item])=>`<button type="button" class="lm-review-row" data-link-record="${esc(type+':'+item.id)}">${esc(labelFor(item))}<small>Link ${type==='person'?'person':type}</small></button>`).join('')+(matches.length>8?'<p class="lm-subtle">Keep typing to narrow the results.</p>':''):'<p class="lm-subtle">No matching unlinked records.</p>';
  });
  results.addEventListener('click',async e=>{
   const button=e.target.closest('[data-link-record]');if(!button)return;
   const ref=button.dataset.linkRecord;
   if(!linkCandidates(records,type,data.links[id]||[]).some(([kind,item])=>ref===kind+':'+item.id))return;
   button.disabled=true;data.links[id]=[...new Set([...(data.links[id]||[]),ref])];await save();
  });
 });
 root.querySelectorAll('[data-unlink]').forEach(b=>b.onclick=async()=>{const id=b.dataset.linkOutcome||current.id;data.links[id]=(data.links[id]||[]).filter(x=>x!==b.dataset.unlink);await save();});
 root.querySelectorAll('[data-plan]').forEach(b=>b.onclick=()=>{selected=b.dataset.plan;panel='explore';step='action';api.render();});
 root.querySelector('#lm-create')?.addEventListener('submit',async e=>{
  e.preventDefault();const title=new FormData(e.target).get('title').trim();if(!title)return;e.target.querySelector('button').disabled=true;
  const refs=data.links[current.id]||[];const people=records.filter(([type,item])=>type==='person'&&refs.includes('person:'+item.id)).map(([,item])=>labelFor(item));
  try{const task=await api.createTask({title,goal_ids:refs.filter(x=>x.startsWith('goal:')).map(x=>x.slice(5)),project_id:refs.find(x=>x.startsWith('project:'))?.slice(8)||'',area:area.area,notes:`Life map: ${current.title}\n${answer.notes||''}\nPeople: ${people.join(', ')}`,due_date:answer.deadline||'',priority:['day','soon','week'].includes(answer.timing)?'High':'Medium'});if(!task)throw Error();data.links[current.id]=[...refs,'task:'+task.id];data.answers[current.id]={...answer,next:title};await save();notice='Task added to this outcome.';api.render();const input=root.querySelector('#lm-create [name="title"]');if(input){input.value='';input.focus();}}catch{notice='Could not save the task. Please retry.';api.render();}
 });
 root.querySelectorAll('[data-toggle]').forEach(b=>b.onclick=async()=>{const task=api.tasks.find(t=>t.id===b.dataset.toggle);b.disabled=true;const saved=await api.createTask({...task,status:task.status==='done'?'active':'done',completed_at:task.status==='done'?null:new Date().toISOString()});notice=saved?'Task updated.':'Task update failed.';api.render();});
 root.querySelector('#lm-export').onclick=()=>{const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='seven-lives-life-map.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
 bindGraph(root,graph,api.render,api.tasks);
 root.onlifemaptoggle=null;
 root.onLifeMapToggle && root.removeEventListener('life-map-task-toggle',root.onLifeMapToggle);
 root.onLifeMapToggle=async e=>{const task=api.tasks.find(t=>t.id===e.detail);if(!task)return;const saved=await api.createTask({...task,status:task.status==='done'?'active':'done',completed_at:task.status==='done'?null:new Date().toISOString()});notice=saved?'Task updated.':'Task update failed.';api.render();};
 root.addEventListener('life-map-task-toggle',root.onLifeMapToggle);
 if(loading)root.querySelectorAll('button,input,select,textarea').forEach(x=>x.disabled=true);
}
