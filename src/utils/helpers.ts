/**
 * 工具函数集合
 */

export function shortId(): string {
  return Math.random().toString(36).substring(2, 10);
}

export function formatDate(date: string | Date, format: string = 'YYYY-MM-DD'): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '';

  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const seconds = String(d.getSeconds()).padStart(2, '0');

  return format
    .replace('YYYY', String(year))
    .replace('MM', month)
    .replace('DD', day)
    .replace('HH', hours)
    .replace('mm', minutes)
    .replace('ss', seconds);
}

export function getTodayString(): string {
  return formatDate(new Date(), 'YYYY-MM-DD');
}

export function debounce<T extends (...args: unknown[]) => void>(
  func: T,
  wait: number,
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

export function throttle<T extends (...args: unknown[]) => void>(
  func: T,
  limit: number,
): (...args: Parameters<T>) => void {
  let inThrottle = false;
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

export function safeJsonParse<T>(json: string, fallback: T): T {
  try {
    return JSON.parse(json);
  } catch {
    return fallback;
  }
}

export function formatNumber(num: number | undefined | null, decimals: number = 1): string {
  if (num === undefined || num === null) return '-';
  return num.toFixed(decimals);
}

export function showToast(message: string, duration: number = 2000): void {
  const existing = document.getElementById('field-toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.id = 'field-toast';
  toast.textContent = message;
  toast.className =
    'fixed top-16 left-1/2 -translate-x-1/2 z-50 bg-gray-800 text-white px-4 py-2 rounded-lg shadow-lg text-sm animate-fade-in';
  toast.style.transition = 'opacity 0.3s';

  document.body.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

export function confirmDialog(message: string, title: string = '确认'): Promise<boolean> {
  return new Promise((resolve) => {
    const confirmed = window.confirm(`${title}\n\n${message}`);
    resolve(confirmed);
  });
}

export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function calculateDistance(
  lat1: number, lng1: number, lat2: number, lng2: number,
): number {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function getFileName(filePath: string): string {
  const parts = filePath.split('/');
  const name = parts[parts.length - 1];
  const dotIndex = name.lastIndexOf('.');
  return dotIndex > 0 ? name.slice(0, dotIndex) : name;
}

export function now(): string {
  return new Date().toISOString();
}

export function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * 方位角转中文方位
 */
export function bearingToChinese(bearing: number): string {
  if (bearing >= 337.5 || bearing < 22.5) return '北';
  if (bearing >= 22.5 && bearing < 67.5) return '东北';
  if (bearing >= 67.5 && bearing < 112.5) return '东';
  if (bearing >= 112.5 && bearing < 157.5) return '东南';
  if (bearing >= 157.5 && bearing < 202.5) return '南';
  if (bearing >= 202.5 && bearing < 247.5) return '西南';
  if (bearing >= 247.5 && bearing < 292.5) return '西';
  if (bearing >= 292.5 && bearing < 337.5) return '西北';
  return '平地';
}
