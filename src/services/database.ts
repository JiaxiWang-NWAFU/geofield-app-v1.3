/**
 * SQLite 数据库服务 v1.3
 * 基于 @capacitor-community/sqlite
 * 保留 v1.2 bug 修复：_initSQLite() + Promise.race 5秒超时
 */

import { CapacitorSQLite, SQLiteDBConnection, SQLiteConnection } from '@capacitor-community/sqlite';
import { Capacitor } from '@capacitor/core';
import type {
  Survey,
  Quadrat,
  QuadratFormData,
  PlantRecord,
  PlantRecordFormData,
  Photo,
  QuadratPhoto,
  AppSettings,
  CustomSurveyType,
} from '../types';
import { v4 as uuidv4 } from 'uuid';

let sqlite: SQLiteConnection;
let db: SQLiteDBConnection;
let isInitialized = false;

// 浏览器内存模式
let memoryMode = false;
const memoryStore = {
  surveys: [] as Survey[],
  quadrats: [] as Quadrat[],
  plant_records: [] as PlantRecord[],
  photos: [] as Photo[],
  quadrat_photos: [] as QuadratPhoto[],
  settings: null as AppSettings | null,
  custom_survey_types: [] as CustomSurveyType[],
};

export async function initDatabase(): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    try {
      // v1.3: 超时缩短至5秒（BUG-1修复）
      const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('SQLite 初始化超时（5s）')), 5000)
      );
      await Promise.race([_initSQLite(), timeout]);
      isInitialized = true;
      console.log('[野外调查助手] SQLite 数据库初始化成功');
    } catch (error) {
      console.error('[野外调查助手] SQLite 初始化失败，切换到内存模式:', error);
      memoryMode = true;
      isInitialized = true;
    }
  } else {
    console.log('[野外调查助手] 浏览器环境，使用内存数据库');
    memoryMode = true;
    isInitialized = true;
  }
}

async function _initSQLite(): Promise<void> {
  sqlite = new SQLiteConnection(CapacitorSQLite);
  const isConn = (await sqlite.isConnection('field_survey_db', false)).result;
  if (isConn) {
    db = await sqlite.retrieveConnection('field_survey_db', false);
  } else {
    db = await sqlite.createConnection('field_survey_db', false, 'no-encryption', 1, false);
  }
  await db.open();
  await createTables();
  await migrateSchema();
}

export function isDatabaseReady(): boolean {
  return isInitialized;
}

