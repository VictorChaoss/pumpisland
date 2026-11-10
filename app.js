/**
 * PUMP ISLAND ($ISLAND) — Territory of pump.fun
 * Coordinates: -20.65467647964946, -178.734236 (20.65468° S · 178.73424° W)
 *
 * Unified Architecture:
 * 1. SPY / Champions League Intro Gate with the live 3D WebGL Earth centered inside
 *    the holographic rings (#logo-stage) + 3D Warp Starfield (#intro-canvas).
 * 2. Clicking "ENTER PUMP ISLAND" warps the gate away and continuously zooms that
 *    exact 3D Earth from space (z=1.5) straight into Pump Island (z=18.4).
 * 3. Interactive Satellite Recon Map & One-Click Promo Video Recorder (.WEBM).
 */

// ============================================================================
// INSTANT CA LAUNCH SWITCH — Replace this single string when the CA goes live:
// ============================================================================
const LIVE_CONTRACT_ADDRESS = 'TBA — LAUNCHING EXCLUSIVELY ON PUMP.FUN';

const ISLAND_COORDS = {
  lat: -20.65467647964946,
  lng: -178.734236,
  latText: '20.65468° S',
  lngText: '178.73424° W',
  myMapsUrl: 'https://www.google.com/maps/d/u/0/viewer?mid=16W_3vvPS2rPOh-TGLrn4YNqNw9S54kA&ll=-20.65467647964946,-178.734236&z=18'
};

// Preload brand assets for zero-latency, taint-free Canvas rendering
const inlineAssets = window.PUMP_ISLAND_ASSETS || {};
const brandAssets = {
  logo: new Image(),
  banner: new Image(),
  mymaps: new Image(),
  transparentLogoDataUrl: null
};
brandAssets.logo.src = inlineAssets.logo || 'assets/logo.jpg';
brandAssets.banner.src = inlineAssets.banner || 'assets/banner.jpg';
brandAssets.mymaps.src = inlineAssets.mymaps || 'assets/mymaps-preview.png';

// Automatically remove the dark #04242c background from brandAssets.logo so the
// floating Wave-Pill crest on the 3D Earth has a clean transparent background
function createTransparentWavePillLogo(img) {
  try {
    const c = document.createElement('canvas');
    const w = img.naturalWidth || 512;
    const h = img.naturalHeight || 512;
    c.width = w;
    c.height = h;
    const ctx = c.getContext('2d');
    ctx.drawImage(img, 0, 0, w, h);

    const imgData = ctx.getImageData(0, 0, w, h);
    const d = imgData.data;
    const bgR = d[0];
    const bgG = d[1];
    const bgB = d[2];

    for (let i = 0; i < d.length; i += 4) {
      const r = d[i];
      const g = d[i + 1];
      const b = d[i + 2];
      const dr = r - bgR;
      const dg = g - bgG;
      const db = b - bgB;
      const dist = Math.sqrt(dr * dr + dg * dg + db * db);

      if (dist < 22) {
        d[i + 3] = 0;
      } else if (dist < 62) {
        d[i + 3] = Math.round(((dist - 22) / 40) * 255);
      }
    }
    ctx.putImageData(imgData, 0, 0);
    return c.toDataURL('image/png');
  } catch {
    return img.src;
  }
}

brandAssets.logo.addEventListener('load', () => {
  const transparentUrl = createTransparentWavePillLogo(brandAssets.logo);
  brandAssets.transparentLogoDataUrl = transparentUrl;
  const frontEl = document.getElementById('intro-logo-front');
  if (frontEl) frontEl.src = transparentUrl;
});

// Helper to convert lat/lng to XYZ tile coordinates
function latLngToTileXY(lat, lng, z) {
  const n = Math.pow(2, z);
  const x = ((lng + 180) / 360) * n;
  const latRad = (lat * Math.PI) / 180;
  const y = ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n;
  return { x, y, tx: Math.floor(x), ty: Math.floor(y), fx: x - Math.floor(x), fy: y - Math.floor(y) };
}

// Pre-warm the exact Google Satellite & Esri World Imagery tile pyramid from z=2 to z=19
const satTileCache = new Map();
function prewarmDiveTilePyramid() {
  for (let z = 2; z <= 19; z++) {
    const center = latLngToTileXY(ISLAND_COORDS.lat, ISLAND_COORDS.lng, z);
    const radius = z >= 15 ? 2 : 1;
    for (let dx = -radius; dx <= radius; dx++) {
      for (let dy = -radius; dy <= radius; dy++) {
        const tx = (center.tx + dx + (1 << z)) % (1 << z);
        const ty = center.ty + dy;
        if (ty < 0 || ty >= (1 << z)) continue;

        const gImg = new Image();
        gImg.crossOrigin = 'anonymous';
        gImg.src = `https://mt1.google.com/vt/lyrs=s&x=${tx}&y=${ty}&z=${z}`;

        const key = `${z}/${tx}/${ty}`;
        if (!satTileCache.has(key)) {
          const eImg = new Image();
          eImg.crossOrigin = 'anonymous';
          eImg.src = `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${ty}/${tx}`;
          satTileCache.set(key, eImg);
        }
      }
    }
  }
}
prewarmDiveTilePyramid();

/* =========================================================================
   1. WEB AUDIO SYNTHESIZER (Intro Warp + Satellite Lock + Lagoon Chime)
   ========================================================================= */
