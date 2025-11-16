# Audio Analysis & Playback Requirements

This document outlines the technical requirements and algorithms needed for professional-grade audio analysis, detection, and manipulation in the Samplerista application.

---

## 1. Real Transient Detection

### What Transients Are
Transients are short-duration, high-amplitude signal peaks that mark the start of musical events (drum hits, note attacks, percussive sounds).

### Required Algorithms

#### Onset Detection
- **Spectral Flux**: Measure change in frequency spectrum between consecutive frames
- **High-Frequency Content (HFC)**: Emphasize high-frequency transients
- **Complex Domain**: Phase deviation analysis for precise onset timing
- **Peak Picking**: Identify local maxima that exceed dynamic threshold

#### Implementation Needs
\`\`\`javascript
// Pseudo-code for onset detection
function detectOnsets(audioBuffer) {
  1. Convert to frequency domain using FFT (Fast Fourier Transform)
  2. Calculate spectral flux between consecutive frames
  3. Apply adaptive thresholding
  4. Peak picking with minimum inter-onset interval
  5. Return timestamps of detected onsets
}
\`\`\`

#### Parameters to Tune
- **Frame Size**: 2048 samples (good balance)
- **Hop Size**: 512 samples (overlap for precision)
- **Threshold Multiplier**: 1.5-3.0x median flux
- **Minimum Gap**: 50ms between onsets

### Libraries That Can Help
- **meyda.js**: Feature extraction library
- **essentia.js**: Comprehensive audio analysis (port of Essentia)
- **Web Audio API**: AnalyserNode for FFT data

---

## 2. Song Structure Detection

### What Structure Detection Does
Identifies major sections of a song: Intro, Verse, Chorus, Bridge, Outro, Breakdown.

### Required Algorithms

#### Self-Similarity Matrix (SSM)
1. **Chroma Features**: Extract pitch class profiles (12-dimensional vectors)
2. **MFCC Features**: Mel-Frequency Cepstral Coefficients for timbre
3. **Build Matrix**: Compare every frame with every other frame
4. **Novelty Detection**: Find boundaries where similarity drops

#### Structural Segmentation
\`\`\`javascript
function detectStructure(audioBuffer) {
  1. Extract chroma features (pitch content)
  2. Extract MFCCs (timbre/texture)
  3. Calculate beat-synchronous features
  4. Build self-similarity matrix
  5. Apply novelty function to find boundaries
  6. Cluster similar sections
  7. Label sections based on energy, repetition, position
}
\`\`\`

#### Energy-Based Heuristics
- **Intro**: Low-to-medium energy, beginning of track
- **Verse**: Medium energy, repetitive pattern
- **Chorus**: High energy, most repeated section
- **Bridge**: Contrasting pattern, usually middle-to-end
- **Breakdown**: Sudden energy drop
- **Outro**: Decreasing energy, end of track

### Required Features
- **RMS Energy**: Current implementation has this ✓
- **Spectral Centroid**: Brightness of sound
- **Zero-Crossing Rate**: Percussiveness
- **Chroma Vectors**: Harmonic content
- **Beat Tracking**: Rhythm analysis

### Advanced Approach
- **Machine Learning**: Train CNN/RNN models on labeled music datasets
- **Librosa (Python)**: Industry-standard library for music analysis
- **Port to Web**: Use TensorFlow.js for pre-trained models

---

## 3. BPM Detection (Tempo)

### Current Status
We have manual BPM input, but no automatic detection.

### Required for Auto-Detection

#### Beat Tracking Algorithm
\`\`\`javascript
function detectBPM(audioBuffer) {
  1. Extract onset strength envelope
  2. Calculate autocorrelation of onset function
  3. Find peaks corresponding to beat periods
  4. Convert to BPM (60 / period_in_seconds)
  5. Apply harmonic filtering (reject multiples/divisions)
  6. Return most likely BPM
}
\`\`\`

#### Refinement
- **Onset Strength**: Emphasize percussive content
- **Tempogram**: Time-frequency representation of tempo
- **Peak Salience**: Weight peaks by clarity/strength
- **Genre Constraints**: Filter to realistic BPM ranges (60-180)

### Libraries
- **aubio.js**: Real-time beat tracking
- **beat-detector**: JavaScript beat detection
- **essentia.js**: BeatTracker algorithm

---

## 4. Independent BPM (Speed) vs Pitch Control

### The Problem
Changing playback rate affects both speed AND pitch together.

### Solution: Time-Stretching & Pitch-Shifting

#### Time-Stretching (Change Speed, Keep Pitch)
**Phase Vocoder Algorithm**
\`\`\`javascript
function timeStretch(audioBuffer, stretchFactor) {
  1. STFT: Convert to frequency domain (Short-Time Fourier Transform)
  2. Modify hop size between frames (faster = smaller hop)
  3. Maintain phase coherence across frames
  4. ISTFT: Convert back to time domain
  5. Result: Speed changed, pitch unchanged
}
\`\`\`

**Key Concepts**
- **Phase Locking**: Keep frequency bins in phase
- **Overlap-Add**: Smooth reconstruction of signal
- **Window Function**: Hann window for smooth transitions

#### Pitch-Shifting (Change Pitch, Keep Speed)
**Combine Resampling + Time-Stretch**
\`\`\`javascript
function pitchShift(audioBuffer, semitones) {
  1. Calculate pitch ratio: 2^(semitones/12)
  2. Resample audio by pitch ratio (changes both)
  3. Time-stretch back to original duration
  4. Result: Pitch changed, speed unchanged
}
\`\`\`

### Implementation Options

#### Option 1: Web Audio API (Limited)
\`\`\`javascript
// Only changes both together
source.playbackRate.value = 1.5; // 1.5x speed AND pitch
\`\`\`

#### Option 2: Tone.js (Recommended)
\`\`\`javascript
// Independent control
const player = new Tone.Player(buffer);
player.playbackRate = 1.5; // Speed control
const pitchShift = new Tone.PitchShift(7); // +7 semitones
player.connect(pitchShift);
\`\`\`

#### Option 3: Manual Implementation
- **soundtouch.js**: Port of SoundTouch time-stretch library
- **Phase Vocoder**: Custom implementation in Web Audio
- **Rubber Band**: High-quality stretching (C++ library)

### Parameters Needed

**For Time-Stretching**
- **Stretch Factor**: 0.5 (half speed) to 2.0 (double speed)
- **Preserve Formants**: Keep vocal characteristics natural
- **Quality vs Speed**: Real-time vs offline processing

**For Pitch-Shifting**
- **Semitones**: -12 (octave down) to +12 (octave up)
- **Algorithm**: Transient preservation for drums vs smooth for vocals
- **Latency**: Buffer size affects real-time response

---

## 5. Current Implementation Gaps

### What We Have
- ✓ Manual BPM input
- ✓ Basic RMS energy analysis
- ✓ Playback rate control (affects both speed and pitch)
- ✓ Waveform visualization
- ✓ Basic slice creation (evenly spaced)

### What We Need

#### High Priority
1. **Real Onset Detection**: Replace evenly-spaced slices with detected transients
2. **Independent Pitch/Speed**: Implement time-stretching for BPM changes without pitch shift

#### Medium Priority
3. **Auto-BPM Detection**: Analyze audio to determine original tempo
4. **Better Section Detection**: Use chroma + MFCC instead of just energy
5. **Beat Grid**: Snap slices to detected beats

#### Low Priority (Advanced)
6. **Key Detection**: Identify musical key of audio
7. **Harmonic/Percussive Separation**: Split audio into components
8. **Audio Fingerprinting**: Match against music databases

---

## 6. Recommended Implementation Strategy

### Phase 1: Improve Detection
1. Integrate **essentia.js** or **meyda.js** for feature extraction
2. Implement real onset detection algorithm
3. Add BPM detection from onsets

### Phase 2: Separate Speed/Pitch
1. Integrate **Tone.js** for time-stretching capabilities
2. Replace current playback system with Tone.Player
3. Add separate BPM and Pitch controls in UI

### Phase 3: Advanced Structure
1. Implement chroma feature extraction
2. Build self-similarity matrix analysis
3. Improve section labeling with multiple features

### Phase 4: Polish
1. Add confidence scores to detections
2. Allow manual adjustment of detected features
3. Export/import analysis data with projects

---

## 7. Technical Requirements

### Browser Capabilities Needed
- **Web Audio API**: All modern browsers ✓
- **AudioWorklet**: For custom DSP (Chrome 66+, Safari 14.1+)
- **OfflineAudioContext**: For non-realtime processing ✓
- **Float32Array Support**: For audio buffer manipulation ✓

### Performance Considerations
- **FFT Size**: Larger = more accurate, slower
- **Processing Time**: Offline analysis vs real-time
- **Memory**: Large files need streaming or chunking
- **Worker Threads**: Move analysis off main thread

### Library Size Trade-offs
- **Tone.js**: ~200KB, comprehensive audio toolkit
- **essentia.js**: ~3MB, professional music analysis
- **meyda.js**: ~50KB, lightweight feature extraction
- **Custom**: Smallest, most work, full control

---

## 8. Testing & Validation

### Detection Quality Metrics
- **Onset Detection**: F-measure against hand-labeled data
- **BPM Detection**: Accuracy within ±3% of ground truth
- **Structure Detection**: Boundary precision/recall
- **Time-Stretch Quality**: PEAQ (Perceptual Evaluation of Audio Quality)

### Test Cases
1. **Simple Drum Loop**: Clean transients, steady tempo
2. **Complex Song**: Multiple sections, tempo changes
3. **Vocal Track**: Test formant preservation
4. **Electronic Music**: Test with synth transients
5. **Edge Cases**: Very fast/slow BPM, rubato, a cappella

---

## Conclusion

Moving from placeholder algorithms to real audio analysis requires:
1. **Mathematical Foundation**: FFT, autocorrelation, spectral analysis
2. **Algorithm Implementation**: Onset detection, beat tracking, time-stretching
3. **Library Integration**: Leverage existing tools (Tone.js, essentia.js)
4. **Performance Optimization**: Use Web Workers, efficient algorithms
5. **User Experience**: Show confidence, allow corrections, provide feedback

The current system provides a solid UI foundation. Adding these capabilities will transform it into a professional-grade audio analysis and manipulation tool.
