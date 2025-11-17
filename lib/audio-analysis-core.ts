/**
 * Audio Analysis Service using Essentia.js
 * Provides professional-grade audio analysis including onset detection,
 * BPM detection, and song structure analysis.
 */

// Dynamic imports for Essentia.js to avoid SSR issues
let EssentiaWASM: any = null
let Essentia: any = null

// Types for analysis results
export interface OnsetResult {
  timestamps: number[] // in samples
  times: number[] // in seconds
}

export interface BPMResult {
  bpm: number
  confidence?: number
}

export interface SectionBoundary {
  startSample: number
  endSample: number
  startTime: number
  endTime: number
  label: string
  confidence?: number
}

export interface SongStructureResult {
  boundaries: SectionBoundary[]
  bpm?: number
}

export class AudioAnalysisCore {
  private essentia: any = null
  private isInitialized = false
  private initializationPromise: Promise<void> | null = null
  private windowCache = new Map<number, Float32Array>()

  /**
   * Initialize Essentia.js (async, loads WebAssembly)
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return Promise.resolve()
    }

    if (this.initializationPromise) {
      return this.initializationPromise
    }

    this.initializationPromise = (async () => {
      try {
        const globalScope: any = typeof self !== 'undefined' ? self : typeof window !== 'undefined' ? window : null
        if (!globalScope) {
          throw new Error('Essentia.js can only be initialized in browser-like environments')
        }

        // Check if WebAssembly is supported
        if (typeof WebAssembly === 'undefined') {
          throw new Error('WebAssembly is not supported in this browser')
        }

        // Dynamically import Essentia.js modules (only in browser)
        // Use the proper Essentia.init() method as per Essentia.js documentation
        if (!Essentia) {
          try {
            // Try importing from the main entry point first
            const mainModule = await import('essentia.js')
            
            // Check if Essentia has an init() method (newer API)
            if (mainModule.default && typeof mainModule.default.init === 'function') {
              Essentia = mainModule.default
            } else if (mainModule.Essentia && typeof mainModule.Essentia.init === 'function') {
              Essentia = mainModule.Essentia
            } else if (typeof mainModule.init === 'function') {
              Essentia = mainModule
            } else {
              // Fallback to old API with separate WASM module
              const essentiaWasmModule = await import('essentia.js/dist/essentia-wasm.es.js')
              const essentiaCoreModule = await import('essentia.js/dist/essentia.js-core.es.js')
              
              EssentiaWASM = essentiaWasmModule.EssentiaWASM || essentiaWasmModule.default || essentiaWasmModule
              Essentia = essentiaCoreModule.default || essentiaCoreModule.Essentia || essentiaCoreModule
            }
          } catch (importError: any) {
            console.error('Failed to import Essentia.js modules:', importError)
            throw new Error(`Failed to import Essentia.js: ${importError.message}`)
          }
        }

        // Initialize Essentia.js using the proper init() method
        // This is the CORRECT way according to Essentia.js documentation
        try {
          if (typeof Essentia.init === 'function') {
            // New API: await Essentia.init()
            this.essentia = await Essentia.init()
            console.log('Essentia.js initialized successfully using Essentia.init()')
          } else if (EssentiaWASM) {
            // Fallback to old API: new Essentia(EssentiaWASM)
            this.essentia = new Essentia(EssentiaWASM)
            console.log('Essentia.js initialized successfully using new Essentia()')
          } else {
            throw new Error('Essentia.js init method not found')
          }
          this.isInitialized = true
        } catch (wasmError: any) {
          console.error('Failed to initialize Essentia.js:', wasmError)
          throw new Error(`Essentia.js initialization failed: ${wasmError.message}`)
        }
      } catch (error: any) {
        console.error('Failed to initialize Essentia.js:', error)
        // Reset promise so we can retry
        this.initializationPromise = null
        throw error
      }
    })()

    return this.initializationPromise
  }

  /**
   * Check if Essentia is initialized
   */
  private ensureInitialized(): void {
    if (!this.isInitialized || !this.essentia) {
      throw new Error(
        'Essentia.js is not initialized. Call initialize() first. ' +
        'If initialization failed, the app will use fallback detection methods.'
      )
    }
  }

