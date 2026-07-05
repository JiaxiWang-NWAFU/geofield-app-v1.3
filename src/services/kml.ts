// KML/KMZ 文件导入服务 v1.3
// BUG-5修复: 使用通配符 mimeTypes 让用户选择所有文件类型

import { Filesystem } from '@capacitor/filesystem';
import { Capacitor } from '@capacitor/core';

export interface KMLPoint {
  name: string;
  description?: string;
  latitude: number;
  longitude: number;
  altitude?: number;
}

export interface KMLParseResult {
  points: KMLPoint[];
  errors: string[];
}

export interface KMLFileResult {
  fileName: string;
  content: string;
  isKMZ: boolean;
}

export async function selectKMLFile(): Promise<KMLFileResult | null> {
  try {
    if (Capacitor.isNativePlatform()) {
      // BUG-5修复: 使用通配符让用户选择所有文件类型
      const result = await Filesystem.pickFiles({
        types: ['*/*'],
        multiple: false,
      });
      if (!result.files || result.files.length === 0) return null;
      const file = result.files[0];
      const isKMZ = file.name.toLowerCase().endsWith('.kmz');
      return { fileName: file.name, content: file.data || '', isKMZ };
    }
    // 浏览器回退
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.kml,.kmz,*/*';
      input.onchange = async (e) => {
        const f = (e.target as HTMLInputElement).files?.[0];
        if (!f) { resolve(null); return; }
        const isKMZ = f.name.toLowerCase().endsWith('.kmz');
        const content = await f.text();
        resolve({ fileName: f.name, content, isKMZ });
      };
      input.oncancel = () => resolve(null);
      input.click();
    });
  } catch (error) {
    console.error('[KML] 选择文件失败:', error);
    return null;
  }
}

export function parseKML(xmlContent: string): KMLParseResult {
  const points: KMLPoint[] = [];
  const errors: string[] = [];

  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlContent, 'text/xml');
    const parseError = doc.querySelector('parsererror');
    if (parseError) { errors.push('XML 解析错误'); return { points, errors }; }

    const placemarks = doc.querySelectorAll('Placemark');
    placemarks.forEach((pm) => {
      try {
        const name = pm.querySelector('name')?.textContent || '';
        const description = pm.querySelector('description')?.textContent || undefined;
        const coordEl = pm.querySelector('Point coordinates');
        if (coordEl && coordEl.textContent) {
          const coords = coordEl.textContent.trim().split(/[\s,]+/);
          if (coords.length >= 2) {
            points.push({
              name,
              description,
              longitude: parseFloat(coords[0]),
              latitude: parseFloat(coords[1]),
              altitude: coords.length >= 3 ? parseFloat(coords[2]) : undefined,
            });
          }
        }
      } catch (e) { errors.push(`解析点位失败: ${(e as Error).message}`); }
    });
  } catch (e) { errors.push(`KML 解析异常: ${(e as Error).message}`); }

  return { points, errors };
}
