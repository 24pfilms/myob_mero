import requests
import math

from security import get_ai_credential
from local_embeddings import get_local_embedding_provider

API_BASE_URL = "https://openrouter.ai/api/v1"
CHAT_MODEL = "anthropic/claude-3.5-sonnet"  # Replaced by OAuth Codex transport in the integration path

def get_embedding(text: str):
    """Generate a validated local embedding vector for a non-empty text."""
    return get_local_embedding_provider().embed_documents([text])[0]

def cosine_similarity(vec1, vec2):
    """Calculate cosine similarity between two vectors."""
    dot_product = sum(a * b for a, b in zip(vec1, vec2))
    magnitude1 = math.sqrt(sum(a * a for a in vec1))
    magnitude2 = math.sqrt(sum(b * b for b in vec2))
    if not magnitude1 or not magnitude2:
        return 0
    return dot_product / (magnitude1 * magnitude2)


def generate_summary(content: str, max_length: str = "medium") -> str:
    """
    Generate AI summary of content using Claude.
    
    Args:
        content: Text content to summarize
        max_length: Summary length - "brief" (1 paragraph), "medium" (2-3 paragraphs), "detailed" (4-5 paragraphs)
        
    Returns:
        Summary text
    """
    # Truncate content if too long (Claude has token limits)
    max_content_chars = 15000
    if len(content) > max_content_chars:
        content = content[:max_content_chars] + "..."
    
    # Adjust prompt based on length
    length_instructions = {
        "brief": "Provide a concise 1-paragraph summary (3-4 sentences).",
        "medium": "Provide a 2-3 paragraph summary covering the main points.",
        "detailed": "Provide a detailed 4-5 paragraph summary with key insights and takeaways."
    }
    
    instruction = length_instructions.get(max_length, length_instructions["medium"])
    
    prompt = f"""
You are an expert content summarizer. Analyze the following content and create a high-quality summary.

{instruction}

Focus on:
- Main ideas and key concepts
- Important facts or arguments
- Practical insights or takeaways
- Context and significance

Write in clear, direct language. Do not add commentary about the summary itself.

CONTENT:
---
{content}
---

SUMMARY:
"""
    
    response = requests.post(
        f"{API_BASE_URL}/chat/completions",
        headers={
            "Authorization": f"Bearer {get_ai_credential()}",
            "HTTP-Referer": "http://localhost:8080",
            "X-Title": "MyOb AI Assistant",
        },
        json={
            "model": CHAT_MODEL,
            "messages": [{"role": "user", "content": prompt}],
            "temperature": 0.3
        }
    )
    response.raise_for_status()
    return response.json()['choices'][0]['message']['content'].strip()


def generate_tags(content: str, title: str) -> list:
    """
    Generate relevant tags for content using Claude.
    
    Args:
        content: Text content to analyze
        title: Content title
        
    Returns:
        List of tag strings (lowercase, hyphenated)
    """
    # Truncate content if too long
    max_content_chars = 8000
    content_sample = content[:max_content_chars]
    
    prompt = f"""
You are an expert content tagger. Analyze the following content and generate 5-10 relevant tags.

Rules for tags:
- Use lowercase
- Use hyphens for multi-word tags (e.g., "machine-learning", "web-development")
- Be specific and descriptive
- Include topics, technologies, concepts, and themes
- Focus on searchable, useful tags

Return ONLY a JSON array of tag strings, no other text or formatting.
Example format: ["python", "data-science", "machine-learning", "tutorial"]

TITLE: {title}

CONTENT:
---
{content_sample}
---

TAGS (JSON array):
"""
    
    response = requests.post(
        f"{API_BASE_URL}/chat/completions",
        headers={
            "Authorization": f"Bearer {get_ai_credential()}",
            "HTTP-Referer": "http://localhost:8080",
            "X-Title": "MyOb AI Assistant",
        },
        json={
            "model": CHAT_MODEL,
            "messages": [{"role": "user", "content": prompt}],
            "temperature": 0.2
        }
    )
    response.raise_for_status()
    
    result = response.json()['choices'][0]['message']['content'].strip()
    
    # Parse JSON array
    import json as _json
    try:
        # Remove markdown code blocks if present
        if result.startswith('```'):
            result = result.split('\n', 1)[1]
            result = result.rsplit('```', 1)[0]
        
        tags = _json.loads(result)
        
        if isinstance(tags, list):
            # Clean and validate tags
            cleaned_tags = []
            for tag in tags:
                if isinstance(tag, str) and tag.strip():
                    # Ensure lowercase and remove extra spaces
                    clean_tag = tag.strip().lower()
                    if clean_tag not in cleaned_tags:
                        cleaned_tags.append(clean_tag)
            
            return cleaned_tags[:10]  # Limit to 10 tags
        
    except Exception as e:
        print(f"Warning: Failed to parse tags: {e}")
        # Fallback: return empty list
        return []
    
    return []


def generate_image(prompt: str, aspect_ratio: str = "1:1") -> dict:
    """
    Generate an image using Gemini 2.5 Flash Image model via OpenRouter.
    
    Args:
        prompt: Text description of the image to generate
        aspect_ratio: Image aspect ratio (1:1, 16:9, 9:16, 3:2, 2:3, 4:3, 3:4, 4:5, 5:4, 21:9)
        
    Returns:
        dict: {
            'image_data': base64 string,
            'mime_type': str (e.g., 'image/png'),
            'prompt': str,
            'aspect_ratio': str
        }
    """
    import json as _json
    
    # Validate aspect ratio
    valid_ratios = ["1:1", "2:3", "3:2", "3:4", "4:3", "4:5", "5:4", "9:16", "16:9", "21:9"]
    if aspect_ratio not in valid_ratios:
        aspect_ratio = "1:1"  # Default fallback
    
    IMAGE_MODEL = "google/gemini-2.5-flash-image"
    
    response = requests.post(
        f"{API_BASE_URL}/chat/completions",
        headers={
            "Authorization": f"Bearer {get_ai_credential()}",
            "HTTP-Referer": "http://localhost:8080",
            "X-Title": "MyOb AI Assistant",
        },
        json={
            "model": IMAGE_MODEL,
            "messages": [{"role": "user", "content": prompt}],
            "modalities": ["image", "text"],
            "image_config": {
                "aspect_ratio": aspect_ratio
            }
        }
    )
    response.raise_for_status()
    
    result = response.json()
    
    # Extract image data from response
    if result.get("choices") and len(result["choices"]) > 0:
        message = result["choices"][0].get("message", {})
        
        # Check for images in response
        if message.get("images") and len(message["images"]) > 0:
            image = message["images"][0]
            image_url = image["image_url"]["url"]
            
            # Extract base64 data and mime type
            # Format: data:image/png;base64,iVBORw0KGgo...
            if image_url.startswith("data:"):
                header, data = image_url.split(",", 1)
                mime_type = header.split(":")[1].split(";")[0]
                
                return {
                    "image_data": data,  # Base64 string without header
                    "mime_type": mime_type,
                    "prompt": prompt,
                    "aspect_ratio": aspect_ratio
                }
    
    # If no image found, raise error
    raise Exception("No image generated in response")
