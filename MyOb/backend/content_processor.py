"""
Content extraction and processing module for universal content import.

Supports:
- YouTube videos (transcript extraction)
- Web articles (using newspaper3k)
- PDF documents (text extraction)
- GitHub repositories (README extraction)
- Generic web pages (fallback extraction)
"""

import re
import requests
import os
from abc import ABC, abstractmethod
from datetime import datetime
from typing import Dict, Optional, List, Any
from io import BytesIO
import logging

# Third-party imports
from bs4 import BeautifulSoup
from newspaper import Article
from PyPDF2 import PdfReader
from dateutil import parser as date_parser

# Local imports
from youtube import extract_video_id, get_transcript, get_video_title

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class ContentExtractor(ABC):
    """Base class for all content extractors."""
    
    @abstractmethod
    def extract(self, source: str) -> Dict[str, Any]:
        """
        Extract content from the given source.
        
        Args:
            source: URL, file path, or content identifier
            
        Returns:
            Dict containing:
                - title: str
                - content: str (main content/body)
                - content_type: str (youtube, article, pdf, github, generic)
                - source_url: str (original source)
                - metadata: Dict (additional type-specific metadata)
                - extracted_at: datetime
        """
        pass


class YouTubeExtractor(ContentExtractor):
    """Extract YouTube video transcripts and metadata."""
    
    def extract(self, url: str) -> Dict[str, Any]:
        """Extract YouTube video transcript and metadata."""
        try:
            video_id = extract_video_id(url)
            if not video_id:
                raise ValueError(f"Could not extract video ID from URL: {url}")
            
            logger.info(f"Extracting YouTube video: {video_id}")
            
            # Get title first (usually works even if transcript fails)
            title = get_video_title(video_id)
            
            # Try to get transcript
            transcript = None
            transcript_error = None
            try:
                transcript = get_transcript(video_id)
                logger.info(f"Successfully extracted transcript for {video_id}")
            except Exception as e:
                transcript_error = str(e)
                logger.warning(f"Could not extract transcript for {video_id}: {transcript_error}")
            
            # If transcript extraction failed, create a note with basic info
            if not transcript:
                # Create content from video metadata
                content_parts = [
                    f"# {title}",
                    f"\n**Video URL:** {url}",
                    f"\n**Video ID:** {video_id}",
                    "\n## Transcript Not Available",
                    f"\nThe transcript could not be extracted from this video.",
                ]
                
                # Add error details if helpful
                if transcript_error:
                    if "429" in transcript_error or "Too Many Requests" in transcript_error:
                        content_parts.append("\n**Reason:** YouTube is temporarily rate-limiting transcript requests. Try again in a few minutes.")
                    elif "No subtitles" in transcript_error or "No transcripts available" in transcript_error:
                        content_parts.append("\n**Reason:** This video doesn't have captions or transcripts available.")
                    elif "Signature extraction failed" in transcript_error or "nsig extraction failed" in transcript_error:
                        content_parts.append("\n**Reason:** YouTube's security restrictions are currently blocking automated transcript extraction.")
                    else:
                        content_parts.append(f"\n**Technical Details:** {transcript_error[:200]}")
                
                content_parts.append("\n## How to Add Transcript")
                content_parts.append("\nYou can manually add the transcript by:")
                content_parts.append("1. Opening the video on YouTube")
                content_parts.append("2. Clicking the three dots (...) under the video")
                content_parts.append("3. Selecting 'Show transcript'")
                content_parts.append("4. Copying the transcript text")
                content_parts.append("5. Pasting it into this note")
                
                content = "\n".join(content_parts)
                
                return {
                    'title': title,
                    'content': content,
                    'content_type': 'youtube',
                    'source_url': f'https://www.youtube.com/watch?v={video_id}',
                    'metadata': {
                        'video_id': video_id,
                        'transcript_available': False,
                        'transcript_error': transcript_error
                    },
                    'extracted_at': datetime.utcnow().isoformat()
                }
            
            # Transcript extraction succeeded
            word_count = len(transcript.split())
            estimated_duration_minutes = word_count // 150  # ~150 words per minute
            
            return {
                'title': title,
                'content': transcript,
                'content_type': 'youtube',
                'source_url': f'https://www.youtube.com/watch?v={video_id}',
                'metadata': {
                    'video_id': video_id,
                    'word_count': word_count,
                    'estimated_duration_minutes': estimated_duration_minutes,
                    'transcript_available': True
                },
                'extracted_at': datetime.utcnow().isoformat()
            }
        except Exception as e:
            logger.error(f"YouTube extraction failed for {url}: {str(e)}")
            raise Exception(f"Failed to extract YouTube video: {str(e)}")


