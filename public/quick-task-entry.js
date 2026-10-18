import {renderOutcomePicker} from './outcome-picker.js?v=1.14.76';
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function renderQuickTaskEntry(root,{context,draft,onCreate,refresh,onRetry}){
 root.innerHTML=`<form class="quick-task-entry" aria-label="Quick add task"><label>Task<input name="quickTitle" required maxlength="300" autocomplete="off" placeholder="What needs doing?" value="${esc(draft.title||'')}"></label><div class="quick-outcome-picker"></div><button type="submit" class="primary-button"${context.loading||context.error||draft.saving?' disabled':''}>${draft.saving?'Saving…':draft.taskId?'Retry outcome link':'Add task'}</button><p class="quick-task-feedback" role="status">${esc(draft.error||context.error||'')}</p>${context.error?'<button type="button" data-retry-outcomes>Retry loading outcomes</button>':''}</form>`;
 const form=root.querySelector('form'),input=form.querySelector('[name=quickTitle]'),feedback=form.querySelector('[role=status]');
 input.disabled=draft.saving||Boolean(draft.taskId);
 const picker=renderOutcomePicker(form.querySelector('.quick-outcome-picker'),{outcomes:context.outcomes,selected:draft.outcomeId?[draft.outcomeId]:[],disabled:context.loading||Boolean(context.error)||draft.saving,onPick:async id=>{draft.outcomeId=id;draft.error='';refresh();root.querySelector('[name=quickTitle]')?.focus();},onRemove:async()=>{draft.outcomeId='';refresh();}});
 input.oninput=()=>{draft.title=input.value;};
 form.querySelector('[data-retry-outcomes]')?.addEventListener('click',()=>onRetry?.());
 form.onsubmit=async event=>{
  event.preventDefault();draft.title=input.value.trim();if(!draft.title||draft.saving)return;
  if(!draft.outcomeId){feedback.textContent='Choose an outcome for this task.';picker.focus();return;}
  draft.saving=true;draft.error='';form.querySelector('[type=submit]').disabled=true;
  try{await onCreate(draft);draft.title='';draft.taskId='';}
  catch(error){draft.error=error.message;if(error.taskId)draft.taskId=error.taskId;}
  finally{draft.saving=false;refresh();root.querySelector('[name=quickTitle]')?.focus();}
 };
}
