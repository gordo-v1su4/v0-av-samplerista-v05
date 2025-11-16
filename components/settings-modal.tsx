"use client"

import type React from "react"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"

interface SettingsModalProps {
  children: React.ReactNode
}

export function SettingsModal({ children }: SettingsModalProps) {
  const [audioDevice, setAudioDevice] = useState("default")
  const [sampleRate, setSampleRate] = useState("44100")
  const [bufferSize, setBufferSize] = useState("1024")
  const [midiInput, setMidiInput] = useState("all")
  const [midiOutput, setMidiOutput] = useState("none")
  const [autoSave, setAutoSave] = useState(true)
  const [autoLoadLastProject, setAutoLoadLastProject] = useState(false)
  const [showPerformanceMetrics, setShowPerformanceMetrics] = useState(true)

  return (
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-[500px] bg-zinc-900 border-zinc-800 text-zinc-100">
        <DialogHeader>
          <DialogTitle className="text-zinc-100">Settings</DialogTitle>
          <DialogDescription className="text-zinc-400">
            Configure your audio/video sampler preferences.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="audio" className="mt-4">
          <TabsList className="bg-zinc-800 border border-zinc-700">
            <TabsTrigger value="audio" className="data-[state=active]:bg-yellow-500 data-[state=active]:text-zinc-950">
              Audio
            </TabsTrigger>
            <TabsTrigger value="midi" className="data-[state=active]:bg-yellow-500 data-[state=active]:text-zinc-950">
              MIDI
            </TabsTrigger>
            <TabsTrigger
              value="general"
              className="data-[state=active]:bg-yellow-500 data-[state=active]:text-zinc-950"
            >
              General
            </TabsTrigger>
          </TabsList>

          <TabsContent value="audio" className="p-4 border border-zinc-800 rounded-md mt-2 bg-zinc-900/50">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="audio-device">Audio Output Device</Label>
                <Select value={audioDevice} onValueChange={setAudioDevice}>
                  <SelectTrigger id="audio-device" className="bg-zinc-800 border-zinc-700 focus:ring-yellow-500">
                    <SelectValue placeholder="Select audio device" />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-800 border-zinc-700">
                    <SelectItem value="default">System Default</SelectItem>
                    <SelectItem value="speakers">Speakers</SelectItem>
                    <SelectItem value="headphones">Headphones</SelectItem>
                    <SelectItem value="interface">Audio Interface</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="sample-rate">Sample Rate</Label>
                <Select value={sampleRate} onValueChange={setSampleRate}>
                  <SelectTrigger id="sample-rate" className="bg-zinc-800 border-zinc-700 focus:ring-yellow-500">
                    <SelectValue placeholder="Select sample rate" />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-800 border-zinc-700">
                    <SelectItem value="44100">44.1 kHz</SelectItem>
                    <SelectItem value="48000">48 kHz</SelectItem>
                    <SelectItem value="88200">88.2 kHz</SelectItem>
                    <SelectItem value="96000">96 kHz</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="buffer-size">Buffer Size</Label>
                <Select value={bufferSize} onValueChange={setBufferSize}>
                  <SelectTrigger id="buffer-size" className="bg-zinc-800 border-zinc-700 focus:ring-yellow-500">
                    <SelectValue placeholder="Select buffer size" />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-800 border-zinc-700">
                    <SelectItem value="256">256 (Low Latency)</SelectItem>
                    <SelectItem value="512">512</SelectItem>
                    <SelectItem value="1024">1024 (Balanced)</SelectItem>
                    <SelectItem value="2048">2048 (High Stability)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="midi" className="p-4 border border-zinc-800 rounded-md mt-2 bg-zinc-900/50">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="midi-input">MIDI Input Device</Label>
                <Select value={midiInput} onValueChange={setMidiInput}>
                  <SelectTrigger id="midi-input" className="bg-zinc-800 border-zinc-700 focus:ring-yellow-500">
                    <SelectValue placeholder="Select MIDI input" />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-800 border-zinc-700">
                    <SelectItem value="all">All MIDI Inputs</SelectItem>
                    <SelectItem value="none">None</SelectItem>
                    <SelectItem value="keyboard">MIDI Keyboard</SelectItem>
                    <SelectItem value="controller">MIDI Controller</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="midi-output">MIDI Output Device</Label>
                <Select value={midiOutput} onValueChange={setMidiOutput}>
                  <SelectTrigger id="midi-output" className="bg-zinc-800 border-zinc-700 focus:ring-yellow-500">
                    <SelectValue placeholder="Select MIDI output" />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-800 border-zinc-700">
                    <SelectItem value="none">None</SelectItem>
                    <SelectItem value="synth">Hardware Synth</SelectItem>
                    <SelectItem value="daw">DAW</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="midi-channel">MIDI Channel</Label>
                <Select defaultValue="1">
                  <SelectTrigger id="midi-channel" className="bg-zinc-800 border-zinc-700 focus:ring-yellow-500">
                    <SelectValue placeholder="Select MIDI channel" />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-800 border-zinc-700">
                    <SelectItem value="all">All Channels</SelectItem>
                    {Array.from({ length: 16 }, (_, i) => (
                      <SelectItem key={i} value={(i + 1).toString()}>
                        Channel {i + 1}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="general" className="p-4 border border-zinc-800 rounded-md mt-2 bg-zinc-900/50">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="auto-save" className="cursor-pointer">
                  Auto-Save Projects
                </Label>
                <Switch
                  id="auto-save"
                  checked={autoSave}
                  onCheckedChange={setAutoSave}
                  className="data-[state=checked]:bg-yellow-500"
                />
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="auto-load" className="cursor-pointer">
                  Auto-Load Last Project
                </Label>
                <Switch
                  id="auto-load"
                  checked={autoLoadLastProject}
                  onCheckedChange={setAutoLoadLastProject}
                  className="data-[state=checked]:bg-yellow-500"
                />
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="performance-metrics" className="cursor-pointer">
                  Show Performance Metrics
                </Label>
                <Switch
                  id="performance-metrics"
                  checked={showPerformanceMetrics}
                  onCheckedChange={setShowPerformanceMetrics}
                  className="data-[state=checked]:bg-yellow-500"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="projects-folder">Projects Folder</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="projects-folder"
                    value="/Users/username/Documents/Audio Projects"
                    readOnly
                    className="bg-zinc-800 border-zinc-700 focus-visible:ring-yellow-500"
                  />
                  <Button variant="outline" className="border-zinc-700 hover:bg-zinc-800 hover:text-yellow-300">
                    Browse
                  </Button>
                </div>
              </div>

              <div className="pt-4 flex justify-end">
                <Button className="bg-yellow-500 text-zinc-950 hover:bg-yellow-400">Reset to Defaults</Button>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
