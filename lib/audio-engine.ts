/**
 * Audio Engine - Handles Web Audio API functionality for the sampler
 */

export interface AudioSlice {
  id: number
  startSample: number
  endSample: number
  name: string
  sectionId?: number
}

export interface AudioSection {
  id: number
  startSample: number
  endSample: number
  name: string
  slices: AudioSlice[]
}

export interface PlaybackOptions {
  loop?: boolean
  loopStart?: number
  loopEnd?: number
  rate?: number
  volume?: number
  fadeIn?: number // ms
  fadeOut?: number // ms
}

class AudioEngine {
  private context: AudioContext | null = null
  private masterGainNode: GainNode | null = null
  private buffer: AudioBuffer | null = null
  private activeSourceNodes: Map<string, AudioBufferSourceNode> = new Map()
  private slices: AudioSlice[] = []
  private sections: AudioSection[] = []
  private analyserNode: AnalyserNode | null = null
  private isInitialized = false

  private currentSourceNode: AudioBufferSourceNode | null = null
  private currentGainNode: GainNode | null = null
  private playbackStartTime = 0
  private playbackStartOffset = 0

  // Initialize the audio engine
  initialize(): Promise<void> {
    if (this.isInitialized) return Promise.resolve()

    try {
      // Check if we're in a browser environment
      if (typeof window === "undefined") {
        return Promise.resolve()
      }

      // Use a safer way to access AudioContext
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext

      if (!AudioContext) {
        console.error("AudioContext not supported in this browser")
        return Promise.resolve()
      }

      this.context = new AudioContext()
      this.masterGainNode = this.context.createGain()
      this.masterGainNode.gain.value = 1.0

      this.analyserNode = this.context.createAnalyser()
      this.analyserNode.fftSize = 2048

      // Connect nodes: analyser -> masterGain -> destination
      this.analyserNode.connect(this.masterGainNode)
      this.masterGainNode.connect(this.context.destination)

      this.isInitialized = true
      return Promise.resolve()
    } catch (error) {
      console.error("Failed to initialize audio engine:", error)
      return Promise.reject(error)
    }
  }

  // Load and decode an audio file
  async loadAudioFile(file: File): Promise<AudioBuffer> {
    if (!this.isInitialized) await this.initialize()
    if (!this.context) throw new Error("Audio context not initialized")

    try {
      const arrayBuffer = await file.arrayBuffer()
      const audioBuffer = await this.context.decodeAudioData(arrayBuffer)
      this.buffer = audioBuffer
      return audioBuffer
    } catch (error) {
      console.error("Error decoding audio data:", error)
      throw error
    }
  }

  // Set the audio buffer directly
  setBuffer(buffer: AudioBuffer): void {
    this.buffer = buffer
  }

  // Get the current audio buffer
  getBuffer(): AudioBuffer | null {
    return this.buffer
  }

  // Set the master volume (0-1)
  setMasterVolume(volume: number): void {
    if (!this.masterGainNode) return
    // Convert from dB to linear if needed
    if (volume < 0) {
      // Assuming volume is in dB
      this.masterGainNode.gain.value = Math.pow(10, volume / 20)
    } else {
      // Assuming volume is 0-1
      this.masterGainNode.gain.value = Math.min(1, Math.max(0, volume))
    }
  }

  // Set slices for the current buffer
  setSlices(slices: AudioSlice[]): void {
    // Only update if the slices actually changed
    if (JSON.stringify(slices) !== JSON.stringify(this.slices)) {
      this.slices = slices
    }
  }

  // Get all slices
  getSlices(): AudioSlice[] {
    return this.slices
  }

  // Get a specific slice by ID
  getSlice(id: number): AudioSlice | undefined {
    return this.slices.find((slice) => slice.id === id)
  }

  // Set sections for the current buffer
  setSections(sections: AudioSection[]): void {
    // Only update if the sections actually changed
    if (JSON.stringify(sections) !== JSON.stringify(this.sections)) {
      this.sections = sections
    }
  }

  // Get all sections
  getSections(): AudioSection[] {
    return this.sections
  }

  // Get a specific section by ID
  getSection(id: number): AudioSection | undefined {
    return this.sections.find((section) => section.id === id)
  }

