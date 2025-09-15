const keys = document.querySelectorAll('.key');
const volumeEl = document.getElementById('volume');
const speedEl = document.getElementById('speed');
const canvas = document.getElementById('visualizer');
const ctx = canvas.getContext('2d');

canvas.width = canvas.clientWidth;
canvas.height = canvas.clientHeight;

let audioCtx;
let analyser;
let sourceMap = new Map();

// Setup audio context
function setupAudioContext() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 128;
    analyser.connect(audioCtx.destination);
  }
}

// Play sound
function playSound(key) {
  const audio = document.querySelector(`audio[data-key="${key}"]`);
  const keyEl = document.querySelector(`.key[data-key="${key}"]`);
  if (!audio || !keyEl) return;

  setupAudioContext();

  // reset
  audio.currentTime = 0;
  audio.volume = volumeEl.value;

  const track = audioCtx.createMediaElementSource(audio);
  track.connect(analyser);
  track.connect(audioCtx.destination);

  audio.playbackRate = parseFloat(speedEl.value);
  audio.play();

  keyEl.classList.add('active');
  setTimeout(() => keyEl.classList.remove('active'), 150);
}

// Key press
window.addEventListener('keydown', e => {
  if (e.repeat) return;
  const key = e.key.toUpperCase();
  playSound(key);
});

// Mouse click
keys.forEach(keyEl => {
  keyEl.addEventListener('click', () => {
    playSound(keyEl.dataset.key);
  });
});

// Visualizer animation
function drawVisualizer() {
  requestAnimationFrame(drawVisualizer);

  if (!analyser) return;

  const bufferLength = analyser.frequencyBinCount;
  const dataArray = new Uint8Array(bufferLength);
  analyser.getByteFrequencyData(dataArray);

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const barWidth = (canvas.width / bufferLength) * 2.5;
  let x = 0;
  for (let i = 0; i < bufferLength; i++) {
    const barHeight = dataArray[i] / 2;
    ctx.fillStyle = '#58a6ff';
    ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);
    x += barWidth + 1;
  }
}
drawVisualizer();
