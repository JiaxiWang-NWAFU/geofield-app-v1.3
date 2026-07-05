/**
 * 百度AI植物识别服务 v1.3-fix
 * 修复: Token获取改为正确的POST+body, 新增图片URL转base64
 */

const DEFAULT_API_KEY = 'ORqoOezrQMQjCabD45VU21e3';
const DEFAULT_SECRET_KEY = 'qJ1FX7RW31sqUvkib8IejD4HbKovM6G0';

let cachedToken: string | null = null;
let tokenExpireTime = 0;

export interface PlantIdentifyResult {
  name: string;
  score: number;
}

/**
 * 将图片URL/路径转换为base64字符串
 * 支持 capacitor://, file://, blob:, http(s):, data: 等格式
 */
async function imageToBase64(imageSrc: string): Promise<string> {
  // 已经是 data: URL，直接提取 base64 部分
  if (imageSrc.startsWith('data:')) {
    const commaIndex = imageSrc.indexOf(',');
    if (commaIndex !== -1) {
      return imageSrc.substring(commaIndex + 1);
    }
    return imageSrc;
  }

  // 通过 fetch 读取图片，转为 blob，再转 base64
  const response = await fetch(imageSrc);
  if (!response.ok) {
    throw new Error(`无法读取图片: ${response.status} ${response.statusText}`);
  }
  const blob = await response.blob();
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      // 去掉 data:xxx;base64, 前缀
      const commaIndex = result.indexOf(',');
      if (commaIndex !== -1) {
        resolve(result.substring(commaIndex + 1));
      } else {
        resolve(result);
      }
    };
    reader.onerror = () => reject(new Error('图片转base64失败'));
    reader.readAsDataURL(blob);
  });
}

export async function getAccessToken(apiKey?: string, secretKey?: string): Promise<string> {
  const key = apiKey || DEFAULT_API_KEY;
  const secret = secretKey || DEFAULT_SECRET_KEY;

  if (cachedToken && Date.now() < tokenExpireTime) {
    return cachedToken;
  }

  const tokenUrl = 'https://aip.baidubce.com/oauth/2.0/token';
  const body = `grant_type=client_credentials&client_id=${key}&client_secret=${secret}`;
  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const data = await response.json();

  if (data.access_token) {
    cachedToken = data.access_token;
    tokenExpireTime = Date.now() + (data.expires_in - 300) * 1000;
    return cachedToken!;
  }
  throw new Error(data.error_description || '获取百度AI Token失败');
}

export async function identifyPlant(
  imageSrc: string,
  apiKey?: string,
  secretKey?: string
): Promise<PlantIdentifyResult[]> {
  const token = await getAccessToken(apiKey, secretKey);

  // 将图片URL/路径转换为base64
  let cleanBase64: string;
  if (imageSrc.startsWith('data:')) {
    // data URL: 提取逗号后的base64部分
    const commaIndex = imageSrc.indexOf(',');
    cleanBase64 = commaIndex !== -1 ? imageSrc.substring(commaIndex + 1) : imageSrc;
  } else {
    // 非 data URL (capacitor://, file://, blob:, http:// 等)，先转换
    cleanBase64 = await imageToBase64(imageSrc);
  }

  const url = `https://aip.baidubce.com/rest/2.0/image-classify/v1/plant?access_token=${token}`;
  const body = `image=${encodeURIComponent(cleanBase64)}&baike_num=0`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  const data = await response.json();
  if (data.result && Array.isArray(data.result)) {
    return data.result.map((item: { name: string; score: number }) => ({
      name: item.name,
      score: item.score,
    }));
  }
  throw new Error(data.error_msg || '植物识别失败');
}

export function clearTokenCache(): void {
  cachedToken = null;
  tokenExpireTime = 0;
}
