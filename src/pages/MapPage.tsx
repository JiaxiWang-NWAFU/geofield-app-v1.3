/**
 * 地图页 v1.3
 * 调查类型/样方类型/弹窗/GPS修复/底图修复
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import maplibregl, { Map as MapLibreMap, Marker, Popup, NavigationControl, ScaleControl } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useMapStore, getBasemapConfig } from '../stores/mapStore';
import type { BasemapType } from '../stores/mapStore';
import { useSurveyStore } from '../stores/surveyStore';
import { useQuadratStore } from '../stores/quadratStore';
import * as db from '../services/database';
import { startWatchPosition, stopWatchPosition, getCurrentPosition } from '../services/geolocation';
import type { GeoPosition, QuadratSubType, SurveyType } from '../types';
import {
  DEFAULT_SURVEY_TYPES, SURVEY_TYPE_OPTIONS,
  QUADRAT_SUB_TYPE_LABELS, QUADRAT_SUB_TYPE_COLORS, QUADRAT_DEFAULT_SIZES,
} from '../types';
import { showToast } from '../utils/helpers';

const MapPage: React.FC = () => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<MapLibreMap | null>(null);
  const navigate = useNavigate();

  const {
    mapLoaded, setMapLoaded, basemapType,
    mapCenter, setMapCenter, mapZoom, setMapZoom,
    currentPosition, setCurrentPosition,
    isTracking, setTracking, followMode, setFollowMode,
    pois, syncPOIsFromQuadrats, setBasemapType: setMapBasemapType,
  } = useMapStore();

  const { surveys } = useSurveyStore();
  const { currentSurvey, setCurrentSurvey, quadrats, loadQuadrats } = useQuadratStore();

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [clickCoords, setClickCoords] = useState<[number, number] | null>(null);
  const [newQuadratName, setNewQuadratName] = useState('');
  const [newQuadratSubType, setNewQuadratSubType] = useState<QuadratSubType>('grass');
  const [showSurveySelect, setShowSurveySelect] = useState(false);
  const [showBasemapSwitch, setShowBasemapSwitch] = useState(false);
  const [surveyTypeFilter, setSurveyTypeFilter] = useState<SurveyType>('vegetation');
  const [longPressProgress, setLongPressProgress] = useState(0);
  const [longPressPos, setLongPressPos] = useState<{ x: number; y: number } | null>(null);
  const [showQuadratPopup, setShowQuadratPopup] = useState<{ name: string; type: string; subType?: QuadratSubType; date: string; id: string; x: number; y: number } | null>(null);

  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const longPressCoords = useRef<[number, number] | null>(null);
  const markersRef = useRef<Marker[]>([]);
  const currentSurveyRef = useRef(currentSurvey);
  const poisRef = useRef(pois);

  // Keep refs in sync with current values
  useEffect(() => { currentSurveyRef.current = currentSurvey; }, [currentSurvey]);
  useEffect(() => { poisRef.current = pois; }, [pois]);

   // Initialize map
  useEffect(() => {
    if (!mapContainer.current || map.current) return;
    const config = getBasemapConfig(basemapType);

    const style: maplibregl.StyleSpecification = {
      version: 8,
      sources: { 'basemap': { type: 'raster', tiles: [config.url], tileSize: 256, attribution: config.attribution } },
      layers: [{ id: 'basemap-layer', type: 'raster', source: 'basemap', minzoom: 0, maxzoom: 19 }],
    };
    if (config.overlayUrl) {
      style.sources['overlay'] = { type: 'raster', tiles: [config.overlayUrl], tileSize: 256 };
      style.layers.push({ id: 'overlay-layer', type: 'raster', source: 'overlay', minzoom: 0, maxzoom: 19 });
    }

    const mapInstance = new maplibregl.Map({
      container: mapContainer.current, style, center: mapCenter, zoom: mapZoom, attributionControl: true,
    });

    mapInstance.addControl(new NavigationControl(), 'top-right');
    // BUG-3修复: 比例尺放在左下，样方数量在其上方 (调整位置)
    mapInstance.addControl(new ScaleControl({ maxWidth: 100, unit: 'metric' }), 'bottom-left');

    mapInstance.on('load', () => setMapLoaded(true));
    mapInstance.on('moveend', () => {
      const c = mapInstance.getCenter();
      setMapCenter([c.lng, c.lat]);
      setMapZoom(mapInstance.getZoom());
    });

    // Long press to create quadrat
    let pressStartTime = 0;
    const startLongPress = (lng: number, lat: number, px: number, py: number) => {
      if (!currentSurveyRef.current) return;
      pressStartTime = Date.now();
      longPressCoords.current = [lng, lat];
      setLongPressPos({ x: px, y: py });
      setLongPressProgress(0);
      longPressInterval.current = setInterval(() => {
        setLongPressProgress(Math.min((Date.now() - pressStartTime) / 1500, 1));
      }, 50);
      longPressTimer.current = setTimeout(() => {
        if (longPressCoords.current) {
          setClickCoords(longPressCoords.current);
          setNewQuadratName(`样方 ${poisRef.current.length + 1}`);
          setShowCreateForm(true);
          setLongPressProgress(0);
          setLongPressPos(null);
        }
      }, 1500);
    };

    mapInstance.on('mousedown', (e) => startLongPress(e.lngLat.lng, e.lngLat.lat, e.point.x, e.point.y));
    mapInstance.on('mouseup', clearLongPress);
    mapInstance.on('mouseout', clearLongPress);
    mapInstance.on('touchstart', (e) => {
      if (e.originalEvent.touches.length !== 1) return;
      const t = e.originalEvent.touches[0];
      const ll = mapInstance.unproject([t.clientX, t.clientY]);
      const pt = mapInstance.project(ll);
      startLongPress(ll.lng, ll.lat, pt.x, pt.y);
    });
    mapInstance.on('touchend', clearLongPress);
    mapInstance.on('touchcancel', clearLongPress);

    // Click on existing POI to show popup
    mapInstance.on('click', (e) => {
      // Check if clicked near any POI
      for (const marker of markersRef.current) {
        const mEl = marker.getElement();
        const mRect = mEl.getBoundingClientRect();
        if (e.point.x >= mRect.left && e.point.x <= mRect.right && e.point.y >= mRect.top && e.point.y <= mRect.bottom) {
          const poiData = (mEl as any)._poiData;
          if (poiData) {
            setShowQuadratPopup({
              name: poiData.name, type: poiData.type, subType: poiData.quadrat_sub_type,
              date: poiData.date || '', id: poiData.id, x: e.point.x, y: e.point.y,
            });
            return;
          }
        }
      }
    });

    map.current = mapInstance;
            return () => { clearLongPress(); markersRef.current.forEach(m => m.remove()); mapInstance.remove(); map.current = null; };
  }, []);

  const clearLongPress = () => {
    if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null; }
    if (longPressInterval.current) { clearInterval(longPressInterval.current); longPressInterval.current = null; }
    setLongPressProgress(0); setLongPressPos(null);
  };

  // Sync POIs as markers
  useEffect(() => {
    if (!map.current || !mapLoaded) return;
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];

    pois.forEach((poi) => {
      const el = document.createElement('div');
      el.className = 'poi-marker cursor-pointer';
      const subType = poi.quadrat_sub_type;
      const colorClass = subType ? QUADRAT_SUB_TYPE_COLORS[subType] : 'bg-primary-600 text-white';
      el.innerHTML = `<div class="w-8 h-8 ${subType ? '' : 'bg-primary-600 border-2 border-white'} rounded-full shadow-lg flex items-center justify-center hover:scale-110 transition-transform ${colorClass}">
        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/></svg>
      </div>`;
      (el as any)._poiData = { id: poi.id, name: poi.name, type: poi.type, quadrat_sub_type: poi.quadrat_sub_type };

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([poi.longitude, poi.latitude])
        .addTo(map.current!);
      markersRef.current.push(marker);
    });
  }, [pois, mapLoaded]);

  // Dynamic basemap update
  useEffect(() => {
    if (!map.current || !mapLoaded) return;
    const config = getBasemapConfig(basemapType);
    const src = map.current.getSource('basemap') as maplibregl.RasterTileSource;
    if (src) { src.setTiles([config.url]); }
    const overlaySrc = map.current.getSource('overlay') as maplibregl.RasterTileSource;
    if (config.overlayUrl) {
      if (overlaySrc) { overlaySrc.setTiles([config.overlayUrl]); }
      else {
        map.current.addSource('overlay', { type: 'raster', tiles: [config.overlayUrl], tileSize: 256 });
        map.current.addLayer({ id: 'overlay-layer', type: 'raster', source: 'overlay', minzoom: 0, maxzoom: 19 });
      }
    } else if (overlaySrc) {
      try { map.current.removeLayer('overlay-layer'); map.current.removeSource('overlay'); } catch {}
    }
  }, [basemapType, mapLoaded]);

  // Load surveys
  useEffect(() => { useSurveyStore.getState().loadSurveys(); }, []);

  // Sync POIs when quadrats change
  useEffect(() => { if (currentSurvey) { loadQuadrats(); } }, [currentSurvey]);
  useEffect(() => { if (currentSurvey) { syncPOIsFromQuadrats(quadrats, currentSurvey.id); } }, [quadrats, currentSurvey]);

  // GPS tracking
  const toggleTracking = useCallback(async () => {
    if (isTracking) {
      if (useMapStore.getState().watchId) await stopWatchPosition(useMapStore.getState().watchId!);
      setTracking(false);
      return;
    }
    const pos = await getCurrentPosition();
    if (pos) {
      setCurrentPosition(pos);
      map.current?.flyTo({ center: [pos.longitude, pos.latitude], zoom: 15 });
    }
    const wid = startWatchPosition(
      (p) => { setCurrentPosition(p); if (followMode) map.current?.setCenter([p.longitude, p.latitude]); },
      (err) => console.warn('[GPS]', err),
    );
    if (wid) setTracking(true, wid);
  }, [isTracking, followMode]);

  const markAtCurrentPosition = async () => {
    if (!currentSurvey) { showToast('请先选择调查项目'); return; }
    const pos = await getCurrentPosition();
    if (!pos) { showToast('无法获取当前位置'); return; }
    setClickCoords([pos.longitude, pos.latitude]);
    setNewQuadratName(`样方 ${pois.length + 1}`);
    setShowCreateForm(true);
  };

  const handleCreateQuadrat = async () => {
    if (!currentSurvey || !clickCoords) return;
    const subType = surveyTypeFilter === 'vegetation' ? newQuadratSubType : undefined;
    const quadrat = await db.createQuadrat(currentSurvey.id, {
      name: newQuadratName,
      type: surveyTypeFilter,
      quadrat_sub_type: subType,
      latitude: clickCoords[1],
      longitude: clickCoords[0],
      survey_date: new Date().toISOString().split('T')[0],
      quadrat_size: subType ? QUADRAT_DEFAULT_SIZES[subType] : undefined,
    });
    if (quadrat) {
      showToast(`样方「${newQuadratName}」已创建`);
      await loadQuadrats();
    }
    setShowCreateForm(false); setClickCoords(null);
  };

  const handleCreateSurvey = async () => {
    const name = window.prompt('请输入调查项目名称：');
    if (name?.trim()) {
      const { createSurvey } = useSurveyStore.getState();
      const survey = await createSurvey(name.trim(), undefined, surveyTypeFilter);
      if (survey) { setCurrentSurvey(survey); showToast(`项目「${name.trim()}」已创建`); }
    }
  };

  const switchBasemap = (type: BasemapType) => {
    setMapBasemapType(type);
    setShowBasemapSwitch(false);
  };

  return (
    <div className="relative w-full h-full">
      <div ref={mapContainer} className="w-full h-full" />

      {/* Long press feedback */}
      {longPressPos && longPressProgress > 0 && (
        <div className="absolute pointer-events-none z-20" style={{ left: longPressPos.x - 20, top: longPressPos.y - 20 }}>
          <div className="w-10 h-10 rounded-full border-3 border-primary-500 flex items-center justify-center">
            <svg className="w-10 h-10 absolute" viewBox="0 0 36 36">
              <circle cx="18" cy="18" r="16" fill="none" stroke="#16a34a" strokeWidth="2"
                strokeDasharray={`${longPressProgress * 100.5} 100.5`} strokeLinecap="round" transform="rotate(-90 18 18)" />
            </svg>
            <div className="w-3 h-3 bg-primary-500 rounded-full"></div>
          </div>
        </div>
      )}

      {/* Top controls */}
      <div className="absolute top-3 left-3 right-14 z-10 flex flex-col gap-2">
        <div className="bg-white rounded-lg shadow-md px-3 py-2">
          <button onClick={() => setShowSurveySelect(true)} className="w-full flex items-center justify-between text-sm">
            <span className="text-gray-500 text-xs">当前项目：</span>
            <span className="font-medium text-primary-700 truncate max-w-[60%]">{currentSurvey?.name || '请选择'}</span>
            <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
          </button>
        </div>
        <div className="flex gap-2">
          <select value={surveyTypeFilter} onChange={(e) => setSurveyTypeFilter(e.target.value as SurveyType)}
            className="bg-white rounded-lg shadow-md px-3 py-1.5 text-xs text-gray-700 flex-1 outline-none">
            {DEFAULT_SURVEY_TYPES.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <button onClick={() => setShowBasemapSwitch(!showBasemapSwitch)}
            className="bg-white rounded-lg shadow-md px-3 py-1.5 text-xs text-gray-700 flex items-center gap-1">
            🗺️ 底图
          </button>
        </div>

        {showBasemapSwitch && (
          <div className="bg-white rounded-lg shadow-md p-3">
            <div className="grid grid-cols-2 gap-2">
              {[
                { type: 'tianditu_satellite' as BasemapType, label: '🛰️ 卫星影像' },
                { type: 'tianditu_terrain' as BasemapType, label: '⛰️ 地形晕渲' },
                { type: 'tianditu_vector' as BasemapType, label: '📋 矢量地图' },
                { type: 'osm' as BasemapType, label: '🌐 OSM地图' },
              ].map(b => (
                <button key={b.type} onClick={() => switchBasemap(b.type)}
                  className={`p-2 rounded-lg border text-xs text-center ${basemapType === b.type ? 'border-primary-500 bg-primary-50' : 'border-gray-200'}`}>
                  {b.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Right GPS buttons */}
      <div className="absolute bottom-24 right-4 z-10 flex flex-col gap-2">
        <button onClick={toggleTracking}
          className={`w-11 h-11 rounded-full shadow-lg flex items-center justify-center ${isTracking ? 'bg-blue-500 text-white' : 'bg-white text-gray-700'}`}>
          📍
        </button>
        <button onClick={() => setFollowMode(!followMode)}
          className={`w-11 h-11 rounded-full shadow-lg flex items-center justify-center ${followMode ? 'bg-green-500 text-white' : 'bg-white text-gray-700'}`}>
          🧭
        </button>
        <button onClick={markAtCurrentPosition}
          className="w-11 h-11 rounded-full shadow-lg bg-white text-gray-700 flex items-center justify-center">
          📌
        </button>
      </div>

      {/* Current position info - above scale */}
      {currentPosition && (
        <div className="absolute bottom-16 left-3 z-10 bg-white/90 backdrop-blur rounded-lg shadow px-3 py-1.5 text-xs text-gray-600">
          <div>📍 {currentPosition.latitude.toFixed(5)}, {currentPosition.longitude.toFixed(5)}</div>
          {currentPosition.altitude && <div>🏔️ 海拔 {currentPosition.altitude.toFixed(1)}m</div>}
        </div>
      )}

      {/* BUG-3修复: 样方数量在比例尺上方 */}
      <div className="absolute bottom-6 left-3 z-10 bg-white/90 backdrop-blur rounded-lg shadow px-3 py-1 text-xs text-gray-600">
        样方：<span className="font-bold text-primary-700">{pois.length}</span> 个
      </div>

      {/* Quadrat popup on click */}
      {showQuadratPopup && (
        <div className="fixed inset-0 z-50" onClick={() => setShowQuadratPopup(null)}>
          <div className="absolute bg-white rounded-xl shadow-xl p-4 max-w-xs" style={{ left: Math.min(showQuadratPopup.x, window.innerWidth - 250), top: showQuadratPopup.y - 10 }}
            onClick={(e) => e.stopPropagation()}>
            <div className="font-bold text-sm text-gray-800">{showQuadratPopup.name}</div>
            <div className="text-xs text-gray-500 mt-1">
              {showQuadratPopup.subType && <span className={`inline-block px-1.5 py-0.5 rounded text-xs mr-1 ${QUADRAT_SUB_TYPE_COLORS[showQuadratPopup.subType]}`}>{QUADRAT_SUB_TYPE_LABELS[showQuadratPopup.subType]}</span>}
              {showQuadratPopup.date}
            </div>
            <button onClick={() => { navigate(`/quadrat/${showQuadratPopup.id}`); setShowQuadratPopup(null); }}
              className="mt-2 w-full py-1.5 bg-primary-600 text-white rounded-lg text-xs">查看详情</button>
          </div>
        </div>
      )}

      {/* Create quadrat form */}
      {showCreateForm && (
        <div className="absolute inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-5">
            <h3 className="text-lg font-bold text-gray-800 mb-4">创建新样方</h3>
            <div className="mb-3">
              <label className="block text-sm text-gray-600 mb-1">样方名称</label>
              <input type="text" value={newQuadratName} onChange={(e) => setNewQuadratName(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 outline-none" />
            </div>
            {surveyTypeFilter === 'vegetation' && (
              <div className="mb-3">
                <label className="block text-sm text-gray-600 mb-1">植被类型</label>
                <div className="grid grid-cols-2 gap-2">
                  {(['grass', 'shrub', 'arbor', 'farmland'] as QuadratSubType[]).map(st => (
                    <button key={st} onClick={() => setNewQuadratSubType(st)}
                      className={`p-2 rounded-lg border text-xs ${newQuadratSubType === st ? 'border-primary-500 bg-primary-50' : 'border-gray-200'}`}>
                      {QUADRAT_SUB_TYPE_LABELS[st]}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {clickCoords && (
              <div className="mb-4 p-2 bg-gray-50 rounded-lg text-xs text-gray-500">
                📍 {clickCoords[1].toFixed(6)}, {clickCoords[0].toFixed(6)}
              </div>
            )}
            <div className="flex gap-3">
              <button onClick={() => setShowCreateForm(false)} className="flex-1 py-2 border border-gray-300 rounded-lg text-gray-600 text-sm">取消</button>
              <button onClick={handleCreateQuadrat} className="flex-1 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium">创建</button>
            </div>
          </div>
        </div>
      )}

      {/* Survey selection */}
      {showSurveySelect && (
        <div className="absolute inset-0 z-50 bg-black/50 flex items-end justify-center">
          <div className="bg-white rounded-t-xl shadow-xl w-full max-w-lg max-h-[70vh] overflow-auto">
            <div className="sticky top-0 bg-white border-b px-4 py-3 flex items-center justify-between">
              <h3 className="text-base font-bold">选择调查项目</h3>
              <button onClick={() => setShowSurveySelect(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <div className="p-3">
              <button onClick={() => { handleCreateSurvey(); setShowSurveySelect(false); }}
                className="w-full p-3 mb-2 bg-primary-50 rounded-lg text-primary-700 text-sm font-medium flex items-center gap-2">
                ＋ 新建调查项目
              </button>
              {surveys.length === 0 ? (
                <p className="text-center text-gray-400 py-8 text-sm">暂无调查项目，请新建</p>
              ) : surveys.map((survey) => (
                <button key={survey.id} onClick={() => { setCurrentSurvey(survey); setShowSurveySelect(false); }}
                  className={`w-full text-left px-4 py-3 rounded-lg mb-2 ${currentSurvey?.id === survey.id ? 'bg-primary-50 border border-primary-200' : 'bg-gray-50 hover:bg-gray-100'}`}>
                  <div className="font-medium text-sm">{survey.name}</div>
                  <div className="text-xs text-gray-400 mt-1">{SURVEY_TYPE_OPTIONS[(survey.survey_type as SurveyType) || 'vegetation'] || survey.survey_type}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MapPage;
