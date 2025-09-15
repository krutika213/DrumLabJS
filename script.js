// Expanded Drum Kit - Vanilla JS with visualizer, record, volume & speed
(() => {
  const audioEls = Array.from(document.querySelectorAll('audio[data-key]'));
  const keyEls = Array.from(document.querySelectorAll('.key'));
  const volumeEl = document.getElementById('volume');
  const speedEl = document.getElementById('speed');
  const recordBtn = document.getElementById('recordBtn');
  const stopBtn = document.getElementById('stopBtn');
  const playBtn = document.getElementById('playBtn');
  const clearBtn = document.getElementById('clearBtn');
  const visualizer = document.getElementById('visualizer');

  // Map letter -> audio element
  const audioMap = {};
  audioEls.forEach(a => {
    const k = (a.dataset.key || '').trim();
    audioMap[k.toUpperCase()] = a;
  });

  let audioCtx;
  let analyser;
  let masterGain;
  const sources = {}; // holds MediaElementSource nodes
  let rafId;

  // Recording
  let recording = false;
  let recordStart = 0;
  let events = [];

  function ensureAudioContext() {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      masterGain = audioCtx.createGain();
      masterGain.gain.value = parseFloat(volumeEl.value || 0.8);
      masterGain.connect(audioCtx.destination);
      analyser.connect(masterGain);

      // create sources for each audio element and connect them to analyser
      Object.keys(audioMap).forEach(key => {
        const audio = audioMap[key];
        try {
          const src = audioCtx.createMediaElementSource(audio);
          src.connect(analyser);
          // Note: analyser already connects to masterGain -> destination
          sources[key] = src;
        } catch (err) {
          // Some browsers throw if createMediaElementSource is called multiple times
          // We'll ignore — audio will still play via <audio> tag directly (fallback)
          console.warn('Could not create source for', key, err);
        }
      });
      startVisualizer();
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
  }

  function playKey(key) {
    ensureAudioContext();
    const letter = (key || '').toUpperCase();
    const audio = audioMap[letter];
    if (!audio) return;

    try {
      audio.pause(); // ensure we can set currentTime
      audio.currentTime = 0;
    } catch (e) { /* ignore */ }

    audio.playbackRate = parseFloat(speedEl.value || 1);
    const p = audio.play();
    // Add visual active state
    const el = keyEls.find(k => (k.dataset.key||'').toUpperCase() === letter);
    if (el) {
      el.classList.add('active');
      setTimeout(() => el.classList.remove('active'), 140);
    }

    // record if active
    if (recording) {
      events.push({ key: letter, t: performance.now() - recordStart });
    }

    return p;
  }

  // Handle keyboard events
  window.addEventListener('keydown', (ev) => {
    // ignore repeated keydown when held (optional: allow repeat)
    if (ev.repeat) return;
    // pick ev.key (letters) or ev.code for some keys; normalize single-character keys
    let k = ev.key;
    // For semicolon key in some layouts key is ';' - use ';' char
    if (!k) k = ev.code;
    const letter = (k || '').toUpperCase();
    playKey(letter);
  });

  // Handle clicks on keys
  keyEls.forEach(el => {
    el.addEventListener('click', () => {
      const k = (el.dataset.key || '').trim();
      playKey(k);
      // ensure audioContext started
      ensureAudioContext();
    });
  });

  // Volume control
  volumeEl.addEventListener('input', () => {
    if (masterGain) masterGain.gain.value = parseFloat(volumeEl.value);
  });

  // Speed control - affects playbackRate on play
  speedEl.addEventListener('input', () => {
    // no global action needed; playbackRate applied per-play
  });

  // Recording controls
  recordBtn.addEventListener('click', () => {
    ensureAudioContext();
    events = [];
    recording = true;
    recordStart = performance.now();
    recordBtn.disabled = true;
    stopBtn.disabled = false;
    playBtn.disabled = true;
    clearBtn.disabled = true;
    recordBtn.textContent = 'Recording…';
  });

  stopBtn.addEventListener('click', () => {
    recording = false;
    recordBtn.disabled = false;
    recordBtn.textContent = 'Record';
    stopBtn.disabled = true;
    playBtn.disabled = events.length === 0;
    clearBtn.disabled = events.length === 0;
  });

  playBtn.addEventListener('click', () => {
    if (!events.length) return;
    ensureAudioContext();
    playBtn.disabled = true;
    recordBtn.disabled = true;
    clearBtn.disabled = true;

    const start = performance.now();
    events.forEach(ev => {
      setTimeout(() => playKey(ev.key), ev.t);
    });

    // enable after last event
    const lastT = events[events.length - 1].t || 0;
    setTimeout(() => {
      playBtn.disabled = false;
      recordBtn.disabled = false;
      clearBtn.disabled = false;
    }, lastT + 400);
  });

  clearBtn.addEventListener('click', () => {
    events = [];
    playBtn.disabled = true;
    clearBtn.disabled = true;
  });

  // Visualizer
  const ctx = visualizer.getContext('2d');
  function startVisualizer() {
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    function draw() {
      rafId = requestAnimationFrame(draw);
      analyser.getByteFrequencyData(dataArray);

      ctx.clearRect(0, 0, visualizer.width, visualizer.height);

      // style
      const w = visualizer.width;
      const h = visualizer.height;
      const barWidth = Math.max(2, Math.floor(w / bufferLength * 1.5));
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const v = dataArray[i] / 255;
        const barHeight = v * h;
        const hue = 200 - v * 120; // blue->orange
        ctx.fillStyle = `hsl(${hue}, 90%, ${30 + v * 40}%)`;
        ctx.fillRect(x, h - barHeight, barWidth, barHeight);
        x += barWidth + 1;
        if (x > w) break;
      }
    }
    if (!rafId) draw();
  }

  // Resize canvas to CSS size for crispness
  function resizeCanvas() {
    const ratio = window.devicePixelRatio || 1;
    visualizer.width = visualizer.clientWidth * ratio;
    visualizer.height = visualizer.clientHeight * ratio;
    ctx.scale(ratio, ratio);
  }
  window.addEventListener('resize', resizeCanvas);
  resizeCanvas();

  // On page unload, cancel animation frame
  window.addEventListener('pagehide', () => {
    cancelAnimationFrame(rafId);
  });

  // Helpful: enable click to start audio context (some browsers require gesture)
  document.addEventListener('click', ensureAudioContext, { once: true });
})();
