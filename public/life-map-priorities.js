import {createTopicExclusionResolver} from './life-map-review.js?v=1.14.44';
import {bindTopicTooltips} from './life-map-help.js?v=1.14.83';

export const priorityStatuses=[['done','Already taken care of'],['unstarted','I need to do this'],['progress','I have started'],['unsure','Not sure']];
const complete=status=>['done','well'].includes(status);
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const urgencyChoices=[['','Not specified'],['day','Within a day'],['week','Within a week'],['month','Within a month'],['quarter','Within 3 months'],['year','Within a year'],['two-years','Within 2 years'],['decade','Within a decade'],['date','Specific date']];
export function urgencyDate(answer={},now=new Date()){
 if(answer.deadline){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(answer.deadline))return Infinity;
  const date=new Date(answer.deadline+'T12:00:00');
  const [year,month,day]=answer.deadline.split('-').map(Number);
  return date.getFullYear()===year&&date.getMonth()===month-1&&date.getDate()===day?date.getTime():Infinity;
 }
 const months={month:1,quarter:3,year:12,'two-years':24,decade:120}[answer.timing];
 if(!months&&!['day','soon','week'].includes(answer.timing))return Infinity;
 const date=new Date(answer.timingSetAt||answer.reviewedAt||answer.updatedAt||now);
 if(!Number.isFinite(date.getTime()))return Infinity;
 date.setHours(12,0,0,0);
 if(months){const day=date.getDate();date.setDate(1);date.setMonth(date.getMonth()+months);const last=new Date(date.getFullYear(),date.getMonth()+1,0).getDate();date.setDate(Math.min(day,last));}
 else date.setDate(date.getDate()+(answer.timing==='day'?1:7));
 return date.getTime();
}
export function setOutcomeUrgency(data,id,timing,deadline='',now=new Date().toISOString()){
 if(!urgencyChoices.some(([value])=>value===timing))throw new Error('Unsupported urgency');
 if(deadline&&(!/^\d{4}-\d{2}-\d{2}$/.test(deadline)||!Number.isFinite(urgencyDate({deadline}))))throw new Error('Invalid deadline');
 data.answers[id]={...(data.answers[id]||{}),timing,timingSetAt:now,deadline:timing==='date'?deadline:''};
}

export function setOutcomeStatus(data,id,status,time=new Date().toISOString()){
 if(!priorityStatuses.some(([value])=>value===status))throw new Error('Unsupported outcome status');
 const previous=data.answers[id]||{};
 data.answers[id]={...previous,status,reviewedAt:previous.reviewedAt||time,updatedAt:time,completedAt:complete(status)?(complete(previous.status)?previous.completedAt||time:time):null};
}

export function priorityItems(topics,data,now=new Date()){
 const excluded=createTopicExclusionResolver(topics,data.answers);
 const concerns=new Set((data.concerns||[]).map(topic=>topic.id));
 const outcomes=topics.filter(topic=>topic.parent&&!topic.group&&!topic.kind&&!excluded(topic.id)&&data.answers[topic.id]?.status!=='irrelevant'&&(concerns.has(topic.id)||data.answers[topic.id]?.status||(data.links[topic.id]||[]).length));
 const byId=new Map(topics.map(topic=>[topic.id,topic]));
 const parents=new Set();
 for(const outcome of outcomes){let parent=byId.get(outcome.parent);const seen=new Set();while(parent&&!seen.has(parent.id)){seen.add(parent.id);parents.add(parent.id);parent=byId.get(parent.parent);}}
 const leaves=outcomes.filter(topic=>!parents.has(topic.id));
 const ids=new Set(leaves.map(topic=>topic.id));
 const order=[...new Set((data.priorityOrder||[]).filter(id=>typeof id==='string'))];
 for(const topic of leaves)if(!order.includes(topic.id))order.push(topic.id);
 const rank=new Map(order.map((id,index)=>[id,index]));
 const active=leaves.filter(topic=>!complete(data.answers[topic.id]?.status)).sort((a,b)=>rank.get(a.id)-rank.get(b.id));
 if(data.prioritySort==='urgency')active.sort((a,b)=>{
  const first=urgencyDate(data.answers[a.id],now),second=urgencyDate(data.answers[b.id],now);
  return first===second?rank.get(a.id)-rank.get(b.id):first<second?-1:1;
 });
 const completed=leaves.filter(topic=>complete(data.answers[topic.id]?.status)).sort((a,b)=>{
  const timestamp=id=>{const answer=data.answers[id]||{};return Date.parse(answer.completedAt||answer.updatedAt||answer.reviewedAt||'')||0;};
  return timestamp(b.id)-timestamp(a.id)||rank.get(a.id)-rank.get(b.id);
 });
 return {active,completed,order,ids};
}

export function reorderPriorities(data,active,id,targetId){
 const ids=active.map(topic=>topic.id);
 if(id===targetId||!ids.includes(id)||!ids.includes(targetId))return false;
 const targetIndex=ids.indexOf(targetId);
 ids.splice(ids.indexOf(id),1);ids.splice(targetIndex,0,id);
 data.priorityOrder=[...ids,...(data.priorityOrder||[]).filter(item=>!ids.includes(item))];
 return true;
}

