import * as THREE from 'three';
import { OrbitControls } from './vendor/OrbitControls.js';
import { createMotion } from './models/motion.js?v=20261116-2';
import { createMechanism } from './models/mechanisms.js?v=20261116-2';

const pages = [
  { id: 'motion', title: '運動の種類' },
  { id: 'mechanisms', title: '機構の動き' },
  { id: 'products', title: '製品のしくみ' },
];
const motionCards = [
  { id: 'carousel', title: '直線運動', subtitle: 'メリーゴーランドの馬の上下運動', icon: 'straight', accent: '#22795e', chip: '#e0f5ed', tint: '#e6f1ec' },
  { id: 'teacup', title: '回転運動', subtitle: 'ティーカップ', icon: 'rotate', accent: '#245fc6', chip: '#e6efff', tint: '#e8effa' },
  { id: 'wiper', title: '揺動運動・車のワイパー', icon: 'sway', accent: '#a54d21', chip: '#fcece2', tint: '#f4ede7' },
];
const mechanismCards = [
  { id: 'gears', title: '歯車', icon: 'gears', accent: '#3873e6', chip: '#e6efff', tint: '#e8effa' },
  { id: 'linkage', title: 'リンク機構', icon: 'logo', accent: '#ef9a37', chip: '#fff0dd', tint: '#f5efe7' },
  { id: 'crank-rocker', title: 'てこクランク', icon: 'sway', accent: '#c97a2d', chip: '#fff0dd', tint: '#f5efe7' },
  { id: 'cam', title: 'カム機構', icon: 'cam', accent: '#9c63e9', chip: '#f0e8ff', tint: '#eeeafa' },
];
const products = [
  { id: 'car', title: '車のエンジンの基礎', icon: 'car', rate: .18, load: () => import('./models/car-engine.js?v=20261116-2').then(module => module.createCarEngine()) },
  { id: 'camera', title: 'チェキのフィルム送り', button: 'チェキ', icon: 'camera', rate: .16, load: () => import('./models/camera.js?v=20261116-2').then(module => module.createCameraProduct()) },
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
let extracted = true;
let focusPart = null;
let views = [];
let selectionVersion = 0;

function playbackLabel() {
  playback.innerHTML = icon(running ? 'pause' : 'play');
  playback.setAttribute('aria-label', running ? '一時停止' : '再生');
  playback.title = running ? '一時停止' : '再生';
}

const fullView = document.querySelector('#full-view');
const playbackPanel = document.querySelector('.playback');
let expandedArticle = null;
let returnFocus = null;
let placeholder = null;

function expandView(article, trigger) {
  if (expandedArticle) return;
  expandedArticle = article;
  returnFocus = trigger;
  placeholder = document.createComment('expanded model');
  article.before(placeholder);
  fullView.append(article);
  fullView.querySelector('.full-toolbar').append(playbackPanel);
  fullView.showModal();
  document.body.style.overflow = 'hidden';
  if (document.documentElement.requestFullscreen && !document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch(() => {});
  }
}
function closeFullView() {
  if (!expandedArticle) return;
  placeholder.replaceWith(expandedArticle);
  document.querySelector('.page-heading').append(playbackPanel);
  expandedArticle = null;
  fullView.close();
  document.body.style.overflow = '';
  returnFocus?.focus();
  if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
}
fullView.addEventListener('cancel', event => { event.preventDefault(); closeFullView(); });
document.querySelector('#close-full').addEventListener('click', closeFullView);
document.addEventListener('fullscreenchange', () => {
  if (!document.fullscreenElement && expandedArticle) closeFullView();
});

function viewResetButton() {
  return `<button type="button" class="button compact view-expand" aria-label="全画面表示" title="全画面表示">${icon('expand')}</button><button type="button" class="button compact view-reset" aria-label="視点を戻す" title="視点を戻す">${icon('crosshair')}</button>`;
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
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
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
  let extraction = 0;
  let manualTurn = 0;
  const manual = element.parentElement.querySelector('.manual-control');
  let cameraGoal = null;
  let directManipulation = !!manual;
  controls.enabled = !directManipulation;
  if (manual) canvas.style.touchAction = 'none';
  function viewPose() {
    const open = isProduct && exploded;
    const detail = isProduct && extracted;
    const target = new THREE.Vector3(...(open && model.explodedTarget || detail && model.detailTarget || model.target));
    const position = new THREE.Vector3(...(open && model.explodedCamera || detail && model.detailCamera || model.camera));
    const fitAspect = isProduct ? ((open ? model.explodedFitAspect : model.fitAspect) || 1.48) : (model.fitAspect || .94);
    const fit = Math.max(1, fitAspect / camera.aspect);
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
    if (firstSize || Math.abs(oldAspect - camera.aspect) > .01) resetView();
  }
  const observer = new ResizeObserver(resize);
  observer.observe(element);
  resize();
  resetView();
  const reset = () => resetView(true);
  element.querySelector('.view-reset').addEventListener('click', reset);
  controls.addEventListener('start', () => { cameraGoal = null; });
  const article = element.closest('article');
  const expand = () => expandView(article, canvas);
  element.querySelector('.view-expand').addEventListener('click', expand);
  let pointerStart;
  let lastModelAngle;
  let pointerMoved = false;
  const driveCenter = new THREE.Vector3();
  function modelAngle(event) {
    driveCenter.set(...(model.drivePoint || model.target));
    model.root.localToWorld(driveCenter).project(camera);
    const rect = canvas.getBoundingClientRect();
    return Math.atan2(-(event.clientY - rect.top - (1 - driveCenter.y) * rect.height / 2),
      event.clientX - rect.left - (driveCenter.x + 1) * rect.width / 2);
  }
  canvas.addEventListener('pointerdown', event => {
    if (!event.isPrimary || event.button !== 0 || pointerStart) return;
    pointerStart = { x: event.clientX, y: event.clientY, id: event.pointerId };
    pointerMoved = false;
    if (directManipulation) {
      canvas.setPointerCapture(event.pointerId);
      lastModelAngle = modelAngle(event);
      turnByHand(manualTurn);
    }
  });
  canvas.addEventListener('pointermove', event => {
    if (!pointerStart || pointerStart.id !== event.pointerId) return;
    pointerMoved ||= Math.hypot(event.clientX - pointerStart.x, event.clientY - pointerStart.y) > 5;
    if (!directManipulation || !pointerMoved) return;
    const angle = modelAngle(event);
    const difference = Math.atan2(Math.sin(angle - lastModelAngle), Math.cos(angle - lastModelAngle));
    turnByHand(manualTurn + difference / (Math.PI * 2 * (model.dragResistance || 1)));
    lastModelAngle = angle;
  });
  canvas.addEventListener('pointerup', event => {
    if (pointerStart?.id !== event.pointerId) return;
    if (pointerStart && !pointerMoved) {
      if (directManipulation) turnByHand(manualTurn + 1 / (24 * (model.dragResistance || 1)));
      expand();
    }
    pointerStart = null;
  });
  for (const name of ['pointercancel', 'lostpointercapture']) canvas.addEventListener(name, event => {
    if (pointerStart?.id === event.pointerId) pointerStart = null;
  });
  if (manual) {
    const orbit = document.createElement('button');
    orbit.className = 'button compact view-orbit';
    orbit.innerHTML = icon('hand');
    orbit.setAttribute('aria-label', '動かす・視点を回す');
    orbit.title = '動かす・視点を回す';
    orbit.setAttribute('aria-pressed', 'false');
    element.append(orbit);
    orbit.addEventListener('click', () => {
      directManipulation = !directManipulation;
      controls.enabled = !directManipulation;
      orbit.innerHTML = icon(directManipulation ? 'hand' : 'eye');
      orbit.setAttribute('aria-pressed', String(!directManipulation));
    });
  }
  const input = manual?.querySelector('input');
  const dial = manual?.querySelector('.handwheel');
  function turnByHand(value) {
    running = false;
    playbackLabel();
    manualTurn = value;
    syncManual();
  }
  function syncManual() {
    if (!manual) return;
    const degrees = ((manualTurn * 360) % 720 + 720) % 720;
    if (input) input.value = degrees;
    dial?.style.setProperty('--angle', `${manualTurn * 360}deg`);
    dial?.setAttribute('aria-valuenow', Math.round(degrees));
    dial?.setAttribute('aria-valuetext', `${Math.round(degrees)}度`);
    canvas.setAttribute('aria-valuetext', `${Math.round(degrees)}度`);
  }
  input?.addEventListener('input', () => turnByHand(Number(input.value) / 360));
  let lastDialAngle = null;
  let dialPointer = null;
  function dialAngle(event) {
    const rect = dial.getBoundingClientRect();
    return Math.atan2(event.clientY - rect.top - rect.height / 2, event.clientX - rect.left - rect.width / 2);
  }
  dial?.addEventListener('pointerdown', event => {
    if (!event.isPrimary || event.button !== 0 || dialPointer !== null) return;
    dialPointer = event.pointerId;
    dial.setPointerCapture(event.pointerId);
    lastDialAngle = dialAngle(event);
    turnByHand(manualTurn);
  });
  dial?.addEventListener('pointermove', event => {
    if (lastDialAngle === null || dialPointer !== event.pointerId) return;
    const angle = dialAngle(event);
    const difference = Math.atan2(Math.sin(angle - lastDialAngle), Math.cos(angle - lastDialAngle));
    turnByHand(manualTurn + difference / (Math.PI * 2 * (model.dragResistance || 1)));
    lastDialAngle = angle;
  });
  for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) dial?.addEventListener(name, event => {
    if (dialPointer === event.pointerId) { lastDialAngle = null; dialPointer = null; }
  });
  dial?.addEventListener('keydown', event => {
    const amount = { ArrowLeft: -1, ArrowDown: -1, ArrowRight: 1, ArrowUp: 1, PageUp: 30, PageDown: -30 }[event.key];
    if (amount !== undefined) {
      event.preventDefault();
      turnByHand(manualTurn + amount / (360 * (model.dragResistance || 1)));
    }
  });
  canvas.addEventListener('keydown', event => {
    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); expand(); return; }
    if (directManipulation && event.key.startsWith('Arrow')) {
      event.preventDefault();
      turnByHand(manualTurn + (['ArrowLeft', 'ArrowDown'].includes(event.key) ? -1 : 1) / (12 * (model.dragResistance || 1)));
      return;
    }
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
    restart() { manualTurn = 0; model.reset?.(); syncManual(); },
    draw(time, delta) {
      if (isProduct) {
        extraction = reduceMotion.matches ? Number(extracted) : THREE.MathUtils.damp(extraction, Number(extracted), 4, delta);
        spread = reduceMotion.matches ? Number(exploded) : THREE.MathUtils.damp(spread, Number(exploded), 8, delta);
      }
      if (cameraGoal) {
        const ease = 1 - Math.exp(-8 * delta);
        camera.position.lerp(cameraGoal.position, ease);
        controls.target.lerp(cameraGoal.target, ease);
        if (camera.position.distanceToSquared(cameraGoal.position) < 1e-5 &&
            controls.target.distanceToSquared(cameraGoal.target) < 1e-5) cameraGoal = null;
      }
      if (manual && running) {
        manualTurn += delta * Number(speed.value) * rate;
        syncManual();
      }
      model.update(manual ? manualTurn : time * rate, spread, isProduct ? focusPart : null, extraction);
      controls.update();
      renderer.render(scene, camera);
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

function clearViews() {
  for (const view of views) view.dispose();
  views = [];
}
function renderCards() {
  const isMotion = page === 'motion';
  const cards = isMotion ? motionCards : mechanismCards;
  workspace.className = isMotion ? 'cards' : 'cards mechanism-cards';
  workspace.innerHTML = cards.map(card => `
    <article class="card" style="--tint:${card.tint};--accent:${card.accent};--chip:${card.chip}">
      <div class="card-header">
        <span class="card-symbol" role="img" aria-label="${card.title}" title="${card.title}">${icon(card.icon)}</span>
      </div>
      <div class="view">${viewResetButton()}</div>
      ${isMotion ? '' : `<div class="manual-control">
        <div class="handwheel" role="slider" tabindex="0" aria-label="${card.title}を手で回す" aria-valuemin="0" aria-valuemax="720" aria-valuenow="0"><span></span></div>
        <input type="range" min="0" max="720" step="1" value="0" aria-label="${card.title}の回転角度">
      </div>`}
    </article>`).join('');
  const elements = workspace.querySelectorAll('.view');
  for (const [index, card] of cards.entries()) {
    const model = isMotion ? createMotion(card.id) : createMechanism(card.id);
    createView(elements[index], model, card.title, isMotion ? .27 : .225);
  }
}

function syncProducts() {
  const scope = expandedArticle || workspace;
  scope.querySelector('[data-source]')?.toggleAttribute('hidden', product.id !== 'car');
  scope.querySelector('[data-extract]')?.toggleAttribute('hidden', product.id !== 'car');
  scope.querySelector('[data-extract]')?.setAttribute('aria-pressed', String(extracted));
  scope.querySelectorAll('[data-product]').forEach(button => {
    button.setAttribute('aria-pressed', button.dataset.product === product.id);
  });
  scope.querySelectorAll('[data-explode]').forEach(button => {
    button.setAttribute('aria-pressed', (button.dataset.explode === 'true') === exploded);
  });
  scope.querySelectorAll('[data-part]').forEach(button => {
    button.setAttribute('aria-pressed', button.dataset.part === focusPart);
    button.hidden = product.id === 'car' && button.dataset.part === 'cam';
  });
}

async function showProduct() {
  const version = ++selectionVersion;
  clearViews();
  syncProducts();
  const element = (expandedArticle || workspace).querySelector('.product-view');
  element.innerHTML = viewResetButton();
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
          ${products.map(item => `<button type="button" class="button" data-product="${item.id}" aria-label="${item.title}" title="${item.title}">${icon(item.icon)}</button>`).join('')}
        </div>
        <div class="view-modes segment" role="group" aria-label="表示">
          <a class="button" data-source href="./assets/printed-engine/README.txt" target="_blank" rel="noopener" aria-label="モデルの出典と作者" title="WhopperPrinting · CC BY-NC-ND 4.0">${icon('info')}</a>
          <button type="button" class="button" data-extract aria-label="エンジンを取り出す・車全体に戻す" title="エンジンを取り出す・車全体に戻す">${icon('engine')}</button>
          <button type="button" class="button" data-explode="false" aria-label="組み立て" title="組み立て">${icon('product')}</button>
          <button type="button" class="button" data-explode="true" aria-label="分解" title="分解">${icon('explode')}</button>
        </div>
      </div>
      <div class="view product-view"></div>
      <div class="parts" role="group" aria-label="機構を選択">
        ${mechanismCards.filter(part => part.id !== 'crank-rocker').map(part => `<button type="button" class="button part" data-part="${part.id}" style="--part-color:${part.accent}" aria-label="${part.title}" title="${part.title}">${icon(part.icon)}</button>`).join('')}
      </div>
    </article>`;
  workspace.querySelector('.product').addEventListener('click', event => {
    const button = event.target.closest('button');
    if (!button) return;
    if (button.dataset.product && button.dataset.product !== product.id) {
      product = products.find(item => item.id === button.dataset.product);
      playhead.products = 0;
      focusPart = null;
      exploded = false;
      extracted = product.id === 'car';
      showProduct();
      return;
    }
    if (button.hasAttribute('data-extract')) {
      extracted = !extracted;
      if (!extracted) { exploded = false; focusPart = null; }
      views.forEach(view => view.resetView(true));
    }
    if (button.dataset.explode !== undefined) {
      const nextExploded = button.dataset.explode === 'true';
      if (nextExploded !== exploded) {
        exploded = nextExploded;
        if (exploded && product.id === 'car') extracted = true;
        if (!exploded) focusPart = null;
        views.forEach(view => view.resetView(true));
      }
    }
    if (button.dataset.part) {
      focusPart = focusPart === button.dataset.part ? null : button.dataset.part;
      if (focusPart && product.id === 'car' && !extracted) {
        extracted = true;
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
  closeFullView();
  ++selectionVersion;
  clearViews();
  page = nextPage.id;
  running = page !== 'mechanisms' && !reduceMotion.matches;
  playbackLabel();
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
document.querySelector('#restart').addEventListener('click', () => { playhead[page] = 0; views.forEach(view => view.restart()); });
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
