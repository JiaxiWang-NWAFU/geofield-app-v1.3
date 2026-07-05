/**
 * 调查页 v1.3
 * 重构为植物列表 + 导航到 PlantDetailPage
 */

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuadratStore } from '../stores/quadratStore';
import type { PlantRecordFormData } from '../types';
import { showToast, confirmDialog } from '../utils/helpers';

const InvestigationPage: React.FC = () => {
  const navigate = useNavigate();
  const { currentSurvey, currentQuadrat, plantRecords, loadPlantRecords, createPlantRecord, deletePlantRecord } = useQuadratStore();
  const [showAddForm, setShowAddForm] = useState(false);
  const [newSpecies, setNewSpecies] = useState('');

  useEffect(() => { if (currentQuadrat) loadPlantRecords(); }, [currentQuadrat]);

  const handleAddPlant = async () => {
    if (!currentQuadrat) { showToast('请先选择样方'); return; }
    if (!newSpecies.trim()) { showToast('请输入物种名称'); return; }
    const data: PlantRecordFormData = { species_name: newSpecies.trim(), count: 1 };
    const record = await createPlantRecord(data);
    if (record) {
      showToast(`已添加：${newSpecies.trim()}`);
      setNewSpecies('');
      setShowAddForm(false);
      // Navigate to plant detail
      navigate(`/plant-detail/${currentQuadrat.id}/${record.id}`);
    }
  };

  if (!currentQuadrat) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-gray-400 p-6">
        <div className="text-5xl mb-4">🌿</div>
        <p className="text-sm text-center">请先在样方页面选择一个样方</p>
        <button onClick={() => navigate('/quadrat')} className="mt-4 px-6 py-2 bg-primary-600 text-white rounded-lg text-sm">前往样方</button>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-gray-50">
      <div className="bg-white border-b px-4 py-3 flex-shrink-0">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h2 className="font-bold text-sm text-gray-800">🌿 {currentQuadrat.name} 调查</h2>
            <p className="text-xs text-gray-500">{plantRecords.length} 个物种</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4">
        {plantRecords.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <div className="text-4xl mb-3">🌱</div>
            <p className="text-sm">暂无植物记录</p>
            <p className="text-xs mt-1">点击底部按钮添加物种</p>
          </div>
        ) : (
          <div className="space-y-2">
            {plantRecords.map(plant => (
              <button key={plant.id} onClick={() => navigate(`/plant-detail/${currentQuadrat.id}/${plant.id}`)}
                className="w-full bg-white rounded-xl shadow-sm p-4 text-left hover:bg-gray-50">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="font-bold text-sm text-gray-800">{plant.species_name}</div>
                    {plant.latin_name && <div className="text-xs text-gray-400 italic">{plant.latin_name}</div>}
                  </div>
                  <div className="text-right text-xs text-gray-500">
                    <div>{plant.count} 株</div>
                    {plant.cover_percent != null && <div className="text-green-600 font-medium">{plant.cover_percent}%</div>}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Bottom add bar */}
      <div className="flex-shrink-0 bg-white border-t p-3 safe-area-bottom">
        {showAddForm ? (
          <div className="space-y-2">
            <div className="flex gap-2">
              <input type="text" value={newSpecies} onChange={(e) => setNewSpecies(e.target.value)}
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none" placeholder="物种名称" autoFocus />
              <button onClick={handleAddPlant} className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm">添加</button>
            </div>
            <button onClick={() => { setShowAddForm(false); setNewSpecies(''); }}
              className="w-full py-1.5 border border-gray-300 rounded-lg text-gray-600 text-xs">取消</button>
          </div>
        ) : (
          <button onClick={() => setShowAddForm(true)}
            className="w-full py-2.5 bg-primary-600 text-white rounded-lg text-sm font-medium flex items-center justify-center gap-1">
            ＋ 添加物种
          </button>
        )}
      </div>
    </div>
  );
};

export default InvestigationPage;
