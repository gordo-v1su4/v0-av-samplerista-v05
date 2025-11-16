"use client"

import type React from "react"
import { useRef, useState, useEffect } from "react"
import { Upload, Plus, X, ImageIcon, VideoIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { mediaLibrary, type MediaItem } from "@/lib/media-library"

interface VideoDisplayProps {
  currentMediaId: string | null
  isPlaying: boolean
  playbackPosition: number
  onMediaLibraryUpdate?: () => void
}

export default function VideoDisplay({
  currentMediaId,
  isPlaying,
  playbackPosition,
  onMediaLibraryUpdate,
}: VideoDisplayProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const [mediaLibraryItems, setMediaLibraryItems] = useState<MediaItem[]>([])
  const [selectedMedia, setSelectedMedia] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)

  // Load media library
  useEffect(() => {
    setMediaLibraryItems(mediaLibrary.getAllMedia())
  }, [])

  // Update video playback when currentMediaId changes
  useEffect(() => {
    if (currentMediaId && videoRef.current) {
      const media = mediaLibrary.getMedia(currentMediaId)
      if (media && media.type === "video") {
        videoRef.current.src = media.url
        if (isPlaying) {
          videoRef.current.play().catch(console.error)
        }
      }
    }
  }, [currentMediaId, isPlaying])

  // Sync video playback with audio
  useEffect(() => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.play().catch(console.error)
      } else {
        videoRef.current.pause()
      }
    }
  }, [isPlaying])

  const handleFileClick = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files) return

    for (const file of Array.from(files)) {
      const type = file.type.startsWith("video/") ? "video" : "image"
      await mediaLibrary.addMedia(file, type)
    }

    setMediaLibraryItems(mediaLibrary.getAllMedia())
    onMediaLibraryUpdate?.()
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(true)
  }

  const handleDragLeave = () => {
    setDragOver(false)
  }

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)

    const files = Array.from(e.dataTransfer.files)
    for (const file of files) {
      if (file.type.startsWith("video/") || file.type.startsWith("image/")) {
        const type = file.type.startsWith("video/") ? "video" : "image"
        await mediaLibrary.addMedia(file, type)
      }
    }

    setMediaLibraryItems(mediaLibrary.getAllMedia())
    onMediaLibraryUpdate?.()
  }

  const handleRemoveMedia = (id: string) => {
    mediaLibrary.removeMedia(id)
    setMediaLibraryItems(mediaLibrary.getAllMedia())
    onMediaLibraryUpdate?.()
  }

  const currentMedia = currentMediaId ? mediaLibrary.getMedia(currentMediaId) : null

  return (
    <div className="space-y-6">
      {/* Main preview area */}
      <div className="relative w-full aspect-video rounded-2xl overflow-hidden glass-morphism border-2 border-zinc-800/50 shadow-2xl">
        {currentMedia ? (
          <div className="relative w-full h-full">
            {currentMedia.type === "video" ? (
              <video ref={videoRef} src={currentMedia.url} className="w-full h-full object-cover" loop playsInline />
            ) : (
              <img
                src={currentMedia.url || "/placeholder.svg"}
                alt={currentMedia.name}
                className="w-full h-full object-cover"
              />
            )}

            {/* Overlay info */}
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-zinc-950 via-zinc-950/80 to-transparent p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      "p-2 rounded-lg",
                      currentMedia.type === "video" ? "bg-purple-500/20" : "bg-blue-500/20",
                    )}
                  >
                    {currentMedia.type === "video" ? (
                      <VideoIcon className="w-5 h-5 text-purple-400" />
                    ) : (
                      <ImageIcon className="w-5 h-5 text-blue-400" />
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-zinc-100">{currentMedia.name}</p>
                    <p className="text-xs text-zinc-500">
                      {currentMedia.type === "video" ? "Video Clip" : "Image"}
                      {currentMedia.sliceId !== undefined && ` • Slice ${currentMedia.sliceId + 1}`}
                    </p>
                  </div>
                </div>

                {isPlaying && (
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-red-500 rounded-full animate-premium-pulse"></div>
                    <span className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Live</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="w-20 h-20 rounded-2xl bg-zinc-800/50 flex items-center justify-center mx-auto mb-4">
                <VideoIcon className="w-10 h-10 text-zinc-600" />
              </div>
              <p className="text-zinc-500 font-semibold">No media playing</p>
              <p className="text-xs text-zinc-600 mt-2">Select a slice with media to preview</p>
            </div>
          </div>
        )}
      </div>

      {/* Media library grid */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-zinc-200">Media Library</h3>
          <Button
            onClick={handleFileClick}
            className="h-10 px-4 rounded-xl bg-gradient-to-r from-yellow-400 to-yellow-600 text-zinc-950 hover:from-yellow-300 hover:to-yellow-500 font-bold shadow-lg hover:shadow-yellow-500/25 transition-all duration-300 hover:scale-105"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Media
          </Button>
        </div>

        {/* Drag and drop area */}
        <div
          className={cn(
            "border-2 border-dashed rounded-2xl p-8 transition-all duration-300",
            dragOver ? "border-yellow-500 bg-yellow-500/10" : "border-zinc-800/50 hover:border-zinc-700/50",
          )}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={handleFileClick}
        >
          <div className="text-center cursor-pointer">
            <Upload className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
            <p className="text-sm font-semibold text-zinc-400">Drop videos or images here, or click to browse</p>
            <p className="text-xs text-zinc-600 mt-2">Supports MP4, MOV, JPG, PNG and more</p>
          </div>
        </div>

        {/* Media grid */}
        {mediaLibraryItems.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {mediaLibraryItems.map((media) => (
              <div
                key={media.id}
                className={cn(
                  "group relative rounded-xl overflow-hidden border-2 transition-all duration-300 cursor-pointer",
                  selectedMedia === media.id
                    ? "border-yellow-500 shadow-xl shadow-yellow-500/20"
                    : "border-zinc-800/50 hover:border-zinc-700",
                  currentMediaId === media.id && "ring-2 ring-cyan-500/50",
                )}
                onClick={() => setSelectedMedia(media.id)}
              >
                {/* Thumbnail */}
                <div className="aspect-video bg-zinc-900 relative overflow-hidden">
                  <img
                    src={media.thumbnail || "/placeholder.svg"}
                    alt={media.name}
                    className="w-full h-full object-cover"
                  />

                  {/* Media type badge */}
                  <div className="absolute top-2 left-2">
                    <div
                      className={cn(
                        "px-2 py-1 rounded-md text-xs font-bold",
                        media.type === "video" ? "bg-purple-500/80 text-white" : "bg-blue-500/80 text-white",
                      )}
                    >
                      {media.type === "video" ? <VideoIcon className="w-3 h-3" /> : <ImageIcon className="w-3 h-3" />}
                    </div>
                  </div>

                  {/* Slice assignment badge */}
                  {media.sliceId !== undefined && (
                    <div className="absolute top-2 right-2">
                      <div className="px-2 py-1 rounded-md text-xs font-bold bg-cyan-500/80 text-white">
                        #{media.sliceId + 1}
                      </div>
                    </div>
                  )}

                  {/* Remove button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleRemoveMedia(media.id)
                    }}
                    className="absolute top-2 right-2 w-6 h-6 rounded-full bg-zinc-900/80 hover:bg-red-500/80 text-zinc-400 hover:text-white transition-all duration-200 opacity-0 group-hover:opacity-100 flex items-center justify-center"
                  >
                    <X className="w-3 h-3" />
                  </button>

                  {/* Playing indicator */}
                  {currentMediaId === media.id && isPlaying && (
                    <div className="absolute bottom-2 right-2">
                      <div className="px-2 py-1 rounded-md bg-red-500/80 text-white text-xs font-bold flex items-center gap-1">
                        <div className="w-2 h-2 bg-white rounded-full animate-premium-pulse"></div>
                        LIVE
                      </div>
                    </div>
                  )}
                </div>

                {/* Media info */}
                <div className="p-3 glass-morphism">
                  <p className="text-xs font-semibold text-zinc-300 truncate">{media.name}</p>
                  {media.duration && <p className="text-xs text-zinc-600 mt-1">{media.duration.toFixed(1)}s</p>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="video/*,image/*"
        multiple
        className="hidden"
        onChange={handleFileChange}
      />
    </div>
  )
}
