import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

export async function GET(request: NextRequest): Promise<Response> {
  const { searchParams } = new URL(request.url)
  const filePath = searchParams.get('path')
  const filename = searchParams.get('filename')

  if (!filePath || !filename) {
    return NextResponse.json(
      { error: 'Missing file path or filename' },
      { status: 400 }
    )
  }

  try {
    // Validate file path
    const resolvedPath = path.resolve(filePath)
    const downloadsDir = path.resolve(path.join(process.cwd(), 'downloads'))
    
    // Ensure the file is within the downloads directory
    if (!resolvedPath.startsWith(downloadsDir)) {
      return NextResponse.json(
        { error: 'Invalid file path' },
        { status: 400 }
      )
    }

    // Check if file exists
    if (!fs.existsSync(resolvedPath)) {
      return NextResponse.json(
        { error: 'File not found' },
        { status: 404 }
      )
    }

    // Get file stats
    const stats = fs.statSync(resolvedPath)
    const fileSize = stats.size

    // Create readable stream
    const fileStream = fs.createReadStream(resolvedPath)

    // Set appropriate headers
    const response = new NextResponse(fileStream as any, {
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': fileSize.toString(),
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    })

    return response

  } catch (error) {
    console.error('Error serving file:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to serve file' },
      { status: 500 }
    )
  }
}