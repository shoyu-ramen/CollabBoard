'use client';

import React, { useEffect, useRef } from 'react';
import { Transformer } from 'react-konva';
import type Konva from 'konva';

interface TransformWrapperProps {
  selectedIds: Set<string>;
  stageRef: Konva.Stage | null;
  onTransformEnd: (
    id: string,
    attrs: { x: number; y: number; width: number; height: number; rotation: number },
    scale: { scaleX: number; scaleY: number }
  ) => void;
  onTransform?: (
    id: string,
    attrs: { x: number; y: number; width: number; height: number; rotation: number },
    scale: { scaleX: number; scaleY: number }
  ) => void;
  objects?: Map<string, unknown>;
}

export default function TransformWrapper({
  selectedIds,
  stageRef,
  onTransformEnd,
  onTransform,
}: TransformWrapperProps) {
  const transformerRef = useRef<Konva.Transformer>(null);
  const prevIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const transformer = transformerRef.current;
    if (!transformer || !stageRef) return;

    // Only re-attach nodes when the actual selected IDs change, not when the
    // Set reference changes (which happens on every objects-map mutation).
    // Re-running transformer.nodes() resets the bounding box to axis-aligned,
    // which loses group rotation (the rotate handle snaps back to the top).
    const prev = prevIdsRef.current;
    if (
      selectedIds.size === prev.size &&
      [...selectedIds].every((id) => prev.has(id))
    ) {
      return;
    }
    prevIdsRef.current = new Set(selectedIds);

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
      onTransform={() => {
        const transformer = transformerRef.current;
        if (!transformer || !onTransform) return;

        const nodes = transformer.nodes();
        nodes.forEach((node) => {
          const scaleX = node.scaleX();
          const scaleY = node.scaleY();

          onTransform(
            node.id(),
            {
              x: node.x(),
              y: node.y(),
              width: Math.max(10, node.width() * scaleX),
              height: Math.max(10, node.height() * scaleY),
              rotation: node.rotation(),
            },
            { scaleX, scaleY }
          );
        });
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

          onTransformEnd(
            node.id(),
            {
              x: node.x(),
              y: node.y(),
              width: Math.max(10, node.width() * scaleX),
              height: Math.max(10, node.height() * scaleY),
              rotation: node.rotation(),
            },
            { scaleX, scaleY }
          );
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
