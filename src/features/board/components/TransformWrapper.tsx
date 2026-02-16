'use client';

import React, { useEffect, useRef } from 'react';
import { Transformer } from 'react-konva';
import type Konva from 'konva';

interface TransformWrapperProps {
  selectedIds: Set<string>;
  stageRef: Konva.Stage | null;
  onTransformEnd: (
    id: string,
    attrs: { x: number; y: number; width: number; height: number; rotation: number }
  ) => void;
}

export default function TransformWrapper({
  selectedIds,
  stageRef,
  onTransformEnd,
}: TransformWrapperProps) {
  const transformerRef = useRef<Konva.Transformer>(null);

  useEffect(() => {
    const transformer = transformerRef.current;
    if (!transformer || !stageRef) return;

    const nodes: Konva.Node[] = [];
    selectedIds.forEach((id) => {
      const node = stageRef.findOne('#' + id);
      if (node) {
        nodes.push(node);
      }
    });

    transformer.nodes(nodes);
    transformer.getLayer()?.batchDraw();
  }, [selectedIds, stageRef]);

  return (
    <Transformer
      ref={transformerRef}
      boundBoxFunc={(oldBox, newBox) => {
        // Limit minimum size
        if (newBox.width < 10 || newBox.height < 10) {
          return oldBox;
        }
        return newBox;
      }}
      onTransformEnd={() => {
        const transformer = transformerRef.current;
        if (!transformer) return;

        const nodes = transformer.nodes();
        nodes.forEach((node) => {
          const scaleX = node.scaleX();
          const scaleY = node.scaleY();

          // Reset scale and apply to width/height
          node.scaleX(1);
          node.scaleY(1);

          onTransformEnd(node.id(), {
            x: node.x(),
            y: node.y(),
            width: Math.max(10, node.width() * scaleX),
            height: Math.max(10, node.height() * scaleY),
            rotation: node.rotation(),
          });
        });
      }}
      rotateEnabled
      keepRatio={false}
      enabledAnchors={[
        'top-left',
        'top-right',
        'bottom-left',
        'bottom-right',
        'middle-left',
        'middle-right',
        'top-center',
        'bottom-center',
      ]}
    />
  );
}
