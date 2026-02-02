import { NextRequest, NextResponse } from 'next/server'

// User-Agent rotation for bypassing YouTube restrictions
const USER_AGENTS = [
  // Desktop browsers
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/121.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15',
  
  // Mobile browsers
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  'Mozilla/5.0 (iPad; CPU OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  'Mozilla/5.0 (Linux; Android 13; SM-S901B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 Mobile Safari/537.36',
  'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 Mobile Safari/537.36',
  
  // Alternative browsers
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
]

// Cache for video info to avoid repeated failures
const videoInfoCache = new Map<string, { data: any; timestamp: number }>()
const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

// Rate limiting protection
const requestCounts = new Map<string, { count: number; resetTime: number }>()
const RATE_LIMIT_WINDOW = 60 * 1000 // 1 minute
const MAX_REQUESTS_PER_WINDOW = 10

interface VideoInfoResult {
  videoInfo: {
    title: string
    description: string
    thumbnail: string
    duration: number
    views: string
    uploadDate: string
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
}

interface FallbackResult {
  success: boolean
  data?: VideoInfoResult
  error?: string
  method?: string
}

function isRateLimited(clientIp: string): boolean {
  const now = Date.now()
  const rateLimit = requestCounts.get(clientIp)
  
  if (!rateLimit) {
    requestCounts.set(clientIp, { count: 1, resetTime: now + RATE_LIMIT_WINDOW })
    return false
  }
  
  if (now > rateLimit.resetTime) {
    rateLimit.count = 1
    rateLimit.resetTime = now + RATE_LIMIT_WINDOW
    return false
  }
  
  if (rateLimit.count >= MAX_REQUESTS_PER_WINDOW) {
    return true
  }
  
  rateLimit.count++
  return false
}

function getCachedVideoInfo(videoId: string): VideoInfoResult | null {
  const cached = videoInfoCache.get(videoId)
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data
  }
  return null
}

function setCachedVideoInfo(videoId: string, data: VideoInfoResult): void {
  videoInfoCache.set(videoId, { data, timestamp: Date.now() })
}

async function tryAlternativeExtraction(videoId: string): Promise<FallbackResult> {
  try {
    console.log('Attempting alternative extraction methods...')
    
    // Method 1: Try Python-based extraction (PRIMARY METHOD)
    try {
      console.log('Trying Python-based extraction...')
      const pythonResponse = await fetch('/api/python-video-info', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: `https://www.youtube.com/watch?v=${videoId}`
        }),
      })
      
      if (pythonResponse.ok) {
        const pythonData = await pythonResponse.json()
        
        if (pythonData.success && pythonData.videoInfo && pythonData.formats) {
          console.log('✓ Python extraction successful')
          return {
            success: true,
            data: {
              videoInfo: pythonData.videoInfo,
              formats: pythonData.formats
            },
            method: 'Alternative extraction (Python-based)'
          }
        }
      }
    } catch (pythonError) {
      console.warn('Python extraction failed:', pythonError instanceof Error ? pythonError.message : String(pythonError))
    }

    // Method 2: Try YouTube API (if available)
    try {
      const apiKey = process.env.YOUTUBE_API_KEY
      if (apiKey) {
        console.log('Trying YouTube API...')
        const response = await fetch(`https://www.googleapis.com/youtube/v3/videos?id=${videoId}&key=${apiKey}&part=snippet,contentDetails,statistics`)
        const data = await response.json()
        
        if (data.items && data.items.length > 0) {
          const item = data.items[0]
          const result = {
            videoInfo: {
              title: item.snippet.title || 'Unknown Title',
              description: item.snippet.description || '',
              thumbnail: item.snippet.thumbnails?.high?.url || item.snippet.thumbnails?.medium?.url || item.snippet.thumbnails?.default?.url || '',
              duration: parseISO8601Duration(item.contentDetails.duration || 'PT0S'),
              views: item.statistics?.viewCount || '0',
              uploadDate: item.snippet.publishedAt || '',
              author: item.snippet.channelTitle || 'Unknown Author',
              videoId: item.id || videoId,
            },
            formats: [] // YouTube API doesn't provide direct download URLs
          }
          
          return {
            success: true,
            data: result,
            method: 'Alternative extraction (YouTube API)'
          }
        }
      }
    } catch (apiError) {
      console.warn('YouTube API extraction failed:', apiError instanceof Error ? apiError.message : String(apiError))
    }

    // Method 3: Enhanced HTML scraping with multiple patterns - INCLUDING FORMAT EXTRACTION
    try {
      console.log('Trying enhanced HTML scraping...')
      const response = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
        headers: {
          'User-Agent': USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)],
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Encoding': 'gzip, deflate, br',
          'Connection': 'keep-alive',
        }
      })
      
      if (response.ok) {
        const html = await response.text()
        
        // Multiple regex patterns to extract info from different parts of the page
        const titlePatterns = [
          /"title":"([^"]+)"/,
          /<title>([^<]+)<\/title>/,
          /"videoDetails":{"title":"([^"]+)"/,
          /"name":"([^"]+)","url":"\/watch\?v=${videoId}"/
        ]
        
        const descriptionPatterns = [
          /"shortDescription":"([^"]+)"/,
          /"description":{"simpleText":"([^"]+)"/,
          /<meta name="description" content="([^"]+)"/
        ]
        
        const authorPatterns = [
          /"author":"([^"]+)"/,
          /"channelName":"([^"]+)"/,
          /"ownerChannelName":"([^"]+)"/,
          /<link itemprop="url" href="[^"]*\/channel\/([^"]+)"/
        ]
        
        const viewCountPatterns = [
          /"viewCount":"([^"]+)"/,
          /"viewCountText":{"simpleText":"([^"]+)"/,
          /"viewCountText":{"runs":\[{"text":"([^"]+)"/
        ]
        
        const durationPatterns = [
          /"lengthSeconds":"(\d+)"/,
          /"lengthText":{"simpleText":"([^"]+)"/,
          /"duration":"PT(\d+)S"/
        ]

        let title = 'Unknown Title'
        let description = ''
        let author = 'Unknown Author'
        let views = '0'
        let duration = 0

        // Try to extract title
        for (const pattern of titlePatterns) {
          const match = html.match(pattern)
          if (match && match[1]) {
            title = match[1].replace(/\\u[\dA-F]{4}/gi, (match) => {
              return String.fromCharCode(parseInt(match.replace(/\\u/g, ''), 16))
            })
            break
          }
        }

        // Try to extract description
        for (const pattern of descriptionPatterns) {
          const match = html.match(pattern)
          if (match && match[1]) {
            description = match[1].replace(/\\u[\dA-F]{4}/gi, (match) => {
              return String.fromCharCode(parseInt(match.replace(/\\u/g, ''), 16))
            })
            break
          }
        }

        // Try to extract author
        for (const pattern of authorPatterns) {
          const match = html.match(pattern)
          if (match && match[1]) {
            author = match[1].replace(/\\u[\dA-F]{4}/gi, (match) => {
              return String.fromCharCode(parseInt(match.replace(/\\u/g, ''), 16))
            })
            break
          }
        }

        // Try to extract view count
        for (const pattern of viewCountPatterns) {
          const match = html.match(pattern)
          if (match && match[1]) {
            views = match[1].replace(/[^0-9]/g, '')
            break
          }
        }

        // Try to extract duration
        for (const pattern of durationPatterns) {
          const match = html.match(pattern)
          if (match && match[1]) {
            duration = parseInt(match[1])
            break
          }
        }

        // Try to extract upload date
        const uploadDateMatch = html.match(/"uploadDate":"([^"]+)"/)
        const uploadDate = uploadDateMatch?.[1] || ''

        // Extract formats from HTML - Look for streaming data
        const formats: Array<{
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
        }> = []

        // Look for streaming data in the HTML
        const streamingDataMatch = html.match(/"streamingData":\s*({[^}]+(?:{[^}]*}[^}]*)*})/)
        if (streamingDataMatch) {
          try {
            const streamingDataStr = streamingDataMatch[1]
            // Try to extract adaptiveFormats and formats arrays
            const formatsMatch = streamingDataStr.match(/"formats":\s*(\[.*?\])/)
            const adaptiveFormatsMatch = streamingDataStr.match(/"adaptiveFormats":\s*(\[.*?\])/)
            
            if (formatsMatch || adaptiveFormatsMatch) {
              const formatsData = formatsMatch ? JSON.parse(formatsMatch[1]) : []
              const adaptiveFormatsData = adaptiveFormatsMatch ? JSON.parse(adaptiveFormatsMatch[1]) : []
              
              // Process regular formats (video+audio)
              formatsData.forEach((format: any) => {
                if (format.url) {
                  formats.push({
                    itag: format.itag || 0,
                    quality: format.quality || 'unknown',
                    qualityLabel: format.qualityLabel || format.quality || 'unknown',
                    mimeType: format.mimeType || 'video/mp4',
                    container: format.mimeType?.split('/')[1]?.split(';')[0] || 'mp4',
                    hasVideo: true,
                    hasAudio: true,
                    width: format.width,
                    height: format.height,
                    bitrate: format.bitrate,
                    audioBitrate: format.audioBitrate,
                    url: format.url
                  })
                }
              })

              // Process adaptive formats (video-only or audio-only)
              adaptiveFormatsData.forEach((format: any) => {
                if (format.url) {
                  formats.push({
                    itag: format.itag || 0,
                    quality: format.quality || 'unknown',
                    qualityLabel: format.qualityLabel || format.quality || 'unknown',
                    mimeType: format.mimeType || 'video/mp4',
                    container: format.mimeType?.split('/')[1]?.split(';')[0] || 'mp4',
                    hasVideo: format.hasVideo || false,
                    hasAudio: format.hasAudio || false,
                    width: format.width,
                    height: format.height,
                    bitrate: format.bitrate,
                    audioBitrate: format.audioBitrate,
                    url: format.url
                  })
                }
              })
            }
          } catch (parseError) {
            console.warn('Failed to parse streaming data:', parseError)
          }
        }

        // If no formats found, create comprehensive format entries
        if (formats.length === 0) {
          console.log('No streaming data found, creating comprehensive format list...')
          
          // Common YouTube itag mappings for video formats
          const videoFormats = [
            // 144p
            { itag: 160, quality: '144p', qualityLabel: '144p', width: 256, height: 144, bitrate: 100, audioBitrate: 0 },
            { itag: 133, quality: '240p', qualityLabel: '240p', width: 426, height: 240, bitrate: 200, audioBitrate: 0 },
            { itag: 134, quality: '360p', qualityLabel: '360p', width: 640, height: 360, bitrate: 500, audioBitrate: 0 },
            { itag: 135, quality: '480p', qualityLabel: '480p', width: 854, height: 480, bitrate: 800, audioBitrate: 0 },
            { itag: 136, quality: '720p', qualityLabel: '720p', width: 1280, height: 720, bitrate: 1500, audioBitrate: 0 },
            { itag: 137, quality: '1080p', qualityLabel: '1080p', width: 1920, height: 1080, bitrate: 3000, audioBitrate: 0 },
            { itag: 298, quality: '1440p', qualityLabel: '1440p', width: 2560, height: 1440, bitrate: 6000, audioBitrate: 0 },
            { itag: 299, quality: '2160p', qualityLabel: '2160p', width: 3840, height: 2160, bitrate: 12000, audioBitrate: 0 },
            { itag: 302, quality: '2160p60', qualityLabel: '2160p60', width: 3840, height: 2160, bitrate: 15000, audioBitrate: 0 },
            { itag: 303, quality: '4320p', qualityLabel: '4320p', width: 7680, height: 4320, bitrate: 20000, audioBitrate: 0 },
          ]
          
          // Common YouTube itag mappings for audio formats
          const audioFormats = [
            { itag: 139, quality: 'low', qualityLabel: '48kbps', audioBitrate: 48 },
            { itag: 140, quality: 'medium', qualityLabel: '128kbps', audioBitrate: 128 },
            { itag: 141, quality: 'high', qualityLabel: '256kbps', audioBitrate: 256 },
            { itag: 251, quality: 'very_high', qualityLabel: '160kbps', audioBitrate: 160 },
            { itag: 256, quality: 'ultra_high', qualityLabel: '256kbps', audioBitrate: 256 },
            { itag: 325, quality: 'master', qualityLabel: '320kbps', audioBitrate: 320 },
          ]
          
          // Common YouTube itag mappings for video+audio formats
          const combinedFormats = [
            { itag: 18, quality: '360p', qualityLabel: '360p', width: 640, height: 360, bitrate: 500, audioBitrate: 128 },
            { itag: 22, quality: '720p', qualityLabel: '720p', width: 1280, height: 720, bitrate: 1500, audioBitrate: 192 },
            { itag: 394, quality: '144p', qualityLabel: '144p', width: 256, height: 144, bitrate: 100, audioBitrate: 48 },
            { itag: 395, quality: '240p', qualityLabel: '240p', width: 426, height: 240, bitrate: 200, audioBitrate: 48 },
            { itag: 396, quality: '360p', qualityLabel: '360p', width: 640, height: 360, bitrate: 500, audioBitrate: 96 },
            { itag: 397, quality: '480p', qualityLabel: '480p', width: 854, height: 480, bitrate: 800, audioBitrate: 96 },
            { itag: 398, quality: '720p', qualityLabel: '720p', width: 1280, height: 720, bitrate: 1500, audioBitrate: 128 },
            { itag: 399, quality: '1080p', qualityLabel: '1080p', width: 1920, height: 1080, bitrate: 3000, audioBitrate: 192 },
            { itag: 400, quality: '1440p', qualityLabel: '1440p', width: 2560, height: 1440, bitrate: 6000, audioBitrate: 256 },
            { itag: 401, quality: '2160p', qualityLabel: '2160p', width: 3840, height: 2160, bitrate: 12000, audioBitrate: 320 },
            { itag: 402, quality: '2160p60', qualityLabel: '2160p60', width: 3840, height: 2160, bitrate: 15000, audioBitrate: 320 },
            { itag: 403, quality: '4320p', qualityLabel: '4320p', width: 7680, height: 4320, bitrate: 20000, audioBitrate: 320 },
          ]
          
          // Add video-only formats
          videoFormats.forEach(format => {
            formats.push({
              itag: format.itag,
              quality: format.quality,
              qualityLabel: format.qualityLabel,
              mimeType: 'video/mp4',
              container: 'mp4',
              hasVideo: true,
              hasAudio: false,
              width: format.width,
              height: format.height,
              bitrate: format.bitrate,
              audioBitrate: 0,
              url: `https://www.youtube.com/watch?v=${videoId}&itag=${format.itag}`
            })
          })
          
          // Add audio-only formats
          audioFormats.forEach(format => {
            formats.push({
              itag: format.itag,
              quality: format.quality,
              qualityLabel: format.qualityLabel,
              mimeType: 'audio/mp4',
              container: 'm4a',
              hasVideo: false,
              hasAudio: true,
              width: undefined,
              height: undefined,
              bitrate: 0,
              audioBitrate: format.audioBitrate,
              url: `https://www.youtube.com/watch?v=${videoId}&itag=${format.itag}`
            })
          })
          
          // Add combined video+audio formats
          combinedFormats.forEach(format => {
            formats.push({
              itag: format.itag,
              quality: format.quality,
              qualityLabel: format.qualityLabel,
              mimeType: 'video/mp4',
              container: 'mp4',
              hasVideo: true,
              hasAudio: true,
              width: format.width,
              height: format.height,
              bitrate: format.bitrate,
              audioBitrate: format.audioBitrate,
              url: `https://www.youtube.com/watch?v=${videoId}&itag=${format.itag}`
            })
          })
          
          console.log(`Created ${formats.length} fallback formats`)
        }

        const result = {
          videoInfo: {
            title: title || 'Unknown Title',
            description: description || '',
            thumbnail: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
            duration: duration || 0,
            views: views || '0',
            uploadDate: uploadDate || '',
            author: author || 'Unknown Author',
            videoId: videoId,
          },
          formats: formats
        }
        
        return {
          success: true,
          data: result,
          method: 'Alternative extraction (Enhanced HTML scraping)'
        }
      }
    } catch (scrapeError) {
      console.warn('Enhanced HTML scraping failed:', scrapeError instanceof Error ? scrapeError.message : String(scrapeError))
    }

    // Method 4: Try YouTube oEmbed API
    try {
      console.log('Trying YouTube oEmbed API...')
      const response = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`)
      const data = await response.json()
      
      if (data && data.title) {
        const result = {
          videoInfo: {
            title: data.title || 'Unknown Title',
            description: data.description || '',
            thumbnail: data.thumbnail_url || `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
            duration: 0, // oEmbed doesn't provide duration
            views: '0',
            uploadDate: '',
            author: data.author_name || 'Unknown Author',
            videoId: videoId,
          },
          formats: [] // oEmbed doesn't provide format information
        }
        
        return {
          success: true,
          data: result,
          method: 'Alternative extraction (YouTube oEmbed API)'
        }
      }
    } catch (oembedError) {
      console.warn('YouTube oEmbed API failed:', oembedError instanceof Error ? oembedError.message : String(oembedError))
    }

    // Method 5: Try Rumble API (for YouTube videos that might be mirrored)
    try {
      console.log('Trying Rumble API...')
      const response = await fetch(`https://rumble.com/embedJS/u3/?request=video&ver=2&v=${videoId}`)
      const data = await response.json()
      
      if (data && data.title) {
        const result = {
          videoInfo: {
            title: data.title || 'Unknown Title',
            description: data.description || '',
            thumbnail: data.thumbnail || `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
            duration: data.duration || 0,
            views: data.views || '0',
            uploadDate: data.upload_date || '',
            author: data.author || 'Unknown Author',
            videoId: videoId,
          },
          formats: [] // Rumble API doesn't provide YouTube format information
        }
        
        return {
          success: true,
          data: result,
          method: 'Alternative extraction (Rumble API)'
        }
      }
    } catch (rumbleError) {
      console.warn('Rumble API failed:', rumbleError instanceof Error ? rumbleError.message : String(rumbleError))
    }

  } catch (error) {
    console.warn('Alternative extraction failed:', error instanceof Error ? error.message : String(error))
  }
  
  return { success: false, error: 'All alternative extraction methods failed' }
}

function parseISO8601Duration(duration: string): number {
  // Convert ISO 8601 duration to seconds
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/)
  if (!match) return 0
  
  const hours = parseInt(match[1] || '0', 10)
  const minutes = parseInt(match[2] || '0', 10)
  const seconds = parseInt(match[3] || '0', 10)
  
  return hours * 3600 + minutes * 60 + seconds
}

async function getVideoInfoWithFallbacks(videoId: string): Promise<FallbackResult> {
  // Check cache first
  const cached = getCachedVideoInfo(videoId)
  if (cached) {
    return { success: true, data: cached, method: 'Cache hit' }
  }

  // Try alternative extraction methods (scraping-focused)
  let result = await tryAlternativeExtraction(videoId)
  if (result.success) {
    setCachedVideoInfo(videoId, result.data!)
    return result
  }

  return { success: false, error: 'All fallback methods exhausted' }
}

export async function POST(request: NextRequest): Promise<Response> {
  const clientIp = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'
  
  // Rate limiting check
  if (isRateLimited(clientIp)) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      { status: 429 }
    )
  }

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

    // Get video info with comprehensive fallbacks
    const fallbackResult = await getVideoInfoWithFallbacks(videoId)
    
    if (fallbackResult.success) {
      return NextResponse.json({
        videoInfo: fallbackResult.data!.videoInfo,
        formats: fallbackResult.data!.formats,
        method: fallbackResult.method
      })
    } else {
      return NextResponse.json(
        { 
          error: fallbackResult.error || 'Failed to fetch video information',
          message: 'YouTube video information could not be retrieved. This may be due to YouTube restrictions, network issues, or the video being unavailable.'
        },
        { status: 500 }
      )
    }

  } catch (error) {
    console.error('Error fetching video info:', error)
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Failed to fetch video information',
        message: 'An unexpected error occurred while processing your request.'
      },
      { status: 500 }
    )
  }
}