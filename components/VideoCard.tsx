'use client'

import { useState } from 'react'
import { Download, Play, Clock, Eye, Music } from 'lucide-react'

interface Video {
  videoId: string
  title: string
  thumbnail: string
  viewCount: string
  lengthText: string
  channelName: string
  url: string
}

interface VideoCardProps {
  video: Video
  onSelect: (video: Video) => void
  isLoading?: boolean
}

export default function VideoCard({ video, onSelect, isLoading = false }: VideoCardProps) {
  const [imageError, setImageError] = useState(false)

  const formatViews = (views: string) => {
    const num = parseInt(views.replace(/[^0-9]/g, ''))
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`
    return views
  }

  return (
    <div className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow duration-200 overflow-hidden group">
      <div className="relative aspect-video bg-gray-100">
        {!imageError && video.thumbnail ? (
          <img
            src={video.thumbnail}
            alt={video.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
            onError={() => setImageError(true)}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gray-200">
            <Play className="w-12 h-12 text-gray-400" />
          </div>
        )}
        
        <div className="absolute bottom-2 right-2 bg-black bg-opacity-75 text-white text-xs px-2 py-1 rounded flex items-center gap-1">
          <Clock className="w-3 h-3" />
          {video.lengthText}
        </div>
        
        <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-all duration-200 flex items-center justify-center">
          <button
            onClick={() => onSelect(video)}
            disabled={isLoading}
            className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-red-600 hover:bg-red-700 text-white p-3 rounded-full transform scale-90 group-hover:scale-100 transition-transform"
          >
            {isLoading ? (
              <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Download className="w-6 h-6" />
            )}
          </button>
        </div>
      </div>
      
      <div className="p-4">
        <h3 className="font-semibold text-gray-900 line-clamp-2 mb-2 text-sm leading-tight">
          {video.title}
        </h3>
        
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span className="truncate flex-1">{video.channelName}</span>
          <div className="flex items-center gap-1 ml-2 flex-shrink-0">
            <Eye className="w-3 h-3" />
            <span>{formatViews(video.viewCount)}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
