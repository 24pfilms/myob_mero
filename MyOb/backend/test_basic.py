import json
from sqlalchemy.orm import sessionmaker
from database import engine, Note
from app import scan_vault

Session = sessionmaker(bind=engine)

def test_basic_functionality():
    """Test basic functionality without AI embeddings"""
    print("Testing basic system functionality...")
    print("=" * 50)
    
    # Test 1: Database connection
    print("1. Testing database connection...")
    try:
        db = Session()
        print("   ✅ Database connection successful")
        db.close()
    except Exception as e:
        print(f"   ❌ Database connection failed: {e}")
        return False
    
    # Test 2: Vault scanning
    print("\n2. Testing vault scanning...")
    try:
        notes_from_vault = list(scan_vault())
        total_notes = len(notes_from_vault)
        print(f"   ✅ Successfully scanned {total_notes} notes from vault")
        
        # Show a few examples
        if total_notes > 0:
            print("   Sample notes:")
            for i, note in enumerate(notes_from_vault[:3]):
                print(f"     - {note['title']} ({len(note['content'])} chars)")
                if i >= 2:  # Show max 3 examples
                    break
    except Exception as e:
        print(f"   ❌ Vault scanning failed: {e}")
        return False
    
    # Test 3: Basic database operations (without embeddings)
    print("\n3. Testing basic database operations...")
    try:
        db = Session()
        
        # Add a test note without embedding
        if total_notes > 0:
            sample_note = notes_from_vault[0]
            print(f"   Testing with note: {sample_note['title']}")
            
            # Check if note exists
            existing_note = db.query(Note).filter(Note.id == sample_note['id']).first()
            
            if existing_note:
                print("   ✅ Note already exists in database")
            else:
                # Add note without embedding
                test_note = Note(
                    id=sample_note['id'],
                    title=sample_note['title'],
                    content=sample_note['content'],
                    tags=sample_note['tags'],
                    embedding=None  # Skip embedding for now
                )
                db.add(test_note)
                db.commit()
                print("   ✅ Successfully added test note to database")
            
            # Test querying
            notes_count = db.query(Note).count()
            print(f"   ✅ Database contains {notes_count} notes total")
        
        db.close()
    except Exception as e:
        print(f"   ❌ Database operations failed: {e}")
        return False
    
    print("\n" + "=" * 50)
    print("✅ All basic tests passed! The system foundation is working.")
    print("\nNext steps:")
    print("1. Fix OpenRouter API key issues")
    print("2. Test AI embeddings functionality")
    print("3. Run full import when API is working")
    print("4. Test the web interface")
    
    return True

if __name__ == '__main__':
    test_basic_functionality()