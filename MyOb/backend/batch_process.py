import time
from database import SessionLocal, Note, VideoSummary
from youtube import find_youtube_videos, process_video

def batch_process_videos(limit=50):
    """Processes unprocessed YouTube videos found in notes."""
    db = SessionLocal()
    notes = db.query(Note).all()
    videos_processed = 0
    
    print(f"Starting batch video processing. Limit: {limit} videos.")
    
    for note in notes:
        if videos_processed >= limit:
            break
            
        videos_in_note = find_youtube_videos(note.content)
        
        for video in videos_in_note:
            if videos_processed >= limit:
                break
            
            existing = db.query(VideoSummary).filter_by(video_id=video['id']).first()
            if existing:
                continue
            
            try:
                print(f"Processing video {video['id']} from note '{note.title}'")
                result = process_video(video['id'])
                
                new_summary = VideoSummary(
                    video_id=video['id'],
                    note_id=note.id,
                    title=result['title'],
                    summary=result['summary'],
                    transcript=result['transcript']
                )
                db.add(new_summary)
                db.commit()
                
                videos_processed += 1
                print(f"  ✓ Success! ({videos_processed}/{limit})")
                time.sleep(2) # Rate limiting
                
            except Exception as e:
                print(f"  ✗ Error processing {video['id']}: {e}")
                db.rollback()
                continue
    
    db.close()
    print(f"\nBatch processing complete! Processed {videos_processed} new videos.")

if __name__ == '__main__':
    batch_process_videos()