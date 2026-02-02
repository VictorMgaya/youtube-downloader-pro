'use client'

import { useState, useEffect } from 'react'
import { Download, AlertCircle, CheckCircle, Clock, Wifi, WifiOff, RefreshCw, File, Video, Music, Eye, EyeOff, Search, Youtube, Loader2, Play, ExternalLink } from 'lucide-react'

interface DownloadUIProps {
  videoInfo: {
    title: string
    thumbnail: string
    duration: number
    views: number
    author: string
    videoId: string
  }
  formats: Array<{
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
    url: string
  }>
  onDownloadComplete?: () => void
}

interface SearchResult {
  videoId: string
  title: string
  thumbnail: string
  author: string
  duration: number
  views: number
  publishedAt: string
}

interface SearchState {
  query: string
  results: SearchResult[]
  isLoading: boolean
  error: string | null
  selectedVideo: SearchResult | null
}

interface DownloadState {
  status: 'idle' | 'preparing' | 'downloading' | 'completed' | 'failed'
  progress: number
  currentFormat: string
  fallbackMethod: string
  error: string | null
  downloadUrl: string | null
}

export default function DownloadUI({ videoInfo, formats, onDownloadComplete }: DownloadUIProps) {
  const [activeTab, setActiveTab] = useState<'video' | 'audio'>('video')
  const [selectedFormat, setSelectedFormat] = useState<any>(null)
  const [downloadState, setDownloadState] = useState<DownloadState>({
    status: 'idle',
    progress: 0,
    currentFormat: '',
    fallbackMethod: '',
    error: null,
    downloadUrl: null
  })
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [downloadHistory, setDownloadHistory] = useState<Array<{
    format: string
    status: string
    timestamp: Date
  }>>([])

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const getFormatDisplay = (format: any) => {
    if (format.hasVideo && format.hasAudio) {
      return `${format.qualityLabel || format.quality} (${format.container})`
    } else if (format.hasVideo) {
      return `${format.qualityLabel || format.quality} Video Only (${format.container})`
    } else {
      return `${format.audioBitrate || format.bitrate}kbps Audio (${format.container})`
    }
  }

  const getFormatSizeEstimate = (format: any) => {
    // Rough estimation based on bitrate and duration
    const durationSeconds = videoInfo.duration
    const bitrate = format.bitrate || format.audioBitrate || 1000
    const sizeBytes = (bitrate * 1000 * durationSeconds) / 8
    return formatFileSize(sizeBytes)
  }

  const handleDownload = async (format: any) => {
    setSelectedFormat(format)
    setDownloadState({
      status: 'preparing',
      progress: 0,
      currentFormat: getFormatDisplay(format),
      fallbackMethod: '',
      error: null,
      downloadUrl: null
    })

    try {
      // Add to download history
      setDownloadHistory(prev => [...prev, {
        format: getFormatDisplay(format),
        status: 'Preparing...',
        timestamp: new Date()
      }])

      // Start download process
      const response = await fetch('/api/download', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: `https://www.youtube.com/watch?v=${videoInfo.videoId}`,
          format: format.itag,
          type: format.hasVideo ? 'video' : 'audio',
        }),
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      // Handle Python backend response
      const data = await response.json()
      
      if (!data.success || !data.pythonDownloadUrl) {
        throw new Error(data.error || 'Failed to get Python download URL')
      }

      // Set download state to downloading
      setDownloadState({
        status: 'downloading',
        progress: 25, // Start progress for Python download
        currentFormat: getFormatDisplay(format),
        fallbackMethod: data.method || 'Python backend download',
        error: null,
        downloadUrl: null
      })

      // Poll for download completion
      const pollDownload = async (pythonUrl: string, maxAttempts: number = 60, interval: number = 2000) => {
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
          try {
            const pollResponse = await fetch(pythonUrl)
            
            if (pollResponse.ok) {
              const pollData = await pollResponse.json()
              
              if (pollData.success && pollData.downloadUrl) {
                // Download completed - trigger file download
                setDownloadState({
                  status: 'completed',
                  progress: 100,
                  currentFormat: getFormatDisplay(format),
                  fallbackMethod: pollData.message || 'Python download completed',
                  error: null,
                  downloadUrl: pollData.downloadUrl
                })

                // Trigger download
                const link = document.createElement('a')
                link.href = pollData.downloadUrl
                link.download = pollData.filename || data.filename
                document.body.appendChild(link)
                link.click()
                document.body.removeChild(link)

                // Update history
                setDownloadHistory(prev => {
                  const updated = [...prev]
                  updated[updated.length - 1] = {
                    ...updated[updated.length - 1],
                    status: 'Completed',
                  }
                  return updated
                })

                onDownloadComplete?.()
                return true
              } else if (pollData.error) {
                // Enhanced error handling with Python output
                const errorMessage = pollData.message || pollData.error
                const pythonOutput = pollData.pythonOutput || ''
                const pythonError = pollData.pythonError || ''
                
                console.error('Python download error details:', {
                  message: errorMessage,
                  pythonOutput: pythonOutput,
                  pythonError: pythonError
                })
                
                throw new Error(`${errorMessage}${pythonError ? ` - Python Error: ${pythonError}` : ''}`)
              }
            }
            
            // Update progress
            const progress = Math.min(25 + (attempt * 75 / maxAttempts), 95)
            setDownloadState(prev => ({
              ...prev,
              progress: progress
            }))

            // Wait before next poll
            await new Promise(resolve => setTimeout(resolve, interval))
            
          } catch (pollError) {
            console.error('Poll error:', pollError)
            if (attempt === maxAttempts - 1) {
              throw pollError
            }
          }
        }
        
        throw new Error('Download timeout - Python process took too long')
      }

      // Start polling for download completion
      try {
        await pollDownload(data.pythonDownloadUrl)
      } catch (pollError) {
        throw new Error(`Download failed: ${pollError instanceof Error ? pollError.message : 'Unknown error'}`)
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Download failed'
      setDownloadState({
        status: 'failed',
        progress: 0,
        currentFormat: getFormatDisplay(format),
        fallbackMethod: '',
        error: errorMessage,
        downloadUrl: null
      })

      // Update history with error
      setDownloadHistory(prev => {
        const updated = [...prev]
        updated[updated.length - 1] = {
          ...updated[updated.length - 1],
          status: 'Failed',
        }
        return updated
      })
    }
  }

  const getStatusIcon = () => {
    switch (downloadState.status) {
      case 'preparing':
        return <Clock className="w-6 h-6 text-blue-500 animate-pulse" />
      case 'downloading':
        return <Wifi className="w-6 h-6 text-green-500 animate-pulse" />
      case 'completed':
        return <CheckCircle className="w-6 h-6 text-green-500" />
      case 'failed':
        return <AlertCircle className="w-6 h-6 text-red-500" />
      default:
        return <Download className="w-6 h-6 text-gray-400" />
    }
  }

  const getStatusText = () => {
    switch (downloadState.status) {
      case 'preparing':
        return 'Preparing download...'
      case 'downloading':
        return 'Downloading...'
      case 'completed':
        return 'Download completed!'
      case 'failed':
        return 'Download failed'
      default:
        return 'Ready to download'
    }
  }

  const getFilteredFormats = () => {
    return formats
      .filter(format => activeTab === 'video' ? format.hasVideo : !format.hasVideo)
      .sort((a, b) => {
        if (activeTab === 'video') {
          // Sort by resolution (height) for video
          return (b.height || 0) - (a.height || 0)
        } else {
          // Sort by audio bitrate for audio
          return (b.audioBitrate || b.bitrate || 0) - (a.audioBitrate || a.bitrate || 0)
        }
      })
  }

  return (
    <div className="space-y-6">
      {/* Download Progress Section - Sticky when active */}
      {downloadState.status !== 'idle' && (
        <div className="sticky top-0 z-50 bg-white rounded-lg shadow-lg p-6 border-l-4 border-blue-500">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              {getStatusIcon()}
              <div>
                <h3 className="text-lg font-semibold text-gray-900">{getStatusText()}</h3>
                {downloadState.currentFormat && (
                  <p className="text-sm text-gray-600">{downloadState.currentFormat}</p>
                )}
              </div>
            </div>
            {downloadState.status === 'failed' && (
              <button
                onClick={() => setDownloadState({ ...downloadState, status: 'idle', error: null })}
                className="text-red-500 hover:text-red-700"
              >
                <RefreshCw className="w-5 h-5" />
              </button>
            )}
          </div>
          
          {downloadState.status === 'preparing' && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm text-gray-600">
                <span>Initializing download...</span>
                <span>0%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div className="bg-blue-500 h-2 rounded-full animate-pulse" style={{ width: '25%' }}></div>
              </div>
              <div className="text-xs text-gray-500 mt-2">
                Setting up download process, extracting format information...
              </div>
            </div>
          )}

          {downloadState.status === 'downloading' && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm text-gray-600">
                <span>Downloading {downloadState.currentFormat}...</span>
                <span>{downloadState.progress}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div className="bg-green-500 h-2 rounded-full" style={{ width: `${downloadState.progress}%` }}></div>
              </div>
              <div className="flex justify-between text-xs text-gray-500 mt-2">
                <span>Method: {downloadState.fallbackMethod || 'Python backend download'}</span>
                <span>Estimated time: 30-60 seconds</span>
              </div>
            </div>
          )}

          {downloadState.status === 'completed' && downloadState.fallbackMethod && (
            <div className="flex items-center space-x-2 text-sm text-gray-600">
              <span>Method:</span>
              <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-xs">{downloadState.fallbackMethod}</span>
              <span className="text-green-600 font-medium">✓ Download successful</span>
            </div>
          )}

          {downloadState.error && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-center space-x-2 text-red-700">
                <AlertCircle className="w-4 h-4" />
                <span className="text-sm font-medium">Error:</span>
              </div>
              <p className="text-sm text-red-600 mt-1">{downloadState.error}</p>
              <div className="mt-2 text-xs text-red-500">
                Common issues: Network connectivity, YouTube restrictions, or format unavailability.
                Try selecting a different quality or check your internet connection.
              </div>
            </div>
          )}
        </div>
      )}

      {/* Format Selection Tabs */}
      <div className="bg-white rounded-lg shadow-lg p-6">
        <div className="flex border-b border-gray-200 mb-6">
          <button
            onClick={() => setActiveTab('video')}
            className={`px-6 py-3 font-semibold transition-colors flex items-center space-x-2 ${
              activeTab === 'video'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Video className="h-5 w-5" />
            <span>Video Formats</span>
          </button>
          <button
            onClick={() => setActiveTab('audio')}
            className={`px-6 py-3 font-semibold transition-colors flex items-center space-x-2 ${
              activeTab === 'audio'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Music className="h-5 w-5" />
            <span>Audio Formats</span>
          </button>
        </div>

        {/* Format Selection Grid */}
        <div className="grid gap-4 max-h-96 overflow-y-auto">
          {getFilteredFormats().map((format) => (
            <div 
              key={format.itag} 
              className={`border rounded-lg p-4 transition-all hover:shadow-lg cursor-pointer ${
                selectedFormat?.itag === format.itag 
                  ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200' 
                  : 'border-gray-200 hover:border-gray-300'
              }`}
              onClick={() => setSelectedFormat(format)}
            >
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="flex-1">
                  {/* Format Badges */}
                  <div className="flex items-center flex-wrap gap-2 mb-3">
                    {format.hasVideo && (
                      <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                        selectedFormat?.itag === format.itag 
                          ? 'bg-blue-200 text-blue-800' 
                          : 'bg-blue-100 text-blue-800'
                      }`}>
                        {format.qualityLabel || format.quality}
                      </span>
                    )}
                    <span className={`px-2 py-1 rounded text-sm ${
                      selectedFormat?.itag === format.itag 
                        ? 'bg-gray-300 text-gray-800' 
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {format.container || format.mimeType?.split('/')[1]}
                    </span>
                    {format.hasAudio && (
                      <span className={`px-3 py-1 rounded-full text-sm ${
                        selectedFormat?.itag === format.itag 
                          ? 'bg-yellow-200 text-yellow-800' 
                          : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        Audio: {format.audioBitrate || format.bitrate}kbps
                      </span>
                    )}
                    {format.hasVideo && format.width && format.height && (
                      <span className={`px-3 py-1 rounded-full text-sm ${
                        selectedFormat?.itag === format.itag 
                          ? 'bg-green-200 text-green-800' 
                          : 'bg-green-100 text-green-800'
                      }`}>
                        {format.width}×{format.height}
                      </span>
                    )}
                  </div>

                  {/* Format Description */}
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold text-gray-900">
                      {getFormatDisplay(format)}
                    </h4>
                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      <span className="bg-gray-100 px-2 py-1 rounded">
                        Est. Size: {getFormatSizeEstimate(format)}
                      </span>
                      <span className="bg-gray-100 px-2 py-1 rounded">
                        ITAG: {format.itag}
                      </span>
                    </div>
                  </div>

                  {/* Format Details */}
                  <div className="mt-2 flex items-center gap-4 text-xs text-gray-600">
                    {format.bitrate && (
                      <span>Video Bitrate: {format.bitrate}kbps</span>
                    )}
                    {format.hasVideo && format.hasAudio && (
                      <span className="text-green-600 font-medium">✅ Video + Audio</span>
                    )}
                    {format.hasVideo && !format.hasAudio && (
                      <span className="text-blue-600 font-medium">📹 Video Only</span>
                    )}
                    {!format.hasVideo && format.hasAudio && (
                      <span className="text-yellow-600 font-medium">🎵 Audio Only</span>
                    )}
                  </div>
                </div>

                {/* Download Button */}
                <div className="flex items-center gap-3">
                  <button
                    onClick={(e) => {
                      e.stopPropagation() // Prevent card selection when clicking download
                      handleDownload(format)
                    }}
                    disabled={downloadState.status === 'preparing' || downloadState.status === 'downloading'}
                    className={`px-6 py-3 rounded-lg font-semibold transition-colors flex items-center space-x-2 ${
                      selectedFormat?.itag === format.itag
                        ? 'bg-blue-600 text-white hover:bg-blue-700'
                        : 'bg-green-600 text-white hover:bg-green-700'
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    <Download className="h-4 w-4" />
                    <span>{selectedFormat?.itag === format.itag ? 'Download Selected' : 'Download'}</span>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Selected Format Summary */}
        {selectedFormat && (
          <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                <div>
                  <h4 className="font-semibold text-blue-900">Selected Format</h4>
                  <p className="text-sm text-blue-700">{getFormatDisplay(selectedFormat)}</p>
                </div>
              </div>
              <div className="flex items-center gap-4 text-sm text-blue-700">
                <span>Quality: {selectedFormat.qualityLabel || selectedFormat.quality}</span>
                <span>•</span>
                <span>Container: {selectedFormat.container}</span>
                <span>•</span>
                <span>Size: {getFormatSizeEstimate(selectedFormat)}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Advanced Options */}
      <div className="bg-white rounded-lg shadow-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Advanced Options</h3>
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="text-blue-600 hover:text-blue-700 flex items-center space-x-2"
          >
            {showAdvanced ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
            <span>{showAdvanced ? 'Hide' : 'Show'} Advanced</span>
          </button>
        </div>

        {showAdvanced && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="font-semibold text-gray-900 mb-2">Download History</h4>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {downloadHistory.map((item, index) => (
                    <div key={index} className="flex justify-between text-sm">
                      <span className="text-gray-600">{item.format}</span>
                      <span className={`px-2 py-1 rounded text-xs ${
                        item.status === 'Completed' ? 'bg-green-100 text-green-800' :
                        item.status === 'Failed' ? 'bg-red-100 text-red-800' :
                        'bg-blue-100 text-blue-800'
                      }`}>
                        {item.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              
              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="font-semibold text-gray-900 mb-2">System Status</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Connection:</span>
                    <span className="text-green-600">Online</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Cache:</span>
                    <span className="text-blue-600">Active</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Fallbacks:</span>
                    <span className="text-purple-600">Enabled</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}