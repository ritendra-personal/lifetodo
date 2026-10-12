import test from 'node:test';
import assert from 'node:assert/strict';
import {buildLifeGraph,layoutLifeGraph} from '../public/life-map-graph.js';
const input={topics:[{id:'care',title:'Family support'},{id:'hub',parent:'care',title:'Support',kind:'support-discovery'},{id:'outcome',parent:'hub',title:'Help with housing',personName:'Parent',personId:'p'}],answers:{},links:{outcome:['person:p','project:proj']},people:[{id:'p',first_name:'Parent'}],projects:[{id:'proj',name:'Housing project'}],tasks:[{id:'a',project_id:'proj',title:'Plan',status:'active'},{id:'b',parent_id:'a',project_id:'proj',title:'Arrange call',status:'done'}]};
test('graph preserves review ancestry, person grouping, project and subtask hierarchy',()=>{
 const tree=buildLifeGraph(input);
 const area=tree.children[0],hub=area.children[0],person=hub.children[0],outcome=person.children[0],project=outcome.children[0];
 assert.equal(area.sourceId,'care');assert.equal(hub.sourceId,'hub');assert.equal(person.kind,'person');assert.equal(outcome.sourceId,'outcome');
 assert.equal(project.kind,'project');assert.equal(project.children[0].taskId,'a');assert.equal(project.children[0].children[0].taskId,'b');
 assert.equal(outcome.children.length,1,'Person is represented by its connecting parent, not duplicated');
});
test('collapsing a branch preserves data and removes only its visible descendants',()=>{
 const tree=buildLifeGraph(input),full=layoutLifeGraph(tree),collapsed=layoutLifeGraph(tree,new Set(['topic:care']));
 assert.equal(full.edges.length,full.nodes.length-1);assert.equal(collapsed.nodes.length,2);assert.equal(collapsed.edges.length,1);
 assert(full.width>collapsed.width);assert.equal(tree.children[0].children.length,1);
 for(const edge of full.edges)assert(edge.x2>edge.x1);
});
