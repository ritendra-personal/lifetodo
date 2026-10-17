import test from 'node:test';
import assert from 'node:assert/strict';
import {lifeMapPanelFromHash} from '../public/life-map.js';

test('life map subtabs have stable bookmarkable fragments',()=>{
 assert.equal(lifeMapPanelFromHash('#ask-me'),'interview');
 assert.equal(lifeMapPanelFromHash('#guided-review'),'explore');
 assert.equal(lifeMapPanelFromHash('#my-map'),'map');
 assert.equal(lifeMapPanelFromHash(''),'map');
 assert.equal(lifeMapPanelFromHash('#unknown'),'map');
});
