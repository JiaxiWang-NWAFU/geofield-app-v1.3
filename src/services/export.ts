/**
 * 数据导出服务 v1.3-fix
 * 修复: Word导出兼容性, Excel嵌入照片
 */

import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  WidthType, BorderStyle, AlignmentType, HeadingLevel,
  Header, Footer, PageNumber,
} from 'docx';
import ExcelJS from 'exceljs';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import type { ExportOptions, Survey, Quadrat, PlantRecord, Photo } from '../types';
import * as db from './database';
import { formatDate } from '../utils/helpers';

// ==================== Word 导出 ====================

export async function exportToWord(options: ExportOptions): Promise<string> {
  let surveys: Survey[];

  if (options.survey_id) {
    const survey = await db.getSurveyById(options.survey_id);
    surveys = survey ? [survey] : [];
  } else {
    surveys = await db.getAllSurveys();
  }

  const children: (Paragraph | Table)[] = [];

  // 封面标题
  children.push(new Paragraph({
    heading: HeadingLevel.TITLE,
    alignment: AlignmentType.CENTER,
    spacing: { after: 400 },
    children: [new TextRun({ text: '野外调查助手 - 野外工作日志', bold: true, size: 36 })],
  }));

  children.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 200 },
    children: [new TextRun({ text: `导出时间：${formatDate(new Date(), 'YYYY-MM-DD HH:mm')}`, size: 20, color: '666666' })],
  }));

  children.push(new Paragraph({ children: [] }));

  for (const survey of surveys) {
    // 调查项目标题
    children.push(new Paragraph({
      heading: HeadingLevel.HEADING_1,
      children: [new TextRun({ text: `调查项目：${survey.name}`, bold: true, size: 28 })],
    }));

    if (survey.description) {
      children.push(new Paragraph({
        children: [new TextRun({ text: survey.description, size: 20, italics: true, color: '666666' })],
      }));
    }

    children.push(new Paragraph({
      children: [new TextRun({ text: `创建时间：${formatDate(survey.created_at)}`, size: 20 })],
    }));

    // 分隔线
    children.push(createSeparator());

    // 获取样方
    const quadrats = await db.getQuadratsBySurveyId(survey.id);

    if (options.include_stats) {
      const stats = await db.getSurveyStats(survey.id);
      children.push(new Paragraph({
        spacing: { before: 200, after: 100 },
        children: [new TextRun({ text: `数据概览：样方 ${stats.totalQuadrats} 个 | 物种 ${stats.totalSpecies} 种 | 总株数 ${stats.totalPlants} | 照片 ${stats.totalPhotos} 张`, size: 20 })],
      }));
    }

    for (const quadrat of quadrats) {
      // 样方信息
      children.push(new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun({ text: `样方：${quadrat.name}`, bold: true, size: 24 })],
      }));

      // 样方基本信息表
      const infoRows: TableRow[] = [
        createInfoRow('样方名称', quadrat.name, '样方类型', quadrat.type),
        createInfoRow('调查日期', quadrat.survey_date || '-', '天气', quadrat.weather || '-'),
        createInfoRow('坐标', quadrat.latitude ? `${quadrat.latitude.toFixed(6)}, ${quadrat.longitude?.toFixed(6)}` : '-', '海拔', quadrat.elevation ? `${quadrat.elevation}m` : '-'),
        createInfoRow('坡度', quadrat.slope ? `${quadrat.slope}°` : '-', '坡向', formatAspect(quadrat.aspect)),
        createInfoRow('调查人员', quadrat.surveyors || '-', '植被盖度', quadrat.vegetation_cover ? `${quadrat.vegetation_cover}%` : '-'),
      ];

      if (quadrat.notes) {
        infoRows.push(createInfoRow('备注', quadrat.notes, '', ''));
      }

      children.push(new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: infoRows,
      }));

      children.push(new Paragraph({ spacing: { before: 100 }, children: [] }));

      // 植物清单
      const plantRecords = await db.getPlantRecordsByQuadratId(quadrat.id);

      if (plantRecords.length > 0) {
        children.push(new Paragraph({
          spacing: { before: 200, after: 100 },
          children: [new TextRun({ text: '植物清单', bold: true, size: 22 })],
        }));

        children.push(createPlantTable(plantRecords));

        // 汇总
        const totalCount = plantRecords.reduce((sum, p) => sum + p.count, 0);
        children.push(new Paragraph({
          spacing: { before: 100 },
          children: [new TextRun({ text: `合计：${plantRecords.length} 种，共 ${totalCount} 株`, size: 20, bold: true })],
        }));
      }

      // 样方照片 (文字描述)
      if (options.include_photos) {
        const quadratPhotos = await db.getQuadratPhotos(quadrat.id);
        if (quadratPhotos.length > 0) {
          children.push(new Paragraph({
            spacing: { before: 200, after: 100 },
            children: [new TextRun({ text: `样方照片（${quadratPhotos.length} 张）`, bold: true, size: 22 })],
          }));

          for (const qp of quadratPhotos) {
            children.push(new Paragraph({
              children: [new TextRun({ text: `• ${qp.name || '照片'}`, size: 18, color: '666666' })],
            }));
          }
        }

        // 植物照片 (文字描述)
        for (const plant of plantRecords) {
          const photos = await db.getPhotosByPlantRecordId(plant.id);
          if (photos.length > 0) {
            children.push(new Paragraph({
              children: [new TextRun({ text: `${plant.species_name} 照片（${photos.length} 张）`, size: 18, color: '666666' })],
            }));
          }
        }
      }

      children.push(createSeparator());
    }
  }

  if (surveys.length === 0) {
    children.push(new Paragraph({
      children: [new TextRun({ text: '暂无调查数据', size: 24, color: '999999' })],
    }));
  }

  const doc = new Document({
    creator: '野外调查助手',
    title: '野外工作日志',
    sections: [{
      headers: {
        default: new Header({
          children: [new Paragraph({
            alignment: AlignmentType.RIGHT,
            children: [new TextRun({ text: '野外调查助手 - 工作日志', size: 16, color: '999999' })],
          })],
        }),
      },
      footers: {
        default: new Footer({
          children: [new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({ text: '第 ', size: 16 }),
              new TextRun({ children: [PageNumber.CURRENT], size: 16 }),
              new TextRun({ text: ' 页', size: 16 }),
            ],
          })],
        }),
      },
      children,
    }],
  });

  const buffer = await Packer.toBuffer(doc);
  const fileName = `野外调查助手_工作日志_${formatDateForFile()}.docx`;

  if (Capacitor.isNativePlatform()) {
    const base64 = arrayBufferToBase64(buffer);
    const result = await Filesystem.writeFile({
      path: fileName,
      data: base64,
      directory: Directory.Documents,
    });

    try {
      await Share.share({
        title: '野外调查助手 工作日志',
        text: '导出的 Word 文档',
        url: result.uri,
        dialogTitle: '分享文档',
      });
    } catch {
      // 分享取消不报错
    }

    return result.uri;
  } else {
    const blob = new Blob([buffer as BlobPart], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
    downloadBlobClient(blob, fileName);
    return fileName;
  }
}

