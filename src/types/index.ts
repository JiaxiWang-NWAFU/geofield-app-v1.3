/**
 * 野外调查助手 v1.3 类型定义
 */

// ==================== 调查类型 ====================

export type SurveyType = 'vegetation' | 'soil' | 'erosion' | 'custom';

export interface Survey {
  id: string;
  name: string;
  description?: string;
  survey_type?: SurveyType;
  created_at: string;
  updated_at: string;
}

// ==================== 样方类型（植被子类型） ====================

export type QuadratSubType = 'grass' | 'shrub' | 'arbor' | 'farmland';

export interface Quadrat {
  id: string;
  survey_id: string;
  name: string;
  type: string; // 'vegetation', 'soil', 'erosion', 'custom'
  quadrat_sub_type?: QuadratSubType; // 植被调查的子类型
  latitude?: number;
  longitude?: number;
  elevation?: number;
  slope?: number;
  aspect?: number; // 坡向 0-360°
  survey_date?: string;
  weather?: string;
  surveyors?: string;
  notes?: string;
  // 旧字段保留
  vegetation_cover?: number;
  crust_cover?: number;
  // v1.3 新增字段
  total_cover?: number;
  gravel_cover?: number;
  litter_cover?: number;
  canopy_closure?: number;
  shrub_layer_cover?: number;
  herb_layer_cover?: number;
  quadrat_size?: string; // e.g. "1x1", "5x5", "10x10"
  created_at: string;
  updated_at: string;
}

export interface QuadratFormData {
  name: string;
  type: string;
  quadrat_sub_type?: QuadratSubType;
  latitude?: number;
  longitude?: number;
  elevation?: number;
  slope?: number;
  aspect?: number;
  survey_date?: string;
  weather?: string;
  surveyors?: string;
  notes?: string;
  vegetation_cover?: number;
  crust_cover?: number;
  total_cover?: number;
  gravel_cover?: number;
  litter_cover?: number;
  canopy_closure?: number;
  shrub_layer_cover?: number;
  herb_layer_cover?: number;
  quadrat_size?: string;
}

// ==================== 植物记录 ====================

export interface PlantRecord {
  id: string;
  quadrat_id: string;
  species_name: string;
  latin_name?: string;
  family?: string;
  genus?: string;
  count: number;
  max_height?: number;
  avg_height?: number;
  cover_percent?: number;
  cover_recognized?: number;
  notes?: string;
  photo_path?: string;
  plant_id_result?: string;
  // v1.3 新增字段
  dbh?: number;           // 胸径 (cm)
  tree_height?: number;   // 树高 (m)
  shrub_height?: number;  // 株高 (cm)
  individual_cover?: number; // 单株盖度 (%)
  crop_variety?: string;  // 品种
  row_spacing?: number;   // 行距 (cm)
  plant_spacing?: number; // 株距 (cm)
  created_at: string;
}

export interface PlantRecordFormData {
  species_name: string;
  latin_name?: string;
  family?: string;
  genus?: string;
  count: number;
  max_height?: number;
  avg_height?: number;
  cover_percent?: number;
  cover_recognized?: number;
  notes?: string;
  photo_path?: string;
  dbh?: number;
  tree_height?: number;
  shrub_height?: number;
  individual_cover?: number;
  crop_variety?: string;
  row_spacing?: number;
  plant_spacing?: number;
}

// ==================== 照片 ====================

export type PhotoType = 'general' | 'species' | 'quadrat_overview' | 'soil' | 'landscape' | 'quadrat_photo';

export interface Photo {
  id: string;
  quadrat_id?: string;
  plant_record_id?: string;
  file_path: string;
  thumbnail_path?: string;
  photo_type: PhotoType;
  name?: string;
  description?: string;
  latitude?: number;
  longitude?: number;
  created_at: string;
}

// ==================== 样方照片 ====================

export interface QuadratPhoto {
  id: string;
  quadrat_id: string;
  file_path: string;
  name: string;
  description?: string;
  created_at: string;
}

// ==================== 自定义调查类型 ====================