class SoundEngine {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.streamDest = null;
    this.masterGain = null;
  }

  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    this.ctx = new AudioCtx();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = this.enabled ? 0.45 : 0;
    this.masterGain.connect(this.ctx.destination);

    if (this.ctx.createMediaStreamDestination) {
      this.streamDest = this.ctx.createMediaStreamDestination();
      this.masterGain.connect(this.streamDest);
    }
  }

  toggle() {
    this.init();
    this.enabled = !this.enabled;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(this.enabled ? 0.45 : 0, this.ctx.currentTime, 0.05);
    }
    const dot = document.getElementById('audioDot');
    const label = document.getElementById('audioLabel');
    const introSfxBtn = document.getElementById('intro-sfx-btn');
    if (dot && label) {
      dot.classList.toggle('muted', !this.enabled);
      label.textContent = this.enabled ? 'SFX: ON' : 'SFX: MUTED';
    }
    if (introSfxBtn) {
      introSfxBtn.textContent = this.enabled ? '🔊 ISLAND SFX : ON' : '🔇 ISLAND SFX : MUTED';
    }
    if (this.enabled) this.playBeep(880, 0.08);
  }

  playHoverSound() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(520, now);
    osc.frequency.exponentialRampToValueAtTime(880, now + 0.08);
    gain.gain.setValueAtTime(0.06, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.09);
  }

  playWarpSound() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    const osc1 = this.ctx.createOscillator();
    const gain1 = this.ctx.createGain();
    osc1.type = 'sawtooth';
    osc1.frequency.setValueAtTime(90, now);
    osc1.frequency.exponentialRampToValueAtTime(640, now + 0.85);
    gain1.gain.setValueAtTime(0.11, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.9);

    const osc2 = this.ctx.createOscillator();
    const gain2 = this.ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(150, now);
    osc2.frequency.exponentialRampToValueAtTime(40, now + 0.8);
    gain2.gain.setValueAtTime(0.22, now);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.85);

    osc1.connect(gain1);
    gain1.connect(this.masterGain);
    osc2.connect(gain2);
    gain2.connect(this.masterGain);

    osc1.start(now);
    osc1.stop(now + 0.9);
    osc2.start(now);
    osc2.stop(now + 0.85);
  }

  playBeep(freq = 1040, duration = 0.09, type = 'sine') {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + duration);
  }

  playZoomSequenceSFX() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    // 1. Orbital telemetry lock beeps
    [0, 0.25, 0.5, 1.0, 1.6, 2.2].forEach((offset, idx) => {
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(580 + idx * 115, now + offset);
      g.gain.setValueAtTime(0.13, now + offset);
      g.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.11);
      osc.connect(g);
      g.connect(this.masterGain);
      osc.start(now + offset);
      osc.stop(now + offset + 0.12);
    });

    // 2. Deep atmospheric entry & cloud breakthrough whoosh
    const bufferSize = this.ctx.sampleRate * 5.8;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }
    const whiteNoise = this.ctx.createBufferSource();
    whiteNoise.buffer = noiseBuffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(140, now + 1.1);
    filter.frequency.exponentialRampToValueAtTime(1900, now + 3.8);
    filter.frequency.exponentialRampToValueAtTime(240, now + 6.4);
    filter.Q.value = 2.0;

    const whooshGain = this.ctx.createGain();
    whooshGain.gain.setValueAtTime(0.001, now + 1.0);
    whooshGain.gain.linearRampToValueAtTime(0.28, now + 3.6);
    whooshGain.gain.exponentialRampToValueAtTime(0.004, now + 6.6);

    whiteNoise.connect(filter);
    filter.connect(whooshGain);
    whooshGain.connect(this.masterGain);
    whiteNoise.start(now + 1.0);
    whiteNoise.stop(now + 6.7);

    // 3. Sonar Pin Lock Chime + Emerald Lagoon Chord at z=18 arrival (~6.7s)
    const chordTimes = [6.6, 6.75, 6.9, 7.05];
    const chordFreqs = [523.25, 659.25, 783.99, 1046.5];
    chordFreqs.forEach((f, i) => {
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'sine';
      const t = now + chordTimes[i];
      osc.frequency.setValueAtTime(f, t);
      g.gain.setValueAtTime(0.15, t);
      g.gain.exponentialRampToValueAtTime(0.0008, t + 2.0);
      osc.connect(g);
      g.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + 2.05);
    });
  }
}

const sfx = new SoundEngine();

/* =========================================================================
   2. TRUE 3D SATELLITE GLOBE & UNIFIED INTRO GATE ENGINE (MapLibre GL v5)
   ========================================================================= */
class HeroGlobeController {
  constructor() {
    this.spaceCanvas = document.getElementById('intro-canvas');
    this.spaceCtx = this.spaceCanvas.getContext('2d');
    this.fxCanvas = document.getElementById('diveFxCanvas');
    this.fxCtx = this.fxCanvas.getContext('2d');
    this.mapContainer = document.getElementById('heroGlobeMap');
    this.stageContainer = document.getElementById('stageContainer');
    this.logoStage = document.getElementById('logo-stage');

    this.introScreen = document.getElementById('intro-screen');
    this.mainNavbar = document.getElementById('mainNavbar');
    this.diveHudLayer = document.getElementById('diveHudLayer');
    this.bottomCaBar = document.getElementById('bottomCaBar');
    this.mainSite = document.getElementById('main-site');

    this.reticleHud = document.getElementById('reticleHud');
    this.arrivedCard = document.getElementById('arrivedCard');

    this.state = 'ORBIT'; // 'ORBIT' | 'ZOOMING' | 'LOCKED'
    this.orbitSpinMode = '3d'; // '3d' | 'orbit' | 'pulse'
    this.userInteracting = false;
    this.zoomStartTime = 0;
    this.zoomDuration = 7400; // 7.4s continuous 3D Earth-to-Island dive
    this.orbitBaseZoom = 1.52;
    this.currentZoomLevel = this.orbitBaseZoom;
    this.orbitPadBottom = 0;
    this.orbitPadTop = 0;

    // 3D Warp Starfield particles (SPY / Champions League style)
    this.particles = [];
    this.baseWarpSpeed = 1.4;
    this.targetWarpSpeed = 1.4;
    this.mouseX = 0;
    this.mouseY = 0;
    this.islandColors = ['#3ef095', '#5fffad', '#f8ecd1', '#dfc07c', '#ffffff'];

    this.cloudPuffs = Array.from({ length: 28 }, (_, i) => ({
      angle: (i / 28) * Math.PI * 2 + Math.random() * 0.3,
      dist: 0.08 + (i % 5) * 0.14,
      size: 160 + (i % 4) * 90,
      zStart: 6.2 + (i % 6) * 0.7
    }));

    this.initWarpParticles();
    this.initMapLibreGlobe();
    this.resizeCanvases();
    this.bindEvents();
    this.renderMiniInset();

    this.animate = this.animate.bind(this);
    requestAnimationFrame(this.animate);
  }

  initWarpParticles() {
    const w = window.innerWidth || 1440;
    const h = window.innerHeight || 900;
    this.particles.length = 0;
    for (let i = 0; i < 240; i++) {
      const isStar = i % 5 === 0;
      const z = Math.random() * w;
      this.particles.push({
        x: (Math.random() - 0.5) * w * 2.1,
        y: (Math.random() - 0.5) * h * 2.1,
        z,
        pz: z,
        isStar,
        angle: Math.random() * Math.PI * 2,
        spinSpeed: (Math.random() - 0.5) * 0.03,
        color: this.islandColors[Math.floor(Math.random() * this.islandColors.length)],
        size: isStar ? Math.random() * 2.6 + 1.6 : Math.random() * 1.7 + 0.5
      });
    }
  }

  computeOrbitPadding() {
    if (!this.stageContainer || !this.logoStage) return { top: 0, bottom: 0 };
    const stageRect = this.stageContainer.getBoundingClientRect();
    const logoRect = this.logoStage.getBoundingClientRect();
    if (logoRect.height === 0 || stageRect.height === 0) {
      return { top: 0, bottom: Math.round(window.innerHeight * 0.22) };
    }
    const logoCenterY = (logoRect.top - stageRect.top) + logoRect.height / 2;
    const stageCenterY = stageRect.height / 2;
    const offset = stageCenterY - logoCenterY;

    if (offset >= 0) {
      return { top: 0, bottom: Math.round(offset * 2) };
    }
    return { top: Math.round(-offset * 2), bottom: 0 };
  }

  syncEarthInsideIntroRings() {
    if (!this.map || this.state !== 'ORBIT') return;
    const pad = this.computeOrbitPadding();
    this.orbitPadTop = pad.top;
    this.orbitPadBottom = pad.bottom;

    // Fit the 3D Earth sphere cleanly inside the holographic rings (#logo-stage)
    const minDim = Math.min(window.innerWidth, window.innerHeight);
    this.orbitBaseZoom = minDim < 640 ? 1.18 : 1.48;
    this.map.setPadding({ top: pad.top, bottom: pad.bottom, left: 0, right: 0 });
    this.map.setZoom(this.orbitBaseZoom);
  }

