# GIT SAFETY RULES - NEVER BREAK THESE

## CRITICAL RULES FOR AI ASSISTANT:

### ❌ NEVER RUN THESE COMMANDS WITHOUT EXPLICIT USER PERMISSION:
- `git checkout -- .` (reverts all changes)
- `git reset --hard` (destroys uncommitted work)
- `git clean -fd` (deletes untracked files)
- `git stash drop` (permanently deletes stashed work)
- Any command that modifies or deletes uncommitted changes

### ✅ ALWAYS DO THIS BEFORE ANY GIT OPERATIONS:
1. `git status` - Check what changes exist
2. `git stash push -u -m "Backup before changes - $(date)"` - Backup all work
3. ASK USER PERMISSION before any destructive operations
4. Explain exactly what the command will do

### 🆘 IF MISTAKES HAPPEN:
1. Immediately run `git stash list` to check for backups
2. Run `git reflog` to find lost commits
3. Check for any backup/temp files in editor
4. Try to recover from `.git` internals if needed

### 📝 REQUIRED WORKFLOW:
- Before any git operation that might affect files, ALWAYS ask: "This command will [EXACT DESCRIPTION]. Do you want me to proceed?"
- Never assume user wants changes reverted or stashed
- When in doubt, create a backup first and ask permission

## USER WORK IS SACRED - NEVER DESTROY IT WITHOUT PERMISSION