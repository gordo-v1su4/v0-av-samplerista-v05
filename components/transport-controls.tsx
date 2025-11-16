"use client"

import { Play, Pause, SkipForward, SkipBack, Square, Repeat, Save, FolderOpen } from 'lucide-react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

interface TransportControlsProps {
  isPlaying: boolean
  onPlay: () => void
  onPause: () => void
  onSkipForward: () => void
  onSkipBack: () => void
  bpm: number
  onBpmChange: (bpm: number) => void
  isLooping?: boolean
  onToggleLoop?: () => void
  pitch?: number
  onPitchChange?: (pitch: number) => void
}

export function TransportControls({
  isPlaying,
  onPlay,
  onPause,
  onSkipForward,
  onSkipBack,
  bpm,
  onBpmChange,
  isLooping = false,
  onToggleLoop,
  pitch = 0,
  onPitchChange,
}: TransportControlsProps) {
  const handleBpmInput = (value: string) => {
    const numValue = Number.parseInt(value)
    if (!isNaN(numValue) && numValue >= 40 && numValue <= 300) {
      onBpmChange(numValue)
    }
  }

  const handlePitchInput = (value: string) => {
    const numValue = Number.parseInt(value)
    if (!isNaN(numValue) && numValue >= -12 && numValue <= 12) {
      onPitchChange?.(numValue)
    }
  }

  return (
    <div className="flex items-center justify-between gap-4 px-3 py-2 border-b border-zinc-800 bg-zinc-900/50">
      {/* Main transport controls */}
      <div className="flex items-center gap-1.5">
        <TooltipProvider delayDuration={300}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-lg border border-zinc-700 bg-zinc-800/80 hover:bg-zinc-700 hover:text-yellow-400 text-zinc-300 transition-all duration-200"
                onClick={onSkipBack}
              >
                <SkipBack className="h-4 w-4" />
                <span className="sr-only">Previous</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="glass-morphism text-zinc-100">
              <p className="text-xs font-semibold">Previous Slice</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <TooltipProvider delayDuration={300}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={isPlaying ? "default" : "ghost"}
                size="icon"
                className={cn(
                  "h-10 w-10 rounded-lg transition-all duration-200",
                  isPlaying
                    ? "bg-gradient-to-br from-orange-500 to-orange-600 text-white hover:from-orange-400 hover:to-orange-500 shadow-lg shadow-orange-500/30"
                    : "border border-zinc-700 bg-zinc-800/80 hover:bg-zinc-700 hover:text-orange-400 text-zinc-300",
                )}
                onClick={isPlaying ? onPause : onPlay}
                aria-label={isPlaying ? "Pause" : "Play"}
              >
                {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 ml-0.5" />}
                <span className="sr-only">{isPlaying ? "Pause" : "Play"}</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="glass-morphism text-zinc-100">
              <p className="text-xs font-semibold">{isPlaying ? "Pause Playback" : "Start Playback"}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <TooltipProvider delayDuration={300}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-lg border border-zinc-700 bg-zinc-800/80 hover:bg-zinc-700 hover:text-yellow-400 text-zinc-300 transition-all duration-200"
                onClick={() => onPause()}
              >
                <Square className="h-4 w-4" />
                <span className="sr-only">Stop</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="glass-morphism text-zinc-100">
              <p className="text-xs font-semibold">Stop Playback</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <TooltipProvider delayDuration={300}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-lg border border-zinc-700 bg-zinc-800/80 hover:bg-zinc-700 hover:text-yellow-400 text-zinc-300 transition-all duration-200"
                onClick={onSkipForward}
              >
                <SkipForward className="h-4 w-4" />
                <span className="sr-only">Next</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="glass-morphism text-zinc-100">
              <p className="text-xs font-semibold">Next Slice</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <div className="w-px h-8 bg-zinc-800/50 mx-1"></div>

        <TooltipProvider delayDuration={300}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  "h-8 w-8 rounded-lg border transition-all duration-200",
                  isLooping
                    ? "bg-yellow-500/20 border-yellow-500 text-yellow-400 hover:bg-yellow-500/30"
                    : "border-zinc-700 bg-zinc-800/80 hover:bg-zinc-700 hover:text-yellow-400 text-zinc-300",
                )}
                onClick={onToggleLoop}
              >
                <Repeat className="h-4 w-4" />
                <span className="sr-only">Loop</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="glass-morphism text-zinc-100">
              <p className="text-xs font-semibold">{isLooping ? "Disable Loop" : "Enable Loop"}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      <div className="flex items-center gap-3">
        {/* BPM Control */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-900/80 border border-zinc-800/50">
          <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">BPM</span>
          <Input
            id="bpm"
            type="number"
            value={bpm}
            onChange={(e) => handleBpmInput(e.target.value)}
            className="w-16 h-7 text-sm font-mono font-bold bg-zinc-900/50 border-zinc-700/50 focus-visible:ring-orange-500/50 focus-visible:border-orange-500/50 text-center text-zinc-200 transition-all duration-200"
            min={40}
            max={300}
            step={1}
            aria-label="Beats Per Minute"
          />
        </div>

        {onPitchChange && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-900/80 border border-zinc-800/50">
            <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Pitch</span>
            <Input
              id="pitch"
              type="number"
              value={pitch}
              onChange={(e) => handlePitchInput(e.target.value)}
              className="w-16 h-7 text-sm font-mono font-bold bg-zinc-900/50 border-zinc-700/50 focus-visible:ring-cyan-500/50 focus-visible:border-cyan-500/50 text-center text-zinc-200 transition-all duration-200"
              min={-12}
              max={12}
              step={1}
              aria-label="Pitch in semitones"
            />
            <span className="text-xs text-zinc-500">st</span>
          </div>
        )}

        <div className="w-px h-8 bg-zinc-800/50"></div>

        {/* Project controls */}
        <div className="flex items-center gap-1.5">
          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-lg border border-zinc-700 bg-zinc-800/80 hover:bg-zinc-700 hover:text-yellow-400 text-zinc-300 transition-all duration-200"
                >
                  <Save className="h-4 w-4" />
                  <span className="sr-only">Save Project</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="glass-morphism text-zinc-100">
                <p className="text-xs font-semibold">Save Project</p>
                <p className="text-xs text-zinc-500 mt-1">⌘S</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-lg border border-zinc-700 bg-zinc-800/80 hover:bg-zinc-700 hover:text-yellow-400 text-zinc-300 transition-all duration-200"
                >
                  <FolderOpen className="h-4 w-4" />
                  <span className="sr-only">Open Project</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="glass-morphism text-zinc-100">
                <p className="text-xs font-semibold">Open Project</p>
                <p className="text-xs text-zinc-500 mt-1">⌘O</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>
    </div>
  )
}
