"""
Test script for file upload endpoint.
Tests all supported file types: images, JSON, code, CSV, markdown.
"""

import requests
import json
import base64
from pathlib import Path

API_URL = "http://localhost:8001/api/upload"

def create_test_files():
    """Create test files for upload testing."""
    test_dir = Path("test_files")
    test_dir.mkdir(exist_ok=True)
    
    # 1. Create test image (PNG)
    # Simple 1x1 red pixel PNG
    png_data = base64.b64decode(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg=="
    )
    (test_dir / "test_image.png").write_bytes(png_data)
    
    # 2. Create test JSON
    json_data = {
        "name": "Test Data",
        "values": [1, 2, 3, 4, 5],
        "metadata": {
            "created": "2025-01-09",
            "author": "Test User"
        }
    }
    (test_dir / "test_data.json").write_text(json.dumps(json_data, indent=2))
    
    # 3. Create test Python code
    python_code = '''def hello_world():
    """Print a greeting."""
    print("Hello, World!")
    return "Success"

if __name__ == "__main__":
    hello_world()
'''
    (test_dir / "test_script.py").write_text(python_code)
    
    # 4. Create test CSV
    csv_data = """Name,Age,City
Alice,30,New York
Bob,25,Los Angeles
Charlie,35,Chicago
Diana,28,Houston"""
    (test_dir / "test_data.csv").write_text(csv_data)
    
    # 5. Create test Markdown
    markdown_data = """# Test Markdown

This is a **test** markdown file with:

- Lists
- **Bold** text
- *Italic* text

## Code Example

```python
print("Hello from markdown!")
```

[Link to example](https://example.com)
"""
    (test_dir / "test_document.md").write_text(markdown_data)
    
    print("✓ Created test files in test_files/")
    return test_dir

def test_upload_file(file_path: Path):
    """Test uploading a single file."""
    print(f"\nTesting: {file_path.name}")
    print("-" * 50)
    
    try:
        with open(file_path, 'rb') as f:
            files = {'file': (file_path.name, f, 'application/octet-stream')}
            response = requests.post(API_URL, files=files)
        
        if response.status_code == 200:
            result = response.json()
            print(f"✓ SUCCESS")
            print(f"  Type: {result['type']}")
            print(f"  Size: {result['size']} bytes")
            print(f"  Markdown preview (first 200 chars):")
            print(f"  {result['markdown'][:200]}...")
            if result.get('metadata'):
                print(f"  Metadata: {result['metadata']}")
            return True
        else:
            print(f"✗ FAILED: {response.status_code}")
            print(f"  Error: {response.text}")
            return False
    except Exception as e:
        print(f"✗ EXCEPTION: {str(e)}")
        return False

def main():
    print("=" * 60)
    print("FILE UPLOAD ENDPOINT TEST")
    print("=" * 60)
    
    # Create test files
    test_dir = create_test_files()
    
    # Test each file type
    results = {}
    
    test_files = [
        "test_image.png",
        "test_data.json",
        "test_script.py",
        "test_data.csv",
        "test_document.md"
    ]
    
    for filename in test_files:
        file_path = test_dir / filename
        results[filename] = test_upload_file(file_path)
    
    # Summary
    print("\n" + "=" * 60)
    print("TEST SUMMARY")
    print("=" * 60)
    
    passed = sum(1 for v in results.values() if v)
    total = len(results)
    
    print(f"\nPassed: {passed}/{total}")
    
    for filename, success in results.items():
        status = "✓" if success else "✗"
        print(f"  {status} {filename}")
    
    if passed == total:
        print("\n🎉 All tests passed!")
    else:
        print(f"\n⚠️  {total - passed} test(s) failed")

if __name__ == "__main__":
    main()