export interface CustomSurveyType {
  id: string;
  name: string;
  unit_name: string; // 调查单元名称: "样方", "样点" 等
  form_fields: string; // JSON array of CustomFormField
  created_at: string;
}

export interface CustomFormField {
  name: string;
  label: string;
  type: 'text' | 'number' | 'date' | 'select';
  options?: string[]; // for select type
  default_value?: string;
  required?: boolean;
}

// ==================== 设置 ====================

export interface AppSettings {
  id: string;
  username: string;
  basemap_api_url: string;
  plant_id_api_url: string;
  plant_id_api_key: string;
  cover_id_api_url: string;
  cover_id_api_key: string;
  enable_gps_tracking: boolean;
  enable_ai_plant_id: boolean;
  enable_ai_cover_id: boolean;
  default_survey_type: string;
  // v1.3 新增
  baidu_api_key?: string;
  baidu_secret_key?: string;
  weather_api_key?: string;
  updated_at: string;
}

// ==================== GPS 相关 ====================

export interface GeoPosition {
  latitude: number;
  longitude: number;
  altitude?: number;
  accuracy?: number;
  timestamp?: number;
}

export interface TerrainData {
  elevation: number;
  slope?: number;
  aspect?: number;
}

// ==================== POI / 地图相关 ====================

export interface MapPOI {
  id: string;
  name: string;
  type: string;
  quadrat_sub_type?: QuadratSubType;
  latitude: number;
  longitude: number;
  survey_id: string;
  quadrat_id?: string;
  is_selected?: boolean;
}

// ==================== 计数器 ====================

export interface CounterItem {
  id: string;
  species_name: string;
  latin_name?: string;
  count: number;
}

// ==================== 导出相关 ====================

export type ExportFormat = 'word' | 'excel' | 'csv';

export interface ExportOptions {
  format: ExportFormat;
  survey_id?: string;
  include_photos: boolean;
  include_stats: boolean;
}

// ==================== 植物数据库 ====================

export interface PlantDatabaseEntry {
  name: string;
  latin_name: string;
  family: string;
  genus: string;
}

// ==================== 常量 ====================

export const WEATHER_OPTIONS = ['晴', '多云', '阴', '小雨', '中雨', '大雨', '雪', '雾', '风大'] as const;

export const QUADRAT_TYPE_LABELS: Record<string, string> = {
  vegetation: '植被样方',
  soil: '土壤样点',
  erosion: '侵蚀样点',
  custom: '自定义',
};

export const QUADRAT_SUB_TYPE_LABELS: Record<QuadratSubType, string> = {
  grass: '草地',
  shrub: '灌木地',
  arbor: '乔木地',
  farmland: '耕地',
};

export const QUADRAT_SUB_TYPE_COLORS: Record<QuadratSubType, string> = {
  grass: 'bg-green-100 text-green-700',
  shrub: 'bg-orange-100 text-orange-700',
  arbor: 'bg-emerald-100 text-emerald-700',
  farmland: 'bg-yellow-100 text-yellow-700',
};

export const QUADRAT_SUB_TYPE_SHORT: Record<QuadratSubType, string> = {
  grass: '草',
  shrub: '灌',
  arbor: '乔',
  farmland: '耕',
};

export const QUADRAT_DEFAULT_SIZES: Record<QuadratSubType, string> = {
  grass: '1x1',
  shrub: '5x5',
  arbor: '10x10',
  farmland: '',
};

export const SURVEY_TYPE_OPTIONS: Record<SurveyType, string> = {
  vegetation: '植被调查',
  soil: '土壤调查',
  erosion: '土壤侵蚀调查',
  custom: '自定义调查',
};

export const DEFAULT_SURVEY_TYPES = [
  { id: 'vegetation', name: '植被调查' },
  { id: 'soil', name: '土壤调查' },
  { id: 'erosion', name: '土壤侵蚀调查' },
];

export const PHOTO_TYPE_OPTIONS: Record<PhotoType, string> = {
  general: '一般照片',
  species: '物种照片',
  quadrat_overview: '样方全貌',
  soil: '土壤照片',
  landscape: '景观照片',
  quadrat_photo: '样方照片',
};
