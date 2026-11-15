import * as THREE from '../vendor/three.module.js';

const TAU = 2 * Math.PI;
const makeMaterial = (color, metalness = .12, roughness = .46) => new THREE.MeshStandardMaterial({ color, metalness, roughness });
const dark = makeMaterial(0x21272c);
const rubber = makeMaterial(0x252c31, .06, .72);
const black = makeMaterial(0x101619);
const metal = makeMaterial(0xb1a390, .51, .35);
const nickel = makeMaterial(0xd9dce0, .53, .34);
const bronze = makeMaterial(0x837667, .52, .39);
const red = makeMaterial(0xb7453e);
const gearBlue = makeMaterial(0x3873e6, .29, .36);
const gearLight = makeMaterial(0x79ade8, .38, .39);
const linkOrange = makeMaterial(0xef9a37, .25, .34);
const camViolet = makeMaterial(0x9c63e9, .31, .36);
const camTrack = makeMaterial(0x522990, .21, .48);
const lensGlass = new THREE.MeshPhysicalMaterial({ color: 0x183e48, metalness: .65, roughness: .12, clearcoat: .9 });
const glassRim = makeMaterial(0x46636c, .48, .23);
const paper = makeMaterial(0xf8f7ef, .02, .64);
const viewGlass = makeMaterial(0x43616d, .29, .23);
const sky = makeMaterial(0x9bbdcc, .05, .64);
const sun = makeMaterial(0xfcd790, .03, .64);
const hills = makeMaterial(0x53717b, .02, .64);
const grass = makeMaterial(0x77947d, .01, .64);

function group(parent, x = 0, y = 0, z = 0) {
  const result = new THREE.Group();
  result.position.set(x, y, z);
  parent.add(result);
  return result;
}

function mesh(parent, geom, mat, x = 0, y = 0, z = 0) {
  const object = new THREE.Mesh(geom, mat);
  object.position.set(x, y, z);
  object.castShadow = true;
  object.receiveShadow = true;
  parent.add(object);
  return object;
}

function shape(points) {
  const result = new THREE.Shape(points.map(([x, y]) => new THREE.Vector2(x, y)));
  result.closePath();
  return result;
}

function rounded(width, height, radius) {
  const result = new THREE.Shape();
  const x = width / 2;
  const y = height / 2;
  result.moveTo(-x + radius, -y);
  result.lineTo(x - radius, -y);
  result.quadraticCurveTo(x, -y, x, -y + radius);
  result.lineTo(x, y - radius);
  result.quadraticCurveTo(x, y, x - radius, y);
  result.lineTo(-x + radius, y);
  result.quadraticCurveTo(-x, y, -x, y - radius);
  result.lineTo(-x, -y + radius);
  result.quadraticCurveTo(-x, -y, -x + radius, -y);
  return result;
}

function solid(parent, outline, depth, mat, x, y, z, bevel = .013) {
  const geom = new THREE.ExtrudeGeometry(outline, {
    depth: depth - 2 * bevel, bevelEnabled: bevel > 0, bevelSize: bevel, bevelThickness: bevel,
    bevelSegments: 2, curveSegments: 24,
  });
  geom.translate(0, 0, bevel - depth / 2);
  return mesh(parent, geom, mat, x, y, z);
}

function panel(parent, width, height, depth, radius, mat, x, y, z, bevel = .013) {
  return solid(parent, rounded(width, height, radius), depth, mat, x, y, z, bevel);
}

function box(parent, x, y, z, width, height, depth, mat) {
  return mesh(parent, new THREE.BoxGeometry(width, height, depth), mat, x, y, z);
}

function cylinder(parent, x, y, z, radius, length, mat, axis = 'z', radius2 = radius) {
  const part = mesh(parent, new THREE.CylinderGeometry(radius, radius2, length, 56), mat, x, y, z);
  if (axis === 'z') part.rotation.x = Math.PI / 2;
  if (axis === 'x') part.rotation.z = Math.PI / 2;
  return part;
}

function ring(parent, x, y, z, radius, thickness, mat, axis = 'z') {
  const part = mesh(parent, new THREE.TorusGeometry(radius, thickness, 10, 52), mat, x, y, z);
  if (axis === 'x') part.rotation.y = Math.PI / 2;
  return part;
}

