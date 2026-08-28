#!/usr/bin/env python3
"""
Test GitHub URL import to verify the import system works correctly
"""

import sys
import requests

# Test the quick import API endpoint
API_BASE = "http://localhost:5000"

test_url = "https://github.com/torvalds/linux"

print(f"Testing GitHub import with: {test_url}")
print("=" * 70)

try:
    response = requests.post(
        f"{API_BASE}/api/import/quick",
        json={"url": test_url},
        timeout=60
    )
    
    print(f"Status Code: {response.status_code}")
    
    if response.status_code == 200:
        result = response.json()
        print("✅ SUCCESS - GitHub import worked!")
        print(f"\nNote ID: {result.get('note_id')}")
        print(f"Title: {result.get('title')}")
        print(f"Content preview: {result.get('content', '')[:200]}...")
    else:
        print(f"❌ FAILED - Status {response.status_code}")
        print(f"Response: {response.text}")
        
except requests.exceptions.ConnectionError:
    print("❌ ERROR: Could not connect to backend server")
    print("Make sure the backend is running on http://localhost:5000")
    sys.exit(1)
except Exception as e:
    print(f"❌ ERROR: {str(e)}")
    sys.exit(1)

print("\n" + "=" * 70)
