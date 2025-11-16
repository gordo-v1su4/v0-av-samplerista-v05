"use client"

import { cn } from "@/lib/utils"
import { ImageIcon, VideoIcon } from 'lucide-react'
import type { AudioSlice } from "@/lib/audio-engine"
import { mediaLibrary } from "@/lib/media-library"
import { useState, useEffect } from "react"

interface DrumPadsProps {
  slices: AudioSlice[]
  activePad: number | null
  handlePadClick: (index: number) => void
  buffer: AudioBuffer | null
  isPlaying: boolean
  playbackPosition: number
  currentSlice: number | null
  currentAnnotation: string | null
}

export default function DrumPads({
  slices,
  activePad,
  handlePadClick,
  buffer,
  isPlaying,
  playbackPosition,
  currentSlice,
  currentAnnotation,
}: DrumPadsProps) {
  const padCount = 16
  const pads = Array.from({ length: padCount }, (_, i) => i)
  const [mediaItems, setMediaItems] = useState(mediaLibrary.getAllMedia())

  useEffect(() => {
    const interval = setInterval(() => {
      setMediaItems(mediaLibrary.getAllMedia())
    }, 500)
    return () => clearInterval(interval)
  }, [])

  const getCurrentPad = () => {
    if (!buffer || !isPlaying) return currentSlice

    const currentSample = playbackPosition * buffer.length
    const activeSlice = slices.find((slice) => currentSample >= slice.startSample && currentSample < slice.endSample)

    return activeSlice ? activeSlice.id : currentSlice
  }

  const currentActivePad = getCurrentPad()

  return (
    <div className="grid grid-cols-4 gap-3">
      {pads.map((pad) => {
        const slice = slices.find((s) => s.id === pad)
        const hasSlice = !!slice
        const media = hasSlice ? mediaLibrary.getMediaForSlice(pad) : undefined
        const isCurrentlyActive = currentActivePad === pad
        const isSelected = activePad === pad

        return (
          <button
            key={`pad-${pad}`}
            className={cn(
              "group relative aspect-square rounded-2xl border-2 transition-all duration-300 overflow-hidden",
              "focus:outline-none focus:ring-2 focus:ring-yellow-500/50 focus:ring-offset-2 focus:ring-offset-zinc-900",
              hasSlice
                ? "border-zinc-700/50 glass-morphism hover:border-cyan-500/50 active:scale-95 hover:scale-[1.02] shadow-lg hover:shadow-cyan-500/10"
                : "border-zinc-800/30 bg-zinc-900/20 text-zinc-700 cursor-not-allowed opacity-50",
              isCurrentlyActive &&
                "border-cyan-400/60 shadow-2xl shadow-cyan-500/30 bg-gradient-to-br from-cyan-500/20 to-cyan-600/10",
              isSelected && "ring-2 ring-cyan-500/60 ring-offset-2 ring-offset-zinc-900",
            )}
            onClick={() => hasSlice && handlePadClick(pad)}
            disabled={!hasSlice}
            aria-label={`Slice ${pad + 1}${hasSlice ? ` - ${slice.name}` : " - Empty"}`}
          >
            {/* Media thumbnail background */}
            {media && (
              <div className="absolute inset-0">
                <img
                  src={media.thumbnail || "/placeholder.svg"}
                  alt={media.name}
                  className="w-full h-full object-cover opacity-30 group-hover:opacity-40 transition-opacity duration-300"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/80 to-transparent"></div>
              </div>
            )}

            {/* Pad number badge */}
            <div className="absolute top-2.5 left-2.5 z-10">
              <div
                className={cn(
                  "px-2.5 py-1 rounded-lg text-xs font-bold tabular-nums transition-all duration-200 shadow-lg",
                  isCurrentlyActive
                    ? "bg-cyan-400 text-zinc-950"
                    : hasSlice
                      ? "bg-zinc-800/80 text-zinc-300 group-hover:bg-zinc-700/80"
                      : "bg-zinc-900/50 text-zinc-700",
                )}
              >
                {String(pad + 1).padStart(2, "0")}
              </div>
            </div>

            {/* Media type indicator */}
            {media && (
              <div className="absolute top-2.5 right-2.5 z-10">
                <div
                  className={cn(
                    "p-1.5 rounded-lg transition-all duration-200 shadow-lg",
                    media.type === "video" ? "bg-purple-500/80" : "bg-blue-500/80",
                  )}
                >
                  {media.type === "video" ? (
                    <VideoIcon className="w-3 h-3 text-white" />
                  ) : (
                    <ImageIcon className="w-3 h-3 text-white" />
                  )}
                </div>
              </div>
            )}

            {/* Active indicator */}
            {isPlaying && isCurrentlyActive && (
              <div className="absolute bottom-2.5 right-2.5 z-10">
                <div className="relative">
                  <div className="w-3 h-3 bg-cyan-400 rounded-full animate-premium-pulse shadow-lg shadow-cyan-400/50"></div>
                  <div className="absolute inset-0 w-3 h-3 bg-cyan-400 rounded-full animate-ping"></div>
                </div>
              </div>
            )}

            {/* Pad content */}
            <div className="relative z-10 flex flex-col items-center justify-center h-full px-4">
              {hasSlice && (
                <>
                  <div className="w-full h-12 mb-3 bg-black rounded border border-zinc-800/50"></div>

                  {/* Slice name */}
                  <span
                    className={cn(
                      "text-xs font-semibold text-center line-clamp-2 transition-colors duration-200 drop-shadow-lg",
                      isCurrentlyActive ? "text-cyan-300" : "text-zinc-300 group-hover:text-zinc-200",
                    )}
                  >
                    {slice.name}
                  </span>
                </>
              )}
            </div>

            {/* Hover overlay effect */}
            {hasSlice && (
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-t from-cyan-500/0 to-cyan-500/0 group-hover:from-cyan-500/10 group-hover:to-transparent transition-all duration-300 pointer-events-none"></div>
            )}
          </button>
        )
      })}
    </div>
  )
}
