/**
 * 样方页 v1.3
 * 差异化表单/新字段/布局/照片修复
 */

import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { useQuadratStore } from '../stores/quadratStore';
import { useSurveyStore } from '../stores/surveyStore';
import type { Quadrat, QuadratFormData, QuadratSubType } from '../types';
import {
  QUADRAT_TYPE_LABELS, QUADRAT_SUB_TYPE_LABELS, QUADRAT_SUB_TYPE_COLORS,
  QUADRAT_DEFAULT_SIZES, WEATHER_OPTIONS,
} from '../types';
import { getTodayString, showToast, confirmDialog, formatDate } from '../utils/helpers';
import { getCurrentPosition } from '../services/geolocation';
import { takePhoto, savePhotoToAppDir } from '../services/camera';
import { getPhotoUrl } from '../services/photo';
import { fetchWeather, formatWeatherString } from '../services/weatherService';
import * as db from '../services/database';

const QuadratPage: React.FC = () => {
  const { quadratId } = useParams<{ quadratId?: string }>();
  const navigate = useNavigate();
  const { currentSurvey, quadrats, currentQuadrat, plantRecords, quadratPhotos,
    setCurrentSurvey, loadQuadrats, setCurrentQuadrat, loadQuadratPhotos, getStats, isLoading } = useQuadratStore();
  const { surveys, loadSurveys } = useSurveyStore();

  const [viewMode, setViewMode] = useState<'list' | 'detail' | 'edit'>('list');
  const [editingQuadrat, setEditingQuadrat] = useState<Quadrat | null>(null);
  const [formData, setFormData] = useState<QuadratFormData>({
    name: '', type: 'vegetation', survey_date: getTodayString(), weather: '晴',
  });
  const [elevCollecting, setElevCollecting] = useState(false);
  const [showPhotoForm, setShowPhotoForm] = useState(false);
  const [viewingPhoto, setViewingPhoto] = useState<string | null>(null);

  useEffect(() => { if (surveys.length === 0) loadSurveys(); }, []);

  useEffect(() => {
    if (quadratId && quadrats.length > 0) {
      const q = quadrats.find(q => q.id === quadratId);
      if (q) handleSelectQuadrat(q);
    }
  }, [quadratId, quadrats]);

  useEffect(() => { if (currentSurvey) loadQuadrats(); }, [currentSurvey?.id]);

  const handleSelectQuadrat = async (quadrat: Quadrat) => {
    await setCurrentQuadrat(quadrat);
    setViewMode('detail');
    // Auto-fetch weather + elevation
    if (quadrat.latitude && quadrat.longitude) {
      const weather = await fetchWeather(quadrat.latitude, quadrat.longitude);
      if (weather) {
        const wStr = formatWeatherString(weather);
        setFormData(prev => ({ ...prev, weather: wStr }));
        await db.updateQuadrat(quadrat.id, { weather: wStr });
      }
    }
  };

  const handleEditQuadrat = (quadrat: Quadrat) => {
    setEditingQuadrat(quadrat);
    setFormData({
      name: quadrat.name, type: quadrat.type, quadrat_sub_type: quadrat.quadrat_sub_type,
      latitude: quadrat.latitude, longitude: quadrat.longitude, elevation: quadrat.elevation,
      slope: quadrat.slope, aspect: quadrat.aspect, survey_date: quadrat.survey_date,
      weather: quadrat.weather, surveyors: quadrat.surveyors, notes: quadrat.notes,
      total_cover: quadrat.total_cover, gravel_cover: quadrat.gravel_cover,
      litter_cover: quadrat.litter_cover, canopy_closure: quadrat.canopy_closure,
      shrub_layer_cover: quadrat.shrub_layer_cover, herb_layer_cover: quadrat.herb_layer_cover,
      quadrat_size: quadrat.quadrat_size,
    });
    setViewMode('edit');
  };

  const handleSaveQuadrat = async () => {
    if (editingQuadrat) {
      await db.updateQuadrat(editingQuadrat.id, formData);
      showToast('样方信息已更新');
      const updated = { ...editingQuadrat, ...formData } as Quadrat;
      await setCurrentQuadrat(updated);
    }
    setViewMode('detail');
  };

  const handleCollectElevation = async () => {
    setElevCollecting(true);
    const pos = await getCurrentPosition();
    if (pos?.altitude !== undefined) {
      setFormData({ ...formData, elevation: Math.round(pos.altitude * 10) / 10 });
      showToast(`海拔: ${pos.altitude.toFixed(1)}m`);
    } else {
      showToast('无法获取 GPS 海拔');
    }
    setElevCollecting(false);
  };

  const handleTakePhoto = async () => {
    if (!currentQuadrat || !currentSurvey) return;
    const result = await takePhoto('quadrat_photo');
    if (!result) return;
    let filePath = result.filePath;
    if (Capacitor.isNativePlatform() && result.filePath.startsWith('data:')) {
      const base64 = result.filePath.split(',')[1];
      filePath = await savePhotoToAppDir(base64, currentSurvey.id, currentQuadrat.id, `sq_${Date.now()}.jpg`);
    }
    await db.createQuadratPhoto(currentQuadrat.id, filePath, `照片_${quadratPhotos.length + 1}`);
    await loadQuadratPhotos();
    showToast('照片已保存');
    setShowPhotoForm(false);
  };

  const stats = currentQuadrat ? getStats() : null;
  const subType = currentQuadrat?.quadrat_sub_type;

  // ========== LIST ==========
  if (viewMode === 'list') {
    if (!currentSurvey) {
      return (
        <div className="h-full flex flex-col items-center justify-center text-gray-400 p-6">
          <div className="text-5xl mb-4">🗺️</div>
          <p className="text-sm">请先在地图页面选择调查项目</p>
          <button onClick={() => navigate('/map')} className="mt-4 px-6 py-2 bg-primary-600 text-white rounded-lg text-sm">前往地图</button>
        </div>
      );
    }
    const unitName = currentSurvey.survey_type === 'vegetation' ? '样方' : '样点';
    return (
      <div className="h-full overflow-auto bg-gray-50 pb-2">
        <div className="p-4">
          <h2 className="text-lg font-bold text-gray-800">{unitName}列表</h2>
          <p className="text-xs text-gray-500">{currentSurvey.name}</p>
          {quadrats.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <div className="text-4xl mb-3">📍</div>
              <p className="text-sm">暂无{unitName}</p>
            </div>
          ) : (
            quadrats.map((q) => (
              <button key={q.id} onClick={() => handleSelectQuadrat(q)}
                className="w-full bg-white rounded-lg shadow-sm p-4 mb-2 text-left hover:bg-gray-50">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm text-gray-800">{q.name}</span>
                  <div className="flex gap-1">
                    {q.quadrat_sub_type && (
                      <span className={`text-xs px-1.5 py-0.5 rounded ${QUADRAT_SUB_TYPE_COLORS[q.quadrat_sub_type]}`}>
                        {QUADRAT_SUB_TYPE_LABELS[q.quadrat_sub_type]}
                      </span>
                    )}
                    <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded">
                      {QUADRAT_TYPE_LABELS[q.type] || q.type}
                    </span>
                  </div>
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {q.survey_date || formatDate(q.created_at)}
                  {q.latitude ? ` · ${q.latitude.toFixed(4)}, ${q.longitude?.toFixed(4)}` : ''}
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    );
  }

  // ========== DETAIL ==========
  if (viewMode === 'detail' && currentQuadrat) {
    const isVegetation = currentQuadrat.type === 'vegetation';
    return (
      <div className="h-full overflow-auto bg-gray-50 pb-2">
        <div className="bg-white border-b px-4 py-3 sticky top-0 z-10">
          <div className="flex items-center justify-between">
            <button onClick={() => { setViewMode('list'); setCurrentQuadrat(null); }} className="text-primary-600 text-sm">← 返回</button>
            <h2 className="font-bold text-sm">{currentQuadrat.name}</h2>
            <button onClick={() => navigate('/investigation')} className="text-primary-600 text-sm">调查 →</button>
          </div>
        </div>
        <div className="p-4 space-y-4">
          {/* Basic info */}
          <div className="bg-white rounded-lg shadow-sm p-4">
            <h3 className="text-sm font-bold text-gray-700 mb-3">📋 基本信息</h3>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div><span className="text-gray-400 text-xs">类型：</span>{QUADRAT_TYPE_LABELS[currentQuadrat.type]}</div>
              {subType && <div><span className="text-gray-400 text-xs">子类型：</span>{QUADRAT_SUB_TYPE_LABELS[subType]}</div>}
              <div><span className="text-gray-400 text-xs">日期：</span>{currentQuadrat.survey_date || '-'}</div>
              <div><span className="text-gray-400 text-xs">天气：</span>{currentQuadrat.weather || '-'}</div>
              {currentQuadrat.latitude && (
                <div className="col-span-2"><span className="text-gray-400 text-xs">坐标：</span>{currentQuadrat.latitude.toFixed(5)}, {currentQuadrat.longitude?.toFixed(5)}</div>
              )}
              <div><span className="text-gray-400 text-xs">海拔：</span>{currentQuadrat.elevation ? `${currentQuadrat.elevation}m` : '-'}</div>
              <div><span className="text-gray-400 text-xs">坡度：</span>{currentQuadrat.slope ? `${currentQuadrat.slope}°` : '-'}</div>
              <div><span className="text-gray-400 text-xs">坡向：</span>{currentQuadrat.aspect !== undefined ? `${currentQuadrat.aspect}°` : '-'}</div>
              <div><span className="text-gray-400 text-xs">尺寸：</span>{currentQuadrat.quadrat_size || '-'}</div>
              <div><span className="text-gray-400 text-xs">调查人：</span>{currentQuadrat.surveyors || '-'}</div>
            </div>
          </div>

          {/* Cover records */}
          {isVegetation && (
            <div className="bg-white rounded-lg shadow-sm p-4">
              <h3 className="text-sm font-bold text-gray-700 mb-3">📊 盖度记录</h3>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-gray-400 text-xs">总盖度：</span>{currentQuadrat.total_cover != null ? `${currentQuadrat.total_cover}%` : '-'}</div>
                <div><span className="text-gray-400 text-xs">砾石盖度：</span>{currentQuadrat.gravel_cover != null ? `${currentQuadrat.gravel_cover}%` : '-'}</div>
                <div><span className="text-gray-400 text-xs">枯落物盖度：</span>{currentQuadrat.litter_cover != null ? `${currentQuadrat.litter_cover}%` : '-'}</div>
                {subType === 'arbor' && (
                  <>
                    <div><span className="text-gray-400 text-xs">郁闭度：</span>{currentQuadrat.canopy_closure != null ? `${currentQuadrat.canopy_closure}%` : '-'}</div>
                    <div><span className="text-gray-400 text-xs">灌木层盖度：</span>{currentQuadrat.shrub_layer_cover != null ? `${currentQuadrat.shrub_layer_cover}%` : '-'}</div>
                    <div><span className="text-gray-400 text-xs">草本层盖度：</span>{currentQuadrat.herb_layer_cover != null ? `${currentQuadrat.herb_layer_cover}%` : '-'}</div>
                  </>
                )}
                {(subType === 'shrub' || subType === 'arbor') && (
                  <div><span className="text-gray-400 text-xs">草本层盖度：</span>{currentQuadrat.herb_layer_cover != null ? `${currentQuadrat.herb_layer_cover}%` : '-'}</div>
                )}
              </div>
            </div>
          )}

          {/* Plant summary */}
          {stats && (
            <div className="bg-white rounded-lg shadow-sm p-4">
              <h3 className="text-sm font-bold text-gray-700 mb-3">🌿 植物统计</h3>
              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="bg-green-50 rounded p-2"><div className="font-bold text-green-700 text-sm">{stats.speciesCount}</div><div className="text-gray-400">物种数</div></div>
                <div className="bg-blue-50 rounded p-2"><div className="font-bold text-blue-700 text-sm">{stats.totalPlants}</div><div className="text-gray-400">总株数</div></div>
                <div className="bg-purple-50 rounded p-2"><div className="font-bold text-purple-700 text-sm">{stats.familyCount}</div><div className="text-gray-400">科数</div></div>
              </div>
            </div>
          )}

          {/* Photos */}
          <div className="bg-white rounded-lg shadow-sm p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-gray-700">📷 样方照片</h3>
              <button onClick={() => setShowPhotoForm(true)} className="px-3 py-1 bg-primary-600 text-white text-xs rounded-lg">拍照</button>
            </div>
            {showPhotoForm && (
              <div className="mb-3 flex gap-2">
                <button onClick={handleTakePhoto} className="flex-1 py-1.5 bg-primary-600 text-white rounded-lg text-xs">拍照并保存</button>
                <button onClick={() => setShowPhotoForm(false)} className="px-3 py-1.5 border border-gray-300 rounded-lg text-xs">取消</button>
              </div>
            )}
            {quadratPhotos.length === 0 ? (
              <p className="text-center text-gray-400 text-xs py-4">暂无照片</p>
            ) : (
                          <div className="grid grid-cols-3 gap-2">
                {quadratPhotos.map((photo) => (
                  <div key={photo.id} className="relative aspect-square bg-gray-100 rounded-lg overflow-hidden">
                    <img src={getPhotoUrl(photo.file_path)} alt={photo.name}
                      className="w-full h-full object-cover cursor-pointer" onClick={() => setViewingPhoto(getPhotoUrl(photo.file_path))} />
                    <button
                      onClick={() => {
                        db.deleteQuadratPhoto(photo.id).then(async () => {
                          await loadQuadratPhotos();
                          showToast('照片已删除');
                        }).catch(() => showToast('删除失败'));
                      }}
                      className="absolute top-1 right-1 w-6 h-6 bg-black bg-opacity-50 text-white rounded-full flex items-center justify-center text-xs z-10"
                    >✕</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button onClick={() => handleEditQuadrat(currentQuadrat)} className="flex-1 py-2.5 bg-primary-600 text-white rounded-lg text-sm">编辑</button>
            <button onClick={() => navigate('/investigation')} className="flex-1 py-2.5 bg-blue-600 text-white rounded-lg text-sm">调查</button>
            <button onClick={async () => {
              if (await confirmDialog('确定删除？')) { await db.deleteQuadrat(currentQuadrat.id); await loadQuadrats(); setViewMode('list'); showToast('已删除'); }
            }} className="py-2.5 px-4 bg-red-100 text-red-600 rounded-lg text-sm">删除</button>
          </div>
        </div>

        {viewingPhoto && (
          <div className="fixed inset-0 z-50 bg-black flex items-center justify-center" onClick={() => setViewingPhoto(null)}>
            <img src={viewingPhoto} alt="原图" className="max-w-full max-h-full object-contain" />
            <button className="absolute top-4 right-4 text-white text-2xl" onClick={() => setViewingPhoto(null)}>✕</button>
          </div>
        )}
      </div>
    );
  }

  // ========== EDIT ==========
  if (viewMode === 'edit' && editingQuadrat) {
    const isVeg = formData.type === 'vegetation';
    return (
      <div className="h-full overflow-auto bg-gray-50 pb-2">
        <div className="bg-white border-b px-4 py-3 flex items-center justify-between sticky top-0 z-10">
          <button onClick={() => setViewMode('detail')} className="text-primary-600 text-sm">取消</button>
          <h2 className="font-bold text-sm">编辑样方</h2>
          <button onClick={handleSaveQuadrat} className="text-primary-600 text-sm font-medium">保存</button>
        </div>
        <div className="p-4 space-y-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1">名称</label>
            <input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">日期</label>
              <input type="date" value={formData.survey_date || ''} onChange={(e) => setFormData({ ...formData, survey_date: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">天气</label>
              <input type="text" value={formData.weather || ''} onChange={(e) => setFormData({ ...formData, weather: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none" placeholder="天气" />
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">调查人员</label>
            <input type="text" value={formData.surveyors || ''} onChange={(e) => setFormData({ ...formData, surveyors: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none" placeholder="多人用逗号分隔" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">海拔(m)</label>
              <div className="flex gap-1">
                <input type="number" value={formData.elevation || ''} onChange={(e) => setFormData({ ...formData, elevation: parseFloat(e.target.value) || undefined })}
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none" />
                <button onClick={handleCollectElevation} disabled={elevCollecting}
                  className="px-2 py-1 bg-blue-50 text-blue-600 rounded-lg text-xs">{elevCollecting ? '...' : 'GPS'}</button>
              </div>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">坡度(°)</label>
              <input type="number" value={formData.slope || ''} onChange={(e) => setFormData({ ...formData, slope: parseFloat(e.target.value) || undefined })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none" />
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">坡向(0-360°)</label>
            <input type="number" value={formData.aspect ?? ''} onChange={(e) => setFormData({ ...formData, aspect: parseFloat(e.target.value) || undefined })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none" placeholder="0-360" min="0" max="360" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">样方尺寸</label>
            <input type="text" value={formData.quadrat_size || ''} onChange={(e) => setFormData({ ...formData, quadrat_size: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none" placeholder='如 "1x1", "5x5"' />
          </div>
          {isVeg && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">总盖度(%)</label>
                <input type="number" value={formData.total_cover ?? ''} onChange={(e) => setFormData({ ...formData, total_cover: parseFloat(e.target.value) || undefined })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none" min="0" max="100" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">砾石盖度(%)</label>
                <input type="number" value={formData.gravel_cover ?? ''} onChange={(e) => setFormData({ ...formData, gravel_cover: parseFloat(e.target.value) || undefined })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none" min="0" max="100" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">枯落物盖度(%)</label>
                <input type="number" value={formData.litter_cover ?? ''} onChange={(e) => setFormData({ ...formData, litter_cover: parseFloat(e.target.value) || undefined })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none" min="0" max="100" />
              </div>
              {formData.quadrat_sub_type === 'arbor' && (
                <>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">郁闭度(%)</label>
                    <input type="number" value={formData.canopy_closure ?? ''} onChange={(e) => setFormData({ ...formData, canopy_closure: parseFloat(e.target.value) || undefined })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none" min="0" max="100" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">灌木层盖度(%)</label>
                    <input type="number" value={formData.shrub_layer_cover ?? ''} onChange={(e) => setFormData({ ...formData, shrub_layer_cover: parseFloat(e.target.value) || undefined })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none" min="0" max="100" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">草本层盖度(%)</label>
                    <input type="number" value={formData.herb_layer_cover ?? ''} onChange={(e) => setFormData({ ...formData, herb_layer_cover: parseFloat(e.target.value) || undefined })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none" min="0" max="100" />
                  </div>
                </>
              )}
              {(formData.quadrat_sub_type === 'shrub' || formData.quadrat_sub_type === 'arbor') && (
                <div>
                  <label className="block text-xs text-gray-500 mb-1">草本层盖度(%)</label>
                  <input type="number" value={formData.herb_layer_cover ?? ''} onChange={(e) => setFormData({ ...formData, herb_layer_cover: parseFloat(e.target.value) || undefined })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none" min="0" max="100" />
                </div>
              )}
            </div>
          )}
          <div>
            <label className="block text-xs text-gray-500 mb-1">备注</label>
            <textarea value={formData.notes || ''} onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none" rows={3} />
          </div>
        </div>
      </div>
    );
  }

  return <div className="h-full flex items-center justify-center text-gray-400 text-sm"><p>加载中...</p></div>;
};

export default QuadratPage;