  initMapLibreGlobe() {
    const globeStyle = {
      version: 8,
      projection: {
        type: 'globe'
      },
      sky: {
        'atmosphere-blend': [
          'interpolate',
          ['linear'],
          ['zoom'],
          0, 0.88,
          5, 0.65,
          8, 0
        ]
      },
      sources: {
        esriWorld: {
          type: 'raster',
          tiles: [
            'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
          ],
          tileSize: 256,
          maxzoom: 18
        },
        googleMaxar: {
          type: 'raster',
          tiles: [
            'https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}'
          ],
          tileSize: 256,
          maxzoom: 20
        }
      },
      layers: [
        {
          id: 'esri-base-globe',
          type: 'raster',
          source: 'esriWorld',
          paint: {
            'raster-fade-duration': 0
          }
        },
        {
          id: 'google-maxar-detail',
          type: 'raster',
          source: 'googleMaxar',
          paint: {
            'raster-fade-duration': 150,
            'raster-opacity': [
              'interpolate',
              ['linear'],
              ['zoom'],
              1, 0.85,
              6, 1.0
            ]
          }
        }
      ]
    };

    this.map = new maplibregl.Map({
      container: this.mapContainer,
      style: globeStyle,
      center: [-165.0, -14.0],
      zoom: this.orbitBaseZoom,
      pitch: 0,
      bearing: 0,
      interactive: true,
      scrollZoom: false,
      attributionControl: false,
      canvasContextAttributes: {
        preserveDrawingBuffer: true,
        antialias: true
      }
    });

    this.map.on('style.load', () => {
      if (this.map.setProjection) {
        this.map.setProjection({ type: 'globe' });
      }
      this.syncEarthInsideIntroRings();
    });

    const pinEl = document.createElement('div');
    pinEl.className = 'hero-globe-pin';
    pinEl.innerHTML = `
      <div class="hero-pin-pulse-wrap">
        <div class="hero-pin-ring r1"></div>
        <div class="hero-pin-ring r2"></div>
        <div class="hero-pin-core">
          <img src="${brandAssets.logo.src}" alt="Pump Island" />
        </div>
      </div>
      <div class="hero-pin-tag" id="heroPinTag" style="opacity: 0; transition: opacity 0.35s ease;">PUMP ISLAND · 20.65468° S, 178.73424° W</div>
    `;

    this.islandMarker = new maplibregl.Marker({
      element: pinEl,
      anchor: 'center'
    })
      .setLngLat([ISLAND_COORDS.lng, ISLAND_COORDS.lat])
      .addTo(this.map);

    this.map.on('mousedown', () => { this.userInteracting = true; });
    this.map.on('touchstart', () => { this.userInteracting = true; });
    window.addEventListener('mouseup', () => { this.userInteracting = false; });
    window.addEventListener('touchend', () => { this.userInteracting = false; });
  }

  resizeCanvases() {
    const w = this.stageContainer ? this.stageContainer.clientWidth : window.innerWidth;
    const h = this.stageContainer ? this.stageContainer.clientHeight : window.innerHeight;
    this.spaceCanvas.width = w;
    this.spaceCanvas.height = h;
    this.fxCanvas.width = w;
    this.fxCanvas.height = h;
    if (this.map) {
      this.map.resize();
      if (this.state === 'ORBIT') {
        this.syncEarthInsideIntroRings();
      }
    }
  }

  renderMiniInset() {
    const insetCanvas = document.getElementById('miniInsetCanvas');
    if (!insetCanvas) return;
    const ctx = insetCanvas.getContext('2d');
    const drawInset = () => {
      const w = insetCanvas.width;
      const h = insetCanvas.height;
      ctx.fillStyle = '#04242c';
      ctx.fillRect(0, 0, w, h);
      if (brandAssets.mymaps.complete && brandAssets.mymaps.naturalWidth > 0) {
        ctx.drawImage(brandAssets.mymaps, 112, 280, 442, 442, 0, 0, w, h);
      }
      ctx.strokeStyle = '#3ef095';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(w / 2, h / 2, 18, 0, Math.PI * 2);
      ctx.stroke();
    };
    brandAssets.mymaps.addEventListener('load', drawInset);
    setTimeout(drawInset, 200);
  }

  bindEvents() {
    window.addEventListener('resize', () => this.resizeCanvases());

    const startBtns = [
      document.getElementById('triggerZoomBtn'),
      document.getElementById('quickJumpToIsland')
    ];
    startBtns.forEach((btn) => {
      if (btn) btn.addEventListener('click', () => this.startZoomSequence());
    });

    const replayDiveBtn = document.getElementById('replayZoomBtn');
    if (replayDiveBtn) {
      replayDiveBtn.addEventListener('click', () => {
        this.resetToOrbit(true);
      });
    }

    const returnToGateBtns = [
      document.getElementById('resetOrbitBtn'),
      document.getElementById('replay-intro-btn')
    ];
    returnToGateBtns.forEach((btn) => {
      if (btn) {
        btn.addEventListener('click', () => {
          this.returnToIntroGate();
        });
      }
    });
  }

  shortestLngDelta(fromLng, toLng) {
    return ((toLng - fromLng + 540) % 360) - 180;
  }

  // Triggered when clicking "ENTER PUMP ISLAND" on the Intro Gate or "REPLAY GLOBE ZOOM"
  startZoomSequence() {
    if (this.state === 'ZOOMING') return;
    if (this.state === 'LOCKED') {
      this.resetToOrbit(true);
      return;
    }

    // Transition UI from Intro Gate to Dive HUD while keeping the SAME 3D Earth on screen!
    if (this.introScreen) this.introScreen.classList.add('warp-exit');
    document.body.classList.remove('intro-locked');
    if (this.mainNavbar) this.mainNavbar.classList.remove('nav-hidden');
    if (this.diveHudLayer) this.diveHudLayer.classList.remove('hud-hidden');
    if (this.bottomCaBar) this.bottomCaBar.classList.remove('hud-hidden');
    if (this.mainSite) {
      this.mainSite.classList.remove('hidden');
      this.mainSite.setAttribute('aria-hidden', 'false');
    }

    this.targetWarpSpeed = 24;
    sfx.playWarpSound();
    sfx.playZoomSequenceSFX();

    this.state = 'ZOOMING';
    this.zoomStartTime = performance.now();

    const currentCenter = this.map.getCenter();
    this.startLng = currentCenter.lng;
    this.startLat = currentCenter.lat;
    this.startZoom = this.map.getZoom();
    this.lngDelta = this.shortestLngDelta(this.startLng, ISLAND_COORDS.lng);

    if (Math.abs(this.lngDelta) < 35) {
      this.startLng = ISLAND_COORDS.lng + 85;
      this.lngDelta = -85;
    }

    this.arrivedCard.classList.remove('visible');
    this.reticleHud.classList.add('active');

    const triggerLabel = document.getElementById('triggerZoomLabel');
    if (triggerLabel) triggerLabel.textContent = 'DIVING TO z=18.4...';
  }

