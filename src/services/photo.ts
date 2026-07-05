/**
 * 照片服务 v1.3
 * BUG-4修复: 使用 Capacitor.convertFileSrc 转换原生路径
 */

import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import type { PhotoType } from '../types';

/**
 * 转换文件路径为 WebView 可用的 URL
 * 原生平台使用 Capacitor.convertFileSrc，浏览器直接使用
 */
export function getPhotoUrl(filePath: string): string {
  if (!filePath) return '';
  // 已经是 blob/data URL
  if (filePath.startsWith('blob:') || filePath.startsWith('data:')) return filePath;
  // 原生平台: 转换 file:// 为 capacitor 可访问的 URL
  if (Capacitor.isNativePlatform()) {
    if (filePath.startsWith('file://') || filePath.startsWith('/')) {
      return Capacitor.convertFileSrc(filePath);
    }
    // 相对路径: Documents 目录下的文件
    return Capacitor.convertFileSrc(filePath);
  }
  return filePath;
}

/**
 * 生成缩略图
 */
export async function generateThumbnail(base64String: string): Promise<string | null> {
  try {
    const img = new Image();
    img.src = `data:image/jpeg;base64,${base64String}`;
    await new Promise((resolve, reject) => { img.onload = resolve; img.onerror = reject; });
    const canvas = document.createElement('canvas');
    const maxSize = 200;
    const ratio = Math.min(maxSize / img.width, maxSize / img.height);
    canvas.width = img.width * ratio;
    canvas.height = img.height * ratio;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.5);
  } catch (error) {
    console.error('[照片] 生成缩略图失败:', error);
    return null;
  }
}

/**
 * 保存照片到 App 专属目录
 */
export async function savePhotoToAppDir(
  base64Data: string, surveyId: string, quadratId: string, fileName: string,
): Promise<string> {
  if (Capacitor.isNativePlatform()) {
    const path = `photos/${surveyId}/${quadratId}`;
    const result = await Filesystem.writeFile({
      path: `${path}/${fileName}`,
      data: base64Data,
      directory: Directory.External,
      recursive: true,
    });
    return result.uri;
  }
  const byteChars = atob(base64Data);
  const byteArrays = [];
  for (let offset = 0; offset < byteChars.length; offset += 512) {
    const slice = byteChars.slice(offset, offset + 512);
    const byteNumbers = new Array(slice.length);
    for (let i = 0; i < slice.length; i++) byteNumbers[i] = slice.charCodeAt(i);
    byteArrays.push(new Uint8Array(byteNumbers));
  }
  const blob = new Blob(byteArrays, { type: 'image/jpeg' });
  return URL.createObjectURL(blob);
}

/**
 * 加载照片为 Image 对象 (用于盖度分析等)
 */
export async function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('图片加载失败'));
    img.src = src;
  });
}
