import {createTopicExclusionResolver} from './life-map-review.js?v=1.14.44';
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const nameFor = item => item?.title || item?.name || [item?.first_name,item?.last_name].filter(Boolean).join(' ') || 'Unavailable item';

export function buildLifeGraph({topics,answers={},links={},tasks=[],projects=[],goals=[],people=[],stateFor,reviewFor,interestFilter='active',hideCompleted=false}) {
 const isExcluded=createTopicExclusionResolver(topics,answers);
 const excluded=new Set(topics.filter(topic=>isExcluded(topic.id)).map(topic=>topic.id));
 let changed=true;
 while(changed){changed=false;for(const topic of topics)if(excluded.has(topic.parent)&&!excluded.has(topic.id)){excluded.add(topic.id);changed=true;}}
 if(interestFilter==='active')topics=topics.filter(topic=>!excluded.has(topic.id));
 if(interestFilter==='excluded'){
  const visible=new Set(excluded);changed=true;
  while(changed){changed=false;for(const topic of topics)if(visible.has(topic.id)&&topic.parent&&!visible.has(topic.parent)){visible.add(topic.parent);changed=true;}}
  topics=topics.filter(topic=>visible.has(topic.id));
 }
 const root={id:'life-root',label:'My life',kind:'root',status:'',children:[]};
 const nodes=new Map();
 const included=new Set(topics.filter(t=>(!reviewFor&&answers[t.id]?.reviewedAt) || t.isOutcome || (answers[t.id]?.status && answers[t.id].status!=='irrelevant') || (links[t.id]||[]).length || (t.parent && !t.suggested && !t.id.startsWith('check:') && !t.id.startsWith('learn:'))).map(t=>t.id));
 for(const id of [...included]){let t=topics.find(t=>t.id===id);const seen=new Set();while(t?.parent&&!seen.has(t.id)){seen.add(t.id);included.add(t.parent);t=topics.find(x=>x.id===t.parent);}}
 for(const t of topics.filter(t=>included.has(t.id))){const state=stateFor?.(t,answers[t.id]||{},[])||{key:'unknown',label:'Not reviewed'};nodes.set(t.id,{id:'topic:'+t.id,label:t.title,kind:!t.parent?'area':t.group||t.kind?'group':'outcome',sourceId:t.id,reviewed:reviewFor?reviewFor(t.id).key==='reviewed':Boolean(answers[t.id]?.reviewedAt||answers[t.id]?.status),status:(!t.group&&!t.kind&&t.parent?'Outcome · ':'')+(state.key==='unknown'&&(reviewFor?t.isOutcome:answers[t.id]?.reviewedAt)?'Status not set':state.label),state:state.key,children:[]});}
 for(const t of topics.filter(t=>included.has(t.id))){
  const node=nodes.get(t.id),parent=nodes.get(t.parent)||root;
  node.organizational=t.node_type==='topic';
  const sourceParent=topics.find(x=>x.id===t.parent);
  if(['support-discovery','relationship-discovery'].includes(sourceParent?.kind)&&t.personName){
   const key=`support-person:${t.parent}:${t.personId||t.personName.toLowerCase()}`;
   let person=parent.children.find(x=>x.id===key);
   if(!person){person={id:key,label:t.personName,kind:'person',status:'Person you support',children:[]};parent.children.push(person);}
   person.children.push(node);
  }else parent.children.push(node);
 }
 function taskTree(list,prefix){
  const taskNodes=new Map(list.map(t=>[t.id,{id:prefix+':task:'+t.id,label:t.title,kind:'task',taskId:t.id,status:t.status==='done'?'Task · Completed':'Task · Action',state:t.status==='done'?'complete':t.due_date&&Date.parse(t.due_date+'T23:59:59')<Date.now()?'attention':'planned',children:[]}]));
  const roots=[];
  for(const t of list){const node=taskNodes.get(t.id);let parent=taskNodes.get(t.parent_id);const seen=new Set([t.id]);let cursor=t;
   while(parent&&cursor.parent_id){if(seen.has(cursor.parent_id)){parent=null;break;}seen.add(cursor.parent_id);cursor=list.find(x=>x.id===cursor.parent_id)||{};}
   if(parent)parent.children.push(node);else roots.push(node);
  }
  return roots;
 }
 for(const t of topics.filter(t=>included.has(t.id))){
  const node=nodes.get(t.id),refs=links[t.id]||[];
  node.children.push(...taskTree(tasks.filter(task=>refs.includes('task:'+task.id)),node.id));
  for(const ref of refs){const [type,id]=ref.split(':');
   if(type==='task')continue;
   const record=(type==='project'?projects:type==='goal'?goals:people).find(x=>x.id===id);if(!record)continue;
   if(type==='person'&&id===t.personId)continue;
   const related={id:node.id+':'+ref,label:nameFor(record),kind:type,status:`Linked ${type}`,children:[]};
   if(type==='project')related.children=taskTree(tasks.filter(task=>task.project_id===id),related.id);
   if(type==='goal')related.children=taskTree(tasks.filter(task=>(task.goal_ids||[task.goal_id]).includes(id)),related.id);
   node.children.push(related);
  }
 }
 function summarize(node){
  const own=node.kind==='outcome'?{total:1,attention:node.state==='attention'?1:0,progress:node.state==='progress'?1:0,complete:node.state==='complete'?1:0,reviewed:node.reviewed?1:0}:{total:0,attention:0,progress:0,complete:0,reviewed:!reviewFor&&node.reviewed?1:0};
  for(const child of node.children){const counts=summarize(child);for(const key of Object.keys(own))own[key]+=counts[key];}
  if(['root','area','group','person'].includes(node.kind)&&own.total){node.status=`${own.total} outcomes · ${own.attention} attention · ${own.complete} complete · ${own.reviewed} reviewed`;node.state=own.attention?'attention':own.progress?'progress':'unknown';}
  else if(node.reviewed)node.status+=' · Reviewed';
  if(reviewFor&&['area','group'].includes(node.kind)){
   const review=reviewFor(node.sourceId);
   if(review.key==='reviewed'||review.key==='partial')node.status+=' · '+review.label;
  }else if(!reviewFor&&['area','group'].includes(node.kind)&&own.reviewed){
   const ids=new Set([node.sourceId]);let changed=true;
   while(changed){changed=false;for(const topic of topics)if(ids.has(topic.parent)&&!ids.has(topic.id)){ids.add(topic.id);changed=true;}}
   const reviewed=[...ids].filter(id=>answers[id]?.reviewedAt||answers[id]?.status).length;
   node.status+=reviewed===ids.size?' · Reviewed':' · Partially reviewed';
  }
  if(excluded.has(node.sourceId)){node.status='Not of interest · Reviewed';node.state='inactive';}
  if(!node.organizational&&!excluded.has(node.sourceId)&&['done','well'].includes(answers[node.sourceId]?.status)){
   node.state='complete';
   if(!node.status.includes('Taken care of'))node.status='Taken care of · '+node.status;
  }
  return own;
 }
 summarize(root);
 if(hideCompleted){
  function hasUnfinished(node){
   const explicit=answers[node.sourceId]?.status;
   const unfinishedSelf=node.taskId?node.state!=='complete':
    node.kind==='outcome'?node.state!=='complete'&&node.state!=='inactive':
    Boolean(node.sourceId&&explicit&&!['done','well','irrelevant','uninterested','defer'].includes(explicit));
   return unfinishedSelf||node.children.some(hasUnfinished);
  }
  function prune(node){
   const hadChildren=node.children.length>0;
   const pendingBelow=node.children.some(hasUnfinished);
   if(node.state==='complete'&&!pendingBelow)return null;
   node.children=node.children.map(prune).filter(Boolean);
   if(node.state==='complete'&&pendingBelow)node.status+=' · Unfinished items below';
   const structural=['area','group','person','project','goal'].includes(node.kind);
   if(structural&&hadChildren&&!node.children.length&&!answers[node.sourceId]?.status)return null;
   return node;
  }
  root.children=root.children.map(prune).filter(Boolean);
 }
 return root;
}

