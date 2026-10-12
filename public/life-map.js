import {buildLifeGraph,graphMarkup,bindGraph} from './life-map-graph.js?v=1.14.09';
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
 ['experiences','Experiences and possibilities','Experiences','Are there experiences or changes you keep hoping to make time for?','Choose one possibility worth exploring without committing to it yet.']
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
 experiences:['Places I would like to visit','An experience or adventure to make possible','A lifestyle change I want to explore','A celebration or meaningful occasion','An idea for someday','Making time with people part of the experience']
};
export function suggestedAction(topic, answer={}) {
 if(answer.next?.trim())return answer.next.trim();
 const label=topic.title;
 if(answer.status==='unsure')return `Find out what is already covered for “${label}” and what, if anything, needs attention.`;
 if(answer.support==='person')return `Contact the person who can help move “${label}” forward.`;
 if(answer.support==='decision')return `List the options for “${label}” and choose one small next step.`;
 if(answer.support==='information')return `Find the missing information needed for “${label}”.`;
 if(answer.support==='overwhelmed')return `Break “${label}” into a first step that fits in 15 minutes.`;
 if(answer.support==='waiting')return `Check what you are waiting for on “${label}” and decide when to follow up.`;
 if(topic.parent)return `Choose and take one small step toward “${label}”.`;
 return topic.action;
}
export const statuses={unstarted:'Not started / needs attention',stuck:'Started, but stuck',progress:'In progress',well:'Working well / in place',review:'Needs updating',unsure:'Not sure',irrelevant:'Not relevant',defer:'Not now',done:'Completed'};
export function recommendation(topic,answer={}){
 if(!answer.status||['well','irrelevant','defer','done'].includes(answer.status))return null;
 const reason=answer.deadline?`Deadline: ${answer.deadline}`:answer.timing==='soon'?'You want to address this soon':answer.timing==='month'?'You want progress this month':answer.status==='stuck'?'A blocked next step needs clarification':answer.impact==='high'?'You said this protects something important':'Timing still needs clarification';
 const days=answer.deadline?Math.ceil((Date.parse(answer.deadline+'T12:00:00')-Date.now())/86400000):Infinity;
 const score=(days<=7?100:days<=30?60:0)+(answer.timing==='soon'?40:answer.timing==='month'?20:0)+(answer.status==='stuck'?10:0)+(answer.impact==='high'?25:answer.impact==='medium'?10:0);
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
  ['Subscriptions','Are you paying for subscriptions or services you no longer want?','Review recurring charges and identify one you no longer need.']
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
  ['Recurring renewals','Are there recurring renewals you tend to remember at the last minute?','Record the next known renewal date.']
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
 ['real-id','REAL ID','Do you already have a REAL ID, or is it something you want to arrange?','Check the official issuing agency’s REAL ID application guidance.'],
 ['oci','OCI card','If overseas ties to India are relevant to you, is an OCI card something you want to arrange or update?','Check official OCI guidance to establish which application, if any, fits your circumstances.'],
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
 return items.map(item=>({...item,suggested:true}));
}
export function coverageStats(id,topics,answers){
 const branch=branchStats(id,topics,answers,{},[]).topics.filter(t=>t.id!==id&&!t.group&&!t.kind);
 return {reviewed:branch.filter(t=>answers[t.id]?.status).length,complete:branch.filter(t=>['well','done'].includes(answers[t.id]?.status)).length,notRelevant:branch.filter(t=>answers[t.id]?.status==='irrelevant').length,total:branch.length};
}
export function mapState(topic,answer={},tasks=[],now=Date.now()){
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
let supportDraft={};
let loadedKey='',data={answers:{},links:{},concerns:[]},notice='',loading=false;
let selected='admin',panel='map',step='question',saveQueue=Promise.resolve();
const labelFor=(item)=>item?.title||item?.name||[item?.first_name,item?.last_name].filter(Boolean).join(' ')||'Unavailable record';

export function renderLifeMap(root,api){
 const key='seven-lives-map:'+api.userKey;
 if(loadedKey!==key){
  loadedKey=key;supportDraft={};selected='admin';panel='map';step='question';
  try{data=JSON.parse(localStorage.getItem(key))||{answers:{},links:{},concerns:[]};}catch{data={answers:{},links:{},concerns:[]};}
  notice='Saved in this browser.';
  if(api.client&&api.userId){loading=true;api.client.from('planner_life_map').select('data').eq('user_id',api.userId).maybeSingle().then(({data:row,error})=>{
   if(loadedKey!==key)return;
   if(!error&&row?.data)data=row.data;
   notice=error?'Cloud unavailable; changes will also be kept in this browser.':'Connected to your account.';loading=false;api.render();
  }).catch(()=>{if(loadedKey===key){loading=false;notice='Cloud unavailable; browser storage is available.';api.render();}});}
 }
 data.answers ||= {};data.links ||= {};data.concerns ||= [];
 const topics=[...baseTopics,...discoveryTopics(),...data.concerns];
 const current=topics.find(t=>t.id===selected)||baseTopics[0];
 let area=current;const seen=new Set();while(area.parent&&!seen.has(area.id)){seen.add(area.id);area=topics.find(t=>t.id===area.parent)||area;}
 const answer=data.answers[current.id]||{};
 const isArea=baseTopics.some(t=>t.id===current.id);
 const children=topics.filter(t=>t.parent===current.id);
 const branch=branchStats(area.id,topics,data.answers,data.links,api.tasks);
 const coverage=coverageStats(area.id,topics,data.answers);
 const records=[...api.tasks.map(x=>['task',x]),...api.goals.map(x=>['goal',x]),...api.projects.map(x=>['project',x]),...(api.people||[]).map(x=>['person',x])];
 function suggestion(topic){
  const a=data.answers[topic.id]||{};const r=recommendation(topic,a);if(!r)return null;
  if(!a.next&&!a.support)r.action=topic.action;
  const people=records.filter(([type,item])=>type==='person'&&(data.links[topic.id]||[]).includes('person:'+item.id)).map(([,item])=>labelFor(item));
  if(people.length&&a.support==='person'&&!a.next)r.action=`Arrange a conversation with ${people.join(', ')} about ${topic.title.toLowerCase()}.`;
  return r;
 }
 const recs=topics.filter(t=>t.parent&&!t.group&&!t.kind).map(suggestion).filter(Boolean).sort((a,b)=>b.score-a.score);
 const linksMarkup=`<details class="lm-secondary"><summary>Link existing people, projects, goals, or tasks</summary><label>Existing item<select id="lm-existing"><option value="">Choose an item…</option>${records.map(([type,item])=>`<option value="${esc(type+':'+item.id)}">${esc(type)}: ${esc(labelFor(item))}</option>`).join('')}</select></label><button id="lm-link">Link</button><ul>${(data.links[current.id]||[]).map(ref=>{const record=records.find(([type,item])=>ref===type+':'+item.id);return `<li>${esc(record?labelFor(record[1]):'Unavailable record')} <button data-unlink="${esc(ref)}">Unlink</button></li>`;}).join('')}</ul></details>`;
 const notesMarkup=`<details class="lm-secondary"><summary>Add a note</summary><form id="lm-note"><label>Note<textarea name="notes" rows="3">${esc(answer.notes||'')}</textarea></label><button>Save note</button></form></details>`;
 const addMarkup=`<details class="lm-secondary"><summary>Add something else</summary><form id="lm-custom"><label>What would you like to include?<input name="title" required maxlength="200"></label><button>Add</button></form></details>`;
 const nav=`<aside class="lm-area-nav">${baseTopics.map(t=>{const c=coverageStats(t.id,topics,data.answers);return `<button class="lm-topic ${panel!=='map'&&area.id===t.id?'selected':''}" data-go="${t.id}"><strong>${esc(t.title)}</strong><small>${c.complete} taken care of${c.reviewed?' · '+c.reviewed+' reviewed':''}</small></button>`;}).join('')}</aside>`;
 const mapAreas=baseTopics.map(domain=>{
  const b=branchStats(domain.id,topics,data.answers,data.links,api.tasks);
  const outcomes=b.topics.filter(t=>t.id!==domain.id&&!t.group&&!t.kind&&(data.answers[t.id]?.status||data.concerns.some(c=>c.id===t.id)||(data.links[t.id]||[]).length));
  return {domain,branch:b,outcomes:outcomes.map(t=>{const tasks=branchStats(t.id,topics,data.answers,data.links,api.tasks).tasks;return {topic:t,tasks,state:mapState(t,data.answers[t.id],tasks)};})};
 });
 const mapped=mapAreas.flatMap(a=>a.outcomes);
 const allTasks=[...new Map(mapAreas.flatMap(a=>a.branch.tasks).map(t=>[t.id,t])).values()];
 let content='';
 const graph=buildLifeGraph({topics,answers:data.answers,links:data.links,tasks:api.tasks,projects:api.projects,goals:api.goals,people:api.people,stateFor:mapState});
 if(panel==='map'){
  content=graphMarkup(graph);
 }else if(current.kind==='learning-choice'){
  content=`<h3>${esc(current.question)}</h3><div class="lm-answer-buttons"><button data-learning-intent="Explore">Explore it</button><button data-learning-intent="Learn">Start learning</button><button data-learning-intent="Improve">Improve my skills</button></div>${children.map(t=>`<button class="lm-review-row" data-go="${esc(t.id)}">${esc(t.title)}</button>`).join('')}${addMarkup}`;
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
   content=`<h3>Who is this about?</h3><form id="lm-relationship-person"><label>Choose an existing person<select name="personId"><option value="">Choose a person…</option>${(api.people||[]).map(p=>`<option value="${esc(p.id)}">${esc(labelFor(p))}</option>`).join('')}</select></label><fieldset><legend>Or create a person</legend><label>First name<input name="firstName" maxlength="120"></label><label>Last name (optional)<input name="lastName" maxlength="120"></label></fieldset><p class="lm-subtle">Continue creates a People record. You can add other details in People later.</p><button class="lm-primary">Continue</button></form>${children.map(t=>`<button class="lm-review-row" data-go="${esc(t.id)}">${esc(t.title)}</button>`).join('')}<button id="lm-next">Skip for now</button>`;
  }
 }else if(current.kind==='support-discovery'){
  const outcomes=children.filter(t=>!t.kind);
  if(step==='person'){
   content=`<h3>Who would you like to support?</h3><form id="lm-support-person"><label>Choose an existing person<select name="personId"><option value="">Choose a person…</option>${(api.people||[]).map(p=>`<option value="${esc(p.id)}" ${supportDraft.personId===p.id?'selected':''}>${esc(labelFor(p))}</option>`).join('')}</select></label><label>Or use a name or relationship<input name="personName" placeholder="For example: Mom" value="${esc(supportDraft.personName||'')}" maxlength="120"></label><button class="lm-primary">Continue</button></form><p class="lm-subtle">Using a name here does not create a new person record.</p>`;
  }else if(step==='support-kind'){
   content=`<small>${esc(supportDraft.personName)}</small><h3>What kind of help do they need?</h3><div class="lm-topic-menu">${Object.entries(supportKinds).map(([id,item])=>`<button data-support-kind="${id}"><strong>${esc(item.label)}</strong><small>${esc(item.hint)}</small></button>`).join('')}</div><button data-support-back="person" class="lm-next-prompt">← Change person</button>`;
  }else if(step==='support-outcome'){
   const kind=supportKinds[supportDraft.kind];
   content=`<small>${esc(supportDraft.personName)} · ${esc(kind.label)}</small><h3>What would you like to help them accomplish?</h3><form id="lm-support-outcome"><label>Outcome<input name="title" required maxlength="200" placeholder="${esc(supportDraft.kind==='housing'?'Help them sell their house':supportDraft.kind==='career'?'Support their next job move':'Describe the help they need')}" value="${esc(supportDraft.title||'')}"></label><button class="lm-primary">Save outcome and continue</button></form><button data-support-back="support-kind" class="lm-next-prompt">← Change kind of help</button>`;
  }else{
   content=`<h3>${esc(current.question)}</h3><div class="lm-answer-buttons"><button id="lm-support-yes">Yes — choose a person</button><button data-support-answer="well">Everyone is supported for now</button><button id="lm-support-unsure">Help me think</button><button data-support-answer="defer">Come back to this later</button></div>${step==='support-think'?'<p>Think about a parent managing a change, a partner pursuing a goal, a child needing guidance, or a friend who could use practical help. Is there someone you want to check in with?</p>':''}${outcomes.length?`<h4>Support you have identified</h4>${outcomes.map(t=>`<button class="lm-review-row" data-go="${esc(t.id)}"><strong>${esc(t.title)}</strong><small>${esc(t.personName||'')} · ${esc(statuses[data.answers[t.id]?.status]||'Continue →')}</small></button>`).join('')}`:''}`;
  }
 }else if(isArea||current.group){
  content=`<h3>${isArea?'What would you like to check?':esc(current.question)}</h3><button class="lm-primary" id="lm-guide">Review next topic</button><div class="lm-topic-menu">${children.map(t=>`<button data-go="${esc(t.id)}">${esc(t.title)} <small>${esc(statuses[data.answers[t.id]?.status]||'Review →')}</small></button>`).join('')}</div>${addMarkup}${linksMarkup}`;
 }else if(step==='timing'){
  content=`<small>${esc(current.title)}</small><h3>How soon does this need attention?</h3><div class="lm-answer-buttons">${[['soon','Soon'],['month','This month'],['later','Later'],['unknown','Help me decide']].map(([v,l])=>`<button data-timing="${v}">${l}</button>`).join('')}</div><details class="lm-secondary"><summary>There is a specific deadline</summary><form id="lm-deadline"><label>Deadline<input type="date" name="deadline" required value="${esc(answer.deadline||'')}"></label><button>Continue</button></form></details>`;
 }else if(step==='action'){
  const r=suggestion(current);const already=api.tasks.some(t=>(data.links[current.id]||[]).includes('task:'+t.id)&&t.title===r?.action);
  content=`<small>${esc(current.title)}</small><h3>${answer.timing==='unknown'?'Let’s clarify the next step':'A manageable next step'}</h3><form id="lm-create"><label>Suggested action<input name="title" required value="${esc(r?.action||current.action)}"></label><button class="lm-primary" ${already?'disabled':''}>${already?'Already in your tasks':'Add to my tasks'}</button></form><button class="lm-next-prompt" id="lm-next">Continue without adding a task →</button>${linksMarkup}<details class="lm-secondary"><summary>Adjust the suggestion</summary><form id="lm-context"><label>What would help?<select name="support"><option value="information">Find information</option><option value="person">Talk to someone</option><option value="decision">Make a decision</option><option value="overwhelmed">Make the first step smaller</option><option value="waiting">Follow up</option></select></label><label>Why does it matter?<select name="impact"><option value="medium">Makes life easier</option><option value="high">Protects something important</option><option value="low">Nice to have</option></select></label><button>Update suggestion</button></form></details>${notesMarkup}`;
 }else{
  content=`<small>${esc(current.personName?current.personName+' · '+current.title:current.title)}</small><h3>${esc(current.question)}</h3>${answer.status?`<p class="lm-current-answer">${esc(statuses[answer.status])} · change your answer below</p>`:''}<div class="lm-answer-buttons">${[['done','Already taken care of'],['unstarted','I need to do this'],['progress','I have started'],['unsure','Not sure'],['irrelevant','Not relevant'],['defer','Ask me later']].map(([v,l])=>`<button data-answer="${v}" aria-pressed="${answer.status===v}">${l}</button>`).join('')}</div><button class="lm-next-prompt" id="lm-next">Skip for now →</button>${notesMarkup}${linksMarkup}${addMarkup}`;
 }
 root.innerHTML=`<div class="life-map lm-guided"><div class="lm-toolbar"><div role="tablist" aria-label="Life map views">${[['map','My map'],['explore','Guided review']].map(([v,l])=>`<button role="tab" aria-selected="${panel===v}" data-panel="${v}">${l}</button>`).join('')}</div><span class="lm-storage" role="status">${esc(loading?'Loading…':notice)}</span></div><div class="lm-layout">${nav}<section class="lm-interview ${panel==='map'?'lm-map-canvas':''}"><nav class="lm-breadcrumb" ${panel==='map'?'hidden':''}><button data-go="${area.id}">${esc(area.title)}</button>${current.parent&&current.parent!==area.id?`<span> / </span><button data-go="${esc(current.parent)}">${esc(topics.find(t=>t.id===current.parent)?.title)}</button>`:''}</nav>${content}</section></div><details class="lm-backup"><summary>Backup</summary><button id="lm-export">Export life map</button></details></div>`;
 async function save(){
  const snapshot=JSON.parse(JSON.stringify(data));const owner=api.userId;const client=api.client;
  const write=async()=>{try{localStorage.setItem(key,JSON.stringify(snapshot));notice='Saved in this browser.';if(client&&owner){const {error}=await client.from('planner_life_map').upsert({user_id:owner,data:snapshot,updated_at:new Date().toISOString()});notice=error?'Saved here; account sync failed.':'Saved.';}if(loadedKey===key)api.render();}catch{notice='Save failed. Please retry.';api.render();}};
  saveQueue=saveQueue.then(write,write);return saveQueue;
 }
 function go(id){selected=id;panel='explore';step='question';api.render();}
 function next(){
  if(topics.find(t=>t.id===current.parent)?.kind?.endsWith('discovery')){go(current.parent);return;}
  const siblings=topics.filter(t=>t.parent===current.parent&&!t.group);
  const index=siblings.findIndex(t=>t.id===current.id);
  const candidate=[...siblings.slice(index+1),...siblings.slice(0,index)].find(t=>!data.answers[t.id]?.status);
  go(candidate?.id||current.parent||area.id);
 }
 root.querySelectorAll('[data-go]').forEach(b=>b.onclick=()=>go(b.dataset.go));
 root.querySelectorAll('[data-panel]').forEach(b=>b.onclick=()=>{panel=b.dataset.panel;api.render();});
 root.querySelector('#lm-guide')?.addEventListener('click',()=>{const pending=children.find(t=>t.group?topics.some(child=>child.parent===t.id&&!data.answers[child.id]?.status):!data.answers[t.id]?.status);go(pending?.id||children[0]?.id||current.id);});
 root.querySelector('#lm-relationship-person')?.addEventListener('submit',async e=>{
  e.preventDefault();const values=Object.fromEntries(new FormData(e.target));let person=(api.people||[]).find(p=>p.id===values.personId);
  if(!person){const first_name=values.firstName.trim(),last_name=values.lastName.trim();if(!first_name){notice='Choose a person or enter their first name.';api.render();return;}
   const normalize=value=>value.trim().replace(/\s+/g,' ').toLowerCase();person=(api.people||[]).find(p=>normalize(labelFor(p))===normalize(`${first_name} ${last_name}`));
   if(!person){const button=e.target.querySelector('button');button.disabled=true;button.textContent='Saving person…';try{const result=await api.createPerson({id:crypto.randomUUID(),first_name,last_name,created_at:new Date().toISOString()});if(!result?.person)throw new Error('Not saved');person=result.person;}catch{notice='Person could not be saved. Your name fields are still here; please retry.';button.disabled=false;button.textContent='Continue';root.querySelector('.lm-storage').textContent=notice;return;}}
  }
  supportDraft={personId:person.id,personName:labelFor(person)};step='relationship-action';api.render();
 });
 async function createRelationship(title){const id=crypto.randomUUID();data.concerns.push({id,parent:current.id,area:area.area,title,personId:supportDraft.personId,personName:supportDraft.personName,question:`Where are you with “${title}”?`,action:title});if(supportDraft.personId)data.links[id]=['person:'+supportDraft.personId];selected=id;step='timing';data.answers[id]={status:'unstarted'};await save();}
 root.querySelectorAll('[data-relationship-action]').forEach(b=>b.onclick=async()=>{const action=b.dataset.relationshipAction;if(action==='Something else'){step='relationship-custom';api.render();return;}b.disabled=true;await createRelationship(`${action} — ${supportDraft.personName}`);});
 root.querySelector('#lm-relationship-custom')?.addEventListener('submit',async e=>{e.preventDefault();const title=new FormData(e.target).get('title').trim();if(title){e.target.querySelector('button').disabled=true;await createRelationship(title);}});
 root.querySelectorAll('[data-learning-intent]').forEach(b=>b.onclick=async()=>{b.disabled=true;const intent=b.dataset.learningIntent;const title=`${intent} ${current.title.toLowerCase()}`;const existing=children.find(t=>t.title===title);if(existing){go(existing.id);return;}const id=crypto.randomUUID();data.concerns.push({id,parent:current.id,area:area.area,title,question:`Where are you with “${title}”?`,action:intent==='Explore'?`Try one introductory ${current.title.toLowerCase()} session to see if you enjoy it.`:intent==='Improve'?`Choose one ${current.title.toLowerCase()} skill to practise this week.`:`Find a beginner ${current.title.toLowerCase()} lesson and choose a first session.`});selected=id;step='question';await save();});
 root.querySelector('#lm-learning-outcome')?.addEventListener('submit',async e=>{e.preventDefault();const title=new FormData(e.target).get('title').trim();if(!title)return;e.target.querySelector('button').disabled=true;const id=crypto.randomUUID();data.concerns.push({id,parent:current.id,area:area.area,title,question:`Where are you with “${title}”?`,action:`Choose one small practice session, introductory lesson, or resource to begin: ${title}.`});selected=id;step='question';await save();});
 root.querySelector('#lm-support-yes')?.addEventListener('click',()=>{supportDraft={};step='person';api.render();});
 root.querySelector('#lm-support-unsure')?.addEventListener('click',()=>{step='support-think';api.render();});
 root.querySelectorAll('[data-support-answer]').forEach(b=>b.onclick=async()=>{data.answers[current.id]={...answer,status:b.dataset.supportAnswer,updatedAt:new Date().toISOString()};await save();next();});
 root.querySelectorAll('[data-support-back]').forEach(b=>b.onclick=()=>{step=b.dataset.supportBack;api.render();});
 root.querySelector('#lm-support-person')?.addEventListener('submit',e=>{e.preventDefault();const values=Object.fromEntries(new FormData(e.target));const person=(api.people||[]).find(p=>p.id===values.personId);const personName=person?labelFor(person):values.personName.trim();if(!personName){notice='Choose a person or enter a name.';api.render();return;}supportDraft={personId:person?.id||null,personName};step='support-kind';api.render();});
 root.querySelectorAll('[data-support-kind]').forEach(b=>b.onclick=()=>{supportDraft.kind=b.dataset.supportKind;step='support-outcome';api.render();});
 root.querySelector('#lm-support-outcome')?.addEventListener('submit',async e=>{e.preventDefault();const title=new FormData(e.target).get('title').trim();if(!title)return;e.target.querySelector('button').disabled=true;const id=crypto.randomUUID();const outcome=supportOutcome({...supportDraft,id,title,parent:current.id,area:area.area});data.concerns.push(outcome);if(supportDraft.personId)data.links[id]=['person:'+supportDraft.personId];data.answers[current.id]={...answer,status:'progress'};selected=id;step='question';await save();});
 root.querySelectorAll('[data-answer]').forEach(b=>b.onclick=async()=>{
 root.querySelectorAll('[data-answer]').forEach(x=>x.disabled=true);
  const status=b.dataset.answer;data.answers[current.id]={...answer,status,updatedAt:new Date().toISOString(),completedAt:status==='done'?(answer.completedAt||new Date().toISOString()):null};
  if(['unstarted','progress','unsure'].includes(status))step='timing';
  await save();
  if(['done','irrelevant','defer'].includes(status)){notice=status==='done'?`${current.title} recorded as taken care of.`:'Answer saved.';next();}
 });
 root.querySelectorAll('[data-timing]').forEach(b=>b.onclick=async()=>{data.answers[current.id]={...answer,timing:b.dataset.timing};step='action';await save();});
 root.querySelector('#lm-deadline')?.addEventListener('submit',async e=>{e.preventDefault();data.answers[current.id]={...answer,deadline:new FormData(e.target).get('deadline')};step='action';await save();});
 root.querySelector('#lm-context')?.addEventListener('submit',async e=>{e.preventDefault();data.answers[current.id]={...answer,...Object.fromEntries(new FormData(e.target))};await save();});
 root.querySelector('#lm-note')?.addEventListener('submit',async e=>{e.preventDefault();data.answers[current.id]={...answer,notes:new FormData(e.target).get('notes')};await save();});
 root.querySelector('#lm-next')?.addEventListener('click',next);
 root.querySelector('#lm-custom')?.addEventListener('submit',async e=>{e.preventDefault();const title=new FormData(e.target).get('title').trim();if(!title)return;const id=crypto.randomUUID();data.concerns.push({id,parent:current.id,area:area.area,title,question:`What is the status of ${title.toLowerCase()}?`,action:`Choose one next step for ${title.toLowerCase()}.`});selected=id;step='question';await save();});
 root.querySelector('#lm-link')?.addEventListener('click',async()=>{const ref=root.querySelector('#lm-existing').value;if(!ref)return;data.links[current.id]=[...new Set([...(data.links[current.id]||[]),ref])];await save();});
 root.querySelectorAll('[data-unlink]').forEach(b=>b.onclick=async()=>{data.links[current.id]=(data.links[current.id]||[]).filter(x=>x!==b.dataset.unlink);await save();});
 root.querySelectorAll('[data-plan]').forEach(b=>b.onclick=()=>{selected=b.dataset.plan;panel='explore';step='action';api.render();});
 root.querySelector('#lm-create')?.addEventListener('submit',async e=>{
  e.preventDefault();const title=new FormData(e.target).get('title').trim();if(!title)return;e.target.querySelector('button').disabled=true;
  const refs=data.links[current.id]||[];const people=records.filter(([type,item])=>type==='person'&&refs.includes('person:'+item.id)).map(([,item])=>labelFor(item));
  try{const task=await api.createTask({title,goal_ids:refs.filter(x=>x.startsWith('goal:')).map(x=>x.slice(5)),project_id:refs.find(x=>x.startsWith('project:'))?.slice(8)||'',area:area.area,notes:`Life map: ${current.title}\n${answer.notes||''}\nPeople: ${people.join(', ')}`,due_date:answer.deadline||'',priority:answer.timing==='soon'?'High':'Medium'});if(!task)throw Error();data.links[current.id]=[...refs,'task:'+task.id];data.answers[current.id]={...answer,next:title};await save();notice='Task added.';next();}catch{notice='Could not save the task. Please retry.';api.render();}
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
