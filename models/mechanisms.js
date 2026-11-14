import * as THREE from '../vendor/three.module.js';

const TAU = Math.PI * 2;
const metal = (color, metalness = .24, roughness = .39) => new THREE.MeshStandardMaterial({ color, metalness, roughness });
const palette = {
  frame: metal(0x344052),
  foot: metal(0x172333),
  steel: metal(0xbfcbd8, .47, .32),
  inner: metal(0x74869b, .43),
  white: metal(0xf1f6f5, .1),
  blue: metal(0x3873e6),
  sky: metal(0x67c5f2),
  navy: metal(0x20518d),
  gold: metal(0xef9a37),
  bronze: metal(0xc97a2d),
  cream: metal(0xfbd78b),
  violet: metal(0x9c63e9),
  lilac: metal(0xbcacf5),
  plum: metal(0x584481),
};

function mesh(group, geometry, material, x = 0, y = 0, z = 0) {
  const part = new THREE.Mesh(geometry, material);
  part.position.set(x, y, z);
  part.castShadow = true;
  part.receiveShadow = true;
  group.add(part);
  return part;
}

function groupAt(parent, x = 0, y = 0, z = 0) {
  const group = new THREE.Group();
  group.position.set(x, y, z);
  parent.add(group);
  return group;
}

function shapeFrom(points) {
  const shape = new THREE.Shape(points.map(([x, y]) => new THREE.Vector2(x, y)));
  shape.closePath();
  return shape;
}

function roundRect(width, height, radius) {
  const x = width / 2;
  const y = height / 2;
  const rect = new THREE.Shape();
  rect.moveTo(-x + radius, -y);
  rect.lineTo(x - radius, -y);
  rect.quadraticCurveTo(x, -y, x, -y + radius);
  rect.lineTo(x, y - radius);
  rect.quadraticCurveTo(x, y, x - radius, y);
  rect.lineTo(-x + radius, y);
  rect.quadraticCurveTo(-x, y, -x, y - radius);
  rect.lineTo(-x, -y + radius);
  rect.quadraticCurveTo(-x, -y, -x + radius, -y);
  return rect;
}

function extrude(group, shape, depth, material, x = 0, y = 0, z = 0, bevel = .025) {
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: depth - 2 * bevel, bevelEnabled: bevel > 0, bevelSize: bevel, bevelThickness: bevel,
    bevelSegments: 2, curveSegments: 22,
  });
  geometry.translate(0, 0, bevel - depth / 2);
  return mesh(group, geometry, material, x, y, z);
}

function bore(shape, x, y, radius) {
  const hole = new THREE.Path();
  hole.absarc(x, y, radius, 0, TAU, true);
  shape.holes.push(hole);
}

function disc(group, radius, depth, material, x = 0, y = 0, z = 0) {
  const part = mesh(group, new THREE.CylinderGeometry(radius, radius, depth, 48), material, x, y, z);
  part.rotation.x = Math.PI / 2;
  return part;
}

function ring(group, radius, tube, material, x = 0, y = 0, z = 0) {
  return mesh(group, new THREE.TorusGeometry(radius, tube, 10, 48), material, x, y, z);
}

function box(group, width, height, depth, material, x = 0, y = 0, z = 0) {
  return mesh(group, new THREE.BoxGeometry(width, height, depth), material, x, y, z);
}

function base(root, width, accent) {
  const foot = extrude(root, roundRect(width, 1.72, .19), .17, palette.foot, 0, .1, -.09);
  foot.rotation.x = -Math.PI / 2;
  const cap = extrude(root, roundRect(width - .08, 1.64, .17), .09, palette.frame, 0, .218, -.09);
  cap.rotation.x = -Math.PI / 2;
  box(root, width - .55, .025, .024, accent, 0, .165, .764);
  for (const x of [-width / 2 + .23, width / 2 - .23]) {
    for (const z of [-.71, .52]) {
      mesh(root, new THREE.CylinderGeometry(.049, .049, .022, 12), palette.inner, x, .273, z);
    }
  }
}

function pedestal(root, x, y, front) {
  const stand = shapeFrom([[-.46, .28], [.46, .28], [.34, y + .03], [.15, y + .19], [-.15, y + .19], [-.34, y + .03]]);
  extrude(root, stand, .39, palette.frame, x, 0, -.39, .043);
  extrude(root, roundRect(.22, y - .51, .08), .03, palette.inner, x, (y + .16) / 2, -.174, .009);
  disc(root, .32, .19, palette.foot, x, y, -.15);
  disc(root, .156, front + .25, palette.steel, x, y, front / 2 - .035);
}