  /**
   * Check if Essentia is available (for UI feedback)
   */
  isAvailable(): boolean {
    return this.isInitialized && this.essentia !== null
  }

  /**
   * Cleanup Essentia resources (called when worker resets)
   */
  async cleanup(): Promise<void> {
    if (!this.essentia) return

    try {
      if (typeof this.essentia.destroy === 'function') {
        this.essentia.destroy()
      } else if (typeof this.essentia.shutdown === 'function') {
        this.essentia.shutdown()
      } else if (typeof this.essentia.delete === 'function') {
        this.essentia.delete()
      }
    } catch (error) {
      console.warn('Essentia cleanup error:', error)
    } finally {
      this.essentia = null
      this.isInitialized = false
      this.initializationPromise = null
    }
  }

  /**
   * Convert AudioBuffer to mono Float32Array for Essentia
   */
  private audioBufferToMono(audioBuffer: AudioBuffer): Float32Array {
    const channelData = audioBuffer.getChannelData(0)
    
    // If mono, return as-is
    if (audioBuffer.numberOfChannels === 1) {
      return channelData
    }

    // If stereo or multi-channel, mix down to mono
    const mono = new Float32Array(audioBuffer.length)
    for (let i = 0; i < audioBuffer.numberOfChannels; i++) {
      const channel = audioBuffer.getChannelData(i)
      for (let j = 0; j < audioBuffer.length; j++) {
        mono[j] += channel[j] / audioBuffer.numberOfChannels
      }
    }
    
    return mono
  }

  /**
   * Detect onsets (transients) in audio using Essentia's onset detection
   */
  async detectOnsets(
    audioBuffer: AudioBuffer,
    options: {
      sensitivity?: number // 0-1, higher = more sensitive
      minDistance?: number // minimum time between onsets in seconds
      onProgress?: (progress: number) => void // Progress callback (0-1)
    } = {}
  ): Promise<OnsetResult> {
    this.ensureInitialized()

    const { sensitivity = 0.5, minDistance = 0.05, onProgress } = options
    const audioVector = this.audioBufferToMono(audioBuffer)
    const sampleRate = audioBuffer.sampleRate

    try {
      const frameSize = 2048
      const hopSize = 512
      const hannWindow = this.getHannWindow(frameSize)
      const onsetFunction: number[] = []
      let previousSpectrum: Float32Array | null = null

      const totalFrames = Math.max(1, Math.floor((audioVector.length - frameSize) / hopSize))
      const chunkSize = 10

      for (let i = 0, frameIndex = 0; i <= audioVector.length - frameSize; i += hopSize, frameIndex++) {
        if (frameIndex > 0 && frameIndex % chunkSize === 0) {
          await new Promise((resolve) => {
            if (typeof requestIdleCallback !== 'undefined') {
              requestIdleCallback(() => resolve(undefined), { timeout: 1 })
            } else {
              setTimeout(resolve, 0)
            }
          })
          if (onProgress) {
            onProgress(Math.min(1, frameIndex / totalFrames))
          }
        }

        const frameSlice = audioVector.subarray(i, i + frameSize)
        const windowedFrame = new Float32Array(frameSize)
        for (let j = 0; j < frameSize; j++) {
          windowedFrame[j] = frameSlice[j] * hannWindow[j]
        }

        const frameVector = this.essentia.arrayToVector(windowedFrame)
        const spectrum = this.essentia.Spectrum(frameVector)
        const spectrumVector = spectrum.spectrum || spectrum.vector || spectrum
        const magnitudeArray = this.essentia.vectorToArray(spectrumVector)

        let fluxValue = 0
        if (previousSpectrum) {
          const len = Math.min(previousSpectrum.length, magnitudeArray.length)
          for (let j = 0; j < len; j++) {
            const diff = magnitudeArray[j] - previousSpectrum[j]
            if (diff > 0) {
              fluxValue += diff
            }
          }
        }

        onsetFunction.push(fluxValue)
        previousSpectrum = new Float32Array(magnitudeArray)
      }

      if (onProgress) {
        onProgress(1)
      }

      const onsets: number[] = []
      const onsetTimes: number[] = []
      let lastOnsetFrame = -Infinity

      const threshold = this.calculateThreshold(onsetFunction, sensitivity)
      const minDistanceFrames = Math.floor((minDistance * sampleRate) / hopSize)

      for (let i = 1; i < onsetFunction.length - 1; i++) {
        if (
          onsetFunction[i] > threshold &&
          onsetFunction[i] > onsetFunction[i - 1] &&
          onsetFunction[i] > onsetFunction[i + 1]
        ) {
          if (i - lastOnsetFrame >= minDistanceFrames) {
            const timeInSeconds = (i * hopSize) / sampleRate
            const sampleIndex = Math.floor(timeInSeconds * sampleRate)
            onsets.push(sampleIndex)
            onsetTimes.push(timeInSeconds)
            lastOnsetFrame = i
          }
        }
      }

      return {
        timestamps: onsets,
        times: onsetTimes,
      }
    } catch (error) {
      console.error('Error in onset detection:', error)
      throw error
    }
  }

