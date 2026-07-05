/**
 * 自定义调查类型编辑器 v1.3
 */

import React, { useState } from 'react';
import type { CustomFormField } from '../types';
import * as db from '../services/database';
import { showToast } from '../utils/helpers';

interface Props {
  onClose: () => void;
  onSaved: () => void;
}

const CustomSurveyEditor: React.FC<Props> = ({ onClose, onSaved }) => {
  const [name, setName] = useState('');
  const [unitName, setUnitName] = useState('样点');
  const [fields, setFields] = useState<CustomFormField[]>([]);

  const addField = () => {
    setFields([...fields, { name: '', label: '', type: 'text', required: false }]);
  };

  const updateField = (index: number, partial: Partial<CustomFormField>) => {
    setFields(fields.map((f, i) => i === index ? { ...f, ...partial } : f));
  };

  const removeField = (index: number) => {
    setFields(fields.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (!name.trim()) { showToast('请输入类型名称'); return; }
    await db.createCustomSurveyType(name.trim(), unitName.trim() || '样点', JSON.stringify(fields));
    showToast('自定义调查类型已创建');
    onSaved();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end justify-center">
      <div className="bg-white rounded-t-xl shadow-xl w-full max-w-lg max-h-[80vh] overflow-auto p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-bold">新建自定义调查类型</h3>
          <button onClick={onClose} className="text-gray-400">✕</button>
        </div>
        <div className="space-y-3">
          <div><label className="block text-xs text-gray-500 mb-1">类型名称</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none" placeholder="如：水文调查" /></div>
          <div><label className="block text-xs text-gray-500 mb-1">调查单元名称</label>
            <input type="text" value={unitName} onChange={(e) => setUnitName(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none" placeholder="如：样点、样品" /></div>
          
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs text-gray-500">表单字段</label>
              <button onClick={addField} className="text-primary-600 text-xs">+ 添加字段</button>
            </div>
            {fields.map((f, i) => (
              <div key={i} className="flex gap-1 mb-2 items-center">
                <input type="text" value={f.label} onChange={(e) => updateField(i, { label: e.target.value, name: e.target.value })}
                  className="flex-1 border border-gray-300 rounded px-2 py-1 text-xs outline-none" placeholder="字段名" />
                <select value={f.type} onChange={(e) => updateField(i, { type: e.target.value as any })}
                  className="border border-gray-300 rounded px-2 py-1 text-xs outline-none">
                  <option value="text">文本</option><option value="number">数字</option>
                  <option value="date">日期</option><option value="select">选择</option>
                </select>
                <button onClick={() => removeField(i)} className="text-red-500 text-xs px-1">✕</button>
              </div>
            ))}
          </div>
          <button onClick={handleSave} className="w-full py-2 bg-primary-600 text-white rounded-lg text-sm">保存</button>
        </div>
      </div>
    </div>
  );
};

export default CustomSurveyEditor;
