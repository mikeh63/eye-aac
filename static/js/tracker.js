// tracker.js — Head pose + blink detection via MediaPipe FaceMesh
// Eye landmark indices (MediaPipe FaceMesh)
const LEFT_EYE  = [33, 160, 158, 133, 153, 144];
const RIGHT_EYE = [362, 385, 387, 263, 373, 380];
const NOSE_TIP  = 1;
const FOREHEAD  = 10;
const LEFT_CHEEK  = 234;
const RIGHT_CHEEK = 454;

// --- Tunable config (exposed so UI can adjust) ---
export const config = {
  blinkThreshold: 0.21,
  blinkMinFrames: 2,
  blinkCooldownMs: 700,
  smoothing: 0.35,
  sensitivity: 3.0,   // ← change from 1.6 to 3.0
};


// Internal state
let _baseline = null;       // neutral head position set during calibration
let _smoothX  = 0.5;
let _smoothY  = 0.5;
let _blinkFrameCount = 0;
let _lastBlinkTime   = 0;
let _blinkInProgress = false;
let _onBlink = null;
let _onMove  = null;

/** Register callbacks */
export function onBlink(cb) { _onBlink = cb; }
export function onMove(cb)  { _onMove  = cb; }

/** Call this when the user is looking straight ahead */
export function setBaseline(landmarks) {
  _baseline = {
    x: landmarks[NOSE_TIP].x,
    y: landmarks[NOSE_TIP].y,
  };
  _smoothX = 0.5;
  _smoothY = 0.5;
}

export function hasBaseline() { return _baseline !== null; }

// ── Speech / Click feedback ──────────────────────
let speakOn = false;

const btnSpeak = document.getElementById('btn-speak');
btnSpeak.addEventListener('click', () => {
  speakOn = !speakOn;
  btnSpeak.textContent = speakOn ? '🔊 Speak ON' : '🔇 Speak OFF';
  btnSpeak.classList.toggle('on', speakOn);
});

function speakWord(word) {
  if (speakOn) {
    const utt = new SpeechSynthesisUtterance(word);
    utt.rate = 0.95;
    utt.pitch = 1.0;
    speechSynthesis.cancel(); // cancel any currently speaking
    speechSynthesis.speak(utt);
  } else {
    // Short click using Web Audio API
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.08);
  }
}

// ── Play full sentence ───────────────────────────
const btnPlay = document.getElementById('btn-play');
btnPlay.addEventListener('click', playSentence);

function playSentence() {
  const text = getSentenceText();
  if (!text) return;
  speechSynthesis.cancel();
  const utt = new SpeechSynthesisUtterance(text);
  utt.rate = 0.9;
  utt.pitch = 1.0;
  utt.onstart = () => { btnPlay.textContent = '⏹ Stop'; btnPlay.classList.add('playing'); };
  utt.onend   = () => { btnPlay.textContent = '▶ Play'; btnPlay.classList.remove('playing'); };
  speechSynthesis.speak(utt);
}

/**
 * Eye Aspect Ratio — ratio of eye height to width.
 * Drops sharply on blink.
 */
function eyeAspectRatio(landmarks, indices) {
  const p = indices.map(i => landmarks[i]);
  const vertical1 = Math.hypot(p[1].x - p[5].x, p[1].y - p[5].y);
  const vertical2 = Math.hypot(p[2].x - p[4].x, p[2].y - p[4].y);
  const horizontal = Math.hypot(p[0].x - p[3].x, p[0].y - p[3].y);
  return (vertical1 + vertical2) / (2.0 * horizontal);
}

/**
 * Process a single FaceMesh result frame.
 * Returns { normX, normY, ear, blinked }
 */
export function processFrame(landmarks) {
  // --- Blink detection ---
  const leftEAR  = eyeAspectRatio(landmarks, LEFT_EYE);
  const rightEAR = eyeAspectRatio(landmarks, RIGHT_EYE);
  const ear = (leftEAR + rightEAR) / 2;

  const now = Date.now();
  let blinked = false;

  if (ear < config.blinkThreshold) {
    _blinkFrameCount++;
    _blinkInProgress = true;
  } else {
    if (
      _blinkInProgress &&
      _blinkFrameCount >= config.blinkMinFrames &&
      now - _lastBlinkTime > config.blinkCooldownMs
    ) {
      blinked = true;
      _lastBlinkTime = now;
      if (_onBlink) _onBlink();
    }
    _blinkFrameCount = 0;
    _blinkInProgress = false;
  }

  // --- Head tracking ---
  let normX = _smoothX;
  let normY = _smoothY;

  if (_baseline) {
    const dx = (landmarks[NOSE_TIP].x - _baseline.x) * config.sensitivity;
    const dy = (landmarks[NOSE_TIP].y - _baseline.y) * config.sensitivity;

    // Flip X (mirror) and clamp to [0,1]
    const rawX = Math.min(1, Math.max(0, 0.5 - dx));
    const rawY = Math.min(1, Math.max(0, 0.5 + dy));

    // Exponential smoothing
    _smoothX += (rawX - _smoothX) * (1 - config.smoothing);
    _smoothY += (rawY - _smoothY) * (1 - config.smoothing);
    normX = _smoothX;
    normY = _smoothY;

    if (_onMove) _onMove(normX, normY);
  }

  return { normX, normY, ear, blinked };
}

/**
 * Draw debug overlay onto a canvas context.
 */
export function drawDebug(ctx, landmarks, result, canvas) {
  const { ear, blinked } = result;

  // Draw eye landmarks
  [...LEFT_EYE, ...RIGHT_EYE].forEach(i => {
    const lm = landmarks[i];
    ctx.beginPath();
    ctx.arc(lm.x * canvas.width, lm.y * canvas.height, 2, 0, 2 * Math.PI);
    ctx.fillStyle = blinked ? "#ff4444" : "#00ff88";
    ctx.fill();
  });

  // Draw nose tip
  const nose = landmarks[NOSE_TIP];
  ctx.beginPath();
  ctx.arc(nose.x * canvas.width, nose.y * canvas.height, 5, 0, 2 * Math.PI);
  ctx.fillStyle = "#4488ff";
  ctx.fill();

  // EAR text
  ctx.fillStyle = "#ffffff";
  ctx.font = "14px monospace";
  ctx.fillText(`EAR: ${ear.toFixed(3)}`, 10, 20);
  ctx.fillText(`Threshold: ${config.blinkThreshold}`, 10, 38);
  if (blinked) {
    ctx.fillStyle = "#ff4444";
    ctx.font = "bold 20px monospace";
    ctx.fillText("BLINK!", 10, 65);
  }
}
