/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  webpack: (config, { isServer }) => {
    // Handle WASM files
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
    }

    // Fix for essentia.js WASM files and Wavesurfer.js
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        crypto: false,
      }

      // Fix for Wavesurfer.js - prevent code splitting issues
      // Mark Wavesurfer.js as a single chunk
      config.optimization = {
        ...config.optimization,
        splitChunks: {
          ...config.optimization.splitChunks,
          cacheGroups: {
            ...config.optimization.splitChunks?.cacheGroups,
            wavesurfer: {
              test: /[\\/]node_modules[\\/]wavesurfer\.js[\\/]/,
              name: "wavesurfer",
              priority: 30,
              enforce: true,
              chunks: "all",
            },
          },
        },
      }
    }

    // Ensure Wavesurfer.js is treated as a client-side module
    config.resolve.alias = {
      ...config.resolve.alias,
    }

    return config
  },
}

export default nextConfig