async function createTables(): Promise<void> {
  if (memoryMode) return;

  const tableQueries = [
    `CREATE TABLE IF NOT EXISTS surveys (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      survey_type TEXT DEFAULT 'vegetation',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );`,
    `CREATE TABLE IF NOT EXISTS quadrats (
      id TEXT PRIMARY KEY,
      survey_id TEXT REFERENCES surveys(id),
      name TEXT NOT NULL,
      type TEXT DEFAULT 'vegetation',
      quadrat_sub_type TEXT,
      latitude REAL,
      longitude REAL,
      elevation REAL,
      slope REAL,
      aspect REAL,
      survey_date TEXT,
      weather TEXT,
      surveyors TEXT,
      notes TEXT,
      vegetation_cover REAL,
      crust_cover REAL,
      total_cover REAL,
      gravel_cover REAL,
      litter_cover REAL,
      canopy_closure REAL,
      shrub_layer_cover REAL,
      herb_layer_cover REAL,
      quadrat_size TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );`,
    `CREATE TABLE IF NOT EXISTS plant_records (
      id TEXT PRIMARY KEY,
      quadrat_id TEXT REFERENCES quadrats(id),
      species_name TEXT NOT NULL,
      latin_name TEXT,
      family TEXT,
      genus TEXT,
      count INTEGER DEFAULT 1,
      max_height REAL,
      avg_height REAL,
      cover_percent REAL,
      cover_recognized REAL,
      notes TEXT,
      photo_path TEXT,
      plant_id_result TEXT,
      dbh REAL,
      tree_height REAL,
      shrub_height REAL,
      individual_cover REAL,
      crop_variety TEXT,
      row_spacing REAL,
      plant_spacing REAL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );`,
    `CREATE TABLE IF NOT EXISTS photos (
      id TEXT PRIMARY KEY,
      quadrat_id TEXT REFERENCES quadrats(id),
      plant_record_id TEXT REFERENCES plant_records(id),
      file_path TEXT NOT NULL,
      thumbnail_path TEXT,
      photo_type TEXT DEFAULT 'general',
      name TEXT,
      description TEXT,
      latitude REAL,
      longitude REAL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );`,
    `CREATE TABLE IF NOT EXISTS quadrat_photos (
      id TEXT PRIMARY KEY,
      quadrat_id TEXT REFERENCES quadrats(id),
      file_path TEXT NOT NULL,
      name TEXT,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );`,
    `CREATE TABLE IF NOT EXISTS settings (
      id TEXT PRIMARY KEY DEFAULT 'default',
      username TEXT DEFAULT '',
      basemap_api_url TEXT DEFAULT '',
      plant_id_api_url TEXT DEFAULT '',
      plant_id_api_key TEXT DEFAULT '',
      cover_id_api_url TEXT DEFAULT '',
      cover_id_api_key TEXT DEFAULT '',
      enable_gps_tracking INTEGER DEFAULT 1,
      enable_ai_plant_id INTEGER DEFAULT 1,
      enable_ai_cover_id INTEGER DEFAULT 1,
      default_survey_type TEXT DEFAULT 'vegetation',
      baidu_api_key TEXT DEFAULT '',
      baidu_secret_key TEXT DEFAULT '',
      weather_api_key TEXT DEFAULT '',
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );`,
    `CREATE TABLE IF NOT EXISTS custom_survey_types (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      unit_name TEXT DEFAULT '样点',
      form_fields TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );`,
  ];

  for (const query of tableQueries) {
    await db.execute(query);
  }
}

// Schema migration for existing databases
async function migrateSchema(): Promise<void> {
  if (memoryMode) return;
  const migrationQueries = [
    "ALTER TABLE quadrats ADD COLUMN quadrat_sub_type TEXT",
    "ALTER TABLE quadrats ADD COLUMN total_cover REAL",
    "ALTER TABLE quadrats ADD COLUMN gravel_cover REAL",
    "ALTER TABLE quadrats ADD COLUMN litter_cover REAL",
    "ALTER TABLE quadrats ADD COLUMN canopy_closure REAL",
    "ALTER TABLE quadrats ADD COLUMN shrub_layer_cover REAL",
    "ALTER TABLE quadrats ADD COLUMN herb_layer_cover REAL",
    "ALTER TABLE quadrats ADD COLUMN quadrat_size TEXT",
    "ALTER TABLE plant_records ADD COLUMN dbh REAL",
    "ALTER TABLE plant_records ADD COLUMN tree_height REAL",
    "ALTER TABLE plant_records ADD COLUMN shrub_height REAL",
    "ALTER TABLE plant_records ADD COLUMN individual_cover REAL",
    "ALTER TABLE plant_records ADD COLUMN crop_variety TEXT",
    "ALTER TABLE plant_records ADD COLUMN row_spacing REAL",
    "ALTER TABLE plant_records ADD COLUMN plant_spacing REAL",
    "ALTER TABLE settings ADD COLUMN baidu_api_key TEXT DEFAULT ''",
    "ALTER TABLE settings ADD COLUMN baidu_secret_key TEXT DEFAULT ''",
    "ALTER TABLE settings ADD COLUMN weather_api_key TEXT DEFAULT ''",
  ];
  for (const q of migrationQueries) {
    try { await db.execute(q); } catch { /* column may already exist */ }
  }
  // Migrate aspect from TEXT to REAL (keep numeric values)
  try {
    await db.execute("UPDATE quadrats SET aspect = NULL WHERE aspect IS NOT NULL AND typeof(aspect) = 'text' AND CAST(aspect AS REAL) IS NULL");
  } catch { /* ignore */ }
}

