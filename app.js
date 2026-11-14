import * as THREE from 'three';
import { OrbitControls } from './vendor/OrbitControls.js';
import { createMotion } from './models/motion.js';
import { createMechanism } from './models/mechanisms.js';

const pages = [
  { id: 'motion', title: '運動の種類' },
  { id: 'mechanisms', title: '機構の動き' },
  { id: 'products', title: '製品のしくみ' },
];
const motionCards = [
  { id: 'carousel', title: '直線運動', subtitle: 'メリーゴーランドの馬の上下運動', icon: 'straight', accent: '#22795e', chip: '#e0f5ed', tint: '#e6f1ec' },
  { id: 'teacup', title: '回転運動', subtitle: 'ティーカップ', icon: 'rotate', accent: '#245fc6', chip: '#e6efff', tint: '#e8effa' },
  { id: 'wiper', title: '揺動運動', subtitle: '車のワイパー', icon: 'sway', accent: '#a54d21', chip: '#fcece2', tint: '#f4ede7' },
];
const mechanismCards = [
  { id: 'gears', title: '歯車', icon: 'gears', accent: '#3873e6', chip: '#e6efff', tint: '#e8effa' },
  { id: 'linkage', title: 'リンク機構', icon: 'logo', accent: '#ef9a37', chip: '#fff0dd', tint: '#f5efe7' },
  { id: 'cam', title: 'カム機構', icon: 'cam', accent: '#9c63e9', chip: '#f0e8ff', tint: '#eeeafa' },
];
const products = [
  { id: 'car', title: '車のワイパー', button: '車', icon: 'car', rate: .24, load: () => import('./models/car.js').then(module => module.createCar()) },
  { id: 'camera', title: 'チェキのフィルム送り', button: 'チェキ', icon: 'camera', rate: .16, load: () => import('./models/camera.js').then(module => module.createCameraProduct()) },
];

const workspace = document.querySelector('#workspace');
const heading = document.querySelector('#heading');
const playback = document.querySelector('#playback');
const speed = document.querySelector('#speed');
const previous = document.querySelector('#previous');
const next = document.querySelector('#next');
const pageCount = document.querySelector('#page-count');
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
const icon = name => `<svg aria-hidden="true"><use href="#i-${name}"/></svg>`;
const playhead = { motion: 0, mechanisms: 0, products: 0 };
let page = '';
let product = products[0];
let running = !reduceMotion.matches;
let exploded = false;
let focusPart = null;
let views = [];
let selectionVersion = 0;

function playbackLabel() {
  playback.innerHTML = running ? `${icon('pause')}一時停止` : `${icon('play')}再生`;
}

function viewResetButton() {
  return `<button type="button" class="button compact view-reset" aria-label="視点を戻す" title="視点を戻す">${icon('crosshair')}</button>`;
}

function disposeModel(root) {
  const resources = new Set();
  root.traverse(object => {
    if (object.geometry) resources.add(object.geometry);
    const materials = object.material ? [object.material].flat() : [];
    for (const material of materials) {
      for (const value of Object.values(material)) if (value?.isTexture) resources.add(value);
      resources.add(material);
    }
  });
  for (const resource of resources) resource.dispose();
}

function showViewError(element, message) {
  const notice = document.createElement('div');
  notice.className = 'view-error';
  notice.textContent = message;
  element.append(notice);
}