const taskDraftCache=new WeakMap();
export function renderPriorityView(root,{topics,data,tasks,notice,save,openOutcome,openTask,changePanel,addTask,toggleTask,refresh}){
 const model=priorityItems(topics,data);
 if(!taskDraftCache.has(data))taskDraftCache.set(data,new Map());
 const drafts=taskDraftCache.get(data);
 const byUrgency=data.prioritySort==='urgency';
 const byId=new Map(topics.map(topic=>[topic.id,topic]));
 function path(topic){const names=[],seen=new Set([topic.id]);let parent=byId.get(topic.parent);while(parent&&!seen.has(parent.id)){seen.add(parent.id);names.unshift(parent.title);parent=byId.get(parent.parent);}return names.join(' / ');}
 function row(topic,index,finished){
  const answer=data.answers[topic.id]||{},refs=new Set(data.links[topic.id]||[]),linked=tasks.filter(task=>refs.has('task:'+task.id));
  const listMarkup=linked.length?`<ul class="lm-priority-tasks">${linked.map(task=>`<li class="${task.status==='done'?'lm-priority-task-done':''}">${toggleTask?`<input type="checkbox" data-priority-task-toggle="${esc(task.id)}" aria-label="Complete ${esc(task.title)}"${task.status==='done'?' checked':''}>`:''}<button type="button" data-priority-task="${esc(task.id)}">${esc(task.title)}</button></li>`).join('')}</ul>`:'';
  const draft=drafts.get(topic.id)||{title:'',taskId:'',saving:false,error:''};drafts.set(topic.id,draft);
  const taskMarkup=addTask?`<div class="lm-priority-task-area">${listMarkup}${finished?'':`<form data-outcome-add="${esc(topic.id)}"><input name="title" aria-label="New task for ${esc(topic.title)}" placeholder="Add a task…" required maxlength="300" value="${esc(draft.title)}"${draft.saving||draft.taskId?' disabled':''}><button type="submit" title="Add task" aria-label="Add task to ${esc(topic.title)}"${draft.saving?' disabled':''}>+</button></form>`}<p class="priority-task-error" role="alert">${esc(draft.error)}</p></div>`:listMarkup;
  const timing=answer.deadline?'date':answer.timing==='soon'?'week':answer.timing||'';
  const deadline=urgencyDate(answer),overdue=Number.isFinite(deadline)&&deadline<new Date().setHours(0,0,0,0);
  const urgency=`<div class="lm-priority-urgency"><select data-priority-timing="${esc(topic.id)}" aria-label="Needed by for ${esc(topic.title)}">${urgencyChoices.map(([value,label])=>`<option value="${value}"${timing===value?' selected':''}>${label}</option>`).join('')}</select>${timing==='date'?`<input type="date" data-priority-deadline="${esc(topic.id)}" aria-label="Deadline for ${esc(topic.title)}" value="${esc(answer.deadline||'')}">`:''}${overdue?'<small class="lm-overdue">Overdue</small>':''}</div>`;
  return `<article class="lm-priority-row${finished?' lm-priority-completed':''}" data-priority-id="${esc(topic.id)}"><div class="lm-priority-heading">${finished||byUrgency?'':`<div class="lm-priority-move"><button type="button" draggable="true" data-priority-drag="${esc(topic.id)}" aria-label="Drag to reorder ${esc(topic.title)}" title="Drag to reorder">↕</button><button type="button" data-priority-move="up" data-id="${esc(topic.id)}" aria-label="Move ${esc(topic.title)} up"${index===0?' disabled':''}>↑</button><button type="button" data-priority-move="down" data-id="${esc(topic.id)}" aria-label="Move ${esc(topic.title)} down"${index===model.active.length-1?' disabled':''}>↓</button></div>`}<div class="lm-priority-name"><small>${esc(path(topic))}</small><button type="button" data-priority-open="${esc(topic.id)}">${esc(topic.title)}</button>${finished?'':urgency}</div>${finished?'':`<span class="lm-priority-rank">${index+1}</span>`}</div><div class="lm-priority-statuses" role="group" aria-label="Status of ${esc(topic.title)}">${priorityStatuses.map(([value,label])=>`<button type="button" data-priority-status="${value}" data-id="${esc(topic.id)}" aria-pressed="${answer.status===value||(value==='done'&&answer.status==='well')}">${label}</button>`).join('')}</div>${taskMarkup}</article>`;
 }
 root.innerHTML=`<section class="life-map lm-priorities"><div class="lm-toolbar"><div role="tablist" aria-label="Life map views">${[['map','My map'],['explore','Guided review'],['interview','Ask me'],['priorities','Priorities']].map(([value,label])=>`<button type="button" role="tab" aria-selected="${value==='priorities'}" data-priority-panel="${value}">${label}</button>`).join('')}</div><span class="lm-storage" role="status">${esc(notice)}</span></div><div class="lm-priorities-heading"><h3>Outcome priorities <small>${model.active.length}</small></h3><label>Sort <select data-priority-sort aria-label="Rank outcomes by"><option value="importance"${byUrgency?'':' selected'}>Importance</option><option value="urgency"${byUrgency?' selected':''}>Urgency</option></select></label></div><div class="lm-priority-list">${model.active.map((topic,index)=>row(topic,index,false)).join('')||'<p>No unfinished outcomes.</p>'}</div><section class="lm-priority-finished"><h3>Completed <small>${model.completed.length}</small></h3>${model.completed.map((topic,index)=>row(topic,index,true)).join('')||'<p>No completed outcomes.</p>'}</section></section>`;
 root.querySelectorAll('[data-priority-sort]').forEach(select=>select.onchange=async()=>{data.prioritySort=select.value==='urgency'?'urgency':'importance';await save();});
 root.querySelectorAll('[data-priority-timing]').forEach(select=>select.onchange=async()=>{select.disabled=true;setOutcomeUrgency(data,select.dataset.priorityTiming,select.value);await save();});
 root.querySelectorAll('[data-priority-deadline]').forEach(input=>input.onchange=async()=>{if(!input.validity.valid)return;input.disabled=true;setOutcomeUrgency(data,input.dataset.priorityDeadline,'date',input.value);await save();});
 root.querySelectorAll('[data-priority-panel]').forEach(button=>button.onclick=()=>changePanel(button.dataset.priorityPanel));
 root.querySelectorAll('[data-priority-open]').forEach(button=>button.onclick=()=>openOutcome(button.dataset.priorityOpen));
 root.querySelectorAll('[data-priority-task]').forEach(button=>button.onclick=()=>openTask(button.dataset.priorityTask));
 root.querySelectorAll('[data-priority-task-toggle]').forEach(input=>input.onchange=async()=>{input.disabled=true;try{await toggleTask(input.dataset.priorityTaskToggle);}catch(error){input.checked=!input.checked;input.disabled=false;const message=input.closest('article').querySelector('[role=alert]');if(message)message.textContent=error.message;}});
 root.querySelectorAll('[data-outcome-add]').forEach(form=>{
  const draft=drafts.get(form.dataset.outcomeAdd),input=form.querySelector('input');
  input.oninput=()=>{draft.title=input.value;};
  form.onsubmit=async event=>{
   event.preventDefault();if(draft.saving)return;draft.title=input.value.trim();if(!draft.title)return;
   draft.saving=true;form.querySelector('button').disabled=true;
   try{await addTask(form.dataset.outcomeAdd,draft.title,draft.taskId);draft.title='';draft.taskId='';draft.error='';}
   catch(error){draft.error=error.message;if(error.taskId)draft.taskId=error.taskId;}
   finally{draft.saving=false;if(refresh)refresh();else await save();root.querySelector?.(`[data-outcome-add="${form.dataset.outcomeAdd}"] input`)?.focus();}
  };
 });
 root.querySelectorAll('[data-priority-status]').forEach(button=>button.onclick=async()=>{button.disabled=true;setOutcomeStatus(data,button.dataset.id,button.dataset.priorityStatus);await save();});
 root.querySelectorAll('[data-priority-move]').forEach(button=>button.onclick=async()=>{
  const index=model.active.findIndex(topic=>topic.id===button.dataset.id),offset=button.dataset.priorityMove==='up'?-1:1;
  const reordered=[...model.active],item=reordered.splice(index,1)[0];reordered.splice(index+offset,0,item);
  data.priorityOrder=[...reordered.map(topic=>topic.id),...model.order.filter(id=>!model.active.some(topic=>topic.id===id))];
  button.disabled=true;await save();
 });
 root.querySelectorAll('[data-priority-drag]').forEach(button=>{
  button.draggable=false;
  let pointer=null;
  const clear=()=>root.querySelectorAll('.lm-priority-drop-target').forEach(row=>row.classList.remove('lm-priority-drop-target'));
  const target=event=>root.ownerDocument.elementFromPoint(event.clientX,event.clientY)?.closest('.lm-priority-list [data-priority-id]');
  button.onpointerdown=event=>{if(event.button!==0)return;event.preventDefault();button.focus();pointer=event.pointerId;button.setPointerCapture(pointer);};
  button.onpointermove=event=>{if(pointer!==event.pointerId)return;clear();target(event)?.classList.add('lm-priority-drop-target');};
  button.onpointercancel=()=>{pointer=null;clear();};
  button.onpointerup=async event=>{
   if(pointer!==event.pointerId)return;pointer=null;clear();
   const row=target(event);
   if(row&&reorderPriorities(data,model.active,button.dataset.priorityDrag,row.dataset.priorityId))await save();
  };
 });
 root.querySelectorAll('.lm-priority-list [data-priority-id]').forEach(row=>{
  if(byUrgency)return;
  row.ondragover=event=>{event.preventDefault();event.dataTransfer.dropEffect='move';};
  row.ondrop=async event=>{event.preventDefault();if(reorderPriorities(data,model.active,event.dataTransfer.getData('text/plain'),row.dataset.priorityId))await save();};
 });
 if(root.ownerDocument)bindTopicTooltips(root,topics,data.answers);
 return model;
}