// ==================== 调查项目 CRUD ====================

export async function getAllSurveys(): Promise<Survey[]> {
  if (memoryMode) return memoryStore.surveys;
  const result = await db.query('SELECT * FROM surveys ORDER BY created_at DESC');
  return (result.values || []) as Survey[];
}

export async function getSurveyById(id: string): Promise<Survey | null> {
  if (memoryMode) return memoryStore.surveys.find(s => s.id === id) || null;
  const result = await db.query('SELECT * FROM surveys WHERE id = ?', [id]);
  return result.values?.[0] as Survey | null;
}

export async function createSurvey(name: string, description?: string, surveyType?: string): Promise<Survey> {
  const nowStr = new Date().toISOString();
  const survey: Survey = {
    id: uuidv4(),
    name,
    description,
    survey_type: (surveyType || 'vegetation') as Survey['survey_type'],
    created_at: nowStr,
    updated_at: nowStr,
  };
  if (memoryMode) {
    memoryStore.surveys.push(survey);
    return survey;
  }
  await db.run(
    'INSERT INTO surveys (id, name, description, survey_type, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
    [survey.id, survey.name, survey.description, survey.survey_type, survey.created_at, survey.updated_at]
  );
  return survey;
}

export async function updateSurvey(id: string, name: string, description?: string): Promise<void> {
  const nowStr = new Date().toISOString();
  if (memoryMode) {
    const idx = memoryStore.surveys.findIndex(s => s.id === id);
    if (idx !== -1) {
      memoryStore.surveys[idx] = { ...memoryStore.surveys[idx], name, description, updated_at: nowStr };
    }
    return;
  }
  await db.run('UPDATE surveys SET name = ?, description = ?, updated_at = ? WHERE id = ?', [name, description, nowStr, id]);
}

export async function deleteSurvey(id: string): Promise<void> {
  if (memoryMode) {
    const quadratIds = memoryStore.quadrats.filter(q => q.survey_id === id).map(q => q.id);
    memoryStore.surveys = memoryStore.surveys.filter(s => s.id !== id);
    memoryStore.quadrats = memoryStore.quadrats.filter(q => q.survey_id !== id);
    memoryStore.plant_records = memoryStore.plant_records.filter(p => !quadratIds.includes(p.quadrat_id));
    memoryStore.photos = memoryStore.photos.filter(p => !quadratIds.includes(p.quadrat_id || ''));
    memoryStore.quadrat_photos = memoryStore.quadrat_photos.filter(p => !quadratIds.includes(p.quadrat_id));
    return;
  }
  const quadrats = await db.query('SELECT id FROM quadrats WHERE survey_id = ?', [id]);
  const quadratIds = (quadrats.values || []).map((q: Record<string, unknown>) => q.id as string);
  for (const qid of quadratIds) {
    await db.run('DELETE FROM plant_records WHERE quadrat_id = ?', [qid]);
    await db.run('DELETE FROM photos WHERE quadrat_id = ?', [qid]);
    await db.run('DELETE FROM quadrat_photos WHERE quadrat_id = ?', [qid]);
  }
  await db.run('DELETE FROM quadrats WHERE survey_id = ?', [id]);
  await db.run('DELETE FROM surveys WHERE id = ?', [id]);
}

// ==================== 样方 CRUD ====================

export async function getQuadratsBySurveyId(surveyId: string): Promise<Quadrat[]> {
  if (memoryMode) return memoryStore.quadrats.filter(q => q.survey_id === surveyId);
  const result = await db.query('SELECT * FROM quadrats WHERE survey_id = ? ORDER BY created_at ASC', [surveyId]);
  return (result.values || []) as Quadrat[];
}

