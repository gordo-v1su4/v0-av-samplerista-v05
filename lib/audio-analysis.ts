import type {
  BPMResult,
  OnsetResult,
  SongStructureResult,
} from './audio-analysis-core'

interface AudioWorkerRequest {
  id: number
  command: WorkerCommand
  payload?: any
}

interface AudioWorkerResponse {
  id: number
  event: 'result' | 'error' | 'progress' | 'initialized'
  payload?: any
  error?: { message: string; stack?: string }
}

type WorkerCommand =
  | 'INIT'
  | 'DETECT_ONSETS'
  | 'DETECT_BPM'
  | 'DETECT_STRUCTURE'
  | 'CLEANUP'

const createWorker = () =>
  new Worker(new URL('../workers/essentia-worker.ts', import.meta.url), {
    type: 'module',
  })

class AudioAnalysisWorkerClient {
  private worker?: Worker
  private initialized = false
  private nextId = 0
  private pending = new Map<
    number,
    {
      resolve: (value: any) => void
      reject: (reason: any) => void
      onProgress?: (progress: number) => void
    }
  >()

  private ensureWorker(): Worker {
    if (!this.worker) {
      this.worker = createWorker()
      this.worker.onmessage = (event: MessageEvent<AudioWorkerResponse>) => {
        const { id, event: type, payload, error } = event.data
        const request = this.pending.get(id)
        if (!request) return

        if (type === 'progress') {
          request.onProgress?.(payload?.progress ?? 0)
          return
        }

        if (type === 'error') {
          request.reject(new Error(error?.message || 'Worker error'))
        } else {
          request.resolve(payload)
        }
        this.pending.delete(id)
      }
    }
    return this.worker
  }

  private sendRequest<T>(
    command: WorkerCommand,
    payload?: any,
    transfer: Transferable[] = [],
    onProgress?: (progress: number) => void
  ): Promise<T> {
    const worker = this.ensureWorker()
    const id = ++this.nextId

    const promise = new Promise<T>((resolve, reject) => {
      this.pending.set(id, { resolve, reject, onProgress })
      const message: AudioWorkerRequest = { id, command, payload }
      worker.postMessage(message, transfer)
    })

    return promise
  }

  async initialize(): Promise<void> {
    if (this.initialized) return
    await this.sendRequest('INIT')
    this.initialized = true
  }

  isAvailable(): boolean {
    return this.initialized
  }

  async cleanup(): Promise<void> {
    if (!this.worker) return
    try {
      await this.sendRequest('CLEANUP')
    } finally {
      this.worker.terminate()
      this.worker = undefined
      this.initialized = false
      this.pending.clear()
    }
  }

  private audioBufferToMono(audioBuffer: AudioBuffer) {
    let samples: Float32Array
    if (audioBuffer.numberOfChannels === 1) {
      samples = new Float32Array(audioBuffer.getChannelData(0))
    } else {
      const left = audioBuffer.getChannelData(0)
      const right = audioBuffer.getChannelData(1)
      samples = new Float32Array(audioBuffer.length)
      for (let i = 0; i < audioBuffer.length; i++) {
        samples[i] = (left[i] + right[i]) / 2
      }
    }

    return {
      samples,
      sampleRate: audioBuffer.sampleRate,
      duration: audioBuffer.duration,
    }
  }

  async detectOnsets(
    audioBuffer: AudioBuffer,
    options: {
      sensitivity?: number
      minDistance?: number
      onProgress?: (progress: number) => void
    } = {}
  ): Promise<OnsetResult> {
    await this.initialize()

    const { samples, sampleRate } = this.audioBufferToMono(audioBuffer)
    const { sensitivity = 0.5, minDistance = 0.05, onProgress } = options

    return this.sendRequest<OnsetResult>(
      'DETECT_ONSETS',
      {
        samples,
        sampleRate,
        options: { sensitivity, minDistance },
      },
      [samples.buffer],
      onProgress
    )
  }

  async detectBPM(audioBuffer: AudioBuffer): Promise<BPMResult> {
    await this.initialize()

    const { samples, sampleRate } = this.audioBufferToMono(audioBuffer)

    return this.sendRequest<BPMResult>(
      'DETECT_BPM',
      { samples, sampleRate },
      [samples.buffer]
    )
  }

  async detectSongStructure(
    audioBuffer: AudioBuffer,
    options: {
      maxSections?: number
      minSectionDuration?: number
      onProgress?: (progress: number) => void
    } = {}
  ): Promise<SongStructureResult> {
    await this.initialize()

    const { samples, sampleRate, duration } = this.audioBufferToMono(audioBuffer)
    const { maxSections = 8, minSectionDuration = 5, onProgress } = options

    return this.sendRequest<SongStructureResult>(
      'DETECT_STRUCTURE',
      {
        samples,
        sampleRate,
        duration,
        options: { maxSections, minSectionDuration },
      },
      [samples.buffer],
      onProgress
    )
  }
}

export const audioAnalysisService = new AudioAnalysisWorkerClient()