  resetToOrbit(autoReplay = false) {
    sfx.playBeep(660, 0.08);
    this.state = 'ORBIT';
    this.targetWarpSpeed = 1.4;
    this.reticleHud.classList.remove('active');
    this.arrivedCard.classList.remove('visible');

    const pinTag = document.getElementById('heroPinTag');
    if (pinTag) pinTag.style.opacity = '0';

    if (autoReplay) {
      // Quick orbital reset before re-diving into the island
      this.map.setPadding({ top: 0, bottom: 0, left: 0, right: 0 });
      this.orbitPadTop = 0;
      this.orbitPadBottom = 0;
      this.map.jumpTo({
        center: [-115.0, -12.0],
        zoom: 1.65,
        pitch: 0,
        bearing: 0
      });
      setTimeout(() => this.startZoomSequence(), 120);
    } else {
      this.returnToIntroGate();
    }
  }

  returnToIntroGate() {
    sfx.playHoverSound();
    this.state = 'ORBIT';
    this.targetWarpSpeed = 1.4;
    this.reticleHud.classList.remove('active');
    this.arrivedCard.classList.remove('visible');

    const pinTag = document.getElementById('heroPinTag');
    if (pinTag) pinTag.style.opacity = '0';

    if (this.introScreen) this.introScreen.classList.remove('warp-exit');
    document.body.classList.add('intro-locked');
    if (this.mainNavbar) this.mainNavbar.classList.add('nav-hidden');
    if (this.diveHudLayer) this.diveHudLayer.classList.add('hud-hidden');
    if (this.bottomCaBar) this.bottomCaBar.classList.add('hud-hidden');
    if (this.mainSite) {
      this.mainSite.classList.add('hidden');
      this.mainSite.setAttribute('aria-hidden', 'true');
    }

    const hudStatusText = document.getElementById('hud-status-text');
    if (hudStatusText) {
      hudStatusText.textContent = 'ORBITAL SATELLITE CORE : LOCKED ON ONO-I-LAU';
    }

    window.scrollTo({ top: 0, behavior: 'instant' });

    requestAnimationFrame(() => {
      this.syncEarthInsideIntroRings();
      this.map.jumpTo({
        center: [-165.0, -14.0],
        zoom: this.orbitBaseZoom,
        pitch: 0,
        bearing: 0
      });
    });
  }

  updateTelemetryHUD(zoom, altitudeKm, phaseText) {
    const altEl = document.getElementById('hudAltitude');
    const zoomEl = document.getElementById('hudZoom');
    const barEl = document.getElementById('hudZoomBar');
    const phaseEl = document.getElementById('hudPhaseBadge');
    const reticleText = document.getElementById('reticleReadout');
    const pinTag = document.getElementById('heroPinTag');

    if (pinTag) {
      pinTag.style.opacity = zoom >= 7.5 ? '1' : '0';
    }

    if (altEl) {
      altEl.textContent = altitudeKm >= 10
        ? `${Math.round(altitudeKm).toLocaleString()} KM`
        : `${Math.max(110, Math.round(altitudeKm * 1000))} M`;
    }
    if (zoomEl) zoomEl.textContent = `z=${zoom.toFixed(1)}`;
    if (barEl) barEl.style.width = `${Math.min(100, Math.max(6, ((zoom - 1.5) / 16.8) * 100))}%`;
    if (phaseEl) phaseEl.textContent = phaseText;
    if (reticleText) {
      if (zoom < 5.5) reticleText.textContent = 'ORBITAL SLEW // SOUTH PACIFIC';
      else if (zoom < 12.5) reticleText.textContent = 'CLOUD BREAKTHROUGH // LAU ARCHIPELAGO';
      else if (zoom < 16.8) reticleText.textContent = 'APPROACHING ONO-I-LAU CORAL LAGOON';
      else reticleText.textContent = 'LOCKED // PUMP ISLAND z=18.4';
    }
  }