function arcArrow(root, x, y, z, radius, start, end, material, width = .022) {
  const steps = 28;
  const path = new THREE.CatmullRomCurve3(Array.from({ length: steps + 1 }, (_, i) => {
    const angle = THREE.MathUtils.lerp(start, end, i / steps);
    return new THREE.Vector3(x + radius * Math.cos(angle), y + radius * Math.sin(angle), z);
  }));
  const tube = mesh(root, new THREE.TubeGeometry(path, steps, width, 6), material);
  tube.castShadow = false;
  const direction = Math.sign(end - start);
  const point = path.getPointAt(1);
  const arrow = mesh(root, new THREE.ConeGeometry(width * 3.45, width * 7.7, 12), material);
  arrow.position.copy(point);
  arrow.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(-Math.sin(end) * direction, Math.cos(end) * direction, 0));
  arrow.castShadow = false;
}

function spurShape(teeth, pitchModule, windows) {
  const pitch = teeth * pitchModule / 2;
  const baseRadius = pitch * Math.cos(Math.PI / 9);
  const tip = pitch + pitchModule;
  const root = pitch - 1.25 * pitchModule;
  const flankRadius = Math.max(root, baseRadius);
  const halfTooth = Math.PI / (2 * teeth) * .966;
  const involute = radius => {
    const angle = Math.acos(baseRadius / radius);
    return Math.tan(angle) - angle;
  };
  const halfAt = radius => halfTooth + involute(pitch) - involute(radius);
  const profile = [];
  const polar = (radius, angle) => profile.push([radius * Math.cos(angle), radius * Math.sin(angle)]);
  const pitchAngle = TAU / teeth;
  for (let i = 0; i < teeth; i++) {
    const center = i * pitchAngle;
    polar(root, center - pitchAngle / 2);
    polar(root, center - halfAt(flankRadius));
    for (let step = 0; step <= 5; step++) {
      const r = THREE.MathUtils.lerp(flankRadius, tip, step / 5);
      polar(r, center - halfAt(r));
    }
    polar(tip, center);
    for (let step = 5; step >= 0; step--) {
      const r = THREE.MathUtils.lerp(flankRadius, tip, step / 5);
      polar(r, center + halfAt(r));
    }
    polar(root, center + halfAt(flankRadius));
  }
  const shape = shapeFrom(profile);
  for (let i = 0; i < windows; i++) {
    const angle = i * TAU / windows;
    bore(shape, pitch * .56 * Math.cos(angle), pitch * .56 * Math.sin(angle), pitch * .19);
  }
  return shape;
}

function spur(root, x, y, teeth, pitchModule, material, windows) {
  const gear = groupAt(root, x, y, .25);
  const pitch = teeth * pitchModule / 2;
  extrude(gear, spurShape(teeth, pitchModule, windows), .33, material, 0, 0, 0, .013);
  disc(gear, pitch * .25, .09, palette.navy, 0, 0, .19);
  ring(gear, pitch * .244, .016, palette.steel, 0, 0, .237);
  disc(gear, pitch * .12, .12, palette.steel, 0, 0, .21);
  disc(gear, .047, .02, palette.foot, 0, 0, .277);
  disc(gear, .075, .026, palette.white, .82 * pitch, 0, .178);
  return gear;
}

function gears() {
  const root = new THREE.Group();
  const teethA = 20;
  const teethB = 30;
  const pitchModule = .106;
  const radiusA = teethA * pitchModule / 2;
  const radiusB = teethB * pitchModule / 2;
  const y = 1.99;
  base(root, 5.58, palette.sky);
  pedestal(root, -radiusB, y, .27);
  pedestal(root, radiusA, y, .27);
  const driver = spur(root, -radiusB, y, teethA, pitchModule, palette.sky, 4);
  const driven = spur(root, radiusA, y, teethB, pitchModule, palette.blue, 5);
  const arrows = new THREE.MeshBasicMaterial({ color: 0xecf8fc });
  arcArrow(root, -radiusB, y, .445, radiusA * .91, 1.95, 3.19, arrows);
  arcArrow(root, radiusA, y, .445, radiusB * .91, .07, -1.11, arrows);
  return {
    root, camera: [1.74, 3.7, 9.8], target: [0, 1.81, 0], drivePoint: [-radiusB, y, .45],
    update(turn) {
      driver.rotation.z = turn * TAU;
      driven.rotation.z = Math.PI / teethB - driver.rotation.z * teethA / teethB;
    },
  };
}

