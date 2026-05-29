/**
 * 主视觉页 — 物理引擎、形状排列（爱心/字母）、烟花爆炸与情话重生
 */
(function () {
  const stage = document.getElementById('galleryStage');
  const effectsLayer = document.getElementById('effectsLayer');
  const trailCanvas = document.getElementById('trailCanvas');
  const trailCtx = trailCanvas ? trailCanvas.getContext('2d') : null;
  const introOverlay = document.getElementById('introOverlay');
  const introSkip = document.getElementById('introSkip');
  const addPhotoBtn = document.getElementById('addPhotoBtn');
  const addPhotoInput = document.getElementById('addPhotoInput');
  const removePhotoBtn = document.getElementById('removePhotoBtn');
  const photoManageModal = document.getElementById('photoManageModal');
  const photoManageGrid = document.getElementById('photoManageGrid');
  const photoManageEmpty = document.getElementById('photoManageEmpty');
  const photoManageClose = document.getElementById('photoManageClose');
  const rulesBtn = document.getElementById('rulesBtn');
  const rulesBubble = document.getElementById('rulesBubble');
  const rulesModal = document.getElementById('rulesModal');
  const rulesCloseBtn = document.getElementById('rulesCloseBtn');

  const MARGIN = 24;
  const MOUSE_RADIUS = 42;
  const RESTITUTION = 0.72;
  const WALL_RESTITUTION = 0.65;
  const FRICTION = 0.998;
  const AIR_DRAG = 0.12;
  const FLOAT_STRENGTH = 18;
  const MAX_SPEED = 900;
  const MAX_ANGLE = 16;
  const SOLVER_ITERATIONS = 6;
  const FORM_SPRING = 300;
  const FORM_DAMPING = 0.86;
  const FORM_PHOTO_SCALE = 0.58;
  const FORM_SPRING_STRICT = 420;
  const FORM_DAMPING_STRICT = 0.9;
  const FORM_PHOTO_SCALE_STRICT = 0.56;
  const TRAIL_MAX = 100;
  const TRAIL_MIN_SPEED = 28;
  const BURST_MAX_PARTICLES = 520;
  const BURST_MAX_PARTICLES_REDUCED = 220;
  const BURST_MIN_HEAVY_PHOTOS = 5;
  const SHOCKWAVE_FORCE = 680;
  const SHOCKWAVE_FORCE_REDUCED = 460;
  const SHOCKWAVE_MAX_SPEED = 1020;
  const SHOCKWAVE_RAMP_RATE = 1.08;
  const SHOCKWAVE_MAX_INTENSITY = 4.6;
  const SHOCKWAVE_WIND_FORCE = 540;
  const SHOCKWAVE_WIND_FORCE_REDUCED = 360;

  let trails = [];

  const LOVE_QUOTES = [
    '遇见你，是我最美好的意外。',
    '你在的地方，就是我心之所向。',
    '想和你一起，把平凡的日子过成诗。',
    '我的手不大，但刚刚好能握住你的心。',
    '全世界的美好，都不及你一笑。',
    '余生很长，只想和你慢慢走。',
    '你是我藏在微风里的温柔。',
    '我喜欢你，像风走了八千里，不问归期。',
    '有你在，每一天都是情人节。',
    '愿岁岁常相见，年年共此时。',
    '你一笑，我的世界就亮了。',
    '想把你藏进怀里，更想把你写进余生里。',
  ];

  let photos = [];
  let objectUrls = [];
  let formationTargets = [];
  let mouseX = window.innerWidth / 2;
  let mouseY = window.innerHeight / 2;
  let prevMouseX = mouseX;
  let prevMouseY = mouseY;
  let mouseVx = 0;
  let mouseVy = 0;
  let time = 0;
  let animId = null;
  let introDone = false;
  let physicsRunning = false;
  /** null | { type: 'heart'|'letter', keyCode, char? } */
  let formationMode = null;
  let formationBursting = false;
  let highRegularMode = false;
  let rulesBubbleLocked = false;
  let quoteIndex = 0;
  let formationBurstCooldownUntil = 0;
  let shockwaveHoldDir = null;
  let shockwaveHoldStart = 0;
  let shockwaveIntensity = 1;
  let shockwaveLastPulseAt = 0;
  let shockwaveSustainEl = null;
  let shockwaveFlashEl = null;

  const ARROW_DIRECTIONS = {
    ArrowLeft: 'left',
    ArrowRight: 'right',
    ArrowUp: 'up',
    ArrowDown: 'down',
  };

  // 冲击波从对侧边缘扫入，把照片往按键方向吹
  const SHOCKWAVE_VISUAL_EDGE = {
    left: 'right',
    right: 'left',
    up: 'down',
    down: 'up',
  };

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function getBaseSize() {
    return Math.min(140, Math.max(72, window.innerWidth * 0.08));
  }

  function clamp(val, min, max) {
    return Math.max(min, Math.min(max, val));
  }

  function isFormationActive() {
    return formationMode !== null;
  }

  function getCurrentFormScale() {
    return highRegularMode ? FORM_PHOTO_SCALE_STRICT : FORM_PHOTO_SCALE;
  }

  function getSimPhotos() {
    return photos.filter((p) => !p.exploding);
  }

  function dismissIntro() {
    if (introDone) return;
    introDone = true;
    if (!photos.length) {
      introOverlay.hidden = true;
      return;
    }
    introOverlay.classList.add('fade-out');
    setTimeout(() => {
      introOverlay.hidden = true;
    }, 800);
  }

  introSkip.addEventListener('click', (e) => {
    e.stopPropagation();
    dismissIntro();
  });
  introOverlay.addEventListener('click', dismissIntro);

  function getFormationLayout() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    return {
      cx: w / 2,
      cy: h / 2 + h * 0.015,
      scale: Math.min(w, h) * 0.0132,
    };
  }

  function heartPointAt(t, layout) {
    const hx = 16 * Math.pow(Math.sin(t), 3);
    const hy =
      13 * Math.cos(t) -
      5 * Math.cos(2 * t) -
      2 * Math.cos(3 * t) -
      Math.cos(4 * t);
    return {
      x: layout.cx + hx * layout.scale,
      y: layout.cy - hy * layout.scale,
    };
  }

  function generateHeartOutlinePoints(desiredCount) {
    const layout = getFormationLayout();
    const spacing = getBaseSize() * getCurrentFormScale() * 0.92;

    const dense = [];
    const SAMPLES = 360;
    for (let i = 0; i <= SAMPLES; i++) {
      const t = (i / SAMPLES) * Math.PI * 2;
      dense.push(heartPointAt(t, layout));
    }

    return resampleOutlinePoints(dense, desiredCount, spacing);
  }

  function generateFormationPoints(mode, desiredCount) {
    const layout = getFormationLayout();
    const spacing = getBaseSize() * getCurrentFormScale() * 0.92;

    if (mode.type === 'heart') {
      return generateHeartOutlinePoints(desiredCount);
    }
    if (mode.type === 'letter' && mode.char) {
      return generateLetterOutlinePoints(mode.char, desiredCount, layout, spacing);
    }
    return [];
  }

  function removeFormationClones() {
    const clones = photos.filter((p) => p.isClone);
    clones.forEach((p) => p.el.remove());
    photos = photos.filter((p) => !p.isClone);
  }

  function assignFormationTargets() {
    const sources = photos.filter((p) => !p.isClone && !p.exploding);
    if (!sources.length || !formationMode) return;

    formationTargets = generateFormationPoints(formationMode, sources.length);
    if (!formationTargets.length) return;

    const availableTargets = formationTargets.slice();

    // 就近分配目标点，减少交叉与抖动，让形状更规整
    sources.forEach((p) => {
      let bestIdx = 0;
      let bestDist = Infinity;
      for (let i = 0; i < availableTargets.length; i++) {
        const t = availableTargets[i];
        const d = Math.hypot(t.x - p.x, t.y - p.y);
        if (d < bestDist) {
          bestDist = d;
          bestIdx = i;
        }
      }
      const target = availableTargets.splice(bestIdx, 1)[0];
      p.formX = target.x;
      p.formY = target.y;
      p.formScale = getCurrentFormScale();
      p.vx = 0;
      p.vy = 0;
      p.va = 0;
      p.angle *= 0.2;
    });

    for (let i = 0; i < availableTargets.length; i++) {
      const target = availableTargets[i];
      const src = sources[i % sources.length];
      const clone = createClonePhoto(src, target.x, target.y);
      clone.formX = target.x;
      clone.formY = target.y;
      clone.formScale = getCurrentFormScale();
      clone.vx = 0;
      clone.vy = 0;
      photos.push(clone);
    }
  }

  function prepareFormation() {
    removeFormationClones();
    assignFormationTargets();
  }

  function buildPhotoElement(imageUrl, alt) {
    const card = document.createElement('div');
    card.className = 'photo-card';
    const img = document.createElement('img');
    img.src = imageUrl;
    img.alt = alt;
    img.draggable = false;
    card.appendChild(img);
    stage.appendChild(card);
    return card;
  }

  function bindPhotoClick(photo) {
    photo.el.addEventListener('click', (e) => {
      e.stopPropagation();
      if (isFormationActive() || photo.exploding) return;
      explodePhoto(photo);
    });
  }

  function createPhotoState(card, opts) {
    const baseSize = getBaseSize();
    const w = window.innerWidth;
    const h = window.innerHeight;
    const x = opts.x ?? w / 2 + (Math.random() - 0.5) * 120;
    const y = opts.y ?? h / 2 + (Math.random() - 0.5) * 120;
    const radius = baseSize / 2;
    const mass = radius * radius;

    const photo = {
      el: card,
      id: opts.id,
      blob: opts.blob,
      imageUrl: opts.imageUrl,
      name: opts.name || '我们的照片',
      isClone: opts.isClone || false,
      exploding: false,
      x,
      y,
      vx: opts.vx ?? (Math.random() - 0.5) * 30,
      vy: opts.vy ?? (Math.random() - 0.5) * 30,
      size: baseSize,
      radius,
      mass,
      invMass: 1 / mass,
      angle: 0,
      va: 0,
      scale: opts.scale ?? 1,
      phaseOffset: Math.random() * Math.PI * 2,
      formX: x,
      formY: y,
      formScale: getCurrentFormScale(),
    };

    card.style.width = `${baseSize}px`;
    card.style.height = `${baseSize}px`;
    bindPhotoClick(photo);
    applyTransform(photo);
    return photo;
  }

  function createPhoto(record, index, total) {
    const imageUrl = URL.createObjectURL(record.blob);
    objectUrls.push(imageUrl);

    const w = window.innerWidth;
    const h = window.innerHeight;
    const angleSpread = (index / Math.max(total, 1)) * Math.PI * 2;
    const spreadR = Math.min(w, h) * 0.22;

    const card = buildPhotoElement(imageUrl, record.name || '我们的照片');
    return createPhotoState(card, {
      id: record.id,
      blob: record.blob,
      imageUrl,
      name: record.name,
      isClone: false,
      x: w / 2 + Math.cos(angleSpread) * spreadR,
      y: h / 2 + Math.sin(angleSpread) * spreadR,
    });
  }

  function createClonePhoto(source, tx, ty) {
    const card = buildPhotoElement(source.imageUrl, source.name);
    return createPhotoState(card, {
      id: `${source.id}_clone_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      blob: source.blob,
      imageUrl: source.imageUrl,
      name: source.name,
      isClone: true,
      x: tx,
      y: ty,
      vx: 0,
      vy: 0,
      scale: getCurrentFormScale(),
    });
  }

  function nextQuote() {
    const q = LOVE_QUOTES[quoteIndex % LOVE_QUOTES.length];
    quoteIndex += 1;
    return q;
  }

  function showLoveQuote(text) {
    const el = document.createElement('p');
    el.className = 'love-quote';
    el.textContent = text;
    effectsLayer.appendChild(el);
    return el;
  }

  function getFormationDisplayChar() {
    if (!formationMode) return '';
    if (formationMode.type === 'heart') return '♥';
    return formationMode.char || '';
  }

  function spawnSparkParticle(x, y, opts = {}) {
    const el = document.createElement('div');
    el.className = opts.className || 'burst-spark';
    const size = opts.size ?? 6 + Math.random() * 8;
    el.style.width = `${size}px`;
    el.style.height = `${size}px`;
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    if (opts.color) el.style.background = opts.color;
    effectsLayer.appendChild(el);

    const angle = opts.angle ?? Math.random() * Math.PI * 2;
    const speed = opts.speed ?? 140 + Math.random() * 260;
    return {
      el,
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      rot: Math.random() * 360,
      vr: (Math.random() - 0.5) * 900,
      life: 1,
      decay: opts.decay ?? 0.7 + Math.random() * 0.45,
      gravity: opts.gravity ?? 220,
      halfSize: size / 2,
    };
  }

  function animateBurstParticles(particles, duration = 2000) {
    const start = performance.now();

    function frame(now) {
      const t = (now - start) / duration;
      if (t >= 1) {
        particles.forEach((pt) => pt.el.remove());
        return;
      }
      const dt = 0.016;
      particles.forEach((pt) => {
        pt.vy += pt.gravity * dt;
        pt.x += pt.vx * dt;
        pt.y += pt.vy * dt;
        pt.vx *= 0.97;
        pt.vy *= 0.97;
        pt.rot += pt.vr * dt;
        pt.life -= pt.decay * dt;
        const opacity = Math.max(0, pt.life);
        const half = pt.halfSize ?? (parseFloat(pt.el.style.width) / 2 || 4);
        pt.el.style.transform =
          `translate(${pt.x - half}px, ${pt.y - half}px) rotate(${pt.rot}deg) scale(${0.25 + opacity * 0.85})`;
        pt.el.style.opacity = String(opacity);
      });
      requestAnimationFrame(frame);
    }

    requestAnimationFrame(frame);
  }

  function getBurstBudget(photoCount) {
    const count = Math.max(1, photoCount);
    const factor = clamp(22 / count, reducedMotion ? 0.24 : 0.28, 1);
    const shardCount = Math.max(4, Math.round((reducedMotion ? 8 : 20) * factor));
    const sparkCount = Math.max(3, Math.round((reducedMotion ? 6 : 12) * factor));
    const heartCount = Math.max(1, Math.round((reducedMotion ? 2 : 4) * factor));
    const rays = Math.max(8, Math.round((reducedMotion ? 12 : 18) * factor));
    const maxParticles = reducedMotion ? BURST_MAX_PARTICLES_REDUCED : BURST_MAX_PARTICLES;
    const perPhoto = shardCount + sparkCount + heartCount;
    const centerCost = rays + (reducedMotion ? 2 : 3);
    const heavyCap = Math.max(
      BURST_MIN_HEAVY_PHOTOS,
      Math.floor((maxParticles - centerCost) / Math.max(perPhoto, 1))
    );
    return {
      shardCount,
      sparkCount,
      heartCount,
      rays,
      heavyCap,
      duration: reducedMotion ? 700 : 950,
      centerDuration: reducedMotion ? 760 : 980,
    };
  }

  function sampleHeavyPhotos(allPhotos, cap) {
    if (allPhotos.length <= cap) return allPhotos.slice();
    const arr = allPhotos.slice();
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr.slice(0, cap);
  }

  function spawnFormationPhotoBurst(x, y, imageUrl, budget) {
    const particles = [];
    const shardCount = budget?.shardCount ?? (reducedMotion ? 8 : 20);

    for (let i = 0; i < shardCount; i++) {
      const p = document.createElement('div');
      p.className = 'firework-particle burst-shard';
      const size = 7 + Math.random() * 16;
      p.style.width = `${size}px`;
      p.style.height = `${size}px`;
      p.style.left = `${x}px`;
      p.style.top = `${y}px`;
      p.style.backgroundImage = `url(${imageUrl})`;
      effectsLayer.appendChild(p);

      const angle = (Math.PI * 2 * i) / shardCount + Math.random() * 0.5;
      const speed = 65 + Math.random() * 120;
      particles.push({
        el: p,
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        rot: Math.random() * 360,
        vr: (Math.random() - 0.5) * 960,
        life: 1,
        decay: 1.25 + Math.random() * 0.5,
        gravity: 35,
        halfSize: size / 2,
      });
    }

    const sparkColors = [
      'rgba(255, 170, 200, 0.95)',
      'rgba(255, 220, 235, 0.9)',
      'rgba(240, 200, 255, 0.85)',
      'rgba(255, 200, 180, 0.9)',
    ];
    const sparkCount = budget?.sparkCount ?? (reducedMotion ? 6 : 12);
    for (let i = 0; i < sparkCount; i++) {
      particles.push(
        spawnSparkParticle(x, y, {
          color: sparkColors[i % sparkColors.length],
          speed: 40 + Math.random() * 80,
          size: 4 + Math.random() * 7,
          decay: 1.35 + Math.random() * 0.55,
          gravity: 28,
        })
      );
    }

    const heartCount = budget?.heartCount ?? (reducedMotion ? 2 : 4);
    for (let i = 0; i < heartCount; i++) {
      const h = document.createElement('div');
      h.className = 'burst-heart';
      h.textContent = '♥';
      h.style.left = `${x}px`;
      h.style.top = `${y}px`;
      const heartSize = 9 + Math.random() * 9;
      h.style.fontSize = `${heartSize}px`;
      effectsLayer.appendChild(h);
      const angle = Math.random() * Math.PI * 2;
      const speed = 35 + Math.random() * 70;
      particles.push({
        el: h,
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        rot: 0,
        vr: (Math.random() - 0.5) * 400,
        life: 1,
        decay: 1.2 + Math.random() * 0.45,
        gravity: 20,
        halfSize: heartSize * 0.33,
      });
    }

    animateBurstParticles(particles, budget?.duration ?? (reducedMotion ? 1200 : 1600));
  }

  function spawnCenterFormationBurst(cx, cy, bounds, budget) {
    const span = bounds
      ? Math.min(Math.max(bounds.width, bounds.height) * 0.95, Math.min(window.innerWidth, window.innerHeight) * 0.78)
      : 120;

    const flash = document.createElement('div');
    flash.className = 'formation-burst-flash';
    flash.style.left = `${cx}px`;
    flash.style.top = `${cy}px`;
    flash.style.width = `${span}px`;
    flash.style.height = `${span}px`;
    flash.style.marginLeft = `${-span / 2}px`;
    flash.style.marginTop = `${-span / 2}px`;
    effectsLayer.appendChild(flash);
    setTimeout(() => flash.remove(), 700);

    for (let i = 0; i < (reducedMotion ? 2 : 3); i++) {
      const ring = document.createElement('div');
      ring.className = 'formation-burst-ring';
      ring.style.left = `${cx}px`;
      ring.style.top = `${cy}px`;
      const ringBase = Math.max(40, span * 0.18);
      ring.style.width = `${ringBase}px`;
      ring.style.height = `${ringBase}px`;
      ring.style.marginLeft = `${-ringBase / 2}px`;
      ring.style.marginTop = `${-ringBase / 2}px`;
      ring.style.animationDelay = `${i * 0.12}s`;
      effectsLayer.appendChild(ring);
      setTimeout(() => ring.remove(), 900);
    }

    const particles = [];
    const rays = budget?.rays ?? (reducedMotion ? 12 : 18);
    for (let i = 0; i < rays; i++) {
      particles.push(
        spawnSparkParticle(cx, cy, {
          angle: (Math.PI * 2 * i) / rays,
          speed: 90 + Math.random() * 110,
          size: 4 + Math.random() * 7,
          decay: 1.2 + Math.random() * 0.45,
          gravity: 26,
        })
      );
    }
    animateBurstParticles(particles, budget?.centerDuration ?? (reducedMotion ? 1000 : 1300));
  }

  function getFormationBounds() {
    const sim = getSimPhotos();
    const points = sim.map((p) => ({
      x: p.formX ?? p.x,
      y: p.formY ?? p.y,
    }));

    if (!points.length) {
      const layout = getFormationLayout();
      const fallback = Math.min(window.innerWidth, window.innerHeight) * 0.42;
      return {
        cx: layout.cx,
        cy: layout.cy,
        width: fallback,
        height: fallback,
      };
    }

    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    points.forEach((p) => {
      minX = Math.min(minX, p.x);
      maxX = Math.max(maxX, p.x);
      minY = Math.min(minY, p.y);
      maxY = Math.max(maxY, p.y);
    });

    const pad = getBaseSize() * getCurrentFormScale() * 0.52;
    const width = Math.max(maxX - minX + pad * 2, pad * 2);
    const height = Math.max(maxY - minY + pad * 2, pad * 2);

    return {
      cx: (minX + maxX) / 2,
      cy: (minY + maxY) / 2,
      width,
      height,
    };
  }

  function showFormationGlyph(char, bounds, anchorX, anchorY) {
    const wrap = document.createElement('div');
    wrap.className = 'formation-glyph-wrap';
    wrap.style.left = `${anchorX}px`;
    wrap.style.top = `${anchorY}px`;
    wrap.style.width = `${bounds.width}px`;
    wrap.style.height = `${bounds.height}px`;

    const el = document.createElement('div');
    el.className = 'formation-glyph';
    if (formationMode?.type === 'heart') el.classList.add('is-heart');
    el.textContent = char;

    const fontSize = Math.min(bounds.width * 0.88, bounds.height * 0.92);
    el.style.fontSize = `${fontSize}px`;

    wrap.appendChild(el);
    wrap.setAttribute('aria-hidden', 'true');
    effectsLayer.appendChild(wrap);

    setTimeout(() => wrap.classList.add('fade-out'), 1400);
    setTimeout(() => wrap.remove(), 2100);
    return wrap;
  }

  function explodeFormationShape(anchorX, anchorY) {
    if (!isFormationActive() || formationBursting) return;
    if (Date.now() < formationBurstCooldownUntil) return;

    formationBursting = true;
    formationBurstCooldownUntil = Date.now() + 2400;

    const bounds = getFormationBounds();
    const displayChar = getFormationDisplayChar();
    const sim = getSimPhotos();
    if (!sim.length) {
      formationBursting = false;
      return;
    }
    const budget = getBurstBudget(sim.length);
    const burstX = typeof anchorX === 'number' ? anchorX : bounds.cx;
    const burstY = typeof anchorY === 'number' ? anchorY : bounds.cy;

    spawnCenterFormationBurst(burstX, burstY, bounds, budget);

    const clones = sim.filter((p) => p.isClone);
    const sources = sim.filter((p) => !p.isClone);
    const heavyTargets = sampleHeavyPhotos(sources, budget.heavyCap);
    const heavySet = new Set(heavyTargets);
    const burstScatter = Math.min(bounds.width, bounds.height) * 0.09;

    clones.forEach((p) => {
      // 克隆只做轻量销毁，避免形状点位很多时卡顿
      p.el.classList.add('is-exploding');
      setTimeout(() => p.el.remove(), 60);
    });
    photos = photos.filter((p) => !clones.includes(p));

    sources.forEach((p) => {
      if (heavySet.has(p)) {
        const jitterX = burstX + (Math.random() - 0.5) * burstScatter;
        const jitterY = burstY + (Math.random() - 0.5) * burstScatter;
        spawnFormationPhotoBurst(jitterX, jitterY, p.imageUrl, budget);
      }
      const dx = p.x - burstX;
      const dy = p.y - burstY;
      const dist = Math.hypot(dx, dy) || 1;
      const speed = 300 + Math.random() * 340;
      p.vx = (dx / dist) * speed + (Math.random() - 0.5) * 100;
      p.vy = (dy / dist) * speed + (Math.random() - 0.5) * 100;
      p.va = (Math.random() - 0.5) * 520;
      p.scale = 1;
      p.angle += (Math.random() - 0.5) * 40;
    });

    showFormationGlyph(displayChar, bounds, burstX, burstY);
    if (window.RomanceAudio) window.RomanceAudio.playFormationBurst();

    setTimeout(() => {
      formationBursting = false;
      if (isFormationActive()) prepareFormation();
    }, 2200);
  }

  function spawnFireworks(x, y, imageUrl) {
    const count = reducedMotion ? 12 : 24;
    const particles = [];

    for (let i = 0; i < count; i++) {
      const p = document.createElement('div');
      p.className = 'firework-particle';
      const size = 10 + Math.random() * 18;
      p.style.width = `${size}px`;
      p.style.height = `${size}px`;
      p.style.left = `${x}px`;
      p.style.top = `${y}px`;
      p.style.backgroundImage = `url(${imageUrl})`;
      effectsLayer.appendChild(p);

      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.4;
      const speed = 120 + Math.random() * 280;
      particles.push({
        el: p,
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        rot: Math.random() * 360,
        vr: (Math.random() - 0.5) * 720,
        life: 1,
        decay: 0.55 + Math.random() * 0.35,
      });
    }

    const start = performance.now();
    const duration = 2200;

    function animateFire(now) {
      const t = (now - start) / duration;
      if (t >= 1) {
        particles.forEach((pt) => pt.el.remove());
        return;
      }
      const dt = 0.016;
      particles.forEach((pt) => {
        pt.vy += 180 * dt;
        pt.x += pt.vx * dt;
        pt.y += pt.vy * dt;
        pt.vx *= 0.98;
        pt.vy *= 0.98;
        pt.rot += pt.vr * dt;
        pt.life -= pt.decay * dt;
        const opacity = Math.max(0, pt.life);
        pt.el.style.transform =
          `translate(${pt.x - parseFloat(pt.el.style.width) / 2}px, ${pt.y - parseFloat(pt.el.style.height) / 2}px) rotate(${pt.rot}deg) scale(${0.3 + opacity * 0.7})`;
        pt.el.style.opacity = String(opacity);
      });
      requestAnimationFrame(animateFire);
    }

    requestAnimationFrame(animateFire);
  }

  function explodePhoto(photo) {
    if (photo.exploding) return;
    photo.exploding = true;
    photo.el.classList.add('is-exploding');

    const { x, y, blob, imageUrl, name, isClone, id } = photo;
    const spawnX = x;
    const spawnY = y;

    spawnFireworks(x, y, imageUrl);
    const quoteEl = showLoveQuote(nextQuote());
    if (window.RomanceAudio) {
      window.RomanceAudio.playFirework();
      window.RomanceAudio.playLoveQuote();
    }

    const idx = photos.indexOf(photo);
    if (idx !== -1) photos.splice(idx, 1);
    setTimeout(() => photo.el.remove(), 50);

    setTimeout(() => quoteEl.classList.add('fade-out'), 3000);
    setTimeout(() => {
      quoteEl.remove();
      respawnPhoto({ x: spawnX, y: spawnY, blob, imageUrl, name, isClone, id });
    }, 4200);
  }

  function respawnPhoto(opts) {
    const card = buildPhotoElement(opts.imageUrl, opts.name);
    const photo = createPhotoState(card, {
      id: opts.isClone ? `${opts.id}_respawn_${Date.now()}` : opts.id,
      blob: opts.blob,
      imageUrl: opts.imageUrl,
      name: opts.name,
      isClone: opts.isClone,
      x: opts.x,
      y: opts.y,
      vx: (Math.random() - 0.5) * 60,
      vy: (Math.random() - 0.5) * 60,
      scale: 0.2,
    });
    photos.push(photo);
    if (window.RomanceAudio) window.RomanceAudio.playRespawn();
    requestAnimationFrame(() => {
      photo.scale = 1;
    });
  }

  function applyTransform(p) {
    const half = (p.size * p.scale) / 2;
    p.el.style.width = `${p.size}px`;
    p.el.style.height = `${p.size}px`;
    p.el.style.transform =
      `translate(${p.x - half}px, ${p.y - half}px) rotate(${p.angle}deg) scale(${p.scale})`;
  }

  function resizeTrailCanvas() {
    if (!trailCanvas || !trailCtx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    trailCanvas.width = window.innerWidth * dpr;
    trailCanvas.height = window.innerHeight * dpr;
    trailCanvas.style.width = `${window.innerWidth}px`;
    trailCanvas.style.height = `${window.innerHeight}px`;
    trailCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function drawHeartParticle(ctx, x, y, size, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = '#e898b4';
    ctx.font = `${Math.round(size * 1.8)}px serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('♥', x, y);
    ctx.restore();
  }

  function drawGlowParticle(ctx, x, y, size, alpha) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, size);
    g.addColorStop(0, `rgba(255, 215, 230, ${alpha * 0.75})`);
    g.addColorStop(0.45, `rgba(240, 175, 205, ${alpha * 0.4})`);
    g.addColorStop(1, 'rgba(230, 200, 240, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fill();
  }

  function spawnTrail(photo) {
    if (reducedMotion || !trailCtx) return;
    const speed = Math.hypot(photo.vx, photo.vy);
    if (speed < TRAIL_MIN_SPEED) return;

    if (trails.length >= TRAIL_MAX) {
      trails.splice(0, trails.length - TRAIL_MAX + 1);
    }

    const angle = Math.atan2(photo.vy, photo.vx);
    const dist = photo.radius * photo.scale * 0.55;
    const intensity = clamp((speed - TRAIL_MIN_SPEED) / 200, 0.15, 1);

    trails.push({
      x: photo.x - Math.cos(angle) * dist + (Math.random() - 0.5) * 10,
      y: photo.y - Math.sin(angle) * dist + (Math.random() - 0.5) * 10,
      vx: -photo.vx * 0.06 + (Math.random() - 0.5) * 18,
      vy: -photo.vy * 0.06 + (Math.random() - 0.5) * 18,
      life: 0.35 + intensity * 0.45,
      decay: 0.018 + Math.random() * 0.012,
      size: 4 + intensity * 10,
      kind: Math.random() < 0.28 ? 'heart' : 'glow',
    });
  }

  function updateTrails(dt) {
    if (!trailCtx || reducedMotion) return;
    if (isFormationActive()) {
      trails = [];
      return;
    }

    getSimPhotos().forEach((p) => {
      const speed = Math.hypot(p.vx, p.vy);
      p.trailTimer = (p.trailTimer || 0) - dt;
      if (speed > TRAIL_MIN_SPEED && p.trailTimer <= 0) {
        spawnTrail(p);
        p.trailTimer = clamp(0.05 / (speed / 80), 0.018, 0.08);
      }
    });

    trails = trails.filter((t) => {
      t.life -= t.decay;
      t.x += t.vx * dt;
      t.y += t.vy * dt;
      t.vx *= 0.9;
      t.vy *= 0.9;
      return t.life > 0;
    });
  }

  function renderTrails() {
    if (!trailCtx) return;
    trailCtx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    trails.forEach((t) => {
      const alpha = t.life * 0.55;
      if (t.kind === 'heart') drawHeartParticle(trailCtx, t.x, t.y, t.size, alpha);
      else drawGlowParticle(trailCtx, t.x, t.y, t.size, alpha);
    });
  }

  function capSpeed(p, maxSpeed = MAX_SPEED) {
    const speed = Math.hypot(p.vx, p.vy);
    if (speed > maxSpeed) {
      p.vx = (p.vx / speed) * maxSpeed;
      p.vy = (p.vy / speed) * maxSpeed;
    }
  }

  function applyImpulse(a, b, nx, ny, restitution) {
    const rvx = b.vx - a.vx;
    const rvy = b.vy - a.vy;
    const velN = rvx * nx + rvy * ny;
    if (velN > 0) return;
    const invSum = a.invMass + b.invMass;
    const j = (-(1 + restitution) * velN) / invSum;
    a.vx -= j * nx * a.invMass;
    a.vy -= j * ny * a.invMass;
    b.vx += j * nx * b.invMass;
    b.vy += j * ny * b.invMass;
  }

  function separateCircles(a, b, nx, ny, overlap) {
    const invSum = a.invMass + b.invMass;
    const corr = overlap / invSum;
    a.x -= nx * corr * a.invMass;
    a.y -= ny * corr * a.invMass;
    b.x += nx * corr * b.invMass;
    b.y += ny * corr * b.invMass;
  }

  function resolvePhotoCollision(a, b) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    let dist = Math.hypot(dx, dy);
    const minDist = (a.radius + b.radius) * ((a.scale + b.scale) / 2);
    if (dist >= minDist) return;

    const nx = dist > 0.001 ? dx / dist : 1;
    const ny = dist > 0.001 ? dy / dist : 0;
    dist = Math.max(dist, 0.001);
    const overlap = minDist - dist;
    separateCircles(a, b, nx, ny, overlap);
    const rvx = b.vx - a.vx;
    const rvy = b.vy - a.vy;
    const velN = rvx * nx + rvy * ny;
    applyImpulse(a, b, nx, ny, RESTITUTION);
    if (overlap > 3 && velN < -30 && window.RomanceAudio) {
      window.RomanceAudio.playBump(Math.min(1, Math.abs(velN) / 420));
    }
    a.va += overlap * 0.02;
    b.va -= overlap * 0.02;
  }

  function resolveMouseCollision(p) {
    if (isFormationActive()) return;

    const dx = p.x - mouseX;
    const dy = p.y - mouseY;
    let dist = Math.hypot(dx, dy);
    const minDist = p.radius * p.scale + MOUSE_RADIUS;

    if (dist >= minDist) {
      p.scale += (1 - p.scale) * 0.1;
      return;
    }

    const nx = dist > 0.001 ? dx / dist : 0;
    const ny = dist > 0.001 ? dy / dist : -1;
    dist = Math.max(dist, 0.001);
    const overlap = minDist - dist;

    p.x += nx * overlap;
    p.y += ny * overlap;

    const rvx = p.vx - mouseVx;
    const rvy = p.vy - mouseVy;
    const velN = rvx * nx + rvy * ny;
    if (velN < 0) {
      const j = -(1 + RESTITUTION) * velN;
      p.vx += j * nx;
      p.vy += j * ny;
    }

    const mouseSpeed = Math.hypot(mouseVx, mouseVy);
    if (overlap > 2 && mouseSpeed > 35 && window.RomanceAudio) {
      window.RomanceAudio.playPop(Math.min(1, mouseSpeed / 320 + overlap / p.radius * 0.2));
    }

    p.vx += nx * (mouseSpeed * 0.55 + overlap * 120);
    p.vy += ny * (mouseSpeed * 0.55 + overlap * 120);
    p.va += mouseSpeed * 0.03 * (Math.random() > 0.5 ? 1 : -1);
    p.scale = 1 + Math.min(overlap / p.radius, 0.15) * 0.6;
  }

  function resolveWallCollision(p) {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const r = p.radius * p.scale;

    if (p.x - r < MARGIN) {
      p.x = MARGIN + r;
      if (p.vx < 0) {
        if (window.RomanceAudio) window.RomanceAudio.playWall(Math.min(1, Math.abs(p.vx) / 500));
        p.vx = -p.vx * WALL_RESTITUTION;
      }
    }
    if (p.x + r > w - MARGIN) {
      p.x = w - MARGIN - r;
      if (p.vx > 0) {
        if (window.RomanceAudio) window.RomanceAudio.playWall(Math.min(1, Math.abs(p.vx) / 500));
        p.vx = -p.vx * WALL_RESTITUTION;
      }
    }
    if (p.y - r < MARGIN) {
      p.y = MARGIN + r;
      if (p.vy < 0) {
        if (window.RomanceAudio) window.RomanceAudio.playWall(Math.min(1, Math.abs(p.vy) / 500));
        p.vy = -p.vy * WALL_RESTITUTION;
      }
    }
    if (p.y + r > h - MARGIN) {
      p.y = h - MARGIN - r;
      if (p.vy > 0) {
        if (window.RomanceAudio) window.RomanceAudio.playWall(Math.min(1, Math.abs(p.vy) / 500));
        p.vy = -p.vy * WALL_RESTITUTION;
      }
    }
  }

  function applyBuoyancy(p, dt) {
    const t = time + p.phaseOffset;
    p.vx += Math.sin(t * 0.4) * FLOAT_STRENGTH * dt;
    p.vy += (Math.cos(t * 0.35) * FLOAT_STRENGTH - 4) * dt;
  }

  function formationPhysicsStep(dt) {
    const sim = getSimPhotos();
    const spring = highRegularMode ? FORM_SPRING_STRICT : FORM_SPRING;
    const damping = highRegularMode ? FORM_DAMPING_STRICT : FORM_DAMPING;
    const snapDist = highRegularMode ? 2.4 : 1.2;
    const snapSpeed = highRegularMode ? 24 : 12;
    sim.forEach((p) => {
      const targetScale = p.formScale ?? getCurrentFormScale();
      const dx = p.formX - p.x;
      const dy = p.formY - p.y;
      const ax = dx * spring;
      const ay = dy * spring;
      p.vx = (p.vx + ax * dt) * damping;
      p.vy = (p.vy + ay * dt) * damping;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.scale += (targetScale - p.scale) * (highRegularMode ? 0.26 : 0.18);
      p.angle += (0 - p.angle) * (highRegularMode ? 0.18 : 0.12);
      p.va = 0;
      if (Math.hypot(dx, dy) < snapDist && Math.hypot(p.vx, p.vy) < snapSpeed) {
        p.x = p.formX;
        p.y = p.formY;
        p.vx = 0;
        p.vy = 0;
      }
      capSpeed(p);
    });
    sim.forEach(applyTransform);
  }

  function freePhysicsStep(dt) {
    const sim = getSimPhotos();
    if (!sim.length) return;

    const subSteps = reducedMotion ? 2 : 4;
    const subDt = dt / subSteps;

    for (let step = 0; step < subSteps; step++) {
      sim.forEach((p) => {
        applyBuoyancy(p, subDt);
        p.vx *= 1 - AIR_DRAG * subDt;
        p.vy *= 1 - AIR_DRAG * subDt;
        p.vx *= FRICTION;
        p.vy *= FRICTION;
        p.scale += (1 - p.scale) * 0.12;
        p.x += p.vx * subDt;
        p.y += p.vy * subDt;
        capSpeed(p);
      });

      for (let iter = 0; iter < SOLVER_ITERATIONS; iter++) {
        sim.forEach(resolveMouseCollision);
        for (let i = 0; i < sim.length; i++) {
          for (let j = i + 1; j < sim.length; j++) {
            resolvePhotoCollision(sim[i], sim[j]);
          }
        }
        sim.forEach(resolveWallCollision);
      }

      sim.forEach((p) => {
        p.angle += p.va * subDt;
        p.va *= 0.94;
        p.angle = clamp(p.angle, -MAX_ANGLE, MAX_ANGLE);
      });
    }

    sim.forEach(applyTransform);
  }

  function physicsStep(dt) {
    if (formationBursting) freePhysicsStep(dt);
    else if (isFormationActive()) formationPhysicsStep(dt);
    else freePhysicsStep(dt);
  }

  function tick(now) {
    const dt = Math.min((now - (tick.last || now)) / 1000, 0.033);
    tick.last = now;
    time += dt;

    mouseVx = (mouseX - prevMouseX) / dt;
    mouseVy = (mouseY - prevMouseY) / dt;
    prevMouseX = mouseX;
    prevMouseY = mouseY;

    if (getSimPhotos().length) physicsStep(dt);
    updateShockwaveHold(dt, now);
    updateTrails(dt);
    renderTrails();
    animId = requestAnimationFrame(tick);
  }

  function startPhysics() {
    if (physicsRunning) return;
    physicsRunning = true;
    requestAnimationFrame(tick);
  }

  function exitFormationMode(options = {}) {
    formationMode = null;
    removeFormationClones();
    getSimPhotos().forEach((p) => {
      p.scale = 1;
    });
    if (options.skipImpulse) return;

    const cx = window.innerWidth / 2;
    const cy = window.innerHeight / 2;
    getSimPhotos().forEach((p) => {
      const dx = p.x - cx;
      const dy = p.y - cy;
      const dist = Math.hypot(dx, dy) || 1;
      p.vx += (dx / dist) * 180;
      p.vy += (dy / dist) * 180;
    });
  }

  function getShockwaveVector(dir) {
    const w = window.innerWidth;
    const h = window.innerHeight;
    switch (dir) {
      case 'left':
        return { nx: -1, ny: 0, edgeX: 0, edgeY: h / 2, span: h };
      case 'right':
        return { nx: 1, ny: 0, edgeX: w, edgeY: h / 2, span: h };
      case 'up':
        return { nx: 0, ny: -1, edgeX: w / 2, edgeY: 0, span: w };
      case 'down':
        return { nx: 0, ny: 1, edgeX: w / 2, edgeY: h, span: w };
      default:
        return null;
    }
  }

  function getShockwaveVisualEdge(blowDir) {
    return SHOCKWAVE_VISUAL_EDGE[blowDir] || null;
  }

  function getShockwaveAlignment(dir, p, w, h) {
    if (dir === 'right') return 0.62 + (1 - p.x / w) * 0.48;
    if (dir === 'left') return 0.62 + (p.x / w) * 0.48;
    if (dir === 'up') return 0.62 + (p.y / h) * 0.48;
    if (dir === 'down') return 0.62 + (1 - p.y / h) * 0.48;
    return 0.78;
  }

  function getShockwaveMaxSpeed(intensity) {
    return Math.min(1680, SHOCKWAVE_MAX_SPEED * (0.88 + intensity * 0.22));
  }

  function removeShockwaveSustainVisual() {
    if (shockwaveSustainEl) {
      shockwaveSustainEl.remove();
      shockwaveSustainEl = null;
    }
    if (shockwaveFlashEl) {
      shockwaveFlashEl.remove();
      shockwaveFlashEl = null;
    }
    if (stage) stage.style.removeProperty('transform');
  }

  function createShockwaveSustainVisual(blowDir) {
    removeShockwaveSustainVisual();
    const visualEdge = getShockwaveVisualEdge(blowDir);
    if (!visualEdge) return;

    shockwaveSustainEl = document.createElement('div');
    shockwaveSustainEl.className = `edge-shockwave-sustain edge-from-${visualEdge}`;
    effectsLayer.appendChild(shockwaveSustainEl);

    shockwaveFlashEl = document.createElement('div');
    shockwaveFlashEl.className = `edge-shockwave-sustain-flash edge-from-${visualEdge}`;
    effectsLayer.appendChild(shockwaveFlashEl);
    updateShockwaveSustainVisual(1);
  }

  function updateShockwaveSustainVisual(intensity) {
    const norm = clamp((intensity - 1) / (SHOCKWAVE_MAX_INTENSITY - 1), 0, 1);
    const visual = (0.24 + norm * 0.76).toFixed(3);

    if (shockwaveSustainEl) {
      shockwaveSustainEl.style.setProperty('--sw-i', visual);
      shockwaveSustainEl.classList.toggle('sw-intense', intensity >= 2.6);
      shockwaveSustainEl.classList.toggle('sw-max', intensity >= 3.8);
    }
    if (shockwaveFlashEl) {
      shockwaveFlashEl.style.setProperty('--sw-i', (norm * 0.38).toFixed(3));
    }
  }

  function spawnEdgeShockwaveVisual(blowDir, intensity = 1) {
    const visualEdge = getShockwaveVisualEdge(blowDir);
    if (!visualEdge) return;

    const wrap = document.createElement('div');
    wrap.className = `edge-shockwave edge-from-${visualEdge} edge-shockwave-pulse`;
    const pulse = Math.min(1.55, 0.72 + intensity * 0.18);
    wrap.style.setProperty('--sw-pulse', pulse.toFixed(2));
    effectsLayer.appendChild(wrap);

    const ringCount = 1;
    for (let i = 0; i < ringCount; i++) {
      const ring = document.createElement('div');
      ring.className = 'edge-shockwave-ring';
      if (i) ring.classList.add('edge-shockwave-ring-delay');
      wrap.appendChild(ring);
    }

    window.setTimeout(() => wrap.remove(), Math.max(420, 720 / pulse));
  }

  function triggerScreenShake(dir, intensity = 1) {
    if (!stage) return;
    const tier = intensity >= 3.4 ? 'strong' : intensity >= 2 ? 'mid' : 'light';
    const cls = `shockwave-shake-${dir} shockwave-shake-${tier}`;
    stage.classList.remove(
      'shockwave-shake-left',
      'shockwave-shake-right',
      'shockwave-shake-up',
      'shockwave-shake-down',
      'shockwave-shake-light',
      'shockwave-shake-mid',
      'shockwave-shake-strong'
    );
    void stage.offsetWidth;
    stage.classList.add(`shockwave-shake-${dir}`, `shockwave-shake-${tier}`);
    const duration = intensity >= 3 ? 520 : intensity >= 2 ? 440 : reducedMotion ? 240 : 360;
    window.setTimeout(() => {
      stage.classList.remove(`shockwave-shake-${dir}`, `shockwave-shake-${tier}`);
      if (!shockwaveHoldDir) stage.style.removeProperty('transform');
    }, duration);
  }

  function applyShockwaveImpulse(dir, intensity = 1) {
    const vec = getShockwaveVector(dir);
    if (!vec) return;

    const w = window.innerWidth;
    const h = window.innerHeight;
    const baseForce = (reducedMotion ? SHOCKWAVE_FORCE_REDUCED : SHOCKWAVE_FORCE) * intensity;
    const spin = (reducedMotion ? 140 : 260) * Math.min(intensity, 2.2);
    const maxSpeed = getShockwaveMaxSpeed(intensity);

    getSimPhotos().forEach((p) => {
      const alignment = getShockwaveAlignment(dir, p, w, h);
      const force = baseForce * alignment * (0.9 + Math.random() * 0.18);
      p.vx += vec.nx * force;
      p.vy += vec.ny * force;
      p.vx += (Math.random() - 0.5) * force * 0.08;
      p.vy += (Math.random() - 0.5) * force * 0.08;
      p.va += (Math.random() - 0.5) * spin;
      p.scale = Math.min(1.08 + intensity * 0.025, Math.max(p.scale, 1.03 + intensity * 0.012));
      capSpeed(p, maxSpeed);
    });
  }

  function applyShockwaveWind(dir, dt, intensity) {
    const vec = getShockwaveVector(dir);
    if (!vec) return;

    const w = window.innerWidth;
    const h = window.innerHeight;
    const windBase = (reducedMotion ? SHOCKWAVE_WIND_FORCE_REDUCED : SHOCKWAVE_WIND_FORCE) * intensity;
    const spin = 48 * intensity * dt;
    const maxSpeed = getShockwaveMaxSpeed(intensity);

    getSimPhotos().forEach((p) => {
      const alignment = getShockwaveAlignment(dir, p, w, h);
      const force = windBase * alignment * dt;
      p.vx += vec.nx * force;
      p.vy += vec.ny * force;
      p.va += (Math.random() - 0.5) * spin;
      capSpeed(p, maxSpeed);
    });
  }

  function beginShockwaveHold(dir) {
    if (!getShockwaveVector(dir)) return;
    if (formationBursting || !getSimPhotos().length) return;
    if (shockwaveHoldDir === dir) return;

    if (isFormationActive()) exitFormationMode({ skipImpulse: true });

    shockwaveHoldDir = dir;
    shockwaveHoldStart = performance.now();
    shockwaveIntensity = 1;
    shockwaveLastPulseAt = 0;

    createShockwaveSustainVisual(dir);
    applyShockwaveImpulse(dir, 1);
    triggerScreenShake(dir, 1);
    spawnEdgeShockwaveVisual(dir, 1);
    if (window.RomanceAudio) {
      window.RomanceAudio.playShockwaveStart();
      window.RomanceAudio.startShockwaveWind(dir, 1);
    }
  }

  function endShockwaveHold() {
    shockwaveHoldDir = null;
    shockwaveHoldStart = 0;
    shockwaveIntensity = 1;
    shockwaveLastPulseAt = 0;
    removeShockwaveSustainVisual();
    if (window.RomanceAudio) window.RomanceAudio.stopShockwaveWind();
  }

  function updateShockwaveHold(dt, now) {
    if (!shockwaveHoldDir || formationBursting) return;

    shockwaveIntensity = Math.min(
      SHOCKWAVE_MAX_INTENSITY,
      1 + ((now - shockwaveHoldStart) / 1000) * SHOCKWAVE_RAMP_RATE
    );

    applyShockwaveWind(shockwaveHoldDir, dt, shockwaveIntensity);
    updateShockwaveSustainVisual(shockwaveIntensity);
    if (window.RomanceAudio) window.RomanceAudio.updateShockwaveWind(shockwaveIntensity);

    if (shockwaveIntensity >= 2.1 && stage) {
      const rumble = (shockwaveIntensity - 2.1) * 1.15;
      const ox = (Math.random() - 0.5) * rumble * 2.4;
      const oy = (Math.random() - 0.5) * rumble * 2.4;
      if (!stage.classList.contains(`shockwave-shake-${shockwaveHoldDir}`)) {
        stage.style.transform = `translate(${ox.toFixed(2)}px, ${oy.toFixed(2)}px)`;
      }
    }

    const pulseInterval = Math.max(180, 560 - shockwaveIntensity * 88);
    if (now - shockwaveLastPulseAt >= pulseInterval) {
      spawnEdgeShockwaveVisual(shockwaveHoldDir, shockwaveIntensity);
      if (shockwaveIntensity >= 1.55) {
        triggerScreenShake(shockwaveHoldDir, shockwaveIntensity);
        if (window.RomanceAudio) window.RomanceAudio.playShockwavePulse(shockwaveIntensity);
      }
      shockwaveLastPulseAt = now;
    }
  }

  function setFormationMode(mode) {
    if (!photos.filter((p) => !p.isClone && !p.exploding).length) return;

    formationMode = mode;
    prepareFormation();
    if (window.RomanceAudio) window.RomanceAudio.playFormationEnter();
  }

  function updateRulesBubble(clientX, clientY) {
    if (!rulesBtn || !rulesBubble || rulesBubbleLocked) return;
    const rect = rulesBtn.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const d = Math.hypot(clientX - cx, clientY - cy);
    rulesBubble.classList.toggle('show', d < 120);
  }

  function openRulesModal() {
    if (!rulesModal) return;
    if (rulesBubble) rulesBubble.classList.remove('show');
    rulesBubbleLocked = false;
    rulesModal.hidden = false;
  }

  function closeRulesModal() {
    if (!rulesModal) return;
    rulesModal.hidden = true;
  }

  function getStoredPhotos() {
    return photos.filter((p) => !p.isClone && !p.exploding);
  }

  function isPhotoCloneOf(photo, sourceId) {
    return photo.id === sourceId || (photo.isClone && photo.id.startsWith(`${sourceId}_clone`));
  }

  function removePhotoFromStage(id) {
    if (isFormationActive()) exitFormationMode();

    const toRemove = photos.filter((p) => isPhotoCloneOf(p, id));
    const urlsToMaybeRevoke = new Set();

    toRemove.forEach((p) => {
      if (!p.isClone) urlsToMaybeRevoke.add(p.imageUrl);
      p.el.remove();
    });

    photos = photos.filter((p) => !toRemove.includes(p));

    urlsToMaybeRevoke.forEach((url) => {
      if (!photos.some((p) => p.imageUrl === url)) {
        URL.revokeObjectURL(url);
        objectUrls = objectUrls.filter((u) => u !== url);
      }
    });
  }

  function renderPhotoManageGrid() {
    if (!photoManageGrid || !photoManageEmpty) return;

    const stored = getStoredPhotos();
    photoManageGrid.innerHTML = '';
    photoManageEmpty.hidden = stored.length > 0;
    photoManageGrid.hidden = stored.length === 0;

    stored.forEach((photo) => {
      const item = document.createElement('div');
      item.className = 'photo-manage-item';
      item.dataset.id = photo.id;

      const img = document.createElement('img');
      img.src = photo.imageUrl;
      img.alt = photo.name;
      img.draggable = false;

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'photo-manage-delete';
      btn.setAttribute('aria-label', `删除 ${photo.name}`);
      btn.textContent = '×';
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (window.RomanceAudio) window.RomanceAudio.playUiClick();
        handleDeletePhoto(photo.id, item);
      });

      item.appendChild(img);
      item.appendChild(btn);
      photoManageGrid.appendChild(item);
    });
  }

  function openPhotoManageModal() {
    if (!photoManageModal) return;
    closeRulesModal();
    renderPhotoManageGrid();
    photoManageModal.hidden = false;
  }

  function closePhotoManageModal() {
    if (!photoManageModal) return;
    photoManageModal.hidden = true;
  }

  async function handleDeletePhoto(id, itemEl) {
    try {
      await deletePhoto(id);
      removePhotoFromStage(id);
      if (itemEl) {
        itemEl.remove();
      } else {
        renderPhotoManageGrid();
      }
      if (!getStoredPhotos().length && photoManageEmpty && photoManageGrid) {
        photoManageEmpty.hidden = false;
        photoManageGrid.hidden = true;
      }
    } catch (err) {
      console.error(err);
      alert('删除失败，请重试');
    }
  }

  function isLetterKey(code) {
    return code.length === 4 && code >= 'KeyA' && code <= 'KeyZ';
  }

  function isDigitKey(code) {
    if (!code) return false;
    return (
      (code.length === 6 && code >= 'Digit0' && code <= 'Digit9') ||
      (code.length === 7 && code >= 'Numpad0' && code <= 'Numpad9')
    );
  }

  function getShapeCharFromEvent(e) {
    if (isLetterKey(e.code)) return e.key.toUpperCase();
    if (isDigitKey(e.code)) return e.code.slice(-1);
    if (/^[0-9]$/.test(e.key)) return e.key;
    return '';
  }

  function isShapeKeyEvent(e) {
    return isLetterKey(e.code) || isDigitKey(e.code) || /^[0-9]$/.test(e.key);
  }

  function isMatchingFormationKey(e) {
    if (!formationMode) return false;
    if (e.code === formationMode.keyCode) return true;
    if (formationMode.type === 'heart' && e.code === 'Space') return true;
    const char = getShapeCharFromEvent(e);
    return !!(char && formationMode.char === char);
  }

  function getFormationKeyCode(e, char) {
    if (isLetterKey(e.code) || isDigitKey(e.code)) return e.code;
    if (/^[0-9]$/.test(char)) return `Digit${char}`;
    return e.code;
  }

  function bindUiSounds() {
    if (!window.RomanceAudio) return;
    document.querySelectorAll(
      '.top-controls button:not([data-sound-toggle]), .intro-skip, .photo-manage-close, .rules-close'
    ).forEach((btn) => {
      btn.addEventListener('click', () => window.RomanceAudio.playUiClick(), { capture: true });
    });
  }

  function bindInput() {
    document.addEventListener('mousemove', (e) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
      updateRulesBubble(e.clientX, e.clientY);
    });

    document.addEventListener('touchmove', (e) => {
      if (e.touches.length) {
        mouseX = e.touches[0].clientX;
        mouseY = e.touches[0].clientY;
      }
    }, { passive: true });

    document.addEventListener('touchstart', (e) => {
      if (e.touches.length) {
        mouseX = e.touches[0].clientX;
        mouseY = e.touches[0].clientY;
      }
    }, { passive: true });

    window.addEventListener('keydown', (e) => {
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
        highRegularMode = true;
        if (isFormationActive()) prepareFormation();
        return;
      }

      const arrowDir = ARROW_DIRECTIONS[e.code];
      if (arrowDir) {
        e.preventDefault();
        beginShockwaveHold(arrowDir);
        return;
      }

      if (e.repeat) return;

      if (e.code === 'Space') {
        e.preventDefault();
        setFormationMode({ type: 'heart', keyCode: 'Space' });
        return;
      }

      if (isShapeKeyEvent(e)) {
        e.preventDefault();
        if (e.repeat) return;
        const char = getShapeCharFromEvent(e);
        if (!char) return;
        setFormationMode({
          type: 'letter',
          char,
          keyCode: getFormationKeyCode(e, char),
        });
      }
    });

    window.addEventListener('keyup', (e) => {
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
        highRegularMode = false;
        if (isFormationActive()) prepareFormation();
        return;
      }

      const arrowDir = ARROW_DIRECTIONS[e.code];
      if (arrowDir) {
        e.preventDefault();
        if (shockwaveHoldDir === arrowDir) endShockwaveHold();
        return;
      }

      if (!isMatchingFormationKey(e)) return;
      e.preventDefault();
      exitFormationMode();
    });

    window.addEventListener('blur', () => {
      if (formationMode) exitFormationMode();
      endShockwaveHold();
    });

    document.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      if (!isFormationActive() || formationBursting) return;
      if (
        e.target.closest(
          '.top-controls, .rules-modal, .photo-manage-modal, .intro-overlay, .btn-add-photo, .btn-remove-photo, .btn-rules'
        )
      ) {
        return;
      }
      explodeFormationShape(e.clientX, e.clientY);
    });
  }

  function onResize() {
    resizeTrailCanvas();
    const baseSize = getBaseSize();
    photos.forEach((p) => {
      p.size = baseSize;
      p.radius = baseSize / 2;
      p.mass = p.radius * p.radius;
      p.invMass = 1 / p.mass;
    });
    if (formationMode) prepareFormation();
  }

  async function loadAndSpawn(records) {
    records.forEach((record, i) => {
      photos.push(createPhoto(record, i, records.length));
    });
  }

  async function handleAddPhotos(fileList) {
    const files = Array.from(fileList).filter((f) => f.type.startsWith('image/'));
    if (!files.length) return;

    try {
      const added = await appendPhotos(files);
      const startIdx = photos.filter((p) => !p.isClone).length;
      added.forEach((record, i) => {
        const photo = createPhoto(record, startIdx + i, startIdx + added.length);
        photo.vx = (Math.random() - 0.5) * 100;
        photo.vy = -80 - Math.random() * 50;
        photos.push(photo);
      });

      if (!introDone && photos.length && !reducedMotion) {
        setTimeout(dismissIntro, 2800);
      }
      if (window.RomanceAudio) window.RomanceAudio.playUploadAdd();
    } catch (err) {
      console.error(err);
      alert('添加失败，请重试');
    }

    addPhotoInput.value = '';
  }

  addPhotoBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    addPhotoInput.click();
  });

  if (removePhotoBtn) {
    removePhotoBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      openPhotoManageModal();
    });
  }

  if (photoManageClose) {
    photoManageClose.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      closePhotoManageModal();
    });
  }

  if (photoManageModal) {
    photoManageModal.addEventListener('click', (e) => {
      if (e.target === photoManageModal) closePhotoManageModal();
    });
  }

  if (rulesBtn) {
    rulesBtn.addEventListener('mouseenter', () => {
      rulesBubbleLocked = true;
      if (rulesBubble) rulesBubble.classList.add('show');
    });
    rulesBtn.addEventListener('mouseleave', () => {
      rulesBubbleLocked = false;
      if (rulesBubble) rulesBubble.classList.remove('show');
    });
    rulesBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      openRulesModal();
    });
  }

  if (rulesCloseBtn) {
    rulesCloseBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      closeRulesModal();
    });
  }
  if (rulesModal) {
    rulesModal.addEventListener('click', (e) => {
      if (e.target === rulesModal) closeRulesModal();
    });
  }
  window.addEventListener('keydown', (e) => {
    if (e.code !== 'Escape') return;
    if (photoManageModal && !photoManageModal.hidden) {
      closePhotoManageModal();
      return;
    }
    if (rulesModal && !rulesModal.hidden) {
      closeRulesModal();
    }
  });
  addPhotoInput.addEventListener('change', () => {
    if (addPhotoInput.files.length) handleAddPhotos(addPhotoInput.files);
  });

  async function init() {
    bindInput();
    bindUiSounds();
    resizeTrailCanvas();
    startPhysics();
    window.addEventListener('resize', onResize);

    let records = [];
    try {
      records = await loadPhotos();
    } catch (err) {
      console.error(err);
    }

    if (records.length) {
      await loadAndSpawn(records);
      if (!reducedMotion) setTimeout(dismissIntro, 2800);
      else dismissIntro();
    } else {
      introOverlay.hidden = true;
      introDone = true;
    }
  }

  window.addEventListener('beforeunload', () => {
    objectUrls.forEach((u) => URL.revokeObjectURL(u));
    if (animId) cancelAnimationFrame(animId);
  });

  init();
})();
