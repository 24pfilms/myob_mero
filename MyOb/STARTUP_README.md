# My_Obsidian Workspace - Startup Scripts

## 🚀 Quick Start

### **Option 1: Double-Click BAT File (Windows Classic)**
```
📁 My_Obsidian/
   └── START_ALL.bat       ← Double-click this!
```

### **Option 2: Run PowerShell Script (Recommended)**
```
📁 My_Obsidian/
   └── START_ALL.ps1       ← Right-click → Run with PowerShell
```

### **Option 3: Command Line**
```powershell
# From My_Obsidian directory:
.\START_ALL.bat
# or
.\START_ALL.ps1
```

---

## 📋 **What Gets Started:**

### **Window 1: Frontend Server**
- **Location:** `My_Obsidian_FrontEnd-main/`
- **Command:** `npm run dev`
- **URL:** http://localhost:8080
- **Includes:** 
  - 📝 Notes tab (My_Obsidian editor)
  - 🎨 Canvas tab (Mero board)

### **Window 2: Backend Server**
- **Location:** `backend/`
- **Command:** `python runner.py`
- **URL:** http://localhost:8000
- **Provides:**
  - Python FastAPI server
  - Obsidian vault connection
  - AI features

---

## 🛑 **Stopping Servers**

### **Option 1: Use Stop Script**
```
📁 My_Obsidian/
   └── STOP_ALL.ps1        ← Stops all servers
```

### **Option 2: Manual Stop**
- Press `Ctrl+C` in each server window
- Or close the windows

---

## ⚙️ **Script Details**

### **START_ALL.bat**
- Classic Windows batch file
- Works on all Windows versions
- Opens CMD windows
- Simple and reliable

### **START_ALL.ps1**
- Modern PowerShell script
- Colored output
- Opens PowerShell windows
- Better error handling

### **STOP_ALL.ps1**
- Gracefully stops all servers
- Kills Node.js and Python processes
- Safe to run anytime

---

## 🔧 **Troubleshooting**

### **"Scripts are disabled on this system"**
If PowerShell scripts won't run:
```powershell
# Run as Administrator:
Set-ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### **Backend won't start**
Check Python environment:
```powershell
cd backend
.\venv\Scripts\Activate.ps1
python runner.py
```

### **Frontend won't start**
Check Node.js installation:
```powershell
node --version
npm --version
```

### **Ports already in use**
Stop existing processes:
```powershell
# Check what's using ports
netstat -ano | findstr :8080
netstat -ano | findstr :8000

# Or use STOP_ALL.ps1
```

---

## 📂 **File Locations**

```
C:\Users\taylo\_New_Projects_Oct_1\My_Obsidian\
├── START_ALL.bat          ✅ Start everything (BAT)
├── START_ALL.ps1          ✅ Start everything (PowerShell)
├── STOP_ALL.ps1           ✅ Stop everything
├── STARTUP_README.md      📖 This file
│
├── My_Obsidian_FrontEnd-main/
│   └── (Frontend code)
│
└── backend/
    └── (Backend code)
```

---

## 🎯 **Access URLs**

After starting:
- **Main App:** http://localhost:8080
- **Notes Tab:** http://localhost:8080/notes
- **Canvas Tab:** http://localhost:8080/canvas
- **Backend API:** http://localhost:8000
- **API Docs:** http://localhost:8000/docs

---

## ✅ **Success Indicators**

You'll see:
1. **Two windows open**
   - "My_Obsidian Frontend" 
   - "My_Obsidian Backend"

2. **Frontend window shows:**
   ```
   VITE v5.x.x ready in xxx ms
   ➜  Local:   http://localhost:8080/
   ```

3. **Backend window shows:**
   ```
   INFO:     Started server process
   INFO:     Uvicorn running on http://127.0.0.1:8000
   ```

4. **Browser opens to:**
   - Tab navigation visible
   - Notes and Canvas tabs clickable
   - No errors in console

---

## 🔄 **Daily Workflow**

### **Morning Routine:**
1. Double-click `START_ALL.bat`
2. Wait for both servers to start
3. Open browser to http://localhost:8080
4. Start working!

### **End of Day:**
1. Save your work
2. Run `STOP_ALL.ps1`
3. Or close server windows

---

## 🚨 **Emergency Stop**

If servers hang or won't stop:
```powershell
# Nuclear option - kills all Node and Python:
taskkill /F /IM node.exe
taskkill /F /IM python.exe
```

---

## 📝 **Customization**

### **Change Ports:**
Edit these files:
- **Frontend:** `My_Obsidian_FrontEnd-main/vite.config.ts`
- **Backend:** `backend/config.py`

### **Auto-open Browser:**
Add to `START_ALL.bat`:
```batch
timeout /t 5 /nobreak >nul
start http://localhost:8080
```

---

## 🎉 **You're All Set!**

Just double-click **START_ALL.bat** and you're ready to go! 🚀
