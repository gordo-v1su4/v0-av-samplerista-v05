"use client"

import React, { useState, useCallback, useRef, useEffect } from "react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

interface SequencerProps {
  tracks: number
  steps: number
  initialSequence?: boolean[][]
  onSequenceChange?: (sequence: boolean[][]) => void
}

export default function Sequencer({ tracks, steps, initialSequence, onSequenceChange }: SequencerProps) {
  const [sequence, setSequence] = useState<boolean[][]>(
    initialSequence ||
      Array(tracks)
        .fill(null)
        .map(() => Array(steps).fill(false)),
  )
  const [currentStep, setCurrentStep] = useState<number>(0)
  const [isPlaying, setIsPlaying] = useState<boolean>(false)
  const intervalRef = useRef<number | null>(null)

  useEffect(() => {
    if (initialSequence) {
      setSequence(initialSequence)
    }
  }, [initialSequence])

  const toggleStep = useCallback(
    (track: number, step: number) => {
      const newSequence = sequence.map((row, rowIndex) =>
        rowIndex === track ? row.map((val, index) => (index === step ? !val : val)) : row,
      )
      setSequence(newSequence)
      onSequenceChange?.(newSequence)
    },
    [sequence, onSequenceChange],
  )

  const isStepActive = useCallback(
    (track: number, step: number) => {
      return sequence[track][step]
    },
    [sequence],
  )

  const start = useCallback(() => {
    setIsPlaying(true)
    if (intervalRef.current) return

    intervalRef.current = window.setInterval(() => {
      setCurrentStep((prevStep) => (prevStep + 1) % steps)
    }, 200)
  }, [steps])

  const stop = useCallback(() => {
    setIsPlaying(false)
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    setCurrentStep(0)
  }, [])

  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [])

  return (
    <div className="space-y-4 border border-zinc-800 rounded-md p-4 bg-zinc-900/50">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-zinc-300">Step Sequencer</h3>
        <div>
          <Button
            className={
              isPlaying
                ? "bg-yellow-500 text-zinc-950 hover:bg-yellow-400"
                : "bg-zinc-800 hover:bg-zinc-700 hover:text-yellow-300"
            }
            size="sm"
            onClick={isPlaying ? stop : start}
          >
            {isPlaying ? "Stop" : "Start"}
          </Button>
        </div>
      </div>
      <div className="grid grid-cols-[40px_repeat(16,1fr)]">
        <div></div>
        {Array(steps)
          .fill(null)
          .map((_, step) => (
            <div
              key={`header-${step}`}
              className={cn(
                "flex items-center justify-center h-6 text-[10px] border-r border-zinc-800",
                step === currentStep ? "bg-yellow-500/20 text-yellow-400 font-medium" : "text-zinc-500",
                step % 4 === 0 && "border-l border-zinc-700 font-medium text-zinc-400",
              )}
            >
              {step + 1}
            </div>
          ))}

        {sequence.map((trackSequence, track) => (
          <React.Fragment key={`track-${track}`}>
            <div className="flex items-center justify-center h-8 text-zinc-500 border-r border-zinc-800">
              {track + 1}
            </div>
            {trackSequence.map((_, step) => (
              <button
                key={`step-${track}-${step}-${isStepActive(track, step)}`}
                className={cn(
                  "h-8 border-r border-t border-zinc-800 transition-colors",
                  "focus:outline-none focus:ring-1 focus:ring-inset focus:ring-yellow-500",
                  step === currentStep && "bg-zinc-800/50",
                  step % 4 === 0 && "border-l border-zinc-700",
                  isStepActive(track, step) ? "bg-yellow-500/30 hover:bg-yellow-500/40" : "hover:bg-zinc-800",
                )}
                onClick={() => toggleStep(track, step)}
                aria-label={`Track ${track + 1}, Step ${step + 1}, ${isStepActive(track, step) ? "Active" : "Inactive"}`}
                aria-pressed={isStepActive(track, step)}
              >
                {isStepActive(track, step) && <div className="w-3 h-3 mx-auto rounded-sm bg-yellow-400"></div>}
              </button>
            ))}
          </React.Fragment>
        ))}
      </div>
    </div>
  )
}
