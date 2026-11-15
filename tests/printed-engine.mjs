import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as THREE from '../vendor/three.module.js';
import { createPrintedEngine } from '../models/printed-engine.js';
import { createCarEngine } from '../models/car-engine.js';

const originalFetch = globalThis.fetch;
const attempts = new Map();
let active = 0, peak = 0;
globalThis.fetch = async url => {
  const name = url.pathname.split('/').at(-1);
  attempts.set(name, (attempts.get(name) || 0) + 1);
  if (name === 'engineblock-1x.stl' && attempts.get(name) === 1) throw new TypeError('Temporary network failure');
  peak = Math.max(peak, ++active);
  try { return new Response(await readFile(url)); }
  finally { active--; }
};
let model;
try {
  model = await createPrintedEngine();
  assert.equal(attempts.get('engineblock-1x.stl'), 2, 'A failed download must recover automatically');
  assert.equal(attempts.size, 14, 'All source parts must be loaded');
  assert.ok(peak <= 4, 'Concurrent downloads must stay bounded');
  const before = [...attempts.values()].reduce((a,b)=>a+b,0);
  await createPrintedEngine();
  assert.equal([...attempts.values()].reduce((a,b)=>a+b,0), before, 'A repeated selection must reuse downloaded sources');
}
finally { globalThis.fetch = originalFetch; }

const parts = model.root.children.filter(part => part.isGroup);
assert.equal(parts.length, 28, 'The kit has 28 assembled pieces from 14 original STL files');
for (const [name, count] of [['washer-4x',4],['bolt-9x',9],['rod-bolt-2x',2],['nut-3x',3]]) {
  assert.equal(parts.filter(part => part.name === name).length, count, name);
}

// Compare actual rendered mesh coordinates at the measured source joint holes.
// This catches incorrect anchors, rotation signs, scale and parent transforms.
const mesh = name => model.root.getObjectByName(name).children[0].children[0];
const point = (name, xyz) => mesh(name).localToWorld(new THREE.Vector3(...xyz));
const near = (a,b,label) => assert.ok(a.distanceTo(b) < 2e-5, `${label}: ${a.distanceTo(b)}`);
let lowest = Infinity, highest = -Infinity;
for (let step=0; step<=720; step++) {
  model.update(step/720, 0);
  model.root.updateMatrixWorld(true);
  const wrist = point('head-1x',[156.763943153,128.444202749,29.999979861]);
  const small = point('connectingrod-1x',[149.693840084,121.374352778,-83.25]);
  const big = point('connectingrod-1x',[92.5,64.18051317,-83.25]);
  const pin = point('rod-1x',[92.5,30.180513,10.451344]);
  near(wrist,small,'Wrist pin must remain attached to the small end');
  near(big,pin,'Crank pin must remain attached to the big end');
  assert.ok(Math.abs(wrist.x)<1e-6,'Piston must remain on the bore axis');
  assert.ok(Math.abs(big.distanceTo(small)/.035-80.884304)<.0001,'Rod must retain its printed length');
  lowest=Math.min(lowest,wrist.y/.035);highest=Math.max(highest,wrist.y/.035);
}
assert.ok(Math.abs(highest-lowest-34)<1e-7,'Stroke must match the 17 mm crank throw');
mesh('engineblock-1x').geometry.computeBoundingBox();
const blockTop=mesh('engineblock-1x').geometry.boundingBox.max.z;
assert.ok(Math.abs(highest+29.999979861-blockTop)<.003,'Piston crown must meet the block top at TDC');

for (const spread of [0,.5,1]) {
  model.update(.25,spread,'linkage');
  model.root.updateMatrixWorld(true);
  model.root.traverse(object=>assert.ok(object.matrixWorld.elements.every(Number.isFinite)));
}

globalThis.fetch = async url => new Response(await readFile(url));
let car;
try { car = await createCarEngine(); }
finally { globalThis.fetch = originalFetch; }
for (let step=0;step<=144;step++) {
  const turn=step/72;
  car.update(turn,0,null,1);
  const crank=car.root.getObjectByName('weight2-1x');
  const input=car.root.getObjectByName('drive-input');
  const output=car.root.getObjectByName('drive-output');
  assert.equal(input.rotation.x,crank.rotation.z,'Car input must follow the actual printed crank');
  assert.equal(output.rotation.x*2,crank.rotation.z,'The depicted forward reduction must be consistent');
  const driven=car.root.getObjectsByProperty('name','driven-wheel-marker');
  assert.equal(driven.length,2);
  driven.forEach(marker=>assert.ok(Math.abs(marker.parent.rotation.x*2-crank.rotation.z)<1e-10,
    'Forward drive must rotate the wheels in the rolling direction at the illustrated reduction'));
  assert.equal(driven[0].parent.rotation.x,driven[1].parent.rotation.x,'Straight-ahead wheels must agree');
  car.root.traverse(object=>assert.ok(object.matrixWorld.elements.every(Number.isFinite)));
}
console.log('PASS: download retry/cache, 28 parts, 721 joint poses, stroke/TDC, explosion, printed crank driving the car wheels');