export async function getQuadratById(id: string): Promise<Quadrat | null> {
  if (memoryMode) return memoryStore.quadrats.find(q => q.id === id) || null;
  const result = await db.query('SELECT * FROM quadrats WHERE id = ?', [id]);
  return result.values?.[0] as Quadrat | null;
}

export async function createQuadrat(surveyId: string, data: QuadratFormData): Promise<Quadrat> {
  const nowStr = new Date().toISOString();
  const quadrat: Quadrat = {
    id: uuidv4(),
    survey_id: surveyId,
    name: data.name,
    type: data.type,
    quadrat_sub_type: data.quadrat_sub_type,
    latitude: data.latitude,
    longitude: data.longitude,
    elevation: data.elevation,
    slope: data.slope,
    aspect: data.aspect,
    survey_date: data.survey_date,
    weather: data.weather,
    surveyors: data.surveyors,
    notes: data.notes,
    vegetation_cover: data.vegetation_cover,
    crust_cover: data.crust_cover,
    total_cover: data.total_cover,
    gravel_cover: data.gravel_cover,
    litter_cover: data.litter_cover,
    canopy_closure: data.canopy_closure,
    shrub_layer_cover: data.shrub_layer_cover,
    herb_layer_cover: data.herb_layer_cover,
    quadrat_size: data.quadrat_size,
    created_at: nowStr,
    updated_at: nowStr,
  };
  if (memoryMode) {
    memoryStore.quadrats.push(quadrat);
    return quadrat;
  }
  await db.run(
    `INSERT INTO quadrats (id, survey_id, name, type, quadrat_sub_type, latitude, longitude, elevation, slope, aspect, survey_date, weather, surveyors, notes, vegetation_cover, crust_cover, total_cover, gravel_cover, litter_cover, canopy_closure, shrub_layer_cover, herb_layer_cover, quadrat_size, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      quadrat.id, quadrat.survey_id, quadrat.name, quadrat.type, quadrat.quadrat_sub_type,
      quadrat.latitude, quadrat.longitude, quadrat.elevation, quadrat.slope, quadrat.aspect,
      quadrat.survey_date, quadrat.weather, quadrat.surveyors, quadrat.notes,
      quadrat.vegetation_cover, quadrat.crust_cover, quadrat.total_cover, quadrat.gravel_cover,
      quadrat.litter_cover, quadrat.canopy_closure, quadrat.shrub_layer_cover,
      quadrat.herb_layer_cover, quadrat.quadrat_size, quadrat.created_at, quadrat.updated_at,
    ]
  );
  return quadrat;
}

export async function updateQuadrat(id: string, data: Partial<QuadratFormData>): Promise<void> {
  const nowStr = new Date().toISOString();
  if (memoryMode) {
    const idx = memoryStore.quadrats.findIndex(q => q.id === id);
    if (idx !== -1) {
      memoryStore.quadrats[idx] = { ...memoryStore.quadrats[idx], ...data, updated_at: nowStr };
    }
    return;
  }
  const fields: string[] = [];
  const values: unknown[] = [];
  const colMap: Record<string, string> = {
    name: 'name', type: 'type', quadrat_sub_type: 'quadrat_sub_type',
    latitude: 'latitude', longitude: 'longitude', elevation: 'elevation',
    slope: 'slope', aspect: 'aspect', survey_date: 'survey_date',
    weather: 'weather', surveyors: 'surveyors', notes: 'notes',
    vegetation_cover: 'vegetation_cover', crust_cover: 'crust_cover',
    total_cover: 'total_cover', gravel_cover: 'gravel_cover',
    litter_cover: 'litter_cover', canopy_closure: 'canopy_closure',
    shrub_layer_cover: 'shrub_layer_cover', herb_layer_cover: 'herb_layer_cover',
    quadrat_size: 'quadrat_size',
  };
  for (const [key, col] of Object.entries(colMap)) {
    if (key in data) {
      fields.push(`${col} = ?`);
      values.push((data as Record<string, unknown>)[key]);
    }
  }
  if (fields.length > 0) {
    fields.push('updated_at = ?');
    values.push(nowStr);
    values.push(id);
    await db.run(`UPDATE quadrats SET ${fields.join(', ')} WHERE id = ?`, values);
  }
}

export async function deleteQuadrat(id: string): Promise<void> {
  if (memoryMode) {
    memoryStore.quadrats = memoryStore.quadrats.filter(q => q.id !== id);
    memoryStore.plant_records = memoryStore.plant_records.filter(p => p.quadrat_id !== id);
    memoryStore.photos = memoryStore.photos.filter(p => p.quadrat_id !== id);
    memoryStore.quadrat_photos = memoryStore.quadrat_photos.filter(p => p.quadrat_id !== id);
    return;
  }
  await db.run('DELETE FROM plant_records WHERE quadrat_id = ?', [id]);
  await db.run('DELETE FROM photos WHERE quadrat_id = ?', [id]);
  await db.run('DELETE FROM quadrat_photos WHERE quadrat_id = ?', [id]);
  await db.run('DELETE FROM quadrats WHERE id = ?', [id]);
}

// ==================== 植物记录 CRUD ====================

export async function getPlantRecordsByQuadratId(quadratId: string): Promise<PlantRecord[]> {
  if (memoryMode) return memoryStore.plant_records.filter(p => p.quadrat_id === quadratId);
  const result = await db.query('SELECT * FROM plant_records WHERE quadrat_id = ? ORDER BY created_at ASC', [quadratId]);
  return (result.values || []) as PlantRecord[];
}

export async function getPlantRecordById(id: string): Promise<PlantRecord | null> {
  if (memoryMode) return memoryStore.plant_records.find(p => p.id === id) || null;
  const result = await db.query('SELECT * FROM plant_records WHERE id = ?', [id]);
  return result.values?.[0] as PlantRecord | null;
}

export async function createPlantRecord(quadratId: string, data: PlantRecordFormData): Promise<PlantRecord> {
  const nowStr = new Date().toISOString();
  const record: PlantRecord = {
    id: uuidv4(),
    quadrat_id: quadratId,
    species_name: data.species_name,
    latin_name: data.latin_name,
    family: data.family,
    genus: data.genus,
    count: data.count,
    max_height: data.max_height,
    avg_height: data.avg_height,
    cover_percent: data.cover_percent,
    cover_recognized: data.cover_recognized,
    notes: data.notes,
    photo_path: data.photo_path,
    dbh: data.dbh,
    tree_height: data.tree_height,
    shrub_height: data.shrub_height,
    individual_cover: data.individual_cover,
    crop_variety: data.crop_variety,
    row_spacing: data.row_spacing,
    plant_spacing: data.plant_spacing,
    created_at: nowStr,
  };
  if (memoryMode) {
    memoryStore.plant_records.push(record);
    return record;
  }
  await db.run(
    `INSERT INTO plant_records (id, quadrat_id, species_name, latin_name, family, genus, count, max_height, avg_height, cover_percent, cover_recognized, notes, photo_path, dbh, tree_height, shrub_height, individual_cover, crop_variety, row_spacing, plant_spacing, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      record.id, record.quadrat_id, record.species_name, record.latin_name,
      record.family, record.genus, record.count, record.max_height,
      record.avg_height, record.cover_percent, record.cover_recognized,
      record.notes, record.photo_path, record.dbh, record.tree_height,
      record.shrub_height, record.individual_cover, record.crop_variety,
      record.row_spacing, record.plant_spacing, record.created_at,
    ]
  );
  return record;
}