function bar(parent, a, b, radius, mat) {
  const posA = new THREE.Vector3(...a);
  const posB = new THREE.Vector3(...b);
  const part = cylinder(parent, 0, 0, 0, radius, posA.distanceTo(posB), mat, 'y');
  part.position.copy(posA).lerp(posB, .5);
  part.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), posB.sub(posA).normalize());
  return part;
}

function screw(parent, x, y, z, radius = .068) {
  cylinder(parent, x, y, z, radius, .036, nickel);
  const slot = box(parent, x, y, z + .02, radius * 1.22, .016, .01, black);
  slot.rotation.z = .38;
}

function lens(parent, x, y) {
  cylinder(parent, x, y, .698, .77, .21, bronze);
  cylinder(parent, x, y, .817, .699, .20, rubber);
  cylinder(parent, x, y, .956, .652, .090, metal);
  cylinder(parent, x, y, 1.009, .584, .079, black);
  ring(parent, x, y, 1.055, .505, .035, glassRim);
  ring(parent, x, y, 1.062, .346, .018, black);
  cylinder(parent, x, y, 1.057, .483, .045, lensGlass);
  cylinder(parent, x, y, 1.087, .277, .025, lensGlass);
  const gleam = mesh(parent, new THREE.SphereGeometry(1, 28, 18), glassRim, x - .175, y + .188, 1.093);
  gleam.scale.set(.105, .062, .026);
  for (let i = 0; i < 36; i++) {
    const angle = i * TAU / 36;
    const rib = box(parent, x + .695 * Math.cos(angle), y + .695 * Math.sin(angle), .834, .028, .038, .136, black);
    rib.rotation.z = angle;
  }
}

function cameraCase(root) {
  const back = group(root);
  const front = group(root);
  const frame = group(root);
  const grip = group(front);
  panel(back, 3.2, 4.45, .17, .27, black, 0, 2.33, -.68, .048);
  panel(back, 2.56, 1.57, .075, .15, rubber, -.06, 3.34, -.795);
  panel(back, 2.32, 1.35, .041, .12, viewGlass, -.06, 3.34, -.837);
  panel(back, 2.52, 1.38, .078, .13, rubber, 0, 1.56, -.798);
  for (const x of [-1.28, 1.28]) for (const y of [.53, 4.19]) screw(back, x, y, -.787, .042);

  const opening = 1.62;
  panel(frame, .175, 4.25, 1.07, .079, dark, -opening + .09, 2.32, -.036, .03);
  panel(frame, .175, 4.25, 1.07, .079, dark, opening - .09, 2.32, -.036, .03);
  panel(frame, 3.13, .23, 1.05, .10, black, 0, .165, -.043, .03);
  for (const z of [-.46, .19]) {
    panel(frame, 3.14, .25, .25, .12, bronze, 0, 4.45, z, .026);
  }
  box(frame, 0, 4.48, -.165, 2.55, .065, .23, black);
  for (const x of [-1.39, 1.39]) {
    box(frame, x, 4.48, -.08, .25, .11, .69, dark);
  }

  panel(front, 3.09, 4.31, .21, .23, dark, 0, 2.32, .58, .045);
  panel(front, 3.12, .18, .27, .08, bronze, 0, 4.435, .532, .028);
  panel(front, 3.12, .18, .27, .08, bronze, 0, .252, .532, .028);
  panel(front, 2.91, 1.94, .106, .14, rubber, 0, 1.31, .702, .021);
  for (let i = 0; i < 30; i++) {
    const x = -1.35 + i * .092;
    panel(grip, .036, 1.65, .027, .016, dark, x, 1.28, .759, .003);
  }
  lens(front, -.30, 3.11);
  panel(front, .53, .32, .073, .068, black, 1.07, 4.025, .714);
  panel(front, .368, .199, .043, .042, viewGlass, 1.07, 4.025, .763);
  panel(front, .40, .148, .055, .055, nickel, -.93, 4.017, .731);
  cylinder(front, 1.04, 2.64, .748, .185, .16, bronze);
  cylinder(front, 1.04, 2.64, .84, .131, .047, red);
  panel(front, .33, .12, .072, .044, metal, .98, 3.50, .723);
  panel(front, .34, .12, .072, .044, metal, .98, 3.30, .723);

  const dial = group(front, 1.65, 3.15, .15);
  cylinder(dial, 0, 0, 0, .451, .20, black, 'x');
  cylinder(dial, .136, 0, 0, .399, .074, metal, 'x');
  cylinder(dial, .185, 0, 0, .304, .059, dark, 'x');
  ring(dial, .219, 0, 0, .268, .021, bronze, 'x');
  for (let i = 0; i < 27; i++) {
    const a = i * TAU / 27;
    const edge = box(dial, .04, Math.cos(a) * .445, Math.sin(a) * .445, .14, .033, .048, bronze);
    edge.rotation.x = a;
  }
  const lever = group(front, 1.67, 2.24, .18);
  cylinder(lever, .13, 0, 0, .21, .26, bronze, 'x');
  cylinder(lever, .28, 0, 0, .142, .095, dark, 'x');
  panel(lever, .21, .55, .16, .070, metal, .22, -.28, .08, .02);
  return { back, front, frame };
}

