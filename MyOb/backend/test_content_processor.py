"""
Test suite for content_processor.py

Tests all content extractors with real and mock data.
"""

import unittest
from unittest.mock import Mock, patch, MagicMock
from datetime import datetime
import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from content_processor import (
    YouTubeExtractor,
    ArticleExtractor,
    PDFExtractor,
    GitHubExtractor,
    GenericExtractor,
    detect_content_type,
    extract_content
)


class TestYouTubeExtractor(unittest.TestCase):
    """Test YouTube content extraction."""
    
    @patch('content_processor.get_video_title')
    @patch('content_processor.get_transcript')
    @patch('content_processor.extract_video_id')
    def test_youtube_extraction(self, mock_extract_id, mock_transcript, mock_title):
        """Test YouTube video extraction with mocked data."""
        # Setup mocks
        mock_extract_id.return_value = 'dQw4w9WgXcQ'
        mock_transcript.return_value = 'This is a test transcript ' * 200
        mock_title.return_value = 'Test Video Title'
        
        extractor = YouTubeExtractor()
        result = extractor.extract('https://www.youtube.com/watch?v=dQw4w9WgXcQ')
        
        # Assertions
        self.assertEqual(result['title'], 'Test Video Title')
        self.assertEqual(result['content_type'], 'youtube')
        self.assertIn('video_id', result['metadata'])
        self.assertEqual(result['metadata']['video_id'], 'dQw4w9WgXcQ')
        self.assertGreater(result['metadata']['word_count'], 0)
        self.assertIn('extracted_at', result)
    
    @patch('content_processor.extract_video_id')
    def test_youtube_invalid_url(self, mock_extract_id):
        """Test YouTube extraction with invalid URL."""
        mock_extract_id.return_value = None
        
        extractor = YouTubeExtractor()
        with self.assertRaises(Exception):
            extractor.extract('https://invalid-url.com')


class TestArticleExtractor(unittest.TestCase):
    """Test article content extraction."""
    
    @patch('content_processor.Article')
    def test_article_extraction(self, mock_article_class):
        """Test article extraction with mocked newspaper3k."""
        # Setup mock article
        mock_article = MagicMock()
        mock_article.title = 'Test Article Title'
        mock_article.text = 'This is test article content. ' * 100
        mock_article.authors = ['John Doe', 'Jane Smith']
        mock_article.publish_date = datetime(2024, 1, 1)
        mock_article.top_image = 'https://example.com/image.jpg'
        
        mock_article_class.return_value = mock_article
        
        extractor = ArticleExtractor()
        result = extractor.extract('https://example.com/article')
        
        # Assertions
        self.assertEqual(result['title'], 'Test Article Title')
        self.assertEqual(result['content_type'], 'article')
        self.assertIn('authors', result['metadata'])
        self.assertEqual(len(result['metadata']['authors']), 2)
        self.assertIn('reading_time_minutes', result['metadata'])
        self.assertGreater(result['metadata']['word_count'], 0)
    
    @patch('content_processor.Article')
    def test_article_no_content(self, mock_article_class):
        """Test article extraction with no content."""
        mock_article = MagicMock()
        mock_article.title = 'Test'
        mock_article.text = ''
        
        mock_article_class.return_value = mock_article
        
        extractor = ArticleExtractor()
        with self.assertRaises(Exception):
            extractor.extract('https://example.com/empty')


class TestPDFExtractor(unittest.TestCase):
    """Test PDF content extraction."""
    
    @patch('content_processor.PdfReader')
    @patch('content_processor.requests.get')
    def test_pdf_url_extraction(self, mock_get, mock_pdf_reader):
        """Test PDF extraction from URL."""
        # Mock HTTP response
        mock_response = MagicMock()
        mock_response.content = b'fake pdf content'
        mock_response.raise_for_status = MagicMock()
        mock_get.return_value = mock_response
        
        # Mock PDF reader
        mock_page = MagicMock()
        mock_page.extract_text.return_value = 'Test PDF content ' * 50
        
        mock_reader = MagicMock()
        mock_reader.pages = [mock_page, mock_page]
        mock_reader.metadata = {'/Title': 'Test PDF Document'}
        
        mock_pdf_reader.return_value = mock_reader
        
        extractor = PDFExtractor()
        result = extractor.extract('https://example.com/test.pdf')
        
        # Assertions
        self.assertEqual(result['title'], 'Test PDF Document')
        self.assertEqual(result['content_type'], 'pdf')
        self.assertEqual(result['metadata']['page_count'], 2)
        self.assertIn('word_count', result['metadata'])
        self.assertIn('filename', result['metadata'])


