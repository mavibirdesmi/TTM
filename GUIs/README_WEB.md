# Time-to-Move: Cut & Drag - Web Application

This is a web-based implementation of the Time-to-Move Cut & Drag tool, consisting of a FastAPI backend and a React frontend.

## Architecture

- **Backend**: FastAPI (Python) - Handles image processing, polygon manipulation, keyframe management, and video generation
- **Frontend**: React + Vite - Provides interactive canvas-based UI for polygon drawing and animation control

## Prerequisites

- Python 3.8+ (for backend)
- Node.js 16+ and npm (for frontend)
- FFmpeg (for video generation)

## Installation & Setup

### 1. Backend Setup

```bash
# Navigate to the backend directory
cd GUIs/backend

# Install Python dependencies
pip install -r requirements-backend.txt

# Or using uv (faster)
uv pip install -r requirements-backend.txt
```

### 2. Frontend Setup

```bash
# Navigate to the frontend directory
cd GUIs/frontend

# Install Node.js dependencies
npm install
```

## Running the Application

### Option 1: Run Both Services Separately

**Terminal 1 - Start Backend:**
```bash
cd GUIs/backend
python app.py
```
The backend will start at `http://localhost:8000`

**Terminal 2 - Start Frontend:**
```bash
cd GUIs/frontend
npm run dev
```
The frontend will start at `http://localhost:3000`

### Option 2: Use the Launch Script

```bash
# From the TTM root directory
./start_web_app.sh
```

## Usage

1. **Open your browser** and navigate to `http://localhost:3000`

2. **Select a base image or video** - Click "Select Image" to upload your base media

3. **Draw polygons** - Click "Add Polygon" and click on the canvas to define polygon vertices. Right-click to finish.

4. **Add movement** - Drag the polygon to a new position, scale or rotate it

5. **End segment** - Click "End Segment" to record the keyframe

6. **Repeat** - Continue adding movements and keyframes

7. **Adjust hue** (optional) - Use the Hue Transform slider to change colors for specific segments

8. **Add external sprites** (optional) - Click "Add External Image" to add overlay sprites

9. **Save** - Click "Save" to generate and download the motion video, mask, and first frame as a zip file

## Features

### Implemented Features

✅ Base image/video upload with fit modes (Center Crop / Center Pad)
✅ Polygon drawing with visual feedback
✅ Keyframe management (position, rotation, scale)
✅ Hue transformation per segment
✅ External sprite overlay support
✅ Path visualization between keyframes
✅ Undo functionality
✅ Video generation (motion signal + mask)
✅ Session management
✅ Export as zip file

### Key Differences from Original PySide6 App

- **Canvas**: Uses Konva.js for 2D rendering instead of Qt's QGraphicsView
- **Transform controls**: Simplified drag-based transforms (handles can be added with additional work)
- **Demo playback**: Simplified preview (full frame-by-frame playback requires additional implementation)
- **State management**: Client-server architecture with session-based state

## API Endpoints

### Session Management
- `POST /api/session/create` - Create a new session
- `GET /api/session/{session_id}/state` - Get session state
- `DELETE /api/session/{session_id}` - Delete session

### Image Operations
- `POST /api/image/upload` - Upload base image/video
- `POST /api/sprite/upload` - Upload external sprite

### Layer Operations
- `POST /api/layer/add-polygon` - Add a polygon layer
- `POST /api/layer/add-keyframe` - Add keyframe to layer

### Video Generation
- `POST /api/video/generate` - Generate motion video and mask

## Project Structure

```
GUIs/
├── backend/
│   ├── app.py                      # FastAPI application
│   └── requirements-backend.txt    # Python dependencies
│
└── frontend/
    ├── src/
    │   ├── components/
    │   │   ├── Canvas.jsx          # Main canvas component
    │   │   ├── Canvas.css
    │   │   ├── Toolbar.jsx         # Left toolbar
    │   │   ├── Toolbar.css
    │   │   ├── InstructionBanner.jsx
    │   │   └── InstructionBanner.css
    │   ├── App.jsx                 # Main app component
    │   ├── App.css
    │   ├── main.jsx                # Entry point
    │   └── index.css               # Global styles
    ├── index.html
    ├── vite.config.js              # Vite configuration
    └── package.json                # Node.js dependencies
```

## Troubleshooting

### Backend Issues

**Problem**: "Module not found" errors
- **Solution**: Make sure you installed dependencies: `pip install -r requirements-backend.txt`

**Problem**: Video generation fails
- **Solution**: Ensure FFmpeg is installed and available in PATH

### Frontend Issues

**Problem**: "Cannot connect to backend"
- **Solution**: Make sure backend is running on port 8000

**Problem**: Canvas not rendering
- **Solution**: Check browser console for errors, ensure React dependencies are installed

### General Issues

**Problem**: CORS errors
- **Solution**: The backend is configured to allow all origins in development. For production, update the CORS settings in `app.py`

## Development

### Backend Development

The backend uses FastAPI with automatic API documentation:
- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`

### Frontend Development

The frontend uses Vite with hot module replacement (HMR):
- Changes to `.jsx` files will automatically reload
- The proxy configuration in `vite.config.js` forwards `/api` requests to the backend

## License

Copyright 2025 Noam Rotstein

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
