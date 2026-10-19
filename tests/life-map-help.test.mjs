import test from 'node:test';
import assert from 'node:assert/strict';
import {topicDescription,bindTopicTooltips} from '../public/life-map-help.js';
import {baseTopics,discoveryTopics} from '../public/life-map.js';
test('every generated topic has help and Repairs and safety explains its scope',()=>{
 const topics=[...baseTopics,...discoveryTopics()];
 for(const topic of topics)assert(topicDescription(topic,topics).length>15,topic.id);
 const help=topicDescription(topics.find(topic=>topic.id==='check:home:0'),topics);
 assert.match(help,/Plumbing or leaks/);assert.match(help,/Electrical repairs/);assert.match(help,/Fire and home safety/);
 assert(!help.includes('Something else'));
});
test('custom outcome help preserves notes, uses context and does not invent a scope',()=>{
 const topics=[{id:'parent',title:'Home organization'},{id:'mine',parent:'parent',title:'Declutter the bedroom',isOutcome:true}];
 const answers={mine:{notes:'Keep the wardrobe. Donate extra chairs.'}},before=JSON.stringify({topics,answers});
 const description=topicDescription(topics[1],topics,answers);
 assert.match(description,/Keep the wardrobe/);assert.match(description,/Under Home organization/);
 assert.equal(JSON.stringify({topics,answers}),before);
 assert.equal(topicDescription(null,topics),'');
});
test('tooltip examples and notes are bounded rather than overflowing with every child',()=>{
 const topic={id:'parent',title:'A topic'},topics=[topic,...Array.from({length:20},(_,i)=>({id:String(i),parent:'parent',title:'Choice '+i}))];
 const description=topicDescription(topic,topics,{parent:{notes:'x'.repeat(3000)}});
 assert(description.includes('Choice 5'));assert(!description.includes('Choice 6'));assert(description.includes('and more'));assert(description.length<=900);
});
test('hover and keyboard show accessible help; Escape, scrolling and rebinding clean it up',()=>{
 const handlers=new Map(),docHandlers=new Map(),viewHandlers=new Map(),portals=[];
 const attrs=new Map(),target={dataset:{go:'repair'},getAttribute:key=>attrs.get(key),setAttribute:(key,value)=>attrs.set(key,value),removeAttribute:key=>attrs.delete(key),getBoundingClientRect:()=>({left:390,top:100,bottom:130}),closest:()=>target,contains:other=>other===target};
 const view={innerWidth:420,innerHeight:300,addEventListener:(key,fn)=>viewHandlers.set(key,fn),removeEventListener:key=>viewHandlers.delete(key)};
 const doc={defaultView:view,body:{append:element=>portals.push(element)},createElement:()=>({style:{},setAttribute(){},remove(){this.removed=true;},getBoundingClientRect:()=>({width:300,height:80})}),addEventListener:(key,fn)=>docHandlers.set(key,fn),removeEventListener:key=>docHandlers.delete(key)};
 const root={ownerDocument:doc,querySelectorAll:()=>[target],contains:node=>node===target,addEventListener:(key,fn)=>handlers.set(key,fn),removeEventListener:key=>handlers.delete(key)};
 const topics=[{id:'repair',title:'Repairs',question:'What is broken?'}];
 bindTopicTooltips(root,topics);handlers.get('pointerover')({target});
 assert.equal(portals[0].hidden,false);assert.match(attrs.get('aria-describedby'),/life-map-help/);assert.equal(portals[0].style.left,'112px');
 docHandlers.get('keydown')({key:'Escape'});assert.equal(portals[0].hidden,true);assert(!attrs.has('aria-describedby'));
 handlers.get('focusin')({target});assert.equal(portals[0].hidden,false);
 viewHandlers.get('scroll')();assert.equal(portals[0].hidden,true);
 bindTopicTooltips(root,topics);assert(portals[0].removed);assert.equal(portals.length,2);
});
