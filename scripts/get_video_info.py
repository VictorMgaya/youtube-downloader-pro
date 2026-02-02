#!/usr/bin/env python3
"""
YouTube Video Information Extractor using Python
This script extracts comprehensive video information including all available formats
using multiple Python libraries and techniques
"""

import sys
import os
import subprocess
import json
import re
import requests
from urllib.parse import urlparse, parse_qs
from bs4 import BeautifulSoup
import time
import random

def install_required_packages():
    """Install required Python packages with error handling for server environments"""
    packages = ['requests', 'beautifulsoup4', 'lxml']
    for package in packages:
        try:
            __import__(package)
        except ImportError:
            print(f"Installing {package}...")
            try:
                # Use the pip module to install packages
                subprocess.check_call([
                    sys.executable, "-m", "pip", "install", package, "--user", "--timeout=60"
                ])
            except subprocess.CalledProcessError as e:
                print(f"Failed to install {package}: {e}")
                return False
            except Exception as e:
                print(f"Unexpected error installing {package}: {e}")
                return False
    return True

def get_user_agents():
    """Return list of user agents for rotation"""
    return [
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/121.0',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15',
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
        'Mozilla/5.0 (iPad; CPU OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
        'Mozilla/5.0 (Linux; Android 13; SM-S901B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 Mobile Safari/537.36',
        'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 Mobile Safari/537.36',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0',
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    ]

def get_random_user_agent():
    """Get random user agent"""
    return random.choice(get_user_agents())

def extract_video_id(url):
    """Extract video ID from YouTube URL"""
    try:
        parsed_url = urlparse(url)
        if 'youtube.com' in parsed_url.netloc:
            video_id = parse_qs(parsed_url.query).get('v', [None])[0]
        elif 'youtu.be' in parsed_url.netloc:
            video_id = parsed_url.path[1:]
        else:
            return None
        return video_id
    except Exception:
        return None

def clean_text(text):
    """Clean and decode text from HTML entities"""
    if not text:
        return ""
    
    # Replace HTML entities
    text = text.replace('\\u0026', '&')
    text = text.replace('\\u0027', "'")
    text = text.replace('\\u0022', '"')
    text = text.replace('\\u003C', '<')
    text = text.replace('\\u003E', '>')
    text = text.replace('\\u002F', '/')
    
    # Remove HTML tags
    text = re.sub(r'<[^>]+>', '', text)
    
    # Clean whitespace
    text = ' '.join(text.split())
    
    return text

