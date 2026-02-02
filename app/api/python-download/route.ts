import { NextRequest, NextResponse } from 'next/server'
import { spawn } from 'child_process'
import path from 'path'
import fs from 'fs'
import { promisify } from 'util'

const exec = promisify(require('child_process').exec)

export async function GET(request: NextRequest): Promise<Response> {
  const { searchParams } = new URL(request.url)
  const videoId = searchParams.get('videoId')
  const format = searchParams.get('format')
  const filename = searchParams.get('filename')

  if (!videoId || !format || !filename) {
    return NextResponse.json(
      { error: 'Missing required parameters' },
      { status: 400 }
    )
  }

  try {
    // Create downloads directory
    const downloadsDir = path.join(process.cwd(), 'downloads')
    if (!fs.existsSync(downloadsDir)) {
      fs.mkdirSync(downloadsDir, { recursive: true })
    }

    // Generate unique filename with format info
    const formatSuffix = format.includes('+') ? 'merged' : format
    const uniqueFilename = `${Date.now()}_${formatSuffix}_${filename}`
    const outputPath = path.join(downloadsDir, uniqueFilename)

    // Python script path
    const pythonScriptPath = path.join(process.cwd(), 'scripts', 'download_video.py')

    // Check if Python script exists
    if (!fs.existsSync(pythonScriptPath)) {
      return NextResponse.json(
        { error: 'Python download script not found' },
        { status: 500 }
      )
    }

    // Check Python availability
    const isVercel = process.env.VERCEL === '1'
    const pythonCommand = isVercel ? 'python3' : 'python'
    
    try {
      await exec(`${pythonCommand} --version`)
    } catch (pythonError) {
      return NextResponse.json(
        { error: 'Python is not available on this system' },
        { status: 500 }
      )
    }

    // Execute Python script with enhanced error handling
    const pythonProcess = spawn(pythonCommand, [
      pythonScriptPath,
      `https://www.youtube.com/watch?v=${videoId}`,
      format,
      outputPath
    ])

    let stdout = ''
    let stderr = ''

    pythonProcess.stdout.on('data', (data) => {
      stdout += data.toString()
      console.log('Python stdout:', data.toString())
    })

    pythonProcess.stderr.on('data', (data) => {
      stderr += data.toString()
      console.error('Python stderr:', data.toString())
    })

    return new Promise((resolve) => {
      // Set timeout for long downloads (10 minutes)
      const timeout = setTimeout(() => {
        pythonProcess.kill('SIGTERM')
        resolve(NextResponse.json(
          { 
            error: 'Download timeout',
            message: 'The download is taking too long. Please try a different format or video.',
            pythonOutput: stdout,
            pythonError: stderr
          },
          { status: 504 }
        ))
      }, 10 * 60 * 1000) // 10 minutes

      pythonProcess.on('close', (code) => {
        clearTimeout(timeout)
        
        if (code === 0) {
          // Check if file was created and has content
          if (fs.existsSync(outputPath)) {
            const fileSize = fs.statSync(outputPath).size
            if (fileSize > 0) {
              // Return download URL
              const downloadUrl = `/api/download-file?path=${encodeURIComponent(outputPath)}&filename=${encodeURIComponent(filename)}`
              
              resolve(NextResponse.json({
                success: true,
                downloadUrl: downloadUrl,
                filename: filename,
                fileSize: fileSize,
                message: 'Download completed successfully',
                pythonOutput: stdout
              }))
            } else {
              // File exists but is empty
              fs.unlinkSync(outputPath) // Clean up empty file
              resolve(NextResponse.json(
                { 
                  error: 'Download failed - empty file',
                  message: 'The download completed but resulted in an empty file. This may be due to format unavailability.',
                  pythonOutput: stdout,
                  pythonError: stderr
                },
                { status: 500 }
              ))
            }
          } else {
            // File was not created
            const pythonError = stderr || 'Download process completed but file was not created'
            resolve(NextResponse.json(
              { 
                error: 'Download failed - file not created',
                message: pythonError,
                pythonOutput: stdout,
                pythonError: stderr
              },
              { status: 500 }
            ))
          }
        } else {
          // Python process failed
          resolve(NextResponse.json(
            { 
              error: 'Python download failed',
              message: `Process exited with code ${code}`,
              stderr: stderr,
              stdout: stdout
            },
            { status: 500 }
          ))
        }
      })

      pythonProcess.on('error', (error) => {
        clearTimeout(timeout)
        resolve(NextResponse.json(
          { error: `Python process error: ${error.message}` },
          { status: 500 }
        ))
      })
    })

  } catch (error) {
    console.error('Error in Python download:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Python download failed' },
      { status: 500 }
    )
  }
}
