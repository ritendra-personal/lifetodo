const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('public/app.js','utf8');
function extract(name){const start=source.indexOf('function '+name+'(');assert(start>=0);const ends=[source.indexOf('\nfunction ',start+1),source.indexOf('\nasync function ',start+1)].filter(i=>i>=0);return source.slice(start,Math.min(...ends));}
function fixture(){
 const storage=new Map(),state={view:'people-filter',skills:[{id:'acting',name:'Acting'}],relationshipTypes:[{id:'strong',name:'4-Strong'}],projectAssignments:[],people:[{id:'a',skill_ids:['acting'],relationship_type_id:'strong'},{id:'b',skill_ids:['acting'],relationship_type_id:'other'},{id:'c',skill_ids:[],relationship_type_id:'strong'}]};let unlocked=true,renders=0;
 const context=vm.createContext({state,sessionStorage:{setItem:(k,v)=>storage.set(k,v)},isPrivatePeopleUnlocked:()=>unlocked,render:()=>renders++});
 vm.runInContext(['applyPeopleAnnotationFilter','filteredPeople'].map(extract).join('\n'),context);
 return {context,state,storage,lock:()=>unlocked=false,renders:()=>renders};
}
test('clicking a skill selects the existing filter and shows matching people',()=>{
 const {context,storage,renders}=fixture();context.applyPeopleAnnotationFilter('skill','acting');
 assert.equal(storage.get('people-skill-filter'),'acting');assert.equal(renders(),1);
 assert.deepEqual(Array.from(context.filteredPeople('acting',''),p=>p.id),['a','b']);
});
test('relationship click respects existing skill and project filters',()=>{
 const {context,storage}=fixture();storage.set('people-project-filter','project');storage.set('people-skill-filter','acting');
 context.applyPeopleAnnotationFilter('relationship','strong');
 assert.equal(storage.get('people-relationship-filter'),'strong');assert.equal(storage.get('people-project-filter'),'project');
 assert.equal(storage.get('people-skill-filter'),'acting');
 assert.deepEqual(Array.from(context.filteredPeople('acting','strong'),p=>p.id),['a']);
});
test('locked private relationship filtering and unknown values are rejected',()=>{
 const {context,storage,lock,renders}=fixture();lock();context.applyPeopleAnnotationFilter('relationship','strong');
 context.applyPeopleAnnotationFilter('skill','missing');context.applyPeopleAnnotationFilter('unknown','acting');
 assert.equal(storage.size,0);assert.equal(renders(),0);
});
test('read rows render separate accessible filter buttons rather than a single skills string',()=>{
 const row=extract('makePeopleReadRow');
 assert(row.includes("makePeopleAnnotationFilter('relationship'"));
 assert(row.includes("makePeopleAnnotationFilter('skill'"));
 assert(extract('makePeopleAnnotationFilter').includes("button.setAttribute('aria-label',button.title)"));
 assert(source.includes("event.target.closest('[data-people-filter-kind]')"));
});
