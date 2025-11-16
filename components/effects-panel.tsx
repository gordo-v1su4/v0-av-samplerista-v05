"use client"
import { GripVertical } from "lucide-react"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"

interface Effect {
  id: string
  name: string
  enabled: boolean
  parameters: { name: string; value: number }[]
}

interface EffectsPanelProps {
  effects: Effect[]
  toggleEffect: (id: string) => void
  updateEffectParam: (id: string, paramName: string, value: number) => void
}

export default function EffectsPanel({ effects, toggleEffect, updateEffectParam }: EffectsPanelProps) {
  return (
    <div className="space-y-3">
      {effects.map((effect, index) => (
        <div
          key={effect.id}
          className={cn(
            "border-2 rounded-2xl p-5 transition-all duration-300",
            effect.enabled
              ? "border-zinc-700/50 glass-morphism shadow-xl"
              : "border-zinc-800/30 bg-zinc-900/20 opacity-60 hover:opacity-80",
          )}
        >
          {/* Effect header */}
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3 cursor-grab active:cursor-grabbing">
              <GripVertical className="h-5 w-5 text-zinc-600" />
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    "w-2.5 h-2.5 rounded-full transition-all duration-200",
                    effect.enabled
                      ? "bg-yellow-400 shadow-lg shadow-yellow-400/50 animate-premium-pulse"
                      : "bg-zinc-700",
                  )}
                ></div>
                <h3 className="text-base font-bold text-zinc-200">{effect.name}</h3>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span
                className={cn(
                  "text-xs font-bold uppercase tracking-wider",
                  effect.enabled ? "text-yellow-400" : "text-zinc-600",
                )}
              >
                {effect.enabled ? "ON" : "OFF"}
              </span>
              <Switch
                checked={effect.enabled}
                onCheckedChange={() => toggleEffect(effect.id)}
                className={cn(
                  "data-[state=checked]:bg-yellow-500 transition-all duration-200",
                  effect.enabled && "shadow-lg shadow-yellow-500/20",
                )}
                aria-label={`${effect.name} effect ${effect.enabled ? "enabled" : "disabled"}`}
              />
            </div>
          </div>

          {/* Effect parameters */}
          <div className="space-y-4">
            {effect.parameters.map((param) => (
              <div key={param.name} className="space-y-2">
                <div className="flex items-center justify-between">
                  <label htmlFor={`${effect.id}-${param.name}`} className="text-sm font-semibold text-zinc-400">
                    {param.name}
                  </label>
                  <span className="text-sm text-zinc-500 font-mono font-bold tabular-nums px-2 py-1 rounded-md bg-zinc-800/50">
                    {param.value}
                  </span>
                </div>
                <Slider
                  id={`${effect.id}-${param.name}`}
                  disabled={!effect.enabled}
                  value={[param.value]}
                  min={0}
                  max={200}
                  step={1}
                  onValueChange={(value) => updateEffectParam(effect.id, param.name, value[0])}
                  className={cn(
                    "slider-thumb-rect",
                    effect.enabled
                      ? "[&_[role=slider]]:bg-yellow-400 [&_[role=slider]]:border-yellow-500 [&_[role=slider]]:hover:bg-yellow-300"
                      : "[&_[role=slider]]:bg-zinc-600 [&_[role=slider]]:border-zinc-700",
                    "[&_[role=slider]]:focus:ring-yellow-500/50 transition-all duration-200",
                  )}
                  aria-label={`${effect.name} ${param.name} parameter`}
                />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