export function layoutLifeGraph(root,collapsed=new Set()) {
 const nodes=[],edges=[];let row=0,maxDepth=0;
 function visit(node,depth){
  const children=collapsed.has(node.id)?[]:node.children;
  const start=row;
  const placed={...node,x:depth*278+20,y:0,hiddenCount:collapsed.has(node.id)?node.children.length:0};
  nodes.push(placed);maxDepth=Math.max(maxDepth,depth);
  if(!children.length){placed.y=row*94+20;row++;}
  else{const childNodes=children.map(child=>visit(child,depth+1));placed.y=(childNodes[0].y+childNodes.at(-1).y)/2;for(const child of childNodes)edges.push({from:placed.id,to:child.id,x1:placed.x+230,y1:placed.y+34,x2:child.x,y2:child.y+34});}
  return placed;
 }
 visit(root,0);
 return {nodes,edges,width:(maxDepth+1)*278+20,height:Math.max(row*94+30,240)};
}
let collapsed=new Set(),initializedOutcomes=new Set(),zoom=0.8,graphScroll=null;
export function graphMarkup(root){
 function initialize(node){if(!root.expandTasks&&node.kind==='outcome'&&node.children.some(child=>child.kind==='task')&&!initializedOutcomes.has(node.id)){collapsed.add(node.id);initializedOutcomes.add(node.id);}node.children.forEach(initialize);}
 initialize(root);
 const layout=layoutLifeGraph(root,collapsed);
 const nodes=layout.nodes.map(n=>`<div class="lm-graph-node lm-graph-${escapeHtml(n.kind)} lm-graph-state-${escapeHtml(n.state||'unknown')}" style="left:${n.x}px;top:${n.y}px" data-node="${escapeHtml(n.id)}"><button class="lm-graph-label" ${n.sourceId?`data-go="${escapeHtml(n.sourceId)}"`:n.taskId?`data-graph-task="${escapeHtml(n.taskId)}"`:'disabled'} aria-label="${n.state==='complete'?'Completed — ':''}${escapeHtml(n.label)}${n.sourceId?' — open guided review':''}"><strong>${n.state==='complete'?'<span class="lm-complete-check" aria-hidden="true">✓</span> ':''}${escapeHtml(n.label)}</strong><small>${escapeHtml((n.status||'Life areas → outcomes → actions')+(n.kind==='outcome'&&n.children.some(c=>c.kind==='task')?' · '+n.children.filter(c=>c.kind==='task').length+' tasks':''))}</small></button>${n.children.length?`<button class="lm-graph-toggle" data-collapse="${escapeHtml(n.id)}" aria-label="${collapsed.has(n.id)?'Expand':'Collapse'} ${escapeHtml(n.label)}" aria-expanded="${!collapsed.has(n.id)}">${collapsed.has(n.id)?'+':'−'}</button>`:''}</div>`).join('');
 const edges=layout.edges.map(e=>`<path d="M ${e.x1} ${e.y1} C ${e.x1+24} ${e.y1}, ${e.x2-24} ${e.y2}, ${e.x2} ${e.y2}"/>`).join('');
 return `<div class="lm-graph-controls"><button data-graph-zoom="out" aria-label="Zoom out">−</button><output id="lm-zoom-label">${Math.round(zoom*100)}%</output><button data-graph-zoom="in" aria-label="Zoom in">+</button><button data-graph-zoom="fit">Fit graph</button><button data-graph-zoom="reset">100%</button><button id="lm-expand-all">Expand all</button><button id="lm-collapse-areas">Life areas only</button></div><p class="lm-graph-help">Follow the lines from left to right. Use + / − on a branch to expand or collapse. Click an outcome to review it.</p><div class="lm-graph-scroll" tabindex="0" aria-label="Life hierarchy graph, scroll to explore"><div class="lm-graph-space" style="width:${layout.width*zoom}px;height:${layout.height*zoom}px"><div class="lm-graph-stage" style="width:${layout.width}px;height:${layout.height}px;transform:scale(${zoom})"><svg width="${layout.width}" height="${layout.height}" aria-hidden="true">${edges}</svg>${nodes}</div></div></div><div class="lm-graph-task-detail" role="status"></div>`;
}
export function bindGraph(root,tree,rerender,tasks){
 const viewport=root.querySelector('.lm-graph-scroll');if(!viewport)return;
 const layout=layoutLifeGraph(tree,collapsed);
 if(graphScroll){viewport.scrollLeft=graphScroll.x;viewport.scrollTop=graphScroll.y;}else viewport.scrollTop=Math.max(0,layout.nodes[0].y*zoom-viewport.clientHeight/2+34*zoom);
 viewport.onscroll=()=>{graphScroll={x:viewport.scrollLeft,y:viewport.scrollTop};};
 function setZoom(value){zoom=Math.max(.2,Math.min(1.6,value));const stage=root.querySelector('.lm-graph-stage'),space=root.querySelector('.lm-graph-space');stage.style.transform=`scale(${zoom})`;space.style.width=layout.width*zoom+'px';space.style.height=layout.height*zoom+'px';root.querySelector('#lm-zoom-label').textContent=Math.round(zoom*100)+'%';}
 root.querySelectorAll('[data-graph-zoom]').forEach(b=>b.onclick=()=>{const action=b.dataset.graphZoom;setZoom(action==='fit'?Math.min((viewport.clientWidth-24)/layout.width,(viewport.clientHeight-24)/layout.height):action==='reset'?1:zoom+(action==='in'?.15:-.15));});
 root.querySelectorAll('[data-collapse]').forEach(b=>b.onclick=()=>{const id=b.dataset.collapse;collapsed.has(id)?collapsed.delete(id):collapsed.add(id);rerender();});
 root.querySelector('#lm-expand-all').onclick=()=>{collapsed.clear();graphScroll=null;rerender();};
 root.querySelector('#lm-collapse-areas').onclick=()=>{collapsed=new Set(tree.children.map(n=>n.id));graphScroll=null;rerender();};
 root.querySelectorAll('[data-graph-task]').forEach(b=>b.onclick=()=>{const task=tasks.find(t=>t.id===b.dataset.graphTask);const detail=root.querySelector('.lm-graph-task-detail');detail.innerHTML=`<strong>${escapeHtml(task?.title)}</strong><p>${escapeHtml(task?.notes||'')}</p><button data-toggle="${escapeHtml(task.id)}">${task.status==='done'?'Reopen':'Complete'}</button>`;detail.querySelector('button').onclick=()=>root.dispatchEvent(new CustomEvent('life-map-task-toggle',{detail:task.id}));});
}