  /**
   * Detect BPM (tempo) of audio
   */
  async detectBPM(audioBuffer: AudioBuffer): Promise<BPMResult> {
    this.ensureInitialized()

    const audioVector = this.audioBufferToMono(audioBuffer)
    const sampleRate = audioBuffer.sampleRate

    // Ensure audioVector is a Float32Array (Essentia.js expects this)
    const audioVectorArray = audioVector instanceof Float32Array 
      ? audioVector 
      : new Float32Array(audioVector)

    // Convert Float32Array to VectorFloat using Essentia's arrayToVector method
    let audioVectorEssentia: any
    try {
      audioVectorEssentia = this.essentia.arrayToVector(audioVectorArray)
    } catch (convError) {
      console.warn('Failed to convert audio to VectorFloat, using default BPM:', convError)
      return {
        bpm: 120,
        confidence: 0,
      }
    }

    try {
      // Yield control before heavy BPM processing to prevent UI freezing
      await new Promise(resolve => setTimeout(resolve, 0))
      
      // Try RhythmExtractor2013 first
      let bpm = 120
      let confidence = 0
      
      try {
        const rhythm = this.essentia.RhythmExtractor2013(audioVectorEssentia)
        bpm = rhythm.bpm || rhythm.tempo || 120
        confidence = rhythm.confidence || 0
      } catch (e) {
        // Fallback: try RhythmExtractor (older version)
        try {
          const rhythm = this.essentia.RhythmExtractor(audioVectorEssentia, undefined, undefined, undefined, undefined, undefined, undefined, undefined, sampleRate)
          bpm = rhythm.bpm || rhythm.tempo || 120
          confidence = rhythm.confidence || 0
        } catch (e2) {
          console.warn('BPM detection methods failed, using default', e2)
          bpm = 120
          confidence = 0
        }
      }

      return {
        bpm: Math.round(bpm),
        confidence,
      }
    } catch (error) {
      console.warn('BPM detection error, using default:', error)
      return {
        bpm: 120,
        confidence: 0,
      }
    }
  }

