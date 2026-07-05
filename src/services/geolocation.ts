/**
 * GPS 定位服务 v1.3
 * BUG-2修复: getCurrentPosition + watchPosition 组合使用
 */

import { Geolocation } from '@capacitor/geolocation';
import { Capacitor } from '@capacitor/core';
import type { GeoPosition } from '../types';

let currentWatchId: string | null = null;

export async function requestLocationPermission(): Promise<boolean> {
  try {
    if (Capacitor.isNativePlatform()) {
      const permStatus = await Geolocation.checkPermissions();
      if (permStatus.location === 'granted' || permStatus.location === 'whenInUse') {
        return true;
      }
      const requestResult = await Geolocation.requestPermissions({ permissions: ['location'] });
      return requestResult.location === 'granted' || requestResult.location === 'whenInUse';
    }
    return true; // 浏览器环境
  } catch (error) {
    console.error('[GPS] 权限请求失败:', error);
    return false;
  }
}

export async function getCurrentPosition(): Promise<GeoPosition | null> {
  try {
    const hasPermission = await requestLocationPermission();
    if (!hasPermission) {
      console.warn('[GPS] 定位权限未授予');
      return null;
    }
    const pos = await Geolocation.getCurrentPosition({
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0,
    });
    return {
      latitude: pos.coords.latitude,
      longitude: pos.coords.longitude,
      altitude: pos.coords.altitude ?? undefined,
      accuracy: pos.coords.accuracy,
      timestamp: pos.timestamp,
    };
  } catch (error) {
    console.error('[GPS] 获取位置失败:', error);
    return null;
  }
}

export function startWatchPosition(
  callback: (position: GeoPosition) => void,
  errorCallback?: (error: string) => void,
): string | null {
  try {
    const watchId = Geolocation.watchPosition(
      { enableHighAccuracy: true, timeout: 10000 },
      (pos, err) => {
        if (err) {
          errorCallback?.(err.message);
          return;
        }
        if (pos) {
          callback({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            altitude: pos.coords.altitude ?? undefined,
            accuracy: pos.coords.accuracy,
            timestamp: pos.timestamp,
          });
        }
      },
    );
    currentWatchId = watchId;
    return watchId;
  } catch (error) {
    console.error('[GPS] watchPosition 失败:', error);
    return null;
  }
}

export async function stopWatchPosition(watchId?: string): Promise<void> {
  const id = watchId || currentWatchId;
  if (id) {
    try {
      await Geolocation.clearWatch({ id });
    } catch (error) {
      console.error('[GPS] 停止追踪失败:', error);
    }
    if (id === currentWatchId) currentWatchId = null;
  }
}

export async function collectElevationAverage(samples: number = 3): Promise<number | null> {
  const elevations: number[] = [];
  for (let i = 0; i < samples; i++) {
    const pos = await getCurrentPosition();
    if (pos?.altitude !== undefined) {
      elevations.push(pos.altitude);
    }
    if (i < samples - 1) await new Promise(r => setTimeout(r, 1000));
  }
  if (elevations.length > 0) {
    return Math.round((elevations.reduce((s, e) => s + e, 0) / elevations.length) * 10) / 10;
  }
  return null;
}
