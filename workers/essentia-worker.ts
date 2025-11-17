/// <reference lib="webworker" />

import { AudioAnalysisCore } from '../lib/audio-analysis-core'

interface WorkerRequest {
  id: number
  command: WorkerCommand
  payload?: any
}

type WorkerCommand =
  | 'INIT'
  | 'DETECT_ONSETS'
  | 'DETECT_BPM'
  | 'DETECT_STRUCTURE'
  | 'CLEANUP'

const ctx: DedicatedWorkerGlobalScope = self as any

let core: AudioAnalysisCore | null = null

async function ensureCore(): Promise<AudioAnalysisCore> {
  if (!core) {
    core = new AudioAnalysisCore()
    await core.initialize()
  }
  return core
}

function postMessageToClient(message: any) {
  ctx.postMessage(message)
}

function createMonoBuffer(samples: Float32Array, sampleRate: number, duration?: number) {
  return {
    sampleRate,
    numberOfChannels: 1,
    length: samples.length,
    duration: duration ?? samples.length / sampleRate,
    getChannelData: (channel: number) => {
      if (channel !== 0) {
        throw new Error('Only mono channel supported in worker buffer')
      }
      return samples
    },
  } as AudioBuffer
}

ctx.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const { id, command, payload } = event.data

  const postResult = (result: any) =>
    postMessageToClient({ id, event: 'result', payload: result })
  const postError = (error: any) =>
    postMessageToClient({
      id,
      event: 'error',
      error: { message: error?.message || String(error), stack: error?.stack },
    })
  const postProgress = (progress: number) =>
    postMessageToClient({ id, event: 'progress', payload: { progress } })

  try {
    switch (command) {
      case 'INIT': {
        await ensureCore()
        postMessageToClient({ id, event: 'initialized' })
        break
      }
      case 'DETECT_ONSETS': {
        const instance = await ensureCore()
        const buffer = createMonoBuffer(payload.samples, payload.sampleRate)
        const result = await instance.detectOnsets(buffer, {
          sensitivity: payload.options?.sensitivity,
          minDistance: payload.options?.minDistance,
          onProgress: postProgress,
        })
        postResult(result)
        break
      }
      case 'DETECT_BPM': {
        const instance = await ensureCore()
        const buffer = createMonoBuffer(payload.samples, payload.sampleRate)
        const result = await instance.detectBPM(buffer)
        postResult(result)
        break
      }
      case 'DETECT_STRUCTURE': {
        const instance = await ensureCore()
        const buffer = createMonoBuffer(payload.samples, payload.sampleRate, payload.duration)
        const result = await instance.detectSongStructure(buffer, {
          maxSections: payload.options?.maxSections,
          minSectionDuration: payload.options?.minSectionDuration,
          onProgress: postProgress,
        })
        postResult(result)
        break
      }
      case 'CLEANUP': {
        if (core) {
          await core.cleanup?.()
          core = null
        }
        postResult({})
        break
      }
      default:
        throw new Error(`Unknown worker command: ${command}`)
    }
  } catch (error) {
    postError(error)
  }
}

export {}
