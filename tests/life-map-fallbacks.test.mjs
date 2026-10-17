import test from 'node:test';
import assert from 'node:assert/strict';
import {discoveryTopics,hasFallbackChoice,outcomeMenuChildren,outcomeEntryMarkup} from '../public/life-map.js';

test('all generated topic menus offer only one fallback route',()=>{
 const topics=discoveryTopics();
 for(const parent of new Set(topics.map(topic=>topic.parent))){
  const children=topics.filter(topic=>topic.parent===parent);
  const choices=children.filter(topic=>hasFallbackChoice([topic]));
  const genericAddShown=!hasFallbackChoice(children);
  assert.equal(choices.length+Number(genericAddShown),1,`Fallback routes under ${parent}`);
 }
 for(const topic of topics.filter(topic=>hasFallbackChoice([topic]))){
  const parent=topics.find(item=>item.id===topic.parent);
  assert(!parent||!hasFallbackChoice([parent]),`Nested fallback under ${topic.id}`);
 }
});

test('Relationships New connections suppresses generic Add something else',()=>{
 const children=discoveryTopics().filter(topic=>topic.parent==='check:relationships:4');
 assert.equal(children.filter(topic=>hasFallbackChoice([topic])).length,1);
 assert(hasFallbackChoice(children));
 assert(hasFallbackChoice([{title:' Something Else '}]));
 assert(!hasFallbackChoice([{title:'Making friends'}]));
});
test('all visible menus use the expanded outcome field rather than generated fallback topics',()=>{
 const topics=discoveryTopics();
 for(const parent of new Set(topics.map(topic=>topic.parent))){
  assert(!hasFallbackChoice(outcomeMenuChildren(parent,topics)),parent);
 }
 const html=outcomeEntryMarkup();
 assert(html.includes('id="lm-custom"'));
 assert(html.includes('Add outcome'));
 assert(!/details|summary|hidden|Something else/i.test(html));
});
test('saved outcomes beneath old fallback wrappers stay accessible without rewriting their parent',()=>{
 const topics=[{id:'fallback',parent:'root',title:'Something else',suggested:true},{id:'saved',parent:'fallback',title:'My saved outcome'}];
 assert.deepEqual(outcomeMenuChildren('root',topics).map(t=>t.id),['saved']);
 assert.equal(topics[1].parent,'fallback');
 const named={id:'named',parent:'root',title:'Something else',suggested:false};
 assert(outcomeMenuChildren('root',[...topics,named]).includes(named));
});
