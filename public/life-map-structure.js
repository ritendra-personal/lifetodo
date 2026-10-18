// Keep every existing topic identity. Only discovery presentation is regrouped.
export function refineLifeMapStructure(topics){
 const byId=new Map(topics.map(topic=>[topic.id,topic]));
 const rename=(id,title,question)=>{const topic=byId.get(id);if(topic)Object.assign(topic,{title,...(question?{question}:{})});};
 const group=(id,parent,title,children,reviewOptional=false)=>{
  const owner=byId.get(parent)||topics.find(topic=>topic.parent===parent);
  const topic={id,parent,area:owner.area,title,question:`What would you like to address about ${title.toLowerCase()}?`,group:'discovery',suggested:true,reviewOptional};
  topics.push(topic);byId.set(id,topic);
  for(const child of children){const item=byId.get(child);if(item)item.parent=id;}
 };
 group('health:conditions','check:health:4','Organize care for a specific condition',topics.filter(topic=>topic.parent==='check:health:4'&&topic.id.startsWith('care:')&&topic.id!=='care:dental').map(topic=>topic.id),true);
 for(const topic of topics)if(topic.parent==='health:conditions')topic.reviewOptional=true;
 group('creative:projects','creative','Creative projects',['check:creative:0','check:creative:1','check:creative:5','check:creative:milestone']);
 group('creative:sharing','creative','Sharing and opportunities',['check:creative:2','check:creative:4']);
 group('community:contribution','community','Contribution and commitments',['check:community:1','check:community:3','check:community:4','check:community:5']);
 group('rest:capacity','rest','Time and commitments',['check:rest:0','check:rest:5']);
 rename('check:money:1','Savings and unexpected costs');
 rename('check:money:5','Subscriptions and service plans');
 rename('check:creative:3','Creative practice');
 rename('check:creative:milestone','A milestone I can work toward');
 rename('check:growth:4','Try an interest before committing');
 rename('check:future:0','Legal and legacy arrangements');
 rename('check:future:1','Future care and living arrangements');
 rename('check:future:2','Life transitions');
 rename('check:future:3','Emergency readiness');
 rename('check:future:4','Major life decisions');
 rename('check:future:5','Direction for my next chapter');
 rename('check:experiences:4','Dreams and possibilities','What experience would you like to make possible? Timing can be decided separately.');
 rename('check:career:0','Work satisfaction and development');
 rename('check:career:1','Work delivery and working conditions');
 rename('check:career:2','Career changes and business');
 rename('check:career:3','Pay, benefits, and employment arrangements');
 rename('check:community:0','Local belonging');
 rename('check:community:2','Culture, faith, and meaning');
 rename('check:admin:5','Renewals and administrative deadlines');
 const addChoice=(id,parent,title)=>{const owner=byId.get(parent);const topic={id,parent,area:owner.area,title,kind:'outcome-discovery',choices:[],expandedDiscovery:true,suggested:true};topics.push(topic);byId.set(id,topic);};
 addChoice('home:services','check:home:2','Utilities and household services');
 addChoice('home:accessibility','check:home:0','Home accessibility');
 const business=byId.get('check:career:2:choice:2');
 Object.assign(business,{kind:null,group:'discovery',question:'What part of your business needs attention?'});
 for(const [slug,title] of [['clients','Clients and commitments'],['delivery','Products or services'],['operations','Business operations'],['cash-flow','Business cash flow'],['direction','Business direction']])addChoice('career:business:'+slug,business.id,title);
 // Alternate discovery routes open the original topic, rather than making a copy.
 const related={
  'check:money:1:choice:2':'check:money:6',
  'check:money:4:choice:0':'check:future:2',
  'check:admin:5:choice:1':'check:money:3',
  'check:admin:5:choice:3':'check:home:4',
  'check:rest:4':'check:experiences:0',
  'check:experiences:5':'check:relationships:1',
  'health:support':'check:care:0',
  'check:future:1':'check:care:2',
  'check:career:0:choice:1':'check:growth:0'
 };
 for(const [id,target] of Object.entries(related))if(byId.has(id)&&byId.has(target))byId.get(id).relatedTopic=target;
 return topics;
}

export function existingOutcome(topics,title){
 const normalize=value=>value.trim().replace(/\s+/g,' ').toLocaleLowerCase();
 return topics.find(topic=>topic.isOutcome&&normalize(topic.title)===normalize(title));
}
