import test from 'node:test';
import assert from 'node:assert/strict';
import {addHierarchyNode,updateHierarchyNode,setHierarchyHidden} from '../public/life-map-hierarchy.js';
import {assembleTopics} from '../public/life-map-discovery.js';
import {baseTopics,discoveryTopics,topicReviewState,topicPath} from '../public/life-map.js';
import {priorityItems} from '../public/life-map-priorities.js';
const fixture=()=>({answers:{},links:{},concerns:[]});
const topics=data=>assembleTopics(baseTopics,discoveryTopics(),data);
test('Home improvement is an unreviewed topic, with nested outcomes and stable IDs',()=>{
 const data=fixture();
 addHierarchyNode(data,topics(data),{id:'improve',parent:'home',title:'Home improvement',node_type:'topic'});
 let nodes=topics(data);assert.equal(nodes.find(n=>n.id==='improve').isOutcome,false);
 assert.equal(topicReviewState('improve',nodes,data.answers).key,'unreviewed');
 assert(!priorityItems(nodes,data).active.some(n=>n.id==='improve'));
 addHierarchyNode(data,nodes,{id:'kitchen',parent:'improve',title:'Renovate kitchen',node_type:'outcome'});
 nodes=topics(data);assert.equal(topicReviewState('improve',nodes,data.answers).key,'reviewed');
 assert.deepEqual(topicPath('kitchen',nodes).map(n=>n.id),['home','improve','kitchen']);
 assert(priorityItems(nodes,data).active.some(n=>n.id==='kitchen'));
 const reloaded=JSON.parse(JSON.stringify(data));assert.deepEqual(topics(reloaded),nodes);
});
test('renaming and moving built-in or custom nodes preserve notes and links and update ancestry',()=>{
 const data=fixture();data.answers['check:home:0']={notes:'Keep notes',status:'progress'};data.links['check:home:0']=['task:t','project:p'];
 const originalAnswers=JSON.stringify(data.answers),originalLinks=JSON.stringify(data.links);
 const groupId=topics(data).find(n=>n.title==='Repairs and safety'&&n.group).id;
 updateHierarchyNode(data,topics(data),groupId,{title:'Home maintenance',parent:'home',node_type:'topic',description:'Keep this home usable and safe.'});
 assert.equal(topics(data).find(n=>n.id===groupId).title,'Home maintenance');
 addHierarchyNode(data,topics(data),{id:'mine',parent:'home',title:'My outcome'});
 updateHierarchyNode(data,topics(data),'mine',{title:'Renamed',parent:'health',node_type:'outcome'});
 const node=topics(data).find(n=>n.id==='mine');assert.equal(node.area,'Health and wellbeing');assert.equal(node.parent,'health');
 assert.equal(JSON.stringify(data.answers),originalAnswers);assert.equal(JSON.stringify(data.links),originalLinks);
 assert.equal(data.concerns[0].title,'My outcome','Original definition is retained behind overrides');
});
test('moves prevent cycles and life areas stay at the root',()=>{
 const data=fixture();addHierarchyNode(data,topics(data),{id:'parent',parent:'home',title:'Parent',node_type:'topic'});addHierarchyNode(data,topics(data),{id:'child',parent:'parent',title:'Child'});
 const before=JSON.stringify(data);
 assert.throws(()=>updateHierarchyNode(data,topics(data),'parent',{title:'Parent',parent:'child',node_type:'topic'}),/descendants/);
 assert.throws(()=>updateHierarchyNode(data,topics(data),'home',{title:'Home',parent:'health',node_type:'topic'}),/top level/);
 assert.throws(()=>setHierarchyHidden(data,topics(data),'home',true),/cannot be deleted/);
 assert.equal(JSON.stringify(data),before);
});
test('delete and restore keep every underlying outcome, note, status and task link',()=>{
 const data=fixture();addHierarchyNode(data,topics(data),{id:'parent',parent:'home',title:'Group',node_type:'topic'});addHierarchyNode(data,topics(data),{id:'child',parent:'parent',title:'Child'});
 data.answers.child={notes:'Retain',status:'progress'};data.links.child=['task:t','person:p'];
 const before=JSON.stringify({answers:data.answers,links:data.links,concerns:data.concerns});
 setHierarchyHidden(data,topics(data),'parent',true);
 assert(!topics(data).some(n=>n.id==='parent'||n.id==='child'));
 const all=assembleTopics(baseTopics,discoveryTopics(),data,{includeHidden:true});
 setHierarchyHidden(data,all,'parent',false);
 assert(topics(data).some(n=>n.id==='child'));
 assert.equal(JSON.stringify({answers:data.answers,links:data.links,concerns:data.concerns}),before);
});
test('changing a task-bearing outcome to a topic is blocked instead of hiding its tasks',()=>{
 const data=fixture();addHierarchyNode(data,topics(data),{id:'mine',parent:'home',title:'My result'});data.links.mine=['task:t'];
 assert.throws(()=>updateHierarchyNode(data,topics(data),'mine',{title:'My result',parent:'home',node_type:'topic'}),/tasks/);
 assert(topics(data).find(n=>n.id==='mine').isOutcome);
});
