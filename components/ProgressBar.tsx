'use client'

interface ProgressBarProps {
  progress: number
  status: 'downloading' | 'processing' | 'completed' | 'error' | 'fetching'
  fileName?: string
  error?: string
}

export default function ProgressBar({ progress, status, fileName, error }: ProgressBarProps) {
  const getStatusColor = () => {
    switch (status) {
      case 'fetching':
        return 'bg-purple-600'
      case 'downloading':
        return 'bg-blue-600'
      case 'processing':
        return 'bg-yellow-600'
      case 'completed':
        return 'bg-green-600'
      case 'error':
        return 'bg-red-600'
      default:
        return 'bg-gray-600'
    }
  }

  const getStatusText = () => {
    switch (status) {
      case 'fetching':
        return 'Fetching video information...'
      case 'downloading':
        return `Downloading... ${Math.round(progress)}%`
      case 'processing':
        return 'Processing file...'
      case 'completed':
        return 'Download completed!'
      case 'error':
        return error || 'Download failed'
      default:
        return 'Preparing download...'
    }
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`w-3 h-3 rounded-full ${getStatusColor()} ${
            status === 'downloading' ? 'animate-pulse' : ''
          }`} />
          <span className="text-sm font-medium text-gray-900">
            {getStatusText()}
          </span>
        </div>
        
        {status === 'downloading' && (
          <span className="text-sm text-gray-500">{Math.round(progress)}%</span>
        )}
      </div>

      {status !== 'completed' && status !== 'error' && (
        <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
          <div
            className={`h-full ${getStatusColor()} transition-all duration-300 ease-out ${
              status === 'downloading' ? 'animate-pulse' : ''
            }`}
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      {fileName && (
        <div className="text-xs text-gray-500 truncate">
          {fileName}
        </div>
      )}

      {status === 'error' && (
        <div className="text-xs text-red-600 bg-red-50 p-2 rounded border border-red-200">
          {error || 'An error occurred during download. Please try again.'}
        </div>
      )}

      {status === 'completed' && (
        <div className="text-xs text-green-600 bg-green-50 p-2 rounded border border-green-200">
          File downloaded successfully! Check your downloads folder.
        </div>
      )}
    </div>
  )
}