function gearShape(teeth, m) {
  const pitch = teeth * m / 2;
  const start = pitch - 1.19 * m;
  const outer = pitch + m;
  const points = [];
  const polar = (r, a) => points.push([r * Math.cos(a), r * Math.sin(a)]);
  for (let i = 0; i < teeth; i++) {
    const a = i * TAU / teeth;
    polar(start, a - .5 * TAU / teeth);
    polar(start, a - .33 * TAU / teeth);
    polar(outer, a - .18 * TAU / teeth);
    polar(outer, a + .18 * TAU / teeth);
    polar(start, a + .33 * TAU / teeth);
  }
  const outline = shape(points);
  for (let i = 0; i < 4; i++) {
    const angle = i * TAU / 4;
    const hole = new THREE.Path();
    hole.absarc(.52 * pitch * Math.cos(angle), .52 * pitch * Math.sin(angle), .16 * pitch, 0, TAU, true);
    outline.holes.push(hole);
  }
  return outline;
}

function gear(parent, x, y, z, teeth, m, mat) {
  const hub = group(parent, x, y, z);
  const gearFace = solid(hub, gearShape(teeth, m), .104, mat, 0, 0, 0, .009);
  gearFace.rotation.y = Math.PI / 2;
  const pitch = teeth * m / 2;
  cylinder(hub, .038, 0, 0, pitch * .242, .13, nickel, 'x');
  cylinder(hub, .115, 0, 0, pitch * .102, .028, black, 'x');
  cylinder(hub, .066, pitch * .82, 0, .033, .025, paper, 'x');
  return hub;
}

function filmCard(parent) {
  const card = group(parent);
  panel(card, 2.09, 2.78, .047, .075, paper, 0, 0, 0, .011);
  panel(card, 1.825, 1.858, .025, .016, sky, 0, .288, .029, .004);
  cylinder(card, .43, .79, .046, .191, .009, sun);
  solid(card, shape([[-.911, -.638], [-.911, -.064], [-.547, .242], [-.271, .067], [.026, .321],
    [.502, .071], [.70, .27], [.911, .118], [.911, -.638]]), .012, hills, 0, 0, .046, 0);
  solid(card, shape([[-.911, -.638], [-.911, -.361], [-.46, -.239], [.07, -.353], [.52, -.23],
    [.911, -.129], [.911, -.638]]), .01, grass, 0, 0, .055, 0);
  return card;
}

const filmBottom = .63;
const camY = 1.63;
const camZ = .04;
const camRadius = .326;
const trackWidth = .084;
// A full cam revolution lifts the claw quickly, lets the rollers take over,
// then returns the claw while the same motor keeps turning in one direction.
const clawStroke = phase => THREE.MathUtils.smoothstep(phase, .02, .42)
  - THREE.MathUtils.smoothstep(phase, .55, .78);
const grooveCenter = angle => {
  const phase = (((angle - Math.PI) / TAU) % 1 + 1) % 1;
  return .15 - .62 * clawStroke(phase);
};