function strap(root, length, width, depth, material) {
  const round = roundRect(length + width, width, width * .48);
  bore(round, -length / 2, 0, width * .225);
  bore(round, length / 2, 0, width * .225);
  const part = extrude(root, round, depth, material);
  return part;
}

function positionStrap(strapPart, a, b, z) {
  strapPart.position.set((a.x + b.x) / 2, (a.y + b.y) / 2, z);
  strapPart.rotation.z = Math.atan2(b.y - a.y, b.x - a.x);
}

function linkage() {
  const root = new THREE.Group();
  const drive = new THREE.Vector2(-1.66, 1.09);
  const pivot = new THREE.Vector2(1.55, .91);
  const crankRadius = .56;
  const couplerLength = 2.9;
  const rockerLength = 1.52;
  base(root, 4.84, palette.gold);
  pedestal(root, drive.x, drive.y, .36);
  pedestal(root, pivot.x, pivot.y, .36);
  disc(root, .41, .13, palette.bronze, drive.x, drive.y, .14);
  ring(root, .31, .018, palette.cream, drive.x, drive.y, .216);
  disc(root, .23, .15, palette.inner, pivot.x, pivot.y, .14);
  const crank = strap(root, crankRadius, .38, .22, palette.gold);
  const rocker = strap(root, rockerLength, .38, .22, palette.gold);
  const coupler = strap(root, couplerLength, .30, .19, palette.cream);
  for (const point of [drive, pivot]) {
    disc(root, .139, .116, palette.steel, point.x, point.y, .44);
    disc(root, .057, .026, palette.foot, point.x, point.y, .507);
  }
  const crankPin = groupAt(root, 0, 0, .43);
  const rockerPin = groupAt(root, 0, 0, .43);
  for (const pin of [crankPin, rockerPin]) {
    disc(pin, .081, .45, palette.inner);
    disc(pin, .146, .075, palette.bronze, 0, 0, .206);
    disc(pin, .102, .08, palette.steel, 0, 0, .223);
    disc(pin, .044, .015, palette.foot, 0, 0, .269);
  }
  const path = new THREE.MeshBasicMaterial({ color: 0xce8a34 });
  arcArrow(root, drive.x, drive.y, .02, .82, 2.45, 3.93, path, .023);
  const fixedEnd = new THREE.Vector2();
  const movingEnd = new THREE.Vector2();
  return {
    root, camera: [1.55, 3.06, 8.9], target: [0, 1.39, 0], drivePoint: [drive.x, drive.y, .55],
    update(turn) {
      const angle = turn * TAU + Math.PI / 2;
      fixedEnd.set(drive.x + crankRadius * Math.cos(angle), drive.y + crankRadius * Math.sin(angle));
      // Upper circle intersection keeps the coupler and output rocker rigid.
      const x = pivot.x - fixedEnd.x;
      const y = pivot.y - fixedEnd.y;
      const span = Math.hypot(x, y);
      const along = (couplerLength ** 2 - rockerLength ** 2 + span ** 2) / (2 * span);
      const rise = Math.sqrt(Math.max(0, couplerLength ** 2 - along ** 2));
      movingEnd.set(fixedEnd.x + (along * x - rise * y) / span, fixedEnd.y + (along * y + rise * x) / span);
      positionStrap(crank, drive, fixedEnd, .33);
      positionStrap(rocker, pivot, movingEnd, .33);
      positionStrap(coupler, fixedEnd, movingEnd, .55);
      crankPin.position.set(fixedEnd.x, fixedEnd.y, .43);
      rockerPin.position.set(movingEnd.x, movingEnd.y, .43);
    },
  };
}

const rollerRadius = .27;
const camBase = .9;
const camStroke = .87;

function followerLift(phi) {
  return camStroke * (.5 + .5 * Math.cos(phi)) ** 2;
}

function camOutline() {
  // The profile is the inward envelope of a roller on the pitch curve.
  return Array.from({ length: 120 }, (_, i) => {
    const phi = i * TAU / 120;
    const c = Math.cos(phi);
    const s = Math.sin(phi);
    const radius = camBase + rollerRadius + followerLift(phi);
    const slope = -camStroke * (.5 + .5 * c) * s;
    const normal = Math.hypot(radius, slope);
    return [radius * c - rollerRadius * (radius * c + slope * s) / normal,
      radius * s - rollerRadius * (radius * s - slope * c) / normal];
  });
}

