"""
File processing utilities for drag-and-drop file uploads.

Supports:
- Images (JPG, PNG, GIF, WEBP) -> base64 embedded in markdown
- JSON files -> formatted code blocks
- Code files (.py, .js, .ts, etc.) -> syntax-highlighted code blocks
- CSV files -> markdown tables
- Markdown files -> raw content
"""

import base64
import json
import csv
from io import StringIO
from typing import Dict, Any
import logging

logger = logging.getLogger(__name__)

# File type mappings
IMAGE_EXTENSIONS = {'.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'}
CODE_EXTENSIONS = {
    '.py': 'python',
    '.js': 'javascript',
    '.ts': 'typescript',
    '.jsx': 'jsx',
    '.tsx': 'tsx',
    '.java': 'java',
    '.cpp': 'cpp',
    '.c': 'c',
    '.cs': 'csharp',
    '.go': 'go',
    '.rs': 'rust',
    '.rb': 'ruby',
    '.php': 'php',
    '.swift': 'swift',
    '.kt': 'kotlin',
    '.scala': 'scala',
    '.sh': 'bash',
    '.sql': 'sql',
    '.html': 'html',
    '.css': 'css',
    '.xml': 'xml',
    '.yaml': 'yaml',
    '.yml': 'yaml',
    '.toml': 'toml',
    '.r': 'r',
}

def get_file_extension(filename: str) -> str:
    """Extract file extension from filename."""
    return filename[filename.rfind('.'):].lower() if '.' in filename else ''

def is_image(filename: str) -> bool:
    """Check if file is an image."""
    return get_file_extension(filename) in IMAGE_EXTENSIONS

def is_json(filename: str) -> bool:
    """Check if file is JSON."""
    return get_file_extension(filename) == '.json'

def is_csv(filename: str) -> bool:
    """Check if file is CSV."""
    return get_file_extension(filename) == '.csv'

def is_markdown(filename: str) -> bool:
    """Check if file is markdown."""
    return get_file_extension(filename) in {'.md', '.markdown'}

def is_code(filename: str) -> bool:
    """Check if file is a code file."""
    return get_file_extension(filename) in CODE_EXTENSIONS

def get_language_from_extension(filename: str) -> str:
    """Get language identifier for syntax highlighting."""
    ext = get_file_extension(filename)
    return CODE_EXTENSIONS.get(ext, 'text')

def process_image(content: bytes, filename: str) -> Dict[str, Any]:
    """
    Process image file and return base64-encoded markdown.
    
    Args:
        content: Image file bytes
        filename: Original filename
        
    Returns:
        Dict with markdown syntax and metadata
    """
    try:
        # Get image format
        ext = get_file_extension(filename).lstrip('.')
        if ext == 'jpg':
            ext = 'jpeg'
        
        # Convert to base64
        base64_data = base64.b64encode(content).decode('utf-8')
        
        # Create data URL
        data_url = f"data:image/{ext};base64,{base64_data}"
        
        # Create markdown image syntax
        markdown = f"![{filename}]({data_url})"
        
        return {
            'markdown': markdown,
            'type': 'image',
            'filename': filename,
            'size': len(content)
        }
    except Exception as e:
        logger.error(f"Error processing image {filename}: {str(e)}")
        raise Exception(f"Failed to process image: {str(e)}")

def process_json(content: bytes, filename: str) -> Dict[str, Any]:
    """
    Process JSON file and return formatted code block.
    
    Args:
        content: JSON file bytes
        filename: Original filename
        
    Returns:
        Dict with markdown syntax and metadata
    """
    try:
        # Decode and parse JSON
        text = content.decode('utf-8')
        data = json.loads(text)
        
        # Format JSON with indentation
        formatted_json = json.dumps(data, indent=2, ensure_ascii=False)
        
        # Create markdown code block
        markdown = f"```json\n{formatted_json}\n```"
        
        return {
            'markdown': markdown,
            'type': 'json',
            'filename': filename,
            'size': len(content)
        }
    except json.JSONDecodeError as e:
        logger.error(f"Invalid JSON in {filename}: {str(e)}")
        raise Exception(f"Invalid JSON file: {str(e)}")
    except Exception as e:
        logger.error(f"Error processing JSON {filename}: {str(e)}")
        raise Exception(f"Failed to process JSON: {str(e)}")

def process_code(content: bytes, filename: str) -> Dict[str, Any]:
    """
    Process code file and return syntax-highlighted code block.
    
    Args:
        content: Code file bytes
        filename: Original filename
        
    Returns:
        Dict with markdown syntax and metadata
    """
    try:
        # Decode text
        text = content.decode('utf-8')
        
        # Get language for syntax highlighting
        language = get_language_from_extension(filename)
        
        # Create markdown code block
        markdown = f"```{language}\n{text}\n```"
        
        return {
            'markdown': markdown,
            'type': 'code',
            'filename': filename,
            'language': language,
            'size': len(content)
        }
    except Exception as e:
        logger.error(f"Error processing code file {filename}: {str(e)}")
        raise Exception(f"Failed to process code file: {str(e)}")

def process_csv(content: bytes, filename: str) -> Dict[str, Any]:
    """
    Process CSV file and return markdown table.
    
    Args:
        content: CSV file bytes
        filename: Original filename
        
    Returns:
        Dict with markdown syntax and metadata
    """
    try:
        # Decode text
        text = content.decode('utf-8')
        
        # Parse CSV
        reader = csv.reader(StringIO(text))
        rows = list(reader)
        
        if not rows:
            raise Exception("CSV file is empty")
        
        # Build markdown table
        markdown_lines = []
        
        # Header row
        header = rows[0]
        markdown_lines.append("| " + " | ".join(header) + " |")
        markdown_lines.append("| " + " | ".join(["---"] * len(header)) + " |")
        
        # Data rows
        for row in rows[1:]:
            # Pad row if needed
            while len(row) < len(header):
                row.append("")
            markdown_lines.append("| " + " | ".join(row[:len(header)]) + " |")
        
        markdown = "\n".join(markdown_lines)
        
        return {
            'markdown': markdown,
            'type': 'csv',
            'filename': filename,
            'rows': len(rows),
            'columns': len(header),
            'size': len(content)
        }
    except Exception as e:
        logger.error(f"Error processing CSV {filename}: {str(e)}")
        raise Exception(f"Failed to process CSV: {str(e)}")

def process_markdown(content: bytes, filename: str) -> Dict[str, Any]:
    """
    Process markdown file and return raw content.
    
    Args:
        content: Markdown file bytes
        filename: Original filename
        
    Returns:
        Dict with markdown content and metadata
    """
    try:
        # Decode text
        text = content.decode('utf-8')
        
        return {
            'markdown': text,
            'type': 'markdown',
            'filename': filename,
            'size': len(content)
        }
    except Exception as e:
        logger.error(f"Error processing markdown {filename}: {str(e)}")
        raise Exception(f"Failed to process markdown: {str(e)}")

def process_file(content: bytes, filename: str) -> Dict[str, Any]:
    """
    Process file based on its type and return appropriate markdown.
    
    Args:
        content: File bytes
        filename: Original filename
        
    Returns:
        Dict with markdown syntax and metadata
    """
    # Detect file type and process accordingly
    if is_image(filename):
        return process_image(content, filename)
    elif is_json(filename):
        return process_json(content, filename)
    elif is_csv(filename):
        return process_csv(content, filename)
    elif is_markdown(filename):
        return process_markdown(content, filename)
    elif is_code(filename):
        return process_code(content, filename)
    else:
        raise Exception(f"Unsupported file type: {filename}")