export async function updatePlantRecord(id: string, data: Partial<PlantRecordFormData>): Promise<void> {
  if (memoryMode) {
    const idx = memoryStore.plant_records.findIndex(p => p.id === id);
    if (idx !== -1) {
      memoryStore.plant_records[idx] = { ...memoryStore.plant_records[idx], ...data };
    }
    return;
  }
  const fields: string[] = [];
  const values: unknown[] = [];
  const fieldMap: Record<string, string> = {
    species_name: 'species_name', latin_name: 'latin_name', family: 'family',
    genus: 'genus', count: 'count', max_height: 'max_height',
    avg_height: 'avg_height', cover_percent: 'cover_percent',
    cover_recognized: 'cover_recognized', notes: 'notes', photo_path: 'photo_path',
    dbh: 'dbh', tree_height: 'tree_height', shrub_height: 'shrub_height',
    individual_cover: 'individual_cover', crop_variety: 'crop_variety',
    row_spacing: 'row_spacing', plant_spacing: 'plant_spacing',
  };
  for (const [key, col] of Object.entries(fieldMap)) {
    if (key in data) {
      fields.push(`${col} = ?`);
      values.push((data as Record<string, unknown>)[key]);
    }
  }
  if (fields.length > 0) {
    values.push(id);
    await db.run(`UPDATE plant_records SET ${fields.join(', ')} WHERE id = ?`, values);
  }
}

