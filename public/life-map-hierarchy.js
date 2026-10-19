export const hierarchyNodeType=topic=>topic.isOutcome?'outcome':'topic';
export function hierarchyDescendants(topics,id){
 const ids=new Set([id]);let changed=true;
 while(changed){changed=false;for(const topic of topics)if(ids.has(topic.parent)&&!ids.has(topic.id)){ids.add(topic.id);changed=true;}}
 return ids;
}
export function applyHierarchyEdits(topics,data,{includeHidden=false}={}){
 const edits=data.nodeEdits||{},original=new Map(topics.map(topic=>[topic.id,topic]));
 const result=topics.map(topic=>{
  const edit=edits[topic.id]||{},node={...topic};
  if(typeof edit.title==='string'&&edit.title.trim())node.title=edit.title.trim();
  if(typeof edit.description==='string')node.description=edit.description;
  if(topic.parent&&typeof edit.parent==='string')node.parent=edit.parent;
  if(topic.parent&&['topic','outcome'].includes(edit.node_type))Object.assign(node,{node_type:edit.node_type,isOutcome:edit.node_type==='outcome',group:edit.node_type==='topic'?'custom':null,kind:null,expandedDiscovery:false,question:edit.node_type==='topic'?'What would you like to address?':`Where are you with “${node.title}”?`});
  if(node.isOutcome&&edit.title)node.question=`Where are you with “${node.title}”?`;
  return node;
 });
 const byId=new Map(result.map(topic=>[topic.id,topic]));
 for(const node of result){
  const seen=new Set([node.id]);let cursor=byId.get(node.parent),invalid=Boolean(node.parent&&!cursor);
  while(cursor){if(seen.has(cursor.id)){invalid=true;break;}seen.add(cursor.id);cursor=byId.get(cursor.parent);}
  if(invalid)node.parent=original.get(node.id).parent;
 }
 for(const node of result){let root=node;const seen=new Set();while(root.parent&&!seen.has(root.id)){seen.add(root.id);root=byId.get(root.parent)||root;}if(!root.parent)node.area=root.area;}
 const hidden=new Set();
 for(const node of result)if(edits[node.id]?.hidden&&node.parent)for(const id of hierarchyDescendants(result,node.id))hidden.add(id);
 return result.filter(node=>includeHidden||!hidden.has(node.id));
}
export function addHierarchyNode(data,topics,{id,parent,title,node_type='outcome'}){
 title=String(title||'').trim();const owner=topics.find(topic=>topic.id===parent);
 if(!owner||!title)throw new Error('Choose a parent and enter a name.');
 if(!['topic','outcome'].includes(node_type))throw new Error('Choose Topic or Outcome.');
 if(topics.some(topic=>topic.id===id))throw new Error('This node already exists.');
 data.concerns||=[];
 const node={id,parent,title,area:owner.area,node_type,question:node_type==='topic'?'What would you like to address?':`Where are you with “${title}”?`};
 data.concerns.push(node);return node;
}
export function updateHierarchyNode(data,topics,id,{title,parent,node_type,description}){
 const node=topics.find(topic=>topic.id===id);if(!node)throw new Error('Node not found.');
 title=String(title||'').trim();if(!title)throw new Error('Enter a name.');
 if(!['topic','outcome'].includes(node_type))throw new Error('Choose Topic or Outcome.');
 if(!node.parent&&(parent||node_type!=='topic'))throw new Error('Life areas must remain at the top level.');
 if(node.parent&&(!topics.some(topic=>topic.id===parent)||hierarchyDescendants(topics,id).has(parent)))throw new Error('A node cannot be moved inside itself or its descendants.');
 if(node_type==='topic'&&node.isOutcome&&(data.links?.[id]||[]).some(ref=>ref.startsWith('task:')))throw new Error('Move or unlink this outcome’s tasks before converting it to a topic.');
 const edit={...(data.nodeEdits?.[id]||{}),title};
 if(typeof description==='string')edit.description=description.trim();
 if(node.parent)edit.parent=parent;
 if(node_type!==hierarchyNodeType(node))edit.node_type=node_type;
 data.nodeEdits||={};data.nodeEdits[id]=edit;
}
export function setHierarchyHidden(data,topics,id,hidden){
 const node=topics.find(topic=>topic.id===id);if(!node)throw new Error('Node not found.');
 if(!node.parent)throw new Error('Top-level life areas cannot be deleted.');
 data.nodeEdits||={};data.nodeEdits[id]={...(data.nodeEdits[id]||{}),hidden:Boolean(hidden)};
}
