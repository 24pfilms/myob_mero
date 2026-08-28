"""
Test script for content import API endpoints.

Tests quick import and bulk import functionality.
Run this after starting the backend server.
"""

import requests
import time
import json

BASE_URL = "http://localhost:8001"

def test_quick_import():
    """Test quick import endpoint."""
    print("\n" + "="*60)
    print("TEST 1: Quick Import (Wikipedia Article)")
    print("="*60)
    
    url = f"{BASE_URL}/api/content/import/quick"
    
    payload = {
        "url": "https://en.wikipedia.org/wiki/Python_(programming_language)",
        "generate_summary": True,
        "summary_length": "brief",
        "auto_tag": True
    }
    
    print(f"\nImporting: {payload['url']}")
    print("Options: summary=True, tags=True")
    
    try:
        response = requests.post(url, json=payload)
        response.raise_for_status()
        
        result = response.json()
        print(f"\n✓ Import successful!")
        print(f"  Note ID: {result['note_id']}")
        print(f"  Title: {result['title']}")
        print(f"  Type: {result['content_type']}")
        print(f"  Tags: {', '.join(result['tags'][:5])}...")
        print(f"  Has Summary: {result['has_summary']}")
        
        return result['note_id']
        
    except requests.exceptions.RequestException as e:
        print(f"\n✗ Import failed: {str(e)}")
        if hasattr(e, 'response') and e.response is not None:
            print(f"  Response: {e.response.text}")
        return None


def test_bulk_import():
    """Test bulk import endpoint."""
    print("\n" + "="*60)
    print("TEST 2: Bulk Import (Multiple Articles)")
    print("="*60)
    
    url = f"{BASE_URL}/api/content/import/bulk"
    
    payload = {
        "items": [
            {"url": "https://en.wikipedia.org/wiki/Machine_learning"},
            {"url": "https://en.wikipedia.org/wiki/Artificial_intelligence"},
            {"url": "https://github.com/python/cpython"}
        ],
        "generate_summary": True,
        "summary_length": "brief",
        "auto_tag": True
    }
    
    print(f"\nImporting {len(payload['items'])} items:")
    for item in payload['items']:
        print(f"  - {item['url']}")
    
    try:
        # Start bulk import
        response = requests.post(url, json=payload)
        response.raise_for_status()
        
        result = response.json()
        job_id = result['job_id']
        
        print(f"\n✓ Bulk import job started!")
        print(f"  Job ID: {job_id}")
        print(f"  Total items: {result['total_items']}")
        
        # Poll for status
        print("\nPolling for status...")
        status_url = f"{BASE_URL}/api/content/import/{job_id}/status"
        
        max_attempts = 60  # Wait up to 60 seconds
        for attempt in range(max_attempts):
            time.sleep(1)
            
            status_response = requests.get(status_url)
            status_response.raise_for_status()
            
            status = status_response.json()
            
            print(f"  [{attempt+1}s] Status: {status['status']} | "
                  f"Completed: {status['completed']}/{status['total']} | "
                  f"Failed: {status['failed']}")
            
            if status['status'] in ['completed', 'failed']:
                break
        
        # Final results
        print(f"\n✓ Job {status['status']}!")
        print(f"\nResults:")
        for item in status['results']:
            if item['status'] == 'success':
                print(f"  ✓ {item['title'][:50]}...")
                print(f"    Note ID: {item['note_id']}")
            else:
                print(f"  ✗ {item['url']}")
                print(f"    Error: {item['error']}")
        
        print(f"\nSummary: {status['completed']} succeeded, {status['failed']} failed")
        
        return status
        
    except requests.exceptions.RequestException as e:
        print(f"\n✗ Bulk import failed: {str(e)}")
        if hasattr(e, 'response') and e.response is not None:
            print(f"  Response: {e.response.text}")
        return None


def test_get_imported_note(note_id):
    """Test retrieving an imported note."""
    print("\n" + "="*60)
    print("TEST 3: Retrieve Imported Note")
    print("="*60)
    
    url = f"{BASE_URL}/api/notes/{note_id}"
    
    try:
        response = requests.get(url)
        response.raise_for_status()
        
        note = response.json()
        
        print(f"\n✓ Note retrieved!")
        print(f"  Title: {note['title']}")
        print(f"  Tags: {', '.join(note['tags'][:5])}...")
        print(f"  Content length: {len(note['content'])} characters")
        print(f"\n  First 200 characters:")
        print(f"  {note['content'][:200]}...")
        
        return note
        
    except requests.exceptions.RequestException as e:
        print(f"\n✗ Failed to retrieve note: {str(e)}")
        return None


def test_server_connection():
    """Test if server is running."""
    print("\n" + "="*60)
    print("TESTING SERVER CONNECTION")
    print("="*60)
    
    try:
        response = requests.get(f"{BASE_URL}/api/stats")
        response.raise_for_status()
        stats = response.json()
        
        print(f"\n✓ Server is running!")
        print(f"  Note count: {stats['note_count']}")
        print(f"  Video count: {stats['video_count']}")
        print(f"  Status: {stats['status']}")
        
        return True
        
    except requests.exceptions.RequestException as e:
        print(f"\n✗ Cannot connect to server!")
        print(f"  Error: {str(e)}")
        print(f"\nPlease make sure the backend server is running:")
        print(f"  cd {BASE_URL.replace('http://localhost:8001', 'backend')}")
        print(f"  python -m uvicorn app:app --reload")
        return False


def main():
    """Run all tests."""
    print("\n" + "="*60)
    print("CONTENT IMPORT API TESTS")
    print("="*60)
    
    # Test server connection
    if not test_server_connection():
        return
    
    # Test quick import
    note_id = test_quick_import()
    
    if note_id:
        # Test retrieving the note
        test_get_imported_note(note_id)
    
    # Test bulk import
    test_bulk_import()
    
    print("\n" + "="*60)
    print("ALL TESTS COMPLETE!")
    print("="*60)


if __name__ == "__main__":
    main()