export async function updatePlantCount(id: string, count: number): Promise<void> {
  if (memoryMode) {
    const idx = memoryStore.plant_records.findIndex(p => p.id === id);
    if (idx !== -1) { memoryStore.plant_records[idx].count = count; }
    return;
  }
  await db.run('UPDATE plant_records SET count = ? WHERE id = ?', [count, id]);
}

export async function deletePlantRecord(id: string): Promise<void> {
  if (memoryMode) {
    memoryStore.plant_records = memoryStore.plant_records.filter(p => p.id !== id);
    memoryStore.photos = memoryStore.photos.filter(p => p.plant_record_id !== id);
    return;
  }
  await db.run('DELETE FROM photos WHERE plant_record_id = ?', [id]);
  await db.run('DELETE FROM plant_records WHERE id = ?', [id]);
}

// ==================== 照片 CRUD ====================

export async function getPhotosByQuadratId(quadratId: string): Promise<Photo[]> {
  if (memoryMode) return memoryStore.photos.filter(p => p.quadrat_id === quadratId);
  const result = await db.query('SELECT * FROM photos WHERE quadrat_id = ? ORDER BY created_at DESC', [quadratId]);
  return (result.values || []) as Photo[];
}

export async function getPhotosByPlantRecordId(plantRecordId: string): Promise<Photo[]> {
  if (memoryMode) return memoryStore.photos.filter(p => p.plant_record_id === plantRecordId);
  const result = await db.query('SELECT * FROM photos WHERE plant_record_id = ? ORDER BY created_at DESC', [plantRecordId]);
  return (result.values || []) as Photo[];
}