  /**
   * Detect song structure (sections) using chroma and MFCC features
   */
  async detectSongStructure(
    audioBuffer: AudioBuffer,
    options: {
      maxSections?: number
      minSectionDuration?: number // in seconds
      onProgress?: (progress: number) => void // Progress callback (0-1)
    } = {}
  ): Promise<SongStructureResult> {
    this.ensureInitialized()

    const { maxSections = 8, minSectionDuration = 5, onProgress } = options
    const audioVector = this.audioBufferToMono(audioBuffer)
    const sampleRate = audioBuffer.sampleRate
    const duration = audioBuffer.duration

    try {
      // Extract chroma features for harmonic content
      const frameSize = 2048
      const hopSize = 512
      
      // Calculate chroma features frame by frame
      const chromaFeatures: number[][] = []
      const mfccFeatures: number[][] = []
      const energyProfile: number[] = []

      const numFrames = Math.floor((audioVector.length - frameSize) / hopSize)

      // Process frames with async yielding to prevent UI freezing
      const chunkSize = 5 // Process only 5 frames at a time before yielding (very aggressive)
      
      for (let i = 0; i < numFrames; i++) {
        // Yield control back to browser every chunkSize frames to prevent UI freezing
        // More frequent yielding = more responsive UI
        if (i > 0 && i % chunkSize === 0) {
          // Use requestIdleCallback if available, otherwise setTimeout
          await new Promise(resolve => {
            if (typeof requestIdleCallback !== 'undefined') {
              requestIdleCallback(() => resolve(undefined), { timeout: 1 })
            } else {
              setTimeout(resolve, 0)
            }
          })
          // Report progress (feature extraction is about 60% of total work)
          if (onProgress && numFrames > 0) {
            onProgress(0.6 * (i / numFrames))
          }
        }
        
        const start = i * hopSize
        const end = Math.min(start + frameSize, audioVector.length)
        // Create a new Float32Array by copying the slice to ensure proper format
        const frame = new Float32Array(audioVector.slice(start, end))

        // Convert Float32Array to VectorFloat using Essentia's arrayToVector method
        let frameVector: any
        try {
          frameVector = this.essentia.arrayToVector(frame)
        } catch (convError) {
          // If conversion fails, use simplified features
          const chroma = new Array(12).fill(0)
          for (let j = 0; j < Math.min(frame.length, 12); j++) {
            chroma[j] = Math.abs(frame[j] || 0)
          }
          chromaFeatures.push(chroma)
          
          const mfcc = new Array(13).fill(0)
          let sumSquared = 0
          for (let j = 0; j < frame.length; j++) {
            sumSquared += frame[j] * frame[j]
          }
          mfcc[1] = Math.sqrt(sumSquared / frame.length) // RMS
          mfccFeatures.push(mfcc)
          energyProfile.push(Math.sqrt(sumSquared / frame.length))
          continue
        }
        
        // Extract chroma using Essentia.js Chromagram
        // Chromagram expects a frame (VectorFloat), which we already have
        let chroma: number[] = []
        try {
          const chromaResult = this.essentia.Chromagram(frameVector, undefined, undefined, undefined, undefined, undefined, sampleRate)
          // Convert VectorFloat result back to array
          const chromaArray = this.essentia.vectorToArray(chromaResult.chromagram || chromaResult.vector || chromaResult)
          chroma = Array.from(chromaArray)
          if (!Array.isArray(chroma) || chroma.length !== 12) {
            chroma = new Array(12).fill(0)
          }
        } catch (e) {
          chroma = new Array(12).fill(0)
        }
        chromaFeatures.push(chroma)

        // Extract MFCC using Essentia.js
        // CORRECT PIPELINE: Frame → Windowing → Spectrum → MFCC
        let mfcc: number[] = []
        try {
          // Step 1: Apply windowing to frame (required before Spectrum)
          const windowed = this.essentia.Windowing(frameVector)
          const windowedVector = this.essentia.arrayToVector(windowed.frame || windowed.vector || windowed)
          
          // Step 2: Compute spectrum from windowed frame
          const spectrum = this.essentia.Spectrum(windowedVector)
          const spectrumVector = this.essentia.arrayToVector(spectrum.spectrum || spectrum.vector || spectrum)
          
          // Step 3: Compute MFCC from spectrum
          const mfccResult = this.essentia.MFCC(spectrumVector, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, 13, sampleRate)
          
          // Convert VectorFloat result back to array
          const mfccArray = this.essentia.vectorToArray(mfccResult.mfcc || mfccResult.bands || mfccResult)
          mfcc = Array.from(mfccArray)
          if (!Array.isArray(mfcc) || mfcc.length === 0) {
            mfcc = new Array(13).fill(0)
          }
        } catch (e) {
          // Fallback: use RMS or create empty vector
          try {
            const rms = this.essentia.RMS(frameVector)
            mfcc = [rms.rms || 0]
          } catch (e2) {
            mfcc = new Array(13).fill(0)
          }
        }
        mfccFeatures.push(mfcc.length > 0 ? mfcc : new Array(13).fill(0))

        // Calculate RMS energy
        let sumSquared = 0
        for (let j = 0; j < frame.length; j++) {
          sumSquared += frame[j] * frame[j]
        }
        energyProfile.push(Math.sqrt(sumSquared / frame.length))
      }

      // Report progress: feature extraction complete
      if (onProgress) {
        onProgress(0.6)
      }

      // Build self-similarity matrix using chroma features
      const similarityMatrix = this.buildSimilarityMatrix(chromaFeatures)
      
      // Report progress: similarity matrix complete
      if (onProgress) {
        onProgress(0.8)
      }

      // Apply novelty detection to find boundaries
      const boundaries = this.detectBoundaries(
        similarityMatrix,
        energyProfile,
        sampleRate,
        hopSize,
        duration,
        maxSections,
        minSectionDuration
      )
      
      // Report progress: boundaries detected
      if (onProgress) {
        onProgress(0.9)
      }

      // Label sections based on energy and position
      const labeledBoundaries = this.labelSections(boundaries, energyProfile, duration)

      // Report progress: labeling complete
      if (onProgress) {
        onProgress(0.95)
      }

      // Also detect BPM for the result
      const bpmResult = await this.detectBPM(audioBuffer)

      // Report completion
      if (onProgress) {
        onProgress(1.0)
      }

      return {
        boundaries: labeledBoundaries,
        bpm: bpmResult.bpm,
      }
    } catch (error) {
      console.error('Error in song structure detection:', error)
      // Report error completion so UI can update
      if (onProgress) {
        onProgress(1.0)
      }
      throw error
    }
  }

