import { Settings, Sparkles } from 'lucide-react'
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { SettingsModal } from "@/components/settings-modal"

export function AppHeader() {
  return (
    <header className="border-b border-zinc-800/50 glass-morphism sticky top-0 z-50 py-4 pr-6">
      <div className="container max-w-7xl flex items-center justify-between mx-0 px-1.5">
        {/* Logo and branding */}
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-yellow-400 via-yellow-500 to-amber-600 flex items-center justify-center shadow-xl shadow-yellow-500/25 transition-all duration-300 hover:scale-105 hover:shadow-yellow-500/40">
              <span className="font-black text-zinc-950 text-lg tracking-tighter">AV</span>
              <div className="absolute -top-1 -right-1">
                <Sparkles className="w-4 h-4 text-yellow-300 animate-premium-pulse" />
              </div>
            </div>
          </div>

          <div className="flex flex-col">
            <h1 className="text-3xl font-black gradient-text tracking-tight leading-none">Samplerista</h1>
            <p className="text-xs text-zinc-500 font-semibold tracking-widest uppercase mt-1">Smart Lyrics Studio</p>
          </div>
        </div>

        {/* Actions */}
        <TooltipProvider>
          <div className="flex items-center gap-3">
            <div className="hidden md:flex items-center gap-2 px-4 py-2 rounded-xl bg-zinc-900/50 border border-zinc-800/50">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-premium-pulse"></div>
              <span className="text-xs font-semibold text-zinc-400">Ready to Create</span>
            </div>

            <SettingsModal>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-11 w-11 rounded-xl border border-zinc-800/50 bg-zinc-900/30 hover:bg-zinc-800/60 hover:border-zinc-700 hover:text-yellow-400 transition-all duration-300 hover:scale-105"
                    aria-label="Settings"
                  >
                    <Settings className="h-5 w-5" />
                    <span className="sr-only">Settings</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="bg-zinc-900 border-zinc-800">
                  <p className="font-semibold">Settings</p>
                  <p className="text-xs text-zinc-500 mt-1">Customize your experience</p>
                </TooltipContent>
              </Tooltip>
            </SettingsModal>
          </div>
        </TooltipProvider>
      </div>
    </header>
  )
}
