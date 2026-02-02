'use client'

import { useState, useCallback } from 'react'

interface VideoInfo {
  title: string
  description: string
  thumbnail: string
  duration: number
  views: number
  uploadDate: string
  author: string
  videoId: string
}

interface Format {
  itag: number
  quality: string
  qualityLabel: string
  mimeType: string
  container: string
  hasVideo: boolean
  hasAudio: boolean
  width?: number
  height?: number
  bitrate?: number
  audioBitrate?: number
}

interface SearchResult {
  videoId: string
  title: string
  thumbnail: string
  viewCount: string
  lengthText: string
  channelName: string
  url: string
}

interface DownloadState {
  progress: number
  status: 'idle' | 'fetching' | 'downloading' | 'processing' | 'completed' | 'error'
  fileName?: string
  error?: string
}

export function useYouTubeDownloader() {
  const [downloadState, setDownloadState] = useState<DownloadState>({
    progress: 0,
    status: 'idle'
  })

  const fetchVideoInfo = useCallback(async (url: string): Promise<{ videoInfo: VideoInfo; formats: Format[] }> => {
    setDownloadState({ progress: 0, status: 'fetching' })
    
    try {
      const response = await fetch('/api/video-info', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to fetch video information')
      }

      const data = await response.json()
      setDownloadState({ progress: 0, status: 'idle' })
      return data
    } catch (error) {
      setDownloadState({ 
        progress: 0, 
        status: 'error', 
        error: error instanceof Error ? error.message : 'Failed to fetch video information' 
      })
      throw error
    }
  }, [])

  const searchVideos = useCallback(async (query: string): Promise<SearchResult[]> => {
    try {
      const response = await fetch('/api/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to search videos')
      }

      const data = await response.json()
      return data.videos || []
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : 'Failed to search videos')
    }
  }, [])

  const downloadVideo = useCallback(async (url: string, format: Format, type: 'video' | 'audio' = 'video') => {
    setDownloadState({ progress: 0, status: 'downloading' })

    try {
      const response = await fetch('/api/download', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url, format: format.itag.toString(), type }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to download video')
      }

      // Get filename from headers or create one
      const contentDisposition = response.headers.get('content-disposition')
      let fileName = `video.${format.container}`
      
      if (contentDisposition) {
        const fileNameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/)
        if (fileNameMatch && fileNameMatch[1]) {
          fileName = fileNameMatch[1].replace(/['"]/g, '')
        }
      }

      // Convert response to blob
      const blob = await response.blob()
      
      // Create download link
      const downloadUrl = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = downloadUrl
      link.download = fileName
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(downloadUrl)

      setDownloadState({ 
        progress: 100, 
        status: 'completed', 
        fileName 
      })

      // Reset after 3 seconds
      setTimeout(() => {
        setDownloadState({ progress: 0, status: 'idle' })
      }, 3000)

    } catch (error) {
      setDownloadState({ 
        progress: 0, 
        status: 'error', 
        error: error instanceof Error ? error.message : 'Failed to download video' 
      })
      
      // Reset after 5 seconds
      setTimeout(() => {
        setDownloadState({ progress: 0, status: 'idle' })
      }, 5000)
    }
  }, [])

  const resetDownload = useCallback(() => {
    setDownloadState({ progress: 0, status: 'idle' })
  }, [])

  const fetchTrendingVideos = useCallback(async (): Promise<SearchResult[]> => {
    try {
      const response = await fetch('/api/trending')
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to fetch trending videos')
      }

      const data = await response.json()
      return data.videos || []
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : 'Failed to fetch trending videos')
    }
  }, [])

  return {
    downloadState,
    fetchVideoInfo,
    searchVideos,
    fetchTrendingVideos,
    downloadVideo,
    resetDownload,
  }
}

export type { VideoInfo, Format, SearchResult, DownloadState }