  drawFivePointStar(ctx, cx, cy, outerRadius, rotation, color, alpha) {
    const innerRadius = outerRadius * 0.42;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rotation);
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const outerAngle = (i * 2 * Math.PI) / 5 - Math.PI / 2;
      const innerAngle = outerAngle + Math.PI / 5;
      if (i === 0) {
        ctx.moveTo(Math.cos(outerAngle) * outerRadius, Math.sin(outerAngle) * outerRadius);
      } else {
        ctx.lineTo(Math.cos(outerAngle) * outerRadius, Math.sin(outerAngle) * outerRadius);
      }
      ctx.lineTo(Math.cos(innerAngle) * innerRadius, Math.sin(innerAngle) * innerRadius);
    }
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.globalAlpha = alpha;
    ctx.shadowColor = color;
    ctx.shadowBlur = outerRadius * 1.5;
    ctx.fill();
    ctx.restore();
  }

  drawSpaceBackdrop(zoom) {
    const ctx = this.spaceCtx;
    const w = this.spaceCanvas.width;
    const h = this.spaceCanvas.height;

    if (zoom > 7.2) {
      ctx.clearRect(0, 0, w, h);
      return;
    }

    const spaceAlpha = Math.min(1, Math.max(0, (7.2 - zoom) / 2.2));
    this.baseWarpSpeed += (this.targetWarpSpeed - this.baseWarpSpeed) * 0.08;

    ctx.save();
    ctx.globalAlpha = spaceAlpha;

    // Deep space background + warp trail persistence
    ctx.fillStyle = this.state === 'ZOOMING' ? 'rgba(1, 10, 14, 0.28)' : 'rgba(1, 10, 14, 0.48)';
    ctx.fillRect(0, 0, w, h);

    // Center of the 3D Earth (accounts for vertical padding when inside #logo-stage)
    const earthCenterY = (this.orbitPadTop + (h - this.orbitPadBottom)) / 2;
    const cx = w / 2 + this.mouseX;
    const cy = (this.state === 'ORBIT' ? earthCenterY : h / 2) + this.mouseY;

    // Emerald atmospheric corona behind the 3D Earth
    const globeRadius = Math.min(w, h) * 0.19 * Math.pow(1.45, Math.max(0, zoom - 1.48));
    const haloGrad = ctx.createRadialGradient(
      w * 0.5,
      this.state === 'ORBIT' ? earthCenterY : h * 0.5,
      globeRadius * 0.65,
      w * 0.5,
      this.state === 'ORBIT' ? earthCenterY : h * 0.5,
      globeRadius * 1.65
    );
    haloGrad.addColorStop(0, 'rgba(62, 240, 149, 0.34)');
    haloGrad.addColorStop(0.5, 'rgba(30, 165, 145, 0.14)');
    haloGrad.addColorStop(1, 'transparent');
    ctx.fillStyle = haloGrad;
    ctx.beginPath();
    ctx.arc(w * 0.5, this.state === 'ORBIT' ? earthCenterY : h * 0.5, globeRadius * 1.65, 0, Math.PI * 2);
    ctx.fill();

    // 3D Warp Starfield particles
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      p.pz = p.z;
      p.z -= this.baseWarpSpeed * 3.8;
      p.angle += p.spinSpeed;

      if (p.z <= 1) {
        p.x = (Math.random() - 0.5) * w * 2.1;
        p.y = (Math.random() - 0.5) * h * 2.1;
        p.z = w;
        p.pz = p.z;
      }

      const sx = (p.x / p.z) * (w * 0.6) + cx;
      const sy = (p.y / p.z) * (h * 0.6) + cy;
      const px = (p.x / p.pz) * (w * 0.6) + cx;
      const py = (p.y / p.pz) * (h * 0.6) + cy;

      const depthRatio = 1 - p.z / w;
      const alpha = Math.min(1, depthRatio * 1.3) * spaceAlpha;
      const radius = Math.max(0.4, depthRatio * p.size * 2.0);

      ctx.beginPath();
      ctx.strokeStyle = p.color;
      ctx.globalAlpha = alpha;
      ctx.lineWidth = this.state === 'ZOOMING' ? radius * 1.4 : radius * 0.85;
      ctx.moveTo(px, py);
      ctx.lineTo(sx, sy);
      ctx.stroke();

      if (this.state !== 'ZOOMING' && alpha > 0.55) {
        if (p.isStar) {
          this.drawFivePointStar(ctx, sx, sy, radius, p.angle, p.color, alpha);
        } else {
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(sx, sy, radius * 0.7, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    ctx.restore();
  }

  drawAtmosphericDiveFX(zoom, timeSec) {
    const ctx = this.fxCtx;
    const w = this.fxCanvas.width;
    const h = this.fxCanvas.height;
    ctx.clearRect(0, 0, w, h);

    if (zoom > 5.8 && zoom < 14.2) {
      ctx.save();
      this.cloudPuffs.forEach((puff) => {
        const localProgress = (zoom - puff.zStart) / 3.2;
        if (localProgress <= 0 || localProgress >= 1) return;

        const scale = Math.pow(localProgress, 1.8) * 3.6;
        const alpha = Math.sin(localProgress * Math.PI) * 0.42;
        const distPx = (puff.dist + localProgress * 0.55) * Math.max(w, h);
        const cx = w * 0.5 + Math.cos(puff.angle) * distPx;
        const cy = h * 0.5 + Math.sin(puff.angle) * distPx;
        const r = puff.size * (0.6 + scale);

        const cloudGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
        cloudGrad.addColorStop(0, `rgba(238, 252, 250, ${alpha})`);
        cloudGrad.addColorStop(0.5, `rgba(180, 230, 225, ${alpha * 0.5})`);
        cloudGrad.addColorStop(1, 'transparent');

        ctx.fillStyle = cloudGrad;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.restore();
    }

    if (this.state === 'ZOOMING' && zoom > 4.2 && zoom < 16.5) {
      const streakAlpha = Math.sin(((zoom - 4.2) / 12.3) * Math.PI) * 0.25;
      ctx.save();
      ctx.strokeStyle = `rgba(62, 240, 149, ${streakAlpha})`;
      ctx.lineWidth = 1.2;
      for (let i = 0; i < 24; i++) {
        const angle = (i / 24) * Math.PI * 2 + timeSec * 0.2;
        const rInner = Math.min(w, h) * 0.26;
        const rOuter = Math.max(w, h) * 0.62;
        ctx.beginPath();
        ctx.moveTo(w / 2 + Math.cos(angle) * rInner, h / 2 + Math.sin(angle) * rInner);
        ctx.lineTo(w / 2 + Math.cos(angle) * rOuter, h / 2 + Math.sin(angle) * rOuter);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  computeCameraPoseAt(t) {
    const slewT = Math.min(1, t / 0.26);
    const slewEase = 1 - Math.pow(1 - slewT, 3.2);
    const lng = ((this.startLng + this.lngDelta * slewEase + 540) % 360) - 180;
    const lat = this.startLat + (ISLAND_COORDS.lat - this.startLat) * slewEase;

    let zoom;
    if (t < 0.22) {
      const p = t / 0.22;
      zoom = this.startZoom + (3.8 - this.startZoom) * (p * p);
    } else if (t < 0.86) {
      const p = (t - 0.22) / 0.64;
      const smoothP = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
      zoom = 3.8 + smoothP * 14.0;
    } else {
      const p = (t - 0.86) / 0.14;
      const easeOut = 1 - Math.pow(1 - p, 3);
      zoom = 17.8 + easeOut * 0.55;
    }

    let pitch = 0;
    let bearing = 0;
    if (t > 0.50) {
      const lagoonP = (t - 0.50) / 0.50;
      pitch = Math.sin(lagoonP * Math.PI * 0.78) * 48;
      bearing = -36 * Math.sin(lagoonP * Math.PI) - 6 * lagoonP;
    }

    return { lng, lat, zoom, pitch, bearing };
  }

  animate(now) {
    requestAnimationFrame(this.animate);
    const timeSec = now / 1000;

    if (this.state === 'ORBIT') {
      if (!this.userInteracting && this.map) {
        const c = this.map.getCenter();
        if (this.orbitSpinMode === '3d') {
          this.map.setCenter([c.lng - 0.18, -14.0]);
          this.map.setBearing(0);
        } else if (this.orbitSpinMode === 'orbit') {
          this.map.setCenter([c.lng - 0.26, -14.0 + Math.sin(timeSec * 1.4) * 14]);
          this.map.setBearing(Math.sin(timeSec * 0.9) * 18);
        } else if (this.orbitSpinMode === 'pulse') {
          // Smoothly lock the 3D Earth facing the South Pacific & Pump Island beacon
          const dLng = this.shortestLngDelta(c.lng, ISLAND_COORDS.lng);
          const dLat = ISLAND_COORDS.lat - c.lat;
          this.map.setCenter([c.lng + dLng * 0.08, c.lat + dLat * 0.08]);
          this.map.setBearing(0);
        }
      }
      this.currentZoomLevel = this.map ? this.map.getZoom() : this.orbitBaseZoom;
    } else if (this.state === 'ZOOMING') {
      const elapsed = now - this.zoomStartTime;
      const t = Math.min(1, elapsed / this.zoomDuration);

      // Smoothly interpolate camera padding from #logo-stage center to full-viewport center
      const padEase = Math.max(0, 1 - Math.min(1, t / 0.28));
      this.map.setPadding({
        top: Math.round(this.orbitPadTop * padEase),
        bottom: Math.round(this.orbitPadBottom * padEase),
        left: 0,
        right: 0
      });

      const pose = this.computeCameraPoseAt(t);
      this.currentZoomLevel = pose.zoom;

      this.map.jumpTo({
        center: [pose.lng, pose.lat],
        zoom: pose.zoom,
        pitch: pose.pitch,
        bearing: pose.bearing
      });

      const altitudeKm = 35786 * Math.pow(0.000007, t);
      let phaseStr = 'PHASE 02 // ORBITAL SLEW & TARGET LOCK';
      if (t >= 0.24 && t < 0.60) phaseStr = 'PHASE 03 // STRATOSPHERIC CLOUD DIVE';
      else if (t >= 0.60 && t < 0.88) phaseStr = 'PHASE 04 // ONO-I-LAU LAGOON GLIDE';
      else if (t >= 0.88) phaseStr = 'PHASE 05 // z=18.4 ISLAND PIN LOCKED';

      this.updateTelemetryHUD(pose.zoom, altitudeKm, phaseStr);

      if (t >= 1) {
        this.state = 'LOCKED';
        this.targetWarpSpeed = 1.4;
        this.reticleHud.classList.remove('active');
        this.arrivedCard.classList.add('visible');
        this.updateTelemetryHUD(18.35, 0.24, 'LOCKED // TERRITORY OF PUMP.FUN (z=18.4)');
        const triggerLabel = document.getElementById('triggerZoomLabel');
        if (triggerLabel) triggerLabel.textContent = 'REPLAY GLOBE ZOOM';
      }
    } else if (this.state === 'LOCKED') {
      if (!this.userInteracting && this.map) {
        this.map.setBearing((this.map.getBearing() + 0.06) % 360);
      }
      this.currentZoomLevel = this.map ? this.map.getZoom() : 18.35;
    }

    this.drawSpaceBackdrop(this.currentZoomLevel);
    this.drawAtmosphericDiveFX(this.currentZoomLevel, timeSec);
  }
}

/* =========================================================================
   3. INTRO GATE HUD INTERACTIONS (TILT, TELEMETRY CLOCK, SPIN CHIPS, ENTER)
   ========================================================================= */
function initIntroGate(heroController) {
  const introScreen = document.getElementById('intro-screen');
  const enterBtn = document.getElementById('enter-btn');
  const logoStage = document.getElementById('logo-stage');
  const hudTelemetry = document.getElementById('hud-telemetry');
  const hudStatusText = document.getElementById('hud-status-text');
  const spinChips = document.querySelectorAll('.hud-chip');
  const introSfxBtn = document.getElementById('intro-sfx-btn');

  if (!introScreen) return;

  function handlePointerTilt(clientX, clientY) {
    const w = window.innerWidth || 1440;
    const h = window.innerHeight || 900;
    const normX = (clientX / w - 0.5) * 2;
    const normY = (clientY / h - 0.5) * 2;
    heroController.mouseX = normX * 32;
    heroController.mouseY = normY * 32;

    if (heroController.state === 'ORBIT' && logoStage) {
      const tiltX = -normY * 11;
      const tiltY = normX * 11;
      logoStage.style.transform = `rotateX(${tiltX.toFixed(2)}deg) rotateY(${tiltY.toFixed(2)}deg)`;
    }
  }

  window.addEventListener('mousemove', (e) => {
    if (!introScreen.classList.contains('warp-exit')) {
      handlePointerTilt(e.clientX, e.clientY);
    }
  });

  window.addEventListener(
    'touchmove',
    (e) => {
      if (e.touches && e.touches[0] && !introScreen.classList.contains('warp-exit')) {
        handlePointerTilt(e.touches[0].clientX, e.touches[0].clientY);
      }
    },
    { passive: true }
  );

  // Live Millisecond Telemetry Clock
  function updateTelemetryClock() {
    if (!hudTelemetry) return;
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    const ss = String(now.getSeconds()).padStart(2, '0');
    const ms = String(Math.floor(now.getMilliseconds() / 10)).padStart(2, '0');
    hudTelemetry.textContent = `${hh}:${mm}:${ss}.${ms} // SYNC 100%`;
  }
  setInterval(updateTelemetryClock, 75);
  updateTelemetryClock();

  // 3D Earth Orbit Mode Switcher in Bottom HUD
  spinChips.forEach((chip) => {
    chip.addEventListener('click', () => {
      sfx.playHoverSound();
      spinChips.forEach((c) => c.classList.remove('active'));
      chip.classList.add('active');

      const mode = chip.dataset.spin || '3d';
      heroController.orbitSpinMode = mode;

      if (mode === 'orbit') {
        hudStatusText.textContent = 'GYRO ORBITAL MATRIX : ENGAGED';
      } else if (mode === 'pulse') {
        hudStatusText.textContent = 'SOUTH PACIFIC SECTOR : LOCKED ON ONO-I-LAU';
      } else {
        hudStatusText.textContent = 'ORBITAL SATELLITE CORE : LOCKED ON ONO-I-LAU';
      }
    });
  });

  if (introSfxBtn) {
    introSfxBtn.addEventListener('click', () => sfx.toggle());
  }

  if (enterBtn) {
    enterBtn.addEventListener('mouseenter', () => {
      if (heroController.state === 'ORBIT') {
        heroController.targetWarpSpeed = 5.4;
        sfx.playHoverSound();
        hudStatusText.textContent = 'COORDINATES VERIFIED // READY TO DIVE INTO PUMP ISLAND';
      }
    });

    enterBtn.addEventListener('mouseleave', () => {
      if (heroController.state === 'ORBIT') {
        heroController.targetWarpSpeed = 1.4;
        hudStatusText.textContent = 'ORBITAL SATELLITE CORE : LOCKED ON ONO-I-LAU';
      }
    });

    enterBtn.addEventListener('click', () => {
      if (heroController.state !== 'ORBIT') return;
      heroController.startZoomSequence();
    });
  }

  // Smooth scroll to #lore when clicking "READ THE THESIS ↓" or navbar link
  document.querySelectorAll('a[href="#lore"]').forEach((link) => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      sfx.playHoverSound();
      const loreSection = document.getElementById('lore');
      if (loreSection) {
        loreSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && heroController.state === 'ORBIT' && !introScreen.classList.contains('warp-exit')) {
      heroController.startZoomSequence();
    }
  });
}

/* =========================================================================
   4. INTERACTIVE SATELLITE RECONNAISSANCE MAP (Leaflet + Google My Maps)
   ========================================================================= */
function initReconMap() {
  const mapEl = document.getElementById('leafletReconMap');
  if (!mapEl || typeof L === 'undefined') return;

  const map = L.map(mapEl, {
    center: [ISLAND_COORDS.lat, ISLAND_COORDS.lng],
    zoom: 18,
    maxZoom: 20,
    minZoom: 3,
    zoomControl: true
  });

  const googleSatLayer = L.tileLayer('https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', {
    maxZoom: 20,
    attribution: 'Imagery ©2026 Airbus, Maxar Technologies · Territory of pump.fun'
  });

  const esriSatLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    maxZoom: 19,
    attribution: 'Imagery © 2026 Esri & Maxar · Ono-i-Lau'
  });

  googleSatLayer.addTo(map);

  const customIcon = L.divIcon({
    className: 'pump-island-marker-wrap',
    html: `
      <div class="pump-island-marker">
        <div class="marker-Core">
          <img src="${brandAssets.logo.src}" alt="Pump Island Pin" />
        </div>
        <div class="marker-Label">PUMP ISLAND</div>
      </div>
    `,
    iconSize: [120, 74],
    iconAnchor: [60, 37]
  });

  const marker = L.marker([ISLAND_COORDS.lat, ISLAND_COORDS.lng], { icon: customIcon }).addTo(map);
  marker.bindPopup(`
    <div style="font-family: 'JetBrains Mono', monospace; color: #04242c; padding: 4px;">
      <strong style="font-size: 13px;">PUMP ISLAND</strong><br/>
      <span>Territory of pump.fun</span><br/>
      <code style="font-size: 11px;">-20.654676, -178.734236 (z=18)</code>
    </div>
  `);

  const coordReadout = document.getElementById('reconCursorCoords');
  map.on('mousemove', (e) => {
    if (coordReadout) {
      coordReadout.textContent = `LAT: ${e.latlng.lat.toFixed(6)} · LNG: ${e.latlng.lng.toFixed(6)} (z=${map.getZoom()})`;
    }
  });
  map.on('zoomend', () => {
    if (coordReadout) {
      coordReadout.textContent = `PIN: ${ISLAND_COORDS.lat.toFixed(6)}, ${ISLAND_COORDS.lng.toFixed(6)} (z=${map.getZoom()})`;
    }
  });

  const tabs = document.querySelectorAll('.recon-tab');
  const iframeEl = document.getElementById('googleMyMapsIframe');
  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      sfx.playBeep(920, 0.06);
      tabs.forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');
      const mode = tab.getAttribute('data-mapmode');

      if (mode === 'mymaps-embed') {
        mapEl.classList.add('hidden');
        iframeEl.classList.remove('hidden');
      } else {
        iframeEl.classList.add('hidden');
        mapEl.classList.remove('hidden');
        map.invalidateSize();
        if (mode === 'google-sat') {
          if (map.hasLayer(esriSatLayer)) map.removeLayer(esriSatLayer);
          if (!map.hasLayer(googleSatLayer)) googleSatLayer.addTo(map);
        } else {
          if (map.hasLayer(googleSatLayer)) map.removeLayer(googleSatLayer);
          if (!map.hasLayer(esriSatLayer)) esriSatLayer.addTo(map);
        }
      }
    });
  });

  const presetBtns = document.querySelectorAll('.preset-zoom-btn');
  presetBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      sfx.playBeep(780, 0.08);
      presetBtns.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      const targetZ = parseInt(btn.getAttribute('data-z'), 10);

      iframeEl.classList.add('hidden');
      mapEl.classList.remove('hidden');
      map.invalidateSize();
      map.flyTo([ISLAND_COORDS.lat, ISLAND_COORDS.lng], targetZ, {
        animate: true,
        duration: 1.6
      });
    });
  });
}

