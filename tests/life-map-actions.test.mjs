import test from 'node:test';
import assert from 'node:assert/strict';
import {concreteAction} from '../public/life-map-actions.js';
import {suggestedAction} from '../public/life-map.js';

test('task suggestions use the specific outcome rather than inherited generic actions',()=>{
 for(const [title,verb] of [
  ['Get knee surgery completed','Contact the care team'],
  ['Master bedroom needs to be decluttered','Clear one surface'],
  ['Mortgage payment','Open the latest statement'],
  ['Renew passport','Check the official application'],
  ['Back up family photos','Run a backup'],
  ['Run a backup','Run a backup'],
  ['Learn guitar','Find an introductory lesson'],
  ['Finish my script','Write the next paragraph'],
  ['Plan a family trip','List possible travel dates'],
  ['Submit to a festival','Open the submission page']
 ]){
  const result=suggestedAction({title,parent:'health',action:'Choose one manageable next step.'});
  assert(result.startsWith(verb),`${title}: ${result}`);
  assert(result.includes(title));
 }
});

test('unknown needs require the user’s action instead of a fabricated generic task',()=>{
 assert.equal(concreteAction({title:'My unusual personal outcome',action:'Identify a first step'}),'');
 assert.equal(concreteAction({title:'Surgery'},{status:'unsure'}),'');
 assert.equal(concreteAction({title:'Surgery'},{support:'information'}),'');
 assert.equal(concreteAction({title:'Surgery'},{next:' Call Dr Lee to confirm Tuesday '}),'Call Dr Lee to confirm Tuesday');
});

test('support suggestions have a concrete deliverable and preserve the outcome context',()=>{
 assert.match(concreteAction({title:'Choose a course'},{support:'decision'}),/^Write the options and one advantage and drawback/);
 assert.match(concreteAction({title:'Refund request'},{support:'waiting'}),/^Send a follow-up requesting an update/);
 assert.match(concreteAction({title:'Help with transport',personName:'Sam'}),/^Message Sam/);
});
