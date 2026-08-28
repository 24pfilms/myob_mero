import requests
import os
from dotenv import load_dotenv

load_dotenv(override=True)

OPENROUTER_API_KEY = os.getenv('OPENROUTER_API_KEY')
API_BASE_URL = "https://openrouter.ai/api/v1"

print(f"Key loaded: {OPENROUTER_API_KEY is not None}")
print(f"Key starts with: {OPENROUTER_API_KEY[:15] if OPENROUTER_API_KEY else 'None'}")
print(f"Key length: {len(OPENROUTER_API_KEY) if OPENROUTER_API_KEY else 0}")
print()

# Test with minimal request
try:
    response = requests.post(
        f"{API_BASE_URL}/chat/completions",
        headers={
            "Authorization": f"Bearer {OPENROUTER_API_KEY}",
            "HTTP-Referer": "http://localhost:8080",
            "X-Title": "MyOb AI Assistant",
        },
        json={
            "model": "google/gemini-2.5-flash",  # Try configured model
            "messages": [{"role": "user", "content": "Hello"}],
        }
    )
    print(f"Status code: {response.status_code}")
    print(f"Response: {response.text[:500]}")
except Exception as e:
    print(f"Error: {e}")
