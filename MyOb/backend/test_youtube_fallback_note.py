#!/usr/bin/env python3
"""
Test that YouTube videos create notes even when transcript extraction fails
"""

import content_processor

# Test with a YouTube URL
test_url = "https://www.youtube.com/watch?v=dQw4w9WgXcQ"

print(f"Testing YouTube extraction with fallback for: {test_url}")
print("=" * 70)

try:
    result = content_processor.extract_content(test_url)
    
    print("✅ SUCCESS - YouTube note created!")
    print(f"\nTitle: {result['title']}")
    print(f"Content Type: {result['content_type']}")
    print(f"Source URL: {result['source_url']}")
    print(f"\nMetadata:")
    for key, value in result['metadata'].items():
        print(f"  {key}: {value}")
    
    print(f"\nContent Preview (first 500 chars):")
    print("-" * 70)
    print(result['content'][:500])
    print("-" * 70)
    
    if result['metadata'].get('transcript_available'):
        print("\n✅ Transcript was successfully extracted")
    else:
        print("\n⚠️ Transcript not available, but note was created with video info")
    
except Exception as e:
    print(f"❌ ERROR: {str(e)}")

print("\n" + "=" * 70)
