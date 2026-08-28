"""
Alternative YouTube extractor using yt-dlp for more reliable extraction.
This handles cases where youtube-transcript-api fails.
"""

import re
import yt_dlp
import os
import subprocess
import json
from typing import Dict, Any, Optional

def extract_video_id(text: str) -> Optional[str]:
    """Extracts a YouTube video ID from various URL formats."""
    patterns = [
        r'(?:v=|/)([0-9A-Za-z_-]{11}).*',
        r'(?:youtu\.be/)([0-9A-Za-z_-]{11})'
    ]
    for pattern in patterns:
        match = re.search(pattern, text)
        if match:
            return match.group(1)
    return None

def get_video_info_ytdlp_cli(video_id: str) -> Dict[str, Any]:
    """
    Extract video information using yt-dlp CLI (more reliable).
    This avoids the format selection errors that occur with the Python API.
    """
    url = f'https://www.youtube.com/watch?v={video_id}'
    
    try:
        # Use yt-dlp CLI to dump JSON without downloading
        result = subprocess.run(
            ['yt-dlp', '--dump-json', '--skip-download', '--write-auto-sub', '--sub-lang', 'en', url],
            capture_output=True,
            text=True,
            timeout=30
        )
        
        if result.returncode != 0:
            raise Exception(f"yt-dlp command failed: {result.stderr}")
        
        info = json.loads(result.stdout)
        
        # Get title
        title = info.get('title', 'Unknown Title')
        
        # Get duration
        duration = info.get('duration', 0)
        
        # Get description
        description = info.get('description', '')
        
        # Try to get subtitles/captions
        subtitles = info.get('subtitles', {})
        automatic_captions = info.get('automatic_captions', {})
        
        # Prefer manual subtitles over automatic captions
        transcript_text = None
        
        if 'en' in subtitles:
            # Get manual English subtitles
            transcript_text = _extract_subtitle_text(subtitles['en'])
        elif 'en' in automatic_captions:
            # Fall back to automatic captions
            transcript_text = _extract_subtitle_text(automatic_captions['en'])
        else:
            # Try any available language
            for lang_subs in subtitles.values():
                transcript_text = _extract_subtitle_text(lang_subs)
                if transcript_text:
                    break
            
            if not transcript_text:
                for lang_caps in automatic_captions.values():
                    transcript_text = _extract_subtitle_text(lang_caps)
                    if transcript_text:
                        break
        
        if not transcript_text:
            raise Exception(f"No subtitles or captions available for video {video_id}")
        
        return {
            'video_id': video_id,
            'title': title,
            'duration': duration,
            'description': description,
            'transcript': transcript_text,
            'url': url
        }
        
    except subprocess.TimeoutExpired:
        raise Exception(f"Timeout extracting video info for {video_id}")
    except json.JSONDecodeError as e:
        raise Exception(f"Failed to parse yt-dlp output: {str(e)}")
    except Exception as e:
        raise Exception(f"Failed to extract video info: {str(e)}")

