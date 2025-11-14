# Quick Start Guide - Web Application

## 🚀 Quick Start (3 Steps)

### 1. Install Dependencies

**Backend:**
```bash
cd GUIs/backend
pip install -r requirements-backend.txt
```

**Frontend:**
```bash
cd GUIs/frontend
npm install
```

### 2. Start the Application

**Option A - Using the Launch Script (Recommended):**
```bash
# From TTM root directory
chmod +x start_web_app.sh
./start_web_app.sh
```

**Option B - Manual Start:**

Terminal 1 (Backend):
```bash
cd GUIs/backend
python app.py
```

Terminal 2 (Frontend):
```bash
cd GUIs/frontend
npm run dev
```

### 3. Open in Browser

Navigate to: **http://localhost:3000**

## 🌐 Connecting to Remote Backend

### Quick Method (No Restart Required)

1. Open the frontend in your browser
2. Click the **"🔗 Backend"** button in the toolbar (top-left)
3. Enter your backend URL (e.g., `http://192.168.1.100:8000`)
4. Click **"Test Connection"** to verify
5. Click **"Save & Apply"**

### Environment Variable Method

Create `.env.local` in the frontend directory:
```bash
cd GUIs/frontend
echo "VITE_API_URL=http://your-server-ip:8000" > .env.local
npm run dev
```

### Running Backend on Remote Server

```bash
# SSH into your remote server
ssh user@your-server

# Start backend (accessible from network)
cd TTM/GUIs/backend
python app.py
# Backend runs on 0.0.0.0:8000

# Find server IP
hostname -I
# Example output: 192.168.1.100

# Make sure firewall allows port 8000
sudo ufw allow 8000/tcp
```

Then from any device on the same network, use `http://192.168.1.100:8000` as your backend URL.

## 🎯 Basic Usage Flow

1. **Select Image** → Upload your base image/video
2. **Add Polygon** → Click to draw polygon points, right-click to finish
3. **Move & Transform** → Drag polygon to new position
4. **End Segment** → Record the movement keyframe
5. **Repeat** → Add more movements
6. **Save** → Download generated video

## 🔧 Features Overview

### Core Features
- ✅ Polygon drawing with multi-point support
- ✅ Keyframe-based animation
- ✅ Position, rotation, and scale transforms
- ✅ Hue color adjustment per segment
- ✅ External sprite overlay
- ✅ Motion video + mask generation

### Keyboard Shortcuts (in polygon mode)
- **Left Click** - Add polygon point
- **Right Click** - Finish polygon / End segment
- **Backspace** - Remove last point
- **Esc** - Cancel polygon drawing

## 📁 Output Files

When you click Save, you'll get a ZIP file containing:
- `first_frame.png` - The base frame
- `motion_signal.mp4` - Animated motion video
- `mask.mp4` - Alpha mask video
- `prompt.txt` - Your text prompt

## 🆚 Comparison with PySide6 Version

| Feature | PySide6 GUI | Web App |
|---------|-------------|---------|
| Polygon Drawing | ✅ | ✅ |
| Keyframe Animation | ✅ | ✅ |
| Hue Transform | ✅ | ✅ |
| External Sprites | ✅ | ✅ |
| Transform Handles | ✅ Visual | ⚠️ Simplified |
| Real-time Preview | ✅ Full | ⚠️ Basic |
| Cross-platform | Desktop only | ✅ Any browser |

## ⚡ Tips

- **Start small**: Use low resolution images first to test
- **Smooth motion**: Add more keyframes for smoother animations
- **External sprites**: Great for adding overlay elements
- **Hue adjust**: Change colors without re-drawing
- **Save often**: Export your work regularly

## 🐛 Common Issues

**Port already in use:**
```bash
# Kill processes on ports 3000 and 8000
lsof -ti:3000 | xargs kill -9
lsof -ti:8000 | xargs kill -9
```

**Backend not connecting:**
- Ensure backend is running on port 8000
- Check `GUIs/backend/backend.log` for errors

**Canvas not showing:**
- Refresh the browser
- Check browser console (F12) for errors

## 📚 Learn More

- Full documentation: `GUIs/README_WEB.md`
- API documentation: http://localhost:8000/docs (when backend is running)
- Original GUI: `GUIs/README.md`