function createView(element, model, title, rate, isProduct = false) {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  } catch {
    showViewError(element, 'このブラウザーでは3Dモデルを表示できません。');
    disposeModel(model.root);
    return;
  }
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.6));
  renderer.setClearColor(0xffffff, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.36;
  const canvas = renderer.domElement;
  canvas.setAttribute('aria-label', `${title}の3Dモデル`);
  canvas.tabIndex = 0;
  element.prepend(canvas);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(37, 1, .05, 150);
  const controls = new OrbitControls(camera, canvas);
  canvas.style.touchAction = 'pan-y';
  controls.enableDamping = true;
  controls.dampingFactor = .12;
  controls.enablePan = false;
  controls.maxPolarAngle = Math.PI * .53;
  controls.minPolarAngle = .12;
  controls.rotateSpeed = .75;

  const hemi = new THREE.HemisphereLight(0xf7fbff, 0x798ab1, 2.3);
  const key = new THREE.DirectionalLight(0xfff4e5, 2.6);
  const fill = new THREE.DirectionalLight(0xc9e3ff, 1.15);
  key.position.set(-5, 9, 6);
  fill.position.set(5, 6, -6);
  const grid = new THREE.GridHelper(isProduct ? 26 : 16, isProduct ? 52 : 32, 0x8fa8c5, 0x9cb0c6);
  grid.position.y = -.035;
  grid.material.transparent = true;
  grid.material.opacity = .23;
  scene.add(hemi, key, fill, grid, model.root);

  let width = 1;
  let height = 1;
  let spread = 0;
  let cameraGoal = null;
  const annotations = isProduct ? createAnnotations(element) : null;
  function viewPose() {
    const open = isProduct && exploded;
    const target = new THREE.Vector3(...(open && model.explodedTarget || model.target));
    const position = new THREE.Vector3(...(open && model.explodedCamera || model.camera));
    const fit = isProduct ? Math.max(1, 1.48 / camera.aspect) : Math.max(1, .94 / camera.aspect);
    position.sub(target).multiplyScalar(fit).add(target);
    const distance = position.distanceTo(target);
    controls.minDistance = distance * .48;
    controls.maxDistance = distance * 2.2;
    return { position, target };
  }

  function resetView(animate = false) {
    const pose = viewPose();
    if (animate && !reduceMotion.matches) {
      cameraGoal = pose;
    } else {
      cameraGoal = null;
      camera.position.copy(pose.position);
      controls.target.copy(pose.target);
      controls.update();
    }
  }
  function resize() {
    const w = element.clientWidth;
    const h = element.clientHeight;
    if (!w || !h || (width === w && height === h)) return;
    const firstSize = width === 1;
    const oldAspect = camera.aspect;
    width = w;
    height = h;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
    if (firstSize || Math.abs(oldAspect - camera.aspect) > .22) resetView();
  }
  const observer = new ResizeObserver(resize);
  observer.observe(element);
  resize();
  resetView();
  const reset = () => resetView(true);
  element.querySelector('.view-reset').addEventListener('click', reset);
  controls.addEventListener('start', () => { cameraGoal = null; });
  canvas.addEventListener('keydown', event => {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', '+', '-', '=', '0'].includes(event.key)) return;
    event.preventDefault();
    cameraGoal = null;
    if (event.key === '0') {
      resetView();
      return;
    }
    const offset = new THREE.Spherical().setFromVector3(camera.position.clone().sub(controls.target));
    if (event.key === 'ArrowLeft') offset.theta -= .15;
    if (event.key === 'ArrowRight') offset.theta += .15;
    if (event.key === 'ArrowUp') offset.phi = Math.max(controls.minPolarAngle, offset.phi - .15);
    if (event.key === 'ArrowDown') offset.phi = Math.min(controls.maxPolarAngle, offset.phi + .15);
    if (['+', '='].includes(event.key)) offset.radius *= .88;
    if (event.key === '-') offset.radius *= 1.14;
    offset.radius = THREE.MathUtils.clamp(offset.radius, controls.minDistance, controls.maxDistance);
    camera.position.setFromSpherical(offset).add(controls.target);
    controls.update();
  });

  const view = {
    resetView,
    draw(time, delta) {
      if (isProduct) {
        spread = reduceMotion.matches ? Number(exploded) : THREE.MathUtils.damp(spread, Number(exploded), 8, delta);
      }
      if (cameraGoal) {
        const ease = 1 - Math.exp(-8 * delta);
        camera.position.lerp(cameraGoal.position, ease);
        controls.target.lerp(cameraGoal.target, ease);
        if (camera.position.distanceToSquared(cameraGoal.position) < 1e-5 &&
            controls.target.distanceToSquared(cameraGoal.target) < 1e-5) cameraGoal = null;
      }
      model.update(time * rate, spread, isProduct ? focusPart : null);
      controls.update();
      renderer.render(scene, camera);
      if (annotations) updateAnnotations(annotations, model.labels, camera, width, height, spread > .48 || !!focusPart);
    },
    dispose() {
      observer.disconnect();
      element.querySelector('.view-reset').removeEventListener('click', reset);
      controls.dispose();
      disposeModel(scene);
      renderer.dispose();
      renderer.forceContextLoss();
      canvas.remove();
    },
  };
  view.draw(playhead[page], 0);
  views.push(view);
}

