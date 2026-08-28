"""
Test script for image generation API
"""
import requests

# Test image generation endpoint
url = "http://localhost:8000/api/ai/generate-image"

payload = {
    "prompt": "A cute nano banana wearing sunglasses",
    "aspect_ratio": "1:1"
}

print("Testing image generation API...")
print(f"Prompt: {payload['prompt']}")
print(f"Aspect ratio: {payload['aspect_ratio']}")
print()

try:
    response = requests.post(url, json=payload)
    print(f"Status code: {response.status_code}")
    
    if response.status_code == 200:
        data = response.json()
        print(f"✅ Success!")
        print(f"   Image ID: {data.get('image_id')}")
        print(f"   MIME type: {data.get('mime_type')}")
        print(f"   Aspect ratio: {data.get('aspect_ratio')}")
        print(f"   Image data length: {len(data.get('image_data', ''))} chars")
    else:
        print(f"❌ Error: {response.text}")
        
except Exception as e:
    print(f"❌ Exception: {e}")
