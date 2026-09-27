import assert from 'node:assert/strict';
import { classifyShift } from '../api/calendar.js';

const d='2026-09-27T00:00:00';

assert.deepEqual(
  classifyShift('simio reperibile notte',d,'2026-09-28T00:00:00'),
  {date:'2026-09-27',title:'simio reperibile notte',load:0,workType:'availability',countsAsWork:false,source:'Google Calendar',start:d,end:'2026-09-28T00:00:00'}
);

assert.equal(classifyShift('simio mattina',d,d).workType,'morning');
assert.equal(classifyShift('simio mattina',d,d).load,1);

assert.equal(classifyShift('simio pomeriggio',d,d).workType,'afternoon');
assert.equal(classifyShift('simio pomeriggio',d,d).load,2);

assert.equal(classifyShift('simio notte ambu',d,d).workType,'night');
assert.equal(classifyShift('simio notte ambu',d,d).load,3);

assert.equal(classifyShift('simio 24 ore ambu',d,d).workType,'24h');
assert.equal(classifyShift('simio 24 ore ambu',d,d).load,4);

const weekend=classifyShift('weekend ospedale',d,d);
assert.equal(weekend.workType,'morning');
assert.equal(weekend.weekendHospital,true);
assert.equal(weekend.load,1);

assert.equal(classifyShift('guardia generica',d,d),null);

console.log('Calendar schedule semantics OK');