export async function createPhoto(data: Omit<Photo, 'id' | 'created_at'>): Promise<Photo> {
  const nowStr = new Date().toISOString();
  const photo: Photo = { id: uuidv4(), ...data, created_at: nowStr };
  if (memoryMode) { memoryStore.photos.push(photo); return photo; }
  await db.run(
    `INSERT INTO photos (id, quadrat_id, plant_record_id, file_path, thumbnail_path, photo_type, name, description, latitude, longitude, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [photo.id, photo.quadrat_id, photo.plant_record_id, photo.file_path,
     photo.thumbnail_path, photo.photo_type, photo.name, photo.description,
     photo.latitude, photo.longitude, photo.created_at]
  );
  return photo;
}

export async function deletePhoto(id: string): Promise<void> {
  if (memoryMode) { memoryStore.photos = memoryStore.photos.filter(p => p.id !== id); return; }
  await db.run('DELETE FROM photos WHERE id = ?', [id]);
}

// ==================== 样方照片 CRUD ====================

export async function getQuadratPhotos(quadratId: string): Promise<QuadratPhoto[]> {
  if (memoryMode) return memoryStore.quadrat_photos.filter(p => p.quadrat_id === quadratId);
  const result = await db.query('SELECT * FROM quadrat_photos WHERE quadrat_id = ? ORDER BY created_at DESC', [quadratId]);
  return (result.values || []) as QuadratPhoto[];
}

export async function createQuadratPhoto(quadratId: string, filePath: string, name: string, description?: string): Promise<QuadratPhoto> {
  const nowStr = new Date().toISOString();
  const photo: QuadratPhoto = { id: uuidv4(), quadrat_id: quadratId, file_path: filePath, name, description, created_at: nowStr };
  if (memoryMode) { memoryStore.quadrat_photos.push(photo); return photo; }
  await db.run(
    'INSERT INTO quadrat_photos (id, quadrat_id, file_path, name, description, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    [photo.id, photo.quadrat_id, photo.file_path, photo.name, photo.description, photo.created_at]
  );
  return photo;
}

export async function deleteQuadratPhoto(id: string): Promise<void> {
  if (memoryMode) { memoryStore.quadrat_photos = memoryStore.quadrat_photos.filter(p => p.id !== id); return; }
  await db.run('DELETE FROM quadrat_photos WHERE id = ?', [id]);
}

// ==================== 自定义调查类型 CRUD ====================

export async function getAllCustomSurveyTypes(): Promise<CustomSurveyType[]> {
  if (memoryMode) return memoryStore.custom_survey_types;
  const result = await db.query('SELECT * FROM custom_survey_types ORDER BY created_at ASC');
  return (result.values || []) as CustomSurveyType[];
}

export async function createCustomSurveyType(name: string, unitName: string, formFields: string): Promise<CustomSurveyType> {
  const nowStr = new Date().toISOString();
  const item: CustomSurveyType = { id: uuidv4(), name, unit_name: unitName, form_fields: formFields, created_at: nowStr };
  if (memoryMode) { memoryStore.custom_survey_types.push(item); return item; }
  await db.run(
    'INSERT INTO custom_survey_types (id, name, unit_name, form_fields, created_at) VALUES (?, ?, ?, ?, ?)',
    [item.id, item.name, item.unit_name, item.form_fields, item.created_at]
  );
  return item;
}

export async function deleteCustomSurveyType(id: string): Promise<void> {
  if (memoryMode) { memoryStore.custom_survey_types = memoryStore.custom_survey_types.filter(t => t.id !== id); return; }
  await db.run('DELETE FROM custom_survey_types WHERE id = ?', [id]);
}

// ==================== 设置 CRUD ====================

const defaultSettings: AppSettings = {
  id: 'default',
  username: '',
  basemap_api_url: '',
  plant_id_api_url: '',
  plant_id_api_key: '',
  cover_id_api_url: '',
  cover_id_api_key: '',
  enable_gps_tracking: true,
  enable_ai_plant_id: true,
  enable_ai_cover_id: true,
  default_survey_type: 'vegetation',
  baidu_api_key: '',
  baidu_secret_key: '',
  weather_api_key: '',
  updated_at: new Date().toISOString(),
};

export async function getSettings(): Promise<AppSettings> {
  if (memoryMode) {
    if (!memoryStore.settings) { memoryStore.settings = { ...defaultSettings }; }
    return memoryStore.settings;
  }
  const result = await db.query('SELECT * FROM settings WHERE id = ?', ['default']);
  if (result.values && result.values.length > 0) {
    const row = result.values[0] as Record<string, unknown>;
    return {
      id: row.id as string,
      username: (row.username as string) || '',
      basemap_api_url: (row.basemap_api_url as string) || '',
      plant_id_api_url: (row.plant_id_api_url as string) || '',
      plant_id_api_key: (row.plant_id_api_key as string) || '',
      cover_id_api_url: (row.cover_id_api_url as string) || '',
      cover_id_api_key: (row.cover_id_api_key as string) || '',
      enable_gps_tracking: (row.enable_gps_tracking as number) === 1,
      enable_ai_plant_id: (row.enable_ai_plant_id as number) === 1,
      enable_ai_cover_id: (row.enable_ai_cover_id as number) === 1,
      default_survey_type: (row.default_survey_type as string) || 'vegetation',
      baidu_api_key: (row.baidu_api_key as string) || '',
      baidu_secret_key: (row.baidu_secret_key as string) || '',
      weather_api_key: (row.weather_api_key as string) || '',
      updated_at: (row.updated_at as string) || '',
    };
  }
  await saveSettings(defaultSettings);
  return { ...defaultSettings };
}

export async function saveSettings(settings: Partial<AppSettings>): Promise<void> {
  const nowStr = new Date().toISOString();
  const current = await getSettings();
  const merged = { ...current, ...settings, updated_at: nowStr };
  if (memoryMode) { memoryStore.settings = merged; return; }
  await db.run(
    `INSERT OR REPLACE INTO settings (id, username, basemap_api_url, plant_id_api_url, plant_id_api_key, cover_id_api_url, cover_id_api_key, enable_gps_tracking, enable_ai_plant_id, enable_ai_cover_id, default_survey_type, baidu_api_key, baidu_secret_key, weather_api_key, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      merged.id, merged.username, merged.basemap_api_url,
      merged.plant_id_api_url, merged.plant_id_api_key,
      merged.cover_id_api_url, merged.cover_id_api_key,
      merged.enable_gps_tracking ? 1 : 0,
      merged.enable_ai_plant_id ? 1 : 0,
      merged.enable_ai_cover_id ? 1 : 0,
      merged.default_survey_type,
      merged.baidu_api_key || '', merged.baidu_secret_key || '',
      merged.weather_api_key || '', merged.updated_at,
    ]
  );
}

