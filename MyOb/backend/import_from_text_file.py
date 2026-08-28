"""
Import URLs from a text file into MyOb.

This script parses a text file containing URLs (with optional titles)
and imports them using the bulk import API.

Usage:
    python import_from_text_file.py path/to/urls.txt

Text file format:
    Title Line (optional)
    https://url.com
    
    Another Title
    https://another-url.com
    
    https://standalone-url.com
"""

import sys
import requests
import time
from pathlib import Path
from typing import List, Dict, Optional


def parse_url_file(file_path: str) -> List[Dict[str, str]]:
    """
    Parse a text file containing URLs and optional titles.
    
    Format rules:
    - Blank lines are ignored
    - Lines starting with http:// or https:// are URLs
    - Non-blank line immediately before a URL is treated as title
    - URLs without preceding title get auto-generated titles
    
    Args:
        file_path: Path to text file
        
    Returns:
        List of dicts with 'url' and optional 'custom_title'
    """
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    lines = [line.strip() for line in content.split('\n')]
    items = []
    pending_title = None
    
    for line in lines:
        # Skip blank lines
        if not line:
            pending_title = None
            continue
        
        # Check if line is a URL
        if line.startswith('http://') or line.startswith('https://'):
            item = {'url': line}
            if pending_title:
                item['custom_title'] = pending_title
            items.append(item)
            pending_title = None
        else:
            # This is a potential title for the next URL
            pending_title = line
    
    return items


def import_urls(
    items: List[Dict[str, str]],
    folder_id: Optional[str] = None,
    generate_summary: bool = True,
    summary_length: str = 'brief',
    auto_tag: bool = True,
    base_url: str = 'http://localhost:8000'
) -> Dict:
    """
    Send bulk import request to MyOb backend.
    
    Args:
        items: List of URL items with optional custom_title
        folder_id: Optional folder UUID to import into
        generate_summary: Whether to generate AI summaries
        summary_length: 'brief', 'medium', or 'detailed'
        auto_tag: Whether to auto-generate tags
        base_url: Backend API base URL
        
    Returns:
        Response JSON with job_id
    """
    url = f"{base_url}/api/content/import/bulk"
    
    payload = {
        'items': items,
        'generate_summary': generate_summary,
        'summary_length': summary_length,
        'auto_tag': auto_tag
    }
    
    if folder_id:
        payload['folder_id'] = folder_id
    
    print(f"\n📤 Sending bulk import request...")
    print(f"   URL: {url}")
    print(f"   Items: {len(items)}")
    print(f"   Summary: {summary_length if generate_summary else 'disabled'}")
    print(f"   Tags: {'enabled' if auto_tag else 'disabled'}")
    
    response = requests.post(url, json=payload)
    response.raise_for_status()
    
    return response.json()


def poll_import_status(job_id: str, base_url: str = 'http://localhost:8000', max_wait: int = 600):
    """
    Poll the import job status until completion.
    
    Args:
        job_id: Import job ID
        base_url: Backend API base URL
        max_wait: Maximum seconds to wait (default 10 minutes)
    """
    url = f"{base_url}/api/content/import/{job_id}/status"
    
    print(f"\n📊 Polling import status...")
    print(f"   Job ID: {job_id}")
    print(f"   Max wait: {max_wait} seconds")
    print()
    
    start_time = time.time()
    
    while time.time() - start_time < max_wait:
        response = requests.get(url)
        response.raise_for_status()
        status = response.json()
        
        elapsed = int(time.time() - start_time)
        print(f"   [{elapsed}s] Status: {status['status']} | "
              f"Completed: {status['completed']}/{status['total']} | "
              f"Failed: {status['failed']}")
        
        if status['status'] in ['completed', 'failed']:
            return status
        
        time.sleep(2)  # Poll every 2 seconds
    
    raise TimeoutError(f"Import job timed out after {max_wait} seconds")


def display_results(status: Dict):
    """Display final import results."""
    print("\n" + "="*60)
    print(f"📊 IMPORT {status['status'].upper()}")
    print("="*60)
    
    print(f"\n✅ Succeeded: {status['completed'] - status['failed']}")
    print(f"❌ Failed: {status['failed']}")
    print(f"📊 Total: {status['total']}")
    
    print("\n📝 Results:")
    for item in status['results']:
        if item['status'] == 'success':
            print(f"   ✅ {item['title'][:60]}")
            print(f"      Note ID: {item['note_id']}")
            print(f"      Type: {item.get('content_type', 'unknown')}")
        else:
            print(f"   ❌ {item['url'][:60]}")
            print(f"      Error: {item.get('error', 'Unknown error')}")
        print()


def main():
    """Main script entry point."""
    if len(sys.argv) < 2:
        print("❌ Error: No file path provided")
        print()
        print("Usage:")
        print("    python import_from_text_file.py path/to/urls.txt")
        print()
        print("Example:")
        print("    python import_from_text_file.py ../my_urls.txt")
        sys.exit(1)
    
    file_path = sys.argv[1]
    
    # Check file exists
    if not Path(file_path).exists():
        print(f"❌ Error: File not found: {file_path}")
        sys.exit(1)
    
    print("="*60)
    print("📥 MyOb URL Import Tool")
    print("="*60)
    print(f"\n📄 Input file: {file_path}")
    
    # Parse file
    try:
        items = parse_url_file(file_path)
        print(f"\n✅ Parsed {len(items)} URLs from file")
        
        # Preview items
        print("\n📋 Preview:")
        for i, item in enumerate(items[:5], 1):  # Show first 5
            title = item.get('custom_title', '(auto-generated)')
            print(f"   {i}. {title}")
            print(f"      {item['url']}")
        
        if len(items) > 5:
            print(f"   ... and {len(items) - 5} more")
        
        if not items:
            print("\n❌ No URLs found in file!")
            print("\nExpected format:")
            print("   Title (optional)")
            print("   https://url.com")
            print()
            print("   Another Title")
            print("   https://another.com")
            sys.exit(1)
        
    except Exception as e:
        print(f"\n❌ Error parsing file: {e}")
        sys.exit(1)
    
    # Confirm import
    print("\n" + "="*60)
    print("⚙️  Import Options")
    print("="*60)
    print("   Generate AI Summary: Yes (brief)")
    print("   Auto-generate Tags: Yes")
    print("   Folder: Root (default)")
    print()
    
    response = input(f"Import {len(items)} URLs? [y/N]: ")
    if response.lower() != 'y':
        print("\n❌ Import cancelled")
        sys.exit(0)
    
    # Start import
    try:
        result = import_urls(items)
        job_id = result['job_id']
        
        print(f"\n✅ Bulk import job started!")
        print(f"   Job ID: {job_id}")
        
        # Poll for completion
        final_status = poll_import_status(job_id)
        
        # Display results
        display_results(final_status)
        
    except requests.exceptions.ConnectionError:
        print("\n❌ Error: Cannot connect to backend server")
        print("\nMake sure the backend is running:")
        print("   cd backend")
        print("   python runner.py")
        sys.exit(1)
        
    except Exception as e:
        print(f"\n❌ Error during import: {e}")
        sys.exit(1)


if __name__ == '__main__':
    main()
