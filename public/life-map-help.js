const clean=value=>String(value||'').replace(/\s+/g,' ').trim();
export function topicDescription(topic,topics,answers={}){
 if(!topic)return '';
 const notes=clean(answers[topic.id]?.notes);
 if(topic.isOutcome){
  const parent=topics.find(item=>item.id===topic.parent);
  return [`Desired result: ${clean(topic.title)}.`,notes?`Notes: ${notes}`:'',parent?`Under ${clean(parent.title)}.`:''].filter(Boolean).join(' ').slice(0,900);
 }
 const question=clean(topic.outcomeQuestion||topic.question);
 const specific=question&&!/^(What would you like to address\??|What specific result would you like\??|Where are you with|Which part needs attention\??)$/i.test(question)?question:'';
 const children=topics.filter(item=>item.parent===topic.id&&!item.isOutcome&&!/^something else$/i.test(clean(item.title)));
 const examples=children.slice(0,6).map(item=>clean(item.title));
 const parent=topics.find(item=>item.id===topic.parent);
 return [specific,examples.length?`Includes ${examples.join('; ')}${children.length>6?'; and more':''}.`:'',!specific&&!examples.length?`A topic for outcomes about ${clean(topic.title).toLowerCase()}${parent?' within '+clean(parent.title):''}.`:'',notes?`Notes: ${notes}`:''].filter(Boolean).join(' ').slice(0,900);
}

const bindings=new WeakMap();
let tooltipSequence=0;
export function bindTopicTooltips(root,topics,answers={}){
 bindings.get(root)?.();
 if(!root.ownerDocument?.createElement||!root.ownerDocument?.defaultView)return;
 const byId=new Map(topics.map(topic=>[topic.id,topic]));
 const targets=root.querySelectorAll('[data-go], [data-priority-open], [data-topic-tooltip]');
 for(const target of targets){const id=target.dataset.topicTooltip||target.dataset.go||target.dataset.priorityOpen;if(byId.has(id))target.dataset.topicTooltip=id;}
 const doc=root.ownerDocument,view=doc.defaultView;
 const tooltip=doc.createElement('div');tooltip.id='life-map-help-'+(++tooltipSequence);tooltip.className='life-map-tooltip';tooltip.setAttribute('role','tooltip');tooltip.hidden=true;doc.body.append(tooltip);
 let current=null;
 function hide(){
  if(current){const ids=(current.getAttribute('aria-describedby')||'').split(/\s+/).filter(id=>id&&id!==tooltip.id);if(ids.length)current.setAttribute('aria-describedby',ids.join(' '));else current.removeAttribute('aria-describedby');}
  current=null;tooltip.hidden=true;
 }
 function show(target){
  if(!target||!root.contains(target))return;
  const topic=byId.get(target.dataset.topicTooltip);if(!topic)return;
  hide();current=target;tooltip.textContent=topicDescription(topic,topics,answers);tooltip.hidden=false;
  target.setAttribute('aria-describedby',[(target.getAttribute('aria-describedby')||''),tooltip.id].filter(Boolean).join(' '));
  const rect=target.getBoundingClientRect(),box=tooltip.getBoundingClientRect();
  const width=view.innerWidth,height=view.innerHeight;
  tooltip.style.left=Math.max(8,Math.min(rect.left,width-box.width-8))+'px';
  tooltip.style.top=Math.max(8,rect.bottom+8+box.height<=height?rect.bottom+8:rect.top-box.height-8)+'px';
 }
 const targetFor=event=>event.target.closest?.('[data-topic-tooltip]');
 const over=event=>{const target=targetFor(event);if(target&&target!==current)show(target);};
 const out=event=>{if(current&&!current.contains(event.relatedTarget))hide();};
 const escape=event=>{if(event.key==='Escape')hide();};
 root.addEventListener('pointerover',over);root.addEventListener('pointerout',out);root.addEventListener('focusin',over);root.addEventListener('focusout',out);root.addEventListener('click',hide);
 doc.addEventListener('keydown',escape);view.addEventListener('resize',hide);view.addEventListener('scroll',hide,true);
 bindings.set(root,()=>{hide();tooltip.remove();root.removeEventListener('pointerover',over);root.removeEventListener('pointerout',out);root.removeEventListener('focusin',over);root.removeEventListener('focusout',out);root.removeEventListener('click',hide);doc.removeEventListener('keydown',escape);view.removeEventListener('resize',hide);view.removeEventListener('scroll',hide,true);});
}
