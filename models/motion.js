import * as THREE from '../vendor/three.module.js';
import { createMechanism } from './mechanisms.js?v=20261116-2';
import { createCarBody } from './car-body.js?v=20261116-2';

const tau = 2 * Math.PI;
const vector = coordinates => new THREE.Vector3(...coordinates);
const material = (color, roughness = 0.45, metalness = 0.08) =>
  new THREE.MeshStandardMaterial({ color, roughness, metalness });
const guide = color => new THREE.MeshBasicMaterial({ color });
const ivory = material(0xf3ede0);
const steel = material(0xb5c3c4, 0.28, 0.55);
const dark = material(0x223340, 0.5);

function mount(parent, geometry, surface, position = [0, 0, 0]) {
  const object = new THREE.Mesh(geometry, surface);
  object.position.set(...position);
  object.castShadow = !surface.isMeshBasicMaterial;
  object.receiveShadow = !surface.isMeshBasicMaterial;
  parent.add(object);
  return object;
}

function group(parent, position = [0, 0, 0]) {
  const object = new THREE.Group();
  object.position.set(...position);
  parent.add(object);
  return object;
}

function cylinder(parent, top, bottom, height, surface, at, sides = 48) {
  return mount(parent, new THREE.CylinderGeometry(top, bottom, height, sides), surface, at);
}

function box(parent, size, surface, at) {
  return mount(parent, new THREE.BoxGeometry(...size), surface, at);
}

function ellipsoid(parent, size, surface, at) {
  const object = mount(parent, new THREE.SphereGeometry(1, 24, 12), surface, at);
  object.scale.set(...size);
  return object;
}

function lathe(parent, profile, surface, at) {
  const points = profile.map(point => new THREE.Vector2(...point));
  return mount(parent, new THREE.LatheGeometry(points, 64), surface, at);
}

function hoop(parent, radius, thickness, surface, at) {
  const ring = mount(parent, new THREE.TorusGeometry(radius, thickness, 8, 64), surface, at);
  ring.rotation.x = -Math.PI / 2;
  return ring;
}

function strut(parent, from, to, radius, surface) {
  const start = vector(from);
  const finish = vector(to);
  const delta = finish.clone().sub(start);
  const piece = cylinder(parent, radius, radius, delta.length(), surface, start.lerp(finish, 0.5).toArray(), 12);
  piece.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize());
  return piece;
}

function conduit(parent, points, radius, surface, segments = 30) {
  const track = new THREE.CatmullRomCurve3(points.map(vector));
  return mount(parent, new THREE.TubeGeometry(track, segments, radius, 8), surface);
}

function tip(parent, end, direction, radius, depth, surface) {
  const axis = vector(direction).normalize();
  const cone = mount(parent, new THREE.ConeGeometry(radius, depth, 16), surface, vector(end).addScaledVector(axis, -depth / 2).toArray());
  cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), axis);
}

function angularArrow(parent, start, end, pointAt, surface, radius) {
  const points = Array.from({ length: 25 }, (_, index) => pointAt(start + (end - start) * index / 24));
  conduit(parent, points, radius * 0.36, surface, 24);
  const previous = vector(points.at(-2));
  const endPoint = vector(points.at(-1));
  const direction = endPoint.clone().sub(previous).normalize();
  tip(parent, endPoint.addScaledVector(direction, radius).toArray(), direction.toArray(), radius, radius * 2.4, surface);
}