function verticalBar(root, radius, height, material, x = 0, y = 0, z = 0) {
  return mesh(root, new THREE.CylinderGeometry(radius, radius, height, 32), material, x, y, z);
}

function cam() {
  const root = new THREE.Group();
  const x = -.54;
  const y = 2.15;
  const z = .35;
  const guideY = 5.05;
  base(root, 4.33, palette.lilac);
  pedestal(root, x, y, z + .23);
  const tower = extrude(root, roundRect(.64, 4.72, .17), .54, palette.frame, x + .8, 2.615, -.46, .045);
  tower.castShadow = false;
  box(root, .17, 3.91, .026, palette.inner, x + .8, 2.505, -.17);
  extrude(root, roundRect(1.44, .38, .13), .53, palette.frame, x + .43, guideY, -.37, .027);
  box(root, .38, .31, .75, palette.frame, x, guideY, .082);
  verticalBar(root, .242, .23, palette.plum, x, guideY, z);
  verticalBar(root, .286, .065, palette.steel, x, guideY + .125, z);
  verticalBar(root, .281, .065, palette.steel, x, guideY - .125, z);

  const drive = groupAt(root, x, y, z);
  const outline = camOutline();
  extrude(drive, shapeFrom(outline), .36, palette.violet, 0, 0, 0, .016);
  const inset = outline.map(([px, py]) => [px * .80, py * .80]);
  extrude(drive, shapeFrom(inset), .035, palette.plum, 0, 0, .185, .008);
  disc(drive, .30, .10, palette.lilac, 0, 0, .22);
  ring(drive, .227, .022, palette.plum, 0, 0, .275);
  disc(drive, .119, .14, palette.steel, 0, 0, .25);
  disc(drive, .086, .03, palette.white, 1.23, 0, .21);

  const follower = groupAt(root, x, 0, z);
  verticalBar(follower, .081, 1.54, palette.steel, 0, .85);
  verticalBar(follower, .225, .081, palette.lilac, 0, .38);
  verticalBar(follower, .144, .077, palette.lilac, 0, 1.604);
  for (const side of [-1, 1]) {
    extrude(follower, roundRect(.265, .44, .095), .055, palette.plum, 0, .16, side * .227, .013);
  }
  const roller = groupAt(follower);
  disc(roller, rollerRadius, .344, palette.lilac);
  ring(roller, .172, .025, palette.plum, 0, 0, .173);
  disc(follower, .094, .54, palette.steel);
  disc(follower, .044, .02, palette.foot, 0, 0, .28);
  disc(roller, .028, .02, palette.white, .211, 0, .175);
  const helix = new THREE.CatmullRomCurve3(Array.from({ length: 156 }, (_, i) => {
    const t = i / 155;
    return new THREE.Vector3(.155 * Math.cos(6 * TAU * t), t, .155 * Math.sin(6 * TAU * t));
  }));
  const spring = mesh(root, new THREE.TubeGeometry(helix, 144, .022, 6), palette.steel, x, 0, z);
  const cue = new THREE.MeshBasicMaterial({ color: 0x936cd4 });
  const upperY = y + camBase + rollerRadius + camStroke;
  const lowerY = upperY - camStroke;
  verticalBar(root, .018, camStroke, cue, x + 1.39, (lowerY + upperY) / 2, .43).castShadow = false;
  for (const sign of [-1, 1]) {
    const tip = mesh(root, new THREE.ConeGeometry(.072, .145, 12), cue, x + 1.39, sign > 0 ? upperY : lowerY, .43);
    tip.rotation.z = sign > 0 ? 0 : Math.PI;
    tip.castShadow = false;
  }
  return {
    root, camera: [2.1, 4.95, 12.1], target: [-.12, 2.8, 0], drivePoint: [x, y, .6],
    update(turn) {
      const angle = turn * TAU;
      drive.rotation.z = angle;
      const height = y + camBase + rollerRadius + followerLift(Math.PI / 2 - angle);
      follower.position.y = height;
      roller.rotation.z = angle * camBase / rollerRadius;
      spring.position.y = height + .435;
      spring.scale.y = guideY - .162 - spring.position.y;
    },
  };
}

export function createMechanism(id) {
  const build = { gears, linkage, cam }[id];
  if (!build) throw new RangeError(`Unknown mechanism: ${id}`);
  const mechanism = build();
  mechanism.update(0);
  return mechanism;
}
