# Debugging Board Save Issues

## Check These Console Messages

With the enhanced logging, you should see these messages in the browser console:

### On Page Load:
```
🔄 Loading initial board state...
✅ Loaded board "..." with X items from IndexedDB
📦 Loaded state: { boardId: "...", itemCount: X, panZoom: {...} }
✅ Board loading complete
```

### When You Add/Modify Items:
```
⏱️ Scheduling sync in 2 seconds...
🚫 Cancelled previous sync  (if you make more changes within 2 seconds)
⏱️ Scheduling sync in 2 seconds...  (resets the timer)
```

### After 2 Seconds of No Changes:
```
💾 Syncing X items to database for board: [boardId]
📊 Database currently has Y items
✨ Created new item: [itemId] (type: STICKY_NOTE)
✨ Created new item: [itemId] (type: SHAPE)
✅ Items synced to database
```

### If Sync is Skipped:
```
⏸️ Skipping sync - boardId: null loading: false
```
This means `currentBoardId` is null - board not loaded properly!

---

## Common Issues & Solutions

### Issue 1: "⏸️ Skipping sync - boardId: null"

**Problem:** Board ID is null, so items can't be saved

**Causes:**
- Database not initialized yet
- No boards exist in database
- Board failed to load

**Solution:**
1. Check if you see `✅ Database initialized successfully` in console
2. Check if you see `✅ Loaded board "..." with X items from IndexedDB`
3. If board didn't load, check for database errors

### Issue 2: Sync Never Triggers

**Problem:** You don't see "⏱️ Scheduling sync" messages

**Causes:**
- `items` array not changing
- `pushToHistory` not being called
- React state not updating

**Debug:**
```javascript
// In browser console, check the items state:
// Look for the useBoard hook in React DevTools
```

### Issue 3: Sync Triggers But Fails

**Problem:** You see `❌ Failed to sync items to database:`

**Causes:**
- ItemService.createItem() failing
- Database connection issue
- Invalid item data

**Debug:**
1. Look at the error details in console
2. Check if the error is from Dexie (IndexedDB)
3. Try manually checking the database:
```javascript
// In browser console:
const { db } = await import('./src/db/Database.js');
const boards = await db.boards.toArray();
console.log('Boards:', boards);
const items = await db.canvasItems.toArray();
console.log('Items:', items);
```

### Issue 4: Items Created But Not Persisting

**Problem:** Sync succeeds but items don't appear after reload

**Causes:**
- Items created on wrong board
- Board switching not working
- Loading from wrong board

**Debug:**
1. Note the boardId when saving
2. After reload, check if the same boardId is loaded
3. Manually check database to see if items exist:
```javascript
const { db } = await import('./src/db/Database.js');
const settings = await db.appSettings.get(1);
console.log('Current board:', settings.currentBoardId);

const items = await db.canvasItems.where('boardId').equals(settings.currentBoardId).toArray();
console.log('Items on current board:', items);
```

---

## Manual Testing Steps

### Test 1: Check Database Initialization
1. Open browser console
2. Refresh page
3. Look for: `✅ Database initialized successfully`
4. Look for: `✅ Loaded board "..." with X items from IndexedDB`

**Expected:** Both messages appear
**If not:** Database didn't initialize - check for errors

### Test 2: Check Board Loading
1. Open browser console
2. Refresh page
3. Look for: `📦 Loaded state: { boardId: "...", itemCount: X }`

**Expected:** boardId is a string (not null)
**If null:** No board was loaded - check if boards exist in database

### Test 3: Check Item Sync Trigger
1. Open browser console
2. Add a sticky note to canvas
3. Look for: `⏱️ Scheduling sync in 2 seconds...`
4. Wait 2 seconds
5. Look for: `💾 Syncing 1 items to database...`

**Expected:** Sync messages appear after 2 seconds
**If not:** Check if `currentBoardId` is null (see Issue 1)

### Test 4: Check Item Creation
1. Follow Test 3
2. After sync starts, look for: `✨ Created new item: [id] (type: STICKY_NOTE)`
3. Look for: `✅ Items synced to database`

**Expected:** Item created successfully
**If error:** Check error message for details

### Test 5: Check Item Persistence
1. Add a sticky note
2. Wait 3 seconds (for sync to complete)
3. Refresh the page
4. Look for: `📦 Loaded state: { boardId: "...", itemCount: 1 }`
5. Sticky note should still be visible

**Expected:** Item persists after reload
**If not:** Check if item was actually saved (use manual database check)

---

## Quick Database Check Commands

Open browser console and run these:

### Check current board:
```javascript
const { db } = await import('./src/db/Database.js');
const settings = await db.appSettings.get(1);
console.log('Current board ID:', settings?.currentBoardId);
```

### Check all boards:
```javascript
const { db } = await import('./src/db/Database.js');
const boards = await db.boards.toArray();
console.log('All boards:', boards);
```

### Check items on current board:
```javascript
const { db } = await import('./src/db/Database.js');
const settings = await db.appSettings.get(1);
const items = await db.canvasItems.where('boardId').equals(settings.currentBoardId).toArray();
console.log(`Items on current board:`, items);
```

### Check all items in database:
```javascript
const { db } = await import('./src/db/Database.js');
const allItems = await db.canvasItems.toArray();
console.log('Total items in database:', allItems.length);
console.log('All items:', allItems);
```

### Clear everything and start fresh:
```javascript
localStorage.clear();
indexedDB.deleteDatabase('MeroCanvasDB');
window.location.reload();
```

---

## What To Report

If it's still not working, please provide:

1. **Console messages** - Copy all console output from page load to after adding an item
2. **boardId status** - Run the "Check current board" command above
3. **Item count** - Run the "Check items on current board" command
4. **Any error messages** - Look for red errors in console

This will help identify exactly where the issue is!
