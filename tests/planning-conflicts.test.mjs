import test from 'node:test';
import assert from 'node:assert/strict';
import {conflictsOnDate,missingHolidayReferences} from '../public/planning-conflicts.js';
import {planningHolidays} from '../public/planning-holidays.js';

test('external conflicts use inclusive editable date ranges and independent overlay filters',()=>{
 const records=[{id:'one',category:'custom',start_date:'2027-01-01',end_date:'2027-01-03'},{id:'two',category:'us',start_date:'2027-01-01',end_date:'2027-01-01'}];
 assert.deepEqual(conflictsOnDate(records,'2027-01-01').map(item=>item.id),['one','two']);
 assert.deepEqual(conflictsOnDate(records,'2027-01-03').map(item=>item.id),['one']);
 assert.deepEqual(conflictsOnDate(records,'2027-01-01',{custom:false,us:true}).map(item=>item.id),['two']);
 assert.equal(conflictsOnDate(records,'2027-01-04').length,0);
});
test('reference import is idempotent and preserves edited imported records and custom conflicts',()=>{
 const imported=missingHolidayReferences([],2026,2028);
 const edited=imported.map((record,index)=>({...record,id:String(index),name:'Edited',start_date:'2027-12-01'}));
 const existing=[...edited,{id:'custom',name:'Community show',start_date:'2027-10-29',end_date:'2027-10-30',category:'custom'}];
 assert.deepEqual(missingHolidayReferences(existing,2026,2028),[]);
 assert.equal(existing[0].name,'Edited');
 assert.ok(imported.every(record=>record.source&&record.source_key));
});
test('reference dates include actual and observed U.S. holidays across year boundaries',()=>{
 const holidays=planningHolidays(2026,2028);
 for(const [date,name] of [['2026-07-03','Independence Day (U.S.) (observed)'],['2026-07-04','Independence Day (U.S.)'],['2027-12-31',"New Year's Day (observed)"],['2027-11-25','Thanksgiving'],['2028-05-29','Memorial Day'],['2027-10-29','Diwali']])assert.ok(holidays.some(item=>item.date===date&&item.name===name),`${date}: ${name}`);
 assert.ok(holidays.find(item=>item.name==='Eid al-Fitr'&&item.date.startsWith('2027')).provisional);
});