// ==================== 统计查询 ====================

export async function getSurveyStats(surveyId: string): Promise<{
  totalQuadrats: number; totalSpecies: number; totalPlants: number; totalPhotos: number;
}> {
  if (memoryMode) {
    const quadrats = memoryStore.quadrats.filter(q => q.survey_id === surveyId);
    const quadratIds = quadrats.map(q => q.id);
    const plantRecords = memoryStore.plant_records.filter(p => quadratIds.includes(p.quadrat_id));
    const speciesSet = new Set(plantRecords.map(p => p.species_name));
    const photos = memoryStore.photos.filter(p => quadratIds.includes(p.quadrat_id || ''));
    return {
      totalQuadrats: quadrats.length,
      totalSpecies: speciesSet.size,
      totalPlants: plantRecords.reduce((sum, p) => sum + p.count, 0),
      totalPhotos: photos.length,
    };
  }
  const qResult = await db.query('SELECT COUNT(*) as cnt FROM quadrats WHERE survey_id = ?', [surveyId]);
  const totalQuadrats = (qResult.values?.[0] as Record<string, unknown>)?.cnt as number || 0;
  const quadrats = await db.query('SELECT id FROM quadrats WHERE survey_id = ?', [surveyId]);
  const quadratIds = (quadrats.values || []).map((q: Record<string, unknown>) => q.id as string);
  let totalSpecies = 0, totalPlants = 0, totalPhotos = 0;
  if (quadratIds.length > 0) {
    const placeholders = quadratIds.map(() => '?').join(',');
    const pResult = await db.query(`SELECT COUNT(DISTINCT species_name) as cnt FROM plant_records WHERE quadrat_id IN (${placeholders})`, quadratIds);
    totalSpecies = (pResult.values?.[0] as Record<string, unknown>)?.cnt as number || 0;
    const plResult = await db.query(`SELECT COALESCE(SUM(count), 0) as cnt FROM plant_records WHERE quadrat_id IN (${placeholders})`, quadratIds);
    totalPlants = (plResult.values?.[0] as Record<string, unknown>)?.cnt as number || 0;
    const phResult = await db.query(`SELECT COUNT(*) as cnt FROM photos WHERE quadrat_id IN (${placeholders})`, quadratIds);
    totalPhotos = (phResult.values?.[0] as Record<string, unknown>)?.cnt as number || 0;
  }
  return { totalQuadrats, totalSpecies, totalPlants, totalPhotos };
}
