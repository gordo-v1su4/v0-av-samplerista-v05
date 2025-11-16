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
import { Button } from "@/components/ui/button"
import { FolderOpen, Clock, Star, Trash2 } from "lucide-react"

interface OpenProjectModalProps {
  children: React.ReactNode
}

export function OpenProjectModal({ children }: OpenProjectModalProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [selectedProject, setSelectedProject] = useState<string | null>(null)

  const recentProjects = [
    { id: "1", name: "Drum Loop Project", date: "2 hours ago", favorite: true },
    { id: "2", name: "Vocal Sample", date: "Yesterday", favorite: false },
    { id: "3", name: "Video Remix", date: "3 days ago", favorite: true },
    { id: "4", name: "Beat Sequence", date: "Last week", favorite: false },
  ]

  const handleOpen = () => {
    if (!selectedProject) return

    setIsLoading(true)
    // Simulate loading
    setTimeout(() => {
      setIsLoading(false)
    }, 1000)
  }

  return (
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-[525px] bg-zinc-900 border-zinc-800 text-zinc-100">
        <DialogHeader>
          <DialogTitle className="text-zinc-100">Open Project</DialogTitle>
          <DialogDescription className="text-zinc-400">Open a previously saved project.</DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-zinc-200">Recent Projects</h3>
            <Button variant="outline" className="h-8 border-zinc-700 hover:bg-zinc-800 hover:text-yellow-300">
              <FolderOpen className="mr-2 h-4 w-4" />
              Browse Files
            </Button>
          </div>

          <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2">
            {recentProjects.map((project) => (
              <div
                key={project.id}
                className={`p-3 rounded-md border transition-colors cursor-pointer ${
                  selectedProject === project.id
                    ? "bg-yellow-500/10 border-yellow-500/50"
                    : "bg-zinc-800/50 border-zinc-700 hover:border-zinc-600"
                }`}
                onClick={() => setSelectedProject(project.id)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded bg-zinc-700 flex items-center justify-center">
                      <span className="text-xs font-medium">{project.name.substring(0, 2).toUpperCase()}</span>
                    </div>
                    <div>
                      <h4 className="text-sm font-medium text-zinc-200">{project.name}</h4>
                      <div className="flex items-center text-xs text-zinc-400 mt-1">
                        <Clock className="h-3 w-3 mr-1" />
                        <span>{project.date}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 rounded-full hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200"
                    >
                      <Star className={`h-4 w-4 ${project.favorite ? "fill-yellow-400 text-yellow-400" : ""}`} />
                      <span className="sr-only">{project.favorite ? "Unfavorite" : "Favorite"}</span>
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 rounded-full hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200"
                    >
                      <Trash2 className="h-4 w-4" />
                      <span className="sr-only">Delete</span>
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <DialogFooter>
          <Button
            onClick={handleOpen}
            disabled={isLoading || !selectedProject}
            className="bg-yellow-500 text-zinc-950 hover:bg-yellow-400"
          >
            {isLoading ? (
              <>
                <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-zinc-900 border-t-transparent"></div>
                Loading...
              </>
            ) : (
              "Open Project"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
