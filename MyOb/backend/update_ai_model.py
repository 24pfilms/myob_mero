#!/usr/bin/env python
"""Update AI settings to use GLM-4.6 model"""

from database import SessionLocal, AISettings

db = SessionLocal()
try:
    settings = db.query(AISettings).filter(AISettings.id == 'default').first()
    
    if settings:
        print(f'Current model: {settings.chat_model}')
        settings.chat_model = 'z-ai/glm-4.6'
        db.commit()
        print(f'Updated to: {settings.chat_model}')
    else:
        print('No settings found - will be created with GLM-4.6 on first use')
        
finally:
    db.close()
