import { NextRequest, NextResponse } from 'next/server'

// User-Agent rotation for bypassing restrictions
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
const MAX_REQUESTS_PER_WINDOW = 5 // Lower limit for downloads

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
    console.log('Attempting alternative extraction methods for download...')
    
    // Method 1: Try YouTube API (if available)
    try {
      const apiKey = process.env.YOUTUBE_API_KEY
      if (apiKey) {
        console.log('Trying YouTube API for download info...')
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
            formats: [] // YouTube API doesn't provide format URLs
          }
          
          return {
            success: true,
            data: result,
            method: 'Alternative extraction (YouTube API)'
          }
        }
      }
    } catch (apiError) {
      console.warn('YouTube API extraction failed for download:', apiError instanceof Error ? apiError.message : String(apiError))
    }

    // Method 2: Enhanced HTML scraping with multiple patterns - INCLUDING FORMAT EXTRACTION
    try {
      console.log('Trying enhanced HTML scraping for download...')
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

        // If no formats found from streaming data, create comprehensive format entries
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
          method: 'Alternative extraction (Enhanced HTML scraping with formats)'
        }
      }
    } catch (scrapeError) {
      console.warn('Enhanced HTML scraping failed for download:', scrapeError instanceof Error ? scrapeError.message : String(scrapeError))
    }

    // Method 3: Try YouTube oEmbed API
    try {
      console.log('Trying YouTube oEmbed API for download...')
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
      console.warn('YouTube oEmbed API failed for download:', oembedError instanceof Error ? oembedError.message : String(oembedError))
    }

  } catch (error) {
    console.warn('Alternative extraction failed for download:', error instanceof Error ? error.message : String(error))
  }
  
  return { success: false, error: 'All alternative extraction methods failed' }
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

function parseISO8601Duration(duration: string): number {
  // Convert ISO 8601 duration to seconds
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/)
  if (!match) return 0
  
  const hours = parseInt(match[1] || '0', 10)
  const minutes = parseInt(match[2] || '0', 10)
  const seconds = parseInt(match[3] || '0', 10)
  
  return hours * 3600 + minutes * 60 + seconds
}

function generateFilename(title: string, format: any): string {
  const cleanTitle = title.replace(/[^a-zA-Z0-9]/g, '_')
  const extension = format.container || format.mimeType?.split('/')[1] || 'mp4'
  
  // Generate quality suffix with enhanced information
  let qualitySuffix = ''
  if (format.hasVideo && format.hasAudio) {
    // Video with audio
    const resolution = format.height ? `${format.height}p` : (format.qualityLabel || format.quality || 'video')
    qualitySuffix = `${resolution}_video_audio`
  } else if (format.hasVideo) {
    // Video only
    const resolution = format.height ? `${format.height}p` : (format.qualityLabel || format.quality || 'video')
    qualitySuffix = `${resolution}_video_only`
  } else {
    // Audio only
    const audioQuality = format.audioBitrate ? `${format.audioBitrate}kbps` : 'audio'
    qualitySuffix = `${audioQuality}_audio_only`
  }
  
  // Clean quality suffix
  const cleanQuality = qualitySuffix.replace(/[^a-zA-Z0-9]/g, '_')
  
  return `${cleanTitle}_${cleanQuality}.${extension}`
}