/* =========================================================================
   5. PROMO VIDEO STUDIO & ONE-CLICK .WEBM RECORDER
   ========================================================================= */
function initPromoStudio(heroController) {
  const modal = document.getElementById('studioModal');
  const openBtn = document.getElementById('openStudioBtn');
  const closeBtn = document.getElementById('closeStudioBtn');
  const backdrop = document.getElementById('closeStudioBackdrop');
  const playBtn = document.getElementById('studioPlayBtn');
  const recordBtn = document.getElementById('studioRecordBtn');
  const statusText = document.getElementById('studioStatusText');
  const downloadLink = document.getElementById('studioDownloadLink');
  const recDot = document.getElementById('studioRecDot');
  const studioCanvas = document.getElementById('studioCompositeCanvas');
  if (!studioCanvas || !modal) return;

  const ctx = studioCanvas.getContext('2d');
  let studioAnimId = null;
  let studioPlaying = false;
  let studioStartTime = 0;
  const studioDuration = 8400;
  let mediaRecorder = null;
  let recordedChunks = [];

  const aspectBtns = document.querySelectorAll('.aspect-btn');
  aspectBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      aspectBtns.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      const aspect = btn.getAttribute('data-aspect');
      if (aspect === '9:16') {
        studioCanvas.width = 720;
        studioCanvas.height = 1280;
      } else if (aspect === '1:1') {
        studioCanvas.width = 1080;
        studioCanvas.height = 1080;
      } else {
        studioCanvas.width = 1280;
        studioCanvas.height = 720;
      }
      renderStudioFrame(0);
    });
  });

  function renderStudioFrame(progress) {
    const w = studioCanvas.width;
    const h = studioCanvas.height;

    heroController.startLng = ISLAND_COORDS.lng + 95;
    heroController.startLat = -8.0;
    heroController.startZoom = 1.65;
    heroController.lngDelta = -95;

    const flightProgress = Math.min(1, progress / 0.86);
    const pose = heroController.computeCameraPoseAt(flightProgress);
    heroController.map.setPadding({ top: 0, bottom: 0, left: 0, right: 0 });
    heroController.map.jumpTo({
      center: [pose.lng, pose.lat],
      zoom: pose.zoom,
      pitch: pose.pitch,
      bearing: pose.bearing
    });

    ctx.fillStyle = '#021217';
    ctx.fillRect(0, 0, w, h);
    const spaceSrc = heroController.spaceCanvas;
    if (spaceSrc.width > 0) {
      ctx.drawImage(spaceSrc, 0, 0, w, h);
    }

    const glCanvas = heroController.map.getCanvas();
    if (glCanvas && glCanvas.width > 0) {
      const scale = Math.max(w / glCanvas.width, h / glCanvas.height);
      const dw = glCanvas.width * scale;
      const dh = glCanvas.height * scale;
      ctx.drawImage(glCanvas, (w - dw) / 2, (h - dh) / 2, dw, dh);
    }

    if (pose.zoom >= 15.5) {
      const lockAlpha = Math.min(1, (pose.zoom - 15.5) / 2.2);
      const timeSec = performance.now() / 1000;
      ctx.save();
      for (let rIdx = 0; rIdx < 3; rIdx++) {
        const phase = (timeSec * 0.85 + rIdx * 0.33) % 1;
        const radius = 26 + phase * 150;
        ctx.strokeStyle = `rgba(62, 240, 149, ${(1 - phase) * 0.8 * lockAlpha})`;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(w / 2, h / 2, radius, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    }

    if (progress > 0.82 && brandAssets.banner.complete) {
      const bannerAlpha = Math.min(1, (progress - 0.82) / 0.1);
      ctx.save();
      ctx.globalAlpha = bannerAlpha;
      const bannerW = Math.min(w * 0.88, 880);
      const bannerH = bannerW * (340 / 1024);
      const bx = (w - bannerW) / 2;
      const by = h - bannerH - 36;
      ctx.shadowColor = 'rgba(0, 0, 0, 0.85)';
      ctx.shadowBlur = 32;
      ctx.drawImage(brandAssets.banner, bx, by, bannerW, bannerH);
      ctx.restore();
    }

    ctx.strokeStyle = '#b89a5a';
    ctx.lineWidth = 3;
    ctx.strokeRect(18, 18, w - 36, h - 36);

    ctx.fillStyle = 'rgba(3, 24, 31, 0.9)';
    ctx.fillRect(34, 34, 415, 62);
    ctx.strokeStyle = '#3ef095';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(34, 34, 415, 62);

    if (brandAssets.logo.complete) {
      ctx.drawImage(brandAssets.logo, 44, 43, 44, 44);
    }
    ctx.fillStyle = '#f8ecd1';
    ctx.font = '900 19px "Outfit", sans-serif';
    ctx.fillText(`PUMP ISLAND // z=${pose.zoom.toFixed(1)}`, 98, 62);

    ctx.fillStyle = '#3ef095';
    ctx.font = '700 13px "JetBrains Mono", monospace';
    ctx.fillText('20.65468° S · 178.73424° W · TERRITORY OF PUMP.FUN', 98, 83);
  }

  function stepStudio(now) {
    if (!studioPlaying) return;
    const elapsed = now - studioStartTime;
    const progress = Math.min(1, elapsed / studioDuration);
    renderStudioFrame(progress);

    if (progress < 1) {
      studioAnimId = requestAnimationFrame(stepStudio);
    } else {
      studioPlaying = false;
      if (mediaRecorder && mediaRecorder.state === 'recording') {
        mediaRecorder.stop();
      } else {
        statusText.textContent = 'PREVIEW COMPLETE — Click "RECORD & DOWNLOAD (.WEBM)" to export video file.';
      }
    }
  }

  function startStudioSequence(isRecording = false) {
    if (studioAnimId) cancelAnimationFrame(studioAnimId);
    downloadLink.classList.add('hidden');
    studioPlaying = true;
    studioStartTime = performance.now();
    sfx.playZoomSequenceSFX();

    if (isRecording) {
      recordedChunks = [];
      recDot.classList.add('recording');
      statusText.textContent = '● RECORDING 60FPS 3D GLOBE PROMO VIDEO & AUDIO... (~8 SECONDS)';

      const canvasStream = studioCanvas.captureStream(60);
      if (sfx.streamDest) {
        const audioTracks = sfx.streamDest.stream.getAudioTracks();
        audioTracks.forEach((track) => canvasStream.addTrack(track));
      }

      const mimeTypes = [
        'video/webm;codecs=vp9,opus',
        'video/webm;codecs=vp8,opus',
        'video/webm'
      ];
      const supportedMime = mimeTypes.find((m) => MediaRecorder.isTypeSupported(m)) || '';

      mediaRecorder = new MediaRecorder(
        canvasStream,
        supportedMime ? { mimeType: supportedMime, videoBitsPerSecond: 8000000 } : {}
      );
      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) recordedChunks.push(e.data);
      };
      mediaRecorder.onstop = () => {
        recDot.classList.remove('recording');
        const blob = new Blob(recordedChunks, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        downloadLink.href = url;
        downloadLink.classList.remove('hidden');
        downloadLink.click();
        statusText.textContent = '✓ VIDEO EXPORT COMPLETE! Your .webm promo video has been downloaded.';
      };
      mediaRecorder.start();
    } else {
      statusText.textContent = '▶ PLAYING 3D SATELLITE GLOBE-TO-ISLAND SEQUENCE...';
    }

    studioAnimId = requestAnimationFrame(stepStudio);
  }

  if (openBtn) {
    openBtn.addEventListener('click', () => {
      modal.classList.remove('hidden');
      renderStudioFrame(0);
    });
  }

  const closeStudio = () => {
    studioPlaying = false;
    if (studioAnimId) cancelAnimationFrame(studioAnimId);
    if (mediaRecorder && mediaRecorder.state === 'recording') mediaRecorder.stop();
    modal.classList.add('hidden');
  };

  if (closeBtn) closeBtn.addEventListener('click', closeStudio);
  if (backdrop) backdrop.addEventListener('click', closeStudio);
  if (playBtn) playBtn.addEventListener('click', () => startStudioSequence(false));
  if (recordBtn) recordBtn.addEventListener('click', () => startStudioSequence(true));
}

