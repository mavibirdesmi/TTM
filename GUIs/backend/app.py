# Copyright 2025 Noam Rotstein
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, FileResponse
from pydantic import BaseModel
from typing import List, Optional, Dict, Tuple
import cv2
import numpy as np
import imageio
import os
import io
import base64
import sys
import tempfile
import shutil
from dataclasses import dataclass, field

# Add parent directory to path for imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

app = FastAPI(title="Time-to-Move Cut & Drag API")

# CORS middleware to allow frontend connections
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify your frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global state (in production, use a database or session management)
sessions: Dict[str, "Session"] = {}

# ==================== DATA MODELS ====================

class Point(BaseModel):
    x: float
    y: float

class Keyframe(BaseModel):
    pos: List[float]  # [x, y]
    rot_deg: float
    scale: float
    hue_deg: float = 0.0

class Layer(BaseModel):
    name: str
    polygon_xy: Optional[List[List[float]]] = None
    origin_local_xy: Optional[List[float]] = None
    is_external: bool = False
    keyframes: List[Keyframe] = []
    color: List[int] = [255, 99, 99]  # RGB

class CreateSessionRequest(BaseModel):
    session_id: str

class UploadImageRequest(BaseModel):
    session_id: str
    fit_mode: str = "Center Crop"  # or "Center Pad"

class AddPolygonRequest(BaseModel):
    session_id: str
    layer_name: str
    polygon_points: List[Point]
    is_external: bool = False

class AddKeyframeRequest(BaseModel):
    session_id: str
    layer_name: str
    keyframe: Keyframe

class AddExternalSpriteRequest(BaseModel):
    session_id: str
    layer_name: str

class GenerateVideoRequest(BaseModel):
    session_id: str
    fps: int = 16
    total_frames: int = 81
    prompt: str = ""

class UpdateHueRequest(BaseModel):
    session_id: str
    layer_name: str
    hue_deg: float

# ==================== SESSION STATE ====================

@dataclass
class Session:
    session_id: str
    base_bgr: Optional[np.ndarray] = None
    base_preview_bgr: Optional[np.ndarray] = None
    layers: List[Dict] = field(default_factory=list)
    target_w: int = 720
    target_h: int = 480
    fit_mode: str = "Center Crop"

# ==================== UTILITY FUNCTIONS (from original script) ====================

def load_first_frame(file_bytes: bytes, filename: str) -> np.ndarray:
    """Load first frame from image or video bytes"""
    low = filename.lower()
    
    if low.endswith((".mp4", ".mov", ".avi", ".mkv")):
        # Save to temp file for video reading
        with tempfile.NamedTemporaryFile(delete=False, suffix=os.path.splitext(filename)[1]) as tmp:
            tmp.write(file_bytes)
            tmp_path = tmp.name
        
        try:
            cap = cv2.VideoCapture(tmp_path)
            ok, frame = cap.read()
            cap.release()
            if not ok:
                raise RuntimeError("Failed to read first frame from video")
            return frame
        finally:
            os.unlink(tmp_path)
    else:
        # Image file
        nparr = np.frombuffer(file_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if img is None:
            raise RuntimeError("Failed to read image")
        return img

def resize_then_center_crop(img: np.ndarray, target_h: int, target_w: int, interpolation=cv2.INTER_NEAREST) -> np.ndarray:
    h, w = img.shape[:2]
    scale = max(target_w / float(w), target_h / float(h))
    new_w, new_h = int(round(w * scale)), int(round(h * scale))
    resized = cv2.resize(img, (new_w, new_h), interpolation=interpolation)
    y0 = (new_h - target_h) // 2
    x0 = (new_w - target_w) // 2
    return resized[y0:y0 + target_h, x0:x0 + target_w]

def fit_center_pad(img: np.ndarray, target_h: int, target_w: int, interpolation=cv2.INTER_NEAREST) -> np.ndarray:
    h, w = img.shape[:2]
    scale_h = target_h / float(h)
    new_w_hfirst = int(round(w * scale_h))
    new_h_hfirst = target_h
    if new_w_hfirst <= target_w:
        resized = cv2.resize(img, (new_w_hfirst, new_h_hfirst), interpolation=interpolation)
        result = np.zeros((target_h, target_w, 3), dtype=np.uint8)
        x0 = (target_w - new_w_hfirst) // 2
        result[:, x0:x0 + new_w_hfirst] = resized
        return result
    scale_w = target_w / float(w)
    new_w_wfirst = target_w
    new_h_wfirst = int(round(h * scale_w))
    resized = cv2.resize(img, (new_w_wfirst, new_h_wfirst), interpolation=interpolation)
    result = np.zeros((target_h, target_w, 3), dtype=np.uint8)
    y0 = (target_h - new_h_wfirst) // 2
    result[y0:y0 + new_h_wfirst, :] = resized
    return result

def apply_hue_shift_bgr(img_bgr: np.ndarray, hue_deg: float) -> np.ndarray:
    """Rotate hue by hue_deg (degrees) in HSV space. S and V unchanged."""
    if abs(hue_deg) < 1e-6:
        return img_bgr.copy()
    hsv = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2HSV)
    h = hsv[:, :, 0].astype(np.int16)
    offset = int(round((hue_deg / 360.0) * 179.0))
    h = (h + offset) % 180
    hsv[:, :, 0] = h.astype(np.uint8)
    return cv2.cvtColor(hsv, cv2.COLOR_HSV2BGR)