function horse(parent, coat, mane, saddle) {
  ellipsoid(parent, [0.37, 0.16, 0.145], coat, [-0.06, 0.07, 0]);
  const neck = ellipsoid(parent, [0.13, 0.25, 0.107], coat, [0.235, 0.20, 0]);
  neck.rotation.z = -0.37;
  const head = ellipsoid(parent, [0.21, 0.109, 0.092], coat, [0.38, 0.38, 0]);
  head.rotation.z = -0.24;
  ellipsoid(parent, [0.086, 0.071, 0.085], mane, [0.53, 0.332, 0]);
  ellipsoid(parent, [0.077, 0.18, 0.099], mane, [0.17, 0.264, 0]);
  for (const side of [-1, 1]) {
    const ear = ellipsoid(parent, [0.039, 0.084, 0.028], coat, [0.295, 0.477, side * 0.055]);
    ear.rotation.z = -0.17;
    ellipsoid(parent, [0.023, 0.023, 0.012], dark, [0.387, 0.409, side * 0.085]);
    ellipsoid(parent, [0.152, 0.088, 0.028], saddle, [-0.058, 0.093, side * 0.136]);
    const front = [[0.19, 0.07, side * 0.085], [0.24, -0.11, side * 0.105], [0.41, -0.106 - side * 0.065, side * 0.13]];
    const rear = [[-0.32, 0.079, side * 0.087], [-0.35, -0.092, side * 0.108], [-0.49, -0.23 + side * 0.067, side * 0.12]];
    for (const leg of [front, rear]) {
      strut(parent, leg[0], leg[1], 0.059, coat);
      strut(parent, leg[1], leg[2], 0.045, coat);
      cylinder(parent, 0.053, 0.058, 0.073, mane, leg[2], 18);
    }
  }
  conduit(parent, [[-0.34, 0.14, 0], [-0.46, 0.18, 0], [-0.53, 0.10, 0], [-0.61, 0.007, 0]], 0.045, mane, 14);
  ellipsoid(parent, [0.175, 0.063, 0.152], saddle, [-0.075, 0.218, 0]);
  cylinder(parent, 0.072, 0.072, 0.26, saddle, [-0.035, 0.095, 0], 24);
}

function carousel() {
  const root = new THREE.Group();
  const green = material(0x22936b);
  const deepGreen = material(0x205b4a);
  const brass = material(0xa88950, 0.35, 0.38);
  const paleGreen = material(0xc3ddce);
  const movement = guide(0x008a55);
  const ride = group(root);
  const deck = 0.26;

  cylinder(root, 1.76, 1.82, 0.13, deepGreen, [0, 0.065, 0]);
  cylinder(ride, 1.83, 1.83, 0.13, green, [0, 0.154, 0]);
  cylinder(ride, 1.76, 1.82, 0.058, ivory, [0, 0.233, 0]);
  hoop(ride, 1.71, 0.022, brass, [0, deck, 0]);
  cylinder(ride, 0.37, 0.43, 0.15, deepGreen, [0, 0.333, 0]);
  cylinder(ride, 0.24, 0.31, 1.80, paleGreen, [0, 1.27, 0]);
  for (const height of [0.41, 0.55, 1.85, 1.94]) {
    cylinder(ride, 0.30, 0.30, 0.045, brass, [0, height, 0]);
  }
  cylinder(ride, 1.65, 1.65, 0.11, deepGreen, [0, 2.16, 0], 64);
  hoop(ride, 1.65, 0.04, brass, [0, 2.215, 0]);
  const panelCount = 12;
  const panelSpan = tau / panelCount;
  for (let index = 0; index < panelCount; index++) {
    const panel = new THREE.CylinderGeometry(0.116, 1.65, 0.56, 8, 1, false, index * panelSpan, panelSpan);
    mount(ride, panel, index % 2 ? ivory : green, [0, 2.50, 0]);
    const center = (index + 0.5) * panelSpan;
    ellipsoid(ride, [0.048, 0.044, 0.047], ivory, [Math.sin(center) * 1.66, 2.157, Math.cos(center) * 1.66]);
    const crease = [0.14, 1.66].map((radius, endpoint) => [Math.sin(index * panelSpan) * radius, endpoint ? 2.23 : 2.79, Math.cos(index * panelSpan) * radius]);
    strut(ride, ...crease, 0.014, paleGreen);
  }
  ellipsoid(ride, [0.13, 0.117, 0.13], brass, [0, 2.822, 0]);

  const riders = [];
  const coats = [ivory, paleGreen, material(0xd5b699)];
  const manes = [material(0xaa7855), deepGreen, material(0x755847)];
  const seats = [green, material(0x5c8b96), material(0xb77961)];
  for (let index = 0; index < coats.length; index++) {
    const angle = index / coats.length * tau + 0.09;
    const station = group(ride, [Math.sin(angle) * 1.20, 0, Math.cos(angle) * 1.20]);
    station.rotation.y = angle;
    cylinder(station, 0.029, 0.029, 1.91, brass, [-0.035, 1.21, 0], 20);
    cylinder(station, 0.065, 0.083, 0.12, deepGreen, [-0.035, 0.316, 0], 20);
    cylinder(station, 0.065, 0.065, 0.10, brass, [-0.035, 2.065, 0], 20);
    const rider = group(station);
    horse(rider, coats[index], manes[index], seats[index]);
    riders.push(rider);

    const arrowX = 0.69;
    const arrowZ = 0.23;
    // The deck stays fixed so each horse follows a straight vertical path.
    strut(station, [arrowX, 0.87, arrowZ], [arrowX, 1.49, arrowZ], 0.019, movement);
    tip(station, [arrowX, 1.59, arrowZ], [0, 1, 0], 0.064, 0.16, movement);
    tip(station, [arrowX, 0.77, arrowZ], [0, -1, 0], 0.064, 0.16, movement);
  }
  function update(turn) {
    ride.rotation.y = 0;
    riders.forEach((rider, index) => {
      rider.position.y = 1.04 + 0.26 * Math.sin(tau * turn - index * tau / riders.length);
    });
  }

  update(0);
  return { root, update, camera: [4.2, 4.4, 6.85], target: [0, 1.34, 0] };
}

