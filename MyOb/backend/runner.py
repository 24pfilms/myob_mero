import os
import uvicorn
import sys

# NOTE: File watcher is disabled in standalone database mode.
# If you need to import from an Obsidian vault, use import_obsidian.py instead.

def run_api():
    """Run the FastAPI server on loopback unless explicitly configured otherwise."""
    host = os.getenv("MYOB_HOST", "127.0.0.1")
    port = int(os.getenv("MYOB_PORT", "8001"))
    uvicorn.run("app:app", host=host, port=port, reload=False, log_level="info")

if __name__ == "__main__":
    print("="*60)
    print("MyOb Backend Server - Standalone Database Mode")
    print("="*60)
    print("API available at: http://127.0.0.1:8001")
    print("API Docs available at: http://127.0.0.1:8001/docs")
    print()
    print("Note: File watcher is disabled. Notes are stored in database.")
    print("To import from Obsidian, use: python import_obsidian.py")
    print("="*60)
    print()
    
    # Run the API server
    try:
        run_api()
    except KeyboardInterrupt:
        print("\nShutting down gracefully...")
        sys.exit(0)