def extract_from_html_response(html_content):
    """Extract video information from HTML response"""
    formats = []
    video_info = {
        'title': 'Unknown Title',
        'description': '',
        'thumbnail': '',
        'duration': 0,
        'views': '0',
        'uploadDate': '',
        'author': 'Unknown Author',
        'videoId': ''
    }
    
    try:
        # Parse HTML with BeautifulSoup
        soup = BeautifulSoup(html_content, 'html.parser')
        
        # Extract title
        title_patterns = [
            soup.find('title'),
            soup.find('meta', {'name': 'title'}),
            soup.find('meta', {'property': 'og:title'}),
            soup.find('h1', {'class': 'title'}),
        ]
        
        for pattern in title_patterns:
            if pattern and pattern.get_text():
                title = clean_text(pattern.get_text())
                if title and 'YouTube' not in title:
                    video_info['title'] = title.replace(' - YouTube', '').strip()
                    break
        
        # Extract description
        description_patterns = [
            soup.find('meta', {'name': 'description'}),
            soup.find('meta', {'property': 'og:description'}),
            soup.find('div', {'id': 'description'}),
        ]
        
        for pattern in description_patterns:
            if pattern:
                if hasattr(pattern, 'get_text'):
                    description = clean_text(pattern.get_text())
                else:
                    description = clean_text(pattern.get('content', ''))
                if description:
                    video_info['description'] = description
                    break
        
        # Extract thumbnail
        thumbnail_patterns = [
            soup.find('meta', {'property': 'og:image'}),
            soup.find('meta', {'name': 'twitter:image'}),
            soup.find('link', {'rel': 'image_src'}),
        ]
        
        for pattern in thumbnail_patterns:
            if pattern:
                thumbnail = pattern.get('content', '')
                if thumbnail:
                    video_info['thumbnail'] = thumbnail
                    break
        
        if not video_info['thumbnail']:
            video_info['thumbnail'] = 'https://img.youtube.com/vi/VIDEO_ID/maxresdefault.jpg'
        
        # Extract author
        author_patterns = [
            soup.find('meta', {'name': 'author'}),
            soup.find('meta', {'property': 'og:video:tag'}),
            soup.find('span', {'class': 'ytd-video-owner-renderer'}),
        ]
        
        for pattern in author_patterns:
            if pattern:
                if hasattr(pattern, 'get_text'):
                    author = clean_text(pattern.get_text())
                else:
                    author = clean_text(pattern.get('content', ''))
                if author and author != 'Unknown Author':
                    video_info['author'] = author
                    break
        
        # Extract views
        views_pattern = re.search(r'"viewCountText":{"runs":\[{"text":"([^"]+)"', html_content)
        if views_pattern:
            views_text = views_pattern.group(1)
            # Extract numbers from "1,234,567 views"
            views_match = re.search(r'([\d,]+)', views_text)
            if views_match:
                video_info['views'] = views_match.group(1).replace(',', '')
        
        # Extract duration
        duration_pattern = re.search(r'"lengthSeconds":"(\d+)"', html_content)
        if duration_pattern:
            video_info['duration'] = int(duration_pattern.group(1))
        
        # Extract upload date
        upload_date_pattern = re.search(r'"uploadDate":"([^"]+)"', html_content)
        if upload_date_pattern:
            video_info['uploadDate'] = upload_date_pattern.group(1)
        
        # Extract formats from streaming data
        streaming_data_pattern = re.search(r'"streamingData":\s*({[^}]+(?:{[^}]*}[^}]*)*})', html_content)
        if streaming_data_pattern:
            try:
                import json as json_module
                streaming_data_str = streaming_data_pattern.group(1)
                
                # Try to extract formats arrays
                formats_match = re.search(r'"formats":\s*(\[.*?\])', streaming_data_str)
                adaptive_formats_match = re.search(r'"adaptiveFormats":\s*(\[.*?\])', streaming_data_str)
                
                if formats_match or adaptive_formats_match:
                    formats_data = []
                    adaptive_formats_data = []
                    
                    if formats_match:
                        try:
                            formats_data = json_module.loads(formats_match.group(1))
                        except:
                            pass
                    
                    if adaptive_formats_match:
                        try:
                            adaptive_formats_data = json_module.loads(adaptive_formats_match.group(1))
                        except:
                            pass
                    
                    # Process regular formats (video+audio)
                    for format_data in formats_data:
                        if format_data.get('url'):
                            formats.append({
                                'itag': format_data.get('itag', 0),
                                'quality': format_data.get('quality', 'unknown'),
                                'qualityLabel': format_data.get('qualityLabel', format_data.get('quality', 'unknown')),
                                'mimeType': format_data.get('mimeType', 'video/mp4'),
                                'container': format_data.get('mimeType', 'video/mp4').split('/')[1].split(';')[0] if format_data.get('mimeType') else 'mp4',
                                'hasVideo': True,
                                'hasAudio': True,
                                'width': format_data.get('width'),
                                'height': format_data.get('height'),
                                'bitrate': format_data.get('bitrate'),
                                'audioBitrate': format_data.get('audioBitrate'),
                                'url': format_data.get('url')
                            })
                    
                    # Process adaptive formats (video-only or audio-only)
                    for format_data in adaptive_formats_data:
                        if format_data.get('url'):
                            formats.append({
                                'itag': format_data.get('itag', 0),
                                'quality': format_data.get('quality', 'unknown'),
                                'qualityLabel': format_data.get('qualityLabel', format_data.get('quality', 'unknown')),
                                'mimeType': format_data.get('mimeType', 'video/mp4'),
                                'container': format_data.get('mimeType', 'video/mp4').split('/')[1].split(';')[0] if format_data.get('mimeType') else 'mp4',
                                'hasVideo': format_data.get('hasVideo', False),
                                'hasAudio': format_data.get('hasAudio', False),
                                'width': format_data.get('width'),
                                'height': format_data.get('height'),
                                'bitrate': format_data.get('bitrate'),
                                'audioBitrate': format_data.get('audioBitrate'),
                                'url': format_data.get('url')
                            })
            except Exception as e:
                print(f"Error parsing streaming data: {e}")
        
        # If no formats found, create fallback formats
        if not formats:
            formats = create_fallback_formats(video_info['duration'])
    
    except Exception as e:
        print(f"Error extracting from HTML: {e}")
        formats = create_fallback_formats(video_info['duration'])
    
    return video_info, formats

