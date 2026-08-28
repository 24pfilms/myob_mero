"""
Test YouTube transcript extraction with various real videos.
This script tests the improved YouTube extractor.
"""

from youtube import extract_video_id, get_transcript, get_video_title

# Test videos that should have transcripts
test_videos = [
    # Rick Astley - Never Gonna Give You Up (very popular, definitely has transcript)
    "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    
    # TED Talk (usually have transcripts)
    "https://www.youtube.com/watch?v=8jPQjjsBbIc",
    
    # Short form
    "https://youtu.be/dQw4w9WgXcQ",
]

def test_video(url):
    """Test transcript extraction for a single video."""
    print(f"\n{'='*60}")
    print(f"Testing: {url}")
    print('='*60)
    
    try:
        video_id = extract_video_id(url)
        print(f"✓ Video ID extracted: {video_id}")
        
        title = get_video_title(video_id)
        print(f"✓ Title: {title}")
        
        transcript = get_transcript(video_id)
        word_count = len(transcript.split())
        print(f"✓ Transcript extracted: {word_count} words")
        print(f"  First 100 chars: {transcript[:100]}...")
        
        return True
    except Exception as e:
        print(f"✗ FAILED: {str(e)}")
        return False

def main():
    print("\n" + "="*60)
    print("YOUTUBE TRANSCRIPT EXTRACTION TEST")
    print("="*60)
    
    results = []
    for url in test_videos:
        success = test_video(url)
        results.append((url, success))
    
    print("\n" + "="*60)
    print("SUMMARY")
    print("="*60)
    
    successful = sum(1 for _, success in results if success)
    total = len(results)
    
    print(f"\nSuccessful: {successful}/{total}")
    
    for url, success in results:
        status = "✓" if success else "✗"
        print(f"{status} {url}")
    
    if successful == total:
        print("\n🎉 ALL TESTS PASSED!")
    elif successful > 0:
        print(f"\n⚠️  {total - successful} tests failed")
    else:
        print("\n❌ ALL TESTS FAILED")
    
    return successful == total

if __name__ == '__main__':
    success = main()
    exit(0 if success else 1)