function createAnnotations(element) {
  const holder = document.createElement('div');
  holder.className = 'annotations';
  holder.setAttribute('aria-hidden', 'true');
  const lines = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  lines.classList.add('annotation-lines');
  holder.append(lines);
  const labels = mechanismCards.map(part => {
    const line = document.createElementNS(lines.namespaceURI, 'line');
    line.setAttribute('stroke', part.accent);
    lines.append(line);
    const label = document.createElement('span');
    label.className = 'annotation';
    label.style.setProperty('--part-color', part.accent);
    label.textContent = part.title;
    holder.append(label);
    return { part, line, label };
  });
  element.append(holder);
  return { holder, labels };
}

const projection = new THREE.Vector3();
function updateAnnotations(annotations, anchors, camera, width, height, visible) {
  annotations.holder.hidden = !visible;
  if (!visible) return;
  const placed = [];
  for (const [index, entry] of annotations.labels.entries()) {
    const { part, line, label } = entry;
    const anchor = anchors?.[part.id];
    if (anchor) anchor.getWorldPosition(projection).project(camera);
    const hidden = !anchor || projection.z > 1 || projection.z < -1 ||
      Math.abs(projection.x) > 1 || Math.abs(projection.y) > 1 || (focusPart && focusPart !== part.id);
    label.hidden = hidden;
    line.style.display = hidden ? 'none' : '';
    if (hidden) continue;

    const x = (projection.x + 1) * width / 2;
    const y = (1 - projection.y) * height / 2;
    const half = label.offsetWidth / 2;
    const labelX = THREE.MathUtils.clamp(x + (index === 1 ? -30 : 34), half + 6, width - half - 6);
    let labelY = THREE.MathUtils.clamp(y - 34, 64, height - 40);
    for (const other of placed) {
      if (Math.abs(labelX - other.x) < half + other.half + 8 && Math.abs(labelY - other.y) < 26) {
        labelY = other.y + 28 < height - 38 ? other.y + 28 : other.y - 28;
      }
    }
    placed.push({ x: labelX, y: labelY, half });
    label.style.left = `${labelX}px`;
    label.style.top = `${labelY}px`;
    line.setAttribute('x1', x);
    line.setAttribute('y1', y);
    line.setAttribute('x2', labelX);
    line.setAttribute('y2', labelY);
  }
}

function clearViews() {
  for (const view of views) view.dispose();
  views = [];
}
function renderCards() {
  const isMotion = page === 'motion';
  const cards = isMotion ? motionCards : mechanismCards;
  workspace.className = 'cards';
  workspace.innerHTML = cards.map(card => `
    <article class="card" style="--tint:${card.tint};--accent:${card.accent};--chip:${card.chip}">
      <div class="card-header">
        <span class="card-symbol">${icon(card.icon)}</span>
        <div><h2>${card.title}</h2>${card.subtitle ? `<p>${card.subtitle}</p>` : ''}</div>
      </div>
      <div class="view">${viewResetButton()}</div>
    </article>`).join('');
  const elements = workspace.querySelectorAll('.view');
  for (const [index, card] of cards.entries()) {
    const model = isMotion ? createMotion(card.id) : createMechanism(card.id);
    createView(elements[index], model, card.title, isMotion ? .27 : .225);
  }
}

function syncProducts() {
  workspace.querySelectorAll('[data-product]').forEach(button => {
    button.setAttribute('aria-pressed', button.dataset.product === product.id);
  });
  workspace.querySelectorAll('[data-explode]').forEach(button => {
    button.setAttribute('aria-pressed', (button.dataset.explode === 'true') === exploded);
  });
  workspace.querySelectorAll('[data-part]').forEach(button => {
    button.setAttribute('aria-pressed', button.dataset.part === focusPart);
  });
}