  // Play the entire buffer
  playBuffer(options: PlaybackOptions = {}): string | null {
    if (!this.buffer || !this.context || !this.masterGainNode || !this.analyserNode) return null

    // Resume audio context if it's suspended (needed for browsers with autoplay policies)
    if (this.context.state === "suspended") {
      this.context.resume()
    }

    // Create a source node
    const sourceNode = this.context.createBufferSource()
    sourceNode.buffer = this.buffer

    // Set playback rate
    if (options.rate !== undefined) {
      sourceNode.playbackRate.value = options.rate
    }

    // Create a gain node for this specific playback
    const gainNode = this.context.createGain()
    gainNode.gain.value = options.volume !== undefined ? options.volume : 1.0

    // Apply fade in if specified
    if (options.fadeIn && options.fadeIn > 0) {
      gainNode.gain.setValueAtTime(0, this.context.currentTime)
      gainNode.gain.linearRampToValueAtTime(
        options.volume !== undefined ? options.volume : 1.0,
        this.context.currentTime + options.fadeIn / 1000,
      )
    }

    // Apply fade out if specified and not looping
    if (options.fadeOut && options.fadeOut > 0 && !options.loop) {
      const duration = this.buffer.duration
      gainNode.gain.setValueAtTime(
        options.volume !== undefined ? options.volume : 1.0,
        this.context.currentTime + duration - options.fadeOut / 1000,
      )
      gainNode.gain.linearRampToValueAtTime(0, this.context.currentTime + duration)
    }

    // Set loop
    sourceNode.loop = options.loop || false

    // Set loop points if specified
    if (options.loop && options.loopStart !== undefined && options.loopEnd !== undefined) {
      sourceNode.loopStart = options.loopStart
      sourceNode.loopEnd = options.loopEnd
    }

    // Connect nodes: source -> gain -> analyser -> (rest of the chain)
    sourceNode.connect(gainNode)
    gainNode.connect(this.analyserNode)

    // Generate a unique ID for this playback
    const playbackId = `buffer-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

    // Store the source node so we can stop it later
    this.activeSourceNodes.set(playbackId, sourceNode)
    this.currentSourceNode = sourceNode
    this.currentGainNode = gainNode
    this.playbackStartTime = this.context.currentTime
    this.playbackStartOffset = 0

    // Start playback
    sourceNode.start()

    // Remove the source node when playback ends
    sourceNode.onended = () => {
      this.activeSourceNodes.delete(playbackId)
      if (this.currentSourceNode === sourceNode) {
        this.currentSourceNode = null
        this.currentGainNode = null
      }
    }

    return playbackId
  }

  // Play buffer from a specific position (in seconds)
  playBufferFromPosition(position: number, options: PlaybackOptions = {}): string | null {
    if (!this.buffer || !this.context || !this.masterGainNode || !this.analyserNode) return null

    // Resume audio context if it's suspended
    if (this.context.state === "suspended") {
      this.context.resume()
    }

    // Create a source node
    const sourceNode = this.context.createBufferSource()
    sourceNode.buffer = this.buffer

    // Set playback rate
    if (options.rate !== undefined) {
      sourceNode.playbackRate.value = options.rate
    }

    // Create a gain node for this specific playback
    const gainNode = this.context.createGain()
    gainNode.gain.value = options.volume !== undefined ? options.volume : 1.0

    // Apply fade in if specified
    if (options.fadeIn && options.fadeIn > 0) {
      gainNode.gain.setValueAtTime(0, this.context.currentTime)
      gainNode.gain.linearRampToValueAtTime(
        options.volume !== undefined ? options.volume : 1.0,
        this.context.currentTime + options.fadeIn / 1000,
      )
    }

    // Set loop
    sourceNode.loop = options.loop || false

    // Set loop points if specified
    if (options.loop && options.loopStart !== undefined && options.loopEnd !== undefined) {
      sourceNode.loopStart = options.loopStart
      sourceNode.loopEnd = options.loopEnd
    }

    // Connect nodes: source -> gain -> analyser -> (rest of the chain)
    sourceNode.connect(gainNode)
    gainNode.connect(this.analyserNode)

    // Generate a unique ID for this playback
    const playbackId = `buffer-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

    // Store the source node so we can stop it later
    this.activeSourceNodes.set(playbackId, sourceNode)
    this.currentSourceNode = sourceNode
    this.currentGainNode = gainNode
    this.playbackStartTime = this.context.currentTime
    this.playbackStartOffset = position

    // Start playback from the specified position
    sourceNode.start(0, position)

    // Remove the source node when playback ends
    sourceNode.onended = () => {
      this.activeSourceNodes.delete(playbackId)
      if (this.currentSourceNode === sourceNode) {
        this.currentSourceNode = null
        this.currentGainNode = null
      }
    }

    return playbackId
  }

