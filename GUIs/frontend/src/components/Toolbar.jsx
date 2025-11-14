import React from 'react';
import './Toolbar.css';

function Toolbar({
  fitMode,
  onFitModeChange,
  onSelectImage,
  onAddPolygon,
  isAddingPolygon,
  onAddExternal,
  hueValue,
  onHueChange,
  onEndSegment,
  onUndo,
  totalFrames,
  onTotalFramesChange,
  fps,
  onFpsChange,
  onPlayDemo,
  prompt,
  onPromptChange,
  onSave,
  onNew,
  onApiConfig,
  apiUrl,
}) {
  // Extract hostname from API URL for display
  const getApiHostname = (url) => {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname === 'localhost' ? 'Local' : urlObj.hostname;
    } catch {
      return 'Unknown';
    }
  };

  return (
    <div className="toolbar">
      <div className="toolbar-section api-status">
        <label>Backend:</label>
        <button className="api-status-btn" onClick={onApiConfig} title="Click to change API URL">
          🔗 {getApiHostname(apiUrl)}
        </button>
      </div>

      <div className="toolbar-divider"></div>

      <div className="toolbar-section">
        <label>Fit Mode:</label>
        <select value={fitMode} onChange={(e) => onFitModeChange(e.target.value)}>
          <option value="Center Crop">Center Crop</option>
          <option value="Center Pad">Center Pad</option>
        </select>
      </div>

      <div className="toolbar-divider"></div>

      <button className="toolbar-btn" onClick={onSelectImage}>
        🖼️ Select Image
      </button>

      <button className="toolbar-btn" onClick={onAddPolygon}>
        {isAddingPolygon ? '✅ Finish Polygon Selection' : 'Add Polygon'}
      </button>

      <button className="toolbar-btn" onClick={onAddExternal}>
        🖼️➕ Add External Image
      </button>

      <div className="toolbar-divider"></div>

      <div className="toolbar-section">
        <label>Hue Transform</label>
        <div className="hue-control">
          <input
            type="range"
            min="-180"
            max="180"
            value={hueValue}
            onChange={(e) => onHueChange(Number(e.target.value))}
            className="hue-slider"
          />
          <button className="default-btn" onClick={() => onHueChange(0)}>
            Default
          </button>
        </div>
        <span className="hue-value">{hueValue}°</span>
      </div>

      <button className="toolbar-btn" onClick={onEndSegment}>
        🎯 End Segment
      </button>

      <button className="toolbar-btn" onClick={onUndo}>
        ↩️ Undo
      </button>

      <div className="toolbar-divider"></div>

      <div className="toolbar-section">
        <label>Total Frames:</label>
        <input
          type="number"
          min="1"
          max="2000"
          value={totalFrames}
          onChange={(e) => onTotalFramesChange(Number(e.target.value))}
          className="number-input"
        />
      </div>

      <div className="toolbar-section">
        <label>FPS:</label>
        <input
          type="number"
          min="1"
          max="120"
          value={fps}
          onChange={(e) => onFpsChange(Number(e.target.value))}
          className="number-input"
        />
      </div>

      <div className="toolbar-divider"></div>

      <button className="toolbar-btn" onClick={onPlayDemo}>
        ▶️ Play Demo
      </button>

      <div className="toolbar-section">
        <label>Prompt</label>
        <textarea
          value={prompt}
          onChange={(e) => onPromptChange(e.target.value)}
          placeholder="Write your prompt here..."
          className="prompt-input"
          rows="3"
        />
      </div>

      <button className="toolbar-btn primary" onClick={onSave}>
        💾 Save
      </button>

      <button className="toolbar-btn" onClick={onNew}>
        🆕 New
      </button>

      <button className="toolbar-btn" onClick={() => window.close()}>
        ⏹️ Exit
      </button>
    </div>
  );
}

export default Toolbar;
