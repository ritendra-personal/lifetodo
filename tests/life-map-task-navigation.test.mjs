import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

test('adding a task keeps the outcome open and clears the field for another task',async()=>{
 const source=readFileSync(new URL('../public/life-map.js',import.meta.url),'utf8');
 const handler=source.slice(source.indexOf("root.querySelector('#lm-create')?.addEventListener"),source.indexOf("root.querySelectorAll('[data-toggle]')"));
 const body=handler.slice(handler.indexOf('async e=>{')+10,handler.lastIndexOf('\n });'));
 const input={value:'First task',focus(){this.focused=true;}};
 const data={links:{outcome:['task:old']},answers:{}};
 const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;
 const run=new AsyncFunction('e','FormData','api','data','current','area','answer','records','save','root',"let notice='';"+body);
 let created=0;
 const api={createTask:async()=>({id:'new'+(++created)}),render(){}};
 const event={preventDefault(){},target:{querySelector:()=>({disabled:false})}};
 const Form=class{get(){return 'New task';}};
 for(let i=0;i<2;i++)await run(event,Form,api,data,{id:'outcome',title:'Outcome'},{area:'Home'},{},[],async()=>{}, {querySelector:()=>input});
 assert.deepEqual(data.links.outcome,['task:old','task:new1','task:new2']);
 assert.equal(input.value,'');
 assert.equal(input.focused,true);
});