function teacupRide() {
  const root = new THREE.Group();
  const navy = material(0x234963);
  const blue = material(0x438bbb);
  const porcelain = material(0xe6eef2, 0.22);
  const porcelainShade = material(0xadc5d4, 0.28);
  const movement = guide(0x166da6);
  const lathePot = [[0.08, 0], [0.31, 0], [0.37, 0.065], [0.47, 0.17], [0.50, 0.31], [0.48, 0.43], [0.40, 0.53], [0.31, 0.55]];
  const cupWall = [[0, 0], [0.24, 0], [0.33, 0.045], [0.40, 0.15], [0.465, 0.38], [0.47, 0.49], [0.452, 0.516], [0.419, 0.50], [0.40, 0.37], [0.345, 0.18], [0.265, 0.098], [0, 0.098]];
  cylinder(root, 1.87, 1.92, 0.14, navy, [0, 0.07, 0]);
  const platform = group(root);
  cylinder(platform, 1.89, 1.89, 0.095, blue, [0, 0.145, 0]);
  cylinder(platform, 1.85, 1.88, 0.085, porcelainShade, [0, 0.227, 0]);
  hoop(platform, 1.78, 0.017, ivory, [0, 0.274, 0]);

  const pot = group(platform, [0, 0.27, 0]);
  cylinder(pot, 0.50, 0.55, 0.12, navy, [0, 0.06, 0]);
  lathe(pot, lathePot, porcelain, [0, 0.105, 0]);
  hoop(pot, 0.481, 0.019, blue, [0, 0.492, 0]);
  lathe(pot, [[0, 0], [0.33, 0], [0.345, 0.028], [0.27, 0.063], [0.16, 0.09], [0, 0.11]], blue, [0, 0.65, 0]);
  ellipsoid(pot, [0.087, 0.052, 0.087], porcelain, [0, 0.791, 0]);
  conduit(pot, [[0.41, 0.54, 0], [0.67, 0.53, 0], [0.71, 0.31, 0], [0.43, 0.23, 0]], 0.047, porcelain, 20);
  conduit(pot, [[-0.37, 0.32, 0], [-0.55, 0.40, 0], [-0.66, 0.51, 0], [-0.79, 0.64, 0]], 0.074, porcelain, 18);
  const spoutEnd = cylinder(pot, 0.085, 0.07, 0.042, blue, [-0.791, 0.646, 0], 28);
  spoutEnd.rotation.z = Math.PI / 3.7;

  const cups = [];
  const cupColors = [material(0x4c9ccb, 0.27), material(0x769db6, 0.27), porcelain];
  for (let index = 0; index < cupColors.length; index++) {
    const angle = index * tau / cupColors.length + 0.15;
    const station = group(platform, [Math.sin(angle) * 1.20, 0.284, Math.cos(angle) * 1.20]);
    cylinder(station, 0.593, 0.625, 0.092, navy, [0, 0.044, 0]);
    hoop(station, 0.57, 0.013, porcelain, [0, 0.099, 0]);
    const cup = group(station, [0, 0.086, 0]);
    lathe(cup, [[0, 0], [0.39, 0], [0.485, 0.046], [0.508, 0.09], [0.489, 0.113], [0.387, 0.068], [0, 0.066]], porcelain, [0, 0, 0]);
    lathe(cup, cupWall, cupColors[index], [0, 0.07, 0]);
    hoop(cup, 0.459, 0.016, ivory, [0, 0.58, 0]);
    hoop(cup, 0.436, 0.016, blue, [0, 0.422, 0]);
    conduit(cup, [[0.385, 0.48, 0], [0.60, 0.49, 0], [0.68, 0.35, 0], [0.53, 0.24, 0], [0.39, 0.26, 0]], 0.033, cupColors[index], 22);
    const benchPoints = Array.from({ length: 18 }, (_, step) => {
      const a = Math.PI * (0.42 + step / 17 * 1.16);
      return [Math.cos(a) * 0.31, 0.302, Math.sin(a) * 0.31];
    });
    conduit(cup, benchPoints, 0.057, porcelainShade, 24);
    cylinder(cup, 0.028, 0.051, 0.255, steel, [0, 0.23, 0], 20);
    hoop(cup, 0.15, 0.019, navy, [0, 0.355, 0]);
    box(cup, [0.29, 0.024, 0.033], steel, [0, 0.355, 0]);
    cups.push(cup);

    if (index === 0) {
      angularArrow(station, -1.07, 1.65, a => [Math.sin(a) * 0.71, 0.19, Math.cos(a) * 0.71], movement, 0.054);
    }
  }

  function update(turn) {
    platform.rotation.y = -turn * tau * .28;
    cups.forEach((cup, index) => {
      cup.rotation.y = (turn * 0.78 + index * 0.33) * tau;
    });
  }

  update(0);
  return { root, update, camera: [3.35, 4.5, 5.9], target: [0, 0.31, 0.13] };
}

