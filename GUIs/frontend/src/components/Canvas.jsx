import React, { useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import { Stage, Layer, Image, Line, Circle, Transformer } from 'react-konva';
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
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [rotation, setRotation] = useState(0);
  const [scale, setScale] = useState(1);
  const stageRef = useRef(null);
  const shapeRef = useRef(null);
  const transformerRef = useRef(null);

  // Expose methods to parent
  useImperativeHandle(ref, () => ({
    getCurrentTransform: () => {
      if (!currentLayer || !currentLayer.origin_local_xy) {
        return { x: 0, y: 0, rotation: 0, scale: 1 };
      }
      // Calculate actual position: origin + drag offset
      return {
        x: currentLayer.origin_local_xy[0] + dragOffset.x,
        y: currentLayer.origin_local_xy[1] + dragOffset.y,
        rotation: rotation,
        scale: scale,
      };
    },
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
      // Calculate drag offset from the difference between last keyframe and origin
      if (currentLayer.origin_local_xy) {
        setDragOffset({
          x: lastKf.pos[0] - currentLayer.origin_local_xy[0],
          y: lastKf.pos[1] - currentLayer.origin_local_xy[1],
        });
      }
      setRotation(lastKf.rot_deg);
      setScale(lastKf.scale);
    } else {
      // Reset to no offset for new layers
      setDragOffset({ x: 0, y: 0 });
      setRotation(0);
      setScale(1);
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

  // Attach transformer to current shape
  useEffect(() => {
    if (transformerRef.current && shapeRef.current && currentLayer && mode !== 'draw-polygon') {
      transformerRef.current.nodes([shapeRef.current]);
      transformerRef.current.getLayer().batchDraw();
    }
  }, [currentLayer, mode]);

  const renderPolygon = (layer) => {
    if (!layer.polygon_xy || layer.polygon_xy.length < 3) return null;

    const points = layer.polygon_xy.flat();
    const color = layer.color ? `rgb(${layer.color.join(',')})` : 'rgb(255, 99, 99)';
    
    // For the current layer, apply drag offset
    const isCurrentLayer = layer === currentLayer;
    const x = isCurrentLayer ? dragOffset.x : 0;
    const y = isCurrentLayer ? dragOffset.y : 0;

    return (
      <Line
        key={`poly-${layer.name}`}
        ref={isCurrentLayer ? shapeRef : null}
        points={points}
        stroke={color}
        strokeWidth={2}
        closed={true}
        fill={`${color}33`}
        x={x}
        y={y}
        rotation={isCurrentLayer ? rotation : 0}
        scaleX={isCurrentLayer ? scale : 1}
        scaleY={isCurrentLayer ? scale : 1}
        offsetX={layer.origin_local_xy ? layer.origin_local_xy[0] : 0}
        offsetY={layer.origin_local_xy ? layer.origin_local_xy[1] : 0}
        draggable={isCurrentLayer && mode !== 'draw-polygon'}
        onDragMove={(e) => {
          if (isCurrentLayer) {
            setDragOffset({
              x: e.target.x(),
              y: e.target.y(),
            });
          }
        }}
        onTransformEnd={(e) => {
          if (isCurrentLayer) {
            const node = e.target;
            setScale(node.scaleX());
            setRotation(node.rotation());
          }
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

          {/* Transformer for current layer */}
          {currentLayer && mode !== 'draw-polygon' && (
            <Transformer
              ref={transformerRef}
              boundBoxFunc={(oldBox, newBox) => {
                // Limit resize to prevent negative sizes
                if (newBox.width < 5 || newBox.height < 5) {
                  return oldBox;
                }
                return newBox;
              }}
              enabledAnchors={['top-left', 'top-right', 'bottom-left', 'bottom-right']}
              rotateEnabled={true}
              keepRatio={false}
            />
          )}
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
