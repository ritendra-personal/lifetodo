import test from 'node:test';
import assert from 'node:assert/strict';
import {topicReviewState,topicSecondaryStatus} from '../public/life-map.js';

test('excluded language has one review badge without a redundant status label',()=>{
 const topics=[{id:'interests'},{id:'language',parent:'interests'},{id:'french',parent:'language'}];
 const answers={language:{status:'uninterested'},french:{status:'progress'}};
 assert.match(topicReviewState('language',topics,answers).label,/Not of interest/);
 assert.equal(topicSecondaryStatus('language',topics,answers),'');
 assert.equal(topicSecondaryStatus('french',topics,answers),'');
 assert.equal(topicSecondaryStatus('language',topics,{language:{status:'progress'}}),'In progress');
});
