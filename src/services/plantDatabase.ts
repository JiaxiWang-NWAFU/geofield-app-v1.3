/**
 * 本地植物数据库服务
 * 支持模糊搜索（中文名、拉丁名、科、属）
 */

import plantData from '../data/plantDatabase.json';
import type { PlantDatabaseEntry } from '../types';

const database: PlantDatabaseEntry[] = plantData as PlantDatabaseEntry[];

/**
 * 模糊搜索植物
 */
export function searchPlants(keyword: string, limit: number = 20): PlantDatabaseEntry[] {
  if (!keyword.trim()) return [];
  const kw = keyword.trim().toLowerCase();

  return database
    .filter(entry =>
      entry.name.toLowerCase().includes(kw) ||
      entry.latin_name.toLowerCase().includes(kw) ||
      entry.family.toLowerCase().includes(kw) ||
      entry.genus.toLowerCase().includes(kw)
    )
    .slice(0, limit);
}

/**
 * 获取所有科名（去重）
 */
export function getAllFamilies(): string[] {
  return [...new Set(database.map(e => e.family))].sort();
}

/**
 * 获取数据库大小
 */
export function getDatabaseSize(): number {
  return database.length;
}

export default database;
