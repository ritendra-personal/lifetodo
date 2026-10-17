const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const key=date=>`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
const addDays=(date,count)=>new Date(date.getFullYear(),date.getMonth(),date.getDate()+count);
let years=1,scale='week',weekends=false;

export function seasonPeriods(today=new Date(),horizon=1,mode='week'){
 const start=new Date(today.getFullYear(),0,1);
 const end=new Date(start.getFullYear()+horizon+1,0,1);
 let cursor=mode==='month'?new Date(start.getFullYear(),start.getMonth(),1):addDays(start,-((start.getDay()+6)%7));
 const rows=[];
 while(cursor<end){
  const next=mode==='month'?new Date(cursor.getFullYear(),cursor.getMonth()+1,1):addDays(cursor,mode==='fortnight'?14:7);
  const days=[];for(let date=cursor;date<next;date=addDays(date,1))days.push(date);
  rows.push({start:cursor,days});cursor=next;
 }
 return rows;
}

export function conflictingEvents(events,overlap){
 return events.filter(event=>event.status!=='cancelled'&&events.some(other=>other.id!==event.id&&other.status!=='cancelled'&&overlap(event,other)));
}

export function renderSeasonPlanning(root,api){
 const opening=!root.querySelector('.season-planning');
 const today=key(new Date()),rows=seasonPeriods(new Date(),years,scale);
 const label=date=>date.toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'});
 root.innerHTML=`<section class="season-planning"><div class="season-toolbar"><div class="view-mode-toggle" aria-label="Time scale">${[['week','Week'],['fortnight','Fortnight'],['month','Month']].map(([value,text])=>`<button type="button" data-season-scale="${value}" class="${scale===value?'active':''}">${text}</button>`).join('')}</div><label>Horizon<select data-season-years><option value="1"${years===1?' selected':''}>Next year</option><option value="2"${years===2?' selected':''}>Next two years</option></select></label><label class="season-weekends"><input type="checkbox" data-season-weekends${weekends?' checked':''}>Weekends only</label><span class="season-legend"><i></i>Overlapping events</span></div><div class="season-rows">${rows.map(row=>{
  const days=row.days.filter(day=>!weekends||[0,6].includes(day.getDay()));
  return `<section class="season-row"><h3>${esc(label(row.start))}</h3><div class="season-days" style="--season-columns:${Math.min(days.length,weekends?2:7)}">${days.map(day=>{
   const date=key(day),events=api.events.filter(event=>api.occurs(event,day));
   const conflicts=conflictingEvents(events,api.overlap);
   return `<div class="season-day ${date<today?'season-past':''} ${date===today?'season-today':''} ${conflicts.length?'season-conflict':''}"><button type="button" class="season-date" data-season-add="${date}" aria-label="Plan event for ${esc(label(day))}"><span>${esc(day.toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric'}))}</span><span aria-hidden="true">+</span></button>${conflicts.length?`<small class="season-conflict-label">${conflicts.length} overlapping</small>`:''}${events.map(event=>`<button type="button" class="season-event ${event.status==='tentative'?'season-tentative':''} ${event.status==='cancelled'?'event-cancelled':''}" data-season-event="${esc(event.id)}"><strong>${esc(event.title)}</strong><small>${esc(event.status==='tentative'?'Tentative':event.all_day?'All day':api.range(event))}</small></button>`).join('')}</div>`;
  }).join('')}</div></section>`;
 }).join('')}</div></section>`;
 root.querySelectorAll('[data-season-scale]').forEach(button=>button.onclick=()=>{scale=button.dataset.seasonScale;renderSeasonPlanning(root,api);});
 root.querySelector('[data-season-years]').onchange=event=>{years=Number(event.target.value);renderSeasonPlanning(root,api);};
 root.querySelector('[data-season-weekends]').onchange=event=>{weekends=event.target.checked;renderSeasonPlanning(root,api);};
 root.querySelectorAll('[data-season-event]').forEach(button=>button.onclick=()=>api.open(button.dataset.seasonEvent));
 root.querySelectorAll('[data-season-add]').forEach(button=>button.onclick=()=>openDay(button.dataset.seasonAdd));
 if(opening&&typeof requestAnimationFrame==='function')requestAnimationFrame(()=>{
  if(!root.isConnected)return;
  const target=[...root.querySelectorAll('[data-season-add]')].find(button=>button.dataset.seasonAdd>=today);
  target?.closest('.season-row')?.scrollIntoView({block:'center'});
 });

 function openDay(date){
  const day=new Date(date+'T00:00:00'),existing=api.events.filter(event=>api.occurs(event,day)&&event.status!=='cancelled');
  const dialog=document.createElement('dialog');dialog.className='season-dialog';
  dialog.innerHTML=`<div class="season-dialog-head"><h3>Plan ${esc(label(day))}</h3><button type="button" data-season-close aria-label="Close">×</button></div>${existing.length?`<div class="season-existing"><h4>Already planned</h4>${existing.map(event=>`<p><strong>${esc(event.title)}</strong> · ${esc(event.status==='tentative'?'Tentative':api.range(event))}</p>`).join('')}</div>`:''}<form><label>Event<input name="title" required maxlength="200" autocomplete="off"></label><div class="season-dialog-dates"><label>Start<input type="date" name="start" required value="${date}"></label><label>End<input type="date" name="end" required min="${date}" value="${date}"></label></div><label>Project<select name="project"><option value="">No project</option>${[...api.projects].sort((a,b)=>a.name.localeCompare(b.name)).map(project=>`<option value="${esc(project.id)}">${esc(project.name)}</option>`).join('')}</select></label><label>Status<select name="status"><option value="scheduled">Scheduled</option><option value="tentative" selected>Tentative</option></select></label><label>Notes<input name="notes"></label><p class="season-save-error" role="alert" hidden></p><button type="submit" class="primary-button">Add event</button></form>`;
  document.body.append(dialog);dialog.onclose=()=>dialog.remove();
  dialog.querySelector('[data-season-close]').onclick=()=>dialog.close();
  const form=dialog.querySelector('form'),start=form.elements.start,end=form.elements.end;
  start.onchange=()=>{end.min=start.value;if(end.value<start.value)end.value=start.value;};
  form.onsubmit=async event=>{
   event.preventDefault();const values=new FormData(form);const submit=form.querySelector('[type=submit]'),error=dialog.querySelector('[role=alert]');
   if(values.get('end')<values.get('start')){error.hidden=false;error.textContent='End date must not be before start date.';return;}
   submit.disabled=true;submit.textContent='Saving...';error.hidden=true;
   try{
    const startDate=new Date(values.get('start')+'T00:00:00'),endDate=addDays(new Date(values.get('end')+'T00:00:00'),1);
    const saved=await api.save({title:values.get('title').trim(),start_at:startDate.toISOString(),end_at:endDate.toISOString(),all_day:true,status:values.get('status'),notes:values.get('notes'),project_id:values.get('project')});
    if(!saved)throw new Error('The event was not saved.');
    dialog.close();api.refresh();
   }catch(issue){error.hidden=false;error.textContent=issue.message||'Event could not be saved.';submit.disabled=false;submit.textContent='Add event';}
  };
  dialog.showModal();form.elements.title.focus();
 }
}