  // Start playback with BPM control
  startPlayback(options: PlaybackOptions = {}): string | null {
    if (!this.buffer || !this.context || !this.masterGainNode || !this.analyserNode) return null

    // Resume audio context if it's suspended
    if (this.context.state === "suspended") {
      this.context.resume()
    }

    // Create a source node
    const sourceNode = this.context.createBufferSource()
    sourceNode.buffer = this.buffer

    // Set playback rate based on BPM if provided
    if (options.rate !== undefined) {
      sourceNode.playbackRate.value = options.rate
    }

    // Create a gain node for this specific playback
    const gainNode = this.context.createGain()
    gainNode.gain.value = options.volume !== undefined ? options.volume : 1.0

    // Apply fade in if specified
    if (options.fadeIn && options.fadeIn > 0) {
      gainNode.gain.setValueAtTime(0, this.context.currentTime)
      gainNode.gain.linearRampToValueAtTime(
        options.volume !== undefined ? options.volume : 1.0,
        this.context.currentTime + options.fadeIn / 1000,
      )
    }

    // Apply fade out if specified and not looping
    if (options.fadeOut && options.fadeOut > 0 && !options.loop) {
      const duration = this.buffer.duration
      gainNode.gain.setValueAtTime(
        options.volume !== undefined ? options.volume : 1.0,
        this.context.currentTime + duration - options.fadeOut / 1000,
      )
      gainNode.gain.linearRampToValueAtTime(0, this.context.currentTime + duration)
    }

    // Set loop
    sourceNode.loop = options.loop || false

    // Set loop points if specified
    if (options.loop && options.loopStart !== undefined && options.loopEnd !== undefined) {
      sourceNode.loopStart = options.loopStart
      sourceNode.loopEnd = options.loopEnd
    }

    // Connect nodes: source -> gain -> analyser -> (rest of the chain)
    sourceNode.connect(gainNode)
    gainNode.connect(this.analyserNode)

    // Generate a unique ID for this playback
    const playbackId = `playback-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

    // Store the source node so we can stop it later
    this.activeSourceNodes.set(playbackId, sourceNode)
    this.currentSourceNode = sourceNode
    this.currentGainNode = gainNode
    this.playbackStartTime = this.context.currentTime
    this.playbackStartOffset = 0

    // Start playback
    sourceNode.start()

    // Remove the source node when playback ends
    sourceNode.onended = () => {
      this.activeSourceNodes.delete(playbackId)
      if (this.currentSourceNode === sourceNode) {
        this.currentSourceNode = null
        this.currentGainNode = null
      }
    }

    return playbackId
  }

  // Play a specific slice by ID
  playSlice(sliceId: number, options: PlaybackOptions = {}): string | null {
    const slice = this.getSlice(sliceId)
    if (!slice || !this.buffer || !this.context || !this.masterGainNode || !this.analyserNode) return null

    // Resume audio context if it's suspended
    if (this.context.state === "suspended") {
      this.context.resume()
    }

    // Create a source node
    const sourceNode = this.context.createBufferSource()
    sourceNode.buffer = this.buffer

    // Set playback rate
    if (options.rate !== undefined) {
      sourceNode.playbackRate.value = options.rate
    }

    // Create a gain node for this specific playback
    const gainNode = this.context.createGain()
    gainNode.gain.value = options.volume !== undefined ? options.volume : 1.0

    // Apply fade in if specified
    if (options.fadeIn && options.fadeIn > 0) {
      gainNode.gain.setValueAtTime(0, this.context.currentTime)
      gainNode.gain.linearRampToValueAtTime(
        options.volume !== undefined ? options.volume : 1.0,
        this.context.currentTime + options.fadeIn / 1000,
      )
    }

    // Calculate slice duration
    const sliceDuration = (slice.endSample - slice.startSample) / this.buffer.sampleRate

    // Apply fade out if specified and not looping
    if (options.fadeOut && options.fadeOut > 0 && !options.loop) {
      gainNode.gain.setValueAtTime(
        options.volume !== undefined ? options.volume : 1.0,
        this.context.currentTime + sliceDuration - options.fadeOut / 1000,
      )
      gainNode.gain.linearRampToValueAtTime(0, this.context.currentTime + sliceDuration)
    }

    // Set loop
    sourceNode.loop = options.loop || false

    // Set loop points if specified and looping
    if (options.loop) {
      const startTime = slice.startSample / this.buffer.sampleRate
      const endTime = slice.endSample / this.buffer.sampleRate
      sourceNode.loopStart = startTime
      sourceNode.loopEnd = endTime
    }

    // Connect nodes: source -> gain -> analyser -> (rest of the chain)
    sourceNode.connect(gainNode)
    gainNode.connect(this.analyserNode)

    // Generate a unique ID for this playback
    const playbackId = `slice-${sliceId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

    // Store the source node so we can stop it later
    this.activeSourceNodes.set(playbackId, sourceNode)
    this.currentSourceNode = sourceNode
    this.currentGainNode = gainNode
    this.playbackStartTime = this.context.currentTime
    this.playbackStartOffset = slice.startSample / this.buffer.sampleRate

    // Start playback from the slice start position
    const startTime = slice.startSample / this.buffer.sampleRate
    const duration = (slice.endSample - slice.startSample) / this.buffer.sampleRate
    sourceNode.start(0, startTime, options.loop ? undefined : duration)

    // Remove the source node when playback ends
    sourceNode.onended = () => {
      this.activeSourceNodes.delete(playbackId)
      if (this.currentSourceNode === sourceNode) {
        this.currentSourceNode = null
        this.currentGainNode = null
      }
    }

    return playbackId
  }

  // Play a specific section by ID
  playSection(sectionId: number, options: PlaybackOptions = {}): string | null {
    const section = this.getSection(sectionId)
    if (!section || !this.buffer || !this.context || !this.masterGainNode || !this.analyserNode) return null

    // Resume audio context if it's suspended
    if (this.context.state === "suspended") {
      this.context.resume()
    }

    // Create a source node
    const sourceNode = this.context.createBufferSource()
    sourceNode.buffer = this.buffer

    // Set playback rate
    if (options.rate !== undefined) {
      sourceNode.playbackRate.value = options.rate
    }

    // Create a gain node for this specific playback
    const gainNode = this.context.createGain()
    gainNode.gain.value = options.volume !== undefined ? options.volume : 1.0

    // Apply fade in if specified
    if (options.fadeIn && options.fadeIn > 0) {
      gainNode.gain.setValueAtTime(0, this.context.currentTime)
      gainNode.gain.linearRampToValueAtTime(
        options.volume !== undefined ? options.volume : 1.0,
        this.context.currentTime + options.fadeIn / 1000,
      )
    }

    // Calculate section duration
    const sectionDuration = (section.endSample - section.startSample) / this.buffer.sampleRate

    // Apply fade out if specified and not looping
    if (options.fadeOut && options.fadeOut > 0 && !options.loop) {
      gainNode.gain.setValueAtTime(
        options.volume !== undefined ? options.volume : 1.0,
        this.context.currentTime + sectionDuration - options.fadeOut / 1000,
      )
      gainNode.gain.linearRampToValueAtTime(0, this.context.currentTime + sectionDuration)
    }

    // Set loop
    sourceNode.loop = options.loop || false

    // Set loop points if specified and looping
    if (options.loop) {
      const startTime = section.startSample / this.buffer.sampleRate
      const endTime = section.endSample / this.buffer.sampleRate
      sourceNode.loopStart = startTime
      sourceNode.loopEnd = endTime
    }

    // Connect nodes: source -> gain -> analyser -> (rest of the chain)
    sourceNode.connect(gainNode)
    gainNode.connect(this.analyserNode)

    // Generate a unique ID for this playback
    const playbackId = `section-${sectionId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

    // Store the source node so we can stop it later
    this.activeSourceNodes.set(playbackId, sourceNode)
    this.currentSourceNode = sourceNode
    this.currentGainNode = gainNode
    this.playbackStartTime = this.context.currentTime
    this.playbackStartOffset = section.startSample / this.buffer.sampleRate

    // Start playback from the section start position
    const startTime = section.startSample / this.buffer.sampleRate
    const duration = (section.endSample - section.startSample) / this.buffer.sampleRate
    sourceNode.start(0, startTime, options.loop ? undefined : duration)

    // Remove the source node when playback ends
    sourceNode.onended = () => {
      this.activeSourceNodes.delete(playbackId)
      if (this.currentSourceNode === sourceNode) {
        this.currentSourceNode = null
        this.currentGainNode = null
      }
    }

    return playbackId
  }

  // Stop playback by ID
  stopPlayback(playbackId: string): void {
    const sourceNode = this.activeSourceNodes.get(playbackId)
    if (sourceNode) {
      try {
        sourceNode.stop()
      } catch (e) {
        // Ignore errors if the source has already stopped
      }
      this.activeSourceNodes.delete(playbackId)
    }
  }

  // Stop all playback
  stopAllPlayback(): void {
    this.activeSourceNodes.forEach((sourceNode) => {
      try {
        sourceNode.stop()
      } catch (e) {
        // Ignore errors if the source has already stopped
      }
    })
    this.activeSourceNodes.clear()
    this.currentSourceNode = null
    this.currentGainNode = null
  }

  // Detect transients in the audio buffer
  detectTransients(sensitivity = 0.1, minDistance = 0.05, maxSlices = 16): AudioSlice[] {
    if (!this.buffer) return []

    // Simple mock implementation for transient detection
    // In a real implementation, this would analyze the audio data to find transients
    const slices: AudioSlice[] = []
    const bufferLength = this.buffer.length
    const sampleRate = this.buffer.sampleRate
    const minDistanceSamples = Math.floor(minDistance * sampleRate)

    // For demonstration, create evenly spaced slices
    const sliceCount = Math.min(maxSlices, Math.floor(1 / sensitivity))
    const sliceLength = Math.floor(bufferLength / sliceCount)

    for (let i = 0; i < sliceCount; i++) {
      const startSample = i * sliceLength
      const endSample = i === sliceCount - 1 ? bufferLength : (i + 1) * sliceLength
      slices.push({
        id: i,
        startSample,
        endSample,
        name: `Slice ${i + 1}`,
      })
    }

    this.slices = slices
    return slices
  }

  // Detect sections in the audio buffer (verse, chorus, etc.)
  detectSections(maxSections = 8): AudioSection[] {
    if (!this.buffer) return []

    const buffer = this.buffer
    const channelData = buffer.getChannelData(0)
    const sections: AudioSection[] = []

    // Calculate RMS energy across the buffer
    const blockSize = Math.floor(buffer.sampleRate * 0.5) // 500ms blocks
    const numBlocks = Math.floor(channelData.length / blockSize)
    const energyProfile: number[] = []

    for (let i = 0; i < numBlocks; i++) {
      let sum = 0
      const startSample = i * blockSize
      const endSample = Math.min(startSample + blockSize, channelData.length)

      for (let j = startSample; j < endSample; j++) {
        sum += channelData[j] * channelData[j]
      }

      const rms = Math.sqrt(sum / (endSample - startSample))
      energyProfile.push(rms)
    }

    // Smooth the energy profile
    const smoothedProfile: number[] = []
    const smoothingWindow = 5

    for (let i = 0; i < energyProfile.length; i++) {
      let windowSum = 0
      let count = 0

      for (let j = Math.max(0, i - smoothingWindow); j < Math.min(energyProfile.length, i + smoothingWindow + 1); j++) {
        windowSum += energyProfile[j]
        count++
      }

      smoothedProfile.push(windowSum / count)
    }

    // Find significant changes in energy (potential section boundaries)
    const changeThreshold = 0.1
    const boundaries: number[] = [0] // Always include the start

    for (let i = 1; i < smoothedProfile.length - 1; i++) {
      const prevEnergy = smoothedProfile[i - 1]
      const currEnergy = smoothedProfile[i]
      const nextEnergy = smoothedProfile[i + 1]

      // Check for significant change in energy
      if (
        Math.abs(currEnergy - prevEnergy) / prevEnergy > changeThreshold ||
        Math.abs(nextEnergy - currEnergy) / currEnergy > changeThreshold
      ) {
        boundaries.push(i * blockSize)
      }
    }

    // Always include the end
    boundaries.push(channelData.length - 1)

    // Limit to maxSections by merging closest boundaries if needed
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

      // Remove the boundary at the end of the shortest section
      if (minIndex >= 0) {
        boundaries.splice(minIndex + 1, 1)
      }
    }

    // Sort boundaries (just in case)
    boundaries.sort((a, b) => a - b)

    // Create sections from boundaries
    for (let i = 0; i < boundaries.length - 1; i++) {
      const startSample = boundaries[i]
      const endSample = boundaries[i + 1]

      // Skip very short sections
      if (endSample - startSample < buffer.sampleRate * 0.5) continue

      // Determine section type based on energy
      let sectionType = "Section"
      const sectionEnergy = this.calculateSectionEnergy(channelData, startSample, endSample)

      if (i === 0) {
        sectionType = "Intro"
      } else if (i === boundaries.length - 2) {
        sectionType = "Outro"
      } else if (sectionEnergy > 0.7) {
        sectionType = "Chorus"
      } else if (sectionEnergy > 0.4) {
        sectionType = "Verse"
      } else if (sectionEnergy < 0.3) {
        sectionType = "Break"
      }

      // Create slices within each section
      const slicesPerSection = 4
      const sectionLength = endSample - startSample
      const sliceLength = Math.floor(sectionLength / slicesPerSection)
      const sectionSlices: AudioSlice[] = []

      for (let j = 0; j < slicesPerSection; j++) {
        const sliceStartSample = startSample + j * sliceLength
        const sliceEndSample = j === slicesPerSection - 1 ? endSample : startSample + (j + 1) * sliceLength
        sectionSlices.push({
          id: i * slicesPerSection + j,
          startSample: sliceStartSample,
          endSample: sliceEndSample,
          name: `${sectionType}${i + 1}-${j + 1}`,
          sectionId: i,
        })
      }

      sections.push({
        id: i,
        startSample,
        endSample,
        name: `${sectionType} ${i + 1}`,
        slices: sectionSlices,
      })
    }

    this.sections = sections
    // Flatten all slices from all sections
    this.slices = sections.flatMap((section) => section.slices)
    return sections
  }

  // Helper method to calculate energy in a section
  private calculateSectionEnergy(channelData: Float32Array, startSample: number, endSample: number): number {
    let sum = 0
    const length = endSample - startSample

    for (let i = startSample; i < endSample; i++) {
      sum += Math.abs(channelData[i])
    }

    return sum / length
  }

  updatePlaybackRate(playbackId: string, rate: number): void {
    const sourceNode = this.activeSourceNodes.get(playbackId)
    if (sourceNode && this.context) {
      // Smoothly transition to new rate over 10ms to avoid clicks
      sourceNode.playbackRate.setTargetAtTime(rate, this.context.currentTime, 0.01)
    }
  }

  getCurrentPlaybackPosition(): number {
    if (!this.currentSourceNode || !this.context || !this.buffer) return 0

    const elapsed = this.context.currentTime - this.playbackStartTime
    const rate = this.currentSourceNode.playbackRate.value
    const position = this.playbackStartOffset + elapsed * rate

    // Normalize to 0-1 range
    return Math.min(1, Math.max(0, position / this.buffer.duration))
  }

  // Clean up resources
  dispose(): void {
    this.stopAllPlayback()
    if (this.context) {
      this.context.close().catch(console.error)
    }
    this.context = null
    this.masterGainNode = null
    this.analyserNode = null
    this.buffer = null
    this.slices = []
    this.sections = []
    this.isInitialized = false
  }
}

// Create a singleton instance
export const audioEngine = new AudioEngine()