// ==================== Excel 导出 ====================

/**
 * 将照片路径转为base64 (用于Excel嵌入图片)
 */
async function photoToBase64(filePath: string): Promise<string | null> {
  try {
    if (Capacitor.isNativePlatform()) {
      // 原生平台: 通过 Filesystem 读取
      const result = await Filesystem.readFile({
        path: filePath,
        directory: Directory.External,
      });
      return result.data;
    } else {
      // 浏览器: 通过 fetch 读取
      const response = await fetch(filePath);
      if (!response.ok) return null;
      const blob = await response.blob();
      return new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const dataUrl = reader.result as string;
          const commaIdx = dataUrl.indexOf(',');
          resolve(commaIdx !== -1 ? dataUrl.substring(commaIdx + 1) : dataUrl);
        };
        reader.onerror = () => reject(new Error('读取照片失败'));
        reader.readAsDataURL(blob);
      });
    }
  } catch {
    return null;
  }
}

export async function exportToExcel(options: ExportOptions): Promise<string> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = '野外调查助手';
  workbook.created = new Date();

  let surveys: Survey[];

  if (options.survey_id) {
    const survey = await db.getSurveyById(options.survey_id);
    surveys = survey ? [survey] : [];
  } else {
    surveys = await db.getAllSurveys();
  }

  for (const survey of surveys) {
    const quadrats = await db.getQuadratsBySurveyId(survey.id);

    for (const quadrat of quadrats) {
      const safeName = quadrat.name.replace(/[\\\/\*\?\[\]:]/g, '_').substring(0, 30);
      const worksheet = workbook.addWorksheet(safeName);

      // 样方信息
      worksheet.addRow(['样方名称', quadrat.name]);
      worksheet.addRow(['调查日期', quadrat.survey_date || '-']);
      worksheet.addRow(['调查人员', quadrat.surveyors || '-']);
      worksheet.addRow(['天气', quadrat.weather || '-']);
      worksheet.addRow(['坐标', quadrat.latitude ? `${quadrat.latitude.toFixed(6)}, ${quadrat.longitude?.toFixed(6)}` : '-']);
      worksheet.addRow(['海拔', quadrat.elevation ? `${quadrat.elevation}m` : '-']);
      worksheet.addRow(['坡度', quadrat.slope ? `${quadrat.slope}°` : '-']);
      worksheet.addRow(['坡向', formatAspect(quadrat.aspect)]);
      worksheet.addRow(['植被盖度', quadrat.vegetation_cover ? `${quadrat.vegetation_cover}%` : '-']);
      worksheet.addRow(['结皮盖度', quadrat.crust_cover ? `${quadrat.crust_cover}%` : '-']);
      if (quadrat.notes) {
        worksheet.addRow(['备注', quadrat.notes]);
      }
      worksheet.addRow([]);

      // 植物清单表头
      const headerRow = worksheet.addRow([
        '序号', '物种名称', '拉丁学名', '科', '属', '数量',
        '最大株高(cm)', '平均株高(cm)', '分盖度(%)', '备注'
      ]);
      headerRow.font = { bold: true };
      headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE8F5E9' },
      };

      // 植物数据
      const plantRecords = await db.getPlantRecordsByQuadratId(quadrat.id);
      plantRecords.forEach((plant: PlantRecord, index: number) => {
        worksheet.addRow([
          index + 1,
          plant.species_name,
          plant.latin_name || '',
          plant.family || '',
          plant.genus || '',
          plant.count,
          plant.max_height || '',
          plant.avg_height || '',
          plant.cover_percent || '',
          plant.notes || '',
        ]);
      });

      // 汇总行
      worksheet.addRow([]);
      const totalCount = plantRecords.reduce((sum: number, p: PlantRecord) => sum + p.count, 0);
      worksheet.addRow([
        '合计', '', '', '', '', totalCount, '', '', '', `共 ${plantRecords.length} 种`
      ]);

      // 调整列宽
      worksheet.columns = [
        { width: 6 }, { width: 16 }, { width: 20 }, { width: 12 },
        { width: 12 }, { width: 8 }, { width: 12 }, { width: 12 },
        { width: 10 }, { width: 20 },
      ];

      // === 嵌入照片 ===
      if (options.include_photos) {
        // 收集所有照片
        const allPhotos: { plantName: string; filePath: string; photoName: string }[] = [];

        // 样方照片
        const quadratPhotos = await db.getQuadratPhotos(quadrat.id);
        for (const qp of quadratPhotos) {
          allPhotos.push({ plantName: '样方照片', filePath: qp.file_path, photoName: qp.name || '样方照片' });
        }

        // 植物照片
        for (const plant of plantRecords) {
          const photos = await db.getPhotosByPlantRecordId(plant.id);
          for (const photo of photos) {
            allPhotos.push({ plantName: plant.species_name, filePath: photo.file_path, photoName: photo.name || '照片' });
          }
        }

        // 尝试嵌入照片到Excel
        if (allPhotos.length > 0) {
          // 添加一个空行分隔
          worksheet.addRow([]);
          const photoHeaderRow = worksheet.addRow(['照片记录']);
          photoHeaderRow.font = { bold: true, size: 14 };

          let photoRowIndex = worksheet.rowCount + 1;

          for (const photoInfo of allPhotos) {
            // 添加照片描述行
            const descRow = worksheet.addRow([photoInfo.plantName, photoInfo.photoName]);
            const currentRowNum = worksheet.rowCount;

            // 尝试读取并嵌入图片
            const base64Data = await photoToBase64(photoInfo.filePath);
            if (base64Data) {
              try {
                const imageId = workbook.addImage({
                  base64: base64Data,
                  extension: 'jpeg',
                });
                // 嵌入图片到描述行右侧 (C列到D列, 3行高度)
                worksheet.addImage(imageId, {
                  tl: { col: 2.0, row: currentRowNum - 1 } as any,
                  ext: { width: 200, height: 150 },
                });
                // 设置行高以容纳图片
                descRow.height = 115;
              } catch {
                // 图片嵌入失败，保留文字描述
              }
            }
          }
        }
      }
    }
  }

  if (workbook.worksheets.length === 0) {
    const ws = workbook.addWorksheet('暂无数据');
    ws.addRow(['暂无调查数据']);
  }

  // 使用 writeBuffer 生成数据
  const buffer = await workbook.xlsx.writeBuffer();
  const fileName = `野外调查助手_调查数据_${formatDateForFile()}.xlsx`;

  if (Capacitor.isNativePlatform()) {
    const base64 = arrayBufferToBase64(buffer);
    const result = await Filesystem.writeFile({
      path: fileName,
      data: base64,
      directory: Directory.Documents,
    });

    try {
      await Share.share({
        title: '野外调查助手 调查数据',
        text: '导出的 Excel 数据',
        url: result.uri,
        dialogTitle: '分享数据文件',
      });
    } catch {
      // 分享取消不报错
    }

    return result.uri;
  } else {
    const blob = new Blob([buffer as BlobPart], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    downloadBlobClient(blob, fileName);
    return fileName;
  }
}

