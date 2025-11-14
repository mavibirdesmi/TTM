import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import Canvas from './components/Canvas';
import Toolbar from './components/Toolbar';
import InstructionBanner from './components/InstructionBanner';
import ApiConfig from './components/ApiConfig';
import './App.css';

// Get API base URL from environment variable or localStorage or use default
const getInitialApiUrl = () => {
  // Check localStorage first
  const savedUrl = localStorage.getItem('ttm_api_url');
  if (savedUrl) return savedUrl;
  
  // Then check environment variable
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL;
  
  // Default to localhost
  return 'http://localhost:8000';
};

function App() {
  const [apiUrl, setApiUrl] = useState(getInitialApiUrl());
  const [showApiConfig, setShowApiConfig] = useState(false);
  const API_BASE = `${apiUrl}/api`;
  
  console.log('Using API URL:', API_BASE);
  const [sessionId] = useState(() => uuidv4());
  const [baseImage, setBaseImage] = useState(null);
  const [layers, setLayers] = useState([]);
  const [currentLayer, setCurrentLayer] = useState(null);
  const [mode, setMode] = useState('idle'); // idle, draw-polygon, placing-external
  const [fitMode, setFitMode] = useState('Center Crop');
  const [instruction, setInstruction] = useState('Welcome! • Select Image to begin.');
  const [totalFrames, setTotalFrames] = useState(81);
  const [fps, setFps] = useState(16);
  const [hueValue, setHueValue] = useState(0);
  const [prompt, setPrompt] = useState('');
  const [isPlaying, setIsPlaying] = useState(false);
  
  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);
  const externalFileInputRef = useRef(null);

  // Initialize session
  useEffect(() => {
    axios.post(`${API_BASE}/session/create`, { session_id: sessionId })
      .catch(err => console.error('Failed to create session:', err));
  }, [sessionId, API_BASE]);

  const handleApiUrlChange = (newUrl) => {
    setApiUrl(newUrl);
    localStorage.setItem('ttm_api_url', newUrl);
    // Reset session when API URL changes
    window.location.reload();
  };

  const handleSelectImage = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await axios.post(
        `${API_BASE}/image/upload?session_id=${sessionId}&fit_mode=${encodeURIComponent(fitMode)}`,
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      );

      setBaseImage({
        data: `data:image/png;base64,${response.data.image}`,
        width: response.data.width,
        height: response.data.height,
      });
      setLayers([]);
      setCurrentLayer(null);
      setMode('idle');
      setInstruction('Step 1: Add a polygon (Add Polygon), or add an external sprite (Add External Image).');
    } catch (err) {
      console.error('Failed to upload image:', err);
      alert('Failed to upload image: ' + (err.response?.data?.detail || err.message));
    }
  };

  const handleAddPolygon = () => {
    if (!baseImage) {
      alert('Please select an image first.');
      setInstruction('Click "Select Image" to begin.');
      return;
    }

    if (mode === 'draw-polygon') {
      setMode('idle');
      setInstruction('Drag to move, use corner circles to scale, top dot to rotate. Then click "End Segment".');
    } else {
      setMode('draw-polygon');
      setInstruction('Polygon mode: Click to add points. Right-click to finish. Esc to cancel.');
    }
  };

  const handlePolygonComplete = async (points) => {
    if (points.length < 3) {
      alert('Need at least 3 points for polygon');
      return;
    }

    try {
      const layerName = `Layer ${layers.length + 1}`;
      const response = await axios.post(`${API_BASE}/layer/add-polygon`, {
        session_id: sessionId,
        layer_name: layerName,
        polygon_points: points,
        is_external: false,
      });

      const newLayer = {
        ...response.data.layer,
        tempPoints: [],
        currentHue: 0,
      };
      
      // Calculate initial keyframe (first pose)
      const polygon = response.data.layer.polygon_xy;
      const origin = response.data.layer.origin_local_xy;
      
      // Add initial keyframe at origin position
      await axios.post(`${API_BASE}/layer/add-keyframe`, {
        session_id: sessionId,
        layer_name: layerName,
        keyframe: {
          pos: origin,
          rot_deg: 0,
          scale: 1.0,
          hue_deg: 0,
        },
      });

      newLayer.keyframes = [{
        pos: origin,
        rot_deg: 0,
        scale: 1.0,
        hue_deg: 0,
      }];

      setLayers([...layers, newLayer]);
      setCurrentLayer(newLayer);
      setMode('idle');
      setInstruction('Drag to move, scale, rotate. Adjust Hue if you like, then click "End Segment" to record.');
    } catch (err) {
      console.error('Failed to add polygon:', err);
      alert('Failed to add polygon: ' + (err.response?.data?.detail || err.message));
    }
  };

  const handleAddExternalImage = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!baseImage) {
      alert('Select a base image first.');
      return;
    }

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await axios.post(
        `${API_BASE}/sprite/upload?session_id=${sessionId}`,
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      );

      const newLayer = {
        ...response.data.layer,
        tempPoints: [],
        currentHue: 0,
      };

      setLayers([...layers, newLayer]);
      setCurrentLayer(newLayer);
      setMode('placing-external');
      setInstruction('Place External: drag into view, scale, rotate. Then click "Place External Image".');
    } catch (err) {
      console.error('Failed to add external sprite:', err);
      alert('Failed to add external sprite: ' + (err.response?.data?.detail || err.message));
    }
  };

  const handleEndSegment = async () => {
    if (!currentLayer) {
      alert('No layer selected. Add a polygon or sprite first.');
      return;
    }

    // Get current transform from canvas
    const transform = canvasRef.current?.getCurrentTransform();
    if (!transform) {
      alert('No transform data available');
      return;
    }

    try {
      const keyframe = {
        pos: [transform.x, transform.y],
        rot_deg: transform.rotation,
        scale: transform.scale,
        hue_deg: hueValue,
      };

      await axios.post(`${API_BASE}/layer/add-keyframe`, {
        session_id: sessionId,
        layer_name: currentLayer.name,
        keyframe,
      });

      // Update local state
      const updatedLayers = layers.map(l => {
        if (l.name === currentLayer.name) {
          return {
            ...l,
            keyframes: [...(l.keyframes || []), keyframe],
          };
        }
        return l;
      });

      setLayers(updatedLayers);
      setCurrentLayer(updatedLayers.find(l => l.name === currentLayer.name));
      setHueValue(0); // Reset hue for next segment
      setInstruction('Segment added! Move again for the next leg, then click "End Segment".');
    } catch (err) {
      console.error('Failed to add keyframe:', err);
      alert('Failed to add keyframe: ' + (err.response?.data?.detail || err.message));
    }
  };

  const handleUndo = () => {
    if (!currentLayer) return;

    // Remove last keyframe if there are more than 1
    if (currentLayer.keyframes && currentLayer.keyframes.length > 1) {
      const updatedKeyframes = currentLayer.keyframes.slice(0, -1);
      const updatedLayers = layers.map(l => {
        if (l.name === currentLayer.name) {
          return { ...l, keyframes: updatedKeyframes };
        }
        return l;
      });
      
      setLayers(updatedLayers);
      setCurrentLayer(updatedLayers.find(l => l.name === currentLayer.name));
      setInstruction('Undone. Continue editing.');
    } else if (currentLayer.keyframes && currentLayer.keyframes.length === 1) {
      // Remove the layer entirely
      const updatedLayers = layers.filter(l => l.name !== currentLayer.name);
      setLayers(updatedLayers);
      setCurrentLayer(updatedLayers[updatedLayers.length - 1] || null);
      setInstruction('Layer removed. Add a new polygon or sprite.');
    }
  };

  const handlePlayDemo = () => {
    if (!baseImage) {
      alert('Select an image first.');
      return;
    }

    const hasSegments = layers.some(l => l.keyframes && l.keyframes.length >= 2);
    if (!hasSegments) {
      alert('No motion segments yet. Drag something and click "End Segment" at least once.');
      return;
    }

    setIsPlaying(true);
    setInstruction('Playing demo... (Preview functionality - full implementation requires video rendering)');
    
    // Simulate playback
    setTimeout(() => {
      setIsPlaying(false);
      setInstruction('Demo finished. Tweak and play again, or Save.');
    }, (totalFrames / fps) * 1000);
  };

  const handleSave = async () => {
    if (!baseImage || layers.length === 0) {
      alert('Load an image and add at least one polygon/sprite first.');
      return;
    }

    try {
      const response = await axios.post(
        `${API_BASE}/video/generate`,
        {
          session_id: sessionId,
          fps,
          total_frames: totalFrames,
          prompt,
        },
        { responseType: 'blob' }
      );

      // Download the zip file
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'ttm_output.zip');
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
      window.URL.revokeObjectURL(url);

      setInstruction('Saved! You can keep editing or start a New project.');
    } catch (err) {
      console.error('Failed to generate video:', err);
      alert('Failed to save: ' + (err.response?.data?.detail || err.message));
    }
  };

  const handleNew = () => {
    if (window.confirm('Start a new project? Current work will be lost.')) {
      setBaseImage(null);
      setLayers([]);
      setCurrentLayer(null);
      setMode('idle');
      setHueValue(0);
      setPrompt('');
      setInstruction('New project. Click "Select Image" to begin.');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <div className="app">
      <InstructionBanner instruction={instruction} />
      
      <div className="main-content">
        <Toolbar
          fitMode={fitMode}
          onFitModeChange={setFitMode}
          onSelectImage={() => fileInputRef.current?.click()}
          onAddPolygon={handleAddPolygon}
          isAddingPolygon={mode === 'draw-polygon'}
          onAddExternal={() => externalFileInputRef.current?.click()}
          hueValue={hueValue}
          onHueChange={setHueValue}
          onEndSegment={handleEndSegment}
          onUndo={handleUndo}
          totalFrames={totalFrames}
          onTotalFramesChange={setTotalFrames}
          fps={fps}
          onFpsChange={setFps}
          onPlayDemo={handlePlayDemo}
          prompt={prompt}
          onPromptChange={setPrompt}
          onSave={handleSave}
          onNew={handleNew}
          onApiConfig={() => setShowApiConfig(true)}
          apiUrl={apiUrl}
        />

        <div className="canvas-container">
          <Canvas
            ref={canvasRef}
            baseImage={baseImage}
            layers={layers}
            currentLayer={currentLayer}
            mode={mode}
            hueValue={hueValue}
            onPolygonComplete={handlePolygonComplete}
            onModeChange={setMode}
          />
        </div>
      </div>

      {showApiConfig && (
        <ApiConfig
          currentUrl={apiUrl}
          onUrlChange={handleApiUrlChange}
          onClose={() => setShowApiConfig(false)}
        />
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*"
        style={{ display: 'none' }}
        onChange={handleSelectImage}
      />
      
      <input
        ref={externalFileInputRef}
        type="file"
        accept="image/*,video/*"
        style={{ display: 'none' }}
        onChange={handleAddExternalImage}
      />
    </div>
  );
}

export default App;
