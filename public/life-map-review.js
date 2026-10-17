// Discovery menus and legacy saved outcomes may use two IDs for one topic.
// An opt-out on either ID applies to that topic and its descendants.
export function createTopicExclusionResolver(topics,answers={}){
 const byId=new Map(topics.map(topic=>[topic.id,topic]));
 return id=>{
  let topic=byId.get(id);const seen=new Set();
  while(topic&&!seen.has(topic.id)){
   seen.add(topic.id);
   const canonical=topic.id.startsWith('discover:')?topic.id.slice(9):topic.id;
   for(const answerId of [canonical,'discover:'+canonical]){
    if(answers[answerId]?.status==='uninterested')return {topicId:topic.id,answerId,title:topic.title};
   }
   topic=byId.get(topic.parent);
  }
  return null;
 };
}

export function reopenTopicInterest(id,answers){
 const canonical=id.startsWith('discover:')?id.slice(9):id;
 for(const key of [canonical,'discover:'+canonical]){
  const answer=answers[key];if(answer?.status!=='uninterested')continue;
  const reopened={...answer,status:answer.previousStatus||null,updatedAt:new Date().toISOString()};
  delete reopened.previousStatus;delete reopened.reviewedAt;
  answers[key]=reopened;
 }
}
