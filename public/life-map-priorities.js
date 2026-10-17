import {createTopicExclusionResolver} from './life-map-review.js?v=1.14.44';

export const priorityStatuses=[['done','Already taken care of'],['unstarted','I need to do this'],['progress','I have started'],['unsure','Not sure']];
const complete=status=>['done','well'].includes(status);
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

export function setOutcomeStatus(data,id,status,time=new Date().toISOString()){
 if(!priorityStatuses.some(([value])=>value===status))throw new Error('Unsupported outcome status');
 const previous=data.answers[id]||{};
 data.answers[id]={...previous,status,reviewedAt:previous.reviewedAt||time,updatedAt:time,completedAt:complete(status)?(complete(previous.status)?previous.completedAt||time:time):null};
}

export function priorityItems(topics,data){
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

export function renderPriorityView(root,{topics,data,tasks,notice,save,openOutcome,openTask,changePanel}){
 const model=priorityItems(topics,data);
 const byId=new Map(topics.map(topic=>[topic.id,topic]));
 function path(topic){const names=[],seen=new Set([topic.id]);let parent=byId.get(topic.parent);while(parent&&!seen.has(parent.id)){seen.add(parent.id);names.unshift(parent.title);parent=byId.get(parent.parent);}return names.join(' / ');}
 function row(topic,index,finished){
  const answer=data.answers[topic.id]||{},refs=new Set(data.links[topic.id]||[]),linked=tasks.filter(task=>refs.has('task:'+task.id));
  return `<article class="lm-priority-row${finished?' lm-priority-completed':''}" data-priority-id="${esc(topic.id)}"><div class="lm-priority-heading">${finished?'':`<div class="lm-priority-move"><button type="button" draggable="true" data-priority-drag="${esc(topic.id)}" aria-label="Drag to reorder ${esc(topic.title)}" title="Drag to reorder">↕</button><button type="button" data-priority-move="up" data-id="${esc(topic.id)}" aria-label="Move ${esc(topic.title)} up"${index===0?' disabled':''}>↑</button><button type="button" data-priority-move="down" data-id="${esc(topic.id)}" aria-label="Move ${esc(topic.title)} down"${index===model.active.length-1?' disabled':''}>↓</button></div>`}<div class="lm-priority-name"><small>${esc(path(topic))}</small><button type="button" data-priority-open="${esc(topic.id)}">${esc(topic.title)}</button></div>${finished?'':`<span class="lm-priority-rank">${index+1}</span>`}</div><div class="lm-priority-statuses" role="group" aria-label="Status of ${esc(topic.title)}">${priorityStatuses.map(([value,label])=>`<button type="button" data-priority-status="${value}" data-id="${esc(topic.id)}" aria-pressed="${answer.status===value||(value==='done'&&answer.status==='well')}">${label}</button>`).join('')}</div><ul class="lm-priority-tasks">${linked.map(task=>`<li class="${task.status==='done'?'lm-priority-task-done':''}"><button type="button" data-priority-task="${esc(task.id)}">${task.status==='done'?'✓ ':''}${esc(task.title)}</button></li>`).join('')||'<li class="lm-subtle">No linked tasks</li>'}</ul></article>`;
 }
 root.innerHTML=`<section class="life-map lm-priorities"><div class="lm-toolbar"><div role="tablist" aria-label="Life map views">${[['map','My map'],['explore','Guided review'],['interview','Ask me'],['priorities','Priorities']].map(([value,label])=>`<button type="button" role="tab" aria-selected="${value==='priorities'}" data-priority-panel="${value}">${label}</button>`).join('')}</div><span class="lm-storage" role="status">${esc(notice)}</span></div><h3>Priorities <small>${model.active.length}</small></h3><div class="lm-priority-list">${model.active.map((topic,index)=>row(topic,index,false)).join('')||'<p>No unfinished outcomes.</p>'}</div><section class="lm-priority-finished"><h3>Completed <small>${model.completed.length}</small></h3>${model.completed.map((topic,index)=>row(topic,index,true)).join('')||'<p>No completed outcomes.</p>'}</section></section>`;
 root.querySelectorAll('[data-priority-panel]').forEach(button=>button.onclick=()=>changePanel(button.dataset.priorityPanel));
 root.querySelectorAll('[data-priority-open]').forEach(button=>button.onclick=()=>openOutcome(button.dataset.priorityOpen));
 root.querySelectorAll('[data-priority-task]').forEach(button=>button.onclick=()=>openTask(button.dataset.priorityTask));
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
  row.ondragover=event=>{event.preventDefault();event.dataTransfer.dropEffect='move';};
  row.ondrop=async event=>{event.preventDefault();if(reorderPriorities(data,model.active,event.dataTransfer.getData('text/plain'),row.dataset.priorityId))await save();};
 });
 return model;
}
