/**
 * 浪漫主题程序化音效 — Web Audio API，无需外部音频文件
 */
(function (global) {
  const STORAGE_KEY = 'girlfriend-sound-enabled';
  const BGM_SOURCES = [
    'audio/周杰伦 - 晴天.ogg',
    'audio/qingtian.mp3',
    'audio/qingtian.m4a',
  ];
  const BGM_VOLUME = 0.36;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const RomanceAudio = {
    ctx: null,
    master: null,
    unlocked: false,
    enabled: true,
    volumeScale: reducedMotion ? 0.55 : 1,
    lastAt: {},
    wind: null,
    bgm: null,
    bgmReady: false,
    bgmMissing: false,
    bgmStarted: false,

    init() {
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved === '0') this.enabled = false;
      } catch (_) {
        /* ignore */
      }
      this._initBGM();
      this._bindUnlock();
      this._bindToggleButtons();
      this._syncToggleButtons();
    },

    _initBGM() {
      const audio = new Audio();
      audio.loop = true;
      audio.preload = 'auto';
      audio.volume = BGM_VOLUME * this.volumeScale;
      this.bgm = audio;

      let sourceIdx = 0;
      const loadSource = () => {
        if (sourceIdx >= BGM_SOURCES.length) {
          this.bgmMissing = true;
          return;
        }
        audio.src = encodeURI(BGM_SOURCES[sourceIdx]);
        sourceIdx += 1;
        audio.load();
      };

      audio.addEventListener('canplaythrough', () => {
        this.bgmReady = true;
      });

      audio.addEventListener('error', () => {
        loadSource();
      });

      loadSource();
    },

    isEnabled() {
      return this.enabled;
    },

    setEnabled(on) {
      this.enabled = !!on;
      try {
        localStorage.setItem(STORAGE_KEY, this.enabled ? '1' : '0');
      } catch (_) {
        /* ignore */
      }
      if (!this.enabled) {
        this.stopShockwaveWind();
        this.pauseBGM();
      } else {
        this.startBGM();
      }
      this._syncToggleButtons();
    },

    toggleEnabled() {
      this.setEnabled(!this.enabled);
      if (this.enabled) {
        this.unlock();
        this.playUiClick();
      }
    },

    startBGM() {
      if (!this.enabled || this.bgmMissing || !this.bgm) return;
      this.bgm.volume = BGM_VOLUME * this.volumeScale;

      const playPromise = this.bgm.play();
      if (!playPromise) return;

      playPromise
        .then(() => {
          this.bgmStarted = true;
        })
        .catch(() => {});
    },

    pauseBGM() {
      if (!this.bgm) return;
      this.bgm.pause();
    },

    unlock() {
      if (!this.enabled) return;
      if (!this.ctx) {
        const Ctx = global.AudioContext || global.webkitAudioContext;
        if (!Ctx) return;
        this.ctx = new Ctx();
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.82 * this.volumeScale;
        this.master.connect(this.ctx.destination);
      }
      if (this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
      this.unlocked = true;
    },

    _bindUnlock() {
      const unlockOnce = () => {
        this.unlock();
        this.startBGM();
        ['pointerdown', 'keydown', 'touchstart'].forEach((evt) => {
          global.removeEventListener(evt, unlockOnce, true);
        });
      };
      ['pointerdown', 'keydown', 'touchstart'].forEach((evt) => {
        global.addEventListener(evt, unlockOnce, { capture: true, passive: true });
      });
    },

    _bindToggleButtons() {
      global.document.querySelectorAll('[data-sound-toggle]').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.toggleEnabled();
        });
      });
    },

    _syncToggleButtons() {
      global.document.querySelectorAll('[data-sound-toggle]').forEach((btn) => {
        const on = this.enabled;
        btn.setAttribute('aria-pressed', on ? 'true' : 'false');
        btn.setAttribute('title', on ? '关闭音效与音乐' : '开启音效与音乐');
        btn.setAttribute('aria-label', on ? '关闭音效与音乐' : '开启音效与音乐');
        btn.textContent = on ? '♪' : '♪̸';
        btn.classList.toggle('is-muted', !on);
      });
    },

    _canPlay(id, minInterval) {
      const now = performance.now();
      if (now - (this.lastAt[id] || 0) < minInterval) return false;
      this.lastAt[id] = now;
      return true;
    },

    _ensure() {
      if (!this.enabled) return false;
      if (!this.ctx) this.unlock();
      if (!this.ctx || this.ctx.state !== 'running') return false;
      return true;
    },

    _now() {
      return this.ctx.currentTime;
    },

    _tone(freq, start, dur, peak, type = 'sine', dest = this.master) {
      const t0 = this._now() + start;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t0);
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, peak), t0 + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.connect(gain);
      gain.connect(dest);
      osc.start(t0);
      osc.stop(t0 + dur + 0.02);
    },

    _slideTone(freqFrom, freqTo, start, dur, peak, type = 'sine') {
      const t0 = this._now() + start;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freqFrom, t0);
      osc.frequency.exponentialRampToValueAtTime(Math.max(40, freqTo), t0 + dur * 0.85);
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, peak), t0 + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.connect(gain);
      gain.connect(this.master);
      osc.start(t0);
      osc.stop(t0 + dur + 0.02);
    },

    _noiseBurst(start, dur, peak, freq = 900, q = 0.7) {
      const t0 = this._now() + start;
      const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) {
        data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      }
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = freq;
      filter.Q.value = q;
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, peak), t0 + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      src.connect(filter);
      filter.connect(gain);
      gain.connect(this.master);
      src.start(t0);
      src.stop(t0 + dur + 0.02);
    },

    _getNoiseBuffer() {
      if (this._noiseBuf) return this._noiseBuf;
      const len = this.ctx.sampleRate * 2;
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = buf.getChannelData(0);
      let last = 0;
      for (let i = 0; i < len; i++) {
        const white = Math.random() * 2 - 1;
        last = (last + 0.04 * white) / 1.04;
        data[i] = last * 2.8;
      }
      this._noiseBuf = buf;
      return buf;
    },

    playPop(intensity = 0.6) {
      if (!this._ensure() || !this._canPlay('pop', 55)) return;
      const amp = 0.07 + intensity * 0.09;
      const base = 280 + intensity * 180 + Math.random() * 40;
      this._slideTone(base, base * 0.45, 0, 0.09, amp, 'sine');
      this._tone(base * 1.5, 0.01, 0.06, amp * 0.35, 'triangle');
    },

    playBump(velocity = 0.5) {
      if (!this._ensure() || !this._canPlay('bump', 70)) return;
      const v = clamp(velocity, 0.15, 1);
      const freq = 180 + v * 120;
      this._slideTone(freq, freq * 0.7, 0, 0.07, 0.035 + v * 0.04, 'triangle');
    },

    playWall(velocity = 0.4) {
      if (!this._ensure() || !this._canPlay('wall', 90)) return;
      const v = clamp(velocity, 0.1, 1);
      this._slideTone(140 + v * 80, 90, 0, 0.06, 0.025 + v * 0.03, 'sine');
    },

    playFirework(scale = 1) {
      if (!this._ensure() || !this._canPlay('firework', 180)) return;
      const s = clamp(scale, 0.6, 1.6);
      const notes = [523.25, 659.25, 783.99, 987.77];
      notes.forEach((n, i) => {
        this._tone(n, i * 0.045, 0.35 + i * 0.04, (0.055 + i * 0.012) * s, 'sine');
        this._tone(n * 2, i * 0.045 + 0.01, 0.22, (0.018 + i * 0.006) * s, 'triangle');
      });
      this._noiseBurst(0.02, 0.14, 0.04 * s, 1200 + s * 400, 1.1);
    },

    playLoveQuote() {
      if (!this._ensure() || !this._canPlay('quote', 400)) return;
      this._tone(659.25, 0, 0.55, 0.05, 'sine');
      this._tone(987.77, 0.08, 0.65, 0.038, 'triangle');
      this._tone(1318.51, 0.16, 0.75, 0.028, 'sine');
    },

    playFormationEnter() {
      if (!this._ensure() || !this._canPlay('form-enter', 220)) return;
      [392, 493.88, 587.33, 739.99].forEach((n, i) => {
        this._tone(n, i * 0.05, 0.28, 0.042 - i * 0.004, 'sine');
      });
      this._noiseBurst(0.04, 0.18, 0.022, 1800, 0.9);
    },

    playFormationBurst() {
      if (!this._ensure() || !this._canPlay('form-burst', 300)) return;
      this.playFirework(1.35);
      this._slideTone(220, 90, 0.05, 0.2, 0.06, 'sine');
    },

    playShockwaveStart() {
      if (!this._ensure() || !this._canPlay('sw-start', 120)) return;
      this._noiseBurst(0, 0.28, 0.07, 420, 0.55);
      this._slideTone(160, 55, 0.04, 0.24, 0.05, 'sine');
    },

    playShockwavePulse(intensity = 1) {
      if (!this._ensure() || !this._canPlay('sw-pulse', 120)) return;
      const i = clamp(intensity, 1, 4.6);
      this._slideTone(70 + i * 8, 48, 0, 0.1, 0.03 + i * 0.012, 'sine');
      if (i >= 2) this._noiseBurst(0, 0.08, 0.018 + i * 0.006, 280 + i * 40, 0.6);
    },

    startShockwaveWind(dir, intensity = 1) {
      if (!this._ensure()) return;
      this.stopShockwaveWind(false);

      const src = this.ctx.createBufferSource();
      src.buffer = this._getNoiseBuffer();
      src.loop = true;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 240;
      filter.Q.value = 0.45;

      const gain = this.ctx.createGain();
      gain.gain.value = 0.0001;

      const panner = this.ctx.createStereoPanner();
      if (dir === 'left') panner.pan.value = -0.35;
      else if (dir === 'right') panner.pan.value = 0.35;
      else if (dir === 'up') panner.pan.value = 0;
      else if (dir === 'down') panner.pan.value = 0;

      src.connect(filter);
      filter.connect(gain);
      gain.connect(panner);
      panner.connect(this.master);
      src.start();

      this.wind = { src, filter, gain, panner, dir };
      this.updateShockwaveWind(intensity);
    },

    updateShockwaveWind(intensity = 1) {
      if (!this.wind || !this.ctx) return;
      const i = clamp(intensity, 1, 4.6);
      const norm = (i - 1) / 3.6;
      const t = this._now();
      const targetGain = (0.012 + norm * 0.055) * this.volumeScale;
      this.wind.gain.gain.cancelScheduledValues(t);
      this.wind.gain.gain.setTargetAtTime(targetGain, t, 0.08);
      this.wind.filter.frequency.cancelScheduledValues(t);
      this.wind.filter.frequency.setTargetAtTime(180 + norm * 320, t, 0.12);
    },

    stopShockwaveWind(fade = true) {
      if (!this.wind || !this.ctx) return;
      const w = this.wind;
      this.wind = null;
      const t = this._now();
      if (fade) {
        w.gain.gain.cancelScheduledValues(t);
        w.gain.gain.setTargetAtTime(0.0001, t, 0.06);
        setTimeout(() => {
          try {
            w.src.stop();
            w.src.disconnect();
            w.filter.disconnect();
            w.gain.disconnect();
            w.panner.disconnect();
          } catch (_) {
            /* ignore */
          }
        }, 180);
      } else {
        try {
          w.src.stop();
          w.src.disconnect();
          w.filter.disconnect();
          w.gain.disconnect();
          w.panner.disconnect();
        } catch (_) {
          /* ignore */
        }
      }
    },

    playRespawn() {
      if (!this._ensure() || !this._canPlay('respawn', 300)) return;
      this._slideTone(330, 520, 0, 0.18, 0.04, 'sine');
      this._tone(783.99, 0.06, 0.22, 0.022, 'triangle');
    },

    playIntro() {
      if (!this._ensure() || !this._canPlay('intro', 500)) return;
      [523.25, 659.25, 783.99].forEach((n, i) => {
        this._tone(n, i * 0.09, 0.45, 0.038, 'sine');
      });
    },

    playUiClick() {
      if (!this._ensure() || !this._canPlay('ui', 40)) return;
      this._slideTone(640, 480, 0, 0.05, 0.028, 'triangle');
    },

    playConfirm() {
      if (!this._ensure() || !this._canPlay('confirm', 200)) return;
      [523.25, 659.25, 783.99, 1046.5].forEach((n, i) => {
        this._tone(n, i * 0.06, 0.32, 0.045, 'sine');
      });
    },

    playUploadAdd() {
      if (!this._ensure() || !this._canPlay('upload', 120)) return;
      this._tone(587.33, 0, 0.16, 0.035, 'sine');
      this._tone(739.99, 0.05, 0.2, 0.028, 'triangle');
    },
  };

  function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
  }

  global.RomanceAudio = RomanceAudio;
  RomanceAudio.init();
})(window);
