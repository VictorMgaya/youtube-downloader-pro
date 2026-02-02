import { NextRequest, NextResponse } from 'next/server'
import { spawn } from 'child_process'
import { join } from 'path'
import { promisify } from 'util'

const exec = promisify(require('child_process').exec)

interface VideoInfoResult {
  success: boolean
  videoInfo?: {
    title: string
    description: string
    thumbnail: string
    duration: number
    views: string
    uploadDate: string
    author: string
    videoId: string
  }
  formats?: Array<{
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
  error?: string
  method?: string
}

export async function POST(request: NextRequest): Promise<Response> {
  try {
    const { url } = await request.json()

    if (!url) {
      return NextResponse.json(
        { error: 'URL is required' },
        { status: 400 }
      )
    }

    // Validate URL
    let videoId: string
    try {
      const urlObj = new URL(url)
      if (urlObj.hostname.includes('youtube.com')) {
        videoId = urlObj.searchParams.get('v') || ''
      } else if (urlObj.hostname.includes('youtu.be')) {
        videoId = urlObj.pathname.slice(1)
      } else {
        throw new Error('Invalid YouTube URL')
      }

      if (!videoId) {
        throw new Error('Could not extract video ID')
      }
    } catch (error) {
      return NextResponse.json(
        { error: 'Invalid URL format' },
        { status: 400 }
      )
    }

    // Run Python script to get video info
    const pythonScriptPath = join(process.cwd(), 'scripts', 'get_video_info.py')
    
    try {
      // Execute Python script
      const { stdout, stderr } = await exec(`python ${pythonScriptPath} "${url}"`)
      
      if (stderr) {
        console.warn('Python script stderr:', stderr)
      }

      // Parse Python script output
      let result: VideoInfoResult
      try {
        result = JSON.parse(stdout)
      } catch (parseError) {
        console.error('Failed to parse Python output:', parseError)
        return NextResponse.json(
          { 
            success: false,
            error: 'Failed to parse video information',
            method: 'Python extraction'
          },
          { status: 500 }
        )
      }

      if (result.success && result.videoInfo && result.formats) {
        return NextResponse.json({
          success: true,
          videoInfo: result.videoInfo,
          formats: result.formats,
          method: result.method || 'Python extraction'
        })
      } else {
        return NextResponse.json(
          { 
            success: false,
            error: result.error || 'Failed to extract video information',
            method: result.method || 'Python extraction'
          },
          { status: 500 }
        )
      }

    } catch (pythonError) {
      console.error('Python script execution failed:', pythonError)
      return NextResponse.json(
        { 
          success: false,
          error: 'Python script execution failed',
          method: 'Python extraction'
        },
        { status: 500 }
      )
    }

  } catch (error) {
    console.error('Error getting video info:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get video information' },
      { status: 500 }
    )
  }
}