class TestGitHubExtractor(unittest.TestCase):
    """Test GitHub repository extraction."""
    
    @patch('content_processor.requests.get')
    def test_github_extraction(self, mock_get):
        """Test GitHub README extraction."""
        # Mock README API response
        readme_response = MagicMock()
        readme_response.status_code = 200
        readme_response.text = '# Test Repository\n\nThis is a test README.'
        
        # Mock repo metadata response
        repo_response = MagicMock()
        repo_response.status_code = 200
        repo_response.json.return_value = {
            'description': 'A test repository',
            'topics': ['python', 'testing'],
            'stargazers_count': 42
        }
        
        # Setup mock to return different responses
        mock_get.side_effect = [readme_response, repo_response]
        
        extractor = GitHubExtractor()
        result = extractor.extract('https://github.com/testuser/testrepo')
        
        # Assertions
        self.assertIn('testuser/testrepo', result['title'])
        self.assertEqual(result['content_type'], 'github')
        self.assertEqual(result['metadata']['owner'], 'testuser')
        self.assertEqual(result['metadata']['repo_name'], 'testrepo')
        self.assertEqual(result['metadata']['stars'], 42)
        self.assertIn('# Test Repository', result['content'])
    
    def test_github_invalid_url(self):
        """Test GitHub extraction with invalid URL."""
        extractor = GitHubExtractor()
        with self.assertRaises(Exception):
            extractor.extract('https://not-github.com/repo')


class TestGenericExtractor(unittest.TestCase):
    """Test generic web page extraction."""
    
    @patch('content_processor.requests.get')
    def test_generic_extraction(self, mock_get):
        """Test generic page extraction."""
        html_content = """
        <html>
        <head>
            <title>Test Page</title>
            <meta name="description" content="Test description">
        </head>
        <body>
            <nav>Navigation</nav>
            <main>
                <h1>Main Content</h1>
                <p>This is the main content of the page.</p>
            </main>
            <footer>Footer</footer>
        </body>
        </html>
        """
        
        mock_response = MagicMock()
        mock_response.content = html_content.encode('utf-8')
        mock_response.raise_for_status = MagicMock()
        mock_get.return_value = mock_response
        
        extractor = GenericExtractor()
        result = extractor.extract('https://example.com/page')
        
        # Assertions
        self.assertEqual(result['title'], 'Test Page')
        self.assertEqual(result['content_type'], 'generic')
        self.assertIn('Main Content', result['content'])
        self.assertNotIn('Navigation', result['content'])
        self.assertNotIn('Footer', result['content'])
        self.assertEqual(result['metadata']['description'], 'Test description')


class TestContentDetection(unittest.TestCase):
    """Test content type detection."""
    
    def test_detect_youtube(self):
        """Test YouTube URL detection."""
        extractor = detect_content_type('https://www.youtube.com/watch?v=test')
        self.assertIsInstance(extractor, YouTubeExtractor)
        
        extractor = detect_content_type('https://youtu.be/test')
        self.assertIsInstance(extractor, YouTubeExtractor)
    
    def test_detect_github(self):
        """Test GitHub URL detection."""
        extractor = detect_content_type('https://github.com/user/repo')
        self.assertIsInstance(extractor, GitHubExtractor)
    
    def test_detect_pdf(self):
        """Test PDF detection."""
        extractor = detect_content_type('https://example.com/document.pdf')
        self.assertIsInstance(extractor, PDFExtractor)
    
    def test_detect_article(self):
        """Test article URL detection."""
        extractor = detect_content_type('https://example.com/article')
        self.assertIsInstance(extractor, ArticleExtractor)


def run_live_tests():
    """
    Optional: Run live tests with real URLs (not part of unit tests).
    Only run these manually when you want to test with real data.
    """
    print("\n" + "="*60)
    print("LIVE TESTS (optional - requires internet)")
    print("="*60)
    
    # Test YouTube (if available)
    try:
        print("\n1. Testing YouTube extraction...")
        yt_url = "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
        result = extract_content(yt_url)
        print(f"✓ YouTube: {result['title'][:50]}...")
        print(f"  Type: {result['content_type']}")
        print(f"  Words: {result['metadata']['word_count']}")
    except Exception as e:
        print(f"✗ YouTube failed: {str(e)}")
    
    # Test Article
    try:
        print("\n2. Testing article extraction...")
        article_url = "https://en.wikipedia.org/wiki/Python_(programming_language)"
        result = extract_content(article_url)
        print(f"✓ Article: {result['title'][:50]}...")
        print(f"  Type: {result['content_type']}")
        print(f"  Words: {result['metadata']['word_count']}")
    except Exception as e:
        print(f"✗ Article failed: {str(e)}")
    
    # Test GitHub
    try:
        print("\n3. Testing GitHub extraction...")
        github_url = "https://github.com/python/cpython"
        result = extract_content(github_url)
        print(f"✓ GitHub: {result['title'][:50]}...")
        print(f"  Type: {result['content_type']}")
        print(f"  Stars: {result['metadata']['stars']}")
    except Exception as e:
        print(f"✗ GitHub failed: {str(e)}")
    
    print("\n" + "="*60)


if __name__ == '__main__':
    # Run unit tests
    print("Running unit tests...")
    unittest.main(argv=[''], verbosity=2, exit=False)
    
    # Ask if user wants to run live tests
    print("\n" + "="*60)
    response = input("\nRun live tests with real URLs? (y/n): ")
    if response.lower() == 'y':
        run_live_tests()