  /**
   * Build self-similarity matrix from feature vectors
   */
  private buildSimilarityMatrix(features: number[][]): number[][] {
    const n = features.length
    const matrix: number[][] = []

    for (let i = 0; i < n; i++) {
      matrix[i] = []
      for (let j = 0; j < n; j++) {
        // Cosine similarity
        const similarity = this.cosineSimilarity(features[i], features[j])
        matrix[i][j] = similarity
      }
    }

    return matrix
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0

    let dotProduct = 0
    let normA = 0
    let normB = 0

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i]
      normA += a[i] * a[i]
      normB += b[i] * b[i]
    }

    const denominator = Math.sqrt(normA) * Math.sqrt(normB)
    return denominator === 0 ? 0 : dotProduct / denominator
  }

  /**
   * Detect section boundaries using novelty detection on similarity matrix
   */
  private detectBoundaries(
    similarityMatrix: number[][],
    energyProfile: number[],
    sampleRate: number,
    hopSize: number,
    duration: number,
    maxSections: number,
    minSectionDuration: number
  ): SectionBoundary[] {
    const n = similarityMatrix.length
    const noveltyFunction: number[] = []

    // Calculate novelty function (checkerboard kernel)
    const kernelSize = Math.floor(3 * sampleRate / hopSize) // ~3 seconds
    for (let i = kernelSize; i < n - kernelSize; i++) {
      let novelty = 0
      for (let k = -kernelSize; k <= kernelSize; k++) {
        for (let l = -kernelSize; l <= kernelSize; l++) {
          const sign = (k * l >= 0) ? 1 : -1
          novelty += sign * similarityMatrix[i + k][i + l]
        }
      }
      noveltyFunction.push(novelty)
    }

    // Find peaks in novelty function (section boundaries)
    const threshold = this.calculateThreshold(noveltyFunction, 0.3)
    const boundaries: number[] = [0] // Always start at beginning

    for (let i = 1; i < noveltyFunction.length - 1; i++) {
      if (
        noveltyFunction[i] > threshold &&
        noveltyFunction[i] > noveltyFunction[i - 1] &&
        noveltyFunction[i] > noveltyFunction[i + 1]
      ) {
        const timeInSeconds = ((i + kernelSize) * hopSize) / sampleRate
        const minTime = boundaries.length > 0 
          ? (boundaries[boundaries.length - 1] * hopSize) / sampleRate + minSectionDuration
          : 0

        if (timeInSeconds >= minTime && timeInSeconds < duration - minSectionDuration) {
          boundaries.push(i + kernelSize)
        }
      }
    }

    // Always end at the end
    boundaries.push(n - 1)

    // Limit to maxSections by merging closest boundaries
    while (boundaries.length > maxSections + 1) {
      let minDistance = Number.POSITIVE_INFINITY
      let minIndex = -1

      for (let i = 0; i < boundaries.length - 1; i++) {
        const distance = boundaries[i + 1] - boundaries[i]
        if (distance < minDistance) {
          minDistance = distance
          minIndex = i
        }
      }

      if (minIndex >= 0) {
        boundaries.splice(minIndex + 1, 1)
      } else {
        break
      }
    }

    // Convert to SectionBoundary objects
    const sectionBoundaries: SectionBoundary[] = []
    for (let i = 0; i < boundaries.length - 1; i++) {
      const startFrame = boundaries[i]
      const endFrame = boundaries[i + 1]
      const startTime = (startFrame * hopSize) / sampleRate
      const endTime = (endFrame * hopSize) / sampleRate
      const startSample = Math.floor(startTime * sampleRate)
      const endSample = Math.floor(endTime * sampleRate)

      sectionBoundaries.push({
        startSample,
        endSample,
        startTime,
        endTime,
        label: '', // Will be labeled later
      })
    }

    return sectionBoundaries
  }

  /**
   * Label sections based on energy, position, and repetition patterns
   */
  private labelSections(
    boundaries: SectionBoundary[],
    energyProfile: number[],
    duration: number
  ): SectionBoundary[] {
    if (boundaries.length === 0) return boundaries

    // Calculate average energy for each section
    const sectionEnergies: number[] = []
    for (const boundary of boundaries) {
      const startFrame = Math.floor(boundary.startTime * 44.1) // Approximate frame index
      const endFrame = Math.floor(boundary.endTime * 44.1)
      let sum = 0
      let count = 0

      for (let i = startFrame; i < Math.min(endFrame, energyProfile.length); i++) {
        sum += energyProfile[i]
        count++
      }

      sectionEnergies.push(count > 0 ? sum / count : 0)
    }

    // Normalize energies
    const maxEnergy = Math.max(...sectionEnergies)
    const normalizedEnergies = sectionEnergies.map(e => maxEnergy > 0 ? e / maxEnergy : 0)

    // Label sections
    const labeledBoundaries = boundaries.map((boundary, index) => {
      const energy = normalizedEnergies[index]
      const position = boundary.startTime / duration
      let label = 'Section'

      // First section is usually Intro
      if (index === 0 && position < 0.1) {
        label = 'Intro'
      }
      // Last section is usually Outro
      else if (index === boundaries.length - 1 && position > 0.8) {
        label = 'Outro'
      }
      // High energy sections are usually Chorus
      else if (energy > 0.7) {
        label = 'Chorus'
      }
      // Medium energy sections are usually Verse
      else if (energy > 0.4) {
        label = 'Verse'
      }
      // Low energy sections might be Bridge or Breakdown
      else if (energy < 0.3) {
        label = position > 0.5 ? 'Bridge' : 'Break'
      }
      // Default to Verse
      else {
        label = 'Verse'
      }

      return {
        ...boundary,
        label: `${label} ${index + 1}`,
        confidence: energy,
      }
    })

    return labeledBoundaries
  }

  /**
   * Calculate adaptive threshold for peak detection
   */
  private calculateThreshold(values: number[], multiplier: number = 1.5): number {
    if (values.length === 0) return 0

    // Calculate median
    const sorted = [...values].sort((a, b) => a - b)
    const median = sorted[Math.floor(sorted.length / 2)]

    // Calculate median absolute deviation
    const deviations = values.map(v => Math.abs(v - median))
    const sortedDeviations = deviations.sort((a, b) => a - b)
    const mad = sortedDeviations[Math.floor(sortedDeviations.length / 2)]

    // Threshold is median + multiplier * MAD
    return median + multiplier * mad
  }

  private getHannWindow(size: number): Float32Array {
    const cached = this.windowCache.get(size)
    if (cached) {
      return cached
    }

    const window = new Float32Array(size)
    for (let n = 0; n < size; n++) {
      window[n] = 0.5 * (1 - Math.cos((2 * Math.PI * n) / (size - 1)))
    }
    this.windowCache.set(size, window)
    return window
  }
}

