#!/usr/bin/env python3
"""
YouTube Video Downloader using yt-dlp
Optimized for high-quality video and audio downloads with enhanced error handling
"""

import sys
import os
import subprocess
import json
import time
import tempfile
from urllib.parse import urlparse, parse_qs

def install_yt_dlp():
    """Install yt-dlp if not already installed with timeout for server environments"""
    try:
        import yt_dlp
        return True
    except ImportError:
        print("Installing yt-dlp...")
        try:
            # Install with timeout to prevent hanging in server environments
            result = subprocess.run([
                sys.executable, "-m", "pip", "install", "yt-dlp", "--user", "--timeout=60"
            ], timeout=120)  # 2-minute timeout for installation
            
            if result.returncode != 0:
                print(f"Failed to install yt-dlp with return code: {result.returncode}")
                return False
                
            import yt_dlp
            return True
        except subprocess.TimeoutExpired:
            print("Installation of yt-dlp timed out")
            return False
        except Exception as e:
            print(f"Failed to install yt-dlp: {e}")
            return False

def get_optimized_format_selection(format_code, is_audio_only=False):
    """Get optimized format selection for high-quality downloads"""
    
    # High-quality format mappings with fallbacks - PRIORITIZING HIGHEST QUALITY
    format_configs = {
        # Audio-only formats with quality prioritization (HIGHEST QUALITY FIRST)
        '140': '140/bestaudio[ext=m4a]/bestaudio',  # 128kbps AAC
        '141': '141/bestaudio[ext=m4a]/bestaudio',  # 256kbps AAC (HIGHER QUALITY)
        '251': '251/bestaudio[ext=webm]/bestaudio',  # 160kbps Opus
        '250': '250/bestaudio[ext=webm]/bestaudio',  # 70kbps Opus
        '249': '249/bestaudio[ext=webm]/bestaudio',  # 50kbps Opus
        '256': '256/bestaudio[ext=m4a]/bestaudio',   # 192kbps AAC (DASH)
        '325': '325/bestaudio[ext=m4a]/bestaudio',   # 320kbps AAC (MASTER QUALITY - HIGHEST)
        
        # Video formats with audio merging for high quality (HIGHEST QUALITY FIRST)
        '313': '313+325/best[height=2160][ext=mp4]/best[height=2160]',  # 4K video + MASTER AUDIO (HIGHEST QUALITY)
        '303': '303+325/best[height=2160][ext=webm]/best[height=2160]',  # 4K WebM + MASTER AUDIO
        '266': '266+325/best[height=1440][ext=mp4]/best[height=1440]',  # 1440p video + MASTER AUDIO
        '264': '264+325/best[height=1440][ext=webm]/best[height=1440]',  # 1440p WebM + MASTER AUDIO
        '137': '137+141/best[height=1080][ext=mp4]/best[height=1080]',  # 1080p video + HIGH AUDIO
        '248': '248+251/best[height=1080][ext=webm]/best[height=1080]',  # 1080p WebM + BEST AUDIO
        '136': '136+141/best[height=720][ext=mp4]/best[height=720]',    # 720p video + HIGH AUDIO
        '247': '247+251/best[height=720][ext=webm]/best[height=720]',    # 720p WebM + BEST AUDIO
        '135': '135+140/best[height=480][ext=mp4]/best[height=480]',    # 480p video + GOOD AUDIO
        '244': '244+251/best[height=480][ext=webm]/best[height=480]',    # 480p WebM + BEST AUDIO
        '134': '134+140/best[height=360][ext=mp4]/best[height=360]',    # 360p video + GOOD AUDIO
        '243': '243+251/best[height=360][ext=webm]/best[height=360]',    # 360p WebM + BEST AUDIO
        '133': '133+140/best[height=240][ext=mp4]/best[height=240]',    # 240p video + GOOD AUDIO
        '242': '242+251/best[height=240][ext=webm]/best[height=240]',    # 240p WebM + BEST AUDIO
        '160': '160+140/best[height=144][ext=mp4]/best[height=144]',    # 144p video + GOOD AUDIO
        '278': '278+251/best[height=144][ext=webm]/best[height=144]',    # 144p WebM + BEST AUDIO
        
        # Standard combined formats (video+audio) - HIGH QUALITY PRIORITIZED
        '22': '22/best[height<=720][ext=mp4]/best[height<=720]',         # 720p MP4 (HIGH QUALITY)
        '18': '18/best[height<=360][ext=mp4]/best[height<=360]',         # 360p MP4 (LOWER QUALITY)
    }
    
    # Default high-quality selection for unknown formats - PRIORITIZE HIGHEST QUALITY
    if format_code in format_configs:
        return format_configs[format_code]
    elif is_audio_only:
        # PRIORITIZE HIGHEST QUALITY AUDIO
        return 'bestaudio[ext=m4a]/bestaudio[ext=webm]/bestaudio[abr>256]/bestaudio[abr>192]/bestaudio[abr>160]/bestaudio[abr>128]/bestaudio'
    else:
        # PRIORITIZE HIGHEST QUALITY VIDEO
        return 'best[height>=2160][width>=3840]/best[height>=1440][width>=2560]/best[height>=1080][width>=1920]/best[height>=720][width>=1280]/best[height>=480][width>=854]/best[height>=360][width>=640]/best'

