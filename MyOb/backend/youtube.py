import re
import requests
from youtube_transcript_api import YouTubeTranscriptApi

from security import get_ai_credential

# Import yt-dlp fallback
try:
    import youtube_ytdlp
    HAS_YTDLP = True
except ImportError:
    HAS_YTDLP = False

API_BASE_URL = "https://openrouter.ai/api/v1"
CHAT_MODEL = "anthropic/claude-sonnet-4"

def extract_video_id(text):
    """Extracts a YouTube video ID from various URL formats."""
    patterns = [
        r'(?:v=|\/)([0-9A-Za-z_-]{11}).*',
        r'(?:youtu\.be\/)([0-9A-Za-z_-]{11})'
    ]
    for pattern in patterns:
        match = re.search(pattern, text)
        if match:
            return match.group(1)
    return None

def find_youtube_videos(content):
    """Finds all unique YouTube video URLs in a block of text."""
    video_ids = set()
    for line in content.splitlines():
        video_id = extract_video_id(line)
        if video_id:
            video_ids.add(video_id)
            
    return [{
        'id': vid,
        'url': f'https://www.youtube.com/watch?v={vid}'
    } for vid in video_ids]

def get_transcript(video_id):
    """Fetches the transcript for a YouTube video with multiple language fallbacks."""
    try:
        # Try to get transcript in English first
        try:
            transcript_list = YouTubeTranscriptApi.get_transcript(video_id, languages=['en'])
        except:
            # If English fails, try to get any available transcript
            transcript_list = YouTubeTranscriptApi.list_transcripts(video_id)
            
            # Try to get the first available transcript
            try:
                transcript = transcript_list.find_generated_transcript(['en'])
                transcript_list = transcript.fetch()
            except:
                try:
                    # Try manual transcripts
                    transcript = transcript_list.find_manually_created_transcript(['en'])
                    transcript_list = transcript.fetch()
                except:
                    # Get any available transcript and translate if needed
                    available_transcripts = list(transcript_list)
                    if not available_transcripts:
                        raise Exception("No transcripts available for this video")
                    
                    first_transcript = available_transcripts[0]
                    try:
                        # Try to translate to English
                        translated = first_transcript.translate('en')
                        transcript_list = translated.fetch()
                    except:
                        # Use the transcript as-is
                        transcript_list = first_transcript.fetch()
        
        return " ".join([d['text'] for d in transcript_list])
    except Exception as e:
        # Try yt-dlp as fallback
        if HAS_YTDLP:
            try:
                print(f"youtube-transcript-api failed, trying yt-dlp fallback...")
                return youtube_ytdlp.get_transcript(video_id)
            except Exception as ytdlp_error:
                raise Exception(f"Both methods failed. Original: {str(e)}, Fallback: {str(ytdlp_error)}")
        else:
            raise Exception(f"Could not retrieve transcript for video ID {video_id}: {str(e)}")

def summarize_transcript(transcript, video_title):
    """Uses an LLM to summarize a video transcript."""
    prompt = f"""
You are an expert summarizer. Analyze the following transcript from the YouTube video titled "{video_title}" and provide a concise, structured summary.

Your summary should include:
1.  **Main Idea**: A single sentence that captures the core message of the video.
2.  **Key Takeaways**: 3-5 bullet points highlighting the most important concepts, arguments, or conclusions.
3.  **Actionable Advice**: If any, list 1-3 practical steps or advice the viewer can apply. If none, write "N/A".

Here is the transcript:
---
{transcript[:12000]}
---
"""
    response = requests.post(
        f"{API_BASE_URL}/chat/completions",
        headers={
            "Authorization": f"Bearer {get_ai_credential()}",
        },
        json={
            "model": CHAT_MODEL,
            "messages": [{"role": "user", "content": prompt}]
        }
    )
    response.raise_for_status()
    return response.json()['choices'][0]['message']['content']

def get_video_title(video_id):
    """Retrieves video title using YouTube's oEmbed endpoint."""
    try:
        response = requests.get(f"https://www.youtube.com/oembed?url=http://www.youtube.com/watch?v={video_id}&format=json")
        response.raise_for_status()
        return response.json().get('title', 'Unknown Title')
    except Exception:
        return 'Unknown Title'

def process_video(video_id):
    """Full pipeline: gets title, transcript, and summary for a video."""
    print(f"Processing video: {video_id}")
    title = get_video_title(video_id)
    transcript = get_transcript(video_id)
    summary = summarize_transcript(transcript, title)
    return {
        'title': title,
        'transcript': transcript,
        'summary': summary
    }