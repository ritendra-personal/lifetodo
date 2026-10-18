const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let pickerId=0;
export function searchOutcomes(outcomes,query=''){
 const words=query.trim().toLowerCase().split(/\s+/).filter(Boolean);
 return outcomes.filter(outcome=>words.every(word=>(outcome.path+' '+outcome.title).toLowerCase().includes(word))).slice(0,12);
}
export function taskOutcomeIds(links,taskId){return Object.keys(links).filter(id=>(links[id]||[]).includes('task:'+taskId));}
export function renderOutcomePicker(root,{outcomes,selected=[],disabled=false,onPick,onRemove,label='Outcome',error=''}){
 const id='outcome-options-'+(++pickerId);
 root.classList.add('outcome-picker');
 root.innerHTML=`<div class="outcome-pills">${selected.map(key=>{const item=outcomes.find(outcome=>outcome.id===key);return item?`<span title="${esc(item.path)}">${esc(item.title)}${onRemove?`<button type="button" data-remove-outcome="${esc(key)}" aria-label="Remove outcome ${esc(item.title)}">×</button>`:''}</span>`:'';}).join('')}</div><label>${esc(label)}<input type="search" role="combobox" aria-autocomplete="list" aria-controls="${id}" aria-expanded="false" autocomplete="off" placeholder="Find an outcome…"${disabled?' disabled':''}></label><div class="outcome-options" role="listbox" id="${id}" hidden></div><p class="outcome-picker-error" role="alert">${esc(error)}</p>`;
 const input=root.querySelector('input'),list=root.querySelector('[role=listbox]'),feedback=root.querySelector('[role=alert]');
 let matches=[],active=-1;
 function show(){
  matches=searchOutcomes(outcomes.filter(outcome=>!selected.includes(outcome.id)),input.value);active=-1;
  list.innerHTML=matches.length?matches.map((item,index)=>`<button id="${id}-${index}" type="button" role="option" data-outcome-id="${esc(item.id)}" aria-selected="false"><strong>${esc(item.title)}</strong><small>${esc(item.path)}</small></button>`).join(''):'<span>No matching outcomes</span>';
  list.hidden=false;input.setAttribute('aria-expanded','true');input.removeAttribute('aria-activedescendant');
 }
 function hide(){list.hidden=true;input.setAttribute('aria-expanded','false');input.removeAttribute('aria-activedescendant');}
 async function choose(key){hide();input.disabled=true;try{await onPick(key);input.value='';}catch(error){feedback.textContent=error.message;}finally{input.disabled=disabled;}}
 input.onfocus=show;input.oninput=show;
 input.onkeydown=event=>{
  event.stopPropagation();
  if(event.key==='Escape'){event.preventDefault();hide();return;}
  if(['ArrowDown','ArrowUp'].includes(event.key)){
   event.preventDefault();if(list.hidden)show();if(!matches.length)return;
   active=active<0?(event.key==='ArrowDown'?0:matches.length-1):(active+(event.key==='ArrowDown'?1:-1)+matches.length)%matches.length;
   list.querySelectorAll('[role=option]').forEach((button,index)=>button.setAttribute('aria-selected',String(index===active)));
   input.setAttribute('aria-activedescendant',`${id}-${active}`);list.children[active]?.scrollIntoView({block:'nearest'});
  }
  if(event.key==='Enter'){event.preventDefault();if(list.hidden)show();if(matches.length)void choose(matches[Math.max(0,active)].id);}
 };
 list.onpointerdown=event=>event.preventDefault();
 list.onclick=event=>{const button=event.target.closest('[data-outcome-id]');if(button)void choose(button.dataset.outcomeId);};
 root.onclick=event=>event.stopPropagation();
 root.onkeydown=event=>event.stopPropagation();
 root.onfocusout=event=>{if(!root.contains(event.relatedTarget))hide();};
 root.querySelectorAll('[data-remove-outcome]').forEach(button=>button.onclick=async()=>{button.disabled=true;try{await onRemove(button.dataset.removeOutcome);}catch(error){feedback.textContent=error.message;button.disabled=false;}});
 return {focus:()=>input.focus()};
}