function getOptimizedFormatForQuality(formatCode: string, type: string): string {
  // High-quality format optimizations - PRIORITIZING HIGHEST QUALITY
  const qualityMappings: Record<string, Record<string, string>> = {
    // Audio formats with enhanced quality selection (HIGHEST QUALITY FIRST)
    'audio': {
      '140': '140/bestaudio[ext=m4a]/bestaudio',  // 128kbps AAC
      '141': '141/bestaudio[ext=m4a]/bestaudio',  // 256kbps AAC (HIGHER QUALITY)
      '251': '251/bestaudio[ext=webm]/bestaudio',  // 160kbps Opus
      '256': '256/bestaudio[ext=m4a]/bestaudio',   // 192kbps AAC (DASH)
      '325': '325/bestaudio[ext=m4a]/bestaudio',   // 320kbps AAC (MASTER QUALITY - HIGHEST)
    },
    // Video formats with enhanced quality and audio merging (HIGHEST QUALITY FIRST)
    'video': {
      '313': '313+325/best[height=2160][ext=mp4]/best[height=2160]',  // 4K + MASTER AUDIO (HIGHEST QUALITY)
      '303': '303+325/best[height=2160][ext=webm]/best[height=2160]',  // 4K WebM + MASTER AUDIO
      '266': '266+325/best[height=1440][ext=mp4]/best[height=1440]',  // 1440p + MASTER AUDIO
      '264': '264+325/best[height=1440][ext=webm]/best[height=1440]',  // 1440p WebM + MASTER AUDIO
      '137': '137+141/best[height=1080][ext=mp4]/best[height=1080]',  // 1080p + HIGH AUDIO
      '248': '248+251/best[height=1080][ext=webm]/best[height=1080]',  // 1080p WebM + BEST AUDIO
      '136': '136+141/best[height=720][ext=mp4]/best[height=720]',    // 720p + HIGH AUDIO
      '247': '247+251/best[height=720][ext=webm]/best[height=720]',    // 720p WebM + BEST AUDIO
      '135': '135+140/best[height=480][ext=mp4]/best[height=480]',    // 480p + GOOD AUDIO
      '244': '244+251/best[height=480][ext=webm]/best[height=480]',    // 480p WebM + BEST AUDIO
      '134': '134+140/best[height=360][ext=mp4]/best[height=360]',    // 360p + GOOD AUDIO
      '243': '243+251/best[height=360][ext=webm]/best[height=360]',    // 360p WebM + BEST AUDIO
      '133': '133+140/best[height=240][ext=mp4]/best[height=240]',    // 240p + GOOD AUDIO
      '242': '242+251/best[height=240][ext=webm]/best[height=240]',    // 240p WebM + BEST AUDIO
      '160': '160+140/best[height=144][ext=mp4]/best[height=144]',    // 144p + GOOD AUDIO
      '278': '278+251/best[height=144][ext=webm]/best[height=144]',    // 144p WebM + BEST AUDIO
    }
  }
  
  const typeMapping = qualityMappings[type]
  if (typeMapping) {
    const formatMapping = typeMapping[formatCode]
    if (formatMapping) {
      return formatMapping
    }
  }
  
  // Default fallback - PRIORITIZE HIGHEST QUALITY
  if (type === 'audio') {
    return 'bestaudio[ext=m4a]/bestaudio[ext=webm]/bestaudio[abr>256]/bestaudio[abr>192]/bestaudio[abr>160]/bestaudio[abr>128]/bestaudio'
  } else {
    return 'best[height>=2160][width>=3840]/best[height>=1440][width>=2560]/best[height>=1080][width>=1920]/best[height>=720][width>=1280]/best[height>=480][width>=854]/best[height>=360][width>=640]/best'
  }
}

export async function POST(request: NextRequest): Promise<Response> {
  const clientIp = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'
  
  // Rate limiting check for downloads
  if (isRateLimited(clientIp)) {
    return NextResponse.json(
      { error: 'Too many download requests. Please try again later.' },
      { status: 429 }
    )
  }

  try {
    const { url, format, type } = await request.json()

    if (!url || !format) {
      return NextResponse.json(
        { error: 'URL and format are required' },
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
    
    if (!fallbackResult.success) {
      return NextResponse.json(
        { 
          error: fallbackResult.error || 'Failed to fetch video information',
          message: 'Unable to retrieve video information for download.'
        },
        { status: 500 }
      )
    }

    // Check if we have format information
    if (fallbackResult.data!.formats.length === 0) {
      return NextResponse.json(
        { 
          error: 'Format information not available',
          message: 'Unable to determine available formats. This may be due to YouTube restrictions.'
        },
        { status: 500 }
      )
    }

    // Find the requested format
    const selectedFormat = fallbackResult.data!.formats.find(f => f.itag === parseInt(format))
    
    if (!selectedFormat) {
      return NextResponse.json(
        { error: 'Requested format not available' },
        { status: 404 }
      )
    }

    // Generate filename
    const filename = generateFilename(fallbackResult.data!.videoInfo.title, selectedFormat)

    // Return Python-based download URL for backend processing
    return NextResponse.json({
      success: true,
      pythonDownloadUrl: `/api/python-download?videoId=${videoId}&format=${format}&filename=${encodeURIComponent(filename)}`,
      filename: filename,
      mimeType: selectedFormat.mimeType || 'application/octet-stream',
      method: 'Python backend download',
      fallbackUsed: fallbackResult.method || 'none'
    })

  } catch (error) {
    console.error('Error downloading video:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to download video' },
      { status: 500 }
    )
  }
}