function groovedBarrel(parent) {
  const part = group(parent, 0, camY, camZ);
  const count = 116;
  const arr = [];
  const indices = [];
  const geometry = new THREE.BufferGeometry();
  // The intermediate rings follow the groove, allowing the sides and the
  // follower's contact surfaces to be made from a single cylindrical mesh.
  for (let i = 0; i <= count; i++) {
    const a = i * TAU / count;
    const center = grooveCenter(a);
    const offsets = [-.78, center - .067, center - trackWidth / 2, center - .025,
      center + .025, center + trackWidth / 2, center + .067, .93];
    for (const [j, x] of offsets.entries()) {
      const r = [3, 4].includes(j) ? camRadius - .043 : camRadius;
      arr.push(x, Math.cos(a) * r, Math.sin(a) * r);
    }
  }
  for (let i = 0; i < count; i++) {
    for (let j = 0; j < 7; j++) {
      const a = i * 8 + j;
      if (j === 2 || j === 3 || j === 4) {
        geometry.addGroup(indices.length, 6, 1);
      } else {
        geometry.addGroup(indices.length, 6, 0);
      }
      indices.push(a, a + 8, a + 1, a + 1, a + 8, a + 9);
    }
  }
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  // Use a single call per material instead of one call per groove segment.
  const partitions = [[], []];
  for (const entry of geometry.groups) {
    partitions[entry.materialIndex].push(...indices.slice(entry.start, entry.start + entry.count));
  }
  geometry.clearGroups();
  geometry.setIndex(partitions.flat());
  geometry.addGroup(0, partitions[0].length, 0);
  geometry.addGroup(partitions[0].length, partitions[1].length, 1);

  mesh(part, geometry, [camViolet, camTrack]);
  for (const x of [-.78, .93]) {
    cylinder(part, x, 0, 0, .33, .091, camViolet, 'x');
    ring(part, x + .045, 0, 0, .248, .027, camTrack, 'x');
    cylinder(part, x + .075, 0, 0, .10, .18, nickel, 'x');
  }
  cylinder(part, 1.196, 0, 0, .088, .48, nickel, 'x');
  return part;
}

function roller(parent, y, z, light) {
  const result = group(parent, 0, y, z);
  cylinder(result, 0, 0, 0, .187, 2.71, light ? nickel : bronze, 'x');
  cylinder(result, 0, 0, 0, .067, 3.16, nickel, 'x');
  for (let i = 0; i < 6; i++) {
    ring(result, -.99 + i * .394, 0, 0, .186, .009, light ? black : nickel, 'x');
  }
  box(result, 0, .182, 0, 2.48, .014, .033, light ? bronze : black);
  return result;
}

function guideLine(root, color, a, b) {
  const geom = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
  const line = new THREE.Line(geom, new THREE.LineDashedMaterial({
    color, dashSize: .105, gapSize: .069, transparent: true, opacity: .54,
  }));
  line.frustumCulled = false;
  root.add(line);
  return amount => {
    line.visible = amount > .16;
    if (!line.visible) return;
    const attrs = geom.attributes.position;
    const start = root.worldToLocal(a.getWorldPosition(new THREE.Vector3()));
    const end = root.worldToLocal(b.getWorldPosition(new THREE.Vector3()));
    attrs.setXYZ(0, start.x, start.y, start.z);
    attrs.setXYZ(1, end.x, end.y, end.z);
    attrs.needsUpdate = true;
    line.computeLineDistances();
    line.material.opacity = .58 * THREE.MathUtils.smoothstep(amount, .15, .57);
  };
}

