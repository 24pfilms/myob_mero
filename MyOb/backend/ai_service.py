"""
AI Assistant Service Layer
Handles AI-powered features: chat, link suggestions, and connection analysis
"""

import json
import uuid
from typing import List, Dict, Optional
from sqlalchemy.orm import Session
from database import Note, Conversation, ConversationMessage, NoteLink
from ai import cosine_similarity
from codex_provider import CodexProvider


class AIAssistService:
    """Service for AI-powered assistance features"""
    
    def __init__(self, db: Session):
        self.db = db
        
    async def answer_question(
        self, 
        query: str, 
        current_note_id: Optional[str] = None,
        conversation_history: List[Dict] = None,
        allowed_note_ids: Optional[List[str]] = None,
        persona_instructions: Optional[str] = None
    ) -> Dict:
        """
        Answer user question with context from vault
        Returns answer with citations
        """
        # Step 1: Get relevant notes via semantic search, never leaving the allowed scope
        relevant_notes = self._semantic_search(query, limit=10, allowed_note_ids=allowed_note_ids)
        
        # Step 2: Build context window. The open note counts only if it is in scope too.
        if allowed_note_ids is not None and current_note_id not in set(allowed_note_ids):
            current_note_id = None
        context = self._build_context(relevant_notes, current_note_id)
        
        # Step 3: Build conversation context
        messages = []
        if conversation_history:
            # Include last 5 messages for context
            messages.extend(conversation_history[-5:])
        
        # Step 4: Add system prompt and user query
        system_prompt = self._build_system_prompt(context)
        if persona_instructions:
            system_prompt = f"{system_prompt}\n\nPERSONA INSTRUCTIONS:\n{persona_instructions}"
        messages.append({"role": "user", "content": query})

        # Step 5: Call LLM
        response = self._call_llm(system_prompt, messages)
        
        # Step 6: Parse citations from response
        citations = self._extract_citations(response, relevant_notes)
        
        return {
            "answer": response,
            "citations": citations,
            "related_notes": [
                {
                    "id": note["id"],
                    "title": note["title"],
                    "relevance": note["similarity"]
                }
                for note in relevant_notes[:5]
            ]
        }
    
    async def general_chat(
        self,
        query: str,
        conversation_history: List[Dict] = None
    ) -> Dict:
        """
        Answer general questions without vault context (like "Where is Toronto?")
        """
        messages = []
        
        # Add conversation history if provided
        if conversation_history:
            messages.extend(conversation_history[-5:])
        
        # Add system prompt for general chat
        system_prompt = "You are a helpful AI assistant. Answer questions accurately and concisely."
        messages.append({"role": "user", "content": query})

        # Call LLM without vault context
        response = self._call_llm(system_prompt, messages)
        
        return {
            "answer": response,
            "citations": [],
            "related_notes": []
        }
    
    def _semantic_search(self, query: str, limit: int = 10, allowed_note_ids: Optional[List[str]] = None) -> List[Dict]:
        """Search notes by semantic similarity, restricted to the scope when one is set"""
        from ai import get_embedding
        
        query_embedding = get_embedding(query)
        note_query = self.db.query(Note)
        if allowed_note_ids is not None:
            if not allowed_note_ids:
                return []
            note_query = note_query.filter(Note.id.in_(allowed_note_ids))
        all_notes = note_query.all()
        
        results = []
        for note in all_notes:
            if not note.embedding:
                continue
            
            note_embedding = json.loads(note.embedding)
            similarity = cosine_similarity(query_embedding, note_embedding)
            
            if similarity > 0.3:  # Similarity threshold
                results.append({
                    'id': note.id,
                    'title': note.title,
                    'content': note.content,
                    'tags': note.tags or [],
                    'similarity': similarity
                })
        
        results.sort(key=lambda x: x['similarity'], reverse=True)
        return results[:limit]
    
    def _build_context(self, relevant_notes: List[Dict], current_note_id: Optional[str] = None) -> str:
        """Build context string from relevant notes"""
        context_parts = []
        
        # Add current note if provided
        if current_note_id:
            current_note = self.db.query(Note).filter(Note.id == current_note_id).first()
            if current_note:
                context_parts.append(f"CURRENT NOTE:\nTitle: {current_note.title}\n{current_note.content[:1000]}\n")
        
        # Add relevant notes
        context_parts.append("RELEVANT NOTES FROM YOUR VAULT:\n")
        for i, note in enumerate(relevant_notes[:5], 1):
            # Trim content to first 500 chars for context
            content_preview = note['content'][:500]
            context_parts.append(
                f"\n[{i}] {note['title']}\n"
                f"Tags: {', '.join(note['tags']) if note['tags'] else 'None'}\n"
                f"Content preview: {content_preview}...\n"
                f"(Note ID: {note['id']})\n"
            )
        
        return "\n".join(context_parts)
    
    def _build_system_prompt(self, context: str) -> str:
        """Build system prompt with context"""
        return f"""You are an AI assistant helping the user explore their personal knowledge base.

CONTEXT FROM USER'S VAULT:
{context}

INSTRUCTIONS:
1. Answer the user's question based on the context provided above
2. Reference specific notes using [[Note Title]] format when relevant
3. If you cite information, mention which note it's from
4. Be concise and helpful
5. If the context doesn't contain relevant information, say so clearly
6. Use a conversational, friendly tone

When citing notes, format like this: "According to [[Note Title]], ..."
"""
    
    def _call_llm(self, instructions: str, messages: List[Dict]) -> str:
        """Call the request-scoped OpenAI OAuth transport."""
        normalized = [
            {"role": message.get("role"), "content": message.get("content")}
            for message in messages
            if message.get("role") in {"user", "assistant"} and isinstance(message.get("content"), str)
        ]
        return CodexProvider().complete(instructions, normalized)
    
    def _extract_citations(self, response: str, relevant_notes: List[Dict]) -> List[Dict]:
        """Extract [[Note Title]] citations from response and match to notes"""
        import re
        
        citations = []
        
        # Find all [[Note Title]] patterns
        pattern = r'\[\[([^\]]+)\]\]'
        matches = re.findall(pattern, response)
        
        for title in matches:
            # Find the note with this title
            for note in relevant_notes:
                if note['title'].lower() == title.lower():
                    # Extract a relevant excerpt
                    excerpt = note['content'][:300]
                    
                    citations.append({
                        "noteId": note['id'],
                        "noteTitle": note['title'],
                        "excerpt": excerpt,
                        "relevanceScore": note['similarity']
                    })
                    break
        
        return citations
    
    def suggest_links(
        self,
        text: str,
        current_note_id: str,
        num_suggestions: int = 5
    ) -> List[Dict]:
        """
        Suggest relevant notes to link based on text
        """
        from ai import get_embedding
        
        # Get embedding for the text
        text_embedding = get_embedding(text)
        
        # Find similar notes
        all_notes = self.db.query(Note).filter(Note.id != current_note_id).all()
        
        results = []
        for note in all_notes:
            if not note.embedding:
                continue
            
            note_embedding = json.loads(note.embedding)
            similarity = cosine_similarity(text_embedding, note_embedding)
            
            if similarity > 0.4:  # Higher threshold for link suggestions
                results.append({
                    'noteId': note.id,
                    'noteTitle': note.title,
                    'relevanceScore': round(similarity * 100),  # Convert to percentage
                    'excerpt': note.content[:200],
                    'tags': note.tags or [],
                    'updatedAt': note.updated_at.isoformat() if note.updated_at else None
                })
        
        results.sort(key=lambda x: x['relevanceScore'], reverse=True)
        return results[:num_suggestions]
    
    def save_conversation(
        self,
        messages: List[Dict],
        title: Optional[str] = None
    ) -> Dict:
        """
        Save conversation to database and optionally create note
        """
        conversation_id = str(uuid.uuid4())
        
        # Create conversation
        conversation = Conversation(
            id=conversation_id,
            title=title or f"AI Chat - {messages[0]['content'][:50]}..."
        )
        self.db.add(conversation)
        
        # Save messages
        for msg in messages:
            message = ConversationMessage(
                id=str(uuid.uuid4()),
                conversation_id=conversation_id,
                role=msg['role'],
                content=msg['content'],
                citations=msg.get('citations', [])
            )
            self.db.add(message)
        
        self.db.commit()
        
        return {
            "conversationId": conversation_id,
            "title": conversation.title
        }
    
    def get_conversation_history(self, limit: int = 20) -> List[Dict]:
        """Get recent conversations"""
        conversations = (
            self.db.query(Conversation)
            .order_by(Conversation.created_at.desc())
            .limit(limit)
            .all()
        )
        
        result = []
        for conv in conversations:
            messages = (
                self.db.query(ConversationMessage)
                .filter(ConversationMessage.conversation_id == conv.id)
                .order_by(ConversationMessage.created_at)
                .all()
            )
            
            result.append({
                "id": conv.id,
                "title": conv.title,
                "messageCount": len(messages),
                "createdAt": conv.created_at.isoformat(),
                "preview": messages[0].content[:100] if messages else ""
            })
        
        return result
    
    def analyze_note_connections(
        self,
        note_id: str,
        depth: int = 2
    ) -> Dict:
        """
        Analyze note's connections and suggest improvements
        """
        note = self.db.query(Note).filter(Note.id == note_id).first()
        if not note:
            return {"error": "Note not found"}
        
        # Find similar notes
        similar_notes = self._semantic_search(note.content, limit=10)
        
        # Check existing links
        existing_links = (
            self.db.query(NoteLink)
            .filter(NoteLink.source_note_id == note_id)
            .all()
        )
        
        linked_note_ids = {link.target_note_id for link in existing_links}
        
        # Find unlinked but related notes
        unlinked_related = [
            n for n in similar_notes 
            if n['id'] not in linked_note_ids and n['id'] != note_id
        ]
        
        return {
            "noteId": note_id,
            "noteTitle": note.title,
            "existingLinks": len(existing_links),
            "suggestedConnections": [
                {
                    "noteId": n['id'],
                    "noteTitle": n['title'],
                    "relevance": n['similarity'],
                    "reason": "High semantic similarity"
                }
                for n in unlinked_related[:5]
            ],
            "clusterInfo": {
                "totalRelated": len(similar_notes),
                "stronglyRelated": len([n for n in similar_notes if n['similarity'] > 0.7])
            }
        }