async function showProduct() {
  const version = ++selectionVersion;
  clearViews();
  syncProducts();
  const element = workspace.querySelector('.product-view');
  element.innerHTML = `<div class="product-caption"><h2>${product.title}</h2><p>模式モデル</p></div>${viewResetButton()}`;
  const current = product;
  try {
    const model = await current.load();
    if (selectionVersion !== version) {
      disposeModel(model.root);
      return;
    }
    createView(element, model, current.title, current.rate, true);
  } catch (error) {
    if (selectionVersion !== version) return;
    console.error(error);
    showViewError(element, '3Dモデルを読み込めませんでした。');
  }
}

function renderProducts() {
  workspace.className = '';
  workspace.innerHTML = `
    <article class="product">
      <div class="product-bar">
        <div class="product-tabs segment" role="group" aria-label="製品">
          ${products.map(item => `<button type="button" class="button" data-product="${item.id}">${icon(item.icon)}${item.button}</button>`).join('')}
        </div>
        <div class="view-modes segment" role="group" aria-label="表示">
          <button type="button" class="button" data-explode="false">${icon('product')}組み立て</button>
          <button type="button" class="button" data-explode="true">${icon('explode')}分解</button>
        </div>
      </div>
      <div class="view product-view"></div>
      <div class="parts" role="group" aria-label="機構を選択">
        ${mechanismCards.map(part => `<button type="button" class="button part" data-part="${part.id}" style="--part-color:${part.accent}">${part.title}</button>`).join('')}
      </div>
    </article>`;
  workspace.querySelector('.product').addEventListener('click', event => {
    const button = event.target.closest('button');
    if (!button) return;
    if (button.dataset.product && button.dataset.product !== product.id) {
      product = products.find(item => item.id === button.dataset.product);
      playhead.products = 0;
      focusPart = null;
      showProduct();
      return;
    }
    if (button.dataset.explode !== undefined) {
      const nextExploded = button.dataset.explode === 'true';
      if (nextExploded !== exploded) {
        exploded = nextExploded;
        if (!exploded) focusPart = null;
        views.forEach(view => view.resetView(true));
      }
    }
    if (button.dataset.part) {
      focusPart = focusPart === button.dataset.part ? null : button.dataset.part;
      if (focusPart && !exploded) {
        exploded = true;
        views.forEach(view => view.resetView(true));
      }
    }
    syncProducts();
  });
  showProduct();
}

function setPageLink(link, destination) {
  if (destination) {
    link.href = `#${destination.id}`;
    link.removeAttribute('aria-disabled');
  } else {
    link.removeAttribute('href');
    link.setAttribute('aria-disabled', 'true');
  }
}
function route() {
  const index = Math.max(pages.findIndex(item => location.hash === `#${item.id}`), 0);
  const nextPage = pages[index];
  if (page === nextPage.id) return;
  ++selectionVersion;
  clearViews();
  page = nextPage.id;
  heading.textContent = nextPage.title;
  document.title = `${nextPage.title} | 動きのしくみ`;
  document.querySelectorAll('[data-page]').forEach(link => {
    if (link.dataset.page === page) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });
  setPageLink(previous, pages[index - 1]);
  setPageLink(next, pages[index + 1]);
  pageCount.textContent = `${index + 1} / ${pages.length}`;
  if (page === 'products') renderProducts();
  else renderCards();
  window.scrollTo(0, 0);
}

playback.addEventListener('click', () => {
  running = !running;
  playbackLabel();
});
reduceMotion.addEventListener('change', event => {
  if (event.matches) {
    running = false;
    playbackLabel();
  }
});
document.querySelector('#restart').addEventListener('click', () => { playhead[page] = 0; });
window.addEventListener('hashchange', route);
playbackLabel();
route();

let lastFrame = performance.now();
function frame(now) {
  const delta = Math.min(.05, (now - lastFrame) / 1000);
  lastFrame = now;
  if (running) playhead[page] += delta * Number(speed.value);
  for (const view of views) view.draw(playhead[page], delta);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
