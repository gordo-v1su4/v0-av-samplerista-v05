/**
 * Media Library - Manages video clips and images for slices
 */

export interface MediaItem {
  id: string
  type: "video" | "image"
  file: File
  url: string
  thumbnail: string
  duration?: number
  sliceId?: number
  name: string
}

class MediaLibrary {
  private items: Map<string, MediaItem> = new Map()
  private sliceMediaMap: Map<number, string> = new Map()

  // Add a media item
  async addMedia(file: File, type: "video" | "image"): Promise<MediaItem> {
    const id = `media-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    const url = URL.createObjectURL(file)

    // Generate thumbnail
    const thumbnail = await this.generateThumbnail(file, type)

    let duration: number | undefined
    if (type === "video") {
      duration = await this.getVideoDuration(url)
    }

    const mediaItem: MediaItem = {
      id,
      type,
      file,
      url,
      thumbnail,
      duration,
      name: file.name,
    }

    this.items.set(id, mediaItem)
    return mediaItem
  }

  // Generate thumbnail for media
  private async generateThumbnail(file: File, type: "video" | "image"): Promise<string> {
    return new Promise((resolve) => {
      const url = URL.createObjectURL(file)

      if (type === "image") {
        // For images, use the image itself as thumbnail
        resolve(url)
      } else {
        // For videos, capture first frame
        const video = document.createElement("video")
        video.src = url
        video.crossOrigin = "anonymous"

        video.addEventListener("loadeddata", () => {
          video.currentTime = 0.1 // Seek to 100ms
        })

        video.addEventListener("seeked", () => {
          const canvas = document.createElement("canvas")
          canvas.width = 320
          canvas.height = 180
          const ctx = canvas.getContext("2d")

          if (ctx) {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
            const thumbnailUrl = canvas.toDataURL("image/jpeg", 0.7)
            resolve(thumbnailUrl)
          } else {
            resolve(url)
          }

          video.remove()
        })

        video.load()
      }
    })
  }

  // Get video duration
  private async getVideoDuration(url: string): Promise<number> {
    return new Promise((resolve) => {
      const video = document.createElement("video")
      video.src = url
      video.addEventListener("loadedmetadata", () => {
        resolve(video.duration)
        video.remove()
      })
      video.load()
    })
  }

  // Assign media to a slice
  assignToSlice(mediaId: string, sliceId: number): void {
    const media = this.items.get(mediaId)
    if (media) {
      media.sliceId = sliceId
      this.sliceMediaMap.set(sliceId, mediaId)
    }
  }

  // Get media for a slice
  getMediaForSlice(sliceId: number): MediaItem | undefined {
    const mediaId = this.sliceMediaMap.get(sliceId)
    return mediaId ? this.items.get(mediaId) : undefined
  }

  // Get all media items
  getAllMedia(): MediaItem[] {
    return Array.from(this.items.values())
  }

  // Get media by ID
  getMedia(id: string): MediaItem | undefined {
    return this.items.get(id)
  }

  // Remove media
  removeMedia(id: string): void {
    const media = this.items.get(id)
    if (media) {
      URL.revokeObjectURL(media.url)
      if (media.sliceId !== undefined) {
        this.sliceMediaMap.delete(media.sliceId)
      }
      this.items.delete(id)
    }
  }

  // Clear all media
  clear(): void {
    this.items.forEach((media) => {
      URL.revokeObjectURL(media.url)
    })
    this.items.clear()
    this.sliceMediaMap.clear()
  }
}

// Create singleton instance
export const mediaLibrary = new MediaLibrary()