def create_fallback_formats(duration):
    """Create comprehensive fallback format list"""
    formats = []
    
    # Video-only formats
    video_formats = [
        {'itag': 160, 'quality': '144p', 'qualityLabel': '144p', 'width': 256, 'height': 144, 'bitrate': 100, 'audioBitrate': 0},
        {'itag': 133, 'quality': '240p', 'qualityLabel': '240p', 'width': 426, 'height': 240, 'bitrate': 200, 'audioBitrate': 0},
        {'itag': 134, 'quality': '360p', 'qualityLabel': '360p', 'width': 640, 'height': 360, 'bitrate': 500, 'audioBitrate': 0},
        {'itag': 135, 'quality': '480p', 'qualityLabel': '480p', 'width': 854, 'height': 480, 'bitrate': 800, 'audioBitrate': 0},
        {'itag': 136, 'quality': '720p', 'qualityLabel': '720p', 'width': 1280, 'height': 720, 'bitrate': 1500, 'audioBitrate': 0},
        {'itag': 137, 'quality': '1080p', 'qualityLabel': '1080p', 'width': 1920, 'height': 1080, 'bitrate': 3000, 'audioBitrate': 0},
        {'itag': 298, 'quality': '1440p', 'qualityLabel': '1440p', 'width': 2560, 'height': 1440, 'bitrate': 6000, 'audioBitrate': 0},
        {'itag': 299, 'quality': '2160p', 'qualityLabel': '2160p', 'width': 3840, 'height': 2160, 'bitrate': 12000, 'audioBitrate': 0},
        {'itag': 302, 'quality': '2160p60', 'qualityLabel': '2160p60', 'width': 3840, 'height': 2160, 'bitrate': 15000, 'audioBitrate': 0},
        {'itag': 303, 'quality': '4320p', 'qualityLabel': '4320p', 'width': 7680, 'height': 4320, 'bitrate': 20000, 'audioBitrate': 0},
    ]
    
    # Audio-only formats
    audio_formats = [
        {'itag': 139, 'quality': 'low', 'qualityLabel': '48kbps', 'audioBitrate': 48},
        {'itag': 140, 'quality': 'medium', 'qualityLabel': '128kbps', 'audioBitrate': 128},
        {'itag': 141, 'quality': 'high', 'qualityLabel': '256kbps', 'audioBitrate': 256},
        {'itag': 251, 'quality': 'very_high', 'qualityLabel': '160kbps', 'audioBitrate': 160},
        {'itag': 256, 'quality': 'ultra_high', 'qualityLabel': '256kbps', 'audioBitrate': 256},
        {'itag': 325, 'quality': 'master', 'qualityLabel': '320kbps', 'audioBitrate': 320},
    ]
    
    # Combined video+audio formats
    combined_formats = [
        {'itag': 18, 'quality': '360p', 'qualityLabel': '360p', 'width': 640, 'height': 360, 'bitrate': 500, 'audioBitrate': 128},
        {'itag': 22, 'quality': '720p', 'qualityLabel': '720p', 'width': 1280, 'height': 720, 'bitrate': 1500, 'audioBitrate': 192},
        {'itag': 394, 'quality': '144p', 'qualityLabel': '144p', 'width': 256, 'height': 144, 'bitrate': 100, 'audioBitrate': 48},
        {'itag': 395, 'quality': '240p', 'qualityLabel': '240p', 'width': 426, 'height': 240, 'bitrate': 200, 'audioBitrate': 48},
        {'itag': 396, 'quality': '360p', 'qualityLabel': '360p', 'width': 640, 'height': 360, 'bitrate': 500, 'audioBitrate': 96},
        {'itag': 397, 'quality': '480p', 'qualityLabel': '480p', 'width': 854, 'height': 480, 'bitrate': 800, 'audioBitrate': 96},
        {'itag': 398, 'quality': '720p', 'qualityLabel': '720p', 'width': 1280, 'height': 720, 'bitrate': 1500, 'audioBitrate': 128},
        {'itag': 399, 'quality': '1080p', 'qualityLabel': '1080p', 'width': 1920, 'height': 1080, 'bitrate': 3000, 'audioBitrate': 192},
        {'itag': 400, 'quality': '1440p', 'qualityLabel': '1440p', 'width': 2560, 'height': 1440, 'bitrate': 6000, 'audioBitrate': 256},
        {'itag': 401, 'quality': '2160p', 'qualityLabel': '2160p', 'width': 3840, 'height': 2160, 'bitrate': 12000, 'audioBitrate': 320},
        {'itag': 402, 'quality': '2160p60', 'qualityLabel': '2160p60', 'width': 3840, 'height': 2160, 'bitrate': 15000, 'audioBitrate': 320},
        {'itag': 403, 'quality': '4320p', 'qualityLabel': '4320p', 'width': 7680, 'height': 4320, 'bitrate': 20000, 'audioBitrate': 320},
    ]
    
    # Add video-only formats
    for format_data in video_formats:
        formats.append({
            'itag': format_data['itag'],
            'quality': format_data['quality'],
            'qualityLabel': format_data['qualityLabel'],
            'mimeType': 'video/mp4',
            'container': 'mp4',
            'hasVideo': True,
            'hasAudio': False,
            'width': format_data['width'],
            'height': format_data['height'],
            'bitrate': format_data['bitrate'],
            'audioBitrate': 0,
            'url': f'https://www.youtube.com/watch?v=VIDEO_ID&itag={format_data["itag"]}'
        })
    
    # Add audio-only formats
    for format_data in audio_formats:
        formats.append({
            'itag': format_data['itag'],
            'quality': format_data['quality'],
            'qualityLabel': format_data['qualityLabel'],
            'mimeType': 'audio/mp4',
            'container': 'm4a',
            'hasVideo': False,
            'hasAudio': True,
            'width': None,
            'height': None,
            'bitrate': 0,
            'audioBitrate': format_data['audioBitrate'],
            'url': f'https://www.youtube.com/watch?v=VIDEO_ID&itag={format_data["itag"]}'
        })
    
    # Add combined video+audio formats
    for format_data in combined_formats:
        formats.append({
            'itag': format_data['itag'],
            'quality': format_data['quality'],
            'qualityLabel': format_data['qualityLabel'],
            'mimeType': 'video/mp4',
            'container': 'mp4',
            'hasVideo': True,
            'hasAudio': True,
            'width': format_data['width'],
            'height': format_data['height'],
            'bitrate': format_data['bitrate'],
            'audioBitrate': format_data['audioBitrate'],
            'url': f'https://www.youtube.com/watch?v=VIDEO_ID&itag={format_data["itag"]}'
        })
    
    return formats