def download_video(url, format_code, output_path):
    """
    Download YouTube video using yt-dlp with optimizations for high quality
    
    Args:
        url (str): YouTube video URL
        format_code (str): Format code (itag)
        output_path (str): Output file path
    """
    
    # Ensure yt-dlp is installed
    if not install_yt_dlp():
        print("ERROR: Could not install yt-dlp")
        return False
    
    try:
        import yt_dlp
        
        # Extract video ID from URL
        parsed_url = urlparse(url)
        if 'youtube.com' in parsed_url.netloc:
            video_id = parse_qs(parsed_url.query).get('v', [None])[0]
        elif 'youtu.be' in parsed_url.netloc:
            video_id = parsed_url.path[1:]
        else:
            print(f"ERROR: Invalid YouTube URL: {url}")
            return False
        
        if not video_id:
            print(f"ERROR: Could not extract video ID from URL: {url}")
            return False
        
        print(f"Downloading video: {video_id}")
        print(f"Format: {format_code}")
        print(f"Output path: {output_path}")
        
        # Determine if this is audio-only format
        audio_only_formats = ['140', '141', '251', '250', '249', '256', '325']
        is_audio_only = format_code in audio_only_formats
        
        # Get optimized format selection
        format_selection = get_optimized_format_selection(format_code, is_audio_only)
        
        # Configure yt-dlp options optimized for high quality and speed
        ydl_opts = {
            # Format selection
            'format': format_selection,
            'outtmpl': output_path,
            
            # Performance optimizations
            'quiet': False,
            'no_warnings': False,
            'no_check_certificate': True,
            'no_color': False,
            
            # Audio extraction and processing
            'extractaudio': False,
            'audioformat': None,
            'audioquality': 0,  # Best quality
            
            # Post-processing for high quality
            'postprocessors': [],
            
            # Network optimizations
            'retries': 10,  # Increased retries for reliability
            'fragment_retries': 20,  # More retries for fragments
            'skip_unavailable_fragments': False,
            'concurrent_fragment_downloads': 3,  # Lower concurrent downloads for server stability
            'throttledratelimit': 100000,  # Limit download speed to avoid throttling
            
            # Timeout settings to prevent hanging
            'socket_timeout': 30,
            'timeout': 300,  # 5 minute overall timeout
            
            # User agent and headers for bypassing restrictions
            'user_agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'referer': 'https://www.youtube.com/',
            'headers': {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
                'Accept-Encoding': 'gzip, deflate, br',
                'Connection': 'keep-alive',
                'Upgrade-Insecure-Requests': '1',
                'Sec-Fetch-Dest': 'document',
                'Sec-Fetch-Mode': 'navigate',
                'Sec-Fetch-Site': 'none',
                'Sec-Fetch-User': '?1',
                'Cache-Control': 'max-age=0',
            },
            
            # Geo and proxy settings
            'force_ipv4': False,
            'geo_bypass': True,
            'geo_bypass_country': 'US',
            'geo_bypass_ip_blocklist': '',
            
            # Download speed optimizations
            'http_chunk_size': 10485760,  # 10MB chunks
            'buffer_size': 1024,
            'sleep_interval_requests': 1,  # Sleep between requests
            'sleep_interval': 1,  # Short sleep between requests
            'max_sleep_interval': 5,
            
            # Timeout settings
            'socket_timeout': 60,
            'source_address': None,
            
            # Metadata and thumbnail extraction
            'writeinfojson': False,
            'writethumbnail': False,
            'writesubtitles': False,
            'writeautomaticsub': False,
            
            # Progress hooks for monitoring
            'progress_hooks': [progress_hook],
        }
        
        # Add post-processors for audio-only formats to ensure proper encoding
