import React, { useState, useEffect, useRef, useCallback } from "react";

// Deferred-commit input: lets you freely type without clamping mid-edit.
// The value is committed to state only on blur or Enter.
function DimInput({ value, min, step, onCommit, className, title }) {
  const [draft, setDraft] = useState(String(Math.round(value)));
  const [editing, setEditing] = useState(false);

  // Sync from parent when not actively editing
  useEffect(() => {
    if (!editing) setDraft(String(Math.round(value)));
  }, [value, editing]);

  const commit = () => {
    setEditing(false);
    const v = parseFloat(draft);
    if (!isNaN(v) && v >= (min || 10)) {
      onCommit(v);
    } else {
      setDraft(String(Math.round(value))); // revert
    }
  };

  return (
    <input
      type="number" className={className} title={title}
      min={min} step={step}
      value={draft}
      onFocus={() => setEditing(true)}
      onChange={e => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={e => { if (e.key === 'Enter') { e.target.blur(); } }}
    />
  );
}

// Process types: hand layup (~35-45% Vf) vs infusion (~50-60% Vf)
// Divisor converts gsm → cured ply thickness (mm)
// Hand layup: lower Vf → thicker plies, more resin
// Infusion: higher Vf → thinner plies, less resin
const PROCESS_TYPES = {
  handlayup: { label: 'Hand Layup (wet)', thicknessDivisor: 500, resinRatio: 1.0, wastePercent: 10 },
  infusion:  { label: 'Vacuum Infusion',  thicknessDivisor: 650, resinRatio: 0.7, wastePercent: 5  },
};

// gsm = grams per square meter (fiber weight), used to calculate default thickness and fiber weight
const MATERIALS = {
  CSM100:           { label: "CSM 100",             gsm: 100,  chamferLong: 0,   chamferTrans: 0,  color: "#e8d5b7", fiberAngle: null,       note: "No chamfering — connecting/surface layer" },
  CSM300:           { label: "CSM 300",             gsm: 300,  chamferLong: 0,   chamferTrans: 0,  color: "#d4c4a0", fiberAngle: null,       note: "No chamfering — connecting/surface layer" },
  BIAX450:          { label: "Biaxial 450 ±45",     gsm: 450,  chamferLong: 50,  chamferTrans: 50, color: "#7ec8e3", fiberAngle: "±45°"     },
  BIAX600:          { label: "Biaxial 600 ±45",     gsm: 600,  chamferLong: 50,  chamferTrans: 50, color: "#5ba3c9", fiberAngle: "±45°"     },
  BIAX806:          { label: "Biaxial 806 ±45",     gsm: 806,  chamferLong: 50,  chamferTrans: 50, color: "#3d7fa8", fiberAngle: "±45°"     },
  BIAXCOMBI600:     { label: "Biax Combi 600 ±45",  gsm: 600,  chamferLong: 50,  chamferTrans: 50, color: "#a8d8a8", fiberAngle: "±45°"     },
  BIAXCOMBI900_45:  { label: "Biax Combi 900 ±45",  gsm: 900,  chamferLong: 50,  chamferTrans: 50, color: "#7bc47b", fiberAngle: "±45°"     },
  BIAXCOMBI900_090: { label: "Biax Combi 900 0/90", gsm: 900,  chamferLong: 50,  chamferTrans: 50, color: "#5aab5a", fiberAngle: "0°/90°"   },
  GENERAL:          { label: "General Layer",        gsm: 500,  chamferLong: 50,  chamferTrans: 15, color: "#c9b1d9", fiberAngle: "multi"    },
  VESTAS_LE:        { label: "Vestas Leading Edge",  gsm: 800,  chamferLong: 100, chamferTrans: 50, color: "#ffb347", fiberAngle: "multi"    },
  UDCOMBI1250:      { label: "UD Combi 1250",        gsm: 1250, chamferLong: 100, chamferTrans: 20, color: "#ff6b6b", fiberAngle: "0°"       },
  UD661:            { label: "UD 661 High Def",      gsm: 661,  chamferLong: 100, chamferTrans: 20, color: "#ff4444", fiberAngle: "0°"       },
  UD1322:           { label: "UD 1322 High Def",     gsm: 1322, chamferLong: 100, chamferTrans: 20, color: "#cc0000", fiberAngle: "0°",
                      note: "Replace each layer with TWO layers of UD 661. Each UD661 replacement: chamferLong 50mm, chamferTrans 10mm" },
  TRIAX600:         { label: "Triaxial 600 0/±45",   gsm: 600,  chamferLong: 50,  chamferTrans: 50, color: "#f9ca24", fiberAngle: "0°/±45°" },
  TRIAX900:         { label: "Triaxial 900 0/±45",   gsm: 900,  chamferLong: 50,  chamferTrans: 50, color: "#f0932b", fiberAngle: "0°/±45°" },
  CORE:             { label: "Core Material",         gsm: 0,    chamferLong: 0,   chamferTrans: 0,  color: "#b8b8b8", fiberAngle: null, isCore: true },
};

// Default ply thickness from gsm, adjusted by process type
function defaultThickness(materialKey, processType = 'handlayup') {
  const mat = MATERIALS[materialKey];
  if (!mat || mat.isCore) return 3;
  if (mat.gsm === 0) return 0.5;
  const divisor = PROCESS_TYPES[processType]?.thicknessDivisor || 500;
  return Math.round((mat.gsm / divisor) * 10) / 10;
}

// Fiber weight in grams: gsm * areaM2
function fiberWeightG(materialKey, areaM2) {
  const mat = MATERIALS[materialKey];
  if (!mat) return 0;
  return mat.gsm * areaM2;
}

const EDGE_HIT_PX = 8;

// Fiber hatch function — draws directional lines clipped to a rectangle
function drawFiberHatch(ctx, rect, fiberAngle) {
  if (!fiberAngle || fiberAngle === 'multi') return;
  ctx.save();
  ctx.beginPath();
  ctx.rect(rect.x, rect.y, rect.w, rect.h);
  ctx.clip();
  ctx.strokeStyle = 'rgba(0,0,0,0.18)';
  ctx.lineWidth = 1;
  const spacing = 12;

  const drawLines = (angle) => {
    const diagLen = Math.sqrt(rect.w * rect.w + rect.h * rect.h);
    const cx = rect.x + rect.w / 2;
    const cy = rect.y + rect.h / 2;
    for (let d = -diagLen; d <= diagLen; d += spacing) {
      const cos = Math.cos(angle), sin = Math.sin(angle);
      const perpX = -sin, perpY = cos;
      ctx.beginPath();
      ctx.moveTo(cx + perpX * d - cos * diagLen, cy + perpY * d - sin * diagLen);
      ctx.lineTo(cx + perpX * d + cos * diagLen, cy + perpY * d + sin * diagLen);
      ctx.stroke();
    }
  };

  if (fiberAngle === '0°')      { drawLines(Math.PI / 2); }
  if (fiberAngle === '90°')     { drawLines(0); }
  if (fiberAngle === '±45°')    { drawLines(Math.PI / 4); drawLines(-Math.PI / 4); }
  if (fiberAngle === '0°/±45°') { drawLines(Math.PI / 2); drawLines(Math.PI / 4); drawLines(-Math.PI / 4); }
  if (fiberAngle === '0°/90°')  { drawLines(Math.PI / 2); drawLines(0); }
  ctx.restore();
}

function RepairDrawingPage({ projects = [], activeProjectId }) {
  const [layers, setLayers] = useState([]);
  const [selectedMaterial, setSelectedMaterial] = useState('BIAX450');
  const [processType, setProcessType] = useState('handlayup');
  const [inputWidth, setInputWidth] = useState('');
  const [inputHeight, setInputHeight] = useState('');
  const [includeCore, setIncludeCore] = useState(false);
  const [coreThickness, setCoreThickness] = useState('');
  const [coreInsertIndex, setCoreInsertIndex] = useState(-1); // -1 = on top
  const [undoStack, setUndoStack] = useState([]);
  const [drawingName, setDrawingName] = useState('');
  const [savedDrawings, setSavedDrawings] = useState(() =>
    JSON.parse(localStorage.getItem('repairDrawings') || '[]')
  );
  const [ud1322Banner, setUd1322Banner] = useState(false);
  const [layerError, setLayerError] = useState('');
  const [toast, setToast] = useState('');
  const [selectedLayerIndex, setSelectedLayerIndex] = useState(-1);
  const [zoomLevel, setZoomLevel] = useState(1); // 1 = fit-to-canvas, >1 = zoomed in
  // Inline dimension editing overlay: { layerIndex, field ('widthMm'|'heightMm'), px, py }
  const [dimEdit, setDimEdit] = useState(null);
  const dimInputRef = useRef(null);

  // Damage association
  const [assocProjectId, setAssocProjectId] = useState(activeProjectId || '');
  const [assocTurbineId, setAssocTurbineId] = useState('');
  const [assocBladeId, setAssocBladeId] = useState('');
  const [assocDamageId, setAssocDamageId] = useState('');

  const assocProject = projects.find(p => p.id === assocProjectId);
  const assocTurbine = assocProject?.turbines?.find(t => t.id === assocTurbineId);
  const assocBlade = assocTurbine?.blades?.find(b => b.id === assocBladeId);
  const assocDamage = assocBlade?.damages?.find(d => d.id === assocDamageId);

  const topDownRef = useRef(null);
  const crossSectionRef = useRef(null);
  const sideCrossSectionRef = useRef(null);

  // Scale refs — updated every redraw so mouse handlers can read them
  const scaleRef = useRef(1);
  const originRef = useRef({ x: 0, y: 0 });
  const layerRectsRef = useRef([]);
  // Hit zones for dimension labels: [{ layerIndex, field, x, y, w, h }]
  const dimHitZonesRef = useRef([]);
  // Profile band rects for click-select and drag-drop: [{ x, y, w, h, index }]
  const csLayerBandsRef = useRef([]);
  const sideLayerBandsRef = useRef([]);

  // Drag-drop reorder state for profile canvases
  const profileDragRef = useRef({
    active: false,
    canvas: null, // 'front' | 'side'
    layerIndex: -1,
    startY: 0,
    currentY: 0,
    targetIndex: -1,
  });

  // Drag state in refs — no re-renders mid-drag
  const dragRef = useRef({
    mode: 'none', // 'none' | 'drawing' | 'resizing'
    startX: 0, startY: 0,
    currentX: 0, currentY: 0,
    layerIndex: -1,
    edge: null,
  });

  const layersRef = useRef(layers);
  useEffect(() => { layersRef.current = layers; }, [layers]);

  // CSM surface layer validation
  const nonCoreLayers = layers.filter(l => !l.isCore);
  const bottomMat = nonCoreLayers[0]?.materialKey;
  const topMat = nonCoreLayers[nonCoreLayers.length - 1]?.materialKey;
  const csmWarning = nonCoreLayers.length > 0 && (
    !['CSM100', 'CSM300'].includes(bottomMat) ||
    !['CSM100', 'CSM300'].includes(topMat)
  );

  // Stacking sequence warning: adjacent UD layers without biaxial separation
  const adjacentUdWarning = (() => {
    for (let i = 0; i < nonCoreLayers.length - 1; i++) {
      const a = MATERIALS[nonCoreLayers[i].materialKey];
      const b = MATERIALS[nonCoreLayers[i + 1].materialKey];
      if (a.fiberAngle === '0°' && b.fiberAngle === '0°') return true;
    }
    return false;
  })();

  // Symmetry warning: inner and outer skins around core should be symmetric
  const symmetryWarning = (() => {
    const ci = layers.findIndex(l => l.isCore);
    if (ci === -1) return false;
    const inner = layers.filter((_, idx) => idx < ci && !layers[idx].isCore);
    const outer = layers.filter((_, idx) => idx > ci && !layers[idx].isCore);
    if (inner.length !== outer.length) return true;
    for (let i = 0; i < inner.length; i++) {
      const innerMat = inner[i].materialKey;
      const outerMat = outer[outer.length - 1 - i]?.materialKey;
      if (innerMat !== outerMat) return true;
    }
    return false;
  })();

  // Summary
  const totalThickness = layers.reduce((s, l) => s + l.thicknessMm, 0);
  const outermostArea = layers.length > 0 ? (layers[0].widthMm * layers[0].heightMm) / 1e6 : 0;
  const innermostArea = layers.length > 0 ? (layers[layers.length - 1].widthMm * layers[layers.length - 1].heightMm) / 1e6 : 0;
  const totalFiberWeight = layers.reduce((s, l) => s + fiberWeightG(l.materialKey, l.areaM2), 0);
  // Resin estimate based on process type
  const proc = PROCESS_TYPES[processType];
  const resinEstimate = (totalFiberWeight * proc.resinRatio * (1 + proc.wastePercent / 100)) / 1000; // grams → kg

  // Material order table
  const materialOrder = {};
  layers.forEach(l => {
    const key = l.materialKey;
    if (!materialOrder[key]) materialOrder[key] = { count: 0, totalArea: 0, totalFiberG: 0 };
    materialOrder[key].count += 1;
    materialOrder[key].totalArea += l.areaM2;
    materialOrder[key].totalFiberG += fiberWeightG(key, l.areaM2);
  });

  const makeId = () => crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;

  // ──────────────────────────────────────────────────────────────
  // TOP-DOWN CANVAS REDRAW
  // ──────────────────────────────────────────────────────────────
  const redrawTopDown = useCallback(() => {
    const canvas = topDownRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const ctx = canvas.getContext('2d');
    const cw = canvas.width / dpr;
    const ch = canvas.height / dpr;
    ctx.clearRect(0, 0, cw, ch);
    const dimHitZones = [];

    // Scale computation — fit outermost layer to 75% of canvas
    if (layers.length === 0) {
      scaleRef.current = 1;
      originRef.current = { x: cw / 2, y: ch / 2 };

      ctx.fillStyle = '#aaa';
      ctx.font = '14px DM Sans, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Click and drag to draw a layer, or enter dimensions below', cw / 2, ch / 2);
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = '#ccc';
      ctx.beginPath(); ctx.moveTo(cw / 2, 0); ctx.lineTo(cw / 2, ch); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, ch / 2); ctx.lineTo(cw, ch / 2); ctx.stroke();
      ctx.setLineDash([]);

      // Live drag preview during base drawing
      if (dragRef.current.mode === 'drawing') {
        const rx = Math.min(dragRef.current.startX, dragRef.current.currentX);
        const ry = Math.min(dragRef.current.startY, dragRef.current.currentY);
        const rw = Math.abs(dragRef.current.currentX - dragRef.current.startX);
        const rh = Math.abs(dragRef.current.currentY - dragRef.current.startY);
        ctx.setLineDash([6, 3]);
        ctx.strokeStyle = '#e53935';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(rx, ry, rw, rh);
        ctx.setLineDash([]);
        ctx.fillStyle = '#e53935';
        ctx.font = 'bold 12px DM Sans, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`W: ${rw.toFixed(0)} mm`, rx + rw / 2, ry - 6);
        ctx.textAlign = 'right';
        ctx.fillText(`H: ${rh.toFixed(0)} mm`, rx - 6, ry + rh / 2);
      }

      layerRectsRef.current = [];
      dimHitZonesRef.current = [];
      return;
    }

    const outerLayer = layers[0];
    const scaleX = (cw * 0.70) / outerLayer.widthMm;
    const scaleY = (ch * 0.70) / outerLayer.heightMm;
    const baseScale = Math.min(scaleX, scaleY);
    const scale = baseScale * zoomLevel;
    scaleRef.current = scale;
    const origin = { x: cw / 2, y: ch / 2 };
    originRef.current = origin;

    // Grid — light lines
    const gridStepW = outerLayer.widthMm > 2000 ? 200 : outerLayer.widthMm > 500 ? 100 : 50;
    const gridStepH = outerLayer.heightMm > 2000 ? 200 : outerLayer.heightMm > 500 ? 100 : 50;
    const halfWmm = (cw / 2) / scale;
    const halfHmm = (ch / 2) / scale;

    for (let mm = -Math.ceil(halfWmm / gridStepW) * gridStepW; mm <= Math.ceil(halfWmm / gridStepW) * gridStepW; mm += gridStepW) {
      const px = origin.x + mm * scale;
      if (px < 0 || px > cw) continue;
      const isMajor = mm % (gridStepW * 2) === 0;
      ctx.strokeStyle = isMajor ? 'rgba(0,0,0,0.12)' : 'rgba(0,0,0,0.05)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(px, 0); ctx.lineTo(px, ch); ctx.stroke();
    }
    for (let mm = -Math.ceil(halfHmm / gridStepH) * gridStepH; mm <= Math.ceil(halfHmm / gridStepH) * gridStepH; mm += gridStepH) {
      const py = origin.y + mm * scale;
      if (py < 0 || py > ch) continue;
      const isMajor = mm % (gridStepH * 2) === 0;
      ctx.strokeStyle = isMajor ? 'rgba(0,0,0,0.12)' : 'rgba(0,0,0,0.05)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(0, py); ctx.lineTo(cw, py); ctx.stroke();
    }

    // Draw each layer centered using its stored dimensions
    const layerRects = [];
    const selIdx = selectedLayerIndex;

    for (let i = 0; i < layers.length; i++) {
      const mat = MATERIALS[layers[i].materialKey];
      const lw = Math.max(4, layers[i].widthMm * scale);
      const lh = Math.max(4, layers[i].heightMm * scale);
      const currentRect = {
        x: origin.x - lw / 2,
        y: origin.y - lh / 2,
        w: lw,
        h: lh,
      };

      // Fill
      ctx.globalAlpha = i === selIdx ? 0.65 : 0.45;
      ctx.fillStyle = mat.color;
      ctx.fillRect(currentRect.x, currentRect.y, currentRect.w, currentRect.h);
      ctx.globalAlpha = 1.0;

      // Strong visible border — darker stroke so layers are distinguishable
      const isSelected = i === selIdx;
      ctx.strokeStyle = isSelected ? '#e53935' : 'rgba(0,0,0,0.35)';
      ctx.lineWidth = isSelected ? 2.5 : 1.5;
      ctx.strokeRect(currentRect.x, currentRect.y, currentRect.w, currentRect.h);

      drawFiberHatch(ctx, currentRect, mat.fiberAngle);

      layerRects.push({ ...currentRect });
    }
    layerRectsRef.current = layerRects;

    // Material labels — top-left corner of each layer
    for (let i = 0; i < layerRects.length; i++) {
      const rect = layerRects[i];
      const mat = MATERIALS[layers[i].materialKey];
      const isSelected = i === selIdx;

      // Background pill for readability
      const labelText = mat.label;
      ctx.font = 'bold 9px DM Sans, sans-serif';
      const textW = ctx.measureText(labelText).width;
      const pillH = 14;
      const pillW = textW + 8;
      const pillX = rect.x + 3;
      const pillY = rect.y + 3;

      // Only draw if there's enough room
      if (rect.w > pillW + 6 && rect.h > pillH + 6) {
        ctx.fillStyle = isSelected ? 'rgba(229,57,53,0.85)' : 'rgba(255,255,255,0.85)';
        ctx.beginPath();
        // Rounded rect
        const r = 3;
        ctx.moveTo(pillX + r, pillY);
        ctx.lineTo(pillX + pillW - r, pillY);
        ctx.arcTo(pillX + pillW, pillY, pillX + pillW, pillY + r, r);
        ctx.lineTo(pillX + pillW, pillY + pillH - r);
        ctx.arcTo(pillX + pillW, pillY + pillH, pillX + pillW - r, pillY + pillH, r);
        ctx.lineTo(pillX + r, pillY + pillH);
        ctx.arcTo(pillX, pillY + pillH, pillX, pillY + pillH - r, r);
        ctx.lineTo(pillX, pillY + r);
        ctx.arcTo(pillX, pillY, pillX + r, pillY, r);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = isSelected ? '#fff' : 'rgba(0,0,0,0.75)';
        ctx.textAlign = 'left';
        ctx.fillText(labelText, pillX + 4, pillY + pillH - 4);
      }
    }

    // Dimension lines — staggered outward, with clickable hit zones
    const dimOffset = 16;
    for (let i = 0; i < layerRects.length; i++) {
      const rect = layerRects[i];
      const layer = layers[i];
      const stagger = (i + 1) * dimOffset;
      const isSelected = i === selIdx;

      ctx.globalAlpha = isSelected ? 1.0 : (i === 0 ? 0.8 : 0.4);

      // Horizontal dimension (width) — above outermost, staggered upward
      const hY = layerRects[0].y - stagger;
      if (hY > 10) {
        ctx.strokeStyle = 'rgba(0,0,0,0.15)';
        ctx.lineWidth = 1;
        ctx.setLineDash([2, 2]);
        ctx.beginPath(); ctx.moveTo(rect.x, rect.y); ctx.lineTo(rect.x, hY); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(rect.x + rect.w, rect.y); ctx.lineTo(rect.x + rect.w, hY); ctx.stroke();
        ctx.setLineDash([]);

        // Dimension line
        ctx.strokeStyle = isSelected ? '#e53935' : '#1a1a1a';
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(rect.x, hY); ctx.lineTo(rect.x + rect.w, hY); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(rect.x, hY - 4); ctx.lineTo(rect.x, hY + 4); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(rect.x + rect.w, hY - 4); ctx.lineTo(rect.x + rect.w, hY + 4); ctx.stroke();

        const wLabel = `${Math.round(layer.widthMm)} mm`;
        ctx.font = 'bold 11px DM Sans, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = isSelected ? '#e53935' : '#1a1a1a';
        const wLabelX = (rect.x + rect.x + rect.w) / 2;
        const wLabelY = hY - 8;
        ctx.fillText(wLabel, wLabelX, wLabelY);

        // Store hit zone for click-to-edit
        const tw = ctx.measureText(wLabel).width;
        dimHitZones.push({ layerIndex: i, field: 'widthMm', x: wLabelX - tw / 2 - 4, y: wLabelY - 12, w: tw + 8, h: 16 });
      }

      // Vertical dimension (height) — left of outermost, staggered leftward
      const vX = layerRects[0].x - stagger;
      if (vX > 10) {
        ctx.strokeStyle = 'rgba(0,0,0,0.15)';
        ctx.lineWidth = 1;
        ctx.setLineDash([2, 2]);
        ctx.beginPath(); ctx.moveTo(rect.x, rect.y); ctx.lineTo(vX, rect.y); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(rect.x, rect.y + rect.h); ctx.lineTo(vX, rect.y + rect.h); ctx.stroke();
        ctx.setLineDash([]);

        ctx.strokeStyle = isSelected ? '#e53935' : '#1a1a1a';
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(vX, rect.y); ctx.lineTo(vX, rect.y + rect.h); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(vX - 4, rect.y); ctx.lineTo(vX + 4, rect.y); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(vX - 4, rect.y + rect.h); ctx.lineTo(vX + 4, rect.y + rect.h); ctx.stroke();

        const hLabel = `${Math.round(layer.heightMm)} mm`;
        ctx.font = 'bold 11px DM Sans, sans-serif';
        ctx.fillStyle = isSelected ? '#e53935' : '#1a1a1a';
        ctx.save();
        const hLabelX = vX - 10;
        const hLabelY = (rect.y + rect.y + rect.h) / 2;
        ctx.translate(hLabelX, hLabelY);
        ctx.rotate(-Math.PI / 2);
        ctx.textAlign = 'center';
        ctx.fillText(hLabel, 0, 0);
        ctx.restore();

        // Hit zone for rotated label
        const th = ctx.measureText(hLabel).width; // rotated, so text width = visual height
        dimHitZones.push({ layerIndex: i, field: 'heightMm', x: hLabelX - 12, y: hLabelY - th / 2 - 4, w: 20, h: th + 8 });
      }
    }
    ctx.globalAlpha = 1.0;
    dimHitZonesRef.current = dimHitZones;

    // Draw live drag preview when drawing a new layer on existing canvas
    if (dragRef.current.mode === 'drawing') {
      const rx = Math.min(dragRef.current.startX, dragRef.current.currentX);
      const ry = Math.min(dragRef.current.startY, dragRef.current.currentY);
      const rw = Math.abs(dragRef.current.currentX - dragRef.current.startX);
      const rh = Math.abs(dragRef.current.currentY - dragRef.current.startY);
      ctx.setLineDash([6, 3]);
      ctx.strokeStyle = '#e53935';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(rx, ry, rw, rh);
      ctx.setLineDash([]);
      const wMm = (rw / scale).toFixed(0);
      const hMm = (rh / scale).toFixed(0);
      ctx.fillStyle = '#e53935';
      ctx.font = 'bold 12px DM Sans, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`W: ${wMm} mm`, rx + rw / 2, ry - 6);
      ctx.textAlign = 'right';
      ctx.fillText(`H: ${hMm} mm`, rx - 6, ry + rh / 2);
    }
  }, [layers, selectedLayerIndex, zoomLevel]);

  // ──────────────────────────────────────────────────────────────
  // CROSS-SECTION CANVAS — stepped side-profile view
  // Shows the laminate stack from the side with visible chamfer steps
  // ──────────────────────────────────────────────────────────────
  const redrawCrossSection = useCallback(() => {
    const canvas = crossSectionRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const ctx = canvas.getContext('2d');
    const cw = canvas.width / dpr;
    const ch = canvas.height / dpr;
    ctx.clearRect(0, 0, cw, ch);

    if (layers.length === 0) {
      ctx.fillStyle = '#aaa';
      ctx.font = '14px DM Sans, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Cross-section will appear here', cw / 2, ch / 2);
      csLayerBandsRef.current = [];
      return;
    }
    const selIdx = selectedLayerIndex;

    const maxWidthMm = Math.max(...layers.map(l => l.widthMm));
    const totalThickMm = layers.reduce((s, l) => s + l.thicknessMm, 0);

    // Layout: side profile showing width (horizontal) and thickness (vertical)
    // We use separate scales for width and thickness so chamfer steps are visible
    const labelMarginL = 20;   // left margin for labels
    const labelMarginR = 30;   // right margin for zone brackets
    const marginTop = 30;
    const marginBottom = 35;
    const availW = cw - labelMarginL - labelMarginR;
    const availH = ch - marginTop - marginBottom;

    // Width scale — fit widest layer into available width
    const wScale = availW / maxWidthMm;

    // Thickness scale — exaggerate so the stack fills available height
    // Minimum 18px per layer so even 0.1mm layers are visible
    const minLayerPx = 18;
    const naturalStackH = totalThickMm * wScale;
    const targetStackH = availH * 0.85;
    const thickScale = naturalStackH < targetStackH
      ? Math.max(wScale, targetStackH / Math.max(totalThickMm, 0.1))
      : Math.min(wScale, targetStackH / Math.max(totalThickMm, 0.1));

    // Compute actual stack height
    const stackH = layers.reduce((s, l) => s + Math.max(minLayerPx, l.thicknessMm * thickScale), 0);

    // Center the stack vertically
    const centerX = labelMarginL + availW / 2;
    const originY = marginTop + (availH - stackH) / 2 + stackH; // bottom of stack

    // Draw subtle background grid
    const gridStep = 50; // mm
    ctx.strokeStyle = 'rgba(0,0,0,0.04)';
    ctx.lineWidth = 1;
    for (let mm = gridStep; mm < maxWidthMm / 2; mm += gridStep) {
      const px = mm * wScale;
      ctx.beginPath(); ctx.moveTo(centerX - px, originY - stackH - 10); ctx.lineTo(centerX - px, originY + 10); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(centerX + px, originY - stackH - 10); ctx.lineTo(centerX + px, originY + 10); ctx.stroke();
    }

    // Draw each layer as a horizontal band, centered, stacked bottom-up
    // layers[0] = biggest (bottom), layers[last] = smallest (top)
    let yOff = 0;
    const layerBands = []; // store geometry for labels and zone brackets

    for (let i = 0; i < layers.length; i++) {
      const layer = layers[i];
      const mat = MATERIALS[layer.materialKey];
      const bandH = Math.max(minLayerPx, layer.thicknessMm * thickScale);
      const halfW = (layer.widthMm / 2) * wScale;

      const x = centerX - halfW;
      const y = originY - yOff - bandH;
      const w = halfW * 2;
      const h = bandH;

      const isSelected = i === selIdx;
      layerBands.push({ x, y, w, h, layer, mat, index: i });

      // Shadow under each layer for depth
      if (i > 0) {
        ctx.fillStyle = 'rgba(0,0,0,0.06)';
        ctx.fillRect(x + 2, y + h, w, 2);
      }

      // Main fill with gradient for thickness illusion
      const grad = ctx.createLinearGradient(x, y, x, y + h);
      grad.addColorStop(0, mat.color);
      grad.addColorStop(1, mat.color + 'cc');
      ctx.fillStyle = grad;
      ctx.globalAlpha = isSelected ? 0.9 : 0.7;
      ctx.fillRect(x, y, w, h);
      ctx.globalAlpha = 1;

      // Fiber hatch pattern on each band
      if (!mat.isCore) {
        drawFiberHatch(ctx, { x, y, w, h }, mat.fiberAngle);
      }

      // Core cross-hatch
      if (mat.isCore) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(x, y, w, h);
        ctx.clip();
        ctx.strokeStyle = 'rgba(0,0,0,0.10)';
        ctx.lineWidth = 1;
        for (let d = -cw; d < cw; d += 8) {
          ctx.beginPath(); ctx.moveTo(x + d, y + h); ctx.lineTo(x + d + h, y); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(x + d, y); ctx.lineTo(x + d + h, y + h); ctx.stroke();
        }
        ctx.restore();
      }

      // Border — selected gets red highlight
      ctx.strokeStyle = isSelected ? '#e53935' : 'rgba(0,0,0,0.25)';
      ctx.lineWidth = isSelected ? 2.5 : 1;
      ctx.strokeRect(x, y, w, h);

      // Chamfer step lines — draw angled lines connecting to previous (wider) layer
      if (i > 0) {
        const prevBand = layerBands[i - 1];
        const stepL = x - prevBand.x; // left step inward
        const stepR = (prevBand.x + prevBand.w) - (x + w); // right step inward
        if (stepL > 1) {
          // Left chamfer slope
          ctx.strokeStyle = 'rgba(0,0,0,0.3)';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(prevBand.x, y + h); // bottom-left of previous layer top
          ctx.lineTo(x, y + h);           // current layer bottom-left (same y since stacked)
          ctx.stroke();
          // Fill the chamfer triangle/step
          ctx.fillStyle = 'rgba(0,0,0,0.04)';
          ctx.beginPath();
          ctx.moveTo(prevBand.x, prevBand.y);
          ctx.lineTo(x, y + h);
          ctx.lineTo(prevBand.x, y + h);
          ctx.closePath();
          ctx.fill();
        }
        if (stepR > 1) {
          // Right chamfer slope
          ctx.strokeStyle = 'rgba(0,0,0,0.3)';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(prevBand.x + prevBand.w, y + h);
          ctx.lineTo(x + w, y + h);
          ctx.stroke();
          ctx.fillStyle = 'rgba(0,0,0,0.04)';
          ctx.beginPath();
          ctx.moveTo(prevBand.x + prevBand.w, prevBand.y);
          ctx.lineTo(x + w, y + h);
          ctx.lineTo(prevBand.x + prevBand.w, y + h);
          ctx.closePath();
          ctx.fill();
        }
      }

      yOff += bandH;
    }

    // Store band rects for click-to-select
    csLayerBandsRef.current = layerBands.map(b => ({ x: b.x, y: b.y, w: b.w, h: b.h, index: b.index }));

    // Draw labels — on the right side, connected by leader lines
    const labelX = centerX + (maxWidthMm / 2) * wScale + 8;
    for (let i = 0; i < layerBands.length; i++) {
      const { y, h, w, x, layer, mat, index: origIdx } = layerBands[i];
      const midY = y + h / 2;
      const fw = fiberWeightG(layer.materialKey, layer.areaM2);
      const isSel = origIdx === selIdx;

      // Leader line from layer edge to label
      ctx.strokeStyle = isSel ? 'rgba(229,57,53,0.3)' : 'rgba(0,0,0,0.15)';
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 2]);
      ctx.beginPath();
      ctx.moveTo(x + w, midY);
      ctx.lineTo(labelX - 2, midY);
      ctx.stroke();
      ctx.setLineDash([]);

      // Label text
      if (h >= 14) {
        ctx.fillStyle = isSel ? '#e53935' : 'rgba(0,0,0,0.7)';
        ctx.font = isSel ? 'bold 10px DM Sans, sans-serif' : 'bold 9px DM Sans, sans-serif';
        ctx.textAlign = 'left';
        const label = `${mat.label}  ${layer.thicknessMm}mm  ${Math.round(layer.heightMm)}x${Math.round(layer.widthMm)}  ${fw.toFixed(0)}g`;
        ctx.fillText(label, labelX, midY + 3);
      }

      // Material name centered on the band
      if (w > 80 && h >= 14) {
        ctx.fillStyle = isSel ? 'rgba(229,57,53,0.6)' : 'rgba(0,0,0,0.5)';
        ctx.font = '9px DM Sans, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(mat.label, x + w / 2, midY + 3);
      }
    }

    // Dimension lines — width of outermost (bottom) and innermost (top) layers
    if (layerBands.length > 0) {
      const drawHDim = (band, yPos, alpha) => {
        ctx.globalAlpha = alpha;
        ctx.strokeStyle = '#1a1a1a';
        ctx.lineWidth = 1;
        ctx.fillStyle = '#1a1a1a';
        ctx.font = 'bold 10px DM Sans, sans-serif';

        // Extension lines
        ctx.setLineDash([2, 2]);
        ctx.strokeStyle = 'rgba(0,0,0,0.15)';
        ctx.beginPath(); ctx.moveTo(band.x, band.y + band.h); ctx.lineTo(band.x, yPos); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(band.x + band.w, band.y + band.h); ctx.lineTo(band.x + band.w, yPos); ctx.stroke();
        ctx.setLineDash([]);

        // Main dimension line
        ctx.strokeStyle = '#1a1a1a';
        ctx.beginPath(); ctx.moveTo(band.x, yPos); ctx.lineTo(band.x + band.w, yPos); ctx.stroke();
        // Tick marks
        ctx.beginPath(); ctx.moveTo(band.x, yPos - 3); ctx.lineTo(band.x, yPos + 3); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(band.x + band.w, yPos - 3); ctx.lineTo(band.x + band.w, yPos + 3); ctx.stroke();
        // Label
        ctx.textAlign = 'center';
        ctx.fillText(`${Math.round(band.layer.widthMm)} mm`, band.x + band.w / 2, yPos + 14);
        ctx.globalAlpha = 1;
      };

      // Bottom layer width dim
      const bottom = layerBands[0];
      drawHDim(bottom, originY + 8, 1.0);

      // Top layer width dim (if different)
      if (layerBands.length > 1) {
        const top = layerBands[layerBands.length - 1];
        if (Math.abs(top.layer.widthMm - bottom.layer.widthMm) > 5) {
          drawHDim(top, originY - stackH - 8, 0.6);
        }
      }

      // Thickness dimension on the left
      const thickDimX = labelMarginL - 6;
      ctx.strokeStyle = '#1a1a1a';
      ctx.lineWidth = 1;
      ctx.fillStyle = '#1a1a1a';
      ctx.font = 'bold 10px DM Sans, sans-serif';

      // Extension lines
      ctx.setLineDash([2, 2]);
      ctx.strokeStyle = 'rgba(0,0,0,0.15)';
      ctx.beginPath(); ctx.moveTo(bottom.x, originY); ctx.lineTo(thickDimX, originY); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(layerBands[layerBands.length - 1].x, originY - stackH); ctx.lineTo(thickDimX, originY - stackH); ctx.stroke();
      ctx.setLineDash([]);

      ctx.strokeStyle = '#1a1a1a';
      ctx.beginPath(); ctx.moveTo(thickDimX, originY); ctx.lineTo(thickDimX, originY - stackH); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(thickDimX - 3, originY); ctx.lineTo(thickDimX + 3, originY); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(thickDimX - 3, originY - stackH); ctx.lineTo(thickDimX + 3, originY - stackH); ctx.stroke();
      ctx.save();
      ctx.translate(thickDimX - 8, originY - stackH / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.textAlign = 'center';
      ctx.fillText(`${totalThickMm.toFixed(1)} mm`, 0, 0);
      ctx.restore();
    }

    // Inner/Outer zone labels on the far right
    const ci = layers.findIndex(l => l.isCore);
    if (ci !== -1 && layerBands.length > 0) {
      const zoneRanges = { inner: { top: 0, bottom: 0 }, outer: { top: 0, bottom: 0 }, core: { top: 0, bottom: 0 } };
      for (let i = 0; i < layerBands.length; i++) {
        const b = layerBands[i];
        const origIdx = b.index;
        if (origIdx < ci) {
          if (!zoneRanges.inner.bottom) zoneRanges.inner.bottom = b.y + b.h;
          zoneRanges.inner.top = b.y;
          if (zoneRanges.inner.bottom < b.y + b.h) zoneRanges.inner.bottom = b.y + b.h;
        } else if (origIdx === ci) {
          zoneRanges.core.top = b.y;
          zoneRanges.core.bottom = b.y + b.h;
        } else {
          if (!zoneRanges.outer.bottom) zoneRanges.outer.bottom = b.y + b.h;
          zoneRanges.outer.top = b.y;
          if (zoneRanges.outer.bottom < b.y + b.h) zoneRanges.outer.bottom = b.y + b.h;
        }
      }

      const bracketX = cw - 14;
      const drawZoneBracket = (range, label, color) => {
        if (!range.bottom || !range.top || range.bottom <= range.top) return;
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(bracketX - 4, range.bottom); ctx.lineTo(bracketX, range.bottom);
        ctx.lineTo(bracketX, range.top); ctx.lineTo(bracketX - 4, range.top);
        ctx.stroke();
        ctx.fillStyle = color;
        ctx.font = 'bold 9px DM Sans, sans-serif';
        ctx.save();
        ctx.translate(bracketX + 10, (range.top + range.bottom) / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.textAlign = 'center';
        ctx.fillText(label, 0, 0);
        ctx.restore();
      };
      drawZoneBracket(zoneRanges.inner, 'INNER', '#2563eb');
      drawZoneBracket(zoneRanges.core, 'CORE', '#9ca3af');
      drawZoneBracket(zoneRanges.outer, 'OUTER', '#d97706');
    }

    // Scale bar bottom-left
    const scaleBarMm = maxWidthMm > 1000 ? 200 : 100;
    const scaleBarW = scaleBarMm * wScale;
    if (scaleBarW > 20 && scaleBarW < cw * 0.6) {
      const sbY = ch - 12;
      ctx.strokeStyle = '#1a1a1a'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(labelMarginL, sbY); ctx.lineTo(labelMarginL + scaleBarW, sbY); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(labelMarginL, sbY - 4); ctx.lineTo(labelMarginL, sbY + 4); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(labelMarginL + scaleBarW, sbY - 4); ctx.lineTo(labelMarginL + scaleBarW, sbY + 4); ctx.stroke();
      ctx.fillStyle = '#1a1a1a'; ctx.font = '10px DM Sans, sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(`${scaleBarMm} mm`, labelMarginL + scaleBarW / 2, sbY - 6);
    }

    // Title annotation
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.font = '9px DM Sans, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('Front Profile — thickness exaggerated', labelMarginL, ch - 4);
  }, [layers, selectedLayerIndex]);

  // ──────────────────────────────────────────────────────────────
  // SIDE CROSS-SECTION CANVAS — shows height (longitudinal) vs thickness
  // Same stacked view but using heightMm as the horizontal axis
  // ──────────────────────────────────────────────────────────────
  const redrawSideCrossSection = useCallback(() => {
    const canvas = sideCrossSectionRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const ctx = canvas.getContext('2d');
    const cw = canvas.width / dpr;
    const ch = canvas.height / dpr;
    ctx.clearRect(0, 0, cw, ch);

    if (layers.length === 0) {
      ctx.fillStyle = '#aaa';
      ctx.font = '14px DM Sans, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Side cross-section will appear here', cw / 2, ch / 2);
      sideLayerBandsRef.current = [];
      return;
    }
    const selIdx = selectedLayerIndex;

    const maxHeightMm = Math.max(...layers.map(l => l.heightMm));
    const totalThickMm = layers.reduce((s, l) => s + l.thicknessMm, 0);

    const labelMarginL = 20;
    const labelMarginR = 30;
    const marginTop = 30;
    const marginBottom = 35;
    const availW = cw - labelMarginL - labelMarginR;
    const availH = ch - marginTop - marginBottom;

    const wScale = availW / maxHeightMm;
    const minLayerPx = 18;
    const naturalStackH = totalThickMm * wScale;
    const targetStackH = availH * 0.85;
    const thickScale = naturalStackH < targetStackH
      ? Math.max(wScale, targetStackH / Math.max(totalThickMm, 0.1))
      : Math.min(wScale, targetStackH / Math.max(totalThickMm, 0.1));

    const stackH = layers.reduce((s, l) => s + Math.max(minLayerPx, l.thicknessMm * thickScale), 0);
    const centerX = labelMarginL + availW / 2;
    const originY = marginTop + (availH - stackH) / 2 + stackH;

    // Grid
    const gridStep = 50;
    ctx.strokeStyle = 'rgba(0,0,0,0.04)';
    ctx.lineWidth = 1;
    for (let mm = gridStep; mm < maxHeightMm / 2; mm += gridStep) {
      const px = mm * wScale;
      ctx.beginPath(); ctx.moveTo(centerX - px, originY - stackH - 10); ctx.lineTo(centerX - px, originY + 10); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(centerX + px, originY - stackH - 10); ctx.lineTo(centerX + px, originY + 10); ctx.stroke();
    }

    let yOff = 0;
    const layerBands = [];

    for (let i = 0; i < layers.length; i++) {
      const layer = layers[i];
      const mat = MATERIALS[layer.materialKey];
      const bandH = Math.max(minLayerPx, layer.thicknessMm * thickScale);
      const halfW = (layer.heightMm / 2) * wScale; // using heightMm here

      const x = centerX - halfW;
      const y = originY - yOff - bandH;
      const w = halfW * 2;
      const h = bandH;

      const isSelected = i === selIdx;
      layerBands.push({ x, y, w, h, layer, mat, index: i });

      if (i > 0) {
        ctx.fillStyle = 'rgba(0,0,0,0.06)';
        ctx.fillRect(x + 2, y + h, w, 2);
      }

      const grad = ctx.createLinearGradient(x, y, x, y + h);
      grad.addColorStop(0, mat.color);
      grad.addColorStop(1, mat.color + 'cc');
      ctx.fillStyle = grad;
      ctx.globalAlpha = isSelected ? 0.9 : 0.7;
      ctx.fillRect(x, y, w, h);
      ctx.globalAlpha = 1;

      if (!mat.isCore) {
        drawFiberHatch(ctx, { x, y, w, h }, mat.fiberAngle);
      }

      if (mat.isCore) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(x, y, w, h);
        ctx.clip();
        ctx.strokeStyle = 'rgba(0,0,0,0.10)';
        ctx.lineWidth = 1;
        for (let d = -cw; d < cw; d += 8) {
          ctx.beginPath(); ctx.moveTo(x + d, y + h); ctx.lineTo(x + d + h, y); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(x + d, y); ctx.lineTo(x + d + h, y + h); ctx.stroke();
        }
        ctx.restore();
      }

      ctx.strokeStyle = isSelected ? '#e53935' : 'rgba(0,0,0,0.25)';
      ctx.lineWidth = isSelected ? 2.5 : 1;
      ctx.strokeRect(x, y, w, h);

      // Chamfer steps
      if (i > 0) {
        const prevBand = layerBands[i - 1];
        const stepL = x - prevBand.x;
        const stepR = (prevBand.x + prevBand.w) - (x + w);
        if (stepL > 1) {
          ctx.strokeStyle = 'rgba(0,0,0,0.3)';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(prevBand.x, y + h);
          ctx.lineTo(x, y + h);
          ctx.stroke();
          ctx.fillStyle = 'rgba(0,0,0,0.04)';
          ctx.beginPath();
          ctx.moveTo(prevBand.x, prevBand.y);
          ctx.lineTo(x, y + h);
          ctx.lineTo(prevBand.x, y + h);
          ctx.closePath();
          ctx.fill();
        }
        if (stepR > 1) {
          ctx.strokeStyle = 'rgba(0,0,0,0.3)';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(prevBand.x + prevBand.w, y + h);
          ctx.lineTo(x + w, y + h);
          ctx.stroke();
          ctx.fillStyle = 'rgba(0,0,0,0.04)';
          ctx.beginPath();
          ctx.moveTo(prevBand.x + prevBand.w, prevBand.y);
          ctx.lineTo(x + w, y + h);
          ctx.lineTo(prevBand.x + prevBand.w, y + h);
          ctx.closePath();
          ctx.fill();
        }
      }

      yOff += bandH;
    }

    // Store band rects for drag-drop
    sideLayerBandsRef.current = layerBands.map(b => ({ x: b.x, y: b.y, w: b.w, h: b.h, index: b.index }));

    // Labels on right
    const labelX = centerX + (maxHeightMm / 2) * wScale + 8;
    for (let i = 0; i < layerBands.length; i++) {
      const { y, h, w, x, layer, mat, index: origIdx } = layerBands[i];
      const midY = y + h / 2;
      const isSel = origIdx === selIdx;

      ctx.strokeStyle = isSel ? 'rgba(229,57,53,0.3)' : 'rgba(0,0,0,0.15)';
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 2]);
      ctx.beginPath();
      ctx.moveTo(x + w, midY);
      ctx.lineTo(labelX - 2, midY);
      ctx.stroke();
      ctx.setLineDash([]);

      if (h >= 14) {
        ctx.fillStyle = isSel ? '#e53935' : 'rgba(0,0,0,0.7)';
        ctx.font = isSel ? 'bold 10px DM Sans, sans-serif' : 'bold 9px DM Sans, sans-serif';
        ctx.textAlign = 'left';
        const label = `${mat.label}  ${layer.thicknessMm}mm  ${Math.round(layer.heightMm)} mm`;
        ctx.fillText(label, labelX, midY + 3);
      }

      if (w > 80 && h >= 14) {
        ctx.fillStyle = isSel ? 'rgba(229,57,53,0.6)' : 'rgba(0,0,0,0.5)';
        ctx.font = '9px DM Sans, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(mat.label, x + w / 2, midY + 3);
      }
    }

    // Dimension lines
    if (layerBands.length > 0) {
      const drawHDim = (band, yPos, alpha) => {
        ctx.globalAlpha = alpha;
        ctx.strokeStyle = '#1a1a1a';
        ctx.lineWidth = 1;
        ctx.fillStyle = '#1a1a1a';
        ctx.font = 'bold 10px DM Sans, sans-serif';

        ctx.setLineDash([2, 2]);
        ctx.strokeStyle = 'rgba(0,0,0,0.15)';
        ctx.beginPath(); ctx.moveTo(band.x, band.y + band.h); ctx.lineTo(band.x, yPos); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(band.x + band.w, band.y + band.h); ctx.lineTo(band.x + band.w, yPos); ctx.stroke();
        ctx.setLineDash([]);

        ctx.strokeStyle = '#1a1a1a';
        ctx.beginPath(); ctx.moveTo(band.x, yPos); ctx.lineTo(band.x + band.w, yPos); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(band.x, yPos - 3); ctx.lineTo(band.x, yPos + 3); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(band.x + band.w, yPos - 3); ctx.lineTo(band.x + band.w, yPos + 3); ctx.stroke();
        ctx.textAlign = 'center';
        ctx.fillText(`${Math.round(band.layer.heightMm)} mm`, band.x + band.w / 2, yPos + 14);
        ctx.globalAlpha = 1;
      };

      const bottom = layerBands[0];
      drawHDim(bottom, originY + 8, 1.0);

      if (layerBands.length > 1) {
        const top = layerBands[layerBands.length - 1];
        if (Math.abs(top.layer.heightMm - bottom.layer.heightMm) > 5) {
          drawHDim(top, originY - stackH - 8, 0.6);
        }
      }

      // Thickness dimension on the left
      const thickDimX = labelMarginL - 6;
      ctx.strokeStyle = '#1a1a1a';
      ctx.lineWidth = 1;
      ctx.fillStyle = '#1a1a1a';
      ctx.font = 'bold 10px DM Sans, sans-serif';

      ctx.setLineDash([2, 2]);
      ctx.strokeStyle = 'rgba(0,0,0,0.15)';
      ctx.beginPath(); ctx.moveTo(bottom.x, originY); ctx.lineTo(thickDimX, originY); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(layerBands[layerBands.length - 1].x, originY - stackH); ctx.lineTo(thickDimX, originY - stackH); ctx.stroke();
      ctx.setLineDash([]);

      ctx.strokeStyle = '#1a1a1a';
      ctx.beginPath(); ctx.moveTo(thickDimX, originY); ctx.lineTo(thickDimX, originY - stackH); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(thickDimX - 3, originY); ctx.lineTo(thickDimX + 3, originY); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(thickDimX - 3, originY - stackH); ctx.lineTo(thickDimX + 3, originY - stackH); ctx.stroke();
      ctx.save();
      ctx.translate(thickDimX - 8, originY - stackH / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.textAlign = 'center';
      ctx.fillText(`${totalThickMm.toFixed(1)} mm`, 0, 0);
      ctx.restore();
    }

    // Scale bar
    const scaleBarMm = maxHeightMm > 1000 ? 200 : 100;
    const scaleBarW = scaleBarMm * wScale;
    if (scaleBarW > 20 && scaleBarW < cw * 0.6) {
      const sbY = ch - 12;
      ctx.strokeStyle = '#1a1a1a'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(labelMarginL, sbY); ctx.lineTo(labelMarginL + scaleBarW, sbY); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(labelMarginL, sbY - 4); ctx.lineTo(labelMarginL, sbY + 4); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(labelMarginL + scaleBarW, sbY - 4); ctx.lineTo(labelMarginL + scaleBarW, sbY + 4); ctx.stroke();
      ctx.fillStyle = '#1a1a1a'; ctx.font = '10px DM Sans, sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(`${scaleBarMm} mm`, labelMarginL + scaleBarW / 2, sbY - 6);
    }

    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.font = '9px DM Sans, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('Side Profile — thickness exaggerated', labelMarginL, ch - 4);
  }, [layers, selectedLayerIndex]);

  // Resize canvases to fill their containers (with DPR support for sharp rendering)
  useEffect(() => {
    let rafId = null;
    const resizeCanvas = (canvas) => {
      if (!canvas || !canvas.parentElement) return false;
      const dpr = window.devicePixelRatio || 1;
      const w = canvas.parentElement.clientWidth;
      const h = canvas.parentElement.clientHeight || Math.round(w * 0.6);
      const scaledW = Math.round(w * dpr);
      const scaledH = Math.round(h * dpr);
      if (canvas.width !== scaledW || canvas.height !== scaledH) {
        canvas.width = scaledW;
        canvas.height = scaledH;
        canvas.style.width = w + 'px';
        canvas.style.height = h + 'px';
        const ctx = canvas.getContext('2d');
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        return true;
      }
      return false;
    };
    const handleResize = () => {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        const changed1 = resizeCanvas(topDownRef.current);
        const changed2 = resizeCanvas(crossSectionRef.current);
        const changed3 = resizeCanvas(sideCrossSectionRef.current);
        if (changed1 || changed2 || changed3) {
          redrawTopDown();
          redrawCrossSection();
          redrawSideCrossSection();
        }
      });
    };
    handleResize();
    const observer = new ResizeObserver(handleResize);
    if (topDownRef.current?.parentElement) observer.observe(topDownRef.current.parentElement);
    if (crossSectionRef.current?.parentElement) observer.observe(crossSectionRef.current.parentElement);
    if (sideCrossSectionRef.current?.parentElement) observer.observe(sideCrossSectionRef.current.parentElement);
    return () => { observer.disconnect(); if (rafId) cancelAnimationFrame(rafId); };
  }, [redrawTopDown, redrawCrossSection, redrawSideCrossSection]);

  // Redraw all canvases on layers change
  useEffect(() => {
    redrawTopDown();
    redrawCrossSection();
    redrawSideCrossSection();
  }, [layers, redrawTopDown, redrawCrossSection, redrawSideCrossSection]);

  // ──────────────────────────────────────────────────────────────
  // MOUSE HANDLERS — top-down canvas
  // ──────────────────────────────────────────────────────────────
  const getCanvasXY = (e, canvasRef) => {
    const rect = (canvasRef || topDownRef).current.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  // Edge hit detection
  const isNearEdge = (px, py, rect) => {
    const inXRange = px >= rect.x - EDGE_HIT_PX && px <= rect.x + rect.w + EDGE_HIT_PX;
    const inYRange = py >= rect.y - EDGE_HIT_PX && py <= rect.y + rect.h + EDGE_HIT_PX;
    if (!inXRange || !inYRange) return null;
    if (Math.abs(px - rect.x) < EDGE_HIT_PX) return 'left';
    if (Math.abs(px - (rect.x + rect.w)) < EDGE_HIT_PX) return 'right';
    if (Math.abs(py - rect.y) < EDGE_HIT_PX) return 'top';
    if (Math.abs(py - (rect.y + rect.h)) < EDGE_HIT_PX) return 'bottom';
    return null;
  };

  // Check if point is inside a rect
  const isInsideRect = (px, py, rect) => (
    px >= rect.x && px <= rect.x + rect.w && py >= rect.y && py <= rect.y + rect.h
  );

  // Open dimension edit overlay positioned relative to the canvas wrapper
  const openDimEdit = (layerIndex, field, canvasEl, px, py) => {
    const wrapperRect = canvasEl.parentElement.getBoundingClientRect();
    const canvasRect = canvasEl.getBoundingClientRect();
    setDimEdit({
      layerIndex, field,
      px: canvasRect.left - wrapperRect.left + px,
      py: canvasRect.top - wrapperRect.top + py,
    });
    setTimeout(() => dimInputRef.current?.focus(), 0);
  };

  const commitDimEdit = (value) => {
    if (!dimEdit) return;
    const v = parseFloat(value);
    if (!isNaN(v) && v >= 10) {
      setUndoStack(prev => [...prev.slice(-19), [...layers]]);
      setLayers(prev => {
        const updated = prev.map(l => ({ ...l }));
        updated[dimEdit.layerIndex][dimEdit.field] = v;
        updated[dimEdit.layerIndex].areaM2 = (updated[dimEdit.layerIndex].widthMm * updated[dimEdit.layerIndex].heightMm) / 1e6;
        return updated;
      });
    }
    setDimEdit(null);
  };

  const handleMouseDown = (e) => {
    const { x, y } = getCanvasXY(e);
    dragRef.current.startX = x;
    dragRef.current.startY = y;
    dragRef.current.currentX = x;
    dragRef.current.currentY = y;

    // Check if clicking a dimension label first
    for (const zone of dimHitZonesRef.current) {
      if (isInsideRect(x, y, zone)) {
        openDimEdit(zone.layerIndex, zone.field, topDownRef.current, x, y);
        setSelectedLayerIndex(zone.layerIndex);
        return;
      }
    }

    // Check for edge resize (if layers exist)
    for (let i = layerRectsRef.current.length - 1; i >= 0; i--) {
      const edge = isNearEdge(x, y, layerRectsRef.current[i]);
      if (edge) {
        dragRef.current.mode = 'resizing';
        dragRef.current.layerIndex = i;
        dragRef.current.edge = edge;
        setSelectedLayerIndex(i);
        setUndoStack(prev => [...prev.slice(-19), [...layersRef.current]]);
        return;
      }
    }

    // Otherwise start drawing a new layer rectangle
    dragRef.current.mode = 'drawing';
  };

  const handleMouseMove = (e) => {
    const { x, y } = getCanvasXY(e);

    if (dragRef.current.mode === 'none') {
      let cursor = 'crosshair';
      // Check dimension label hover first
      for (const zone of dimHitZonesRef.current) {
        if (isInsideRect(x, y, zone)) { cursor = 'pointer'; break; }
      }
      if (cursor === 'crosshair') {
        for (let i = layerRectsRef.current.length - 1; i >= 0; i--) {
          const edge = isNearEdge(x, y, layerRectsRef.current[i]);
          if (edge === 'left' || edge === 'right') { cursor = 'ew-resize'; break; }
          if (edge === 'top' || edge === 'bottom') { cursor = 'ns-resize'; break; }
        }
      }
      topDownRef.current.style.cursor = cursor;
      return;
    }

    dragRef.current.currentX = x;
    dragRef.current.currentY = y;

    if (dragRef.current.mode === 'drawing') {
      redrawTopDown();
      return;
    }

    if (dragRef.current.mode === 'resizing') {
      const li = dragRef.current.layerIndex;
      const edge = dragRef.current.edge;
      const scale = scaleRef.current;
      const dxMm = (x - dragRef.current.startX) / scale;
      const dyMm = (y - dragRef.current.startY) / scale;

      setLayers(prev => {
        const updated = prev.map(l => ({ ...l }));
        const layer = updated[li];
        const MIN_MM = 50;
        if (edge === 'right') layer.widthMm = Math.max(MIN_MM, layer.widthMm + dxMm);
        if (edge === 'left') layer.widthMm = Math.max(MIN_MM, layer.widthMm - dxMm);
        if (edge === 'bottom') layer.heightMm = Math.max(MIN_MM, layer.heightMm + dyMm);
        if (edge === 'top') layer.heightMm = Math.max(MIN_MM, layer.heightMm - dyMm);
        layer.areaM2 = (layer.widthMm * layer.heightMm) / 1e6;
        return updated;
      });
      dragRef.current.startX = x;
      dragRef.current.startY = y;
    }
  };

  const handleMouseUp = (e) => {
    if (dragRef.current.mode === 'drawing') {
      const { startX, startY, currentX, currentY } = dragRef.current;
      const scale = scaleRef.current;
      const widthMm = Math.abs(currentX - startX) / scale;
      const heightMm = Math.abs(currentY - startY) / scale;

      // Small click (not a drag) = select a layer
      const pxDist = Math.sqrt((currentX - startX) ** 2 + (currentY - startY) ** 2);
      if (pxDist < 5) {
        // Click-to-select: find innermost layer containing the click (last in array = smallest)
        let found = -1;
        for (let i = layerRectsRef.current.length - 1; i >= 0; i--) {
          if (isInsideRect(currentX, currentY, layerRectsRef.current[i])) { found = i; break; }
        }
        setSelectedLayerIndex(found);
        dragRef.current.mode = 'none';
        return;
      }

      // Drag threshold: ignore tiny drags (< 20mm)
      if (widthMm > 20 && heightMm > 20) {
        const w = Math.round(widthMm);
        const h = Math.round(heightMm);
        const thick = defaultThickness(selectedMaterial, processType);

        setUndoStack(prev => [...prev.slice(-19), [...layersRef.current]]);

        if (selectedMaterial === 'UD1322') {
          setUd1322Banner(true);
          const ud661Thick = defaultThickness('UD661', processType);
          const newLayers = [...layersRef.current, {
            id: makeId(), materialKey: 'UD661', widthMm: w, heightMm: h,
            thicknessMm: ud661Thick, isCore: false, orientation: 0, areaM2: (w * h) / 1e6,
          }];
          const w2 = w - 20, h2 = h - 100;
          if (w2 > 0 && h2 > 0) {
            newLayers.push({
              id: makeId(), materialKey: 'UD661', widthMm: w2, heightMm: h2,
              thicknessMm: ud661Thick, isCore: false, orientation: 0, areaM2: (w2 * h2) / 1e6,
            });
          }
          setLayers(sortLayers(newLayers));
        } else {
          const newLayer = {
            id: makeId(), materialKey: selectedMaterial,
            widthMm: w, heightMm: h,
            thicknessMm: thick, isCore: false, orientation: 0,
            areaM2: (w * h) / 1e6,
          };
          setLayers(sortLayers([...layersRef.current, newLayer]));
        }
      }
    }

    dragRef.current.mode = 'none';
    redrawTopDown();
  };

  const handleMouseLeave = () => {
    if (dragRef.current.mode === 'drawing') {
      dragRef.current.mode = 'none';
      redrawTopDown();
    }
  };

  const zoomIn = () => setZoomLevel(prev => Math.min(5, prev + 0.25));
  const zoomOut = () => setZoomLevel(prev => Math.max(0.2, prev - 0.25));
  const zoomReset = () => setZoomLevel(1);

  // ──────────────────────────────────────────────────────────────
  // DRAG-DROP HANDLERS — front & side profile canvases
  // Mousedown starts drag on a band, mousemove shows drop indicator,
  // mouseup reorders layers. Short clicks still select.
  // ──────────────────────────────────────────────────────────────
  const getBandsForCanvas = (which) =>
    which === 'front' ? csLayerBandsRef.current : sideLayerBandsRef.current;

  const getCanvasForProfile = (which) =>
    which === 'front' ? crossSectionRef.current : sideCrossSectionRef.current;

  const findBandAtY = (bands, x, y) => {
    for (let i = bands.length - 1; i >= 0; i--) {
      const b = bands[i];
      if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return b;
    }
    return null;
  };

  const findDropTarget = (bands, y, dragIndex) => {
    // Find which band boundary the cursor is closest to.
    // Bands are stacked bottom-up: bands[0] is bottom (biggest), bands[last] is top (smallest).
    // Lower y = higher in stack (smaller index in layers). We return the target index.
    for (let i = 0; i < bands.length; i++) {
      const b = bands[i];
      const midY = b.y + b.h / 2;
      if (y > midY) return b.index; // drop above this band = take its position
    }
    // Above all bands — drop at topmost position
    return bands.length > 0 ? bands[bands.length - 1].index : -1;
  };

  const drawDragOverlay = (which) => {
    const canvas = getCanvasForProfile(which);
    const bands = getBandsForCanvas(which);
    if (!canvas || !profileDragRef.current.active) return;

    // Redraw the base canvas first
    if (which === 'front') redrawCrossSection();
    else redrawSideCrossSection();

    const dpr = window.devicePixelRatio || 1;
    const ctx = canvas.getContext('2d');
    const dragIdx = profileDragRef.current.layerIndex;
    const targetIdx = profileDragRef.current.targetIndex;

    // Highlight the dragged band
    const dragBand = bands.find(b => b.index === dragIdx);
    if (dragBand) {
      ctx.save();
      ctx.globalAlpha = 0.3;
      ctx.fillStyle = '#e53935';
      ctx.fillRect(dragBand.x, dragBand.y, dragBand.w, dragBand.h);
      ctx.restore();
    }

    // Draw drop indicator line
    if (targetIdx >= 0 && targetIdx !== dragIdx) {
      const targetBand = bands.find(b => b.index === targetIdx);
      if (targetBand) {
        const lineY = targetIdx < dragIdx ? targetBand.y + targetBand.h : targetBand.y;
        ctx.strokeStyle = '#e53935';
        ctx.lineWidth = 3;
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.moveTo(targetBand.x - 5, lineY);
        ctx.lineTo(targetBand.x + targetBand.w + 5, lineY);
        ctx.stroke();
        // Arrow heads
        ctx.fillStyle = '#e53935';
        ctx.beginPath();
        ctx.moveTo(targetBand.x - 5, lineY);
        ctx.lineTo(targetBand.x + 3, lineY - 5);
        ctx.lineTo(targetBand.x + 3, lineY + 5);
        ctx.closePath();
        ctx.fill();
      }
    }

    // Grab cursor label
    ctx.fillStyle = 'rgba(229,57,53,0.85)';
    ctx.font = 'bold 10px DM Sans, sans-serif';
    ctx.textAlign = 'center';
    const dragMat = layers[dragIdx] ? MATERIALS[layers[dragIdx].materialKey]?.label : '';
    const cursorY = profileDragRef.current.currentY;
    ctx.fillText(`Moving: ${dragMat}`, canvas.width / dpr / 2, Math.max(14, cursorY - 10));
  };

  const handleProfileMouseDown = (which) => (e) => {
    const canvas = getCanvasForProfile(which);
    const bands = getBandsForCanvas(which);
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const band = findBandAtY(bands, x, y);
    if (band) {
      profileDragRef.current = {
        active: true, canvas: which,
        layerIndex: band.index, startY: y, currentY: y,
        targetIndex: band.index,
      };
      setSelectedLayerIndex(band.index);
      canvas.style.cursor = 'grabbing';
    }
  };

  const handleProfileMouseMove = (which) => (e) => {
    const canvas = getCanvasForProfile(which);
    const bands = getBandsForCanvas(which);
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (!profileDragRef.current.active || profileDragRef.current.canvas !== which) {
      // Hover cursor
      const band = findBandAtY(bands, x, y);
      canvas.style.cursor = band ? 'grab' : 'default';
      return;
    }

    profileDragRef.current.currentY = y;
    profileDragRef.current.targetIndex = findDropTarget(bands, y, profileDragRef.current.layerIndex);
    drawDragOverlay(which);
  };

  const handleProfileMouseUp = (which) => (e) => {
    const canvas = getCanvasForProfile(which);
    if (!profileDragRef.current.active || profileDragRef.current.canvas !== which) return;

    const { layerIndex: fromIdx, targetIndex: toIdx, startY, currentY } = profileDragRef.current;
    profileDragRef.current.active = false;
    canvas.style.cursor = 'grab';

    // If barely moved, treat as click-to-select
    if (Math.abs(currentY - startY) < 5) {
      // Already selected on mousedown
      if (which === 'front') redrawCrossSection();
      else redrawSideCrossSection();
      return;
    }

    // Reorder if target differs from source
    if (toIdx >= 0 && toIdx !== fromIdx) {
      setUndoStack(prev => [...prev.slice(-19), [...layersRef.current]]);
      setLayers(prev => {
        const updated = [...prev];
        const [moved] = updated.splice(fromIdx, 1);
        const insertAt = toIdx > fromIdx ? toIdx - 1 : toIdx;
        updated.splice(Math.max(0, insertAt), 0, moved);
        return updated;
      });
    } else {
      if (which === 'front') redrawCrossSection();
      else redrawSideCrossSection();
    }
  };

  const handleProfileMouseLeave = (which) => () => {
    if (profileDragRef.current.active && profileDragRef.current.canvas === which) {
      profileDragRef.current.active = false;
      const canvas = getCanvasForProfile(which);
      if (canvas) canvas.style.cursor = 'grab';
      if (which === 'front') redrawCrossSection();
      else redrawSideCrossSection();
    }
  };

  // ──────────────────────────────────────────────────────────────
  // ACTIONS
  // ──────────────────────────────────────────────────────────────

  // Sort layers by area — zone-aware when core exists.
  // Without core: biggest first (index 0 = outermost in top-down view).
  // With core: sort inner zone and outer zone independently, keeping core in place.
  // Inner (before core): ascending (smallest at bottom of cross-section, biggest near core).
  // Outer (after core): ascending (smallest near core, biggest at top = surface).
  const sortLayers = (layerArr) => {
    const ci = layerArr.findIndex(l => l.isCore);
    if (ci === -1) {
      // No core — global sort, biggest first
      return [...layerArr].sort((a, b) => (b.widthMm * b.heightMm) - (a.widthMm * a.heightMm));
    }
    // With core: sort each zone independently, preserving core position
    const inner = layerArr.slice(0, ci);
    const core = layerArr[ci];
    const outer = layerArr.slice(ci + 1);
    inner.sort((a, b) => (a.widthMm * a.heightMm) - (b.widthMm * b.heightMm));
    outer.sort((a, b) => (a.widthMm * a.heightMm) - (b.widthMm * b.heightMm));
    return [...inner, core, ...outer];
  };

  const addLayer = () => {
    const mat = MATERIALS[selectedMaterial];
    const thick = defaultThickness(selectedMaterial, processType);
    let w, h;

    // Use manual dimensions if provided, otherwise auto-derive
    if (inputWidth && inputHeight) {
      w = parseFloat(inputWidth);
      h = parseFloat(inputHeight);
      if (w <= 0 || h <= 0) return;
    } else if (layers.length > 0) {
      // When core exists, new layers added after core (outer side) use special sizing:
      // - The first outer fiber layer matches core dimensions (core laminated with same size glass)
      // - Subsequent outer layers chamfer from the previous outer layer
      const ci = layers.findIndex(l => l.isCore);
      const outerFiberLayers = ci !== -1 ? layers.slice(ci + 1).filter(l => !l.isCore) : [];

      if (ci !== -1 && outerFiberLayers.length === 0) {
        // First outer layer — same size as core
        const coreLayer = layers[ci];
        w = coreLayer.widthMm;
        h = coreLayer.heightMm;
      } else if (ci !== -1 && outerFiberLayers.length > 0) {
        // Subsequent outer layers — chamfer from last outer fiber layer
        const lastOuter = outerFiberLayers[outerFiberLayers.length - 1];
        w = lastOuter.widthMm - 2 * mat.chamferTrans;
        h = lastOuter.heightMm - 2 * mat.chamferLong;
      } else {
        // No core — derive from smallest non-core layer
        const innermost = [...layers].filter(l => !l.isCore).pop() || layers[layers.length - 1];
        w = innermost.widthMm - 2 * mat.chamferTrans;
        h = innermost.heightMm - 2 * mat.chamferLong;
      }

      if (w <= 0 || h <= 0) {
        setLayerError('Layer too small — chamfer values exceed remaining repair area.');
        return;
      }
    } else {
      // No layers and no dimensions — nothing to do
      setLayerError('Enter width and height for the first layer.');
      return;
    }

    setUndoStack(prev => [...prev.slice(-19), [...layers]]);

    if (selectedMaterial === 'UD1322') {
      setUd1322Banner(true);
      const ud661Thick = defaultThickness('UD661', processType);
      const newLayers = [...layers, {
        id: makeId(), materialKey: 'UD661', widthMm: w, heightMm: h,
        thicknessMm: ud661Thick, isCore: false, orientation: 0, areaM2: (w * h) / 1e6,
      }];
      const w2 = w - 20, h2 = h - 100;
      if (w2 > 0 && h2 > 0) {
        newLayers.push({
          id: makeId(), materialKey: 'UD661', widthMm: w2, heightMm: h2,
          thicknessMm: ud661Thick, isCore: false, orientation: 0, areaM2: (w2 * h2) / 1e6,
        });
      }
      setLayers(sortLayers(newLayers));
    } else {
      const newLayer = {
        id: makeId(), materialKey: selectedMaterial,
        widthMm: w, heightMm: h,
        thicknessMm: thick, isCore: false, orientation: 0,
        areaM2: (w * h) / 1e6,
      };
      setLayers(prev => sortLayers([...prev, newLayer]));
    }
    setInputWidth('');
    setInputHeight('');
    setLayerError('');
  };

  const addCore = () => {
    if (layers.length === 0) return;
    const thick = parseFloat(coreThickness) || defaultThickness('CORE', processType);
    const insertAt = coreInsertIndex === -1 ? layers.length : Math.min(coreInsertIndex, layers.length);
    const refLayer = layers[Math.min(insertAt, layers.length - 1)];

    setUndoStack(prev => [...prev.slice(-19), [...layers]]);
    setLayers(prev => {
      const updated = [...prev];
      updated.splice(insertAt, 0, {
        id: makeId(), materialKey: 'CORE',
        widthMm: refLayer.widthMm, heightMm: refLayer.heightMm,
        thicknessMm: thick, isCore: true, orientation: 0,
        areaM2: (refLayer.widthMm * refLayer.heightMm) / 1e6,
      });
      return updated;
    });
    setCoreThickness('');
  };

  const undo = () => {
    if (undoStack.length === 0) return;
    const prev = undoStack[undoStack.length - 1];
    setUndoStack(s => s.slice(0, -1));
    setLayers(prev);
  };

  const removeLayer = (index) => {
    setUndoStack(prev => [...prev.slice(-19), [...layers]]);
    setLayers(prev => prev.filter((_, i) => i !== index));
  };

  const moveLayer = (index, dir) => {
    const target = index + dir;
    if (target < 0 || target >= layers.length) return;
    setUndoStack(prev => [...prev.slice(-19), [...layers]]);
    setLayers(prev => {
      const updated = [...prev];
      [updated[index], updated[target]] = [updated[target], updated[index]];
      return updated;
    });
  };

  const updateLayerThickness = (index, value) => {
    const v = parseFloat(value);
    if (isNaN(v) || v < 0) return;
    setLayers(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], thicknessMm: v };
      return updated;
    });
  };

  const updateLayerOrientation = (index, value) => {
    const v = parseInt(value, 10);
    if (isNaN(v)) return;
    setLayers(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], orientation: v };
      return updated;
    });
  };

  const updateLayerDimension = (index, field, v) => {
    if (isNaN(v) || v < 10) return;
    setUndoStack(prev => [...prev.slice(-19), [...layers]]);
    setLayers(prev => {
      const updated = prev.map(l => ({ ...l }));
      updated[index][field] = v;
      updated[index].areaM2 = (updated[index].widthMm * updated[index].heightMm) / 1e6;
      return updated;
    });
  };

  // Recalculate all layer dimensions using chamfer rules
  // Inner layers (before core, i < ci): chamfer inward from biggest
  // Outer layers (after core, i > ci): first outer layer = same size as core, then chamfer
  const recalcDimensions = () => {
    if (layers.length < 2) return;
    setUndoStack(prev => [...prev.slice(-19), [...layers]]);
    setLayers(prev => {
      const updated = prev.map(l => ({ ...l }));
      const ci = updated.findIndex(l => l.isCore);

      // Inner layers: index 0 is biggest (keep dims), derive inward to core
      for (let i = 1; i < updated.length; i++) {
        if (i === ci) {
          // Core inherits from previous inner layer (no chamfer on core itself)
          updated[i].widthMm = updated[i - 1].widthMm;
          updated[i].heightMm = updated[i - 1].heightMm;
        } else if (ci !== -1 && i === ci + 1) {
          // First outer fiber layer — same size as core
          updated[i].widthMm = updated[ci].widthMm;
          updated[i].heightMm = updated[ci].heightMm;
        } else {
          const mat = MATERIALS[updated[i].materialKey];
          updated[i].widthMm = Math.max(10, Math.round(updated[i - 1].widthMm - 2 * mat.chamferTrans));
          updated[i].heightMm = Math.max(10, Math.round(updated[i - 1].heightMm - 2 * mat.chamferLong));
        }
        updated[i].areaM2 = (updated[i].widthMm * updated[i].heightMm) / 1e6;
      }
      return updated;
    });
  };

  const changeLayerMaterial = (index, newKey) => {
    setUndoStack(prev => [...prev.slice(-19), [...layers]]);
    setLayers(prev => {
      const updated = [...prev];
      const mat = MATERIALS[newKey];
      updated[index] = {
        ...updated[index],
        materialKey: newKey,
        isCore: !!mat.isCore,
        thicknessMm: defaultThickness(newKey, processType),
      };
      return updated;
    });
  };

  const clearAll = () => {
    if (layers.length === 0) return;
    setUndoStack(prev => [...prev.slice(-19), [...layers]]);
    setLayers([]);
    setUd1322Banner(false);
    setLayerError('');
  };

  const newDrawing = () => {
    if (layers.length > 0 && !window.confirm('Start a new drawing? Current layers will be cleared.')) return;
    setUndoStack([]);
    setLayers([]);
    setUd1322Banner(false);
    setDrawingName('');
    setLayerError('');
  };

  const saveDrawing = () => {
    const drawing = {
      id: makeId(),
      name: drawingName || 'Untitled',
      layers,
      processType,
      date: new Date().toISOString(),
      projectId: assocProjectId || null,
      turbineId: assocTurbineId || null,
      bladeId: assocBladeId || null,
      damageId: assocDamageId || null,
    };
    const updated = [...savedDrawings, drawing];
    setSavedDrawings(updated);
    localStorage.setItem('repairDrawings', JSON.stringify(updated));
    setToast('Drawing saved');
    setTimeout(() => setToast(''), 2000);
  };

  const loadDrawing = (id) => {
    const drawing = savedDrawings.find(d => d.id === id);
    if (!drawing) return;
    setUndoStack(prev => [...prev.slice(-19), [...layers]]);
    setLayers(drawing.layers);
    setDrawingName(drawing.name);
    setProcessType(drawing.processType || 'handlayup');
    setUd1322Banner(drawing.layers.some(l => l.materialKey === 'UD1322'));
    setAssocProjectId(drawing.projectId || '');
    setAssocTurbineId(drawing.turbineId || '');
    setAssocBladeId(drawing.bladeId || '');
    setAssocDamageId(drawing.damageId || '');
  };

  const deleteSavedDrawing = (id) => {
    const updated = savedDrawings.filter(d => d.id !== id);
    setSavedDrawings(updated);
    localStorage.setItem('repairDrawings', JSON.stringify(updated));
    setToast('Drawing deleted');
    setTimeout(() => setToast(''), 2000);
  };

  const exportPng = () => {
    const crossCanvas = crossSectionRef.current;
    const sideCanvas = sideCrossSectionRef.current;
    const topCanvas = topDownRef.current;
    if (!crossCanvas || !topCanvas) return;
    const gap = 20, headerH = 60, footerH = 30;
    const topRowW = topCanvas.width;
    const topRowH = topCanvas.height;
    const csRowW = crossCanvas.width + gap + (sideCanvas ? sideCanvas.width : 0);
    const csRowH = Math.max(crossCanvas.height, sideCanvas ? sideCanvas.height : 0);
    const offscreen = document.createElement('canvas');
    offscreen.width = Math.max(topRowW, csRowW);
    offscreen.height = topRowH + gap + csRowH + headerH + footerH;
    const ctx = offscreen.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, offscreen.width, offscreen.height);
    ctx.fillStyle = '#1a1a1a';
    ctx.font = 'bold 14px DM Sans, sans-serif';
    ctx.fillText(drawingName || 'Untitled Drawing', 16, 22);
    ctx.font = '11px DM Sans, sans-serif';
    ctx.fillStyle = '#666';
    ctx.fillText(`Exported: ${new Date().toLocaleString()}`, 16, 38);
    ctx.fillText(`Layers: ${layers.length}  |  ${totalThickness.toFixed(1)} mm thick  |  Fiber: ${totalFiberWeight.toFixed(0)} g  |  Resin: ${resinEstimate.toFixed(2)} kg (${proc.label})`, 16, 52);
    ctx.drawImage(topCanvas, 0, headerH);
    ctx.drawImage(crossCanvas, 0, headerH + topRowH + gap);
    if (sideCanvas) {
      ctx.drawImage(sideCanvas, crossCanvas.width + gap, headerH + topRowH + gap);
    }
    ctx.fillStyle = '#999';
    ctx.font = '10px DM Sans, sans-serif';
    ctx.fillText('Generated by Vetra Rotor Repair Tool', 16, offscreen.height - 10);
    const link = document.createElement('a');
    link.download = `repair-drawing-${Date.now()}.png`;
    link.href = offscreen.toDataURL('image/png');
    link.click();
  };

  const copyMaterialTable = () => {
    const lines = ['Material\tLayers\tTotal area (m2)\tFiber weight (g)'];
    Object.entries(materialOrder).forEach(([key, val]) => {
      lines.push(`${MATERIALS[key].label}\t${val.count}\t${val.totalArea.toFixed(2)}\t${val.totalFiberG.toFixed(0)}`);
    });
    navigator.clipboard.writeText(lines.join('\n'));
    setToast('Copied to clipboard');
    setTimeout(() => setToast(''), 2000);
  };

  const selectedMat = MATERIALS[selectedMaterial];

  // Mouse wheel zoom on top-down canvas (non-passive to allow preventDefault)
  useEffect(() => {
    const canvas = topDownRef.current;
    if (!canvas) return;
    const handler = (e) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      setZoomLevel(prev => Math.max(0.2, Math.min(5, prev + delta)));
    };
    canvas.addEventListener('wheel', handler, { passive: false });
    return () => canvas.removeEventListener('wheel', handler);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e) => {
      if (e.ctrlKey && e.key === 'z') {
        e.preventDefault();
        undo();
      }
      if (e.key === '+' || e.key === '=') {
        if (!e.ctrlKey && document.activeElement?.tagName !== 'INPUT') {
          e.preventDefault();
          setZoomLevel(prev => Math.min(5, prev + 0.25));
        }
      }
      if (e.key === '-' || e.key === '_') {
        if (!e.ctrlKey && document.activeElement?.tagName !== 'INPUT') {
          e.preventDefault();
          setZoomLevel(prev => Math.max(0.2, prev - 0.25));
        }
      }
      if (e.key === 'Escape') {
        if (dimEdit) {
          setDimEdit(null);
        } else if (dragRef.current.mode !== 'none') {
          dragRef.current.mode = 'none';
          redrawTopDown();
        } else if (selectedLayerIndex >= 0) {
          setSelectedLayerIndex(-1);
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [undoStack, redrawTopDown, dimEdit, selectedLayerIndex]);

  // ──────────────────────────────────────────────────────────────
  // RENDER
  // ──────────────────────────────────────────────────────────────
  return (
    <div className="rd-page">
      {toast && <div className="rd-toast">{toast}</div>}

      {csmWarning && (
        <div className="rd-warning-bar rd-warning-orange">
          Warning: Laminate stack does not start and end with a CSM connecting layer. Check repair specification.
        </div>
      )}
      {adjacentUdWarning && (
        <div className="rd-warning-bar rd-warning-orange">
          Warning: Adjacent UD (0°) layers without biaxial separation — check stacking sequence per repair specification.
        </div>
      )}
      {symmetryWarning && (
        <div className="rd-warning-bar rd-warning-orange">
          Warning: Inner and outer skins around core are not symmetric — check repair specification requires balanced laminate.
        </div>
      )}
      {ud1322Banner && (
        <div className="rd-warning-bar rd-warning-yellow">
          UD1322 layers were substituted with 2x UD661 layers per specification.
        </div>
      )}
      {layerError && (
        <div className="rd-warning-bar rd-warning-red">{layerError}</div>
      )}

      {/* Drawing area — fits viewport */}
      <div className="rd-drawing-area">
        {/* Sidebar: Add Layer controls */}
        <div className="rd-sidebar">
          <div className="rd-section-label">Add Layer</div>

          <div className="rd-form-row">
            <label className="rd-label">Process</label>
            <select className="rd-select" value={processType} onChange={e => setProcessType(e.target.value)}>
              {Object.entries(PROCESS_TYPES).map(([key, p]) => (
                <option key={key} value={key}>{p.label}</option>
              ))}
            </select>
          </div>

          <div className="rd-form-row">
            <label className="rd-label">Material</label>
            <select className="rd-select" value={selectedMaterial} onChange={e => setSelectedMaterial(e.target.value)}>
              {Object.entries(MATERIALS).filter(([k]) => k !== 'CORE').map(([key, mat]) => (
                <option key={key} value={key}>{mat.label} ({mat.gsm} g/m²)</option>
              ))}
            </select>
          </div>

          {selectedMaterial === 'UD1322' && (
            <div className="rd-warning-bar rd-warning-yellow rd-warning-inline">
              2x UD661 substitution
            </div>
          )}
          {selectedMat.note && selectedMaterial !== 'UD1322' && (
            <div className="rd-note">{selectedMat.note}</div>
          )}

          <div className="rd-dims-section">
            <div className="rd-section-label">Dimensions (mm)</div>
            <div className="rd-dims-row">
              <div className="rd-dims-field">
                <label className="rd-label">H (long.)</label>
                <input type="number" className="rd-input" value={inputHeight}
                  onChange={e => setInputHeight(e.target.value)}
                  placeholder={layers.length > 0 ? 'Auto' : '300'}
                  min="1" step="10" />
              </div>
              <span className="rd-dims-x">x</span>
              <div className="rd-dims-field">
                <label className="rd-label">W (trans.)</label>
                <input type="number" className="rd-input" value={inputWidth}
                  onChange={e => setInputWidth(e.target.value)}
                  placeholder={layers.length > 0 ? 'Auto' : '500'}
                  min="1" step="10" />
              </div>
            </div>
            {layers.length > 0 && !inputWidth && !inputHeight && (
              <div className="rd-dims-auto">
                Auto: {(() => {
                  const ci = layers.findIndex(l => l.isCore);
                  const mat = MATERIALS[selectedMaterial];
                  const outerFiber = ci !== -1 ? layers.slice(ci + 1).filter(l => !l.isCore) : [];

                  let w, h, note;
                  if (ci !== -1 && outerFiber.length === 0) {
                    const core = layers[ci];
                    w = Math.round(core.widthMm);
                    h = Math.round(core.heightMm);
                    note = 'core';
                  } else if (ci !== -1 && outerFiber.length > 0) {
                    const last = outerFiber[outerFiber.length - 1];
                    w = Math.round(last.widthMm - 2 * mat.chamferTrans);
                    h = Math.round(last.heightMm - 2 * mat.chamferLong);
                    note = 'outer';
                  } else {
                    const innermost = [...layers].filter(l => !l.isCore).pop() || layers[layers.length - 1];
                    w = Math.round(innermost.widthMm - 2 * mat.chamferTrans);
                    h = Math.round(innermost.heightMm - 2 * mat.chamferLong);
                    note = 'chamfer';
                  }
                  return w > 0 && h > 0 ? `${h}x${w} (${note})` : 'Too small';
                })()}
              </div>
            )}
          </div>

          <div className="rd-info-row">
            <strong>{defaultThickness(selectedMaterial, processType)}mm</strong> thick
            {' '} | {selectedMat.chamferLong}L/{selectedMat.chamferTrans}T
            {' '} | {selectedMat.gsm}g/m²
          </div>

          <div className="rd-form-actions">
            <button className="rd-btn rd-btn-primary" onClick={addLayer}
              disabled={layers.length === 0 && (!inputWidth || !inputHeight)}>
              Add Layer
            </button>
            <button className="rd-btn" onClick={undo} disabled={undoStack.length === 0}>
              Undo
            </button>
          </div>

          <div className="rd-core-toggle">
            <label className="rd-checkbox-label">
              <input type="checkbox" checked={includeCore} onChange={e => setIncludeCore(e.target.checked)} />
              Core Material
            </label>
            {includeCore && (
              <div className="rd-core-controls">
                <div className="rd-form-row">
                  <label className="rd-label">Core Thickness (mm)</label>
                  <input
                    type="number" className="rd-input" value={coreThickness}
                    onChange={e => setCoreThickness(e.target.value)}
                    placeholder="3-40 mm"
                    min="0" step="0.5"
                  />
                </div>
                <div className="rd-form-row">
                  <label className="rd-label">Insert Position</label>
                  <select className="rd-select" value={coreInsertIndex} onChange={e => setCoreInsertIndex(Number(e.target.value))}>
                    <option value={-1}>On top (layer {layers.length + 1})</option>
                    {layers.map((l, i) => (
                      <option key={l.id} value={i}>Before {i + 1} — {MATERIALS[l.materialKey].label}</option>
                    ))}
                  </select>
                </div>
                <button className="rd-btn" onClick={addCore} disabled={layers.length === 0}>
                  Add Core
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Three canvases in a 2x2-like grid (top: top-down spanning full, bottom: front + side) */}
        <div className="rd-views">
          <div className="rd-canvas-wrapper rd-view-topdown" style={{ position: 'relative' }}>
            <div className="rd-canvas-title">
              Top-Down View (interactive)
              <span className="rd-zoom-controls">
                <button className="rd-btn-sm rd-zoom-btn" onClick={zoomOut} title="Zoom out">−</button>
                <button className="rd-btn-sm rd-zoom-btn rd-zoom-label" onClick={zoomReset} title="Reset zoom">
                  {Math.round(zoomLevel * 100)}%
                </button>
                <button className="rd-btn-sm rd-zoom-btn" onClick={zoomIn} title="Zoom in">+</button>
              </span>
            </div>
            <canvas
              ref={topDownRef} className="rd-canvas"
              onMouseDown={handleMouseDown} onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp} onMouseLeave={handleMouseLeave}
            />
            {dimEdit && (
              <input
                ref={dimInputRef}
                type="number"
                className="rd-dim-overlay-input"
                defaultValue={Math.round(layers[dimEdit.layerIndex]?.[dimEdit.field] || 0)}
                min={10} step={10}
                style={{
                  position: 'absolute',
                  left: dimEdit.px - 35,
                  top: dimEdit.py - 10,
                  width: 70,
                  zIndex: 10,
                }}
                onBlur={e => commitDimEdit(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') e.target.blur();
                  if (e.key === 'Escape') setDimEdit(null);
                }}
              />
            )}
          </div>
          <div className="rd-canvas-wrapper rd-view-front">
            <div className="rd-canvas-title">Front Profile (drag to reorder)</div>
            <canvas ref={crossSectionRef} className="rd-canvas"
              onMouseDown={handleProfileMouseDown('front')}
              onMouseMove={handleProfileMouseMove('front')}
              onMouseUp={handleProfileMouseUp('front')}
              onMouseLeave={handleProfileMouseLeave('front')}
              style={{ cursor: 'grab' }} />
          </div>
          <div className="rd-canvas-wrapper rd-view-side">
            <div className="rd-canvas-title">Side Profile (drag to reorder)</div>
            <canvas ref={sideCrossSectionRef} className="rd-canvas"
              onMouseDown={handleProfileMouseDown('side')}
              onMouseMove={handleProfileMouseMove('side')}
              onMouseUp={handleProfileMouseUp('side')}
              onMouseLeave={handleProfileMouseLeave('side')}
              style={{ cursor: 'grab' }} />
          </div>
        </div>
      </div>

      {/* Layer Stack — full width */}
      <div className="rd-layer-stack-panel">
          <div className="rd-section-label-row">
            <div className="rd-section-label">Layer Stack</div>
            {layers.length > 1 && (
              <button className="rd-btn-sm rd-btn-recalc" onClick={recalcDimensions} title="Recalculate all inner layer dimensions using chamfer rules from the outermost layer">
                ⟲ Recalc dims
              </button>
            )}
          </div>
          {layers.length === 0 ? (
            <div className="rd-empty-stack">Draw on canvas or enter dimensions to add layers</div>
          ) : (
            <>
            <div className="rd-layer-list">
              <div className="rd-layer-list-header">Layup sequence (top = last applied, bottom = first on mould)</div>
              {[...layers].reverse().map((layer, ri) => {
                const i = layers.length - 1 - ri;
                const mat = MATERIALS[layer.materialKey];
                const fw = fiberWeightG(layer.materialKey, layer.areaM2);
                // Zone labels when core exists
                // layers[0]=biggest. Before core (bigger)=outer, after core (smaller)=inner
                // But physically: before core = above core = outer skin,
                //                 after core = below core = inner skin
                // User wants: i < coreIdx → inner (below core), i > coreIdx → outer (above core)
                const coreIdx = layers.findIndex(l => l.isCore);
                const isOuter = coreIdx !== -1 && i > coreIdx;
                const isInner = coreIdx !== -1 && i < coreIdx;
                const isCoreLayer = layer.isCore;
                // Show zone divider before first outer and first inner in reversed list
                const prevOrigIdx = ri > 0 ? layers.length - ri : -1;
                const showOuterLabel = isOuter && (ri === 0 || prevOrigIdx <= coreIdx);
                const showCoreLabel = isCoreLayer;
                const showInnerLabel = isInner && (prevOrigIdx === coreIdx);
                return (
                  <React.Fragment key={layer.id}>
                    {showOuterLabel && (
                      <div className="rd-zone-label rd-zone-outer">Outer Layers (above core)</div>
                    )}
                    {showCoreLabel && (
                      <div className="rd-zone-label rd-zone-core">Core Material</div>
                    )}
                    {showInnerLabel && (
                      <div className="rd-zone-label rd-zone-inner">Inner Layers (below core)</div>
                    )}
                  <div className={`rd-layer-row ${isInner ? 'rd-layer-inner' : ''} ${isOuter ? 'rd-layer-outer' : ''} ${isCoreLayer ? 'rd-layer-core' : ''} ${i === selectedLayerIndex ? 'rd-layer-selected' : ''}`}
                    onClick={() => setSelectedLayerIndex(i === selectedLayerIndex ? -1 : i)}>
                    <span className="rd-layer-num">{ri + 1}</span>
                    <select className="rd-select rd-select-sm" value={layer.materialKey}
                      onChange={e => changeLayerMaterial(i, e.target.value)}>
                      {Object.entries(MATERIALS).map(([key, m]) => (
                        <option key={key} value={key}>{m.label}</option>
                      ))}
                    </select>
                    {mat.fiberAngle && (
                      <span className="rd-fiber-badge" style={{ background: mat.color }}>
                        {mat.fiberAngle}
                      </span>
                    )}
                    {!layer.isCore && (
                      <select className="rd-select rd-select-orientation" value={layer.orientation || 0}
                        onChange={e => { e.stopPropagation(); updateLayerOrientation(i, e.target.value); }}
                        onClick={e => e.stopPropagation()}
                        title="Ply orientation relative to blade span">
                        <option value={0}>0°</option>
                        <option value={45}>45°</option>
                        <option value={90}>90°</option>
                        <option value={-45}>-45°</option>
                      </select>
                    )}
                    <span className="rd-layer-dims">
                      <DimInput
                        className="rd-input-sm rd-dim-input"
                        value={layer.heightMm} min={10} step={10}
                        onCommit={v => updateLayerDimension(i, 'heightMm', v)}
                        title="Height (mm)"
                      />
                      <span className="rd-dims-x">x</span>
                      <DimInput
                        className="rd-input-sm rd-dim-input"
                        value={layer.widthMm} min={10} step={10}
                        onCommit={v => updateLayerDimension(i, 'widthMm', v)}
                        title="Width (mm)"
                      />
                      <span className="rd-unit">mm</span>
                    </span>
                    <span className="rd-layer-area">{layer.areaM2.toFixed(2)} m²</span>
                    <span className="rd-layer-weight">{fw.toFixed(0)} g</span>
                    <div className="rd-layer-thickness">
                      <input
                        type="number" className="rd-input-sm"
                        value={layer.thicknessMm} min="0" step="0.1"
                        onChange={e => updateLayerThickness(i, e.target.value)}
                        title="Thickness (mm)"
                      />
                      <span className="rd-unit">mm</span>
                    </div>
                    <div className="rd-layer-actions">
                      <button className="rd-btn-sm" onClick={() => moveLayer(i, -1)} disabled={i === 0} title="Move down">&#8595;</button>
                      <button className="rd-btn-sm" onClick={() => moveLayer(i, 1)} disabled={i === layers.length - 1} title="Move up">&#8593;</button>
                      <button className="rd-btn-sm rd-btn-remove" onClick={() => removeLayer(i)} title="Remove">&#10005;</button>
                    </div>
                  </div>
                  </React.Fragment>
                );
              })}

            </div>

          {/* Zone summaries — outside scrollable layer list */}
          {layers.some(l => l.isCore) && (() => {
            const ci = layers.findIndex(l => l.isCore);
            const innerLayers = layers.filter((_, idx) => idx < ci && !layers[idx].isCore);
            const outerLayers = layers.filter((_, idx) => idx > ci && !layers[idx].isCore);
            const coreLyr = layers[ci];
            const sumThick = (arr) => arr.reduce((s, l) => s + l.thicknessMm, 0);
            const sumWeight = (arr) => arr.reduce((s, l) => s + fiberWeightG(l.materialKey, l.areaM2), 0);
            const sumArea = (arr) => arr.length > 0 ? arr[0].areaM2 : 0;
            return (
              <div className="rd-zone-summary">
                <div className="rd-zone-summary-row rd-zone-summary-outer">
                  <span className="rd-zone-summary-label">Outer</span>
                  <span>{outerLayers.length} layers</span>
                  <span>{sumThick(outerLayers).toFixed(1)} mm</span>
                  <span>{sumWeight(outerLayers).toFixed(0)} g</span>
                  <span>{sumArea(outerLayers).toFixed(2)} m²</span>
                </div>
                <div className="rd-zone-summary-row rd-zone-summary-core">
                  <span className="rd-zone-summary-label">Core</span>
                  <span>1 layer</span>
                  <span>{coreLyr.thicknessMm.toFixed(1)} mm</span>
                  <span>—</span>
                  <span>{coreLyr.areaM2.toFixed(2)} m²</span>
                </div>
                <div className="rd-zone-summary-row rd-zone-summary-inner">
                  <span className="rd-zone-summary-label">Inner</span>
                  <span>{innerLayers.length} layers</span>
                  <span>{sumThick(innerLayers).toFixed(1)} mm</span>
                  <span>{sumWeight(innerLayers).toFixed(0)} g</span>
                  <span>{sumArea(innerLayers).toFixed(2)} m²</span>
                </div>
              </div>
            );
          })()}

          {/* Stack totals — always visible */}
          {layers.length > 0 && (
            <div className="rd-stack-totals">
              <div className="rd-stack-totals-row">
                <span>Total: {layers.length} layers</span>
                <span>{totalThickness.toFixed(1)} mm thick</span>
                <span>{totalFiberWeight.toFixed(0)} g fiber</span>
                <span>{resinEstimate.toFixed(2)} kg resin est.</span>
              </div>
            </div>
          )}
            </>
          )}
      </div>

      {/* Damage Association */}
      {projects.length > 0 && (
        <div className="rd-assoc-row">
          <div className="rd-section-label">Associate with Damage</div>
          <div className="rd-assoc-selects">
            <select className="rd-select" value={assocProjectId}
              onChange={e => { setAssocProjectId(e.target.value); setAssocTurbineId(''); setAssocBladeId(''); setAssocDamageId(''); }}>
              <option value="">-- Project --</option>
              {projects.filter(p => p.status !== 'archived').map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            {assocProject && (
              <select className="rd-select" value={assocTurbineId}
                onChange={e => { setAssocTurbineId(e.target.value); setAssocBladeId(''); setAssocDamageId(''); }}>
                <option value="">-- Turbine --</option>
                {(assocProject.turbines || []).map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            )}
            {assocTurbine && (
              <select className="rd-select" value={assocBladeId}
                onChange={e => { setAssocBladeId(e.target.value); setAssocDamageId(''); }}>
                <option value="">-- Blade --</option>
                {(assocTurbine.blades || []).map(b => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            )}
            {assocBlade && (
              <select className="rd-select" value={assocDamageId}
                onChange={e => setAssocDamageId(e.target.value)}>
                <option value="">-- Damage --</option>
                {(assocBlade.damages || []).map(d => (
                  <option key={d.id} value={d.id}>{d.number} — {d.type}{d.radius ? ` (R${d.radius})` : ''}</option>
                ))}
              </select>
            )}
          </div>
          {assocDamage && (
            <div className="rd-assoc-info">
              Linked: {assocProject.name} / {assocTurbine.name} / {assocBlade.name} / {assocDamage.number} ({assocDamage.type})
            </div>
          )}
        </div>
      )}

      {/* Bottom row */}
      <div className="rd-bottom-row">
        <input type="text" className="rd-input rd-name-input" value={drawingName}
          onChange={e => setDrawingName(e.target.value)} placeholder="Drawing name" />
        <button className="rd-btn rd-btn-primary" onClick={saveDrawing}>Save</button>
        {savedDrawings.length > 0 && (
          <div className="rd-saved-drawings">
            <select className="rd-select rd-load-select" onChange={e => { if (e.target.value) loadDrawing(e.target.value); }} defaultValue="">
              <option value="" disabled>Load...</option>
              {savedDrawings.map(d => {
                const dp = d.damageId ? projects.find(p => p.id === d.projectId) : null;
                const dmgLabel = dp ? ` [${dp.name}]` : '';
                return (
                  <option key={d.id} value={d.id}>{d.name}{dmgLabel} ({new Date(d.date).toLocaleDateString()})</option>
                );
              })}
            </select>
            <button className="rd-btn-sm rd-btn-remove" onClick={() => {
              const sel = document.querySelector('.rd-load-select');
              if (sel && sel.value) deleteSavedDrawing(sel.value);
            }} title="Delete selected drawing">&#10005;</button>
          </div>
        )}
        <button className="rd-btn" onClick={exportPng}>Export PNG</button>
        <button className="rd-btn" onClick={newDrawing}>New Drawing</button>
        <button className="rd-btn" onClick={clearAll} disabled={layers.length === 0}>Clear All</button>
      </div>

      {/* Summary Panel */}
      {layers.length > 0 && (
        <div className="rd-summary">
          <div className="rd-summary-stats">
            <div className="rd-stat">
              <span className="rd-stat-label">Layers</span>
              <span className="rd-stat-value">{layers.length}</span>
            </div>
            <div className="rd-stat">
              <span className="rd-stat-label">Total thickness</span>
              <span className="rd-stat-value">{totalThickness.toFixed(1)} mm</span>
            </div>
            <div className="rd-stat">
              <span className="rd-stat-label">Outermost area</span>
              <span className="rd-stat-value">{outermostArea.toFixed(2)} m²</span>
            </div>
            <div className="rd-stat">
              <span className="rd-stat-label">Innermost area</span>
              <span className="rd-stat-value">{innermostArea.toFixed(2)} m²</span>
            </div>
            <div className="rd-stat">
              <span className="rd-stat-label">Total fiber weight</span>
              <span className="rd-stat-value">{totalFiberWeight.toFixed(0)} g</span>
            </div>
            <div className="rd-stat">
              <span className="rd-stat-label">Resin estimate</span>
              <span className="rd-stat-value">{resinEstimate.toFixed(2)} kg</span>
              <span className="rd-stat-note">{proc.label}: {proc.resinRatio}:1 resin:fiber + {proc.wastePercent}% waste</span>
            </div>
          </div>

          <div className="rd-material-table">
            <div className="rd-section-label">
              Material Order
              <button className="rd-btn-sm rd-btn-copy" onClick={copyMaterialTable}>Copy as text</button>
            </div>
            <table className="rd-table">
              <thead>
                <tr>
                  <th>Material</th>
                  <th>GSM</th>
                  <th>Layers</th>
                  <th>Total area (m²)</th>
                  <th>Fiber weight (g)</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(materialOrder).map(([key, val]) => (
                  <tr key={key}>
                    <td>{MATERIALS[key].label}</td>
                    <td>{MATERIALS[key].gsm}</td>
                    <td>{val.count}</td>
                    <td>{val.totalArea.toFixed(2)}</td>
                    <td>{val.totalFiberG.toFixed(0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export default RepairDrawingPage;
