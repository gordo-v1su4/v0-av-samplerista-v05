"use client"

import { useState, useEffect, useRef } from "react"
import { AppShell } from "@/components/app-shell"
import WaveformWavesurfer from "@/components/waveform-wavesurfer"
import { TransportControls } from "@/components/transport-controls"
import DrumPads from "@/components/drum-pads"
import VideoDisplay from "@/components/video-display"
import Sequencer from "@/components/sequencer"
import EffectsPanel from "@/components/effects-panel"
import MasterControls from "@/components/master-controls"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { AudioWaveform as Waveform, Video, Music, Sliders } from 'lucide-react'
import { audioEngine, type AudioSlice, type AudioSection } from "@/lib/audio-engine"
import { mediaLibrary } from "@/lib/media-library"

export default function AudioSampler() {
  const [audioBuffer, setAudioBuffer] = useState<AudioBuffer | null>(null)
  const [videoFile, setVideoFile] = useState<File | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isLooping, setIsLooping] = useState(false)
  const [currentSlice, setCurrentSlice] = useState<number | null>(null)
  const [currentSection, setCurrentSection] = useState<number | null>(null)
  const [currentAnnotation, setCurrentAnnotation] = useState<string | null>(null)
  const [slices, setSlices] = useState<AudioSlice[]>([])
  const [sections, setSections] = useState<AudioSection[]>([])
  const [bpm, setBpm] = useState(120)
  const [masterVolume, setMasterVolume] = useState(80)
  const [activePad, setActivePad] = useState<number | null>(null)
  const [activeTab, setActiveTab] = useState("audio")
  const [currentPlaybackId, setCurrentPlaybackId] = useState<string | null>(null)
  const [loopStart, setLoopStart] = useState(0)
  const [loopEnd, setLoopEnd] = useState(1)
  const [playbackPosition, setPlaybackPosition] = useState(0)
  const [currentMediaId, setCurrentMediaId] = useState<string | null>(null)
  const bpmRef = useRef(120)

  useEffect(() => {
    let isInitialized = false
    let cleanup = false

    if (!isInitialized && !cleanup) {
      isInitialized = true
      audioEngine.initialize().catch((err) => {
        console.error("Failed to initialize audio engine:", err)
        // Continue rendering the UI even if audio fails
      })
    }

    return () => {
      cleanup = true
      try {
        audioEngine.dispose()
      } catch (err) {
        console.error("Error disposing audio engine:", err)
      }
    }
  }, [])

  const handleAudioLoad = (buffer: AudioBuffer, detectedSlices: AudioSlice[], detectedSections: AudioSection[]) => {
    // Only update if the buffer actually changed
    if (buffer !== audioBuffer) {
      setAudioBuffer(buffer)
    }

    // Only update slices if they've actually changed
    if (JSON.stringify(detectedSlices) !== JSON.stringify(slices)) {
      setSlices(detectedSlices)
    }

    // Only update sections if they've actually changed
    if (JSON.stringify(detectedSections) !== JSON.stringify(sections)) {
      setSections(detectedSections)
    }
  }

  const handleVideoFileLoad = (file: File) => {
    setVideoFile(file)
  }

  const togglePlayback = () => {
    if (isPlaying) {
      // Stop playback
      if (currentPlaybackId) {
        audioEngine.stopPlayback(currentPlaybackId)
        setCurrentPlaybackId(null)
      }
      setIsPlaying(false)
    } else {
      // Start playback
      if (audioBuffer) {
        // Calculate playback rate based on BPM (120 BPM is the base rate)
        const playbackRate = bpm / 120

        const options: any = {
          loop: isLooping,
          volume: masterVolume / 100,
          rate: playbackRate,
        }

        if (isLooping) {
          options.loopStart = loopStart * audioBuffer.duration
          options.loopEnd = loopEnd * audioBuffer.duration
        }

        // Start from current playback position
        const startPosition = playbackPosition * audioBuffer.duration
        const playbackId = audioEngine.playBufferFromPosition(startPosition, options)

        if (playbackId) {
          setCurrentPlaybackId(playbackId)
          setIsPlaying(true)
        }
      }
    }
  }

  const stopPlayback = () => {
    if (currentPlaybackId) {
      audioEngine.stopPlayback(currentPlaybackId)
      setCurrentPlaybackId(null)
    }
    setIsPlaying(false)
  }

  const toggleLoop = () => {
    setIsLooping(!isLooping)
  }

  const handlePadClick = (index: number) => {
    setActivePad(index)

    // Find the slice with this index
    const slice = slices.find((s) => s.id === index)
    if (slice && audioBuffer) {
      const newPosition = slice.startSample / audioBuffer.length
      setPlaybackPosition(newPosition)
      setCurrentSlice(index)

      // Update current media for video playback
      const media = mediaLibrary.getMediaForSlice(index)
      if (media) {
        setCurrentMediaId(media.id)
      }

      // If currently playing, seek to this position
      if (isPlaying && currentPlaybackId) {
        audioEngine.stopPlayback(currentPlaybackId)

        const options: any = {
          loop: isLooping,
          volume: masterVolume / 100,
          rate: bpm / 120,
        }

        if (isLooping) {
          options.loopStart = loopStart * audioBuffer.duration
          options.loopEnd = loopEnd * audioBuffer.duration
        }

        const newPlaybackId = audioEngine.playBufferFromPosition(newPosition * audioBuffer.duration, options)
        if (newPlaybackId) {
          setCurrentPlaybackId(newPlaybackId)
        }
      }
    }
  }

  const handleSkipForward = () => {
    // Implementation for skip forward
    // For example, skip to the next slice
    if (currentSlice !== null && slices.length > 0) {
      const nextSlice = (currentSlice + 1) % slices.length
      handlePadClick(nextSlice)
    }
  }

  const handleSkipBack = () => {
    // Implementation for skip back
    // For example, skip to the previous slice
    if (currentSlice !== null && slices.length > 0) {
      const prevSlice = (currentSlice - 1 + slices.length) % slices.length
      handlePadClick(prevSlice)
    }
  }

  const handlePause = () => {
    stopPlayback()
  }

  useEffect(() => {
    audioEngine.setMasterVolume(masterVolume / 100) // Convert 0-100 to 0-1
  }, [masterVolume])

  const [effects, setEffects] = useState([
    {
      id: "effect1",
      name: "Reverb",
      enabled: true,
      parameters: [
        { name: "Size", value: 50 },
        { name: "Decay", value: 30 },
        { name: "Mix", value: 40 },
      ],
    },
    {
      id: "effect2",
      name: "Delay",
      enabled: false,
      parameters: [
        { name: "Time", value: 120 },
        { name: "Feedback", value: 40 },
        { name: "Mix", value: 50 },
      ],
    },
  ])

  const toggleEffect = (id: string) => {
    setEffects(effects.map((effect) => (effect.id === id ? { ...effect, enabled: !effect.enabled } : effect)))
  }

  const updateEffectParam = (id: string, paramName: string, value: number) => {
    setEffects(
      effects.map((effect) =>
        effect.id === id
          ? {
              ...effect,
              parameters: effect.parameters.map((param) => (param.name === paramName ? { ...param, value } : param)),
            }
          : effect,
      ),
    )
  }

  const handlePlaybackPositionChange = (position: number) => {
    setPlaybackPosition(position)
  }

  const handleCurrentSliceChange = (sliceId: number | null) => {
    setCurrentSlice(sliceId)
    if (sliceId !== null) {
      setActivePad(sliceId)
    }
  }

  const handleCurrentSectionChange = (sectionId: number | null) => {
    setCurrentSection(sectionId)
  }

  const handleCurrentAnnotationChange = (annotationId: string | null) => {
    setCurrentAnnotation(annotationId)
  }

  useEffect(() => {
    bpmRef.current = bpm
  }, [bpm])

  useEffect(() => {
    if (isPlaying && currentPlaybackId && audioBuffer) {
      // Stop current playback
      audioEngine.stopPlayback(currentPlaybackId)

      // Restart with new BPM from current position
      const playbackRate = bpm / 120
      const options: any = {
        loop: isLooping,
        volume: masterVolume / 100,
        rate: playbackRate,
      }

      if (isLooping) {
        options.loopStart = loopStart * audioBuffer.duration
        options.loopEnd = loopEnd * audioBuffer.duration
      }

      // Continue from current position
      const startPosition = playbackPosition * audioBuffer.duration
      const newPlaybackId = audioEngine.playBufferFromPosition(startPosition, options)

      if (newPlaybackId) {
        setCurrentPlaybackId(newPlaybackId)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bpm])

  return (
    <AppShell>
      <div className="flex flex-col h-full">
        <Tabs defaultValue="audio" value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
          <div className="border-b border-zinc-800 bg-zinc-900">
            <TabsList className="h-12 bg-transparent border-b-0 p-0">
              <TabsTrigger
                value="audio"
                className="data-[state=active]:bg-zinc-800 data-[state=active]:text-yellow-400 rounded-none border-r border-zinc-800 h-full px-6"
              >
                <Waveform className="h-4 w-4 mr-2" />
                Audio
              </TabsTrigger>
              <TabsTrigger
                value="video"
                className="data-[state=active]:bg-zinc-800 data-[state=active]:text-yellow-400 rounded-none border-r border-zinc-800 h-full px-6"
              >
                <Video className="h-4 w-4 mr-2" />
                Video
              </TabsTrigger>
              <TabsTrigger
                value="sequencer"
                className="data-[state=active]:bg-zinc-800 data-[state=active]:text-yellow-400 rounded-none border-r border-zinc-800 h-full px-6"
              >
                <Music className="h-4 w-4 mr-2" />
                Sequencer
              </TabsTrigger>
              <TabsTrigger
                value="mixer"
                className="data-[state=active]:bg-zinc-800 data-[state=active]:text-yellow-400 rounded-none h-full px-6"
              >
                <Sliders className="h-4 w-4 mr-2" />
                Mixer
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="flex-1 overflow-auto">
            <TabsContent value="audio" className="p-4 m-0 h-full">
              <div className="flex flex-col lg:flex-row gap-4 h-full">
                <div className="flex flex-col gap-4 w-full lg:w-2/3">
                  <div className="flex flex-col gap-2">
                    <h2 className="text-xl font-bold text-zinc-100">Audio Waveform</h2>
                    <WaveformWavesurfer
                      onAudioLoad={handleAudioLoad}
                      onPlaybackPositionChange={handlePlaybackPositionChange}
                      onCurrentSliceChange={handleCurrentSliceChange}
                      onCurrentSectionChange={handleCurrentSectionChange}
                      onCurrentAnnotationChange={handleCurrentAnnotationChange}
                      isPlaying={isPlaying}
                      onTogglePlayback={togglePlayback}
                      bpm={bpm}
                      onBpmChange={setBpm}
                      isLooping={isLooping}
                      onToggleLoop={toggleLoop}
                      onSkipForward={handleSkipForward}
                      onSkipBack={handleSkipBack}
                      onPause={handlePause}
                    />

                    <div className="mt-2">
                      <h3 className="text-sm font-semibold text-zinc-300 mb-2">Annotations</h3>
                      <div className="p-3 border border-zinc-800 rounded-md bg-zinc-900/50 min-h-[60px] flex items-center justify-center">
                        <p className="text-xs text-zinc-500">
                          Annotations will appear here when created from sections
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-4 w-full lg:w-1/3">
                  <div className="flex flex-col gap-2">
                    <h2 className="text-xl font-bold text-zinc-100">
                      Slice Navigator
                      {currentAnnotation && (
                        <span className="text-sm font-normal text-green-400 ml-2">• Word/Phrase Mode</span>
                      )}
                    </h2>
                    <DrumPads
                      slices={slices}
                      activePad={activePad}
                      handlePadClick={handlePadClick}
                      buffer={audioBuffer}
                      isPlaying={isPlaying}
                      playbackPosition={playbackPosition}
                      currentSlice={currentSlice}
                      currentAnnotation={currentAnnotation}
                    />
                  </div>

                  <div className="flex flex-col gap-2">
                    <h2 className="text-xl font-bold text-zinc-100">Effects</h2>
                    <EffectsPanel effects={effects} toggleEffect={toggleEffect} updateEffectParam={updateEffectParam} />
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="video" className="p-4 m-0 h-full">
              <div className="flex flex-col lg:flex-row gap-4 h-full">
                <div className="flex flex-col gap-4 w-full lg:w-2/3">
                  <div className="flex flex-col gap-2">
                    <h2 className="text-xl font-bold text-zinc-100">Video Preview</h2>
                    <VideoDisplay
                      currentMediaId={currentMediaId}
                      isPlaying={isPlaying}
                      playbackPosition={playbackPosition}
                      onMediaLibraryUpdate={() => {
                        setActivePad(null)
                        setTimeout(() => setActivePad(activePad), 0)
                      }}
                    />
                  </div>

                  <div className="flex flex-col gap-2">
                    <h2 className="text-xl font-bold text-zinc-100">Video Timeline</h2>
                    <div className="h-32 bg-zinc-900 border border-zinc-800 rounded-md p-4 flex items-center justify-center">
                      <p className="text-zinc-500">Video timeline with markers from audio slices</p>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-4 w-full lg:w-1/3">
                  <div className="flex flex-col gap-2">
                    <h2 className="text-lg font-bold text-zinc-100">Video Effects</h2>
                    <div className="border border-zinc-800 rounded-md p-4 bg-zinc-900/50">
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-zinc-300">Brightness</span>
                          <span className="text-xs text-zinc-500">100%</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-zinc-300">Contrast</span>
                          <span className="text-xs text-zinc-500">100%</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-zinc-300">Saturation</span>
                          <span className="text-xs text-zinc-500">100%</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-zinc-300">Blur</span>
                          <span className="text-xs text-zinc-500">0px</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    <h2 className="text-lg font-bold text-zinc-100">Video Transitions</h2>
                    <div className="border border-zinc-800 rounded-md p-4 bg-zinc-900/50">
                      <div className="grid grid-cols-2 gap-2">
                        <div className="p-2 border border-zinc-700 rounded bg-zinc-800 text-center text-sm">Fade</div>
                        <div className="p-2 border border-zinc-700 rounded bg-zinc-800 text-center text-sm">
                          Dissolve
                        </div>
                        <div className="p-2 border border-zinc-700 rounded bg-zinc-800 text-center text-sm">Wipe</div>
                        <div className="p-2 border border-zinc-700 rounded bg-zinc-800 text-center text-sm">Zoom</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="sequencer" className="p-4 m-0 h-full">
              <div className="flex flex-col gap-4">
                <h2 className="text-xl font-bold text-zinc-100">Step Sequencer</h2>
                <Sequencer tracks={8} steps={16} initialSequence={undefined} onSequenceChange={() => {}} />

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
                  <div className="flex flex-col gap-2">
                    <h3 className="text-lg font-bold text-zinc-100">Pattern Controls</h3>
                    <div className="border border-zinc-800 rounded-md p-4 bg-zinc-900/50">
                      <div className="grid grid-cols-4 gap-2">
                        <div className="p-2 border border-zinc-700 rounded bg-zinc-800 text-center text-sm">
                          Pattern 1
                        </div>
                        <div className="p-2 border border-zinc-700 rounded bg-zinc-800 text-center text-sm">
                          Pattern 2
                        </div>
                        <div className="p-2 border border-zinc-700 rounded bg-zinc-800 text-center text-sm">
                          Pattern 3
                        </div>
                        <div className="p-2 border border-zinc-700 rounded bg-zinc-800 text-center text-sm">
                          Pattern 4
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    <h3 className="text-lg font-bold text-zinc-100">Track Settings</h3>
                    <div className="border border-zinc-800 rounded-md p-4 bg-zinc-900/50">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-zinc-300">Track 1: Kick</span>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-zinc-500">M</span>
                            <span className="text-xs text-zinc-500">S</span>
                          </div>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-zinc-300">Track 2: Snare</span>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-zinc-500">M</span>
                            <span className="text-xs text-zinc-500">S</span>
                          </div>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-zinc-300">Track 3: Hi-Hat</span>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-zinc-500">M</span>
                            <span className="text-xs text-zinc-500">S</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="mixer" className="p-4 m-0 h-full">
              <div className="flex flex-col gap-4">
                <h2 className="text-xl font-bold text-zinc-100">Mixer</h2>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  <div className="flex flex-col gap-2 lg:col-span-2">
                    <h3 className="text-lg font-bold text-zinc-100">Channel Mixer</h3>
                    <div className="border border-zinc-800 rounded-md p-4 bg-zinc-900/50 h-64 flex items-end justify-around">
                      {[1, 2, 3, 4, 5, 6, 7, 8].map((channel) => (
                        <div key={channel} className="flex flex-col items-center gap-2 h-full">
                          <div className="flex-1 w-12 bg-zinc-800 rounded-sm relative overflow-hidden">
                            <div
                              className="absolute bottom-0 left-0 right-0 bg-yellow-500"
                              style={{ height: `${Math.random() * 70 + 10}%` }}
                            ></div>
                          </div>
                          <div className="w-8 h-8 rounded-full bg-zinc-800 border border-zinc-700"></div>
                          <span className="text-xs text-zinc-400">Ch {channel}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    <h2 className="text-xl font-bold text-zinc-100">Master Controls</h2>
                    <MasterControls />
                  </div>
                </div>

                <div className="mt-4">
                  <h3 className="text-lg font-bold text-zinc-100 mb-2">Global Effects</h3>
                  <EffectsPanel effects={effects} toggleEffect={toggleEffect} updateEffectParam={updateEffectParam} />
                </div>
              </div>
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </AppShell>
  )
}
