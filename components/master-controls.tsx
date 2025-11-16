"use client"

import { useState } from "react"
import { Slider } from "@/components/ui/slider"
import { VolumeX, Volume2 } from "lucide-react"

export default function MasterControls() {
  const [volume, setVolume] = useState(50)

  const onVolumeChange = (value: number) => {
    setVolume(value)
  }

  return (
    <div className="p-4 border border-zinc-800 rounded-md bg-zinc-900/50">
      <h3 className="text-sm font-medium text-zinc-300 mb-4">Master Controls</h3>

      {/* Master Volume Slider */}
      <div className="mb-4">
        <label htmlFor="master-volume" className="block text-xs font-medium text-zinc-400 mb-2">
          Master Volume
        </label>
        <div className="flex items-center gap-2">
          <VolumeX className="h-4 w-4 text-zinc-500" />
          <Slider
            id="master-volume"
            value={[volume]}
            min={0}
            max={100}
            step={1}
            onValueChange={(value) => onVolumeChange(value[0])}
            className="flex-1 slider-thumb-rect [&_[role=slider]]:bg-yellow-400 [&_[role=slider]]:border-yellow-500 [&_[role=slider]]:hover:bg-yellow-300 [&_[role=slider]]:focus:ring-yellow-500"
            aria-label="Master Volume"
          />
          <Volume2 className="h-4 w-4 text-zinc-300" />
          <span className="text-xs text-zinc-400 w-8 text-right">{volume}%</span>
        </div>
      </div>

      {/* Volume Meter */}
      <div>
        <label className="block text-xs font-medium text-zinc-400 mb-2">Audio Levels</label>
        <div className="flex items-center gap-2" aria-label="Audio Level Meters">
          <div className="flex-1 h-16 bg-zinc-800 rounded-sm overflow-hidden flex items-end" aria-label="Left Channel">
            {Array.from({ length: 12 }).map((_, i) => {
              const height = Math.random() * 100
              const color = height > 80 ? "bg-yellow-500" : height > 60 ? "bg-yellow-400/80" : "bg-zinc-600"
              return (
                <div
                  key={`left-${i}`}
                  className={`w-2 mx-[1px] transition-all duration-150 ${color}`}
                  style={{ height: `${height}%` }}
                ></div>
              )
            })}
          </div>

          <div className="flex-1 h-16 bg-zinc-800 rounded-sm overflow-hidden flex items-end" aria-label="Right Channel">
            {Array.from({ length: 12 }).map((_, i) => {
              const height = Math.random() * 100
              const color = height > 80 ? "bg-yellow-500" : height > 60 ? "bg-yellow-400/80" : "bg-zinc-600"
              return (
                <div
                  key={`right-${i}`}
                  className={`w-2 mx-[1px] transition-all duration-150 ${color}`}
                  style={{ height: `${height}%` }}
                ></div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
