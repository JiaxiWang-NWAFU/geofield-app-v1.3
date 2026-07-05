/**
 * 植物详细信息全屏页 v1.3
 * AI识花 + 盖度计算 + 植物数据库搜索
 */

import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { useQuadratStore } from '../stores/quadratStore';
import type { PlantRecord, PlantRecordFormData, QuadratSubType, PlantDatabaseEntry } from '../types';
import { showToast } from '../utils/helpers';
import { takePhoto, savePhotoToAppDir } from '../services/camera';
import { getPhotoUrl } from '../services/photo';
import { identifyPlant, PlantIdentifyResult } from '../services/baiduAI';
import { calculateGreenCover, getAreaAverageColor, calculateColorCover } from '../services/coverAnalysis';
import { searchPlants } from '../services/plantDatabase';
import * as db from '../services/database';

const PlantDetailPage: React.FC = () => {
  const { quadratId, plantId } = useParams<{ quadratId: string; plantId: string }>();
  const navigate = useNavigate();
  const { currentQuadrat, setCurrentQuadrat, plantRecords, loadPlantRecords, updatePlantRecord } = useQuadratStore();

  const [plant, setPlant] = useState<PlantRecord | null>(null);
  const [form, setForm] = useState<PlantRecordFormData>({ species_name: '', count: 1 });
  const [subType, setSubType] = useState<QuadratSubType | undefined>(undefined);

  // AI states
  const [aiResults, setAiResults] = useState<PlantIdentifyResult[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [coverResult, setCoverResult] = useState<number | null>(null);
  const [coverLoading, setCoverLoading] = useState(false);

  // Plant database search
  const [searchKw, setSearchKw] = useState('');
  const [searchResults, setSearchResults] = useState<PlantDatabaseEntry[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Photos
  const [photos, setPhotos] = useState<{url: string; id: string}[]>([]);
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);

  useEffect(() => {
    if (quadratId) {
      db.getQuadratById(quadratId).then(q => {
        if (q) { setCurrentQuadrat(q); setSubType(q.quadrat_sub_type); }
      });
    }
  }, [quadratId]);

  useEffect(() => {
    if (plantId) {
      db.getPlantRecordById(plantId).then(p => {
        if (p) {
          setPlant(p);
          setForm({
            species_name: p.species_name, latin_name: p.latin_name || '', family: p.family || '',
            genus: p.genus || '', count: p.count, max_height: p.max_height, avg_height: p.avg_height,
            cover_percent: p.cover_percent, dbh: p.dbh, tree_height: p.tree_height,
            shrub_height: p.shrub_height, individual_cover: p.individual_cover,
            crop_variety: p.crop_variety || '', row_spacing: p.row_spacing, plant_spacing: p.plant_spacing,
            notes: p.notes,
          });
        }
      });
      db.getPhotosByPlantRecordId(plantId).then(ps => setPhotos(ps.map(p => ({ url: getPhotoUrl(p.file_path), id: p.id }))));
    }
  }, [plantId]);

  const handleSave = async () => {
    if (!plantId) return;
    await updatePlantRecord(plantId, form);
    showToast('已保存');
  };

  const handleTakePhoto = async () => {
    if (!currentQuadrat) return;
    const result = await takePhoto('species');
    if (!result) return;
    let filePath = result.filePath;
    if (Capacitor.isNativePlatform() && result.filePath.startsWith('data:')) {
      const base64 = result.filePath.split(',')[1];
      filePath = await savePhotoToAppDir(base64, currentQuadrat.survey_id, currentQuadrat.id, `plant_${Date.now()}.jpg`);
    }
    const newPhoto = await db.createPhoto({ quadrat_id: currentQuadrat.id, plant_record_id: plantId!, file_path: filePath, photo_type: 'species', name: `照片_${photos.length + 1}` });
    setPhotos(prev => [...prev, { url: getPhotoUrl(filePath), id: newPhoto.id }]);
    showToast('照片已保存');
    // AI identify if photo taken
    if (result.filePath.startsWith('data:') || result.filePath.startsWith('blob:')) {
      handleAIIdentify(result.filePath);
    }
  };

  const handleAIIdentify = async (imageSrc?: string) => {
    setAiLoading(true);
    try {
      const src = imageSrc || photos[photos.length - 1]?.url;
      if (!src) { showToast('请先拍照'); setAiLoading(false); return; }
      const results = await identifyPlant(src);
      setAiResults(results.slice(0, 3));
    } catch (e) {
      showToast('AI识别失败');
    }
    setAiLoading(false);
  };

  const handleAISelect = (name: string) => {
    setForm({ ...form, species_name: name });
    setAiResults([]);
    showToast(`已选用：${name}`);
  };

  const handleAutoCover = async () => {
    setCoverLoading(true);
    try {
      if (photos.length === 0) { showToast('请先拍照'); setCoverLoading(false); return; }
      let totalCover = 0;
      const photoCount = photos.length;
      for (const photo of photos) {
        const result = await calculateGreenCover(photo.url);
        totalCover += result.coverPercent;
      }
      const avgCover = totalCover / photoCount;
      setCoverResult(avgCover);
      setForm({ ...form, cover_percent: avgCover });
      if (photoCount > 1) {
        showToast(`植被盖度: ${avgCover.toFixed(1)}% (${photoCount}张照片平均)`);
      } else {
        showToast(`植被盖度: ${avgCover.toFixed(1)}%`);
      }
    } catch { showToast('盖度计算失败'); }
    setCoverLoading(false);
  };

  const handleSearchPlant = () => {
    if (!searchKw.trim()) { setSearchResults([]); return; }
    setSearchResults(searchPlants(searchKw));
  };

  const handleSelectPlant = (entry: PlantDatabaseEntry) => {
    setForm({ ...form, species_name: entry.name, latin_name: entry.latin_name, family: entry.family, genus: entry.genus });
    setSearchResults([]);
    setSearchKw('');
    setShowSuggestions(false);
    showToast(`已填入：${entry.name}`);
  };

  const handleCountIncrement = () => { setForm({ ...form, count: (form.count || 0) + 1 }); };

  if (!plant) {
    return <div className="h-full flex items-center justify-center text-gray-400">加载中...</div>;
  }

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-4 py-3 flex items-center justify-between flex-shrink-0">
        <button onClick={() => navigate(-1)} className="text-primary-600 text-sm">← 返回</button>
        <h2 className="font-bold text-sm">{form.species_name || '植物详情'}</h2>
        <button onClick={handleSave} className="text-primary-600 text-sm font-medium">保存</button>
      </div>

      <div className="flex-1 overflow-auto p-4 space-y-4">
        {/* Basic info */}
        <div className="bg-white rounded-lg shadow-sm p-4">
          <h3 className="text-sm font-bold text-gray-700 mb-3">基本信息</h3>
          <div className="space-y-3">
            <div className="relative">
              <div className="flex gap-2">
                <input type="text" value={form.species_name}
                  onChange={(e) => {
                    const val = e.target.value;
                    setForm({ ...form, species_name: val });
                    if (val.trim().length > 0) {
                      const results = searchPlants(val);
                      setSearchResults(results.slice(0, 8));
                      setShowSuggestions(results.length > 0);
                    } else {
                      setSearchResults([]);
                      setShowSuggestions(false);
                    }
                  }}
                  onFocus={() => {
                    if (form.species_name.trim() && searchResults.length > 0) {
                      setShowSuggestions(true);
                    }
                  }}
                  onBlur={() => {
                    setTimeout(() => setShowSuggestions(false), 200);
                  }}
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none" placeholder="种名（输入可联想）" />
                <button onClick={() => handleAIIdentify()} disabled={aiLoading}
                  className="px-3 py-2 bg-purple-50 text-purple-600 rounded-lg text-xs whitespace-nowrap">{aiLoading ? '...' : '🤖 AI识花'}</button>
              </div>
              {showSuggestions && searchResults.length > 0 && (
                <div className="absolute left-0 right-12 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-60 overflow-auto">
                  {searchResults.map((entry, i) => (
                    <button key={i}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        setForm({ ...form, species_name: entry.name, latin_name: entry.latin_name, family: entry.family, genus: entry.genus });
                        setShowSuggestions(false);
                        setSearchResults([]);
                        showToast(`已填入：${entry.name}`);
                      }}
                      className="w-full text-left px-3 py-2 hover:bg-green-50 border-b border-gray-100 last:border-b-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-800">{entry.name}</span>
                        <span className="text-xs text-gray-400 italic">{entry.latin_name}</span>
                      </div>
                      <div className="text-xs text-gray-400 mt-0.5">{entry.family} · {entry.genus}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <input type="text" value={form.latin_name || ''} onChange={(e) => setForm({ ...form, latin_name: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none italic" placeholder="拉丁学名" />
            <div className="grid grid-cols-2 gap-2">
              <input type="text" value={form.family || ''} onChange={(e) => setForm({ ...form, family: e.target.value })}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none" placeholder="科" />
              <input type="text" value={form.genus || ''} onChange={(e) => setForm({ ...form, genus: e.target.value })}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none" placeholder="属" />
            </div>
            {/* Count with + button */}
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-500 w-12">株数:</label>
              <input type="number" value={form.count} onChange={(e) => setForm({ ...form, count: parseInt(e.target.value) || 0 })}
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none" min="0" />
              <button onClick={handleCountIncrement} className="w-14 h-14 bg-primary-100 text-primary-700 rounded-lg text-2xl font-bold">+</button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-gray-500">高度(cm)</label>
                <input type="number" value={form.avg_height ?? ''} onChange={(e) => setForm({ ...form, avg_height: parseFloat(e.target.value) || undefined })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none" placeholder="cm" />
              </div>
              <div>
                <label className="text-xs text-gray-500">盖度(%)</label>
                <input type="number" value={form.cover_percent ?? ''} onChange={(e) => setForm({ ...form, cover_percent: parseFloat(e.target.value) || undefined })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none" placeholder="%" min="0" max="100" />
              </div>
            </div>

            {/* Sub-type specific fields */}
            {subType === 'arbor' && (
              <div className="grid grid-cols-2 gap-2">
                <div><label className="text-xs text-gray-500">胸径(cm)</label>
                  <input type="number" value={form.dbh ?? ''} onChange={(e) => setForm({ ...form, dbh: parseFloat(e.target.value) || undefined })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none" placeholder="cm" /></div>
                <div><label className="text-xs text-gray-500">树高(m)</label>
                  <input type="number" value={form.tree_height ?? ''} onChange={(e) => setForm({ ...form, tree_height: parseFloat(e.target.value) || undefined })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none" placeholder="m" step="0.1" /></div>
              </div>
            )}
            {subType === 'shrub' && (
              <div className="grid grid-cols-2 gap-2">
                <div><label className="text-xs text-gray-500">株高(cm)</label>
                  <input type="number" value={form.shrub_height ?? ''} onChange={(e) => setForm({ ...form, shrub_height: parseFloat(e.target.value) || undefined })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none" placeholder="cm" /></div>
                <div><label className="text-xs text-gray-500">单株盖度(%)</label>
                  <input type="number" value={form.individual_cover ?? ''} onChange={(e) => setForm({ ...form, individual_cover: parseFloat(e.target.value) || undefined })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none" placeholder="%" min="0" max="100" /></div>
              </div>
            )}
            {subType === 'farmland' && (
              <div className="space-y-2">
                <input type="text" value={form.crop_variety || ''} onChange={(e) => setForm({ ...form, crop_variety: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none" placeholder="品种" />
                <div className="grid grid-cols-2 gap-2">
                  <div><label className="text-xs text-gray-500">行距(cm)</label>
                    <input type="number" value={form.row_spacing ?? ''} onChange={(e) => setForm({ ...form, row_spacing: parseFloat(e.target.value) || undefined })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none" /></div>
                  <div><label className="text-xs text-gray-500">株距(cm)</label>
                    <input type="number" value={form.plant_spacing ?? ''} onChange={(e) => setForm({ ...form, plant_spacing: parseFloat(e.target.value) || undefined })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none" /></div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Photos */}
        <div className="bg-white rounded-lg shadow-sm p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-gray-700">📷 照片</h3>
            <button onClick={handleTakePhoto} className="px-3 py-1 bg-primary-600 text-white text-xs rounded-lg">拍照</button>
          </div>
          {photos.length > 0 ? (
            <div className="grid grid-cols-3 gap-2">
              {photos.map((photo, i) => (
                <div key={photo.id || i}
                  onClick={() => setPreviewIndex(i)}
                  className="aspect-square bg-gray-100 rounded-lg overflow-hidden relative cursor-pointer">
                  <img src={photo.url} alt="" className="w-full h-full object-cover" />
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      db.deletePhoto(photo.id).then(() => {
                        setPhotos(prev => prev.filter((_, idx) => idx !== i));
                        if (previewIndex !== null) {
                          if (previewIndex >= photos.length - 1) {
                            setPreviewIndex(Math.max(0, photos.length - 2));
                          }
                        }
                        showToast('照片已删除');
                      }).catch(() => showToast('删除失败'));
                    }}
                    className="absolute top-1 right-1 w-6 h-6 bg-black bg-opacity-50 text-white rounded-full flex items-center justify-center text-xs z-10"
                  >✕</button>
                </div>
              ))}
            </div>
          ) : <p className="text-center text-gray-400 text-xs py-4">暂无照片</p>}
        </div>

        {/* AI Tools */}
        {photos.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm p-4">
            <h3 className="text-sm font-bold text-gray-700 mb-3">🔬 AI工具</h3>
            <div className="flex gap-2 mb-3">
              <button onClick={() => handleAIIdentify()} disabled={aiLoading}
                className="flex-1 py-2 bg-purple-50 text-purple-600 rounded-lg text-xs">{aiLoading ? '识别中...' : '🤖 AI识花'}</button>
              <button onClick={handleAutoCover} disabled={coverLoading}
                className="flex-1 py-2 bg-amber-50 text-amber-600 rounded-lg text-xs">{coverLoading ? '计算中...' : '📊 盖度计算'}</button>
            </div>
            {aiResults.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs text-gray-500">识别结果 (Top {aiResults.length})：</p>
                {aiResults.map((r, i) => (
                  <div key={i} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                    <span className="text-sm">{r.name} <span className="text-xs text-gray-400">({(r.score * 100).toFixed(0)}%)</span></span>
                    <button onClick={() => handleAISelect(r.name)} className="px-2 py-1 bg-primary-100 text-primary-700 rounded text-xs">选用</button>
                  </div>
                ))}
              </div>
            )}
            {coverResult !== null && (
              <div className="mt-2 p-2 bg-green-50 rounded-lg text-sm text-green-700 text-center">
                植被盖度：<span className="font-bold">{coverResult.toFixed(1)}%</span>
              </div>
            )}
          </div>
        )}

        {/* Notes */}
        <div className="bg-white rounded-lg shadow-sm p-4">
          <h3 className="text-sm font-bold text-gray-700 mb-2">📝 备注</h3>
          <textarea value={form.notes || ''} onChange={(e) => setForm({ ...form, notes: e.target.value })}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none" rows={3} placeholder="备注信息" />
        </div>
      </div>

      {/* Photo Preview Modal */}
      {previewIndex !== null && photos.length > 0 && (
        <div
          className="fixed inset-0 bg-black bg-opacity-90 z-[9999] flex items-center justify-center"
          onClick={() => setPreviewIndex(null)}
        >
          {/* Close button */}
          <button
            onClick={() => setPreviewIndex(null)}
            className="absolute top-4 right-4 w-10 h-10 bg-white bg-opacity-20 text-white rounded-full flex items-center justify-center text-xl z-10"
          >✕</button>

          {/* Photo counter */}
          {photos.length > 1 && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 text-white text-sm bg-black bg-opacity-40 px-3 py-1 rounded-full">
              {previewIndex + 1} / {photos.length}
            </div>
          )}

          {/* Previous button */}
          {photos.length > 1 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setPreviewIndex(prev => prev !== null ? (prev - 1 + photos.length) % photos.length : null);
              }}
              className="absolute left-2 top-1/2 -translate-y-1/2 w-12 h-12 bg-white bg-opacity-20 text-white rounded-full flex items-center justify-center text-2xl z-10"
            >‹</button>
          )}

          {/* Image */}
          <img
            src={photos[previewIndex]?.url}
            alt=""
            className="max-w-[95vw] max-h-[85vh] object-contain"
            onClick={(e) => e.stopPropagation()}
          />

          {/* Next button */}
          {photos.length > 1 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setPreviewIndex(prev => prev !== null ? (prev + 1) % photos.length : null);
              }}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-12 h-12 bg-white bg-opacity-20 text-white rounded-full flex items-center justify-center text-2xl z-10"
            >›</button>
          )}
        </div>
      )}
    </div>
  );
};

export default PlantDetailPage;
