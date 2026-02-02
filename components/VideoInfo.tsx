'use client'

import { useState } from 'react'
import { Download, Eye, Clock, Calendar, User, ExternalLink } from 'lucide-react'

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

interface VideoInfoProps {
  videoInfo: VideoInfo
  onDownload: () => void
  isLoading?: boolean
}

export default function VideoInfo({ videoInfo, onDownload, isLoading = false }: VideoInfoProps) {
  const [showFullDescription, setShowFullDescription] = useState(false)
  const [imageError, setImageError] = useState(false)

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`
  }

  const formatViews = (views: number) => {
    if (views >= 1000000) return `${(views / 1000000).toFixed(1)}M views`
    if (views >= 1000) return `${(views / 1000).toFixed(1)}K views`
    return `${views} views`
  }

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString)
      return date.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      })
    } catch {
      return dateString
    }
  }

  const truncateDescription = (description: string, maxLength: number = 200) => {
    if (description.length <= maxLength) return description
    return description.substring(0, maxLength) + '...'
  }

  return (
    <div className="bg-white rounded-lg shadow-lg overflow-hidden">
      <div className="relative aspect-video bg-gray-100">
        {!imageError && videoInfo.thumbnail ? (
          <img
            src={videoInfo.thumbnail}
            alt={videoInfo.title}
            className="w-full h-full object-cover"
            onError={() => setImageError(true)}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gray-200">
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-2 bg-gray-300 rounded-lg flex items-center justify-center">
                <ExternalLink className="w-8 h-8 text-gray-500" />
              </div>
              <p className="text-gray-500 text-sm">Thumbnail not available</p>
            </div>
          </div>
        )}
        
        <div className="absolute bottom-4 left-4 right-4">
          <div className="bg-black bg-opacity-75 backdrop-blur-sm rounded-lg p-3 text-white">
            <h2 className="text-lg font-semibold line-clamp-2 mb-1">
              {videoInfo.title}
            </h2>
            <div className="flex items-center gap-4 text-sm opacity-90">
              <div className="flex items-center gap-1">
                <Clock className="w-4 h-4" />
                {formatDuration(videoInfo.duration)}
              </div>
              <div className="flex items-center gap-1">
                <Eye className="w-4 h-4" />
                {formatViews(videoInfo.views)}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center">
              <User className="w-6 h-6 text-gray-500" />
            </div>
            <div>
              <p className="font-semibold text-gray-900">{videoInfo.author}</p>
              <div className="flex items-center gap-1 text-sm text-gray-500">
                <Calendar className="w-3 h-3" />
                {formatDate(videoInfo.uploadDate)}
              </div>
            </div>
          </div>
          
          <button
            onClick={onDownload}
            disabled={isLoading}
            className="bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white px-6 py-3 rounded-lg font-medium transition-colors flex items-center gap-2 shadow-lg hover:shadow-xl"
          >
            {isLoading ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Download className="w-5 h-5" />
                Download Now
              </>
            )}
          </button>
        </div>

        {videoInfo.description && (
          <div className="border-t pt-4">
            <h3 className="font-semibold text-gray-900 mb-2">Description</h3>
            <div className="text-sm text-gray-600 leading-relaxed">
              {showFullDescription ? (
                <div className="whitespace-pre-wrap">{videoInfo.description}</div>
              ) : (
                <div className="whitespace-pre-wrap">{truncateDescription(videoInfo.description)}</div>
              )}
              
              {videoInfo.description.length > 200 && (
                <button
                  onClick={() => setShowFullDescription(!showFullDescription)}
                  className="text-red-600 hover:text-red-700 font-medium text-sm mt-2"
                >
                  {showFullDescription ? 'Show less' : 'Show more'}
                </button>
              )}
            </div>
          </div>
        )}

        <div className="border-t pt-4">
          <div className="flex items-center justify-between text-sm text-gray-500">
            <span>Video ID: {videoInfo.videoId}</span>
            <a
              href={`https://www.youtube.com/watch?v=${videoInfo.videoId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-red-600 hover:text-red-700 font-medium flex items-center gap-1"
            >
              <ExternalLink className="w-3 h-3" />
              Watch on YouTube
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