def alpha_over(bg_bgr: np.ndarray, fg_rgba: np.ndarray) -> np.ndarray:
    a = (fg_rgba[:, :, 3:4].astype(np.float32) / 255.0)
    if a.max() == 0:
        return bg_bgr.copy()
    fg = fg_rgba[:, :, :3].astype(np.float32)
    bg = bg_bgr.astype(np.float32)
    out = fg * a + bg * (1.0 - a)
    return np.clip(out, 0, 255).astype(np.uint8)

def inpaint_background(image_bgr: np.ndarray, mask_bool: np.ndarray) -> np.ndarray:
    mask = (mask_bool.astype(np.uint8) * 255)
    return cv2.inpaint(image_bgr, mask, 3, cv2.INPAINT_TELEA)

def animate_polygon(image_bgr, polygon_xy, path_xy, scales, rotations_deg, interp=cv2.INTER_LINEAR, origin_xy=None):
    """
    Returns list of RGBA frames and list of transformed polygons per frame.
    """
    h, w = image_bgr.shape[:2]
    frames_rgba = []
    polys_per_frame = []

    if origin_xy is None:
        if len(path_xy) == 0:
            raise ValueError("animate_polygon: path_xy is empty and origin_xy not provided.")
        origin = np.asarray(path_xy[0], dtype=np.float32)
    else:
        origin = np.asarray(origin_xy, dtype=np.float32)

    for i in range(len(path_xy)):
        theta = np.deg2rad(rotations_deg[i]).astype(np.float32)
        s = float(scales[i])
        a11 = s * np.cos(theta); a12 = -s * np.sin(theta)
        a21 = s * np.sin(theta); a22 =  s * np.cos(theta)
        tx = path_xy[i, 0] - (a11 * origin[0] + a12 * origin[1])
        ty = path_xy[i, 1] - (a21 * origin[0] + a22 * origin[1])
        M = np.array([[a11, a12, tx], [a21, a22, ty]], dtype=np.float32)

        warped = cv2.warpAffine(image_bgr, M, (w, h), flags=interp,
                                borderMode=cv2.BORDER_REPLICATE)

        poly = np.asarray(polygon_xy, dtype=np.float32)
        pts1 = np.hstack([poly, np.ones((len(poly), 1), dtype=np.float32)])
        poly_t = (M @ pts1.T).T
        polys_per_frame.append(poly_t.astype(np.float32))

        mask = np.zeros((h, w), dtype=np.uint8)
        cv2.fillPoly(mask, [poly_t.astype(np.int32)], 255)

        rgba = np.zeros((h, w, 4), dtype=np.uint8)
        rgba[:, :, :3] = warped
        rgba[:, :, 3] = mask
        frames_rgba.append(rgba)

    return frames_rgba, polys_per_frame

def composite_frames(background_bgr, list_of_layer_frame_lists):
    frames = []
    T = len(list_of_layer_frame_lists[0]) if list_of_layer_frame_lists else 0
    for t in range(T):
        frame = background_bgr.copy()
        for layer in list_of_layer_frame_lists:
            frame = alpha_over(frame, layer[t])
        frames.append(frame)
    return frames

