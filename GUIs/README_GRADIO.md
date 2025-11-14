# Gradio GUI for Cut & Drag

This is a web-based version of the Cut & Drag GUI using Gradio. It provides the same core functionality as the PySide6 version but runs in a web browser.

## Features

- Load base images or videos (extracts first frame)
- Define polygon regions using JSON coordinates
- Add keyframes with position, rotation, scale, and hue transformations
- Generate preview animations
- Save output videos (motion signal and mask)

## Installation

Make sure you have all the required packages installed:

```bash
pip install -r ../requirements.txt
```

## Running the GUI

```bash
python cut_and_drag_gradio.py
```

The interface will be available at `http://localhost:7860`

## Usage

### 1. Load Base Image

1. Upload an image or video file
2. Select the fit mode (Center Crop or Center Pad)
3. Click "Load Image"

### 2. Define Polygon Regions

Since Gradio doesn't have an interactive polygon drawing tool like PySide6, you need to specify polygon coordinates using JSON format:

```json
{
  "points": [
    {"x": 100, "y": 100},
    {"x": 200, "y": 100},
    {"x": 200, "y": 200},
    {"x": 100, "y": 200}
  ]
}
```

**Tips for getting coordinates:**
- Open your image in an image editor (GIMP, Photoshop, etc.)
- Note down the coordinates of the polygon vertices
- The coordinate system: (0,0) is top-left, with default image size 720x480

You can also optionally apply an initial hue shift to the polygon region.

### 3. Add Keyframes

For each polygon layer, add keyframes to define the motion path:

1. Select the layer index (0 for first layer, 1 for second, etc.)
2. Set the position (X, Y coordinates)
3. Set rotation (-180 to 180 degrees)
4. Set scale (0.1 to 5.0)
5. Set hue shift (-180 to 180 degrees)
6. Click "Add Keyframe"

**Note:** You need at least 2 keyframes per layer to create motion.

### 4. Generate Preview

1. Set the FPS (frames per second, 1-60)
2. Set total frames (1-500)
3. Click "Generate Preview"
4. The animation will appear in the preview video player

### 5. Save Output

1. Enter a prompt describing the motion
2. Specify the output directory path
3. Specify a folder name for this animation
4. Click "Save Output"

The following files will be saved:
- `first_frame.png` - The base image
- `motion_signal.mp4` - The animated motion video
- `mask.mp4` - The mask video
- `prompt.txt` - Your text prompt

## Differences from PySide6 Version

### What's Missing

- **Interactive polygon drawing**: You must manually specify coordinates
- **Visual drag/scale/rotate**: All transformations are done via numeric inputs
- **Real-time preview**: No live preview of transformations (only final animation)
- **External sprites**: Not implemented in this version
- **Undo functionality**: Not available

### What's the Same

- Core animation engine (polygon warping, hue shifts, etc.)
- Output format (same files and structure)
- Keyframe interpolation (constant speed motion)

## Example Workflow

```python
# 1. Load an image (via UI)

# 2. Define a polygon for a moving object
# In Polygon Coordinates JSON:
{
  "points": [
    {"x": 150, "y": 200},
    {"x": 250, "y": 200},
    {"x": 250, "y": 300},
    {"x": 150, "y": 300}
  ]
}
# Click "Add Polygon Layer"

# 3. Add first keyframe (starting position)
# Layer Index: 0
# X: 200, Y: 250
# Rotation: 0
# Scale: 1.0
# Hue: 0
# Click "Add Keyframe"

# 4. Add second keyframe (ending position)
# Layer Index: 0
# X: 500, Y: 250
# Rotation: 45
# Scale: 1.5
# Hue: 30
# Click "Add Keyframe"

# 5. Generate preview
# FPS: 16
# Total Frames: 81
# Click "Generate Preview"

# 6. Save output
# Prompt: "A box sliding to the right while rotating and growing"
# Output Directory: /home/user/outputs
# Output Folder Name: sliding_box
# Click "Save Output"
```

## Tips

- Start with simple rectangular polygons to learn the workflow
- Keep the number of polygon vertices reasonable (4-8 points)
- For smooth motion, use 2-3 keyframes per layer
- Preview frequently to check your animation
- The coordinate system matches the processed image size (default 720x480)

## Troubleshooting

**"Please load a base image first"**
- Make sure you've uploaded an image and clicked "Load Image"

**"Need at least 3 points for a polygon"**
- Your JSON must have at least 3 coordinate points

**"Please add at least 2 keyframes to a layer"**
- Each layer needs at least 2 keyframes to create motion

**Preview is blank or corrupted**
- Check that your polygon coordinates are within the image bounds (0-720 for width, 0-480 for height)
- Verify that your keyframe positions are reasonable

## Advanced Usage

For more complex animations:
- Use multiple layers with different polygons
- Vary hue shifts across keyframes for color transitions
- Experiment with different scales and rotations
- Use higher FPS (30-60) for smoother motion
