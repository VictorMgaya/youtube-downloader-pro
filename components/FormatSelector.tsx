'use client'

import { useState } from 'react'
import { Check, Download, Music, Video, FileVideo } from 'lucide-react'

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

interface FormatSelectorProps {
  formats: Format[]
  onFormatSelect: (format: Format) => void
  selectedFormat: Format | null
  isLoading?: boolean
}

export default function FormatSelector({ 
  formats, 
  onFormatSelect, 
  selectedFormat, 
  isLoading = false 
}: FormatSelectorProps) {
  const [filterType, setFilterType] = useState<'all' | 'video' | 'audio'>('all')

  const filteredFormats = formats.filter(format => {
    if (filterType === 'video') return format.hasVideo
    if (filterType === 'audio') return !format.hasVideo && format.hasAudio
    return true
  })

  const getFormatIcon = (format: Format) => {
    if (format.hasVideo) {
      if (format.height && format.height >= 720) {
        return <FileVideo className="w-4 h-4 text-green-600" />
      }
      return <Video className="w-4 h-4 text-blue-600" />
    }
    return <Music className="w-4 h-4 text-purple-600" />
  }

  const getFormatLabel = (format: Format) => {
    if (format.hasVideo) {
      return `${format.qualityLabel || format.quality} (${format.container?.toUpperCase()})`
    }
    return `Audio ${format.audioBitrate ? `${format.audioBitrate}kbps` : ''} (${format.container?.toUpperCase()})`
  }

  const getQualityColor = (format: Format) => {
    if (!format.hasVideo) return 'border-purple-200 hover:border-purple-400'
    if (!format.height) return 'border-gray-200 hover:border-gray-400'
    
    if (format.height >= 1080) return 'border-green-200 hover:border-green-400'
    if (format.height >= 720) return 'border-blue-200 hover:border-blue-400'
    return 'border-gray-200 hover:border-gray-400'
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Choose Format</h3>
        <div className="flex gap-2">
          <button
            onClick={() => setFilterType('all')}
            className={`px-3 py-1 text-sm rounded-lg transition-colors ${
              filterType === 'all' 
                ? 'bg-red-600 text-white' 
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setFilterType('video')}
            className={`px-3 py-1 text-sm rounded-lg transition-colors ${
              filterType === 'video' 
                ? 'bg-red-600 text-white' 
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Video
          </button>
          <button
            onClick={() => setFilterType('audio')}
            className={`px-3 py-1 text-sm rounded-lg transition-colors ${
              filterType === 'audio' 
                ? 'bg-red-600 text-white' 
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Audio
          </button>
        </div>
      </div>

      <div className="max-h-64 overflow-y-auto space-y-2 pr-2">
        {filteredFormats.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No formats available for the selected filter
          </div>
        ) : (
          filteredFormats.map((format) => (
            <div
              key={format.itag}
              onClick={() => !isLoading && onFormatSelect(format)}
              className={`border rounded-lg p-3 cursor-pointer transition-all duration-200 flex items-center justify-between ${
                selectedFormat?.itag === format.itag
                  ? 'border-red-500 bg-red-50'
                  : getQualityColor(format)
              } ${isLoading ? 'opacity-50 cursor-not-allowed' : 'hover:shadow-md'}`}
            >
              <div className="flex items-center gap-3">
                {getFormatIcon(format)}
                <div>
                  <div className="font-medium text-gray-900 text-sm">
                    {getFormatLabel(format)}
                  </div>
                  {format.hasVideo && format.width && format.height && (
                    <div className="text-xs text-gray-500">
                      {format.width}×{format.height}
                      {format.bitrate && ` • ${Math.round(format.bitrate / 1000)}kbps`}
                    </div>
                  )}
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                {selectedFormat?.itag === format.itag && (
                  <Check className="w-5 h-5 text-red-600" />
                )}
                {selectedFormat?.itag === format.itag && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      // Download will be handled by parent
                    }}
                    disabled={isLoading}
                    className="bg-red-600 hover:bg-red-700 text-white p-2 rounded-lg transition-colors"
                  >
                    {isLoading ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Download className="w-4 h-4" />
                    )}
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
