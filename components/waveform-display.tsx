"use client"

import type React from "react"

import { useState, useEffect, useRef, useCallback } from "react"
import { Slider } from "@/components/ui/slider"
import { Button } from "@/components/ui/button"
import { Play, Pause, SkipBack, Upload, ZoomIn, ZoomOut, ChevronLeft, ChevronRight, Wand2, Repeat } from 'lucide-react'
import { cn } from "@/lib/utils"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { audioEngine, type AudioSlice, type AudioSection } from "@/lib/audio-engine"
import { TransportControls } from "@/components/transport-controls"

interface WaveformDisplayProps {
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

export default function WaveformDisplay({
  onAudioLoad,
  onPlaybackPositionChange,
  onCurrentSliceChange,
  onCurrentSectionChange,
  onCurrentAnnotationChange,
  isPlaying: externalIsPlaying = false,
  onTogglePlayback: externalTogglePlayback,
  bpm = 120,
  onBpmChange,
  isLooping: externalIsLooping = false,
  onToggleLoop,
  onSkipForward,
  onSkipBack,
  onPause,
}: WaveformDisplayProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const timelineRef = useRef<HTMLCanvasElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const animationRef = useRef<number | null>(null)
  const lastProcessedBufferRef = useRef<string | null>(null)
  const [width, setWidth] = useState(0)
  const [buffer, setBuffer] = useState<AudioBuffer | null>(null)
  const [slices, setSlices] = useState<AudioSlice[]>([])
  const [sections, setSections] = useState<AudioSection[]>([])
  const [currentSlice, setCurrentSlice] = useState<number | null>(null)
  const [currentSection, setCurrentSection] = useState<number | null>(null)
  const [currentAnnotation, setCurrentAnnotation] = useState<string | null>(null)
  const [zoom, setZoom] = useState(1)
  const [scrollPosition, setScrollPosition] = useState(0)
  const [gain, setGain] = useState(0)
  const [sensitivity, setSensitivity] = useState(0.1)
  const [sliceBy, setSliceBy] = useState<"section" | "transient" | "beat" | "manual">("section")
  const [isProcessing, setIsProcessing] = useState(false)
  const [fileName, setFileName] = useState<string>("")
  const [playbackMode, setPlaybackMode] = useState<"mono" | "stereo">("mono")
  const [volume, setVolume] = useState(-12)
  const [currentPlaybackId, setCurrentPlaybackId] = useState<string | null>(null)
  const [playbackPosition, setPlaybackPosition] = useState(0)
  const [pitch, setPitch] = useState(0)
  const [maxSections, setMaxSections] = useState(8)
  const [maxSlicesPerSection, setMaxSlicesPerSection] = useState(8)
  const [isLooping, setIsLooping] = useState(false) // Local state for looping
  const [loopStart, setLoopStart] = useState(0)
  const [loopEnd, setLoopEnd] = useState(1)
  const [showAllSections, setShowAllSections] = useState(true)
  const [annotations, setAnnotations] = useState<
    Array<{
      id: string
      startTime: number
      endTime: number
      text: string
    }>
  >([])
  const [editingAnnotation, setEditingAnnotation] = useState<string | null>(null)
  const [showAnnotations, setShowAnnotations] = useState(false)
  const [draggedBoundary, setDraggedBoundary] = useState<{
    annotationId: string
    type: "start" | "end"
  } | null>(null)

  // Initialize audio engine
  useEffect(() => {
    audioEngine.initialize().catch(console.error)
    return () => {
      audioEngine.dispose()
    }
  }, [])

  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current) {
        const containerWidth = containerRef.current.offsetWidth
        setWidth(containerWidth)

        // Update canvas sizes
        if (canvasRef.current) {
          canvasRef.current.width = containerWidth
        }
        if (timelineRef.current) {
          timelineRef.current.width = containerWidth
        }
      }
    }

    handleResize()
    window.addEventListener("resize", handleResize)

    return () => {
      window.removeEventListener("resize", handleResize)
    }
  }, [])

  const handleFileClick = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setFileName(file.name)
    setIsProcessing(true)

    try {
      // Load and decode the audio file using our audio engine
      const audioBuffer = await audioEngine.loadAudioFile(file)
      setBuffer(audioBuffer)

      // Auto-detect sections and slices (now async)
      if (sliceBy === "section") {
        const detectedSections = await audioEngine.detectSections(maxSections)
        setSections(detectedSections)

        // Get all slices from all sections
        const allSlices = detectedSections.flatMap((section) => section.slices)
        setSlices(allSlices)

        onAudioLoad(audioBuffer, allSlices, detectedSections)
      } else {
        // Real transient detection (now async)
        const detectedSlices = await audioEngine.detectTransients(sensitivity, 0.05, 16)
        setSlices(detectedSlices)
        setSections([])
        onAudioLoad(audioBuffer, detectedSlices, [])
      }

      // Reset playback position and scroll
      setPlaybackPosition(0)
      setScrollPosition(0)
      setZoom(1)
    } catch (error) {
      console.error("Error loading audio file:", error)
    } finally {
      setIsProcessing(false)
    }
  }

  const detectSections = useCallback(async () => {
    if (!buffer) return

    setIsProcessing(true)
    try {
      const detectedSections = await audioEngine.detectSections(maxSections)

      // Only update if the sections actually changed
      if (JSON.stringify(detectedSections) !== JSON.stringify(sections)) {
        setSections(detectedSections)

        // Get all slices from all sections
        const allSlices = detectedSections.flatMap((section) => section.slices)
        setSlices(allSlices)

        onAudioLoad(buffer, allSlices, detectedSections)
      }
    } catch (error) {
      console.error('Error detecting sections:', error)
    } finally {
      setIsProcessing(false)
    }
  }, [buffer, maxSections, onAudioLoad, sections])

  const detectTransients = useCallback(async () => {
    if (!buffer) return

    setIsProcessing(true)
    try {
      const detectedSlices = await audioEngine.detectTransients(sensitivity, 0.05, 16)

      // Only update if the slices actually changed
      if (JSON.stringify(detectedSlices) !== JSON.stringify(slices)) {
        setSlices(detectedSlices)
        setSections([])
        onAudioLoad(buffer, detectedSlices, [])
      }
    } catch (error) {
      console.error('Error detecting transients:', error)
    } finally {
      setIsProcessing(false)
    }
  }, [buffer, sensitivity, onAudioLoad, slices])

  useEffect(() => {
    // Only run this effect when these specific dependencies change
    // and not on every render
    if (buffer) {
      // Use a ref to track if we've already processed this buffer with these settings
      const bufferKey = `${buffer.length}-${sliceBy}-${sensitivity}-${maxSections}`
      if (lastProcessedBufferRef.current !== bufferKey) {
        lastProcessedBufferRef.current = bufferKey

        // Handle async detection
        if (sliceBy === "section") {
          detectSections().catch(console.error)
        } else if (sliceBy === "transient") {
          detectTransients().catch(console.error)
        }
      }
    }
  }, [buffer, sliceBy, sensitivity, maxSections, detectSections, detectTransients])

  // Update audio engine when volume changes
  useEffect(() => {
    audioEngine.setMasterVolume(volume)
  }, [volume])

  // Format time in seconds to MM:SS format
  const formatTime = useCallback((seconds: number) => {
    const minutes = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${minutes}:${secs.toString().padStart(2, "0")}`
  }, [])

  // Draw timeline with section markers
  const drawTimeline = useCallback(() => {
    if (!timelineRef.current || !buffer) return

    const canvas = timelineRef.current
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const width = canvas.width
    const height = canvas.height

    // Clear canvas
    ctx.clearRect(0, 0, width, height)

    // Draw background
    ctx.fillStyle = "#18181b" // zinc-900
    ctx.fillRect(0, 0, width, height)

    // Calculate appropriate time markers based on song length and zoom level
    const duration = buffer.duration
    const visibleDuration = duration / zoom
    const visibleStartTime = scrollPosition * duration

    // Determine a good time step based on visible duration
    let timeStep: number
    if (visibleDuration <= 10) {
      timeStep = 1 // 1 second increments for very zoomed in view
    } else if (visibleDuration <= 30) {
      timeStep = 5 // 5 second increments for zoomed in view
    } else if (visibleDuration <= 60) {
      timeStep = 10 // 10 second increments
    } else if (visibleDuration <= 180) {
      timeStep = 30 // 30 second increments
    } else if (visibleDuration <= 360) {
      timeStep = 60 // 1 minute increments
    } else {
      timeStep = 120 // 2 minute increments for very long audio
    }

    // Find the first time marker that's visible
    const firstMarker = Math.floor(visibleStartTime / timeStep) * timeStep

    ctx.fillStyle = "#71717a" // zinc-500
    ctx.font = "10px sans-serif"
    ctx.textAlign = "center"

    // Draw time markers
    for (let i = firstMarker; i <= visibleStartTime + visibleDuration; i += timeStep) {
      // Convert time to x position
      const x = ((i - visibleStartTime) / visibleDuration) * width

      if (x >= 0 && x <= width) {
        // Draw tick
        ctx.fillRect(x, 0, 1, 6)

        // Draw time label
        ctx.fillText(formatTime(i), x, 16)
      }
    }

    // Draw sections as colored regions with more accurate positioning
    if (sections && sections.length > 0) {
      sections.forEach((section, index) => {
        const sectionStartTime = section.startSample / buffer.sampleRate
        const sectionEndTime = section.endSample / buffer.sampleRate

        // Convert to x positions
        const startX = ((sectionStartTime - visibleStartTime) / visibleDuration) * width
        const endX = ((sectionEndTime - visibleStartTime) / visibleDuration) * width
        const sectionWidth = endX - startX

        // Only draw if section is visible
        if (startX < width && endX > 0) {
          // Alternate colors for better visibility
          const colors = ["#eab30833", "#a1620733", "#ca8a0433", "#fde04733"]
          ctx.fillStyle = colors[index % colors.length]

          // Draw section background
          const drawStartX = Math.max(0, startX)
          const drawEndX = Math.min(width, endX)
          ctx.fillRect(drawStartX, 0, drawEndX - drawStartX, height)

          // Draw section name
          ctx.fillStyle = "#f5f5f5" // zinc-100
          ctx.font = "bold 10px sans-serif"
          ctx.textAlign = "center"

          // Only draw text if section is wide enough
          if (sectionWidth > 40 && drawStartX < width && drawEndX > 0) {
            const textX = Math.max(drawStartX + 20, Math.min(width - 20, drawStartX + sectionWidth / 2))
            ctx.fillText(section.name, textX, height / 2 + 4)
          }
        }
      })
    }

    // Draw playhead
    const playheadX = ((playbackPosition * duration - visibleStartTime) / visibleDuration) * width
    if (playheadX >= 0 && playheadX <= width) {
      ctx.fillStyle = "#ffffff"
      ctx.fillRect(playheadX - 1, 0, 2, height)
    }
  }, [buffer, sections, playbackPosition, formatTime, zoom, scrollPosition])

  const startPlaybackAnimation = useCallback(() => {
    if (!buffer || !canvasRef.current) return

    const startTime = performance.now()
    const startPosition = playbackPosition
    const rate = 1.0 // The rate is handled by the audio engine

    const updatePlaybackPosition = () => {
      // Calculate elapsed time in seconds
      const elapsed = (performance.now() - startTime) / 1000
      const duration = buffer.duration

      // Calculate new position based on actual elapsed time
      let newPos = startPosition + elapsed / duration

      // Handle looping if enabled
      if (isLooping) {
        if (newPos > loopEnd) {
          newPos = loopStart + ((newPos - loopEnd) % (loopEnd - loopStart))
        }
      } else if (newPos >= 1) {
        newPos = 1
        // Use externalTogglePlayback to stop playback from parent
        if (externalTogglePlayback) {
          externalTogglePlayback()
        } else {
          // Fallback for standalone usage
          // This part needs to be adjusted if externalIsPlaying is the sole source of truth
          // For now, assuming local setIsPlaying is possible if no external control
        }
        if (currentPlaybackId) {
          audioEngine.stopPlayback(currentPlaybackId)
          setCurrentPlaybackId(null)
        }
        return
      }

      setPlaybackPosition(newPos)

      // Continue the animation loop
      animationRef.current = requestAnimationFrame(updatePlaybackPosition)
    }

    animationRef.current = requestAnimationFrame(updatePlaybackPosition)

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
        animationRef.current = null
      }
    }
  }, [buffer, isLooping, loopStart, loopEnd, playbackPosition, currentPlaybackId, externalTogglePlayback])

  // Start/stop animation based on playback state
  useEffect(() => {
    // Use externalIsPlaying state from parent
    if (externalIsPlaying) {
      return startPlaybackAnimation()
    } else if (animationRef.current) {
      cancelAnimationFrame(animationRef.current)
      animationRef.current = null
    }
  }, [externalIsPlaying, startPlaybackAnimation])

  const createAnnotationsFromSections = useCallback(() => {
    if (!buffer || sections.length === 0) return

    // Create word/phrase-based annotations from sections
    const lyricPhrases = [
      "From fairest creatures we desire increase",
      "That thereby beauty's rose might never die",
      "But as the riper should by time decease",
      "His tender heir might bear his memory",
      "But thou contracted to thine own bright eyes",
      "Feed'st thy light's flame with self-substantial fuel",
      "Making a famine where abundance lies",
      "Thyself thy foe, to thy sweet self too cruel",
    ]

    const newAnnotations = sections.map((section, index) => ({
      id: `w${String(index + 1).padStart(6, "0")}`,
      startTime: section.startSample / buffer.sampleRate,
      endTime: section.endSample / buffer.sampleRate,
      text: lyricPhrases[index % lyricPhrases.length] || `Phrase ${index + 1}`,
    }))

    setAnnotations(newAnnotations)
    setShowAnnotations(true)
  }, [buffer, sections])

  // Draw waveform and playback position
  useEffect(() => {
    if (!buffer || !canvasRef.current) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    // Make sure canvas dimensions are valid before drawing
    if (canvas.width <= 0 || canvas.height <= 0) return

    const drawWaveform = () => {
      const canvasWidth = canvas.width
      const canvasHeight = canvas.height

      ctx.clearRect(0, 0, canvasWidth, canvasHeight)

      // Draw background
      ctx.fillStyle = "#09090b" // zinc-950
      ctx.fillRect(0, 0, canvasWidth, canvasHeight)

      // Draw background grid
      ctx.strokeStyle = "#27272a" // zinc-800
      ctx.lineWidth = 1

      // Vertical grid lines
      const gridSpacing = 40
      for (let x = 0; x < canvasWidth; x += gridSpacing) {
        ctx.beginPath()
        ctx.moveTo(x, 0)
        ctx.lineTo(x, canvasHeight)
        ctx.stroke()
      }

      // Horizontal grid lines
      for (let y = 0; y < canvasHeight; y += gridSpacing) {
        ctx.beginPath()
        ctx.moveTo(0, y)
        ctx.lineTo(canvasWidth, y)
        ctx.stroke()
      }

      // Horizontal center line (emphasized)
      ctx.strokeStyle = "#3f3f46" // zinc-700
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(0, canvasHeight / 2)
      ctx.lineTo(canvasWidth, canvasHeight / 2)
      ctx.stroke()

      // Draw waveform
      if (buffer) {
        // Use both channels for stereo files
        const channelCount = buffer.numberOfChannels
        const leftChannel = buffer.getChannelData(0)
        const rightChannel = channelCount > 1 ? buffer.getChannelData(1) : leftChannel

        const amp = (canvasHeight / 2) * 0.9

        // Adjust drawing based on zoom level and scroll position
        const samplesPerPixel = Math.ceil(buffer.length / (canvasWidth * zoom))
        const startSample = Math.floor(scrollPosition * buffer.length)

        // Draw left channel
        ctx.fillStyle = "#f97316" // orange-500
        for (let i = 0; i < canvasWidth; i++) {
          let min = 1.0
          let max = -1.0
          const sampleIndex = startSample + i * samplesPerPixel

          // Calculate min/max values for this pixel
          for (let j = 0; j < samplesPerPixel; j++) {
            const index = sampleIndex + j
            if (index < leftChannel.length) {
              const datum = leftChannel[index]
              if (datum < min) min = datum
              if (datum > max) max = datum
            }
          }

          // Draw filled waveform
          const y1 = canvasHeight / 2 + min * amp
          const y2 = canvasHeight / 2 + max * amp
          ctx.fillRect(i, y1, 1, y2 - y1)
        }

        // Draw right channel with slight offset if stereo
        if (channelCount > 1) {
          ctx.fillStyle = "#ea580c" // orange-600
          for (let i = 0; i < canvasWidth; i++) {
            let min = 1.0
            let max = -1.0
            const sampleIndex = startSample + i * samplesPerPixel

            // Calculate min/max values for this pixel
            for (let j = 0; j < samplesPerPixel; j++) {
              const index = sampleIndex + j
              if (index < rightChannel.length) {
                const datum = rightChannel[index]
                if (datum < min) min = datum
                if (datum > max) max = datum
              }
            }

            // Draw filled waveform with slight transparency
            const y1 = canvasHeight / 2 + min * amp * 0.9
            const y2 = canvasHeight / 2 + max * amp * 0.9
            ctx.globalAlpha = 0.7
            ctx.fillRect(i, y1, 1, y2 - y1)
            ctx.globalAlpha = 1.0
          }
        }

        // Draw annotation boundaries (word/phrase based)
        if (showAnnotations) {
          annotations.forEach((annotation, index) => {
            const startX = (annotation.startTime / buffer.duration) * canvasWidth
            const endX = (annotation.endTime / buffer.duration) * canvasWidth

            // Different color for current annotation
            const isCurrentAnnotation = currentAnnotation === annotation.id

            // Draw annotation region background
            ctx.fillStyle = isCurrentAnnotation ? "rgba(34, 197, 94, 0.15)" : "rgba(234, 179, 8, 0.1)"
            ctx.fillRect(startX, 0, endX - startX, canvasHeight)

            // Draw boundary lines
            ctx.strokeStyle = isCurrentAnnotation ? "#22c55e" : "#eab308"
            ctx.lineWidth = 2
            ctx.setLineDash([4, 4])

            // Start boundary
            ctx.beginPath()
            ctx.moveTo(startX, 0)
            ctx.lineTo(startX, canvasHeight)
            ctx.stroke()

            // End boundary
            ctx.beginPath()
            ctx.moveTo(endX, 0)
            ctx.lineTo(endX, canvasHeight)
            ctx.stroke()

            ctx.setLineDash([])

            // Draw annotation ID and preview text
            ctx.fillStyle = isCurrentAnnotation ? "#22c55e" : "#eab308"
            ctx.font = "10px monospace"
            ctx.fillText(annotation.id, startX + 4, 20)

            // Show first few words of the annotation
            const previewText = annotation.text.split(" ").slice(0, 3).join(" ") + "..."
            ctx.font = "9px sans-serif"
            ctx.fillText(previewText, startX + 4, 35)
          })
        }

        // Draw section backgrounds with semi-transparent colors
        if (showAllSections) {
          sections.forEach((section, index) => {
            const sectionStartX =
              ((section.startSample / buffer.length) * canvasWidth) / zoom - scrollPosition * canvasWidth * zoom
            const sectionEndX =
              ((section.endSample / buffer.length) * canvasWidth) / zoom - scrollPosition * canvasWidth * zoom

            // Only draw if section is visible
            if (sectionStartX < canvasWidth && sectionEndX > 0) {
              // Alternate colors for better visibility
              const colors = [
                "rgba(234, 179, 8, 0.1)",
                "rgba(161, 98, 7, 0.1)",
                "rgba(202, 138, 4, 0.1)",
                "rgba(253, 224, 71, 0.1)",
              ]
              ctx.fillStyle = colors[index % colors.length]

              // Draw section background
              const drawStartX = Math.max(0, sectionStartX)
              const drawEndX = Math.min(canvasWidth, sectionEndX)
              ctx.fillRect(drawStartX, 0, drawEndX - drawStartX, canvasHeight)
            }
          })
        }

        // Draw section markers
        sections.forEach((section, index) => {
          const sectionX =
            ((section.startSample / buffer.length) * canvasWidth) / zoom - scrollPosition * canvasWidth * zoom

          if (sectionX >= 0 && sectionX <= canvasWidth) {
            // Draw section marker line
            ctx.strokeStyle = currentSection === index ? "#eab308" : "#a16207" // yellow-500 or yellow-700
            ctx.lineWidth = 3
            ctx.beginPath()
            ctx.moveTo(sectionX, 0)
            ctx.lineTo(sectionX, canvasHeight)
            ctx.stroke()

            // Draw section label at the top
            ctx.fillStyle = currentSection === index ? "#eab308" : "#a16207"
            ctx.font = "bold 12px sans-serif"
            ctx.fillText(section.name, sectionX + 6, 16)
          }
        })

        // Draw slice markers
        slices.forEach((slice, index) => {
          const sliceX =
            ((slice.startSample / buffer.length) * canvasWidth) / zoom - scrollPosition * canvasWidth * zoom

          if (sliceX >= 0 && sliceX <= canvasWidth) {
            // Draw slice marker line
            ctx.strokeStyle = currentSlice === index ? "#06b6d4" : "#0891b2" // cyan-500 or cyan-600
            ctx.lineWidth = 1
            ctx.beginPath()
            ctx.moveTo(sliceX, 0)
            ctx.lineTo(sliceX, canvasHeight)
            ctx.stroke()

            // Draw small circle at the top
            ctx.fillStyle = currentSlice === index ? "#06b6d4" : "#0891b2"
            ctx.beginPath()
            ctx.arc(sliceX, 30, 3, 0, Math.PI * 2)
            ctx.fill()
          }
        })

        // Draw loop region if looping is enabled
        if (isLooping) {
          const loopStartX = loopStart * canvasWidth
          const loopEndX = loopEnd * canvasWidth

          // Draw semi-transparent overlay for loop region
          ctx.fillStyle = "rgba(234, 179, 8, 0.2)" // yellow-500 with more opacity
          ctx.fillRect(loopStartX, 0, loopEndX - loopStartX, canvasHeight)

          // Draw loop markers
          ctx.strokeStyle = "#eab308" // yellow-500
          ctx.lineWidth = 3
          ctx.setLineDash([6, 6]) // Longer dashes for better visibility

          // Start marker
          ctx.beginPath()
          ctx.moveTo(loopStartX, 0)
          ctx.lineTo(loopStartX, canvasHeight)
          ctx.stroke()

          // End marker
          ctx.beginPath()
          ctx.moveTo(loopEndX, 0)
          ctx.lineTo(loopEndX, canvasHeight)
          ctx.stroke()

          // Reset line dash
          ctx.setLineDash([])
        }

        // Draw playhead
        // Use externalIsPlaying state to determine if playhead should be drawn
        if (externalIsPlaying) {
          const playheadPosition = Math.floor(playbackPosition * canvasWidth)
          ctx.strokeStyle = "#ffffff"
          ctx.lineWidth = 2
          ctx.beginPath()
          ctx.moveTo(playheadPosition, 0)
          ctx.lineTo(playheadPosition, canvasHeight)
          ctx.stroke()

          // Draw playhead position indicator
          ctx.fillStyle = "#ffffff"
          ctx.beginPath()
          ctx.arc(playheadPosition, 10, 5, 0, Math.PI * 2)
          ctx.fill()
        }
      }
    }

    drawWaveform()
    drawTimeline()
  }, [
    buffer,
    width,
    zoom,
    scrollPosition,
    externalIsPlaying,
    slices,
    sections,
    currentSlice,
    currentSection,
    currentAnnotation,
    playbackPosition,
    isLooping,
    loopStart,
    loopEnd,
    showAllSections,
    drawTimeline,
    showAnnotations,
    annotations,
  ])

  const handleAddSlice = () => {
    if (!buffer) return

    // Add a slice at the current playhead position
    const newSlicePosition = Math.floor(buffer.length * playbackPosition)

    // Find the next slice position to determine the end of this slice
    let endPosition = buffer.length
    for (const slice of slices) {
      if (slice.startSample > newSlicePosition && slice.startSample < endPosition) {
        endPosition = slice.startSample
      }
    }

    const newSlice: AudioSlice = {
      id: slices.length,
      startSample: newSlicePosition,
      endSample: endPosition,
      name: `Slice ${slices.length + 1}`,
    }

    const updatedSlices = [...slices, newSlice].sort((a, b) => a.startSample - b.startSample)

    // Reassign IDs to maintain order
    const reindexedSlices = updatedSlices.map((slice, index) => ({
      ...slice,
      id: index,
      name: `Slice ${index + 1}`,
    }))

    setSlices(reindexedSlices)
    audioEngine.setSlices(reindexedSlices)
    onAudioLoad(buffer, reindexedSlices, sections)
  }

  const handleZoomIn = () => {
    setZoom(Math.min(zoom * 1.5, 10))
  }

  const handleZoomOut = () => {
    setZoom(Math.max(zoom / 1.5, 1))
  }

  const handleScroll = (direction: -1 | 1) => {
    const scrollStep = 0.1 / zoom
    setScrollPosition(Math.max(0, Math.min(1 - 1 / zoom, scrollPosition + direction * scrollStep)))
  }

  const togglePlayback = () => {
    if (externalTogglePlayback) {
      externalTogglePlayback()
    } else {
      // Fallback for standalone usage
      if (externalIsPlaying) { // Check externalIsPlaying for fallback logic
        if (currentPlaybackId) {
          audioEngine.stopPlayback(currentPlaybackId)
          setCurrentPlaybackId(null)
        }
      } else {
        if (buffer) {
          const options: any = {
            loop: isLooping,
            volume: Math.pow(10, volume / 20),
            rate: 1.0,
            // Added pitch shifting option
            pitch: pitch,
          }

          if (isLooping) {
            options.loopStart = loopStart * buffer.duration
            options.loopEnd = loopEnd * buffer.duration
          }

          const startPosition = playbackPosition * buffer.duration
          const playbackId = audioEngine.playBufferFromPosition(startPosition, options)

          if (playbackId) {
            setCurrentPlaybackId(playbackId)
          }
        }
      }
    }
  }

  const handleSliceByChange = (value: string) => {
    setSliceBy(value as "section" | "transient" | "beat" | "manual")
  }

  const handlePlaybackModeChange = (value: string) => {
    setPlaybackMode(value as "mono" | "stereo")
  }

  const toggleLooping = () => {
    const newLoopState = !isLooping
    setIsLooping(newLoopState)

    if (newLoopState && buffer) {
      // If a section is selected, loop that section
      if (currentSection !== null) {
        const section = sections.find((s) => s.id === currentSection)
        if (section) {
          setLoopStart(section.startSample / buffer.length)
          setLoopEnd(section.endSample / buffer.length)
        }
      }
      // If a slice is selected, loop that slice
      else if (currentSlice !== null) {
        const slice = slices.find((s) => s.id === currentSlice)
        if (slice) {
          setLoopStart(slice.startSample / buffer.length)
          setLoopEnd(slice.endSample / buffer.length)
        }
      }
      // Otherwise, loop the entire track
      else {
        setLoopStart(0)
        setLoopEnd(1)
      }
    }
    // If turning off looping, reset loop points to defaults or full track
    else if (!newLoopState && buffer) {
      setLoopStart(0)
      setLoopEnd(1)
    }

    // Call external onToggleLoop if provided
    onToggleLoop?.()
  }

  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!buffer || !canvasRef.current) return

    const canvasElement = canvasRef.current
    const rect = canvasElement.getBoundingClientRect()
    const x = e.clientX - rect.left
    const timePosition = (x / canvasElement.width) * buffer.duration

    // Check if clicking near an annotation boundary
    for (const annotation of annotations) {
      const startX = (annotation.startTime / buffer.duration) * canvasElement.width
      const endX = (annotation.endTime / buffer.duration) * canvasElement.width

      if (Math.abs(x - startX) < 10) {
        setDraggedBoundary({ annotationId: annotation.id, type: "start" })
        return
      }
      if (Math.abs(x - endX) < 10) {
        setDraggedBoundary({ annotationId: annotation.id, type: "end" })
        return
      }
    }

    // Original click behavior
    setPlaybackPosition(x / canvasElement.width)
  }

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!buffer || !canvasRef.current) return

    const canvasElement = canvasRef.current
    const rect = canvasElement.getBoundingClientRect()
    const x = e.clientX - rect.left
    const normalizedPosition = x / canvasElement.width

    // Set playback position
    setPlaybackPosition(normalizedPosition)
    onPlaybackPositionChange?.(normalizedPosition)

    // If playing, jump to this position
    // Check externalIsPlaying before seeking during playback
    if (externalIsPlaying && currentPlaybackId) {
      audioEngine.stopPlayback(currentPlaybackId)

      const options: any = {
        loop: isLooping,
        volume: Math.pow(10, volume / 20),
        rate: 1.0,
        // Added pitch shifting option
        pitch: pitch,
      }

      if (isLooping) {
        options.loopStart = loopStart * buffer.duration
        options.loopEnd = loopEnd * buffer.duration
      }

      const newPlaybackId = audioEngine.playBufferFromPosition(normalizedPosition * buffer.duration, options)

      if (newPlaybackId) {
        setCurrentPlaybackId(newPlaybackId)
      }
    }
  }

  const seekToSlice = (sliceId: number) => {
    if (!buffer) return

    const slice = slices.find((s) => s.id === sliceId)
    if (slice) {
      const newPosition = slice.startSample / buffer.length
      setPlaybackPosition(newPosition)
      setCurrentSlice(sliceId)
      onPlaybackPositionChange?.(newPosition)
      onCurrentSliceChange?.(sliceId)

      // If currently playing, seek to this position
      // Check externalIsPlaying before seeking during playback
      if (externalIsPlaying && currentPlaybackId) {
        audioEngine.stopPlayback(currentPlaybackId)

        const options: any = {
          loop: isLooping,
          volume: Math.pow(10, volume / 20),
          rate: 1.0,
          // Added pitch shifting option
          pitch: pitch,
        }

        if (isLooping) {
          options.loopStart = loopStart * buffer.duration
          options.loopEnd = loopEnd * buffer.duration
        }

        const newPlaybackId = audioEngine.playBufferFromPosition(newPosition * buffer.duration, options)
        if (newPlaybackId) {
          setCurrentPlaybackId(newPlaybackId)
        }
      }
    }
  }

  const seekToSection = (sectionId: number) => {
    if (!buffer) return

    const section = sections.find((s) => s.id === sectionId)
    if (section) {
      const newPosition = section.startSample / buffer.length
      setPlaybackPosition(newPosition)
      setCurrentSection(sectionId)
      onPlaybackPositionChange?.(newPosition)
      onCurrentSectionChange?.(sectionId)

      // If currently playing, seek to this position
      // Check externalIsPlaying before seeking during playback
      if (externalIsPlaying && currentPlaybackId) {
        audioEngine.stopPlayback(currentPlaybackId)

        const options: any = {
          loop: isLooping,
          volume: Math.pow(10, volume / 20),
          rate: 1.0,
          // Added pitch shifting option
          pitch: pitch,
        }

        if (isLooping) {
          options.loopStart = loopStart * buffer.duration
          options.loopEnd = loopEnd * buffer.duration
        }

        const newPlaybackId = audioEngine.playBufferFromPosition(newPosition * buffer.duration, options)
        if (newPlaybackId) {
          setCurrentPlaybackId(newPlaybackId)
        }
      }
    }
  }

  const seekToAnnotation = (annotationId: string) => {
    if (!buffer) return

    const annotation = annotations.find((a) => a.id === annotationId)
    if (annotation) {
      const newPosition = annotation.startTime / buffer.duration
      setPlaybackPosition(newPosition)
      setCurrentAnnotation(annotationId)
      onPlaybackPositionChange?.(newPosition)
      onCurrentAnnotationChange?.(annotationId)

      // If currently playing, seek to this position
      // Check externalIsPlaying before seeking during playback
      if (externalIsPlaying && currentPlaybackId) {
        audioEngine.stopPlayback(currentPlaybackId)

        const options: any = {
          loop: isLooping,
          volume: Math.pow(10, volume / 20),
          rate: 1.0,
          // Added pitch shifting option
          pitch: pitch,
        }

        if (isLooping) {
          options.loopStart = loopStart * buffer.duration
          options.loopEnd = loopEnd * buffer.duration
        }

        const newPlaybackId = audioEngine.playBufferFromPosition(newPosition * buffer.duration, options)
        if (newPlaybackId) {
          setCurrentPlaybackId(newPlaybackId)
        }
      }
    }
  }

  useEffect(() => {
    if (!buffer || !externalIsPlaying) return // Use externalIsPlaying

    // Find current slice based on playback position
    const currentSample = playbackPosition * buffer.length
    const activeSlice = slices.find((slice) => currentSample >= slice.startSample && currentSample < slice.endSample)

    if (activeSlice && activeSlice.id !== currentSlice) {
      setCurrentSlice(activeSlice.id)
      onCurrentSliceChange?.(activeSlice.id)
    }

    // Find current section based on playback position
    const activeSection = sections.find(
      (section) => currentSample >= section.startSample && currentSample < section.endSample,
    )

    if (activeSection && activeSection.id !== currentSection) {
      setCurrentSection(activeSection.id)
      onCurrentSectionChange?.(activeSection.id)
    }

    // Find current annotation based on playback position
    const currentTime = playbackPosition * buffer.duration
    const activeAnnotation = annotations.find(
      (annotation) => currentTime >= annotation.startTime && currentTime < annotation.endTime,
    )

    const activeAnnotationId = activeAnnotation ? activeAnnotation.id : null
    if (activeAnnotationId !== currentAnnotation) {
      setCurrentAnnotation(activeAnnotationId)
      onCurrentAnnotationChange?.(activeAnnotationId)
    }
  }, [
    playbackPosition,
    buffer,
    slices,
    sections,
    annotations,
    currentSlice,
    currentSection,
    currentAnnotation,
    externalIsPlaying, // Use externalIsPlaying
    onCurrentSliceChange,
    onCurrentSectionChange,
    onCurrentAnnotationChange,
  ])

  // Expose playback position updates
  useEffect(() => {
    onPlaybackPositionChange?.(playbackPosition)
  }, [playbackPosition, onPlaybackPositionChange])

  return (
    <div className="border border-zinc-800 rounded-md bg-zinc-900/80 overflow-hidden">
      {/* Waveform header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-800 bg-zinc-900">
        <div className="flex items-center gap-2">
          {buffer ? (
            <>
              <div className="w-4 h-4 rounded-full bg-orange-500"></div>
              <span className="text-sm font-medium text-zinc-300">{fileName || "sample.wav"}</span>
              <span className="text-xs text-zinc-500">{buffer ? formatTime(buffer.duration) : "0:00"}</span>
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
            onClick={toggleLooping}
            title="Toggle loop mode"
          >
            <Repeat className="h-3 w-3 mr-1" />
            Loop
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "h-7 px-2 text-xs hover:text-zinc-100 hover:bg-zinc-800",
              showAllSections ? "text-yellow-400" : "text-zinc-400",
            )}
            onClick={() => setShowAllSections(!showAllSections)}
            title="Toggle section visibility"
          >
            Sections
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800"
            onClick={handleZoomOut}
          >
            <ZoomOut className="h-3 w-3 mr-1" />
            Zoom
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800"
            onClick={handleZoomIn}
          >
            <ZoomIn className="h-3 w-3 mr-1" />
            Zoom
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800"
            onClick={() => handleScroll(-1)}
            disabled={scrollPosition <= 0}
          >
            <ChevronLeft className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800"
            onClick={() => handleScroll(1)}
            disabled={scrollPosition >= 1 - 1 / zoom}
          >
            <ChevronRight className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* Timeline display */}
      <div className="h-6 border-b border-zinc-800 bg-zinc-900/50">
        <canvas ref={timelineRef} height="24" className="w-full h-full" />
      </div>

      {/* Waveform display */}
      <div className="relative" ref={containerRef}>
        {!buffer ? (
          <div
            className="flex flex-col items-center justify-center h-40 bg-zinc-950 cursor-pointer hover:bg-zinc-900 transition-colors"
            onClick={handleFileClick}
          >
            <Upload className="h-8 w-8 text-zinc-700 mb-2" />
            <p className="text-zinc-500 text-sm">Click to load audio file</p>
            <p className="text-zinc-600 text-xs mt-1">WAV, MP3, AIFF supported</p>
            <input ref={fileInputRef} type="file" accept="audio/*" className="hidden" onChange={handleFileChange} />
          </div>
        ) : (
          <>
            <canvas
              ref={canvasRef}
              width={width || 300}
              height="150"
              style={{ width: "100%", height: "150px" }}
              className="bg-zinc-950 cursor-pointer"
              onClick={handleCanvasClick}
              onMouseDown={handleCanvasMouseDown}
            />

            {isProcessing && (
              <div className="absolute inset-0 flex items-center justify-center bg-zinc-950/90 z-10">
                <div className="flex flex-col items-center">
                  <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin mb-2"></div>
                  <p className="text-zinc-400 text-sm font-medium">Analyzing audio...</p>
                  <p className="text-zinc-500 text-xs mt-1">
                    {sliceBy === "section" ? "Detecting song structure" : "Detecting transients"}
                  </p>
                </div>
              </div>
            )}

            {/* Playback controls overlay */}
            <div className="absolute bottom-2 left-2 flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 rounded-full bg-zinc-800/80 hover:bg-zinc-700"
                onClick={togglePlayback}
              >
                {externalIsPlaying ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 rounded-full bg-zinc-800/80 hover:bg-zinc-700"
                onClick={() => {
                  if (currentPlaybackId) {
                    audioEngine.stopPlayback(currentPlaybackId)
                    setCurrentPlaybackId(null)
                  }
                  if (externalTogglePlayback) {
                    externalTogglePlayback()
                  }
                  setPlaybackPosition(0)
                }}
              >
                <SkipBack className="h-3 w-3" />
              </Button>
            </div>

            {/* Current position indicator */}
            <div className="absolute bottom-2 right-2 px-2 py-1 bg-zinc-800/80 rounded text-xs text-zinc-300">
              {buffer ? formatTime(playbackPosition * buffer.duration) : "0:00"}
            </div>
          </>
        )}
      </div>

      <TransportControls
        isPlaying={externalIsPlaying}
        onPlay={externalTogglePlayback || togglePlayback}
        onPause={onPause || (() => {})}
        onSkipForward={onSkipForward || (() => {})}
        onSkipBack={onSkipBack || (() => {})}
        bpm={bpm}
        onBpmChange={onBpmChange || (() => {})}
        isLooping={externalIsLooping}
        onToggleLoop={onToggleLoop}
        pitch={pitch}
        onPitchChange={setPitch}
      />

      {/* Parameter controls */}
      <div className="grid grid-cols-5 gap-2 p-3 border-t border-zinc-800 bg-zinc-900/90">
        <div className="space-y-1">
          <label className="block text-xs text-zinc-400">Gain</label>
          <div className="flex items-center gap-2">
            <Slider
              value={[gain]}
              min={-24}
              max={24}
              step={0.1}
              onValueChange={(value) => setGain(value[0])}
              className="flex-1 slider-thumb-rect [&_[role=slider]]:bg-orange-400 [&_[role=slider]]:border-orange-500 [&_[role=slider]]:hover:bg-orange-300"
            />
            <span className="text-xs text-zinc-400 w-12">{gain.toFixed(1)} dB</span>
          </div>
        </div>

        <div className="space-y-1">
          <label className="block text-xs text-zinc-400">Slice By</label>
          <Select value={sliceBy} onValueChange={handleSliceByChange}>
            <SelectTrigger className="h-8 text-xs bg-zinc-800 border-zinc-700 focus:ring-cyan-500">
              <SelectValue placeholder="Select slicing method" />
            </SelectTrigger>
            <SelectContent className="bg-zinc-800 border-zinc-700">
              <SelectItem value="section" className="text-xs">
                Sections
              </SelectItem>
              <SelectItem value="transient" className="text-xs">
                Transient
              </SelectItem>
              <SelectItem value="manual" className="text-xs">
                Manual
              </SelectItem>
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
              className="flex-1 slider-thumb-rect [&_[role=slider]]:bg-cyan-400 [&_[role=slider]]:border-cyan-500 [&_[role=slider]]:hover:bg-cyan-300"
              disabled={sliceBy !== "transient"}
            />
            <span className="text-xs text-zinc-400 w-12">{Math.round(sensitivity * 100)}%</span>
          </div>
        </div>

        <div className="space-y-1">
          <label className="block text-xs text-zinc-400">Playback</label>
          <Select value={playbackMode} onValueChange={handlePlaybackModeChange}>
            <SelectTrigger className="h-8 text-xs bg-zinc-800 border-zinc-700 focus:ring-cyan-500">
              <SelectValue placeholder="Select playback mode" />
            </SelectTrigger>
            <SelectContent className="bg-zinc-800 border-zinc-700">
              <SelectItem value="mono" className="text-xs">
                Mono
              </SelectItem>
              <SelectItem value="stereo" className="text-xs">
                Stereo
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <label className="block text-xs text-zinc-400">Volume</label>
          <div className="flex items-center gap-2">
            <Slider
              value={[volume]}
              min={-60}
              max={0}
              step={0.1}
              onValueChange={(value) => setVolume(value[0])}
              className="flex-1 slider-thumb-rect [&_[role=slider]]:bg-zinc-400 [&_[role=slider]]:border-zinc-500 [&_[role=slider]]:hover:bg-zinc-300"
            />
            <span className="text-xs text-zinc-400 w-12">{volume.toFixed(1)} dB</span>
          </div>
        </div>

        <div className="space-y-1">
          <label className="block text-xs text-zinc-400">Annotations</label>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              className="h-6 px-2 text-xs border-zinc-700 bg-zinc-800 hover:bg-zinc-700 hover:text-yellow-300"
              onClick={createAnnotationsFromSections}
              disabled={!buffer || sections.length === 0}
            >
              Create
            </Button>
            <Button
              variant="outline"
              size="sm"
              className={cn(
                "h-6 px-2 text-xs border-zinc-700",
                showAnnotations
                  ? "bg-yellow-500/20 border-yellow-500 text-yellow-400"
                  : "bg-zinc-800 hover:bg-zinc-700 hover:text-yellow-300",
              )}
              onClick={() => setShowAnnotations(!showAnnotations)}
              disabled={annotations.length === 0}
            >
              Show
            </Button>
          </div>
        </div>
      </div>

      {/* Sections controls */}
      {sliceBy === "section" && (
        <div className="p-3 border-t border-zinc-800 bg-zinc-900/90">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-medium text-zinc-300">Sections ({sections.length})</h3>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                className="h-6 px-2 text-xs border-zinc-700 bg-zinc-800 hover:bg-zinc-700 hover:text-yellow-300"
                onClick={detectSections}
                disabled={!buffer}
              >
                <Wand2 className="h-3 w-3 mr-1" />
                Detect
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-6 px-2 text-xs border-zinc-700 bg-zinc-800 hover:bg-zinc-700 hover:text-orange-300"
                onClick={() => {
                  setMaxSections(Math.max(2, Math.min(12, maxSections + 1)))
                  if (buffer) detectSections()
                }}
                disabled={!buffer || maxSections >= 12}
              >
                More
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-6 px-2 text-xs border-zinc-700 bg-zinc-800 hover:bg-zinc-700 hover:text-orange-300"
                onClick={() => {
                  setMaxSections(Math.max(2, maxSections - 1))
                  if (buffer) detectSections()
                }}
                disabled={!buffer || maxSections <= 2}
              >
                Less
              </Button>
            </div>
          </div>

          {buffer ? (
            sections.length > 0 ? (
              <div className="grid grid-cols-4 gap-1">
                {sections.map((section) => (
                  <Button
                    key={section.id}
                    variant="outline"
                    size="sm"
                    className={cn(
                      "h-8 text-xs border-zinc-700",
                      currentSection === section.id
                        ? "bg-yellow-500/20 border-yellow-500 text-yellow-400"
                        : "bg-zinc-800 hover:bg-zinc-700 hover:text-yellow-300",
                    )}
                    onClick={() => seekToSection(section.id)}
                  >
                    {section.name}
                  </Button>
                ))}
              </div>
            ) : (
              <p className="text-xs text-zinc-500">No sections detected. Try adjusting settings or add manually.</p>
            )
          ) : (
            <p className="text-xs text-zinc-500">Load an audio file to create sections.</p>
          )}
        </div>
      )}

      {/* Slice controls */}
      <div className="p-3 border-t border-zinc-800 bg-zinc-900/90">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-medium text-zinc-300">
            Slices ({slices.length})
            {currentSection !== null && sections.length > 0 && ` - ${sections[currentSection]?.name || "Section"}`}
          </h3>
          <div className="flex items-center gap-1">
            {sliceBy === "transient" && (
              <Button
                variant="outline"
                size="sm"
                className="h-6 px-2 text-xs border-zinc-700 bg-zinc-800 hover:bg-zinc-700 hover:text-cyan-300"
                onClick={detectTransients}
                disabled={!buffer}
              >
                <Wand2 className="h-3 w-3 mr-1" />
                Detect
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              className="h-6 px-2 text-xs border-zinc-700 bg-zinc-800 hover:bg-zinc-700 hover:text-orange-300"
              onClick={handleAddSlice}
              disabled={!buffer}
            >
              Add Slice
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-6 px-2 text-xs border-zinc-700 bg-zinc-800 hover:bg-zinc-700 hover:text-orange-300"
              onClick={() => {
                setSlices([])
                if (buffer) {
                  audioEngine.setSlices([])
                  onAudioLoad(buffer, [], sections)
                }
              }}
              disabled={slices.length === 0}
            >
              Clear
            </Button>
          </div>
        </div>

        {buffer ? (
          slices.length > 0 ? (
            <div className="grid grid-cols-8 gap-1">
              {/* Filter slices by current section if one is selected */}
              {slices
                .filter(
                  (slice) =>
                    currentSection === null || slice.sectionId === undefined || slice.sectionId === currentSection,
                )
                .slice(0, 16)
                .map((slice, index) => (
                  <Button
                    key={`slice-${slice.id}-${index}`}
                    variant="outline"
                    size="sm"
                    className={cn(
                      "h-8 text-xs border-zinc-700",
                      currentSlice === slice.id
                        ? "bg-cyan-500/20 border-cyan-500 text-cyan-400"
                        : "bg-zinc-800 hover:bg-zinc-700 hover:text-cyan-300",
                    )}
                    onClick={() => seekToSlice(slice.id)}
                  >
                    {slice.id + 1}
                  </Button>
                ))}
              {slices.length > 16 && (
                <div className="flex items-center justify-center h-8 text-xs text-zinc-500">
                  +{slices.length - 16} more
                </div>
              )}
            </div>
          ) : (
            <p className="text-xs text-zinc-500">
              {sliceBy === "transient"
                ? "No transients detected. Try adjusting sensitivity or add slices manually."
                : "No slices created yet. Add slices to divide your sample."}
            </p>
          )
        ) : (
          <p className="text-xs text-zinc-500">Load an audio file to create slices.</p>
        )}
      </div>

      {/* Detailed Annotations List */}
      {showAnnotations && annotations.length > 0 && (
        <div className="p-3 border-t border-zinc-800 bg-zinc-900/90">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-zinc-300">Word/Phrase Annotations ({annotations.length})</h3>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                className="h-6 px-2 text-xs border-zinc-700 bg-zinc-800 hover:bg-zinc-700 hover:text-yellow-300"
                onClick={() => {
                  const newAnnotation = {
                    id: `w${String(annotations.length + 1).padStart(6, "0")}`,
                    startTime: playbackPosition * (buffer?.duration || 0),
                    endTime: (playbackPosition + 0.1) * (buffer?.duration || 0),
                    text: "New phrase",
                  }
                  setAnnotations([...annotations, newAnnotation])
                }}
                disabled={!buffer}
              >
                Add
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-6 px-2 text-xs border-zinc-700 bg-zinc-800 hover:bg-zinc-700 hover:text-orange-300"
                onClick={() => {
                  // Export annotations as JSON
                  const dataStr = JSON.stringify(annotations, null, 2)
                  const dataBlob = new Blob([dataStr], { type: "application/json" })
                  const url = URL.createObjectURL(dataBlob)
                  const link = document.createElement("a")
                  link.href = url
                  link.download = "word_annotations.json"
                  link.click()
                  URL.revokeObjectURL(url)
                }}
                disabled={annotations.length === 0}
              >
                Export JSON
              </Button>
            </div>
          </div>

          <div className="space-y-1 max-h-48 overflow-y-auto">
            {annotations.map((annotation) => (
              <div
                key={annotation.id}
                className={cn(
                  "flex items-center gap-2 p-2 rounded border transition-colors cursor-pointer",
                  currentAnnotation === annotation.id
                    ? "bg-green-500/20 border-green-500 hover:border-green-400"
                    : "bg-zinc-800/50 border-zinc-700 hover:border-zinc-600",
                )}
                onClick={() => seekToAnnotation(annotation.id)}
              >
                <span className="text-xs font-mono text-zinc-400 w-16">{annotation.id}</span>
                <span className="text-xs font-mono text-zinc-500 w-24">{formatTime(annotation.startTime)}</span>
                <span className="text-xs font-mono text-zinc-500 w-24">{formatTime(annotation.endTime)}</span>
                <div className="flex-1">
                  {editingAnnotation === annotation.id ? (
                    <input
                      type="text"
                      value={annotation.text}
                      onChange={(e) => {
                        setAnnotations(
                          annotations.map((a) => (a.id === annotation.id ? { ...a, text: e.target.value } : a)),
                        )
                      }}
                      onBlur={() => setEditingAnnotation(null)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") setEditingAnnotation(null)
                      }}
                      className="w-full bg-zinc-700 border border-zinc-600 rounded px-2 py-1 text-xs text-zinc-200 focus:outline-none focus:ring-1 focus:ring-yellow-500"
                      autoFocus
                    />
                  ) : (
                    <span
                      className={cn(
                        "text-xs cursor-pointer hover:text-zinc-100",
                        currentAnnotation === annotation.id ? "text-green-300 font-medium" : "text-zinc-300",
                      )}
                      onClick={(e) => {
                        e.stopPropagation()
                        setEditingAnnotation(annotation.id)
                      }}
                    >
                      {annotation.text}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-zinc-500 hover:text-zinc-300"
                    onClick={(e) => {
                      e.stopPropagation()
                      const newStartTime = Math.max(0, annotation.startTime - 0.1)
                      setAnnotations(
                        annotations.map((a) => (a.id === annotation.id ? { ...a, startTime: newStartTime } : a)),
                      )
                    }}
                    title="Extend start backward"
                  >
                    <span className="text-xs">−</span>
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-zinc-500 hover:text-zinc-300"
                    onClick={(e) => {
                      e.stopPropagation()
                      const newEndTime = Math.min(buffer?.duration || 0, annotation.endTime + 0.1)
                      setAnnotations(
                        annotations.map((a) => (a.id === annotation.id ? { ...a, endTime: newEndTime } : a)),
                      )
                    }}
                    title="Extend end forward"
                  >
                    <span className="text-xs">+</span>
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-zinc-500 hover:text-zinc-300"
                    onClick={(e) => {
                      e.stopPropagation()
                      seekToAnnotation(annotation.id)
                    }}
                    title="Jump to phrase"
                  >
                    <span className="text-xs">▶</span>
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-zinc-500 hover:text-red-400"
                    onClick={(e) => {
                      e.stopPropagation()
                      setAnnotations(annotations.filter((a) => a.id !== annotation.id))
                    }}
                    title="Delete annotation"
                  >
                    <span className="text-xs">🗑</span>
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