def save_video_mp4(frames_bgr, path, fps=24):
    """Write MP4 using imageio"""
    if not frames_bgr:
        raise ValueError("No frames to save")

    h, w = frames_bgr[0].shape[:2]
    out_frames = []
    for f in frames_bgr:
        if f is None:
            raise RuntimeError("Encountered None frame")
        if f.ndim == 2:
            f = cv2.cvtColor(f, cv2.COLOR_GRAY2BGR)
        elif f.shape[2] == 4:
            f = cv2.cvtColor(f, cv2.COLOR_BGRA2BGR)
        elif f.shape[2] != 3:
            raise RuntimeError("Frames must be gray, BGR, or BGRA")
        if f.shape[:2] != (h, w):
            raise RuntimeError("Frame size mismatch during save.")
        if f.dtype != np.uint8:
            f = np.clip(f, 0, 255).astype(np.uint8)
        out_frames.append(cv2.cvtColor(f, cv2.COLOR_BGR2RGB))

    hh = h - (h % 2)
    ww = w - (w % 2)
    if (hh != h) or (ww != w):
        out_frames = [frm[:hh, :ww] for frm in out_frames]

    ffmpeg_common = ['-movflags', '+faststart',
                     '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709',
                     '-tag:v', 'avc1']
    try:
        writer = imageio.get_writer(
            path, format='ffmpeg', fps=float(fps),
            codec='libx264', pixelformat='yuv420p',
            ffmpeg_params=ffmpeg_common
        )
    except Exception:
        writer = imageio.get_writer(
            path, format='ffmpeg', fps=float(fps),
            codec='mpeg4', pixelformat='yuv420p',
            ffmpeg_params=['-movflags', '+faststart']
        )

    try:
        for frm in out_frames:
            writer.append_data(frm)
    finally:
        writer.close()

    return path

def bgr_to_base64(img_bgr: np.ndarray) -> str:
    """Convert BGR image to base64 encoded PNG"""
    _, buffer = cv2.imencode('.png', img_bgr)
    return base64.b64encode(buffer).decode('utf-8')

def sample_keyframes_constant_speed_with_seg(keyframes: List[Dict], T: int):
    """Sample keyframes with constant speed"""
    K = len(keyframes)
    if K < 1:
        raise ValueError("Need at least 1 keyframe")
    
    if T <= 0:
        return (np.zeros((0, 2), np.float32),
                np.zeros((0,), np.float32),
                np.zeros((0,), np.float32),
                np.zeros((0,), np.int32),
                np.zeros((0,), np.float32))

    if K == 1:
        p0 = np.array(keyframes[0]['pos'], dtype=np.float32)
        pos = np.repeat(p0[None, :], T, axis=0)
        scl = np.full((T,), float(keyframes[0]['scale']), dtype=np.float32)
        rot = np.full((T,), float(keyframes[0]['rot_deg']), dtype=np.float32)
        seg_idx = np.zeros((T,), dtype=np.int32)
        t = np.zeros((T,), dtype=np.float32)
        return pos, scl, rot, seg_idx, t

    P = np.array([kf['pos'] for kf in keyframes], dtype=np.float32)
    seg_vec = P[1:] - P[:-1]
    lengths = np.linalg.norm(seg_vec, axis=1)
    total_len = float(lengths.sum())

    if total_len <= 1e-6:
        q, r = divmod(T, K-1)
        counts = np.full((K-1,), q, dtype=np.int32)
        counts[:r] += 1
    else:
        raw = (lengths / total_len) * T
        base = np.floor(raw).astype(np.int32)
        remainder = T - int(base.sum())
        if remainder > 0:
            order = np.argsort(-(raw - base))
            base[order[:remainder]] += 1
        counts = base

    pos_list, scl_list, rot_list, seg_idx_list, t_list = [], [], [], [], []

    for s in range(K - 1):
        n = int(counts[s])
        if n <= 0:
            continue
        ts = np.linspace(0.0, 1.0, n, endpoint=False, dtype=np.float32)

        p0, p1 = P[s], P[s + 1]
        s0 = max(1e-6, float(keyframes[s]['scale']))
        s1 = max(1e-6, float(keyframes[s + 1]['scale']))
        r0 = float(keyframes[s]['rot_deg'])
        r1 = float(keyframes[s + 1]['rot_deg'])

        pos_seg = (1 - ts)[:, None] * p0[None, :] + ts[:, None] * p1[None, :]
        scl_seg = np.exp((1 - ts) * np.log(s0) + ts * np.log(s1))
        rot_seg = (1 - ts) * r0 + ts * r1

        pos_list.append(pos_seg.astype(np.float32))
        scl_list.append(scl_seg.astype(np.float32))
        rot_list.append(rot_seg.astype(np.float32))
        seg_idx_list.append(np.full((n,), s, dtype=np.int32))
        t_list.append(ts.astype(np.float32))

    N = sum(int(c) for c in counts)
    if N < T:
        p_end = P[-1].astype(np.float32)
        extra = T - N
        pos_list.append(np.repeat(p_end[None, :], extra, axis=0))
        scl_list.append(np.full((extra,), float(keyframes[-1]['scale']), dtype=np.float32))
        rot_list.append(np.full((extra,), float(keyframes[-1]['rot_deg']), dtype=np.float32))
        seg_idx_list.append(np.full((extra,), max(0, K - 2), dtype=np.int32))
        t_list.append(np.zeros((extra,), dtype=np.float32))

    pos = np.vstack(pos_list) if pos_list else np.zeros((T, 2), dtype=np.float32)
    scl = np.concatenate(scl_list) if scl_list else np.zeros((T,), dtype=np.float32)
    rot = np.concatenate(rot_list) if rot_list else np.zeros((T,), dtype=np.float32)
    seg_idx = np.concatenate(seg_idx_list) if seg_idx_list else np.zeros((T,), dtype=np.int32)
    t_arr = np.concatenate(t_list) if t_list else np.zeros((T,), dtype=np.float32)

    if len(pos) > T:
        pos, scl, rot, seg_idx, t_arr = pos[:T], scl[:T], rot[:T], seg_idx[:T], t_arr[:T]
    elif len(pos) < T:
        pad = T - len(pos)
        pos = np.vstack([pos, np.repeat(pos[-1:,:], pad, axis=0)])
        scl = np.concatenate([scl, np.repeat(scl[-1:], pad)])
        rot = np.concatenate([rot, np.repeat(rot[-1:], pad)])
        seg_idx = np.concatenate([seg_idx, np.repeat(seg_idx[-1:], pad)])
        t_arr = np.concatenate([t_arr, np.repeat(t_arr[-1:], pad)])

    return pos.astype(np.float32), scl.astype(np.float32), rot.astype(np.float32), seg_idx.astype(np.int32), t_arr.astype(np.float32)

