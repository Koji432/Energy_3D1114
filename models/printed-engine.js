import * as THREE from '../vendor/three.module.js';

// Original, unmodified print meshes by WhopperPrinting. See the repository README.
// Dimensions below are in the STL's millimetres; the display scale is applied
// to the complete assembly, never to individual parts.
export const dimensions = Object.freeze({
  crankRadius: 17,
  rodLength: Math.hypot(149.693840084 - 92.5, 121.374352778 - 64.18051317),
  crankHeight: 46.18051274,
  boreDepth: 54.031947 - 53.450884,
});

export function enginePose(turn) {
  const angle = turn * Math.PI * 2;
  const { crankRadius: r, rodLength: length, crankHeight: y } = dimensions;
  const pinX = -r * Math.sin(angle);
  const pinY = y + r * Math.cos(angle);
  const rise = Math.sqrt(length * length - pinX * pinX);
  return { angle, pinX, pinY, pistonY: pinY + rise, rodAngle: -Math.atan2(-pinX, rise) };
}

const sourceBuffers = new Map();
async function fetchPart(name) {
  let failure;
  for (let attempt = 0; attempt < 3; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    try {
      const response = await fetch(new URL(`../assets/printed-engine/${name}.stl`, import.meta.url),
        { signal: controller.signal, cache: 'force-cache' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.arrayBuffer();
    } catch (error) {
      failure = error;
    } finally {
      clearTimeout(timer);
    }
    if (attempt < 2) await new Promise(resolve => setTimeout(resolve, 250 * (attempt + 1)));
  }
  throw new Error(`Engine part ${name}: ${failure.message}`, { cause: failure });
}

async function readMesh(name) {
  if (!sourceBuffers.has(name)) {
    sourceBuffers.set(name, fetchPart(name).catch(error => { sourceBuffers.delete(name); throw error; }));
  }
  const buffer = await sourceBuffers.get(name);
  const data = new DataView(buffer);
  const count = data.getUint32(80, true);
  if (84 + count * 50 !== buffer.byteLength) throw new Error(`Invalid STL: ${name}`);
  const positions = new Float32Array(count * 9);
  const normals = new Float32Array(count * 9);
  for (let face = 0; face < count; face++) {
    const offset = 84 + face * 50;
    for (let vertex = 0; vertex < 3; vertex++) {
      for (let axis = 0; axis < 3; axis++) {
        positions[face * 9 + vertex * 3 + axis] = data.getFloat32(offset + 12 + vertex * 12 + axis * 4, true);
        normals[face * 9 + vertex * 3 + axis] = data.getFloat32(offset + axis * 4, true);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  if (name === 'engineblock-1x') {
    // Flatten only the shallow lettering recesses in the display mesh.
    // The downloaded STL remains unchanged; attribution is retained separately.
    for (let i = 0; i < positions.length; i += 3) {
      const x = positions[i], y = positions[i + 1], z = positions[i + 2];
      if (y < 29.70 || y > 78.36 || z < 41.80 || z > 67.78) continue;
      if (x >= 142.87 && x <= 143.69) positions[i] = 143.68098;
      if (x >= 41.31 && x <= 42.13) positions[i] = 41.31902;
    }
    geometry.computeVertexNormals();
  }
  geometry.computeBoundingSphere();
  return [name, geometry];
}

export async function createPrintedEngine() {
  const names = ['engineblock-1x', 'handlecasing-1x', 'endcasing-1x', 'weight1-1x', 'weight2-1x',
    'head-1x', 'connectingrod-1x', 'rod-1x', 'washer-4x', 'rod-bolt-2x', 'bolt-9x',
    'pistonbolt-1x', 'nut-3x', 'handle-1x'];
  // Limit concurrent downloads, and reuse source data when switching products.
  const meshes = {};
  let cursor = 0;
  const results = await Promise.allSettled(Array.from({ length: 4 }, async () => {
    while (cursor < names.length) {
      const [name, geometry] = await readMesh(names[cursor++]);
      meshes[name] = geometry;
    }
  }));
  const failed = results.find(result => result.status === 'rejected');
  if (failed) {
    Object.values(meshes).forEach(geometry => geometry.dispose());
    throw failed.reason;
  }
  const root = new THREE.Group();
  root.scale.setScalar(.035);
  const plastic = color => new THREE.MeshStandardMaterial({ color, roughness: .67, metalness: .03 });
  const shell = plastic(0xb5bdc4);
  const weight = plastic(0x717d88);
  const linkage = plastic(0xef9a37);
  const fastener = plastic(0x8d98a3);
  const handleMaterial = plastic(0x485b6c);
  const parts = [];
  const { boreDepth: depth, crankHeight: crankY } = dimensions;

  function part(name, material, anchor, rotation, pose, separation = [0, 0, 0]) {
    const placement = new THREE.Group();
    placement.name = name;
    const orientation = new THREE.Group();
    orientation.rotation.set(...rotation);
    const mesh = new THREE.Mesh(meshes[name], material);
    mesh.position.set(...anchor.map(value => -value));
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    orientation.add(mesh);
    placement.add(orientation);
    root.add(placement);
    parts.push({ placement, pose, separation });
    return placement;
  }
  const fixed = position => () => ({ position, angle: 0 });
  const crank = z => pose => ({ position: [0, crankY, z], angle: pose.angle });
  const pin = z => pose => ({ position: [pose.pinX, pose.pinY, z], angle: pose.angle });
  const piston = z => pose => ({ position: [0, pose.pistonY, z], angle: 0 });

  part('engineblock-1x', shell, [92.5, 54.031947, 0], [-Math.PI / 2, 0, 0], fixed([0, 0, 0]), [-112, 0, 0]);

  // Both covers share the block's four bolt axes. Their bearing faces sit
  // outside the crank cheeks and thrust washers; the rear bearing is blind.
  part('handlecasing-1x', shell, [92.5, -33, -122.8], [0, 0, 0], fixed([0, 0, 24]), [0, 0, 110]);
  part('endcasing-1x', shell, [92.5, -33, 0], [0, Math.PI, 0], fixed([0, 0, -24]), [0, 0, -110]);

  // The longer axle belongs to the handle side. Rotating the rear mesh about
  // Y points its short axle outward without mirroring the original geometry.
  part('weight2-1x', weight, [92.5, 13.18051274, 0], [0, 0, 0], crank(depth + 6.5), [0, 0, 52]);
  part('weight1-1x', weight, [92.5, 13.18051274, -58.4], [0, Math.PI, 0], crank(depth - 6.5), [0, 0, -52]);
  part('connectingrod-1x', linkage, [92.5, 64.18051317, -83.25], [0, 0, Math.PI / 4],
    pose => ({ position: [pose.pinX, pose.pinY, depth], angle: pose.rodAngle }));
  part('rod-1x', fastener, [92.5, 30.180513, 10.451344], [0, 0, 0], pin(depth));
  part('head-1x', linkage, [156.763943153, 128.444202749, 29.999979861], [Math.PI / 2, 0, 0], piston(depth), [0, 45, 0]);

  // Two washers on the big end and two on the crankshaft bearings.
  for (const side of [-1, 1]) {
    part('washer-4x', fastener, [92.5, 30.180513, -75.8], [0, 0, 0], pin(depth + side * 5.5), [0, 0, side * 27]);
    part('washer-4x', fastener, [92.5, 30.180513, -75.8], [0, 0, 0], crank(depth + side * 22.5), [0, 0, side * 80]);
    part('rod-bolt-2x', fastener, [92.5, 30.180513, -43.6], [0, side < 0 ? Math.PI : 0, 0],
      pin(depth + side * 21.5), [0, 0, side * 68]);
    part('nut-3x', fastener, [149.69384, 87.374355, -99.6], [0, 0, 0], pin(depth + side * 19), [0, 0, side * 60]);
  }
  part('pistonbolt-1x', fastener, [34.693837, 87.374355, 16.75], [0, 0, 0], piston(depth), [0, 45, 38]);
  part('nut-3x', fastener, [149.69384, 87.374355, -99.6], [0, 0, 0], piston(depth + 14.75), [0, 45, 55]);

  // Source handle: the attachment bore is along Y, at X=92.5/Z=46.1805.
  // Rotate it into the same shaft frame as the two crank weights.
  part('handle-1x', handleMaterial, [92.5, -47.15977, 46.18051274], [Math.PI / 2, Math.PI, 0],
    crank(depth + 34), [0, 0, 153]);
  part('bolt-9x', fastener, [92.5, 30.180513, 3.5], [0, Math.PI, 0],
    crank(depth + 46), [0, 0, 177]);
  for (const side of [-1, 1]) {
    for (const [x, y] of [[46.7, 28], [59.7, 7.8], [125.3, 7.8], [138.3, 28]]) {
      part('bolt-9x', fastener, [92.5, 30.180513, 3.5], [0, side > 0 ? Math.PI : 0, 0],
        fixed([x - 92.5, y, side * 33.2]), [0, 0, side * 136]);
    }
  }

  // Thin axial guides appear only when separated; they identify mating axes.
  const guides = new THREE.LineSegments(new THREE.BufferGeometry(),
    new THREE.LineDashedMaterial({ color: 0x71869a, dashSize: 2.2, gapSize: 2.8, transparent: true, opacity: .45 }));
  const guidePositions = new Float32Array(18);
  guides.geometry.setAttribute('position', new THREE.BufferAttribute(guidePositions, 3));
  root.add(guides);

  function update(turn, spread = 0, focus = null) {
    const state = enginePose(turn);
    for (const { placement, pose, separation } of parts) {
      const current = pose(state);
      placement.position.set(...current.position).addScaledVector(new THREE.Vector3(...separation), spread);
      placement.rotation.z = current.angle;
    }
    shell.transparent = focus === 'linkage';
    shell.opacity = focus === 'linkage' ? .17 : 1;
    shell.depthWrite = focus !== 'linkage';
    guides.visible = spread > .02;
    guidePositions.set([
      0, crankY, -24 - 110 * spread, 0, crankY, 46 + 177 * spread,
      state.pinX, state.pinY, depth - 21.5 - 68 * spread, state.pinX, state.pinY, depth + 21.5 + 68 * spread,
      0, state.pistonY + 45 * spread, depth - 18, 0, state.pistonY + 45 * spread, depth + 55 * spread + 18,
    ]);
    guides.geometry.attributes.position.needsUpdate = true;
    guides.geometry.computeBoundingSphere();
    guides.computeLineDistances();
  }
  update(.08);
  return { root, update, camera: [7.2, 5.2, 12.7], target: [0, 3.05, .7], fitAspect: .75, explodedFitAspect: 1.48,
    explodedCamera: [13, 10, 19], explodedTarget: [-.6, 3, 1.2] };
}
