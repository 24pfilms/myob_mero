import os
import requests
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

API_KEY = os.getenv('OPENROUTER_API_KEY')
API_BASE = "https://openrouter.ai/api/v1"
CHAT_MODEL = "anthropic/claude-sonnet-4"
EMBEDDING_MODEL = "anthropic/claude-sonnet-4"

def test_chat_completion():
    """Test if chat completion API is working"""
    print("\nTesting Chat Completion API...")
    print("-" * 40)
    
    try:
        response = requests.post(
            f"{API_BASE}/chat/completions",
            headers={
                "Authorization": f"Bearer {API_KEY}",
                "HTTP-Referer": "http://localhost:8000",
                "Content-Type": "application/json"
            },
            json={
                "model": CHAT_MODEL,
                "messages": [{"role": "user", "content": "Say hi!"}]
            }
        )
        
        print(f"Status Code: {response.status_code}")
        print(f"Content Type: {response.headers.get('content-type', 'unknown')}")
        
        if response.status_code == 200:
            data = response.json()
            message = data['choices'][0]['message']['content']
            print("\nResponse:")
            print(f"✅ {message}")
        else:
            print("\nError Response:")
            print(response.text)
            
    except Exception as e:
        print(f"❌ Error: {e}")

def test_embedding():
    """Test if embedding API is working"""
    print("\nTesting Embedding API...")
    print("-" * 40)
    
    try:
        response = requests.post(
            f"{API_BASE}/embeddings",
            headers={
                "Authorization": f"Bearer {API_KEY}",
                "HTTP-Referer": "http://localhost:8000",
                "Content-Type": "application/json"
            },
            json={
                "model": EMBEDDING_MODEL,
                "input": "Test embedding"
            }
        )
        
        print(f"Status Code: {response.status_code}")
        print(f"Content Type: {response.headers.get('content-type', 'unknown')}")
        
        if response.status_code == 200:
            data = response.json()
            embedding = data['data'][0]['embedding']
            print(f"\n✅ Got embedding vector of length: {len(embedding)}")
        else:
            print("\nError Response:")
            print(response.text)
            
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == '__main__':
    print(f"Using API Key: {API_KEY[:10]}...")
    test_chat_completion()
    test_embedding()