# ==================== API ENDPOINTS ====================

@app.post("/api/session/create")
async def create_session(request: CreateSessionRequest):
    """Create a new session"""
    session = Session(session_id=request.session_id)
    sessions[request.session_id] = session
    return {"status": "success", "session_id": request.session_id}

@app.post("/api/image/upload")
async def upload_image(session_id: str, file: UploadFile = File(...), fit_mode: str = "Center Crop"):
    """Upload base image"""
    if session_id not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    
    session = sessions[session_id]
    
    # Read file bytes
    contents = await file.read()
    
    # Load first frame
    try:
        raw = load_first_frame(contents, file.filename)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to load image: {str(e)}")
    
    # Process image
    session.fit_mode = fit_mode
    base_for_save = resize_then_center_crop(raw, session.target_h, session.target_w, interpolation=cv2.INTER_AREA)
    session.base_bgr = base_for_save.copy()
    
    if fit_mode == "Center Pad":
        session.base_preview_bgr = fit_center_pad(raw, session.target_h, session.target_w, interpolation=cv2.INTER_NEAREST)
    else:
        session.base_preview_bgr = resize_then_center_crop(raw, session.target_h, session.target_w, interpolation=cv2.INTER_NEAREST)
    
    # Convert to base64 for response
    preview_base64 = bgr_to_base64(session.base_preview_bgr)
    
    return {
        "status": "success",
        "image": preview_base64,
        "width": session.target_w,
        "height": session.target_h
    }

@app.post("/api/layer/add-polygon")
async def add_polygon(request: AddPolygonRequest):
    """Add a polygon layer"""
    if request.session_id not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    
    session = sessions[request.session_id]
    
    if session.base_bgr is None:
        raise HTTPException(status_code=400, detail="No base image loaded")
    
    # Convert points to numpy array
    polygon_xy = np.array([[p.x, p.y] for p in request.polygon_points], dtype=np.float32)
    
    if len(polygon_xy) < 3:
        raise HTTPException(status_code=400, detail="Need at least 3 points for polygon")
    
    # Calculate origin (bbox center)
    x0, y0 = polygon_xy.min(axis=0)
    x1, y1 = polygon_xy.max(axis=0)
    cx, cy = (x0 + x1) / 2.0, (y0 + y1) / 2.0
    
    layer_data = {
        "name": request.layer_name,
        "polygon_xy": polygon_xy.tolist(),
        "origin_local_xy": [cx, cy],
        "is_external": request.is_external,
        "keyframes": [],
        "source_bgr": session.base_bgr.tolist() if not request.is_external else None,
        "color": [255, 99, 99]  # Default red color
    }
    
    session.layers.append(layer_data)
    
    return {"status": "success", "layer": layer_data}

