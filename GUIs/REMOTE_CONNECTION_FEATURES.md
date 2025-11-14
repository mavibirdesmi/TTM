# Remote Backend Connection - Feature Summary

## 🎯 What's New

The TTM Web Application frontend now supports connecting to remote FastAPI backends, enabling flexible deployment scenarios like:

- Running backend on a GPU server while accessing from your laptop
- Team collaboration with centralized backend
- Cloud-based deployments
- Cross-platform access (desktop, tablet, mobile)

## 📦 Files Added/Modified

### New Files Created

1. **`GUIs/frontend/.env.example`**
   - Environment variable template
   - Examples for local, network, and cloud configurations

2. **`GUIs/frontend/src/components/ApiConfig.jsx`**
   - Modal dialog for runtime API configuration
   - Connection testing
   - URL presets
   - Persistent storage (localStorage)

3. **`GUIs/frontend/src/components/ApiConfig.css`**
   - Styling for configuration modal

4. **`GUIs/REMOTE_ACCESS.md`**
   - Comprehensive guide for remote setup
   - Security considerations
   - Troubleshooting tips
   - Network setup examples

### Modified Files

1. **`GUIs/frontend/vite.config.js`**
   - Now reads `VITE_API_URL` environment variable for proxy configuration

2. **`GUIs/frontend/src/App.jsx`**
   - Dynamic API URL support
   - Runtime API URL changes
   - localStorage persistence
   - ApiConfig modal integration

3. **`GUIs/frontend/src/components/Toolbar.jsx`**
   - Added "Backend" status button
   - Shows current backend (Local/Remote)
   - Opens configuration modal

4. **`GUIs/frontend/src/components/Toolbar.css`**
   - Styling for backend status section

5. **`GUIs/README_WEB.md`**
   - Added "Connecting to Remote Backend" section
   - Remote server setup instructions
   - Security notes

6. **`GUIs/QUICKSTART_WEB.md`**
   - Quick remote connection instructions

7. **`README.md`**
   - Highlighted remote access capability

## 🚀 How to Use

### Method 1: Runtime Configuration (Easiest)

1. Start frontend: `npm run dev`
2. Click "🔗 Backend" button in toolbar
3. Enter backend URL (e.g., `http://192.168.1.100:8000`)
4. Click "Test Connection"
5. Click "Save & Apply"

### Method 2: Environment Variable

```bash
cd GUIs/frontend
echo "VITE_API_URL=http://your-server:8000" > .env.local
npm run dev
```

### Method 3: Vite Config

Edit `vite.config.js` proxy target directly.

## 🔒 Security Features

- CORS configuration in backend
- Environment-based settings
- HTTPS support via reverse proxy
- Firewall configuration guidance
- Production security checklist

## 📊 Use Cases

### Development
- **Local**: Both services on same machine
- **Split**: Backend on GPU desktop, frontend on laptop

### Production
- **Cloud**: Both on cloud server, access from anywhere
- **Hybrid**: Backend on-premise, frontend in cloud
- **Team**: Shared backend, multiple frontends

## ✨ Key Features

✅ **Zero-config default** - Works locally out of the box
✅ **Runtime switching** - Change backend without restart
✅ **Connection testing** - Verify before switching
✅ **Persistent settings** - Saved in browser localStorage
✅ **Visual feedback** - Shows current backend in toolbar
✅ **Multiple methods** - Environment var, UI, or config file
✅ **Security guidance** - Production setup instructions

## 🎨 UI Components

### Backend Status Indicator
```
┌─────────────────────┐
│ Backend:            │
│ ┌─────────────────┐ │
│ │ 🔗 Local        │ │  ← Click to configure
│ └─────────────────┘ │
└─────────────────────┘
```

### Configuration Modal
```
┌──────────────────────────────────┐
│ API Configuration            × │
├──────────────────────────────────┤
│ Backend API URL:                 │
│ ┌──────────────────────────────┐ │
│ │ http://192.168.1.100:8000    │ │
│ └──────────────────────────────┘ │
│                                  │
│ Quick Presets:                   │
│ [Local] [Local IP]               │
│                                  │
│ [Test Connection]                │
│ ✓ Connection successful!         │
│                                  │
│ Current: http://localhost:8000   │
├──────────────────────────────────┤
│              [Cancel] [Save &    │
│                       Apply]     │
└──────────────────────────────────┘
```

## 📖 Documentation Structure

```
GUIs/
├── README_WEB.md           # Main web app documentation
├── QUICKSTART_WEB.md       # Quick start guide
├── REMOTE_ACCESS.md        # 🆕 Detailed remote setup guide
└── frontend/
    └── .env.example        # 🆕 Environment configuration template
```

## 🔧 Technical Implementation

### Data Flow
```
User Input → ApiConfig Modal → localStorage → App State → API Calls
                                    ↓
                              Environment Variable (.env.local)
```

### URL Priority
1. Runtime configuration (localStorage)
2. Environment variable (VITE_API_URL)
3. Default (http://localhost:8000)

### State Management
- API URL stored in App state
- Persisted to localStorage on save
- Read on app initialization
- Page reload on URL change

## 🧪 Testing Checklist

- [ ] Local connection (localhost:8000)
- [ ] Network connection (192.168.x.x:8000)
- [ ] Connection test feature works
- [ ] Settings persist after reload
- [ ] Invalid URL handling
- [ ] Timeout handling
- [ ] CORS headers correct
- [ ] Firewall configured
- [ ] HTTPS proxy setup (production)

## 📝 Next Steps for Users

1. **Try it locally first** - Make sure everything works
2. **Test on network** - Use IP address to connect
3. **Secure for production** - Follow security guide
4. **Monitor performance** - Check backend logs
5. **Scale if needed** - Add load balancing

## 🆘 Troubleshooting Quick Reference

| Issue | Solution |
|-------|----------|
| Can't connect | Check firewall, verify backend is on 0.0.0.0 |
| CORS error | Update allow_origins in backend |
| Connection timeout | Check network, ping server |
| 404 errors | Verify URL doesn't include /api |
| Mixed content warning | Use HTTPS for both or HTTP for both |

## 🎓 Learn More

- [Full Web App Documentation](README_WEB.md)
- [Remote Access Guide](REMOTE_ACCESS.md)
- [Quick Start](QUICKSTART_WEB.md)
- [Main README](../README.md)