class ArticleExtractor(ContentExtractor):
    """Extract article content from web URLs using newspaper3k."""
    
    def extract(self, url: str) -> Dict[str, Any]:
        """Extract article content and metadata from web URL."""
        try:
            logger.info(f"Extracting article from: {url}")
            
            article = Article(url)
            article.download()
            article.parse()
            
            # Try to get publish date
            publish_date = None
            if article.publish_date:
                publish_date = article.publish_date.isoformat()
            
            # Get authors
            authors = article.authors if article.authors else []
            
            # Get article text
            content = article.text
            if not content:
                raise ValueError("Could not extract article text")
            
            title = article.title if article.title else "Untitled Article"
            
            # Calculate reading time (average 200 words per minute)
            word_count = len(content.split())
            reading_time_minutes = max(1, word_count // 200)
            
            return {
                'title': title,
                'content': content,
                'content_type': 'article',
                'source_url': url,
                'metadata': {
                    'authors': authors,
                    'publish_date': publish_date,
                    'top_image': article.top_image if article.top_image else None,
                    'word_count': word_count,
                    'reading_time_minutes': reading_time_minutes
                },
                'extracted_at': datetime.utcnow().isoformat()
            }
        except Exception as e:
            logger.error(f"Article extraction failed for {url}: {str(e)}")
            raise Exception(f"Failed to extract article: {str(e)}")


class PDFExtractor(ContentExtractor):
    """Extract text content from PDF files."""
    
    def extract(self, source: str) -> Dict[str, Any]:
        """
        Extract text from PDF file.
        
        Args:
            source: Can be a file path or URL to PDF
        """
        try:
            logger.info(f"Extracting PDF from: {source}")
            
            # Determine if source is URL or file path
            if source.startswith('http://') or source.startswith('https://'):
                # Download PDF from URL
                response = requests.get(source, timeout=30)
                response.raise_for_status()
                pdf_file = BytesIO(response.content)
                filename = source.split('/')[-1] or 'document.pdf'
            else:
                # Read from file path
                pdf_file = open(source, 'rb')
                filename = os.path.basename(source)
            
            # Extract text from PDF
            reader = PdfReader(pdf_file)
            page_count = len(reader.pages)
            
            text_content = []
            for page_num, page in enumerate(reader.pages, 1):
                try:
                    text = page.extract_text()
                    if text.strip():
                        text_content.append(text)
                except Exception as e:
                    logger.warning(f"Failed to extract text from page {page_num}: {str(e)}")
            
            full_text = "\n\n".join(text_content)
            
            if not full_text.strip():
                raise ValueError("No text could be extracted from PDF")
            
            # Try to get title from PDF metadata
            title = filename.replace('.pdf', '').replace('_', ' ').replace('-', ' ').title()
            if reader.metadata:
                if '/Title' in reader.metadata and reader.metadata['/Title']:
                    title = reader.metadata['/Title']
            
            # Calculate word count
            word_count = len(full_text.split())
            
            return {
                'title': title,
                'content': full_text,
                'content_type': 'pdf',
                'source_url': source,
                'metadata': {
                    'page_count': page_count,
                    'word_count': word_count,
                    'filename': filename
                },
                'extracted_at': datetime.utcnow().isoformat()
            }
        except Exception as e:
            logger.error(f"PDF extraction failed for {source}: {str(e)}")
            raise Exception(f"Failed to extract PDF: {str(e)}")
        finally:
            if isinstance(pdf_file, BytesIO):
                pdf_file.close()


class GitHubExtractor(ContentExtractor):
    """Extract README content from GitHub repositories."""
    
    def extract(self, url: str) -> Dict[str, Any]:
        """Extract README from GitHub repository."""
        try:
            logger.info(f"Extracting GitHub repository: {url}")
            
            # Parse GitHub URL to extract owner and repo
            # Format: https://github.com/owner/repo
            pattern = r'github\.com/([^/]+)/([^/]+)'
            match = re.search(pattern, url)
            
            if not match:
                raise ValueError(f"Invalid GitHub URL format: {url}")
            
            owner, repo = match.groups()
            # Remove .git suffix if present
            repo = repo.replace('.git', '')
            
            # Try to fetch README via GitHub API first
            api_url = f'https://api.github.com/repos/{owner}/{repo}/readme'
            headers = {'Accept': 'application/vnd.github.v3.raw'}
            
            # Add GitHub token if available
            github_token = os.getenv('GITHUB_TOKEN')
            if github_token:
                headers['Authorization'] = f'token {github_token}'
            
            response = requests.get(api_url, headers=headers, timeout=15)
            
            if response.status_code == 200:
                readme_content = response.text
            else:
                # Fallback: try to fetch raw README directly
                raw_url = f'https://raw.githubusercontent.com/{owner}/{repo}/main/README.md'
                response = requests.get(raw_url, timeout=15)
                
                if response.status_code != 200:
                    # Try master branch
                    raw_url = f'https://raw.githubusercontent.com/{owner}/{repo}/master/README.md'
                    response = requests.get(raw_url, timeout=15)
                
                if response.status_code != 200:
                    raise ValueError("Could not fetch README from repository")
                
                readme_content = response.text
            
            # Get repository metadata
            repo_api_url = f'https://api.github.com/repos/{owner}/{repo}'
            repo_response = requests.get(repo_api_url, timeout=15)
            
            description = ""
            topics = []
            stars = 0
            
            if repo_response.status_code == 200:
                repo_data = repo_response.json()
                description = repo_data.get('description', '')
                topics = repo_data.get('topics', [])
                stars = repo_data.get('stargazers_count', 0)
            
            title = f"{owner}/{repo}"
            if description:
                title += f" - {description}"
            
            return {
                'title': title,
                'content': readme_content,
                'content_type': 'github',
                'source_url': url,
                'metadata': {
                    'owner': owner,
                    'repo_name': repo,
                    'description': description,
                    'topics': topics,
                    'stars': stars
                },
                'extracted_at': datetime.utcnow().isoformat()
            }
        except Exception as e:
            logger.error(f"GitHub extraction failed for {url}: {str(e)}")
            raise Exception(f"Failed to extract GitHub repository: {str(e)}")


class GenericExtractor(ContentExtractor):
    """Generic web page content extractor (fallback)."""
    
    def extract(self, url: str) -> Dict[str, Any]:
        """Extract content from generic web page."""
        try:
            logger.info(f"Extracting generic content from: {url}")
            
            headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
            
            response = requests.get(url, headers=headers, timeout=15)
            response.raise_for_status()
            
            soup = BeautifulSoup(response.content, 'html.parser')
            
            # Extract title
            title = "Untitled Page"
            if soup.title and soup.title.string:
                title = soup.title.string.strip()
            
            # Try to extract meta description
            description = ""
            meta_desc = soup.find('meta', attrs={'name': 'description'})
            if meta_desc and meta_desc.get('content'):
                description = meta_desc.get('content')
            
            # Remove script and style elements
            for element in soup(['script', 'style', 'nav', 'header', 'footer', 'aside']):
                element.decompose()
            
            # Try to find main content
            main_content = None
            
            # Look for common content containers
            for selector in ['main', 'article', '[role="main"]', '.content', '#content']:
                main_content = soup.select_one(selector)
                if main_content:
                    break
            
            # Fallback to body if no main content found
            if not main_content:
                main_content = soup.body
            
            if not main_content:
                raise ValueError("Could not extract content from page")
            
            # Extract text
            text = main_content.get_text(separator='\n', strip=True)
            
            # Clean up excessive whitespace
            lines = [line.strip() for line in text.split('\n') if line.strip()]
            content = '\n\n'.join(lines)
            
            if not content:
                raise ValueError("No text content found on page")
            
            word_count = len(content.split())
            
            return {
                'title': title,
                'content': content,
                'content_type': 'generic',
                'source_url': url,
                'metadata': {
                    'description': description,
                    'word_count': word_count
                },
                'extracted_at': datetime.utcnow().isoformat()
            }
        except Exception as e:
            logger.error(f"Generic extraction failed for {url}: {str(e)}")
            raise Exception(f"Failed to extract content from page: {str(e)}")


def detect_content_type(url_or_path: str) -> ContentExtractor:
    """
    Detect content type and return appropriate extractor.
    
    Args:
        url_or_path: URL or file path to analyze
        
    Returns:
        Appropriate ContentExtractor instance
    """
    # YouTube detection
    if 'youtube.com' in url_or_path or 'youtu.be' in url_or_path:
        return YouTubeExtractor()
    
    # GitHub detection
    if 'github.com' in url_or_path:
        return GitHubExtractor()
    
    # PDF detection (file extension or URL)
    if url_or_path.lower().endswith('.pdf'):
        return PDFExtractor()
    
    # Check if it's a URL
    if url_or_path.startswith('http://') or url_or_path.startswith('https://'):
        # Try to detect PDF from Content-Type header
        try:
            response = requests.head(url_or_path, timeout=5, allow_redirects=True)
            content_type = response.headers.get('Content-Type', '').lower()
            
            if 'pdf' in content_type:
                return PDFExtractor()
        except Exception:
            pass
        
        # Default to article extractor for web URLs
        return ArticleExtractor()
    
    # File path
    if os.path.exists(url_or_path):
        if url_or_path.lower().endswith('.pdf'):
            return PDFExtractor()
    
    # Fallback to generic extractor
    return GenericExtractor()


def extract_content(source: str) -> Dict[str, Any]:
    """
    Main entry point for content extraction.
    
    Automatically detects content type and extracts accordingly.
    
    Args:
        source: URL or file path
        
    Returns:
        Extracted content dict
    """
    extractor = detect_content_type(source)
    return extractor.extract(source)


def process_content_item(
    source: str,
    options: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """
    Complete content import pipeline.
    
    1. Extracts content from source
    2. Generates AI summary (if enabled)
    3. Generates tags (if enabled)
    4. Returns note-ready data
    
    Args:
        source: URL or file path
        options: Dict with:
            - generate_summary: bool (default True)
            - summary_length: str ('brief', 'medium', 'detailed', default 'medium')
            - auto_tag: bool (default True)
            - custom_title: Optional[str] (override extracted title)
            
    Returns:
        Dict ready for note creation with:
            - title: str
            - content: str (full extracted content)
            - summary: Optional[str]
            - tags: List[str]
            - content_type: str
            - source_url: str
            - metadata: Dict
            - extracted_at: str
    """
    # Default options
    if options is None:
        options = {}
    
    generate_summary_flag = options.get('generate_summary', True)
    summary_length = options.get('summary_length', 'medium')
    auto_tag = options.get('auto_tag', True)
    custom_title = options.get('custom_title')
    
    logger.info(f"Processing content item: {source}")
    logger.info(f"Options: summary={generate_summary_flag}, tags={auto_tag}")
    
    try:
        # Step 1: Extract content
        extracted = extract_content(source)
        
        # Override title if custom title provided
        if custom_title:
            extracted['title'] = custom_title
        
        # Initialize result
        result = {
            'title': extracted['title'],
            'content': extracted['content'],
            'content_type': extracted['content_type'],
            'source_url': extracted['source_url'],
            'metadata': extracted['metadata'],
            'extracted_at': extracted['extracted_at'],
            'summary': None,
            'tags': []
        }
        
        # Step 2: Generate summary (if enabled)
        if generate_summary_flag and extracted['content']:
            try:
                logger.info("Generating AI summary...")
                from ai import generate_summary
                result['summary'] = generate_summary(
                    extracted['content'],
                    max_length=summary_length
                )
                logger.info("Summary generated successfully")
            except Exception as e:
                logger.error(f"Failed to generate summary: {str(e)}")
                # Continue without summary
        
        # Step 3: Generate tags (if enabled)
        if auto_tag and extracted['content']:
            try:
                logger.info("Generating tags...")
                from ai import generate_tags
                result['tags'] = generate_tags(
                    extracted['content'],
                    extracted['title']
                )
                logger.info(f"Generated {len(result['tags'])} tags")
            except Exception as e:
                logger.error(f"Failed to generate tags: {str(e)}")
                # Continue without tags
        
        # Add content type to tags for easy filtering
        content_type_tag = f"{extracted['content_type']}-content"
        if content_type_tag not in result['tags']:
            result['tags'].insert(0, content_type_tag)
        
        logger.info(f"Content processing complete: {result['title'][:50]}...")
        return result
        
    except Exception as e:
        logger.error(f"Content processing failed: {str(e)}")
        raise
