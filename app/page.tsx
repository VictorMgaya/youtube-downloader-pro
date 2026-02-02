'use client'

import { useState, useRef } from 'react'
import Link from 'next/link'
import { Search, Download, Youtube, Video, Music, Loader2, AlertCircle, Globe, Play } from 'lucide-react'
import DownloadUI from '../components/DownloadUI'

export default function Home() {
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [videoInfo, setVideoInfo] = useState<any>(null)
  const [formats, setFormats] = useState<any[]>([])
  const [isExploring, setIsExploring] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const validateUrl = (url: string) => {
    try {
      const urlObj = new URL(url)
      return urlObj.hostname.includes('youtube.com') || urlObj.hostname.includes('youtu.be')
    } catch {
      return false
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsExploring(false)
    
    const trimmedUrl = url.trim()
    
    // Handle empty submission - start exploration
    if (!trimmedUrl) {
      setIsExploring(true)
      return
    }

    // Handle non-YouTube links - start exploration with search query
    if (!validateUrl(trimmedUrl)) {
      setIsExploring(true)
      return
    }

    // Handle valid YouTube URL - proceed with downloading
    setLoading(true)
    
    try {
      const response = await fetch('/api/video-info', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url: trimmedUrl }),
      })

      if (!response.ok) {
        throw new Error('Failed to fetch video information')
      }

      const data = await response.json()
      setVideoInfo(data.videoInfo)
      setFormats(data.formats)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const formData = new FormData()
    formData.append('file', file)

    try {
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        throw new Error('Failed to upload file')
      }

      const data = await response.json()
      setVideoInfo(data.videoInfo)
      setFormats(data.formats)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      {/* Navigation */}
      <nav className="bg-white/80 backdrop-blur-md border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <Youtube className="h-8 w-8 text-red-600" />
              <h1 className="text-2xl font-bold text-gray-900">YouTube Downloader Pro</h1>
            </div>
            <div className="hidden md:flex space-x-4">
              <Link href="#" className="text-gray-600 hover:text-gray-900">Home</Link>
              <Link href="#" className="text-gray-600 hover:text-gray-900">About</Link>
              <Link href="#" className="text-gray-600 hover:text-gray-900">Help</Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center mb-12">
          <h2 className="text-4xl md:text-6xl font-bold text-gray-900 mb-4">
            Download YouTube Videos & Audio
          </h2>
          <p className="text-xl text-gray-600 mb-8">
            Get your favorite content in any format and quality you want
          </p>
        </div>

        {/* Main Form */}
        <div className="max-w-4xl mx-auto bg-white rounded-2xl shadow-xl p-8 mb-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="Paste YouTube URL here (e.g., https://www.youtube.com/watch?v=dQw4w9WgXcQ)"
                className="block w-full pl-10 text-black pr-3 py-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg"
                disabled={loading}
              />
            </div>
            
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded flex items-center space-x-2">
                <AlertCircle className="h-5 w-5" />
                <span>{error}</span>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-4">
              <button
                type="submit"
                disabled={loading}
                className="flex-1 bg-blue-600 text-white py-4 px-6 rounded-lg font-semibold hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2 transition-colors"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span>Processing...</span>
                  </>
                ) : (
                  <>
                    <Search className="h-5 w-5" />
                    <span>Get Video Info</span>
                  </>
                )}
              </button>
              
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center justify-center space-x-2 bg-gray-100 text-gray-700 py-4 px-6 rounded-lg font-semibold hover:bg-gray-200 transition-colors"
              >
                <Video className="h-5 w-5" />
                <span>Upload File</span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="video/*"
                onChange={handleFileUpload}
                className="hidden"
              />
            </div>
          </form>
        </div>

        {/* Video Information */}
        {videoInfo && (
          <div className="max-w-4xl mx-auto bg-white rounded-2xl shadow-xl p-8 mb-8">
            <div className="flex flex-col md:flex-row gap-6">
              <img
                src={videoInfo.thumbnail}
                alt={videoInfo.title}
                className="w-full md:w-64 h-40 md:h-48 object-cover rounded-lg"
              />
              <div className="flex-1">
                <h3 className="text-2xl font-bold text-gray-900 mb-2">{videoInfo.title}</h3>
                <p className="text-gray-600 mb-4">{videoInfo.description?.substring(0, 200)}...</p>
                <div className="flex flex-wrap gap-2 mb-4">
                  <span className="bg-blue-100 text-blue-800 text-sm px-3 py-1 rounded-full">
                    {videoInfo.duration}
                  </span>
                  <span className="bg-green-100 text-green-800 text-sm px-3 py-1 rounded-full">
                    {videoInfo.views} views
                  </span>
                  <span className="bg-purple-100 text-purple-800 text-sm px-3 py-1 rounded-full">
                    {videoInfo.author}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Download UI Component */}
        {videoInfo && formats.length > 0 && (
          <DownloadUI
            videoInfo={videoInfo}
            formats={formats}
            onDownloadComplete={() => {
              // Optional callback when download completes
              console.log('Download completed successfully')
            }}
          />
        )}

        {/* Exploration Section */}
        {isExploring && (
          <div className="max-w-4xl mx-auto bg-white rounded-2xl shadow-xl p-8 mb-8">
            <div className="text-center mb-6">
              <div className="w-16 h-16 mx-auto mb-4 bg-blue-100 rounded-full flex items-center justify-center">
                <Globe className="w-8 h-8 text-blue-600" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-2">
                {url.trim() ? 'Search Results' : 'Explore YouTube Content'}
              </h3>
              <p className="text-gray-600 mb-4">
                {url.trim() 
                  ? `Searching for: "${url.trim()}"`
                  : 'Discover trending videos and popular content to download'
                }
              </p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              <div className="bg-gray-50 rounded-lg p-6">
                <h4 className="font-semibold text-gray-900 mb-3">Continue Searching</h4>
                <p className="text-sm text-gray-600 mb-4">
                  Use the search box above to find more videos or enter a YouTube URL to download
                </p>
                <div className="space-y-3">
                  <div className="text-xs text-gray-500 bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <strong>Tip:</strong> You can search for any topic or paste a YouTube URL in the search box above.
                    <br />
                    <strong>Examples:</strong> "music", "tutorials", "gaming", or "https://www.youtube.com/watch?v=..."
                  </div>
                </div>
              </div>
              
              <div className="bg-gray-50 rounded-lg p-6">
                <h4 className="font-semibold text-gray-900 mb-3">Popular Categories</h4>
                <div className="space-y-2">
                  <button 
                    onClick={() => {
                      setUrl('music')
                      setIsExploring(true)
                    }}
                    className="w-full text-left p-3 rounded-lg hover:bg-white transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium">Popular Music</span>
                      <Music className="h-5 w-5 text-green-600" />
                    </div>
                    <p className="text-sm text-gray-600 mt-1">Songs and music videos</p>
                  </button>
                  <button 
                    onClick={() => {
                      setUrl('tutorials')
                      setIsExploring(true)
                    }}
                    className="w-full text-left p-3 rounded-lg hover:bg-white transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium">Educational Content</span>
                      <Play className="h-5 w-5 text-blue-600" />
                    </div>
                    <p className="text-sm text-gray-600 mt-1">Tutorials and learning videos</p>
                  </button>
                  <button 
                    onClick={() => {
                      setUrl('gaming')
                      setIsExploring(true)
                    }}
                    className="w-full text-left p-3 rounded-lg hover:bg-white transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium">Gaming Videos</span>
                      <Video className="h-5 w-5 text-purple-600" />
                    </div>
                    <p className="text-sm text-gray-600 mt-1">Gameplay and gaming content</p>
                  </button>
                  <button 
                    onClick={() => {
                      setUrl('comedy')
                      setIsExploring(true)
                    }}
                    className="w-full text-left p-3 rounded-lg hover:bg-white transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium">Entertainment</span>
                      <Play className="h-5 w-5 text-yellow-600" />
                    </div>
                    <p className="text-sm text-gray-600 mt-1">Comedy and entertainment videos</p>
                  </button>
                </div>
              </div>
            </div>

            <div className="border-t border-gray-200 pt-6">
              <div className="flex justify-between items-center">
                <div className="text-sm text-gray-600">
                  {url.trim() 
                    ? `Showing results for: "${url.trim()}"`
                    : 'Browse trending content or use the search box above'
                  }
                </div>
                <div className="flex gap-4">
                  <button
                    onClick={() => {
                      setUrl('')
                      setIsExploring(false)
                    }}
                    className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Back to Search
                  </button>
                  <button
                    onClick={() => {
                      setUrl('')
                      setIsExploring(true)
                    }}
                    className="bg-gray-600 text-white px-6 py-2 rounded-lg hover:bg-gray-700 transition-colors"
                  >
                    Clear Search
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* No Formats Available Message */}
        {videoInfo && formats.length === 0 && (
          <div className="max-w-4xl mx-auto bg-white rounded-2xl shadow-xl p-8 mb-8">
            <div className="text-center py-8">
              <div className="w-16 h-16 mx-auto mb-4 bg-yellow-100 rounded-full flex items-center justify-center">
                <AlertCircle className="w-8 h-8 text-yellow-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">No Download Formats Available</h3>
              <p className="text-gray-600 mb-4">
                We found the video information but couldn't retrieve available download formats.
              </p>
              <p className="text-sm text-gray-500">
                This may be due to YouTube's restrictions or temporary issues. Please try again later.
              </p>
              <div className="mt-6 flex justify-center space-x-4">
                <button
                  onClick={() => {
                    setVideoInfo(null)
                    setFormats([])
                    setError('')
                  }}
                  className="bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
                >
                  Try Another Video
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={loading}
                  className="bg-gray-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-gray-700 transition-colors disabled:opacity-50"
                >
                  Retry
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12 mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div>
              <h3 className="text-lg font-semibold mb-4">YouTube Downloader Pro</h3>
              <p className="text-gray-400">
                The ultimate tool for downloading YouTube videos and audio in any format and quality.
              </p>
            </div>
            <div>
              <h4 className="text-md font-semibold mb-4">Features</h4>
              <ul className="space-y-2 text-gray-400">
                <li>• Multiple video qualities (144p to 4K)</li>
                <li>• Audio extraction (MP3, AAC, etc.)</li>
                <li>• Fast downloads</li>
                <li>• No registration required</li>
              </ul>
            </div>
            <div>
              <h4 className="text-md font-semibold mb-4">Legal</h4>
              <p className="text-gray-400 text-sm">
                This tool is for educational purposes only. Please respect copyright laws and YouTube's terms of service.
              </p>
            </div>
          </div>
          <div className="border-t border-gray-800 mt-8 pt-8 text-center text-gray-400">
            <p>&copy; 2024 YouTube Downloader Pro. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}