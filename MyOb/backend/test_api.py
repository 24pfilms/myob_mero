import os
import requests
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

def test_api_connection():
    """Test if OpenRouter API key is working"""
    
    api_key = os.getenv('OPENROUTER_API_KEY')
    print(f"API Key loaded: {'Yes' if api_key else 'No'}")
    
    if not api_key:
        print("❌ No API key found in environment variables")
        return False
        
    if api_key == "your_api_key_here":
        print("❌ API key not updated from placeholder value")
        return False
    
    print(f"API Key starts with: {api_key[:10]}...")
    
    # Test a simple embedding request
    print("\nTesting OpenRouter API connection...")
    
    try:
        response = requests.post(
            "https://openrouter.ai/api/v1/embeddings",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
                "HTTP-Referer": "http://localhost:8001",
                "X-Title": "AI Note System",
                "Accept": "application/json"
            },
            json={
                "model": "openai/text-embedding-3-small",
                "input": "Hello world test"
            },
            timeout=30
        )
        
        print(f"Status Code: {response.status_code}")
        print(f"Content-Type: {response.headers.get('content-type', 'unknown')}")
        print(f"Response preview: {response.text[:200]}...")
        
        if response.status_code == 200 and 'application/json' in response.headers.get('content-type', ''):
            data = response.json()
            print("✅ API connection successful!")
            print(f"Embedding dimensions: {len(data['data'][0]['embedding'])}")
            return True
        else:
            print(f"❌ API Error: {response.status_code}")
            print(f"Full Response: {response.text[:1000]}")
            return False
            
    except Exception as e:
        print(f"❌ Connection Error: {e}")
        return False

if __name__ == '__main__':
    test_api_connection()