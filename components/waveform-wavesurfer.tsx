"use client"

import { useEffect, useLayoutEffect, useRef, useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Play, Pause, Upload, ZoomIn, ZoomOut, Wand2, Repeat } from "lucide-react"
import { cn } from "@/lib/utils"
import { audioEngine, type AudioSlice, type AudioSection } from "@/lib/audio-engine"
import { TransportControls } from "@/components/transport-controls"

interface WaveformWavesurferProps {
  onAudioLoad: (buffer: AudioBuffer, slices: AudioSlice[], sections: AudioSection[]) => void
  onPlaybackPositionChange?: (position: number) => void
  onCurrentSliceChange?: (sliceId: number | null) => void
  onCurrentSectionChange?: (sectionId: number | null) => void
  onCurrentAnnotationChange?: (annotationId: string | null) => void
  isPlaying?: boolean
  onTogglePlayback?: () => void
  bpm?: number
  onBpmChange?: (bpm: number) => void
  isLooping?: boolean
  onToggleLoop?: () => void
  onSkipForward?: () => void
  onSkipBack?: () => void
  onPause?: () => void
}

export default function WaveformWavesurfer({
  onAudioLoad,
  onPlaybackPositionChange,
  onCurrentSliceChange,
  onCurrentSectionChange,
  onCurrentAnnotationChange,
  isPlaying = false,
  onTogglePlayback,
  bpm = 120,
  onBpmChange,
  isLooping = false,
  onToggleLoop,
  onSkipForward,
  onSkipBack,
  onPause,
}: WaveformWavesurferProps) {
  const waveformRef = useRef<HTMLDivElement>(null)
  const wavesurferRef = useRef<any>(null)
  const regionsPluginRef = useRef<any>(null)
  const [isReady, setIsReady] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [wavesurferLoaded, setWavesurferLoaded] = useState(false)
  const [audioBuffer, setAudioBuffer] = useState<AudioBuffer | null>(null)
  const [slices, setSlices] = useState<AudioSlice[]>([])
  const [sections, setSections] = useState<AudioSection[]>([])
  const [analysisProgress, setAnalysisProgress] = useState<number | null>(null)
  const [zoom, setZoom] = useState(1)
  const [sensitivity, setSensitivity] = useState(0.1)
  const [sliceBy, setSliceBy] = useState<"section" | "transient" | "beat" | "manual">("section")
  const [maxSections, setMaxSections] = useState(8)
  const [fileName, setFileName] = useState<string>("")
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Initialize Wavesurfer with dynamic import
  // Use useLayoutEffect to ensure DOM is ready
  useLayoutEffect(() => {
    if (!waveformRef.current) return
    // Don't re-initialize if already loaded AND ref exists
    if (wavesurferLoaded && wavesurferRef.current) {
      console.log("Wavesurfer already initialized, skipping")
      return
    }

    let isMounted = true

    const initWavesurfer = async () => {
      try {
        // Dynamically import Wavesurfer.js (client-side only)
        // Use the ESM build to avoid webpack chunking issues
        const wavesurferModule = await import("wavesurfer.js/dist/wavesurfer.esm.js")
        const regionsModule = await import("wavesurfer.js/dist/plugins/regions.esm.js")
        const timelineModule = await import("wavesurfer.js/dist/plugins/timeline.esm.js")
        
        // Handle different export formats
        const WaveSurfer = wavesurferModule.default || wavesurferModule.WaveSurfer || wavesurferModule
        const RegionsPlugin = regionsModule.default || regionsModule.RegionsPlugin || regionsModule
        const TimelinePlugin = timelineModule.default || timelineModule.TimelinePlugin || timelineModule
        
        if (!WaveSurfer || typeof WaveSurfer.create !== "function") {
          console.error("WaveSurfer module:", wavesurferModule)
          throw new Error("Failed to load WaveSurfer - create method not found")
        }
        
        console.log("WaveSurfer loaded successfully:", typeof WaveSurfer.create)

        if (!isMounted || !waveformRef.current) return

        // Ensure container has dimensions and is visible
        if (waveformRef.current) {
          // Clear any existing content
          waveformRef.current.innerHTML = ""
          
          waveformRef.current.style.minHeight = "150px"
          waveformRef.current.style.width = "100%"
          waveformRef.current.style.display = "block"
          waveformRef.current.style.visibility = "visible"
          waveformRef.current.style.position = "relative"
          
          // Check if container is actually visible
          const rect = waveformRef.current.getBoundingClientRect()
          console.log("Container rect:", rect)
          if (rect.width === 0 || rect.height === 0) {
            console.warn("Container has zero dimensions, may cause issues")
            // Try to force dimensions
            waveformRef.current.style.width = "100%"
            waveformRef.current.style.height = "150px"
          }
        }

        const wavesurfer = WaveSurfer.create({
          container: waveformRef.current!,
          waveColor: "#f97316", // orange-500
          progressColor: "#ea580c", // orange-600
          cursorColor: "#ffffff",
          barWidth: 0, // 0 = solid line waveform (not bars)
          barRadius: 0,
          responsive: true,
          height: 150,
          normalize: false, // Don't normalize - prevents maxing out top/bottom
          backend: "WebAudio",
          mediaControls: false,
          interact: true,
          dragToSeek: true,
        })

        console.log("Wavesurfer instance created")

        // Add timeline plugin
        const timeline = TimelinePlugin.create({
          height: 24,
          insertPosition: "beforebegin",
          timeInterval: 1, // Show labels every 1 second (less dense)
          primaryLabelInterval: 10, // Show primary labels every 10 seconds
          secondaryLabelInterval: 5, // Show secondary labels every 5 seconds
          style: {
            fontSize: "10px",
            color: "#71717a",
          },
        })
        wavesurfer.registerPlugin(timeline)

        // Add regions plugin for sections
        // Regions plugin allows drawing and interacting with regions on the waveform
        const regions = RegionsPlugin.create({
          dragSelection: {
            slop: 5,
          },
        })
        wavesurfer.registerPlugin(regions)
        regionsPluginRef.current = regions

        // Handle region clicks
        regions.on("region-clicked", (region) => {
          const sectionId = region.id ? parseInt(region.id) : null
          if (sectionId !== null && onCurrentSectionChange) {
            onCurrentSectionChange(sectionId)
          }
        })

        // Set ref FIRST before any async operations
        wavesurferRef.current = wavesurfer

        // Event listeners - set up before marking as loaded
        wavesurfer.on("ready", () => {
          console.log("Wavesurfer ready event fired - audio loaded")
        })

        wavesurfer.on("loading", (progress) => {
          console.log("Wavesurfer loading:", progress)
          if (isMounted) {
            setIsLoading(true)
          }
        })

        wavesurfer.on("decode", () => {
          console.log("Wavesurfer decode complete")
        })

        wavesurfer.on("error", (error) => {
          console.error("Wavesurfer error:", error)
          if (isMounted) {
            setIsLoading(false)
          }
        })

        wavesurfer.on("seek", (progress) => {
          if (onPlaybackPositionChange) {
            onPlaybackPositionChange(progress)
          }
        })

        // Update playback position during playback
        const updatePosition = () => {
          if (wavesurfer.isPlaying() && wavesurfer.getDuration()) {
            const currentTime = wavesurfer.getCurrentTime()
            const progress = currentTime / wavesurfer.getDuration()
            if (onPlaybackPositionChange) {
              onPlaybackPositionChange(progress)
            }
            requestAnimationFrame(updatePosition)
          }
        }

        wavesurfer.on("play", () => {
          updatePosition()
        })

        // Mark as ready AFTER ref is set and event listeners are attached
        // Set ref synchronously and verify it's set before marking as loaded
        if (isMounted && wavesurferRef.current === wavesurfer) {
          setIsReady(true)
          setIsLoading(false)
          setWavesurferLoaded(true)
          console.log("Wavesurfer fully initialized:", {
            hasRef: !!wavesurferRef.current,
            instance: !!wavesurfer,
            loaded: true,
          })
        } else {
          console.error("Failed to set wavesurfer ref properly", {
            isMounted,
            hasRef: !!wavesurferRef.current,
            instance: !!wavesurfer,
          })
        }
      } catch (error) {
        console.error("Failed to load Wavesurfer.js:", error)
        setIsLoading(false)
      }
    }

    initWavesurfer()

    return () => {
      isMounted = false
      // Only cleanup on unmount, not on re-renders
      const currentInstance = wavesurferRef.current
      if (currentInstance) {
        try {
          currentInstance.destroy()
        } catch (e) {
          // Ignore errors during cleanup
        }
        // Only clear ref if we're actually unmounting
        wavesurferRef.current = null
        setWavesurferLoaded(false)
        setIsReady(false)
      }
    }
  }, []) // Empty deps - only run on mount/unmount

  // Sync playback state with external control
  useEffect(() => {
    if (!wavesurferRef.current || !isReady) return

    const wavesurfer = wavesurferRef.current
    const isWavesurferPlaying = wavesurfer.isPlaying()

    if (isPlaying && !isWavesurferPlaying) {
      wavesurfer.play().catch((err) => {
        console.error("Error playing audio:", err)
      })
    } else if (!isPlaying && isWavesurferPlaying) {
      wavesurfer.pause()
    }
  }, [isPlaying, isReady])

  // Sync playback position from external source
  useEffect(() => {
    if (!wavesurferRef.current || !isReady || !onPlaybackPositionChange) return

    // This will be handled by Wavesurfer's internal seeking
    // We just need to make sure the position updates are propagated
  }, [isReady, onPlaybackPositionChange])

  // Update regions when sections change - defined before handleFileChange
  const updateRegions = useCallback((sections: AudioSection[], sliceRegions: AudioSlice[] = [], buffer?: AudioBuffer) => {
    if (!wavesurferRef.current || !regionsPluginRef.current) return
    
    const bufferToUse = buffer || audioBuffer
    if (!bufferToUse) return

    const regions = regionsPluginRef.current
    
    // Clear existing regions
    try {
      regions.clearRegions()
    } catch (e) {
      console.warn("Error clearing regions:", e)
    }

    // Add new regions for each section
    sections.forEach((section, index) => {
      const startTime = section.startSample / bufferToUse.sampleRate
      const endTime = section.endSample / bufferToUse.sampleRate

      const colors = ["#eab30833", "#a1620733", "#ca8a0433", "#fde04733"]
      const color = colors[index % colors.length]

      try {
        regions.addRegion({
          start: startTime,
          end: endTime,
          color,
          drag: true,
          resize: true,
          id: section.id.toString(),
        })
      } catch (e) {
        console.warn("Error adding region:", e)
      }
    })

    // Add onset/slice regions as thin stripes
    sliceRegions.forEach((slice, index) => {
      const startTime = slice.startSample / bufferToUse.sampleRate
      const endTime = slice.endSample / bufferToUse.sampleRate
      const duration = Math.max(endTime - startTime, 0.02)

      try {
        regions.addRegion({
          start: startTime,
          end: startTime + duration,
          color: "rgba(239,68,68,0.35)",
          drag: false,
          resize: false,
          id: `slice-${index}`,
        })
      } catch (e) {
        console.warn("Error adding slice region:", e)
      }
    })
  }, [audioBuffer])

  // Handle file loading
  const handleFileChange = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0]
      if (!file) return

      // Wait for Wavesurfer to be initialized - but allow file selection even if not fully ready
      // We'll queue the file and load it once Wavesurfer is ready
      if (!wavesurferRef.current) {
        console.warn("Wavesurfer not initialized yet, file will load once ready...", {
          hasRef: false,
          loaded: wavesurferLoaded,
        })
        // Don't reset - let the user select the file, we'll handle it when ready
        // Store the file temporarily
        const fileToLoad = file
        // Wait for Wavesurfer to be ready, then load
        const checkInterval = setInterval(() => {
          if (wavesurferRef.current) {
            clearInterval(checkInterval)
            // Create a synthetic event to trigger loading
            const syntheticEvent = {
              target: { files: [fileToLoad] },
            } as React.ChangeEvent<HTMLInputElement>
            handleFileChange(syntheticEvent)
          }
        }, 100)
        // Timeout after 10 seconds
        setTimeout(() => clearInterval(checkInterval), 10000)
        return
      }

      setFileName(file.name)
      setIsLoading(true)

      try {
        // Create blob URL for Wavesurfer first
        const arrayBuffer = await file.arrayBuffer()
        const blob = new Blob([arrayBuffer], { type: file.type || "audio/wav" })
        const url = URL.createObjectURL(blob)

        // Load into Wavesurfer - this will generate the waveform
        console.log("Loading audio into Wavesurfer...", url)
        
        if (!wavesurferRef.current) {
          throw new Error("Wavesurfer not initialized")
        }

        // Ensure container is visible and has dimensions
        if (waveformRef.current) {
          const rect = waveformRef.current.getBoundingClientRect()
          console.log("Container dimensions:", rect.width, rect.height)
          if (rect.width === 0 || rect.height === 0) {
            console.warn("Container has no dimensions, waiting...")
            // Wait a bit for layout
            await new Promise(resolve => setTimeout(resolve, 100))
          }
        }

        // Load the audio file into Wavesurfer
        console.log("Calling wavesurfer.load() with URL:", url.substring(0, 50) + "...")
        
        // Wait for waveform to be generated
        await new Promise<void>((resolve, reject) => {
          if (!wavesurferRef.current) {
            reject(new Error("Wavesurfer not available"))
            return
          }

          const timeout = setTimeout(() => {
            console.warn("Waveform generation timeout after 30 seconds")
            setIsLoading(false)
            reject(new Error("Waveform generation timeout"))
          }, 30000) // 30 second timeout

          // Listen for ready event (fires when audio is loaded and waveform is rendered)
          const onReady = () => {
            clearTimeout(timeout)
            console.log("Waveform generated successfully, duration:", wavesurferRef.current?.getDuration())
            setIsLoading(false)
            resolve()
          }

          // Listen for decode event (happens before ready)
          const onDecode = () => {
            console.log("Audio decoded, waveform should render soon")
          }

          // Listen for error
          const onError = (error: any) => {
            clearTimeout(timeout)
            console.error("Wavesurfer error:", error)
            setIsLoading(false)
            reject(error)
          }

          // Set up event listeners BEFORE calling load
          wavesurferRef.current.once("ready", onReady)
          wavesurferRef.current.once("decode", onDecode)
          wavesurferRef.current.once("error", onError)

          // Now load the audio
          try {
            wavesurferRef.current.load(url)
          } catch (loadError) {
            clearTimeout(timeout)
            console.error("Error calling load():", loadError)
            setIsLoading(false)
            reject(loadError)
          }
        })

        // Load audio file for analysis
        const buffer = await audioEngine.loadAudioFile(file)
        setAudioBuffer(buffer)

        // Show loading state for analysis
        setIsLoading(true)
        setAnalysisProgress(0)
        console.log("Starting audio analysis...")

        const progressHandler = (progress: number) => {
          setAnalysisProgress(Math.round(progress * 100))
        }

        try {
          if (sliceBy === "section") {
            console.log("Detecting sections...")
            const detectedSections = await audioEngine.detectSections(maxSections, progressHandler)
            setSections(detectedSections)
            const allSlices = detectedSections.flatMap((section) => section.slices)
            setSlices(allSlices)
            onAudioLoad(buffer, allSlices, detectedSections)
            // Update regions with the buffer
            updateRegions(detectedSections, allSlices, buffer)
            console.log("Section detection complete")
          } else {
            console.log("Detecting transients...")
            const detectedSlices = await audioEngine.detectTransients(sensitivity, 0.05, 16, progressHandler)
            setSlices(detectedSlices)
            setSections([])
            onAudioLoad(buffer, detectedSlices, [])
            updateRegions([], detectedSlices, buffer)
            console.log("Transient detection complete")
          }
        } catch (analysisError: any) {
          console.error("Error during audio analysis:", analysisError)
          setSlices([])
          setSections([])
          onAudioLoad(buffer, [], [])
          updateRegions([], [], buffer)
        } finally {
          setIsLoading(false)
          setAnalysisProgress(null)
          console.log("Audio analysis finished")
        }

        // Clean up blob URL after a delay
        setTimeout(() => {
          URL.revokeObjectURL(url)
        }, 5000)
      } catch (error) {
        console.error("Error loading audio file:", error)
        setIsLoading(false)
      }
    },
    [sliceBy, maxSections, sensitivity, onAudioLoad, updateRegions, wavesurferLoaded]
  )

  // Update regions when sections change (after initial load)
  useEffect(() => {
    if (audioBuffer && isReady) {
      updateRegions(sections, slices)
    }
  }, [sections, slices, audioBuffer, isReady, updateRegions])

  // Handle zoom
  const handleZoomIn = () => {
    if (!wavesurferRef.current) return
    const newZoom = Math.min(zoom * 1.5, 2000)
    setZoom(newZoom)
    wavesurferRef.current.zoom(newZoom)
  }

  const handleZoomOut = () => {
    if (!wavesurferRef.current) return
    const newZoom = Math.max(zoom / 1.5, 1)
    setZoom(newZoom)
    wavesurferRef.current.zoom(newZoom)
  }

  // Handle playback controls
  const togglePlayback = () => {
    if (!wavesurferRef.current) return
    if (wavesurferRef.current.isPlaying()) {
      wavesurferRef.current.pause()
    } else {
      wavesurferRef.current.play()
    }
    if (onTogglePlayback) {
      onTogglePlayback()
    }
  }

  // Detect sections/transients
  const detectSections = useCallback(async () => {
    if (!audioBuffer) return

    setIsLoading(true)
    setAnalysisProgress(0)
    try {
      const detectedSections = await audioEngine.detectSections(maxSections, (progress) =>
        setAnalysisProgress(Math.round(progress * 100))
      )
      setSections(detectedSections)
      const allSlices = detectedSections.flatMap((section) => section.slices)
      setSlices(allSlices)
      onAudioLoad(audioBuffer, allSlices, detectedSections)
      updateRegions(detectedSections, allSlices)
    } catch (error) {
      console.error("Error detecting sections:", error)
    } finally {
      setIsLoading(false)
      setAnalysisProgress(null)
    }
  }, [audioBuffer, maxSections, onAudioLoad, updateRegions])

  const detectTransients = useCallback(async () => {
    if (!audioBuffer) return

    setIsLoading(true)
    setAnalysisProgress(0)
    try {
      const detectedSlices = await audioEngine.detectTransients(sensitivity, 0.05, 16, (progress) =>
        setAnalysisProgress(Math.round(progress * 100))
      )
      setSlices(detectedSlices)
      setSections([])
      onAudioLoad(audioBuffer, detectedSlices, [])
      updateRegions([], detectedSlices)
    } catch (error) {
      console.error("Error detecting transients:", error)
    } finally {
      setIsLoading(false)
      setAnalysisProgress(null)
    }
  }, [audioBuffer, sensitivity, onAudioLoad, updateRegions])

  return (
    <div className="border border-zinc-800 rounded-md bg-zinc-900/80 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-800 bg-zinc-900">
        <div className="flex items-center gap-2">
          {audioBuffer ? (
            <>
              <div className="w-4 h-4 rounded-full bg-orange-500"></div>
              <span className="text-sm font-medium text-zinc-300">{fileName || "sample.wav"}</span>
              <span className="text-xs text-zinc-500">
                {wavesurferRef.current?.getDuration()?.toFixed(1) || "0.0"}s
              </span>
            </>
          ) : (
            <span className="text-sm font-medium text-zinc-500">No sample loaded</span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "h-7 px-2 text-xs hover:text-zinc-100 hover:bg-zinc-800",
              isLooping ? "text-yellow-400" : "text-zinc-400",
            )}
            onClick={onToggleLoop}
            title="Toggle loop mode"
          >
            <Repeat className="h-3 w-3 mr-1" />
            Loop
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800"
            onClick={handleZoomOut}
            disabled={zoom <= 1}
          >
            <ZoomOut className="h-3 w-3 mr-1" />
            Zoom
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800"
            onClick={handleZoomIn}
            disabled={zoom >= 2000}
          >
            <ZoomIn className="h-3 w-3 mr-1" />
            Zoom
          </Button>
        </div>
      </div>

      {/* Waveform container */}
      <div className="relative bg-zinc-950 min-h-[150px]">
        <div 
          ref={waveformRef} 
          className="w-full min-h-[150px]"
          style={{ minHeight: "150px", width: "100%" }}
        />
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-zinc-950/90 z-10">
            <div className="flex flex-col items-center">
              <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin mb-2"></div>
              <p className="text-zinc-400 text-sm font-medium">
                {audioBuffer
                  ? `Analyzing audio${analysisProgress !== null ? `… ${analysisProgress}%` : "..."}` 
                  : "Loading audio..."}
              </p>
              {!isReady && !audioBuffer && (
                <p className="text-zinc-500 text-xs mt-1">Initializing Wavesurfer...</p>
              )}
              {audioBuffer && (
                <p className="text-zinc-500 text-xs mt-1">This may take a moment...</p>
              )}
            </div>
          </div>
        )}
        {!audioBuffer && !isLoading && (
          <label
            htmlFor="audio-file-input"
            className={cn(
              "flex flex-col items-center justify-center h-40 bg-zinc-950 transition-colors absolute inset-0 z-20 cursor-pointer",
              wavesurferLoaded ? "hover:bg-zinc-900" : "opacity-50 cursor-wait"
            )}
            style={{ pointerEvents: wavesurferLoaded ? "auto" : "none" }}
          >
            <Upload className="h-8 w-8 text-zinc-700 mb-2 pointer-events-none" />
            <p className="text-zinc-500 text-sm pointer-events-none">Click to load audio file</p>
            <p className="text-zinc-600 text-xs mt-1 pointer-events-none">WAV, MP3, AIFF supported</p>
            {!wavesurferLoaded && (
              <p className="text-zinc-600 text-xs mt-2 pointer-events-none">Initializing waveform viewer...</p>
            )}
            <input
              id="audio-file-input"
              ref={fileInputRef}
              type="file"
              accept="audio/*"
              onChange={(e) => {
                console.log("File input onChange triggered", e.target.files)
                handleFileChange(e)
              }}
              onClick={(e) => {
                console.log("File input onClick - browser should open file picker now")
                // Don't prevent default - let browser handle it
              }}
              style={{ display: "none" }}
            />
          </label>
        )}
      </div>

      {/* Transport Controls */}
      <TransportControls
        isPlaying={isPlaying}
        onPlay={togglePlayback}
        onPause={onPause || (() => {})}
        onSkipForward={onSkipForward || (() => {})}
        onSkipBack={onSkipBack || (() => {})}
        bpm={bpm}
        onBpmChange={onBpmChange || (() => {})}
        isLooping={isLooping}
        onToggleLoop={onToggleLoop}
      />

      {/* Controls */}
      <div className="grid grid-cols-5 gap-2 p-3 border-t border-zinc-800 bg-zinc-900/90">
        <div className="space-y-1">
          <label className="block text-xs text-zinc-400">Slice By</label>
          <Select value={sliceBy} onValueChange={(v) => setSliceBy(v as any)}>
            <SelectTrigger className="h-8 text-xs bg-zinc-800 border-zinc-700">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-zinc-800 border-zinc-700">
              <SelectItem value="section">Sections</SelectItem>
              <SelectItem value="transient">Transient</SelectItem>
              <SelectItem value="manual">Manual</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <label className="block text-xs text-zinc-400">Sensitivity</label>
          <div className="flex items-center gap-2">
            <Slider
              value={[sensitivity * 100]}
              min={1}
              max={50}
              step={1}
              onValueChange={(value) => setSensitivity(value[0] / 100)}
              className="flex-1"
              disabled={sliceBy !== "transient"}
            />
            <span className="text-xs text-zinc-400 w-12">{Math.round(sensitivity * 100)}%</span>
          </div>
        </div>

        <div className="space-y-1">
          <label className="block text-xs text-zinc-400">Actions</label>
          <div className="flex items-center gap-1">
            {sliceBy === "section" && (
              <Button
                variant="outline"
                size="sm"
                className="h-6 px-2 text-xs border-zinc-700 bg-zinc-800 hover:bg-zinc-700"
                onClick={detectSections}
                disabled={!audioBuffer || isLoading}
              >
                <Wand2 className="h-3 w-3 mr-1" />
                Detect
              </Button>
            )}
            {sliceBy === "transient" && (
              <Button
                variant="outline"
                size="sm"
                className="h-6 px-2 text-xs border-zinc-700 bg-zinc-800 hover:bg-zinc-700"
                onClick={detectTransients}
                disabled={!audioBuffer || isLoading}
              >
                <Wand2 className="h-3 w-3 mr-1" />
                Detect
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

