/**
 * 相机服务
 * 基于 @capacitor/camera
 */

import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import type { PhotoType } from '../types';

export async function takePhoto(photoType: PhotoType = 'general'): Promise<{ filePath: string; blob?: Blob } | null> {
  try {
    const photo = await Camera.getPhoto({
      quality: 85,
      allowEditing: false,
      resultType: CameraResultType.Base64,
      source: CameraSource.Camera,
      saveToGallery: false,
      width: 1920,
      height: 1440,
      correctOrientation: true,
    });

    if (!photo.base64String) {
      console.error('[野外调查助手] 拍照失败：未获取到图像数据');
      return null;
    }

    if (Capacitor.isNativePlatform()) {
      const fileName = `photo_${Date.now()}_${photoType}.jpg`;
      const savedPath = await saveBase64ToFile(photo.base64String, fileName);
      return { filePath: savedPath };
    }

    const blob = base64ToBlob(photo.base64String, 'image/jpeg');
    const objectUrl = URL.createObjectURL(blob);
    return { filePath: objectUrl, blob };
  } catch (error) {
    if (error instanceof Error && error.message.includes('cancel')) {
      return null;
    }
    console.error('[野外调查助手] 拍照失败:', error);
    return fallbackToBrowserInput();
  }
}

export async function pickFromGallery(photoType: PhotoType = 'general'): Promise<{ filePath: string; blob?: Blob } | null> {
  try {
    const photo = await Camera.getPhoto({
      quality: 85,
      allowEditing: false,
      resultType: CameraResultType.Base64,
      source: CameraSource.Photos,
      width: 1920,
      height: 1440,
    });

    if (!photo.base64String) return null;

    if (Capacitor.isNativePlatform()) {
      const fileName = `gallery_${Date.now()}_${photoType}.jpg`;
      const savedPath = await saveBase64ToFile(photo.base64String, fileName);
      return { filePath: savedPath };
    }

    const blob = base64ToBlob(photo.base64String, 'image/jpeg');
    const objectUrl = URL.createObjectURL(blob);
    return { filePath: objectUrl, blob };
  } catch (error) {
    if (error instanceof Error && error.message.includes('cancel')) return null;
    console.error('[野外调查助手] 选择图片失败:', error);
    return null;
  }
}

export async function generateThumbnail(base64String: string): Promise<string | null> {
  try {
    const img = new Image();
    img.src = `data:image/jpeg;base64,${base64String}`;
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
    });

    const canvas = document.createElement('canvas');
    const maxSize = 300;
    const ratio = Math.min(maxSize / img.width, maxSize / img.height);
    canvas.width = img.width * ratio;
    canvas.height = img.height * ratio;

    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    const thumbnailBase64 = canvas.toDataURL('image/jpeg', 0.6).split(',')[1];
    if (Capacitor.isNativePlatform()) {
      return await saveBase64ToFile(thumbnailBase64, `thumb_${Date.now()}.jpg`);
    }
    return `data:image/jpeg;base64,${thumbnailBase64}`;
  } catch (error) {
    console.error('[野外调查助手] 生成缩略图失败:', error);
    return null;
  }
}

async function saveBase64ToFile(base64Data: string, fileName: string): Promise<string> {
  const result = await Filesystem.writeFile({
    path: fileName,
    data: base64Data,
    directory: Directory.Documents,
    recursive: true,
  });
  return result.uri;
}

/**
 * 保存照片到 App 专属目录
 * 路径：/Android/data/com.geofield.app/files/photos/{surveyId}/{quadratId}/
 */
export async function savePhotoToAppDir(
  base64Data: string,
  surveyId: string,
  quadratId: string,
  fileName: string,
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
  // 浏览器环境
  const blob = base64ToBlob(base64Data, 'image/jpeg');
  return URL.createObjectURL(blob);
}

function base64ToBlob(base64: string, mimeType: string): Blob {
  const byteChars = atob(base64);
  const byteArrays = [];
  for (let offset = 0; offset < byteChars.length; offset += 512) {
    const slice = byteChars.slice(offset, offset + 512);
    const byteNumbers = new Array(slice.length);
    for (let i = 0; i < slice.length; i++) {
      byteNumbers[i] = slice.charCodeAt(i);
    }
    byteArrays.push(new Uint8Array(byteNumbers));
  }
  return new Blob(byteArrays, { type: mimeType });
}

function fallbackToBrowserInput(): Promise<{ filePath: string; blob?: Blob } | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.capture = 'environment';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) { resolve(null); return; }
      const objectUrl = URL.createObjectURL(file);
      resolve({ filePath: objectUrl, blob: file });
    };
    input.oncancel = () => resolve(null);
    input.click();
  });
}

export async function checkCameraAvailable(): Promise<boolean> {
  try {
    if (!Capacitor.isNativePlatform()) {
      return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
    }
    return true;
  } catch {
    return false;
  }
}
