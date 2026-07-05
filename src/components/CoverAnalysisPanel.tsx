/**
 * 盖度分析面板 v1.3
 * 集成在 PlantDetailPage 中使用
 */

import React, { useState, useRef } from 'react';
import { calculateGreenCover, getAreaAverageColor, calculateColorCover } from '../services/coverAnalysis';

interface Props {
  imageUrl: string;
  onCoverCalculated?: (cover: number) => void;
}

const CoverAnalysisPanel: React.FC<Props> = ({ imageUrl, onCoverCalculated }) => {
  const [result, setResult] = useState<{ coverPercent: number; mode: string } | null>(null);
  const [loading, setLoading] = useState(false);

  const handleAutoCalc = async () => {
    setLoading(true);
    try {
      const r = await calculateGreenCover(imageUrl);
      setResult({ coverPercent: r.coverPercent, mode: '自动绿色检测' });
      onCoverCalculated?.(r.coverPercent);
    } catch { /* ignore */ }
    setLoading(false);
  };

  return (
    <div>
      <div className="flex gap-2">
        <button onClick={handleAutoCalc} disabled={loading}
          className="flex-1 py-2 bg-green-50 text-green-600 rounded-lg text-xs">
          {loading ? '计算中...' : '🌿 自动计算植被盖度'}
        </button>
      </div>
      {result && (
        <div className="mt-2 p-2 bg-green-50 rounded text-center text-sm text-green-700">
          {result.mode}：<span className="font-bold">{result.coverPercent.toFixed(1)}%</span>
        </div>
      )}
    </div>
  );
};

export default CoverAnalysisPanel;