export function buildOutcomeTaskGraph({topics,answers={},links={},tasks=[],stateFor}){
 const chosen=topics.filter(t=>t.parent&&!t.group&&!t.kind&&(answers[t.id]?.status||(links[t.id]||[]).length||!t.suggested));
 const leaves=chosen.filter(t=>!chosen.some(other=>{let node=other;const seen=new Set();while(node?.parent&&!seen.has(node.id)){seen.add(node.id);if(node.parent===t.id)return true;node=topics.find(x=>x.id===node.parent);}return false;}));
 return {id:'outcome-task-root',expandTasks:true,label:'Outcomes and tasks',kind:'root',children:leaves.map(t=>{
  const state=stateFor?.(t,answers[t.id]||{},[])||{label:'Not reviewed',key:'unknown'};
  const linked=tasks.filter(task=>!task.parent_id&&(links[t.id]||[]).includes('task:'+task.id));
  return {id:'focused-outcome:'+t.id,label:t.title,kind:'outcome',sourceId:t.id,status:'Outcome · '+state.label,state:state.key,children:linked.map(task=>({id:t.id+':task:'+task.id,label:task.title,kind:'task',taskId:task.id,status:'Task',children:tasks.filter(child=>child.parent_id===task.id).map(child=>({id:t.id+':subtask:'+child.id,label:child.title,kind:'task',taskId:child.id,status:'Subtask',children:[]}))}))};
 })};
}
