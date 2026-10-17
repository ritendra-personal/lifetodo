import test from 'node:test';
import assert from 'node:assert/strict';
import {seasonPeriods,conflictingEvents,renderSeasonPlanning} from '../public/season-planning.js';

test('season plan includes the full final calendar year without missing or duplicating days',()=>{
 for(const mode of ['week','fortnight','month']){
  const start=new Date(2026,9,16),end=new Date(2029,0,1);
  const rows=seasonPeriods(start,2,mode),days=rows.flatMap(row=>row.days);
  assert.ok(days[0]<=start);
  assert.equal(new Set(days.map(day=>day.toDateString())).size,days.length);
  assert.equal(days.at(-1).toDateString(),new Date(2028,11,31).toDateString());
  assert.ok(days.some(day=>day.getFullYear()===2028&&day.getMonth()===1&&day.getDate()===29));
  for(let i=1;i<days.length;i++){
   const next=new Date(days[i-1].getFullYear(),days[i-1].getMonth(),days[i-1].getDate()+1);
   assert.equal(days[i].getTime(),next.getTime());
  }
  assert.ok(days.every(day=>day<end));
  const defaultDays=seasonPeriods(start,1,mode).flatMap(row=>row.days);
  assert.equal(defaultDays.at(-1).toDateString(),new Date(2027,11,31).toDateString());
 }
});
test('conflicts include tentative events, exclude cancellations, and allow adjacent times',()=>{
 const events=[{id:'a',start:10,end:12,status:'scheduled'},{id:'b',start:11,end:13,status:'tentative'},{id:'c',start:13,end:14,status:'scheduled'},{id:'d',start:10,end:14,status:'cancelled'}];
 const overlap=(a,b)=>a.start<b.end&&b.start<a.end;
 assert.deepEqual(conflictingEvents(events,overlap).map(event=>event.id),['a','b']);
});
test('season grid renders event editing links, date creation buttons, and conflict indicators',()=>{
 const root={innerHTML:'',querySelector:()=>({}),querySelectorAll:()=>[]};
 const today=new Date();
 renderSeasonPlanning(root,{projects:[],events:[{id:'first',title:'Film <shoot>',status:'tentative'},{id:'second',title:'Play',status:'scheduled'}],occurs:(_,day)=>day.toDateString()===today.toDateString(),overlap:()=>true,range:()=> 'All day'});
 assert.match(root.innerHTML,/data-season-event="first"/);
 assert.match(root.innerHTML,/Film &lt;shoot&gt;/);
 assert.match(root.innerHTML,/season-conflict-label">2 overlapping/);
 assert.match(root.innerHTML,/data-season-add=/);
 assert.match(root.innerHTML,/data-season-scale="fortnight"/);
});