def get_video_info_ytdlp(video_id: str) -> Dict[str, Any]:
    """
    Extract video information including subtitles using yt-dlp Python API.
    More reliable than youtube-transcript-api.
    """
    url = f'https://www.youtube.com/watch?v={video_id}'
    
    ydl_opts = {
        'skip_download': True,
        'writesubtitles': True,
        'writeautomaticsub': True,
        'subtitleslangs': ['en'],
        'quiet': True,  # Suppress most output
        'no_warnings': True,
        'ignoreerrors': True,  # Continue on format errors
        'format': 'bestaudio/best',  # Just pick any audio format if needed
        'noplaylist': True,
    }
    
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            # Use extract_info with download=False to just get metadata
            info = None
            try:
                info = ydl.extract_info(url, download=False)
            except yt_dlp.utils.DownloadError:
                # Ignore download errors - we only need subtitle info
                # Try a second time with even simpler options
                ydl_opts_simple = {
                    'skip_download': True,
                    'quiet': True,
                    'no_warnings': True,
                    'ignoreerrors': True,
                }
                with yt_dlp.YoutubeDL(ydl_opts_simple) as ydl2:
                    info = ydl2.extract_info(url, download=False)
            
            if not info:
                raise Exception(f"Failed to extract video information for {video_id}")
            
            # Get title
            title = info.get('title', 'Unknown Title')
            
            # Get duration
            duration = info.get('duration', 0)
            
            # Get description
            description = info.get('description', '')
            
            # Try to get subtitles/captions
            subtitles = info.get('subtitles', {})
            automatic_captions = info.get('automatic_captions', {})
            
            # Prefer manual subtitles over automatic captions
            transcript_text = None
            
            if 'en' in subtitles:
                # Get manual English subtitles
                transcript_text = _extract_subtitle_text(subtitles['en'])
            elif 'en' in automatic_captions:
                # Fall back to automatic captions
                transcript_text = _extract_subtitle_text(automatic_captions['en'])
            else:
                # Try any available language
                for lang_subs in subtitles.values():
                    transcript_text = _extract_subtitle_text(lang_subs)
                    if transcript_text:
                        break
                
                if not transcript_text:
                    for lang_caps in automatic_captions.values():
                        transcript_text = _extract_subtitle_text(lang_caps)
                        if transcript_text:
                            break
            
            if not transcript_text:
                raise Exception(f"No subtitles or captions available for video {video_id}")
            
            return {
                'video_id': video_id,
                'title': title,
                'duration': duration,
                'description': description,
                'transcript': transcript_text,
                'url': url
            }
            
    except Exception as e:
        raise Exception(f"Failed to extract video info: {str(e)}")

def _extract_subtitle_text(subtitle_list: list) -> Optional[str]:
    """
    Extract text from subtitle data.
    yt-dlp provides subtitle URLs, we need to download and parse them.
    """
    import requests
    
    # Find the best format (prefer vtt or srv3)
    for sub_format in subtitle_list:
        ext = sub_format.get('ext', '')
        url = sub_format.get('url', '')
        
        if ext in ['vtt', 'srv3', 'srv2', 'srv1'] and url:
            try:
                response = requests.get(url, timeout=10)
                response.raise_for_status()
                
                # Parse VTT/SRV format to extract text
                lines = response.text.split('\n')
                text_lines = []
                
                for line in lines:
                    line = line.strip()
                    # Skip timestamps, empty lines, and metadata
                    if (not line or 
                        '-->' in line or 
                        line.startswith('WEBVTT') or
                        line.startswith('Kind:') or
                        line.startswith('Language:') or
                        line.isdigit()):
                        continue
                    
                    # Remove HTML tags
                    line = re.sub(r'<[^>]+>', '', line)
                    
                    if line:
                        text_lines.append(line)
                
                if text_lines:
                    return ' '.join(text_lines)
                    
            except Exception as e:
                print(f"Failed to download subtitle: {e}")
                continue
    
    return None

# Main functions that match youtube.py interface
def get_transcript(video_id: str) -> str:
    """Get transcript using yt-dlp. Compatible with youtube.py interface."""
    # Try CLI first (more reliable)
    try:
        info = get_video_info_ytdlp_cli(video_id)
        return info['transcript']
    except Exception as cli_error:
        # Fall back to Python API
        try:
            info = get_video_info_ytdlp(video_id)
            return info['transcript']
        except Exception as api_error:
            raise Exception(f"Both CLI and API failed. CLI: {str(cli_error)}, API: {str(api_error)}")

def get_video_title(video_id: str) -> str:
    """Get video title using yt-dlp. Compatible with youtube.py interface."""
    try:
        info = get_video_info_ytdlp_cli(video_id)
        return info['title']
    except:
        try:
            info = get_video_info_ytdlp(video_id)
            return info['title']
        except:
            return 'Unknown Title'
