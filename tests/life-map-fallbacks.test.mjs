import test from 'node:test';
import assert from 'node:assert/strict';
import {discoveryTopics,hasFallbackChoice} from '../public/life-map.js';

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
