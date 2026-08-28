#!/usr/bin/env python3
"""
Test script to verify base64 image encoding works correctly.
Tests the file_processor.py process_image() function.
"""

import base64
import os
import sys

# Add backend to path
sys.path.insert(0, os.path.dirname(__file__))

from file_processor import process_image

def create_test_image():
    """Create a tiny 1x1 pixel PNG for testing."""
    # Minimal valid PNG (1x1 red pixel)
    png_bytes = bytes([
        0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,  # PNG signature
        0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52,  # IHDR chunk
        0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,  # 1x1 dimensions
        0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53,
        0xDE, 0x00, 0x00, 0x00, 0x0C, 0x49, 0x44, 0x41,  # IDAT chunk
        0x54, 0x08, 0xD7, 0x63, 0xF8, 0xCF, 0xC0, 0x00,
        0x00, 0x03, 0x01, 0x01, 0x00, 0x18, 0xDD, 0x8D,
        0xB4, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E,  # IEND chunk
        0x44, 0xAE, 0x42, 0x60, 0x82
    ])
    return png_bytes

def test_base64_encoding():
    """Test basic base64 encoding/decoding."""
    print("Testing base64 module...")
    
    test_data = b"Hello, World!"
    encoded = base64.b64encode(test_data)
    decoded = base64.b64decode(encoded)
    
    assert decoded == test_data, "Base64 encoding/decoding failed!"
    print("✓ Base64 module works correctly")
    return True

def test_image_processing():
    """Test the file_processor.py image processing."""
    print("\nTesting file_processor.py image processing...")
    
    # Create test image
    image_bytes = create_test_image()
    print(f"  Created test PNG image ({len(image_bytes)} bytes)")
    
    # Process the image
    result = process_image(image_bytes, "test.png")
    
    # Validate result
    assert result['type'] == 'image', "Wrong type returned"
    assert result['filename'] == 'test.png', "Wrong filename"
    assert result['size'] == len(image_bytes), "Wrong size"
    assert 'markdown' in result, "No markdown in result"
    
    markdown = result['markdown']
    print(f"  Generated markdown: {markdown[:80]}...")
    
    # Check markdown format
    assert markdown.startswith('![test.png](data:image/'), "Wrong markdown format"
    assert 'base64,' in markdown, "Missing base64 marker"
    
    # Extract and validate base64 data
    start = markdown.find('base64,') + 7
    end = markdown.find(')')
    base64_data = markdown[start:end]
    
    print(f"  Base64 data length: {len(base64_data)} chars")
    
    # Try to decode it back
    decoded = base64.b64decode(base64_data)
    assert decoded == image_bytes, "Decoded image doesn't match original!"
    
    print("✓ Image processing works correctly")
    print(f"✓ Full markdown length: {len(markdown)} characters")
    return True

def test_multiple_formats():
    """Test different image formats."""
    print("\nTesting multiple image formats...")
    
    formats = ['test.png', 'test.jpg', 'test.jpeg', 'test.gif', 'test.webp']
    image_bytes = create_test_image()
    
    for filename in formats:
        result = process_image(image_bytes, filename)
        ext = filename.split('.')[-1]
        if ext == 'jpg':
            ext = 'jpeg'  # JPG gets converted to JPEG in MIME type
        
        assert f'data:image/{ext};base64,' in result['markdown'], \
            f"Wrong MIME type for {filename}"
        print(f"  ✓ {filename} -> correct MIME type")
    
    print("✓ All image formats work correctly")
    return True

def main():
    """Run all tests."""
    print("=" * 60)
    print("Base64 Image Processing Test Suite")
    print("=" * 60)
    print(f"Python version: {sys.version}")
    print()
    
    try:
        test_base64_encoding()
        test_image_processing()
        test_multiple_formats()
        
        print()
        print("=" * 60)
        print("✅ ALL TESTS PASSED!")
        print("=" * 60)
        print()
        print("The base64 image processing is working correctly.")
        print("If drag-and-drop isn't working, the issue is likely:")
        print("  1. Frontend not sending files correctly")
        print("  2. Backend endpoint not receiving files")
        print("  3. CORS or network issues")
        print()
        return 0
        
    except Exception as e:
        print()
        print("=" * 60)
        print("❌ TEST FAILED!")
        print("=" * 60)
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()
        return 1

if __name__ == '__main__':
    sys.exit(main())
