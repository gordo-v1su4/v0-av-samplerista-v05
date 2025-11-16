"use client"

import dynamic from "next/dynamic"

const AudioSampler = dynamic(() => import("@/components/audio-sampler"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900 mx-auto mb-4"></div>
        <p className="text-lg">Loading Samplerista...</p>
      </div>
    </div>
  ),
})

export default function AudioSamplerClient() {
  return <AudioSampler />
}
