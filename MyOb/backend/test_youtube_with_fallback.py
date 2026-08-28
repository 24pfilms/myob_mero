#!/usr/bin/env python3
"""
Test script for YouTube transcript extraction with yt-dlp fallback
"""

import youtube

# Test videos that should have transcripts/captions
# Using educational/tech content that typically has good caption support
test_cases = [
    {
        "name": "Python Tutorial (freeCodeCamp)",
        "url": "https://www.youtube.com/watch?v=rfscVS0vtbw"
    },
    {
        "name": "How the Internet Works (Computerphile)",
        "url": "https://www.youtube.com/watch?v=x3c1ih2NJEg"
    },
    {
        "name": "VSCode Tutorial",
        "url": "https://www.youtube.com/watch?v=WPqXP_kLzpo"
    }
]

print("Testing YouTube transcript extraction with yt-dlp fallback\n")
print("=" * 70)

for i, test in enumerate(test_cases, 1):
    print(f"\nTest {i}: {test['name']}")
    print(f"URL: {test['url']}")
    print("-" * 70)
    
    try:
        # Extract video ID from URL
        video_id = youtube.extract_video_id(test['url'])
        if not video_id:
            print(f"❌ FAILED: Could not extract video ID")
            continue
        
        # Get transcript only (without summarization for faster testing)
        transcript = youtube.get_transcript(video_id)
        title = youtube.get_video_title(video_id)
        
        if transcript:
            word_count = len(transcript.split())
            print(f"✅ SUCCESS")
            print(f"Title: {title}")
            print(f"Transcript length: {len(transcript)} chars, ~{word_count} words")
            print(f"Preview: {transcript[:200]}...")
        else:
            print(f"❌ FAILED: No transcript returned")
            
    except Exception as e:
        print(f"❌ ERROR: {str(e)}")

print("\n" + "=" * 70)
print("Test complete!")
