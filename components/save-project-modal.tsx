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
  DialogFooter,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Save } from "lucide-react"

interface SaveProjectModalProps {
  children: React.ReactNode
}

export function SaveProjectModal({ children }: SaveProjectModalProps) {
  const [projectName, setProjectName] = useState("My Project")
  const [isSaving, setIsSaving] = useState(false)

  const handleSave = () => {
    setIsSaving(true)
    // Simulate saving
    setTimeout(() => {
      setIsSaving(false)
    }, 1000)
  }

  return (
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-[425px] bg-zinc-900 border-zinc-800 text-zinc-100">
        <DialogHeader>
          <DialogTitle className="text-zinc-100">Save Project</DialogTitle>
          <DialogDescription className="text-zinc-400">Save your current project to a file.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="project-name">Project Name</Label>
            <Input
              id="project-name"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              className="bg-zinc-800 border-zinc-700 focus-visible:ring-yellow-500"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="project-location">Save Location</Label>
            <div className="flex items-center gap-2">
              <Input
                id="project-location"
                value="/Users/username/Documents/Audio Projects"
                readOnly
                className="bg-zinc-800 border-zinc-700 focus-visible:ring-yellow-500"
              />
              <Button variant="outline" className="border-zinc-700 hover:bg-zinc-800 hover:text-yellow-300">
                Browse
              </Button>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button onClick={handleSave} disabled={isSaving} className="bg-yellow-500 text-zinc-950 hover:bg-yellow-400">
            {isSaving ? (
              <>
                <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-zinc-900 border-t-transparent"></div>
                Saving...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Save Project
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
