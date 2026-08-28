# My_Obsidian Deployment Guide

## Overview

My_Obsidian offers multiple deployment options for different use cases, from development to production environments.

## Quick Start Options

### 1. Development Mode (Recommended for testing)
```powershell
# Simple batch file
.\start-dev.bat

# Or PowerShell with more options
.\Start-MyObsidian.ps1 -Mode Development
```

**Features:**
- Starts both frontend and backend servers
- Opens browser automatically
- Hot reload enabled for frontend
- Debug logging enabled
- Ideal for development and testing

### 2. Production Mode (For actual use)
```powershell
# Optimized production launch
.\start-production.bat

# Or PowerShell
.\Start-MyObsidian.ps1 -Mode Production
```

**Features:**
- Builds optimized frontend assets
- Runs backend with multiple workers
- Serves static files efficiently
- Better performance for production use

## Manual Deployment

### Backend Only
```powershell
cd backend
.\venv\Scripts\Activate.ps1
python runner.py
```

### Frontend Only
```powershell
cd My_Obsidian_FrontEnd-main
npm run dev  # Development
npm run build && npm run preview  # Production
```

## Production Deployment Options

### Option 1: Built-in HTTP Servers (Simplest)
Use the provided `start-production.bat` script which:
- Builds the React frontend
- Starts FastAPI with uvicorn workers
- Serves frontend with Python's HTTP server

### Option 2: Using nginx (Recommended for production)
1. Install nginx on your system
2. Build the frontend: `cd My_Obsidian_FrontEnd-main && npm run build`
3. Configure nginx to serve the frontend and proxy API requests

Sample nginx configuration:
```nginx
server {
    listen 80;
    server_name localhost;
    
    # Frontend static files
    location / {
        root /path/to/My_Obsidian_FrontEnd-main/dist;
        try_files $uri $uri/ /index.html;
    }
    
    # API proxy
    location /api/ {
        proxy_pass http://localhost:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### Option 3: Docker Deployment
Create a `Dockerfile` for containerized deployment:

```dockerfile
# Backend Dockerfile
FROM python:3.10
WORKDIR /app
COPY backend/requirements.txt .
RUN pip install -r requirements.txt
COPY backend/ .
EXPOSE 8000
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000"]
```

```dockerfile
# Frontend Dockerfile
FROM node:18 as build
WORKDIR /app
COPY My_Obsidian_FrontEnd-main/package*.json ./
RUN npm install
COPY My_Obsidian_FrontEnd-main/ .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/nginx.conf
EXPOSE 80
```

## Environment Configuration

### Required Environment Variables
- `OPENROUTER_API_KEY`: Your OpenRouter API key for AI features
- `VAULT_PATH`: Path to your Obsidian vault (configured in `backend/config.py`)

### Optional Environment Variables
- `DATABASE_URL`: Custom database connection string
- `API_HOST`: Host for the API server (default: 0.0.0.0)
- `API_PORT`: Port for the API server (default: 8000)
- `FRONTEND_PORT`: Port for the frontend (default: 8080)

## Deployment Checklist

### Before Deployment
- [ ] Set up Python virtual environment
- [ ] Install all backend dependencies
- [ ] Install all frontend dependencies
- [ ] Configure vault path in `backend/config.py`
- [ ] Set OpenRouter API key
- [ ] Test with development mode first

### Production Deployment
- [ ] Build frontend assets: `npm run build`
- [ ] Configure production database
- [ ] Set up reverse proxy (nginx/Apache)
- [ ] Configure SSL certificates
- [ ] Set up monitoring and logging
- [ ] Test all functionality

### Security Considerations
- [ ] Change default ports if needed
- [ ] Configure firewall rules
- [ ] Set up API authentication
- [ ] Regular backup of database and vault
- [ ] Keep dependencies updated

## Troubleshooting

### Common Issues

**Port already in use**
```powershell
# Find process using port
netstat -ano | findstr :8000
# Kill process
taskkill /PID <PID> /F
```

**Frontend not building**
```powershell
# Clear node modules and reinstall
cd My_Obsidian_FrontEnd-main
rm -rf node_modules package-lock.json
npm install
```

**Backend virtual environment issues**
```powershell
# Recreate virtual environment
cd backend
rm -rf venv
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

**Permission issues**
- Run PowerShell as Administrator
- Check execution policy: `Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser`

## Performance Optimization

### Backend
- Use multiple workers: `--workers 4`
- Enable gzip compression
- Use connection pooling for database
- Implement caching for frequently accessed data

### Frontend
- Enable gzip compression on web server
- Use CDN for static assets
- Implement service worker for offline support
- Optimize bundle size

## Monitoring

### Logs
- Backend logs: Check terminal output or configure logging to file
- Frontend logs: Browser developer console
- File watcher logs: `vault_watcher.log`

### Health Checks
- Backend health: `GET /api/stats`
- Frontend health: Check if main page loads
- Database health: Check if notes are loading

## Support

For deployment issues:
1. Check the troubleshooting section
2. Review logs for error messages
3. Verify all prerequisites are met
4. Test with development mode first