def check_ffmpeg_availability():
    """Check if FFmpeg is available in the environment"""
    try:
        # Try different ways to check for FFmpeg
        for cmd in ['ffmpeg', 'ffmpeg.exe']:
            try:
                result = subprocess.run([cmd, '-version'], 
                                      capture_output=True, 
                                      check=True, 
                                      timeout=10)
                if result.returncode == 0:
                    print(f"FFmpeg found at: {cmd}")
                    return True
            except (subprocess.CalledProcessError, FileNotFoundError, subprocess.TimeoutExpired):
                continue
    except Exception as e:
        print(f"Error checking FFmpeg: {e}")
    
    print("WARNING: FFmpeg not available, skipping all post-processing")
    return False

    # ... (this function is inserted at the top level, after the install_yt_dlp function)
    
    # Check for FFmpeg availability
    ffmpeg_available = check_ffmpeg_availability()
    
    # Add post-processors based on FFmpeg availability
    if ffmpeg_available:
        if is_audio_only:
            ydl_opts['postprocessors'] = [
                {
                    'key': 'FFmpegExtractAudio',
                    'preferredcodec': 'm4a',
                    'preferredquality': '0',  # Best quality
                },
                {
                    'key': 'FFmpegMetadata',
                }
            ]
        else:
            # For video formats, ensure proper merging
            ydl_opts['postprocessors'] = [
                {
                    'key': 'FFmpegVideoConvertor',
                    'preferedformat': 'mp4',
                },
                {
                    'key': 'FFmpegMetadata',
                }
            ]
    else:
        # No post-processors when FFmpeg is not available
        ydl_opts['postprocessors'] = []
        
        # Add format-specific optimizations
        if format_code in ['313', '303', '266', '264']:  # 4K and 1440p
            ydl_opts['concurrent_fragment_downloads'] = 8  # More parallel downloads for high quality
            ydl_opts['throttledratelimit'] = 50000  # Lower throttling for high quality
        elif format_code in ['137', '248', '136', '247']:  # 1080p and 720p
            ydl_opts['concurrent_fragment_downloads'] = 6
            ydl_opts['throttledratelimit'] = 75000
        
        print(f"yt-dlp options: {ydl_opts}")
        
        # Create temp directory for fragments
        temp_dir = os.path.dirname(output_path)
        if not os.path.exists(temp_dir):
            os.makedirs(temp_dir)
        
        # Download the video
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            try:
                print(f"Starting download with format: {format_selection}")
                info = ydl.extract_info(url, download=True)
                
                # Verify download completion
                if os.path.exists(output_path) and os.path.getsize(output_path) > 0:
                    file_size = os.path.getsize(output_path)
                    print(f"Download completed successfully!")
                    print(f"Title: {info.get('title', 'Unknown')}")
                    print(f"Format: {info.get('format', 'Unknown')}")
                    print(f"File size: {file_size / (1024*1024):.2f} MB")
                    return True
                else:
                    print("ERROR: Download completed but file is missing or empty")
                    return False
                    
            except Exception as e:
                print(f"ERROR: Download failed: {e}")
                # Clean up partial files
                if os.path.exists(output_path):
                    try:
                        os.remove(output_path)
                    except:
                        pass
                return False
                
    except Exception as e:
        print(f"ERROR: {e}")
        return False

def progress_hook(d):
    """Progress hook for monitoring download progress"""
    if d['status'] == 'downloading':
        total_bytes = d.get('total_bytes', 0)
        downloaded_bytes = d.get('downloaded_bytes', 0)
        if total_bytes > 0:
            progress = (downloaded_bytes / total_bytes) * 100
            print(f"Download progress: {progress:.1f}% ({downloaded_bytes / (1024*1024):.1f}MB / {total_bytes / (1024*1024):.1f}MB)")
    elif d['status'] == 'finished':
        print("Download finished, now processing...")
    elif d['status'] == 'error':
        print("Download error occurred")

def main():
    """Main function to handle command line arguments"""
    if len(sys.argv) != 4:
        print("Usage: python download_video.py <youtube_url> <format_code> <output_path>")
        print("Example: python download_video.py 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' 18 output.mp4")
        sys.exit(1)
    
    url = sys.argv[1]
    format_code = sys.argv[2]
    output_path = sys.argv[3]
    
    # Add timestamp to output path to avoid conflicts
    base_name = os.path.splitext(output_path)[0]
    ext = os.path.splitext(output_path)[1]
    timestamped_output = f"{base_name}_{int(time.time())}{ext}"
    
    success = download_video(url, format_code, timestamped_output)
    
    if success:
        # Move to final location if different
        if timestamped_output != output_path:
            try:
                import shutil
                shutil.move(timestamped_output, output_path)
            except Exception as e:
                print(f"Warning: Could not move file: {e}")
        
        print(f"SUCCESS: Video downloaded to {output_path}")
        sys.exit(0)
    else:
        # Clean up any partial files
        if os.path.exists(timestamped_output):
            try:
                os.remove(timestamped_output)
            except:
                pass
        print("FAILED: Video download failed")
        sys.exit(1)

if __name__ == "__main__":
    main()