function beveledPanel(parent, contour, depth, bevel, surface, at) {
  const shape = new THREE.Shape(contour.map(point => new THREE.Vector2(...point)));
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: bevel > 0,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 3,
    steps: 1,
  });
  return mount(parent, geometry, surface, at);
}

function carWiper() {
  const { root, windscreen } = createCarBody();
  const rubber = material(0x1e2930, 0.68);
  const orange = material(0xf0aa58, 0.36, 0.16);
  const movement = guide(0xfcc47d);
  const pivots = [-0.22, 0.82];
  // A continuously turning crank drives an oscillating rocker. Both wipers
  // turn about fixed pivots in the plane of the windscreen.
  const angleAt = turn => {
    const theta = turn * tau;
    const ax = .60 * Math.cos(theta);
    const ay = .60 * Math.sin(theta);
    const dx = 2 - ax;
    const dy = -ay;
    const distance = Math.hypot(dx, dy);
    const along = (1.80 ** 2 - 1 + distance ** 2) / (2 * distance);
    const height = Math.sqrt(1.80 ** 2 - along ** 2);
    const bx = ax + (along * dx - height * dy) / distance;
    const by = ay + (along * dy + height * dx) / distance;
    return Math.atan2(by, bx - 2) + .12;
  };
  const low = 1.60;
  const high = 3.01;
  const wipers = pivots.map(x => {
    const mountAt = [x, 0.083, 0.083];
    const hinge = mount(windscreen, new THREE.CylinderGeometry(0.065, 0.075, 0.039, 25), dark, mountAt);
    hinge.rotation.x = Math.PI / 2;
    const arm = group(windscreen, [x, 0.083, 0.11]);
    arm.scale.setScalar(.91);
    beveledPanel(arm, [[0.025, -0.025], [0.48, -0.027], [0.62, -0.01], [0.62, 0.025], [0.025, 0.025]], 0.026, 0.01, orange, [0, 0, 0]);
    const blade = group(arm, [0.686, 0.033, -0.012]);
    blade.rotation.z = -.035;
    beveledPanel(blade, [[-0.24, -0.038], [0.31, -0.027], [0.326, 0.008], [0.24, 0.024], [-0.16, 0.038], [-0.24, 0.009]], 0.023, 0.008, rubber, [0, 0, 0.015]);
    box(blade, [0.14, 0.052, 0.035], orange, [-0.036, 0, 0.044]);

    angularArrow(windscreen, low + 0.05, high - 0.06,
      angle => [x + .84 * Math.cos(angle), 0.082 + .84 * Math.sin(angle), 0.080],
      movement, 0.038);
    return arm;
  });

  function update(turn) {
    const angle = angleAt(turn);
    wipers.forEach(arm => { arm.rotation.z = angle; });
  }

  update(0);
  return { root, update, camera: [4.3, 3.6, 7.8], target: [0, 0.96, 0.22] };
}

const models = { carousel, teacup: teacupRide, wiper: carWiper, 'crank-rocker': () => createMechanism('crank-rocker') };

export function createMotion(id) {
  return models[id]();
}
