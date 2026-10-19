import {addHierarchyNode,updateHierarchyNode,setHierarchyHidden,hierarchyDescendants,hierarchyNodeType} from './life-map-hierarchy.js?v=1.14.84';
import {bindTopicTooltips} from './life-map-help.js?v=1.14.84';
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const views=new WeakMap();
export function renderHierarchyEditor(root,{data,getTopics,persist,cloud,loading,startId,openNode,close}){
 if(!views.has(data))views.set(data,{selected:startId||'home',expanded:new Set(),status:'',error:false,busy:false});
 const view=views.get(data);
 if(startId&&!view.busy)view.selected=startId;
 function draw(){
  const topics=getTopics(),all=getTopics(true),byId=new Map(topics.map(topic=>[topic.id,topic]));
  const selected=byId.get(view.selected)||topics.find(topic=>!topic.parent);if(!selected)return;
  view.selected=selected.id;
  let parent=byId.get(selected.parent);const ancestors=new Set();while(parent&&!ancestors.has(parent.id)){ancestors.add(parent.id);view.expanded.add(parent.id);parent=byId.get(parent.parent);}
  function path(topic){const labels=[topic.title],seen=new Set([topic.id]);let item=byId.get(topic.parent);while(item&&!seen.has(item.id)){seen.add(item.id);labels.unshift(item.title);item=byId.get(item.parent);}return labels.join(' / ');}
  const children=new Map();for(const topic of topics){if(!children.has(topic.parent))children.set(topic.parent,[]);children.get(topic.parent).push(topic);}
  function branch(topic){
   const nested=children.get(topic.id)||[],button=`<button type="button" data-hierarchy-select="${esc(topic.id)}" data-topic-tooltip="${esc(topic.id)}"${selected.id===topic.id?' aria-current="true"':''}><span>${esc(topic.title)}</span><small>${hierarchyNodeType(topic)==='topic'?'Topic':'Outcome'}</small></button>`;
   return `<li>${nested.length?`<details data-hierarchy-expand="${esc(topic.id)}"${view.expanded.has(topic.id)?' open':''}><summary>${button}</summary><ul>${nested.map(branch).join('')}</ul></details>`:button}</li>`;
  }
  const forbidden=hierarchyDescendants(topics,selected.id),parents=topics.filter(topic=>!forbidden.has(topic.id)).sort((a,b)=>path(a).localeCompare(path(b)));
  const deleted=all.filter(topic=>data.nodeEdits?.[topic.id]?.hidden);
  root.innerHTML=`<section class="life-map lm-hierarchy"><div class="lm-hierarchy-toolbar"><h3>Edit hierarchy</h3><button type="button" data-hierarchy-close>Back to My map</button></div><p class="lm-hierarchy-feedback" role="${view.error?'alert':'status'}">${esc(loading?'Loading…':view.status)}</p>${view.error?'<button type="button" data-hierarchy-retry>Retry save</button>':''}<div class="lm-hierarchy-layout"><nav class="lm-hierarchy-tree" aria-label="Outcome hierarchy"><ul>${(children.get(undefined)||[]).map(branch).join('')}</ul></nav><section class="lm-hierarchy-editor" aria-label="Selected node"><h4>${esc(selected.title)}</h4><form data-hierarchy-edit><label>Name<input name="title" required maxlength="200" value="${esc(selected.title)}"></label><label>Type<select name="nodeType"${selected.parent?'':' disabled'}><option value="topic"${hierarchyNodeType(selected)==='topic'?' selected':''}>Topic</option><option value="outcome"${hierarchyNodeType(selected)==='outcome'?' selected':''}>Outcome</option></select></label><label>Parent<select name="parent"${selected.parent?'':' disabled'}>${selected.parent?parents.map(topic=>`<option value="${esc(topic.id)}"${topic.id===selected.parent?' selected':''}>${esc(path(topic))}</option>`).join(''):'<option value="">Top level</option>'}</select></label><div class="lm-hierarchy-actions"><button type="submit">Save changes</button><button type="button" data-hierarchy-open>Open ${hierarchyNodeType(selected)}</button>${selected.parent?'<button type="button" class="danger-button" data-hierarchy-delete>Delete branch</button>':''}</div></form><h4>Add child</h4><form data-hierarchy-add><label>Name<input name="title" required maxlength="200" placeholder="Name the topic or desired result"></label><label>Type<select name="nodeType"><option value="topic">Topic</option><option value="outcome">Outcome</option></select></label><button type="submit">Add child</button></form></section></div>${deleted.length?`<details class="lm-hierarchy-removed"><summary>Deleted branches (${deleted.length})</summary>${deleted.map(topic=>`<div><span>${esc(topic.title)}</span><button type="button" data-hierarchy-restore="${esc(topic.id)}">Restore</button></div>`).join('')}</details>`:''}<dialog class="lm-hierarchy-confirm" aria-labelledby="lm-hierarchy-delete-title"><h3 id="lm-hierarchy-delete-title">Delete this branch?</h3><p>${esc(selected.title)}</p><p>It can be restored from Deleted branches. Tasks, projects, people, and saved links are kept.</p><form method="dialog"><button value="cancel">Cancel</button><button value="delete" class="danger-button">Delete branch</button></form></dialog></section>`;
  root.querySelector('.lm-hierarchy-actions').insertAdjacentHTML('beforebegin',`<label class="lm-hierarchy-description">Description<textarea name="description" rows="3">${esc(selected.description||'')}</textarea></label>`);
  const controls=[...root.querySelectorAll('input,select,textarea,button')];if(view.busy||loading)controls.forEach(control=>control.disabled=true);
  root.querySelector('[data-hierarchy-close]').onclick=close;
  root.querySelectorAll('[data-hierarchy-select]').forEach(button=>button.onclick=event=>{event.preventDefault();view.selected=button.dataset.hierarchySelect;draw();});
  root.querySelectorAll('[data-hierarchy-expand]').forEach(details=>details.ontoggle=()=>{if(details.open)view.expanded.add(details.dataset.hierarchyExpand);else view.expanded.delete(details.dataset.hierarchyExpand);});
  root.querySelector('[data-hierarchy-open]').onclick=()=>openNode(selected.id);
  async function commit(change){
   if(view.busy||loading)return;view.busy=true;view.error=false;view.status='Saving…';let changed=false;
   try{change?.();changed=true;draw();await persist();view.status=cloud?'Saved to database.':'Saved in this browser.';}
   catch(error){view.error=true;view.status=changed?`Not saved to database: ${error.message}. Your changes are kept in this browser; retry saving.`:error.message;}
   finally{view.busy=false;draw();}
  }
  root.querySelector('[data-hierarchy-edit]').onsubmit=event=>{event.preventDefault();const fields=new FormData(event.target);void commit(()=>updateHierarchyNode(data,topics,selected.id,{title:fields.get('title'),parent:selected.parent?fields.get('parent'):'',node_type:selected.parent?fields.get('nodeType'):'topic',description:fields.get('description')}));};
  root.querySelector('[data-hierarchy-add]').onsubmit=event=>{event.preventDefault();const fields=new FormData(event.target);void commit(()=>{const node=addHierarchyNode(data,topics,{id:crypto.randomUUID(),parent:selected.id,title:fields.get('title'),node_type:fields.get('nodeType')});view.expanded.add(selected.id);view.selected=node.id;});};
  root.querySelector('[data-hierarchy-retry]')?.addEventListener('click',()=>void commit());
  const dialog=root.querySelector('dialog');
  root.querySelector('[data-hierarchy-delete]')?.addEventListener('click',()=>dialog.showModal());
  dialog.addEventListener('close',()=>{if(dialog.returnValue==='delete')void commit(()=>{setHierarchyHidden(data,all,selected.id,true);view.selected=selected.parent;});});
  root.querySelectorAll('[data-hierarchy-restore]').forEach(button=>button.onclick=()=>void commit(()=>setHierarchyHidden(data,all,button.dataset.hierarchyRestore,false)));
  bindTopicTooltips(root,topics,data.answers);
 }
 draw();
}