// ==================== 辅助函数 ====================

function formatAspect(aspect: number | undefined): string {
  if (aspect === undefined || aspect === null) return '-';
  return `${aspect}°`;
}

function createPlantTable(records: PlantRecord[]): Table {
  const headerRow = new TableRow({
    children: [
      createTableCell('序号', true),
      createTableCell('物种名称', true),
      createTableCell('拉丁学名', true),
      createTableCell('数量', true),
      createTableCell('株高(cm)', true),
      createTableCell('盖度(%)', true),
    ],
    tableHeader: true,
  });

  const dataRows = records.map((record: PlantRecord, index: number) =>
    new TableRow({
      children: [
        createTableCell(String(index + 1)),
        createTableCell(record.species_name),
        createTableCell(record.latin_name || '-'),
        createTableCell(String(record.count)),
        createTableCell(record.avg_height ? String(record.avg_height) : '-'),
        createTableCell(record.cover_percent ? String(record.cover_percent) : '-'),
      ],
    })
  );

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [headerRow, ...dataRows],
  });
}

function createTableCell(text: string, bold: boolean = false): TableCell {
  return new TableCell({
    children: [new Paragraph({ children: [new TextRun({ text, bold, size: 20 })] })],
    width: { size: 0, type: WidthType.AUTO },
  });
}

function createInfoRow(label1: string, value1: string, label2: string, value2: string): TableRow {
  return new TableRow({
    children: [
      createTableCell(label1, true),
      createTableCell(value1),
      createTableCell(label2, true),
      createTableCell(value2),
    ],
  });
}

function createSeparator(): Paragraph {
  return new Paragraph({
    border: { bottom: { color: 'CCCCCC', space: 1, style: BorderStyle.SINGLE, size: 6 } },
    spacing: { before: 200, after: 200 },
  });
}

function formatDateForFile(): string {
  const now = new Date();
  return `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
}

function arrayBufferToBase64(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function downloadBlobClient(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