/* =========================================================================
   6. CONTRACT ADDRESS BAR & INTRO CA BOX SYNC
   ========================================================================= */
function initContractAddressBar() {
  const copyBtn = document.getElementById('copyCaBtn');
  const caTextEl = document.getElementById('caText');
  const copyBadge = document.getElementById('copyBadge');
  const setCaBtn = document.getElementById('setCustomCaBtn');
  const pumpLink = document.getElementById('pumpFunLink');
  const dexLink = document.getElementById('dexLink');

  // Intro Gate CA elements
  const introCaValue = document.getElementById('intro-ca-value');
  const introCopyBtn = document.getElementById('intro-copy-ca-btn');
  const introCopyText = document.getElementById('intro-copy-ca-text');
  const introPumpLink = document.getElementById('intro-pump-link');

  const params = new URLSearchParams(window.location.search);
  const isLiveHardcoded = LIVE_CONTRACT_ADDRESS && !LIVE_CONTRACT_ADDRESS.startsWith('TBA');
  const activeCa = isLiveHardcoded
    ? LIVE_CONTRACT_ADDRESS.trim()
    : (params.get('ca') || localStorage.getItem('PUMP_ISLAND_CA') || LIVE_CONTRACT_ADDRESS);

  function applyCa(caValue) {
    if (!caValue) return;
    const clean = caValue.trim();
    if (caTextEl) caTextEl.textContent = clean;
    if (introCaValue) introCaValue.textContent = clean;
    if (!clean.startsWith('TBA')) {
      if (pumpLink) pumpLink.href = `https://pump.fun/coin/${clean}`;
      if (introPumpLink) introPumpLink.href = `https://pump.fun/coin/${clean}`;
      if (dexLink) dexLink.href = `https://dexscreener.com/solana/${clean}`;
    }
  }

  applyCa(activeCa);

  if (introCopyBtn && introCaValue) {
    introCopyBtn.addEventListener('click', async () => {
      sfx.playHoverSound();
      const textToCopy = introCaValue.textContent.trim();
      try {
        await navigator.clipboard.writeText(textToCopy);
      } catch {}
      introCopyText.textContent = 'COPIED ✓';
      introCopyBtn.style.background = '#3ef095';
      introCopyBtn.style.color = '#010a0e';
      setTimeout(() => {
        introCopyText.textContent = 'COPY';
        introCopyBtn.style.background = '';
        introCopyBtn.style.color = '';
      }, 2000);
    });
  }

  if (copyBtn && caTextEl) {
    copyBtn.addEventListener('click', async () => {
      sfx.playBeep(1120, 0.08);
      const textToCopy = caTextEl.textContent.trim();
      try {
        await navigator.clipboard.writeText(textToCopy);
      } catch {}
      copyBadge.textContent = 'COPIED ✓';
      setTimeout(() => {
        copyBadge.textContent = 'COPY CA';
      }, 1800);
    });
  }

  if (setCaBtn) {
    setCaBtn.addEventListener('click', () => {
      const input = prompt('Paste your live Pump.fun Contract Address (CA):', caTextEl.textContent);
      if (input && input.trim()) {
        const clean = input.trim();
        localStorage.setItem('PUMP_ISLAND_CA', clean);
        applyCa(clean);
        sfx.playBeep(1320, 0.1);
      }
    });
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const audioBtn = document.getElementById('audioToggleBtn');
  if (audioBtn) {
    audioBtn.addEventListener('click', () => sfx.toggle());
  }

  const heroController = new HeroGlobeController();
  initIntroGate(heroController);
  initReconMap();
  initPromoStudio(heroController);
  initContractAddressBar();
});
