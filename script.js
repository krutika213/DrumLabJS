// Robust Drum Kit script
(() => {
  const keyEls = Array.from(document.querySelectorAll('.key'));
  const volumeEl = document.getElementById('volume');
  const speedEl = document.getElementById('speed');
  const canvas = document.getElementById('visualizer');
  const ctx = canvas.getContext('2d');

  // Resize canvas for crispness
  function resizeCanvas() {
    const ratio = window.devicePixelRatio || 1;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    canvas.width = Math.floor(w * ratio);
    canvas.height = Math.floor(h * ratio);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  }
  window.addEventListener('resize', resizeCanvas);
  resizeCanvas();

  // Audio context + analyser + master gain
  let audioCtx = null;
  let analyser = null;
  let masterGain = null;
  // map: normalizedKey -> { audioEl, sourceNode (MediaElementSource) }
  const soundMap = new Map();

  // helper: normalize dataset string or keyboard event key to consistent token
  function normalizeKey(raw) {
    if (!raw && raw !== '') return '';
    const s = String(raw).trim();
    if (s.length === 1) return s.toUpperCase();
    // sometimes KeyboardEvent.key returns 'Semicolon' in some locales; use code fallback
    const lower = s.toLowerCase();
    const map = {
      'semicolon': ';', 'colon': ';', 'space': ' ', 'spacebar': ' ',
      'comma': ',', 'period': '.', 'slash': '/', 'backslash': '\\',
      'quote': '\'', 'apostrophe': '\'', 'bracketleft': '[', 'bracketright': ']',
      'minus': '-', 'equal': '=', 'semicolon': ';'
    };
    if (map[lower]) return map[lower].toUpperCase();
    return s.charAt(0).toUpperCase();
  }

  // prepare soundMap from <audio> elements: find every audio[data-key]
  function buildSoundMap() {
    const audios = Array.from(document.querySelectorAll('audio[data-key]'));
    audios.forEach(a => {
      const key = normalizeKey(a.dataset.key || '');
      if (!key) return;
      // store audio element; sourceNode is created later (once audioCtx exists)
      soundMap.set(key, { audio: a, source: null });
    });
  }
  buildSoundMap();

  // create audio context and hook sources (only once)
  function ensureAudioContext() {
    if (audioCtx) {
      if (audioCtx.state === 'suspended') audioCtx.resume();
      return;
    }
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 256;
    masterGain = audioCtx.createGain();
    masterGain.gain.setValueAtTime(parseFloat(volumeEl.value || 0.8), audioCtx.currentTime);

    // Connect: analyser -> masterGain -> destination
    analyser.connect(masterGain);
    masterGain.connect(audioCtx.destination);

    // create MediaElementSource for each audio element once and connect to analyser
    soundMap.forEach((v, k) => {
      try {
        // createMediaElementSource can only be called once per audio element
        if (!v.source) {
          v.source = audioCtx.createMediaElementSource(v.audio);
          // connect to analyser (visualizer) and master gain via analyser chain
          v.source.connect(analyser);
          // don't connect source directly to destination (we use analyser -> masterGain -> dest)
        }
      } catch (err) {
        // some browsers throw if called multiple times or for CORS-protected audio,
        // fallback: we won't have a source node; audio will still play via <audio> element.
        console.warn('Could not create source for', k, err);
        v.source = null;
      }
    });
  }

  // Play a sound by normalized key
  function playKey(rawKey) {
    const key = normalizeKey(rawKey);
    if (!key) return;
    const entry = soundMap.get(key);
    if (!entry || !entry.audio) return;

    // ensure audio context started on first interaction
    ensureAudioContext();

    const audio = entry.audio;
    // set volume & speed on the element itself (playbackRate and volume)
    try {
      audio.pause();
      audio.currentTime = 0;
    } catch (err) { /* ignore if not allowed */ }

    audio.volume = parseFloat(volumeEl.value || 0.8);
    audio.playbackRate = parseFloat(speedEl.value || 1);

    // Play (returns a promise on modern browsers)
    const p = audio.play();
    // Visual active state
    const keyEl = keyEls.find(k => normalizeKey(k.dataset.key) === key);
    if (keyEl) {
      keyEl.classList.add('active');
      setTimeout(() => keyEl.classList.remove('active'), 140);
    }
    // ignore promise rejections (autoplay policy) — ensureAudioContext via click will fix it
    if (p && p.catch) p.catch(() => {/* ignore */});
  }

  // keyboard handler
  window.addEventListener('keydown', (ev) => {
    if (ev.repeat) return;
    // prefer ev.key, but if key is like 'Unidentified', use code's last char or mapping
    let raw = ev.key;
    if (!raw || raw === 'Unidentified') {
      // fallback to code (e.g. 'Semicolon' or 'KeyA'), try last char
      raw = ev.code || '';
      // if code is like KeyA return 'A', else use as-is
    }
    playKey(raw);
  });

  // click handler for keys
  keyEls.forEach(el => {
    el.addEventListener('click', () => {
      playKey(el.dataset.key);
      // ensure audio context (some browsers need a user gesture)
      ensureAudioContext();
    });
  });

  // update masterGain on volume change if audioCtx exists
  volumeEl.addEventListener('input', () => {
    const v = parseFloat(volumeEl.value || 0.8);
    if (masterGain && audioCtx) masterGain.gain.setValueAtTime(v, audioCtx.currentTime);
  });

  // visualizer drawing
  let rafId = null;
  function draw() {
    rafId = requestAnimationFrame(draw);
    if (!analyser) return;

    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    // use analyser frequency data
    const bufferLength = analyser.frequencyBinCount;
    const data = new Uint8Array(bufferLength);
    analyser.getByteFrequencyData(data);

    // clear
    ctx.clearRect(0, 0, width, height);

    // draw bars
    const barCount = Math.min(64, bufferLength);
    const barWidth = Math.max(2, Math.floor(width / barCount) - 2);
    let x = 6;
    for (let i = 0; i < barCount; i++) {
      const v = data[i] / 255; // 0..1
      const barH = v * (height - 10);
      const hue = 200 - v * 120; // bluish -> orange
      ctx.fillStyle = `hsl(${hue}, 80%, ${30 + v * 40}%)`;
      ctx.fillRect(x, height - barH - 6, barWidth, barH);
      x += barWidth + 6;
    }
  }

  // start animation loop when analyser created (lazy)
  const startVisualizerIfNeeded = () => {
    if (!rafId) draw();
  };

  // call ensureAudioContext on first user gesture to avoid autoplay issues
  document.addEventListener('click', () => {
    ensureAudioContext();
    startVisualizerIfNeeded();
  }, { once: true });

  // also ensure visualizer runs when audioCtx created programmatically
  const originalEnsure = ensureAudioContext;
  ensureAudioContext = function () {
    originalEnsure();
    startVisualizerIfNeeded();
  };

  // initial canvas sizing + start draw if audioCtx already created
  resizeCanvas();
  startVisualizerIfNeeded();

  // clean up on page hide
  window.addEventListener('pagehide', () => {
    if (rafId) cancelAnimationFrame(rafId);
  });
})();
