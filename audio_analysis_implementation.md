# Audio Analysis & Playback Architecture (Concrete Implementation Guide)

A complete, practical walkthrough for building an audio-analysis pipeline using **Essentia.js**, **Web Audio API**, **Tone.js**, and **Web Workers**.

---

# 1. Overview

This document describes the best, most stable way to implement:

- Transient / onset detection  
- BPM estimation  
- Independent pitch & speed (time‑stretch without pitch shift)  
- Structure analysis (basic → advanced)  
- Efficient, scalable architecture for browsers

It is based on the needs and methods outlined in your original requirements.

---

# 2. System Architecture

```
[ UI ] 
   ↓
[ Main Thread ]
   • Load file
   • Decode audio → AudioBuffer
   • Downmix → Float32Array (mono)
   • Send samples to Worker
   ↓
[ Web Worker ]
   • Init Essentia.js (WASM)
   • Onset detection
   • Onset envelope → BPM estimation
   • (Optional) Feature extraction for structure
   ↓
[ Main Thread ]
   • Store analysis results (JSON)
   • Use Tone.js for playback, pitch, speed
   • Render markers, sections, etc.
```

Essentia.js **never runs on the main thread**.

---

# 3. File Decoding & Mono Conversion

```js
async function decodeToMonoArray(file) {
  const audioCtx = new AudioContext();
  const arrayBuffer = await file.arrayBuffer();
  const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);

  const ch0 = audioBuffer.getChannelData(0);

  if (audioBuffer.numberOfChannels === 1) return { samples: ch0, sampleRate: audioBuffer.sampleRate };

  const ch1 = audioBuffer.getChannelData(1);
  const mono = new Float32Array(audioBuffer.length);

  for (let i = 0; i < audioBuffer.length; i++) {
    mono[i] = (ch0[i] + ch1[i]) * 0.5;
  }

  return { samples: mono, sampleRate: audioBuffer.sampleRate };
}
```

This provides clean input for Essentia.

---

# 4. Web Worker + Essentia.js Setup

Create `analysisWorker.js`:

```js
import Essentia from "essentia.js";

let essentia;

self.onmessage = async (e) => {
  const { type, samples, sampleRate } = e.data;

  if (!essentia) {
    essentia = await Essentia.init();
  }

  if (type === "analyze") {
    const result = performAnalysis(samples, sampleRate);
    self.postMessage({ type: "analysisResult", result });
  }
};
```

---

# 5. Transient / Onset Detection (Spectral Flux Pipeline)

```js
function computeSpectralFlux(essentia, frames) {
  const flux = [];
  let prevSpec = null;

  for (let i = 0; i < frames.size(); i++) {
    const w = essentia.Windowing(frames.get(i));
    const spec = essentia.Spectrum(w);

    if (prevSpec) {
      let sum = 0;
      for (let j = 0; j < spec.size(); j++) {
        const diff = spec.get(j) - prevSpec.get(j);
        sum += Math.max(diff, 0);
      }
      flux.push(sum);
    } else {
      flux.push(0);
    }

    prevSpec = spec;
  }

  return flux;
}

function detectOnsets(flux, sampleRate, hopSize) {
  const threshold = movingAverage(flux, 10).map(x => x * 1.5);
  const onsets = [];

  for (let i = 1; i < flux.length - 1; i++) {
    if (flux[i] > threshold[i] && flux[i] > flux[i-1] && flux[i] > flux[i+1]) {
      const t = (i * hopSize) / sampleRate;
      onsets.push(t);
    }
  }

  return onsets;
}
```

---

# 6. BPM Estimation (Autocorrelation)

```js
function bpmFromEnvelope(env, sampleRate, hopSize) {
  const ac = autocorrelate(env);

  let bestLag = 0;
  let bestVal = -Infinity;

  const minBPM = 60;
  const maxBPM = 180;

  const minLag = Math.floor((60 / maxBPM) * sampleRate / hopSize);
  const maxLag = Math.floor((60 / minBPM) * sampleRate / hopSize);

  for (let lag = minLag; lag <= maxLag; lag++) {
    if (ac[lag] > bestVal) {
      bestVal = ac[lag];
      bestLag = lag;
    }
  }

  const period = (bestLag * hopSize) / sampleRate;
  return 60 / period;
}
```

---

# 7. Full Analysis Function

```js
function performAnalysis(samples, sampleRate) {
  const frameSize = 2048;
  const hopSize = 512;

  const frames = essentia.FrameGenerator(samples, frameSize, hopSize);

  const flux = computeSpectralFlux(essentia, frames);
  const onsets = detectOnsets(flux, sampleRate, hopSize);

  const bpm = bpmFromEnvelope(flux, sampleRate, hopSize);

  return {
    onsets,
    bpm,
    envelope: flux
  };
}
```

---

# 8. Playback: Independent Pitch & Speed (Tone.js)

```js
const player = new Tone.Player(audioBuffer).toDestination();

const shifter = new Tone.PitchShift();
player.connect(shifter);
shifter.toDestination();
```

### Control tempo:

```js
player.playbackRate = desiredBpm / detectedBpm;
```

### Control pitch:

```js
shifter.pitch = semitoneValue;
```

This gives **true independent pitch and speed**.

---

# 9. Structure Detection (Simple → Advanced)

## Simple (recommended first)
- Compute RMS energy
- Detect major energy drops/raises (sections)

## Advanced (later)
- Extract MFCC + Chroma via Essentia.js
- Compute self‑similarity matrix
- Detect novelty peaks → structural boundaries

---

# 10. JSON Output Example

```json
{
  "bpm": 122.5,
  "onsets": [0.12, 0.45, 0.82, 1.09, 1.38],
  "envelope": [...],
  "sections": [
    { "start": 0, "end": 32.4, "label": "verse" },
    { "start": 32.4, "end": 55.7, "label": "chorus" }
  ]
}
```

Your app only consumes JSON — analysis never runs in realtime.

---

# 11. Implementation Order (Recommended)

1. File decode → mono array  
2. Worker + Essentia init  
3. Onset detection  
4. BPM estimation  
5. Tone.js playback engine  
6. Independent pitch & speed controls  
7. Section detection (energy-based)  
8. Advanced structure (chroma/MFCC → novelty)

---

# 12. Conclusion

This architecture gives you:

- Smooth UI  
- Zero main‑thread blocking  
- Accurate and scalable analysis  
- Clean integration with playback engines  
- Expandability (structure, chroma, ML models later)

