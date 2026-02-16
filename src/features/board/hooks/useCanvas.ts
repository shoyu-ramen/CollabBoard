'use client';

import { create } from 'zustand';
import type Konva from 'konva';
import {
  DEFAULT_ZOOM,
  MIN_ZOOM,
  MAX_ZOOM,
} from '@/lib/constants';

interface CanvasState {
  zoom: number;
  panOffset: { x: number; y: number };
  stageRef: Konva.Stage | null;

  setZoom: (zoom: number) => void;
  setPanOffset: (offset: { x: number; y: number }) => void;
  setStageRef: (ref: Konva.Stage | null) => void;
  zoomToPoint: (point: { x: number; y: number }, delta: number) => void;
  resetView: () => void;
}

export const useCanvas = create<CanvasState>((set, get) => ({
  zoom: DEFAULT_ZOOM,
  panOffset: { x: 0, y: 0 },
  stageRef: null,

  setZoom: (zoom) =>
    set({ zoom: Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom)) }),

  setPanOffset: (offset) => set({ panOffset: offset }),

  setStageRef: (ref) => set({ stageRef: ref }),

  zoomToPoint: (point, delta) => {
    const { zoom, panOffset } = get();
    const scaleBy = 1.08;
    const newZoom =
      delta > 0 ? zoom / scaleBy : zoom * scaleBy;
    const clampedZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, newZoom));

    // Zoom towards the pointer position
    const mousePointTo = {
      x: (point.x - panOffset.x) / zoom,
      y: (point.y - panOffset.y) / zoom,
    };
    const newPos = {
      x: point.x - mousePointTo.x * clampedZoom,
      y: point.y - mousePointTo.y * clampedZoom,
    };

    set({ zoom: clampedZoom, panOffset: newPos });
  },

  resetView: () =>
    set({ zoom: DEFAULT_ZOOM, panOffset: { x: 0, y: 0 } }),
}));
