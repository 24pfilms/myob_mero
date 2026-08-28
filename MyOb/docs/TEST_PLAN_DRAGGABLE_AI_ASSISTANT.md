# Test Plan: Draggable AI Assistant Modal

## Overview
Testing plan for converting the AI Assistant from a side panel (Sheet) to a draggable, freely movable modal card.

---

## Phase 1: DraggableModal Component ✅ COMPLETED

### Test Cases

#### TC1.1: Component Renders
- **Objective**: Verify the DraggableModal component renders correctly
- **Steps**:
  1. Open AI Assistant
  2. Check modal appears on screen
- **Expected**: Modal visible with header, content area, and close button
- **Status**: ⏳ PENDING

#### TC1.2: Drag Functionality
- **Objective**: Verify modal can be dragged by header
- **Steps**:
  1. Click and hold on modal header
  2. Move mouse around screen
  3. Release mouse button
- **Expected**: Modal follows mouse cursor smoothly, cursor changes to `grab`/`grabbing`
- **Status**: ⏳ PENDING

#### TC1.3: Viewport Boundaries
- **Objective**: Verify modal stays within viewport
- **Steps**:
  1. Try to drag modal past top edge
  2. Try to drag modal past bottom edge
  3. Try to drag modal past left edge
  4. Try to drag modal past right edge
- **Expected**: Modal stops at viewport boundaries, cannot be dragged off-screen
- **Status**: ⏳ PENDING

#### TC1.4: Position Persistence
- **Objective**: Verify position is saved and restored
- **Steps**:
  1. Drag modal to custom position
  2. Close modal
  3. Reopen modal
- **Expected**: Modal reopens at the last dragged position
- **Status**: ⏳ PENDING

#### TC1.5: ESC Key Close
- **Objective**: Verify ESC key closes modal
- **Steps**:
  1. Open modal
  2. Press ESC key
- **Expected**: Modal closes immediately
- **Status**: ⏳ PENDING

#### TC1.6: Backdrop Click Close
- **Objective**: Verify clicking backdrop closes modal
- **Steps**:
  1. Open modal
  2. Click on backdrop (dark area outside modal)
- **Expected**: Modal closes
- **Status**: ⏳ PENDING

#### TC1.7: X Button Close
- **Objective**: Verify close button works
- **Steps**:
  1. Open modal
  2. Click X button in header
- **Expected**: Modal closes
- **Status**: ⏳ PENDING

### Phase 1 Completion Criteria
- ✅ All test cases (TC1.1 - TC1.7) pass
- ✅ No console errors
- ✅ Smooth drag performance (no lag)

**⚠️ DO NOT PROCEED TO PHASE 2 UNTIL PHASE 1 IS VALIDATED**

---

## Phase 2: AIChatPanel Integration ⏳ PENDING

### Test Cases

#### TC2.1: Modal Opens/Closes
- **Objective**: Verify AI Assistant can be opened and closed via toolbar
- **Steps**:
  1. Click "AI Assist" button in toolbar
  2. Verify modal opens
  3. Close modal
  4. Click "AI Assist" again
- **Expected**: Modal toggles open/closed state correctly
- **Status**: ⏳ PENDING

#### TC2.2: Chat Messages Work
- **Objective**: Verify chat functionality intact
- **Steps**:
  1. Open AI Assistant
  2. Type a question: "What are my notes about?"
  3. Press Enter or click Send
  4. Wait for response
- **Expected**: User message appears, AI response appears with proper formatting
- **Status**: ⏳ PENDING

#### TC2.3: Citations Clickable
- **Objective**: Verify citations are clickable and navigate correctly
- **Steps**:
  1. Ask question that returns citations
  2. Click on a citation link
- **Expected**: Navigates to the cited note, modal closes
- **Status**: ⏳ PENDING

#### TC2.4: Settings Button Works
- **Objective**: Verify settings dialog opens
- **Steps**:
  1. Open AI Assistant
  2. Click Settings icon
  3. Verify settings dialog opens
  4. Close settings dialog
- **Expected**: Settings dialog opens and closes correctly
- **Status**: ⏳ PENDING

#### TC2.5: Clear Chat Works
- **Objective**: Verify clear functionality
- **Steps**:
  1. Send a few messages
  2. Click Clear/Trash icon
  3. Verify confirmation
- **Expected**: All messages cleared, empty state shown
- **Status**: ⏳ PENDING

#### TC2.6: Save Conversation Works
- **Objective**: Verify save functionality
- **Steps**:
  1. Have a conversation
  2. Click Save icon
  3. Check for success toast
