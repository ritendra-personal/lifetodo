import {planningHolidays} from './planning-holidays.js?v=1.14.59';
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

export function conflictsOnDate(records,date,groups={us:true,india:true,custom:true}){
 return records.filter(record=>groups[record.category]!==false&&record.start_date<=date&&record.end_date>=date);
}

export function missingHolidayReferences(existing,firstYear,lastYear){
 const keys=new Set(existing.map(record=>record.source_key).filter(Boolean));
 return planningHolidays(firstYear,lastYear).filter(item=>!keys.has(`${item.group}:${item.date}:${item.name}`)).map(item=>({name:item.name,start_date:item.date,end_date:item.date,category:item.group,source:item.source,source_key:`${item.group}:${item.date}:${item.name}`,notes:item.provisional?'Date subject to local confirmation.':''}));
}

export function renderPlanningConflicts(root,api){
 const records=[...api.conflicts].sort((a,b)=>a.start_date.localeCompare(b.start_date)||a.name.localeCompare(b.name));
 root.innerHTML=`<section class="planning-conflicts"><div class="season-toolbar"><button type="button" class="primary-button" data-conflict-new>Add conflict</button><button type="button" data-conflict-import>Import missing holidays (2026–2028)</button><span role="status" data-conflict-status></span></div><p class="season-reference-note">Holiday references: U.S. federal dates and selected Indian festivals, 2026–2028. Local festival observance may differ. Imported records remain editable; imports never replace your edits.</p><div class="conflict-directory">${records.map(record=>`<article class="conflict-row"><button type="button" data-conflict-edit="${esc(record.id)}"><strong>${esc(record.name)}</strong><small>${esc(record.start_date)}${record.end_date!==record.start_date?' — '+esc(record.end_date):''} · ${esc(({us:'U.S. holidays',india:'Indian festivals',custom:'Custom conflicts'})[record.category]||record.category)}</small></button><button type="button" class="danger-button" data-conflict-delete="${esc(record.id)}">Delete</button></article>`).join('')||'<p>No conflicts added yet.</p>'}</div></section>`;
 root.querySelector('[data-conflict-new]').onclick=()=>edit();
 root.querySelectorAll('[data-conflict-edit]').forEach(button=>button.onclick=()=>edit(api.conflicts.find(record=>record.id===button.dataset.conflictEdit)));
 root.querySelectorAll('[data-conflict-delete]').forEach(button=>button.onclick=async()=>{
  const record=api.conflicts.find(item=>item.id===button.dataset.conflictDelete);
  if(!await api.confirm(`Delete conflict "${record.name}"? Your own events will not be deleted.`))return;
  button.disabled=true;
  try{await api.remove(record.id);api.refresh();}catch(error){root.querySelector('[data-conflict-status]').textContent=error.message;button.disabled=false;}
 });
 root.querySelector('[data-conflict-import]').onclick=async event=>{
  const missing=missingHolidayReferences(api.conflicts,2026,2028),status=root.querySelector('[data-conflict-status]');
  if(!missing.length){status.textContent='No missing holiday references. Your edits are unchanged.';return;}
  if(!await api.confirm(`Import ${missing.length} holiday references? Existing conflicts and edits will stay unchanged.`))return;
  event.target.disabled=true;status.textContent='Importing holiday references...';
  try{await api.import(missing);api.refresh();}catch(error){status.textContent=error.message;event.target.disabled=false;}
 };
 function edit(record={}){
  const dialog=document.createElement('dialog');dialog.className='season-dialog';
  dialog.innerHTML=`<div class="season-dialog-head"><h3>${record.id?'Edit':'Add'} conflict</h3><button type="button" data-close aria-label="Close">×</button></div><form><label>Name<input name="name" required value="${esc(record.name)}"></label><div class="season-dialog-dates"><label>Start<input type="date" name="start" required value="${esc(record.start_date)}"></label><label>End<input type="date" name="end" required value="${esc(record.end_date)}"></label></div><label>Category<select name="category">${[['custom','Custom conflict'],['india','Indian festival'],['us','U.S. holiday']].map(([value,label])=>`<option value="${value}"${(record.category||'custom')===value?' selected':''}>${label}</option>`).join('')}</select></label><label>Notes<input name="notes" value="${esc(record.notes)}"></label><label>Source<input name="source" value="${esc(record.source)}"></label><p role="alert" class="season-save-error" hidden></p><button type="submit" class="primary-button">Save conflict</button></form>`;
  document.body.append(dialog);dialog.onclose=()=>dialog.remove();dialog.querySelector('[data-close]').onclick=()=>dialog.close();
  const form=dialog.querySelector('form');form.elements.start.onchange=()=>{form.elements.end.min=form.elements.start.value;if(!form.elements.end.value||form.elements.end.value<form.elements.start.value)form.elements.end.value=form.elements.start.value;};
  form.onsubmit=async event=>{
   event.preventDefault();const values=new FormData(form),error=form.querySelector('[role=alert]'),submit=form.querySelector('[type=submit]');
   submit.disabled=true;error.hidden=true;
   try{await api.save({...record,name:values.get('name').trim(),start_date:values.get('start'),end_date:values.get('end'),category:values.get('category'),notes:values.get('notes'),source:values.get('source')});dialog.close();api.refresh();}
   catch(issue){error.textContent=issue.message;error.hidden=false;submit.disabled=false;}
  };
  dialog.showModal();form.elements.name.focus();
 }
}