def get_video_info_with_yt_dlp(url):
    """Extract video info using yt-dlp if available"""
    try:
        # Try to install yt-dlp if not available
        try:
            import yt_dlp
        except ImportError:
            print("Installing yt-dlp...")
            # Install with timeout to prevent hanging in server environments
            result = subprocess.run([
                sys.executable, "-m", "pip", "install", "yt-dlp", "--user", "--timeout=60"
            ], timeout=120)  # 2-minute timeout for installation
            
            if result.returncode != 0:
                print("Failed to install yt-dlp")
                return None, None
                
            import yt_dlp
        
        ydl_opts = {
            'quiet': True,
            'no_warnings': True,
            'extract_flat': False,
            'skip_download': True,
            'user_agent': get_random_user_agent(),
            'headers': {
                'User-Agent': get_random_user_agent(),
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
                'Accept-Encoding': 'gzip, deflate, br',
                'Connection': 'keep-alive',
            },
            # Add timeouts to prevent hanging
            'socket_timeout': 30,
            'http_chunk_size': 10485760,  # 10MB
        }
        
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=False)
            
            if info:
                video_info = {
                    'title': info.get('title', 'Unknown Title'),
                    'description': info.get('description', ''),
                    'thumbnail': info.get('thumbnail', ''),
                    'duration': info.get('duration', 0),
                    'views': str(info.get('view_count', '0')),
                    'uploadDate': info.get('upload_date', ''),
                    'author': info.get('uploader', 'Unknown Author'),
                    'videoId': info.get('id', ''),
                }
                
                formats = []
                for format_data in info.get('formats', []):
                    # Skip formats that don't have a URL (may be unavailable)
                    if not format_data.get('url'):
                        continue
                        
                    formats.append({
                        'itag': format_data.get('format_id', 0),
                        'quality': format_data.get('quality', 'unknown'),
                        'qualityLabel': format_data.get('format_note', format_data.get('quality', 'unknown')),
                        'mimeType': format_data.get('ext', 'video/mp4'),
                        'container': format_data.get('ext', 'mp4'),
                        'hasVideo': format_data.get('vcodec', 'none') != 'none',
                        'hasAudio': format_data.get('acodec', 'none') != 'none',
                        'width': format_data.get('width'),
                        'height': format_data.get('height'),
                        'bitrate': format_data.get('tbr'),
                        'audioBitrate': format_data.get('abr'),
                        'url': format_data.get('url', '')
                    })
                
                return video_info, formats
    
    except subprocess.TimeoutExpired:
        print("yt-dlp installation timed out")
    except Exception as e:
        print(f"yt-dlp extraction failed: {e}")
    
    return None, None

