import React, { useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import { Stage, Layer, Image, Line, Circle, Rect } from 'react-konva';
import './Canvas.css';

const Canvas = forwardRef(({
  baseImage,
  layers,
  currentLayer,
  mode,
  hueValue,
  onPolygonComplete,
  onModeChange,
}, ref) => {
  const [stageSize, setStageSize] = useState({ width: 800, height: 600 });
  const [image, setImage] = useState(null);
  const [tempPoints, setTempPoints] = useState([]);
  const [selectedShape, setSelectedShape] = useState(null);
  const [transform, setTransform] = useState({ x: 0, y: 0, rotation: 0, scale: 1 });
  const stageRef = useRef(null);

  // Expose methods to parent
  useImperativeHandle(ref, () => ({
    getCurrentTransform: () => transform,
  }));

  // Load base image
  useEffect(() => {
    if (!baseImage) {
      setImage(null);
      return;
    }

    const img = new window.Image();
    img.src = baseImage.data;
    img.onload = () => {
      setImage(img);
      setStageSize({ width: baseImage.width, height: baseImage.height });
    };
  }, [baseImage]);

  // Initialize transform for current layer
  useEffect(() => {
    if (currentLayer && currentLayer.keyframes && currentLayer.keyframes.length > 0) {
      const lastKf = currentLayer.keyframes[currentLayer.keyframes.length - 1];
      setTransform({
        x: lastKf.pos[0],
        y: lastKf.pos[1],
        rotation: lastKf.rot_deg,
        scale: lastKf.scale,
      });
    } else if (currentLayer && currentLayer.origin_local_xy) {
      setTransform({
        x: currentLayer.origin_local_xy[0],
        y: currentLayer.origin_local_xy[1],
        rotation: 0,
        scale: 1,
      });
    }
  }, [currentLayer]);

  const handleStageClick = (e) => {
    if (mode !== 'draw-polygon') return;

    // Get click position
    const stage = e.target.getStage();
    const pointerPosition = stage.getPointerPosition();

    // Left click - add point
    if (e.evt.button === 0) {
      setTempPoints([...tempPoints, { x: pointerPosition.x, y: pointerPosition.y }]);
    }
  };

  const handleStageRightClick = (e) => {
    e.evt.preventDefault();
    
    if (mode === 'draw-polygon' && tempPoints.length >= 3) {
      // Finish polygon
      onPolygonComplete(tempPoints);
      setTempPoints([]);
    } else if (mode !== 'draw-polygon') {
      // End segment (right-click in idle mode)
      // This would trigger end segment in the parent
    }
  };

  const handleKeyDown = (e) => {
    if (mode === 'draw-polygon') {
      if (e.key === 'Escape') {
        setTempPoints([]);
        onModeChange('idle');
      } else if (e.key === 'Backspace') {
        setTempPoints(tempPoints.slice(0, -1));
      }
    }
  };

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mode, tempPoints]);

  const renderPolygon = (layer) => {
    if (!layer.polygon_xy || layer.polygon_xy.length < 3) return null;

    const points = layer.polygon_xy.flat();
    const color = layer.color ? `rgb(${layer.color.join(',')})` : 'rgb(255, 99, 99)';

    return (
      <Line
        key={`poly-${layer.name}`}
        points={points}
        stroke={color}
        strokeWidth={2}
        closed={true}
        fill={`${color}33`}
        draggable={layer === currentLayer}
        onDragEnd={(e) => {
          setTransform({
            ...transform,
            x: e.target.x(),
            y: e.target.y(),
          });
        }}
      />
    );
  };

  const renderTempPolygon = () => {
    if (mode !== 'draw-polygon' || tempPoints.length === 0) return null;

    const points = tempPoints.flatMap(p => [p.x, p.y]);

    return (
      <>
        <Line
          points={points}
          stroke="rgb(255, 99, 99)"
          strokeWidth={2}
          closed={false}
        />
        {tempPoints.map((point, i) => (
          <Circle
            key={`temp-point-${i}`}
            x={point.x}
            y={point.y}
            radius={i === 0 ? 5 : 3}
            fill={i === 0 ? 'rgb(0, 220, 0)' : 'rgb(255, 99, 99)'}
            stroke="black"
            strokeWidth={1}
          />
        ))}
      </>
    );
  };

  const renderPathLines = (layer) => {
    if (!layer.keyframes || layer.keyframes.length < 2) return null;

    const lines = [];
    for (let i = 0; i < layer.keyframes.length - 1; i++) {
      const kf1 = layer.keyframes[i];
      const kf2 = layer.keyframes[i + 1];
      const color = layer.color ? `rgb(${layer.color.join(',')})` : 'rgb(255, 99, 99)';

      lines.push(
        <Line
          key={`path-${layer.name}-${i}`}
          points={[kf1.pos[0], kf1.pos[1], kf2.pos[0], kf2.pos[1]]}
          stroke={color}
          strokeWidth={2}
        />
      );
    }

    return lines;
  };

  return (
    <div 
      className="canvas-wrapper"
      tabIndex={0}
      onContextMenu={(e) => e.preventDefault()}
    >
      <Stage
        ref={stageRef}
        width={stageSize.width}
        height={stageSize.height}
        onClick={handleStageClick}
        onContextMenu={handleStageRightClick}
        className="canvas-stage"
      >
        <Layer>
          {/* Base Image */}
          {image && <Image image={image} />}

          {/* Render all layers */}
          {layers.map(layer => (
            <React.Fragment key={layer.name}>
              {renderPolygon(layer)}
              {renderPathLines(layer)}
            </React.Fragment>
          ))}

          {/* Temp polygon being drawn */}
          {renderTempPolygon()}
        </Layer>
      </Stage>

      {mode === 'draw-polygon' && (
        <div className="canvas-hint">
          Click to add points • Right-click to finish • Backspace to undo • Esc to cancel
        </div>
      )}
    </div>
  );
});

Canvas.displayName = 'Canvas';

export default Canvas;
