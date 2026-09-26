import fs from 'node:fs';
import assert from 'node:assert/strict';
import { parseFitness, parseSleep, parseSleepHrv, parseRestingHeartRate, parseActivities, parseLoad, protectedResourceFromError, trustedCorosMcpUrl } from '../lib/coros-mcp.js';

const fitness=parseFitness(`Fitness Assessment Overview
VO2max: 50
Running Level: 71
Threshold Pace: 5:27 /km
5 km Prediction: 26:13
10 km Prediction: 54:57
Half Marathon Prediction: 2:04:44
Marathon Prediction: 4:26:34`);
assert.equal(fitness.vo2max,50);
assert.equal(fitness.runningLevel,71);
assert.equal(fitness.racePredictions.k5,'26:13');

const sleep=parseSleep(`Sleep Overview
2026-09-26
Sleep Score: 93
Daily Sleep: 9h 25min (incl. naps)
Main Sleep (asleep): 6h 19min
Main Sleep Period (incl. awake): 6h 27min
Deep Sleep Ratio: 22%
Light Sleep Ratio: 50%
REM Ratio: 26%
Awake Ratio: 2%
Awake Time: 8 min
Main Sleep Window: 2026-09-26 00:14 - 2026-09-26 06:41
Naps Total (asleep): 3h 6min`);
assert.equal(sleep[0].mainSleepMinutes,379);
assert.equal(sleep[0].napMinutes,186);
assert.equal(sleep[0].score,93);

const hrv=parseSleepHrv(`HRV Assessment — Last 7 days
2026-09-26:
  HRV Avg: 36 ms — Normal
  Normal Range: 35 - 49 ms
  Baseline: 42 ms
Sleep HRV Time Series — Last 7 days`);
assert.deepEqual(hrv[0],{date:'2026-09-26',avg:36,evaluation:'Normal',normalLow:35,normalHigh:49,baseline:42,source:'COROS Sleep HRV'});

const rhr=parseRestingHeartRate(`Resting Heart Rate
2026-09-26: 59 bpm
2026-09-25: 61 bpm
2026-09-24: No data`);
assert.equal(rhr.length,2);
assert.equal(rhr[1].value,59);

const activities=parseActivities(`Sport Records
1. Outdoor Run — 2026-07-03
   Location: Corsa facile
   Duration: 57:01 | Distance: 8.45 km
   Average Pace: 6:45 /km | Avg HR: 150 bpm | Calories: 690 kcal
   LabelId: 478637727651234193 | SportType: 100

2. Strength — 2026-09-25
   Location: Forza
   Duration: 46:16 | Sets: 19
   Avg HR: 110 bpm | Calories: 251 kcal
   LabelId: 480596766385799368 | SportType: 402`);
assert.equal(activities.length,2);
assert.equal(activities[0].kind,'run');
assert.equal(activities[0].distanceKm,8.45);
assert.equal(Math.round(activities[0].durationMinutes),57);
assert.equal(activities[1].sets,19);

const load=parseLoad(`2026-09-26
Comment: Decreasing
Short-Term Load: 14
Long-Term Load: 38
Load Ratio: 0.36

2026-09-25
Comment: Decreasing
Short-Term Load: 16
Long-Term Load: 39
Load Ratio: 0.41`);
assert.equal(load.length,2);
assert.equal(load.at(-1).ratio,0.36);

console.log('SmartCoach parser smoke tests OK');


const regional=protectedResourceFromError(new Error('Protected resource https://mcpus.coros.com/mcp does not match expected https://mcp.coros.com/mcp (or origin)'));
assert.equal(String(regional),'https://mcpus.coros.com/mcp');
assert.equal(String(trustedCorosMcpUrl('https://mcp-eu.coros.com/mcp')),'https://mcp-eu.coros.com/mcp');
assert.equal(trustedCorosMcpUrl('https://evil.example/mcp'),null);
assert.equal(trustedCorosMcpUrl('http://mcpus.coros.com/mcp'),null);


const callbackSource=fs.readFileSync(new URL('../api/coros-callback.js',import.meta.url),'utf8');
assert.match(callbackSource,/finishAuth\(params\.get\(['"]code['"]\)\)/);
assert.doesNotMatch(callbackSource,/finishAuth\(params\)/);
