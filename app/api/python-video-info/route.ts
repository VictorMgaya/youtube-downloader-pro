import { NextRequest, NextResponse } from 'next/server'
import { spawn } from 'child_process'
import { join } from 'path'
import { promisify } from 'util'
import fs from 'fs'

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

    // Check if we're on Vercel serverless environment
    const isVercel = process.env.VERCEL === '1'
    
    // On Vercel, Python might not be available or properly configured
    // So we'll return a helpful error message
    if (isVercel) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Python execution is not supported in this deployment environment. Please use the primary video info API instead (/api/video-info).',
          method: 'Python extraction'
        },
        { status: 501 } // Not Implemented
      )
    }

    // Check if Python is available in the environment
    try {
      await exec('python3 --version')
    } catch (pythonError) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Python is not available in this environment. The python-video-info endpoint requires Python to be installed.',
          method: 'Python extraction'
        },
        { status: 500 }
      )
    }

    // Check if the Python script exists
    const pythonScriptPath = join(process.cwd(), 'scripts', 'get_video_info.py')
    if (!fs.existsSync(pythonScriptPath)) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Python script not found. The python-video-info endpoint requires get_video_info.py to be present.',
          method: 'Python extraction'
        },
        { status: 500 }
      )
    }

    try {
      // Execute Python script with proper path handling
      const pythonCommand = 'python3'
      
      // Ensure URL is properly quoted for shell execution
      const quotedUrl = `"${url.replace(/"/g, '\\"').replace(/ /g, '\\ ')}"`
      
      // Execute with timeout to prevent hanging processes
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
      
      try {
        const { stdout, stderr } = await exec(`${pythonCommand} "${pythonScriptPath}" ${quotedUrl}`, {
          env: {
            ...process.env,
            PYTHONPATH: process.cwd(),
            PATH: process.env.PATH
          },
          signal: controller.signal,
          timeout: 30000  // 30 second timeout
        })
        
        clearTimeout(timeoutId)
        
        if (stderr) {
          console.warn('Python script stderr:', stderr)
        }

        // Parse Python script output
        let result: VideoInfoResult
        try {
          // Handle case where output might contain extra logging
          const cleanedOutput = stdout.trim().split('\n').pop() || '{}'
          result = JSON.parse(cleanedOutput)
        } catch (parseError) {
          console.error('Failed to parse Python output:', parseError)
          console.error('Raw output:', stdout)
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

      } catch (timeoutError) {
        if (controller.signal.aborted) {
          console.error('Python script execution timed out')
          return NextResponse.json(
            { 
              success: false,
              error: 'Python script execution timed out',
              method: 'Python extraction'
            },
            { status: 408 }
          )
        }
        throw timeoutError
      }

    } catch (pythonError: any) {
      console.error('Python script execution failed:', pythonError)
      
      if (pythonError.code === 'ENOENT') {
        return NextResponse.json(
          { 
            success: false,
            error: 'Python is not installed or not found in PATH',
            method: 'Python extraction'
          },
          { status: 500 }
        )
      }
      
      return NextResponse.json(
        { 
          success: false,
          error: 'Python script execution failed: ' + pythonError.message,
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