export function createCameraProduct() {
  const root = new THREE.Group();
  const body = cameraCase(root);
  const shells = [];
  for (const container of [body.front, body.frame]) container.traverse(part => {
    if (!part.material) return;
    part.material = part.material.clone();
    part.material.transparent = true;
    part.material.depthWrite = false;
    part.material.opacity = .13;
    shells.push(part);
  });
  const gears = group(root);
  const cams = group(root);
  const linkage = group(root);
  const transport = group(root);
  const film = group(root);
  const print = filmCard(film);
  const filmStack = group(film, 0, 2.05, -.405);
  panel(filmStack, 2.45, 2.93, .22, .10, black, 0, 0, -.105);
  panel(filmStack, 2.17, 2.71, .078, .076, rubber, 0, -.04, .034);
  for (const x of [-1.10, 1.10]) {
    box(filmStack, x, -.02, .036, .065, 2.6, .09, bronze);
  }

  const barrel = groovedBarrel(cams);
  const gearX = 1.44;
  const mod = .052;
  const pitchCam = 20 * mod / 2;
  const pitchMotor = 14 * mod / 2;
  const motorY = camY + pitchCam + pitchMotor;
  const camGear = gear(gears, gearX, camY, camZ, 20, mod, gearBlue);
  const motor = gear(gears, gearX, motorY, camZ, 14, mod, gearLight);
  // The cutaway motor and shaft visibly feed both the cam and roller train.
  const motorShell = bronze.clone();
  motorShell.transparent = true; motorShell.opacity = .23; motorShell.depthWrite = false;
  cylinder(gears, 1.07, motorY, camZ, .32, .58, motorShell, 'x');
  cylinder(gears, .78, motorY, camZ, .295, .079, black, 'x');
  cylinder(gears, 1.20, motorY, camZ, .07, 1.06, nickel, 'x');
  const rotor = group(gears, 1.03, motorY, camZ);
  cylinder(rotor, 0, 0, 0, .16, .42, nickel, 'x');
  for (let i = 0; i < 3; i++) {
    const angle = i * TAU / 3;
    const coil = box(rotor, 0, .19 * Math.cos(angle), .19 * Math.sin(angle), .34, .10, .15, bronze);
    coil.rotation.x = angle;
  }
  for (const sign of [-1, 1]) box(gears, 1.02, motorY + sign * .29, camZ, .45, .07, .26, dark);

  const rollerY = 4.063;
  const rollerZ = -.10;
  const rearZ = -.508;
  const outputX = 1.72;
  const motorOutput = gear(gears, outputX, motorY, camZ, 20, mod, gearBlue);
  // Intersect the two pitch circles to place the idler: each tooth pair meets
  // at precisely the sum of its pitch radii, even with the offset roller axis.
  const radiusA = (20 + 18) * mod / 2;
  const radiusB = (18 + 8) * mod / 2;
  const dy = rollerY - motorY, dz = rollerZ - camZ;
  const span = Math.hypot(dy, dz);
  const along = (radiusA ** 2 - radiusB ** 2 + span ** 2) / (2 * span);
  const offset = Math.sqrt(radiusA ** 2 - along ** 2);
  const idlerY = motorY + along * dy / span - offset * dz / span;
  const idlerZ = camZ + along * dz / span + offset * dy / span;
  const rollerIdler = gear(gears, outputX, idlerY, idlerZ, 18, mod, gearLight);
  const rollerInput = gear(gears, outputX, rollerY, rollerZ, 8, mod, gearBlue);
  const topRoller = roller(transport, rollerY, rollerZ, true);
  const rearRoller = roller(transport, rollerY, rearZ, false);
  for (const rollerPart of [topRoller, rearRoller]) {
    cylinder(rollerPart, 1.70, 0, 0, .065, .73, nickel, 'x');
    // A broad blue end cap ties the rotating shaft visually to its blue gear.
    cylinder(rollerPart, 1.30, 0, 0, .187, .10, gearBlue, 'x');
  }
  // Equal gears force the opposed rollers to have equal surface speeds.
  const couplingX = 1.97;
  const couplingModule = (rollerZ - rearZ) / 12;
  const rollerCoupling = gear(gears, couplingX, rollerY, rollerZ, 12, couplingModule, gearBlue);
  const rearCoupling = gear(gears, couplingX, rollerY, rearZ, 12, couplingModule, gearLight);
  for (const x of [-1.41, 1.41]) {
    panel(transport, .16, .50, .77, .072, bronze, x, rollerY, -.307, .022);
    for (const z of [rollerZ, rearZ]) cylinder(transport, x, rollerY, z, .216, .16, dark, 'x');
  }
  camGear.name = 'camera-cam-gear';
  motor.name = 'camera-motor-pinion';
  motorOutput.name = 'camera-motor-output';
  rollerIdler.name = 'camera-roller-idler';
  rollerInput.name = 'camera-roller-input';
  topRoller.name = 'camera-front-roller';
  rearRoller.name = 'camera-rear-roller';
  print.name = 'camera-film';
  const nipGlow = box(transport, 0, rollerY, -.304, 2.31, .045, .025,
    new THREE.MeshBasicMaterial({ color: 0xffd36c, transparent: true, opacity: 0, depthWrite: false }));
  // Match tooth-to-gap phases as well as the tooth-count speed ratio.
  function drivenAngle(a, b, teethA, teethB, rotationA) {
    const y = b.position.y - a.position.y, z = b.position.z - a.position.z;
    const bearingA = Math.atan2(y, -z);
    const bearingB = Math.atan2(-y, z);
    return (teethA * bearingA + teethB * bearingB - teethA * rotationA - Math.PI) / teethB;
  }

  const pivot = group(linkage, -.16, 2.195, .47);
  const lower = .64;
  const reach = 1.08;
  bar(pivot, [0, -lower, 0], [0, 0, 0], .080, linkOrange);
  bar(pivot, [-reach, -.14, 0], [0, 0, 0], .075, linkOrange);
  cylinder(pivot, 0, 0, .02, .147, .15, linkOrange);
  screw(pivot, 0, 0, .118);
  cylinder(pivot, 0, -lower, -.117, .056, .27, nickel);
  const pick = group(linkage, -1.186, 0, .41);
  bar(pick, [0, .68, -.64], [0, .68, .0], .06, linkOrange);
  bar(pick, [0, .68, .0], [0, 1.95, .0], .062, linkOrange);
  bar(pick, [0, 1.95, .0], [.231, 1.95, .0], .066, linkOrange);
  panel(pick, .377, .13, .128, .051, linkOrange, .255, 1.95, 0);
  screw(pick, .11, 1.95, .08, .039);
  bar(linkage, [-1.27, .56, .34], [-1.27, 2.68, .34], .038, nickel);

  const labels = {
    gears: group(gears, gearX + .20, camY + .27, .3),
    linkage: group(pivot, -.89, -.09, .15),
    cam: group(cams, -.09, camY + .135, camZ + .37),
  };
  const guide = [
    guideLine(root, 0x3873e6, group(camGear, -.06), group(barrel, 1.38)),
    guideLine(root, 0x9c63e9, group(pivot, 0, -lower, -.155), group(cams, -.20, camY, .37)),
    guideLine(root, 0xef9a37, group(pick, 0, .68, -.61), group(film, -1.04, .75, -.22)),
    guideLine(root, 0x3873e6, group(rollerInput), group(topRoller, 1.72)),
    guideLine(root, 0x3873e6, group(rearCoupling), group(rearRoller, 1.97)),
  ];

  const mechanismGroups = { gears, linkage, cam: cams };
  for (const container of Object.values(mechanismGroups)) container.traverse(part => {
    if (!part.material) return;
    part.material = Array.isArray(part.material) ? part.material.map(m => m.clone()) : part.material.clone();
    for (const material of [part.material].flat()) {
      material.userData.baseOpacity = material.opacity;
      material.userData.baseTransparent = material.transparent;
      material.userData.baseDepthWrite = material.depthWrite;
    }
  });
  const initialCenterY = filmBottom + 1.39;
  const travelToNip = rollerY - (initialCenterY + 1.39);
  const rockMin = reach * (-.31 / lower) + .14 * (1 - Math.sqrt(1 - (.31 / lower) ** 2));
  const pickLift = slide => {
    const swing = Math.asin(THREE.MathUtils.clamp((slide + .16) / lower, -.95, .95));
    return -reach * Math.sin(swing) + .14 * (1 - Math.cos(swing)) - rockMin;
  };
  let low = .02, high = .42;
  for (let i = 0; i < 40; i++) {
    const mid = (low + high) / 2;
    if (pickLift(.15 - .62 * clawStroke(mid)) < travelToNip) low = mid;
    else high = mid;
  }
  const gripPhase = (low + high) / 2;
  const rollerRatio = 20 / 14 * 20 / 8;
  const filmTravelPerCycle = TAU * rollerRatio * .187;
  let lastFocus;
  const api = {
    root,
    camera: [6.9, 5.8, 11.2],
    target: [0, 3.8, -.05],
    explodedCamera: [4.8, 6.7, 15.0],
    explodedTarget: [.24, 3.8, 0],
    labels,
    update(turn, explode = 0, focus = null) {
      for (const shell of shells) shell.material.opacity = .13 + .74 * explode;
      if (lastFocus !== focus) {
        for (const [name, container] of Object.entries(mechanismGroups)) container.traverse(part => {
          if (!part.material) return;
          for (const material of [part.material].flat()) {
            const dim = focus && name !== focus;
            material.transparent = !!dim || material.userData.baseTransparent;
            material.opacity = material.userData.baseOpacity * (dim ? .2 : 1);
            material.depthWrite = !dim && material.userData.baseDepthWrite;
          }
        });
        lastFocus = focus;
      }
      const phase = ((turn % 1) + 1) % 1;
      const driveProgress = THREE.MathUtils.smoothstep(phase, .04, .94);
      const driveTurns = Math.floor(turn) + driveProgress;
      const angular = -Math.PI / 2 - driveTurns * TAU;
      barrel.rotation.x = angular;
      camGear.rotation.x = angular;
      motor.rotation.x = drivenAngle(camGear, motor, 20, 14, angular);
      rotor.rotation.x = motor.rotation.x;
      motorOutput.rotation.x = motor.rotation.x;
      rollerIdler.rotation.x = drivenAngle(motorOutput, rollerIdler, 20, 18, motorOutput.rotation.x);
      rollerInput.rotation.x = drivenAngle(rollerIdler, rollerInput, 18, 8, rollerIdler.rotation.x);
      rollerCoupling.rotation.x = rollerInput.rotation.x;
      rearCoupling.rotation.x = drivenAngle(rollerCoupling, rearCoupling, 12, 12, rollerCoupling.rotation.x);
      topRoller.rotation.x = rollerInput.rotation.x;
      rearRoller.rotation.x = rearCoupling.rotation.x;
      const slide = grooveCenter(Math.PI / 2 - angular);
      const swing = Math.asin(THREE.MathUtils.clamp((slide + .16) / lower, -.95, .95));
      pivot.rotation.z = swing;
      pick.position.y = pickLift(slide);
      // After the leading edge enters the nip, sheet motion is determined by
      // the roller surface speed, not by a separate animation timer.
      const caught = driveProgress >= gripPhase;
      const filmLift = caught ? travelToNip + (driveProgress - gripPhase) * filmTravelPerCycle : pick.position.y;
      print.position.set(0, initialCenterY + filmLift, -.304);
      const clear = driveProgress > gripPhase + 2.78 / filmTravelPerCycle;
      const dropped = THREE.MathUtils.smoothstep(driveProgress, gripPhase + 2.78 / filmTravelPerCycle + .015, 1);
      print.position.x -= .39 * dropped;
      print.position.y += .22 * dropped;
      print.position.z += .35 * dropped;
      print.rotation.z = -.13 * dropped;
      print.visible = phase < .97;
      nipGlow.material.opacity = caught && !clear ? .62 : 0;
      body.front.position.set(-2.07 * explode, .24 * explode, .79 * explode);
      body.back.position.set(1.25 * explode, -.07 * explode, -2.49 * explode);
      body.frame.position.set(-1.82 * explode, .07 * explode, -1.51 * explode);
      gears.position.set(2.22 * explode, .11 * explode, 1.0 * explode);
      gears.rotation.y = -.60 * explode;
      cams.position.set(.46 * explode, -.56 * explode, .87 * explode);
      linkage.position.set(.14 * explode, .23 * explode, 1.18 * explode);
      film.position.set(1.75 * explode, .1 * explode, -.41 * explode);
      transport.position.set(.74 * explode, .61 * explode, .33 * explode);
      root.updateMatrixWorld(true);
      for (const updateGuide of guide) updateGuide(explode);
    },
  };
  api.update(0);
  return api;
}
