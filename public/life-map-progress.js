export function lifeMapReviewProgress(topics,answers={}){
 const children=new Map(),seen=new Set(),units=[];
 for(const topic of topics){if(!children.has(topic.parent))children.set(topic.parent,[]);children.get(topic.parent).push(topic);}
 function active(topic,visited=new Set()){
  if(visited.has(topic.id))return false;visited.add(topic.id);
  return topic.isOutcome||Boolean(answers[topic.id]?.status||answers[topic.id]?.visitedAt)||(children.get(topic.id)||[]).some(child=>active(child,visited));
 }
 function visit(topic,inheritedExclusion=false){
  if(seen.has(topic.id))return;seen.add(topic.id);
  const answer=answers[topic.id]||{},excluded=inheritedExclusion||['uninterested','irrelevant'].includes(answer.status);
  if(topic.reviewOptional&&!active(topic))return;
  const descendants=children.get(topic.id)||[],outcomes=descendants.filter(child=>child.isOutcome),branches=descendants.filter(child=>!child.isOutcome);
  const fallback=topic.suggested&&/^something else$/i.test(topic.title.trim());
  if(branches.length){
   for(const child of branches)visit(child,excluded);
   for(const child of outcomes)visit(child,excluded);
   return;
  }
  if(fallback&&!outcomes.length)return;
  if(topic.group&&!outcomes.length&&!excluded)return;
  const addressed=excluded||topic.isOutcome||outcomes.length>0||(!topic.kind&&Boolean(answer.status)&&answer.status!=='defer');
  const touched=Boolean(answer.visitedAt||answer.status||answer.notes||answer.next);
  units.push({id:topic.id,state:addressed?'addressed':touched?'partial':'unvisited'});
 }
 for(const topic of topics.filter(topic=>!topic.parent))visit(topic);
 const addressed=units.filter(unit=>unit.state==='addressed').length,partial=units.filter(unit=>unit.state==='partial').length;
 return {total:units.length,addressed,partial,unvisited:units.length-addressed-partial,percent:units.length?Math.round(addressed/units.length*100):0,units};
}

export function reviewProgressMarkup(progress){
 const button=(state,count,label)=>{const target=progress.units.find(unit=>unit.state===state);return `<button type="button"${target?` data-review-target="${encodeURIComponent(target.id)}"`:' disabled'}><strong>${count}</strong> ${label}</button>`;};
 return `<section class="lm-review-progress" aria-label="Life map review progress"><div><strong>Map review</strong><span>${progress.addressed} of ${progress.total} addressed · ${progress.percent}%</span></div><progress max="${Math.max(1,progress.total)}" value="${progress.addressed}" aria-label="Topics addressed"></progress><div class="lm-review-counts">${button('addressed',progress.addressed,'addressed')}${button('partial',progress.partial,'visited / partial')}${button('unvisited',progress.unvisited,'not yet visited')}</div></section>`;
}
