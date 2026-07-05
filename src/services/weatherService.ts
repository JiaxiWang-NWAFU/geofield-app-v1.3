/**
 * 天气服务 - 使用 Open-Meteo 免费 API
 * 无需 API Key，离线时静默失败
 */

export interface WeatherInfo {
  temperature: number;
  humidity: number;
  weatherCode: number;
  description: string;
  windSpeed: number;
}

const WMO_CODES: Record<number, string> = {
  0: '晴', 1: '大部晴', 2: '多云', 3: '阴',
  45: '雾', 48: '雾凇',
  51: '小雨', 53: '中雨', 55: '大雨',
  61: '小雨', 63: '中雨', 65: '大雨',
  71: '小雪', 73: '中雪', 75: '大雪',
  80: '阵雨', 81: '阵雨', 82: '暴雨',
  95: '雷暴', 96: '雷暴', 99: '雷暴',
};

export async function fetchWeather(latitude: number, longitude: number): Promise<WeatherInfo | null> {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&timezone=Asia/Shanghai`;
    const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
    const data = await response.json();

    if (data.current) {
      const code = data.current.weather_code as number;
      return {
        temperature: data.current.temperature_2m,
        humidity: data.current.relative_humidity_2m,
        weatherCode: code,
        description: WMO_CODES[code] || '未知',
        windSpeed: data.current.wind_speed_10m,
      };
    }
    return null;
  } catch (error) {
    console.warn('[天气服务] 获取天气失败:', error);
    return null;
  }
}

export function formatWeatherString(info: WeatherInfo): string {
  return `${info.description} ${info.temperature}°C 湿度${info.humidity}%`;
}