- **Expected**: Conversation saved, toast notification appears
- **Status**: ⏳ PENDING

#### TC2.7: Input Focus on Open
- **Objective**: Verify input field auto-focuses
- **Steps**:
  1. Open AI Assistant
  2. Immediately start typing
- **Expected**: Input field is focused, typing works without clicking
- **Status**: ⏳ PENDING

#### TC2.8: Vault Context Toggle
- **Objective**: Verify vault context mode toggle works
- **Steps**:
  1. Open AI Assistant
  2. Toggle "Vault Context" switch off
  3. Send a message
  4. Toggle back on
  5. Send another message
- **Expected**: Mode indicator updates, different API endpoints called
- **Status**: ⏳ PENDING

#### TC2.9: Drag While Chatting
- **Objective**: Verify can drag modal during active chat
- **Steps**:
  1. Send a message (loading state)
  2. Try to drag modal while waiting for response
  3. Drag after response received
- **Expected**: Modal can be dragged at any time without interrupting chat
- **Status**: ⏳ PENDING

### Phase 2 Completion Criteria
- ✅ All test cases (TC2.1 - TC2.9) pass
- ✅ All existing AI features work correctly
- ✅ No regression in chat functionality
- ✅ Modal remains draggable during all operations

**⚠️ DO NOT PROCEED TO PHASE 3 UNTIL PHASE 2 IS VALIDATED**

---

## Phase 3: Close Mechanisms ⏳ PENDING

### Test Cases

#### TC3.1: ESC Key
- **Objective**: Verify ESC closes AI Assistant
- **Steps**:
  1. Open AI Assistant
  2. Press ESC key
- **Expected**: Modal closes, state resets
- **Status**: ⏳ PENDING

#### TC3.2: X Button
- **Objective**: Verify X button in header closes
- **Steps**:
  1. Open AI Assistant
  2. Click X in top-right corner
- **Expected**: Modal closes
- **Status**: ⏳ PENDING

#### TC3.3: Toolbar Toggle
- **Objective**: Verify toolbar button toggles state
- **Steps**:
  1. Click AI Assist button to open
  2. Click AI Assist button again
- **Expected**: Modal opens then closes on second click
- **Status**: ⏳ PENDING

#### TC3.4: Backdrop Click (Optional)
- **Objective**: Verify clicking outside closes modal
- **Steps**:
  1. Open AI Assistant
  2. Click on backdrop
- **Expected**: Modal closes (if enabled) or stays open (based on configuration)
- **Status**: ⏳ PENDING

#### TC3.5: State Persistence After Close
- **Objective**: Verify chat state after closing/reopening
- **Steps**:
  1. Have a conversation
  2. Close modal (any method)
  3. Reopen modal
- **Expected**: Previous conversation visible, position restored
- **Status**: ⏳ PENDING

### Phase 3 Completion Criteria
- ✅ All close mechanisms work reliably
- ✅ No state corruption on close/reopen
- ✅ Keyboard shortcuts work consistently

**⚠️ DO NOT PROCEED TO DOCUMENTATION UNTIL PHASE 3 IS VALIDATED**

---

## Final Acceptance Criteria

### Functional Requirements
- [ ] Modal can be freely dragged anywhere on screen
- [ ] Modal cannot be dragged off-screen
- [ ] Position persists between sessions
- [ ] All AI chat features work (messages, citations, settings)
- [ ] Multiple close methods work (ESC, X, toolbar, backdrop)
- [ ] Smooth performance (no lag or jank)

### Non-Functional Requirements
- [ ] No console errors during any operation
- [ ] Accessible (keyboard navigation works)
- [ ] Responsive design (works on different screen sizes)
- [ ] Visual polish (animations, shadows, proper z-index)

### Regression Testing
- [ ] File browser still works
- [ ] Editor still works
- [ ] Other toolbar functions unaffected
- [ ] No performance degradation

---

## Test Results

### Phase 1 Results
**Date Tested**: _____________  
**Tester**: _____________  
**Result**: ⏳ PASS / FAIL  
**Notes**: 

---

### Phase 2 Results
**Date Tested**: _____________  
**Tester**: _____________  
**Result**: ⏳ PASS / FAIL  
**Notes**: 

---

### Phase 3 Results
**Date Tested**: _____________  
**Tester**: _____________  
**Result**: ⏳ PASS / FAIL  
**Notes**: 

---

## Known Issues
_Document any issues found during testing_

---

## Sign-Off
**Feature Ready for Production**: ⏳ YES / NO  
**Approval**: _____________  
**Date**: _____________