def get_video_info_with_requests(url):
    """Extract video info using requests and BeautifulSoup"""
    try:
        video_id = extract_video_id(url)
        if not video_id:
            return None, None
        
        headers = {
            'User-Agent': get_random_user_agent(),
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept-Encoding': 'gzip, deflate, br',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
        }
        
        response = requests.get(f'https://www.youtube.com/watch?v={video_id}', headers=headers, timeout=30)
        
        if response.status_code == 200:
            video_info, formats = extract_from_html_response(response.text)
            video_info['videoId'] = video_id
            return video_info, formats
    
    except requests.exceptions.Timeout:
        print("Request timed out")
    except Exception as e:
        print(f"Requests extraction failed: {e}")
    
    return None, None

def get_video_info_comprehensive(url):
    """Get video info using multiple methods"""
    print(f"Extracting video info for: {url}")
    
    # Method 1: Try yt-dlp first (most reliable)
    print("Trying yt-dlp extraction...")
    video_info, formats = get_video_info_with_yt_dlp(url)
    if video_info and formats:
        print("✓ yt-dlp extraction successful")
        return video_info, formats
    
    # Method 2: Try requests + BeautifulSoup
    print("Trying requests + BeautifulSoup extraction...")
    video_info, formats = get_video_info_with_requests(url)
    if video_info and formats:
        print("✓ Requests extraction successful")
        return video_info, formats
    
    # Method 3: Fallback to basic info
    print("Using fallback format extraction...")
    video_id = extract_video_id(url)
    if video_id:
        video_info = {
            'title': 'Unknown Title',
            'description': '',
            'thumbnail': f'https://img.youtube.com/vi/{video_id}/maxresdefault.jpg',
            'duration': 0,
            'views': '0',
            'uploadDate': '',
            'author': 'Unknown Author',
            'videoId': video_id,
        }
        formats = create_fallback_formats(0)
        print("✓ Fallback extraction successful")
        return video_info, formats
    
    return None, None

def main():
    """Main function to handle command line arguments"""
    if len(sys.argv) != 2:
        print("Usage: python get_video_info.py <youtube_url>")
        print("Example: python get_video_info.py 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'")
        sys.exit(1)
    
    url = sys.argv[1]
    
    # Install required packages
    if not install_required_packages():
        print("ERROR: Could not install required packages")
        result = {
            'success': False,
            'error': 'Failed to install required packages',
            'method': 'Python extraction'
        }
        print(json.dumps(result, indent=2))
        sys.exit(1)
    
    try:
        # Get video info
        video_info, formats = get_video_info_comprehensive(url)
        
        if video_info and formats:
            result = {
                'success': True,
                'videoInfo': video_info,
                'formats': formats,
                'method': 'Python extraction'
            }
            
            print(json.dumps(result, indent=2))
            sys.exit(0)
        else:
            result = {
                'success': False,
                'error': 'Failed to extract video information',
                'method': 'Python extraction'
            }
            
            print(json.dumps(result, indent=2))
            sys.exit(1)
    except Exception as e:
        result = {
            'success': False,
            'error': f'Python script error: {str(e)}',
            'method': 'Python extraction'
        }
        
        print(json.dumps(result, indent=2))
        sys.exit(1)

if __name__ == "__main__":
    main()