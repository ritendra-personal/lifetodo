import test from 'node:test';
import assert from 'node:assert/strict';
import {buildLifeGraph,layoutLifeGraph,graphMarkup} from '../public/life-map-graph.js';
import {mapState} from '../public/life-map.js';
test('explicit completion has a non-color indicator, including completed groups',()=>{
 const options={topics:[{id:'area',title:'Home'},{id:'group',parent:'area',title:'Organization',group:'discovery'},{id:'done',parent:'group',title:'Declutter',suggested:false}],answers:{group:{status:'well'},done:{status:'done'}},stateFor:mapState};
 const tree=buildLifeGraph(options);
 const group=tree.children[0].children[0];
 assert.equal(group.state,'complete');
 assert.equal(group.children[0].state,'complete');
 const markup=graphMarkup(tree);
 assert.match(markup,/lm-complete-check/);
 assert.match(markup,/Completed — Declutter/);
 assert.match(markup,/Taken care of/);
});
test('hide completed removes done leaves but preserves unfinished descendants and source data',()=>{
 const options={topics:[{id:'area',title:'Home'},{id:'finished',parent:'area',title:'Finished'},{id:'parent',parent:'area',title:'Done parent'},{id:'pending',parent:'parent',title:'Unfinished child'}],answers:{finished:{status:'done'},parent:{status:'well'},pending:{status:'progress'}},stateFor:mapState};
 const before=JSON.stringify(options);
 const collect=node=>[node,...node.children.flatMap(collect)];
 const hidden=collect(buildLifeGraph({...options,hideCompleted:true}));
 assert.ok(!hidden.some(node=>node.sourceId==='finished'));
 assert.ok(hidden.some(node=>node.sourceId==='pending'));
 assert.match(hidden.find(node=>node.sourceId==='parent').status,/Unfinished items below/);
 assert.equal(JSON.stringify(options),before);
 assert.ok(collect(buildLifeGraph(options)).some(node=>node.sourceId==='finished'));
 assert.equal(buildLifeGraph({...options,answers:{finished:{status:'done'},parent:{status:'done'},pending:{status:'done'}},hideCompleted:true}).children.length,0);
});
test('unfinished subtasks keep completed task and outcome ancestors accessible',()=>{
 const options={topics:[{id:'area',title:'Home'},{id:'outcome',parent:'area',title:'Outcome'}],answers:{outcome:{status:'done'}},links:{outcome:['task:parent','task:child']},tasks:[{id:'parent',title:'Done task',status:'done'},{id:'child',parent_id:'parent',title:'Open subtask',status:'active'}],stateFor:mapState,hideCompleted:true};
 const tree=buildLifeGraph(options);
 const outcome=tree.children[0].children[0];
 assert.equal(outcome.state,'complete');
 assert.equal(outcome.children[0].children[0].taskId,'child');
 assert.match(outcome.children[0].status,/Unfinished items below/);
});
test('not interested branches hide by default and can be isolated or included',()=>{
 const options={topics:[{id:'area',title:'Home'},{id:'hidden',parent:'area',title:'Hidden'},{id:'child',parent:'hidden',title:'Child'},{id:'active',parent:'area',title:'Active'}],answers:{hidden:{status:'uninterested'},child:{status:'progress'},active:{status:'progress'}}};
 const labels=tree=>[tree.label,...tree.children.flatMap(child=>labels(child))];
 assert.ok(!labels(buildLifeGraph(options)).includes('Hidden'));
 assert.ok(!labels(buildLifeGraph(options)).includes('Child'));
 assert.ok(labels(buildLifeGraph(options)).includes('Active'));
 assert.ok(labels(buildLifeGraph({...options,interestFilter:'all'})).includes('Child'));
 const excluded=labels(buildLifeGraph({...options,interestFilter:'excluded'}));
 assert.ok(excluded.includes('Hidden'));
 assert.ok(!excluded.includes('Active'));
 assert.equal(options.answers.hidden.status,'uninterested');
});
test('reviewed topics appear in My map without claiming completion',()=>{
 const tree=buildLifeGraph({topics:[{id:'area',title:'Home'},{id:'review',parent:'area',title:'Repairs',suggested:true}],answers:{review:{reviewedAt:'2026-10-13'}},stateFor:()=>({key:'unknown',label:'Not reviewed'})});
 const node=tree.children[0].children[0];
 assert.match(node.status,/Reviewed/);
 assert.equal(node.state,'unknown');
 assert.match(tree.children[0].status,/1 reviewed/);
 assert.match(tree.children[0].status,/0 complete/);
});
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

test('suggested learning branches appear only for a selected outcome',()=>{
 const topics=[{id:'growth',title:'Learning'},{id:'learn:arts',parent:'growth',title:'Arts',suggested:true},{id:'learn:dance',parent:'learn:arts',title:'Dance',suggested:true},{id:'learn:garden',parent:'growth',title:'Gardening',suggested:true}];
 assert.equal(buildLifeGraph({topics}).children.length,0);
 const graph=buildLifeGraph({topics:[...topics,{id:'my-dance',parent:'learn:dance',title:'Learn dance'}]});
 const labels=layoutLifeGraph(graph).nodes.map(n=>n.label);
 assert.deepEqual(labels,['My life outside work','Learning','Arts','Dance','Learn dance']);
});
