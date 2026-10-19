const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('public/app.js','utf8');
function extract(name){
 const start=source.search(new RegExp('(?:async )?function '+name+'\\('));
 assert(start>=0,name);
 const ends=[source.indexOf('\nfunction ',start+1),source.indexOf('\nasync function ',start+1)].filter(index=>index>=0);
 return source.slice(start,Math.min(...ends));
}
function setup(){
 const writes=[];
 const state={user:{id:'owner'},people:[{id:'person',first_name:'Test',relationship_type_id:'old',race:'keep'}],peoplePrivateRows:[{person_id:'person',payload:{old:true}}],privateTableReady:true,privateUnlocked:true,privateKey:{},privatePassphrase:'test'};
 const context=vm.createContext({state,Map,Promise,Boolean,Array,Error,
  normalizePerson:person=>({id:'person',...person}),nowIso:()=> 'now',
  createDiagnosticTrace:()=>()=>{},isSupabaseReady:()=>true,
  isPrivatePeopleUnlocked:()=>state.privateUnlocked,
  publicPersonForStorage:person=>({...person,relationship_type_id:'',race:'',age_category_id:'',age_band:''}),
  saveLocal:()=>{},render:()=>{},savedAtLabel:()=> 'now',
  withSlowOperationNotice:callback=>callback(),
  encryptPrivateAttributes:async values=>({encrypted:JSON.stringify(values)}),
  upsertRowDirect:async(table,payload)=>{writes.push({table,payload});return payload;},
  supabaseRestMutation:async(path,options)=>{const row=JSON.parse(options.body);writes.push({table:'private',payload:row});return [row];}
 });
 vm.runInContext('const personAutosaveQueues=new Map();\n'+['privateValuesForPerson','persistPerson','upsertPrivatePersonRow','persistPersonAutosave','autosavePersonCard'].map(extract).join('\n'),context);
 return {context,state,writes};
}
test('unavailable private table cannot silently report a successful person save',async()=>{
 const {context,state,writes}=setup();state.privateTableReady=false;
 await assert.rejects(context.persistPerson({id:'person',first_name:'Test',relationship_type_id:'new'},{requireCloud:true}),/private attributes table/);
 assert.equal(writes.length,0);assert(state.syncError);assert.equal(state.people[0].relationship_type_id,'old');
 await assert.rejects(context.upsertPrivatePersonRow('person',{relationship_type_id:'new'}),/not saved to database/);
});
test('relationship success is reported only after confirmed encrypted database write',async()=>{
 const {context,state,writes}=setup();
 await context.persistPerson({id:'person',first_name:'Test',relationship_type_id:'new'},{requireCloud:true});
 assert.equal(writes[0].payload.relationship_type_id,null);
 assert.equal(JSON.parse(writes[1].payload.payload.encrypted).relationship_type_id,'new');
 assert.equal(JSON.parse(writes[1].payload.payload.encrypted).race,'keep');
 assert.equal(state.people[0].relationship_type_id,'new');assert.equal(state.syncError,'');
});
test('private write failures and empty acknowledgements stay errors, preserving previous data',async()=>{
 for(const response of [async()=>{throw Error('Private write failed');},async()=>[]]){
  const {context,state}=setup();context.supabaseRestMutation=response;
  await assert.rejects(context.persistPerson({id:'person',first_name:'Test',relationship_type_id:'new'},{requireCloud:true}));
  assert.equal(state.people[0].relationship_type_id,'old');assert.equal(state.peoplePrivateRows[0].payload.old,true);assert(state.syncError);
 }
});
test('autosaves for the same person are serialized and a failed save does not block retry',async()=>{
 const {context,state}=setup();let release,active=0,maxActive=0;
 context.supabaseRestMutation=async(path,options)=>{active++;maxActive=Math.max(active,maxActive);const row=JSON.parse(options.body);if(JSON.parse(row.payload.encrypted).relationship_type_id==='first')await new Promise(resolve=>release=resolve);active--;return [row];};
 const first=context.persistPersonAutosave({id:'person',first_name:'Test',relationship_type_id:'first'},{requireCloud:true});
 while(!release)await Promise.resolve();
 const second=context.persistPersonAutosave({id:'person',first_name:'Test',relationship_type_id:'second'},{requireCloud:true});
 release();await first;await second;assert.equal(maxActive,1);assert.equal(state.people[0].relationship_type_id,'second');
 context.supabaseRestMutation=async()=>{throw Error('Offline');};
 await assert.rejects(context.persistPersonAutosave({id:'person',first_name:'Test'},{requireCloud:true}));
 context.supabaseRestMutation=async(path,options)=>[JSON.parse(options.body)];
 await context.persistPersonAutosave({id:'person',first_name:'Test',relationship_type_id:'retry'},{requireCloud:true});
 assert.equal(state.people[0].relationship_type_id,'retry');
});
test('locking during a failed save cannot restore decrypted fields into the locked view',async()=>{
 const {context,state}=setup();context.supabaseRestMutation=async()=>{state.privateUnlocked=false;throw Error('Offline');};
 await assert.rejects(context.persistPerson({id:'person',first_name:'Test',relationship_type_id:'new'},{requireCloud:true}));
 assert.equal(state.people[0].relationship_type_id,'');assert.equal(state.people[0].race,'');
});
test('autosave captures the selected relationship before a rerender or navigation changes the form',async()=>{
 const {context}=setup();let callback,saved;
 context.queueAutosave=(key,fn)=>callback=fn;
 context.persistPersonAutosave=async values=>saved=values;
 const fields={firstName:'Test',lastName:'Person',gender:'',ageCategoryId:'age',race:'race',relationshipTypeId:'selected'};
 const card={dataset:{personId:'person'},querySelector:selector=>{const name=selector.match(/name='([^']+)'/)[1];return name in fields?{value:fields[name]}:null;},querySelectorAll:()=>[]};
 context.autosavePersonCard(card);fields.relationshipTypeId='';await callback();
 assert.equal(saved.relationship_type_id,'selected');
});