@app.post("/api/layer/add-keyframe")
async def add_keyframe(request: AddKeyframeRequest):
    """Add a keyframe to a layer"""
    if request.session_id not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    
    session = sessions[request.session_id]
    
    # Find layer
    layer = None
    for l in session.layers:
        if l["name"] == request.layer_name:
            layer = l
            break
    
    if layer is None:
        raise HTTPException(status_code=404, detail="Layer not found")
    
    keyframe_data = {
        "pos": request.keyframe.pos,
        "rot_deg": request.keyframe.rot_deg,
        "scale": request.keyframe.scale,
        "hue_deg": request.keyframe.hue_deg
    }
    
    layer["keyframes"].append(keyframe_data)
    
    return {"status": "success", "keyframe": keyframe_data}

@app.post("/api/sprite/upload")
async def upload_external_sprite(session_id: str, file: UploadFile = File(...)):
    """Upload external sprite image"""
    if session_id not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    
    session = sessions[session_id]
    
    if session.base_bgr is None:
        raise HTTPException(status_code=400, detail="No base image loaded")
    
    # Read file bytes
    contents = await file.read()
    
    # Load sprite
    try:
        raw_bgr = load_first_frame(contents, file.filename)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to load sprite: {str(e)}")
    
    H, W = session.base_bgr.shape[:2]
    h0, w0 = raw_bgr.shape[:2]
    
    # Resize sprite to 60% of base height
    target_h = int(0.6 * H)
    scale = target_h / float(h0)
    ew = int(round(w0 * scale))
    eh = int(round(h0 * scale))
    ext_small = cv2.resize(raw_bgr, (ew, eh), interpolation=cv2.INTER_AREA)
    
    # Create source_bgr on same canvas size
    px = (W - ew) // 2
    py = (H - eh) // 2
    source_bgr = np.zeros((H, W, 3), dtype=np.uint8)
    x0 = max(px, 0); y0 = max(py, 0)
    x1 = min(px + ew, W); y1 = min(py + eh, H)
    if x0 < x1 and y0 < y1:
        sx0 = x0 - px; sy0 = y0 - py
        sx1 = sx0 + (x1 - x0); sy1 = sy0 + (y1 - y0)
        source_bgr[y0:y1, x0:x1] = ext_small[sy0:sy1, sx0:sx1]
    
    rect_poly = np.array([[px, py], [px+ew, py], [px+ew, py+eh], [px, py+eh]], dtype=np.float32)
    cx, cy = px + ew/2.0, py + eh/2.0
    
    layer_data = {
        "name": f"Sprite_{len(session.layers)+1}",
        "polygon_xy": rect_poly.tolist(),
        "origin_local_xy": [cx, cy],
        "is_external": True,
        "keyframes": [],
        "source_bgr": source_bgr.tolist(),
        "color": [99, 155, 255]  # Blue color
    }
    
    session.layers.append(layer_data)
    
    return {"status": "success", "layer": layer_data}

@app.post("/api/video/generate")
async def generate_video(request: GenerateVideoRequest):
    """Generate motion video and mask"""
    if request.session_id not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    
    session = sessions[request.session_id]
    
    if session.base_bgr is None or not session.layers:
        raise HTTPException(status_code=400, detail="Need base image and at least one layer")
    
    H, W = session.base_bgr.shape[:2]
    
    # Build background (inpaint base regions)
    total_mask = np.zeros((H, W), dtype=bool)
    for layer in session.layers:
        if layer.get("polygon_xy") is None or layer.get("is_external"):
            continue
        poly0 = np.array(layer["polygon_xy"], dtype=np.int32)
        m = np.zeros((H, W), dtype=np.uint8)
        cv2.fillPoly(m, [poly0], 255)
        total_mask |= (m > 0)
    
    background = inpaint_background(session.base_bgr, total_mask)
    
    # Generate frames for each layer
    all_layer_frames = []
    for layer in session.layers:
        if layer.get("polygon_xy") is None or len(layer.get("keyframes", [])) < 2:
            continue
        
        polygon_xy = np.array(layer["polygon_xy"], dtype=np.float32)
        keyframes = layer["keyframes"]
        source_bgr = np.array(layer["source_bgr"], dtype=np.uint8) if layer.get("source_bgr") else session.base_bgr
        origin_xy = np.array(layer["origin_local_xy"], dtype=np.float32) if layer.get("origin_local_xy") else polygon_xy.mean(axis=0)
        
        path_xy, scales, rots, seg_idx, t = sample_keyframes_constant_speed_with_seg(keyframes, request.total_frames)
        
        # Precompute animations for each keyframe's hue
        K = len(keyframes)
        hue_values = [kf.get('hue_deg', 0.0) for kf in keyframes]
        hue_to_frames: Dict[int, List[np.ndarray]] = {}
        
        for k in range(K):
            bgr_h = apply_hue_shift_bgr(source_bgr, hue_values[k])
            frames_h, _ = animate_polygon(bgr_h, polygon_xy, path_xy, scales, rots,
                                         interp=cv2.INTER_LINEAR, origin_xy=origin_xy)
            hue_to_frames[k] = frames_h
        
        # Mix per frame
        frames_rgba = []
        for i in range(request.total_frames):
            s = int(seg_idx[i])
            w = float(t[i])
            A = hue_to_frames[s][i].astype(np.float32)
            B = hue_to_frames[s+1][i].astype(np.float32)
            mix = (1.0 - w) * A + w * B
            frames_rgba.append(np.clip(mix, 0, 255).astype(np.uint8))
        
        all_layer_frames.append(frames_rgba)
    
    if not all_layer_frames:
        raise HTTPException(status_code=400, detail="No motion segments found")
    
    frames_out = composite_frames(background, all_layer_frames)
    
    # Build mask frames
    mask_frames = []
    for t_idx in range(request.total_frames):
        m = np.zeros((H, W), dtype=np.uint16)
        for Lframes in all_layer_frames:
            m += Lframes[t_idx][:, :, 3].astype(np.uint16)
        m = np.clip(m, 0, 255).astype(np.uint8)
        mask_frames.append(m)
    
    # Save to temporary directory
    temp_dir = tempfile.mkdtemp()
    
    try:
        first_frame_path = os.path.join(temp_dir, "first_frame.png")
        motion_path = os.path.join(temp_dir, "motion_signal.mp4")
        mask_path = os.path.join(temp_dir, "mask.mp4")
        prompt_path = os.path.join(temp_dir, "prompt.txt")
        
        # Save files
        cv2.imwrite(first_frame_path, session.base_bgr)
        save_video_mp4(frames_out, motion_path, fps=request.fps)
        save_video_mp4([cv2.cvtColor(m, cv2.COLOR_GRAY2BGR) for m in mask_frames], mask_path, fps=request.fps)
        
        with open(prompt_path, 'w', encoding='utf-8') as f:
            f.write(request.prompt)
        
        # Create zip archive
        import zipfile
        zip_path = os.path.join(temp_dir, "output.zip")
        with zipfile.ZipFile(zip_path, 'w') as zipf:
            zipf.write(first_frame_path, "first_frame.png")
            zipf.write(motion_path, "motion_signal.mp4")
            zipf.write(mask_path, "mask.mp4")
            zipf.write(prompt_path, "prompt.txt")
        
        return FileResponse(
            zip_path,
            media_type="application/zip",
            filename="ttm_output.zip"
        )
    
    except Exception as e:
        shutil.rmtree(temp_dir, ignore_errors=True)
        raise HTTPException(status_code=500, detail=f"Failed to generate video: {str(e)}")

@app.get("/api/session/{session_id}/state")
async def get_session_state(session_id: str):
    """Get current session state"""
    if session_id not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    
    session = sessions[session_id]
    
    return {
        "session_id": session.session_id,
        "has_base_image": session.base_bgr is not None,
        "layers": session.layers,
        "target_w": session.target_w,
        "target_h": session.target_h,
        "fit_mode": session.fit_mode
    }

@app.delete("/api/session/{session_id}")
async def delete_session(session_id: str):
    """Delete a session"""
    if session_id not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    
    del sessions[session_id]
    return {"status": "success"}

@app.get("/")
async def root():
    return {"message": "Time-to-Move Cut & Drag API", "version": "1.0.0"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
