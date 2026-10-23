import * as XLSX from 'xlsx';
import { Averia, AveriaType, AVERIA_TYPES } from '../types/averia';
import { excelSerialToDate } from '../utils/dateUtils';
import { generateId } from '../utils/idGenerator';
import { EXCEL_HEADERS } from '../constants/tableHeaders';

const MAX_EXCEL_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const MAX_EXCEL_ROWS = 5000;

const HEADER_ALIASES: Record<string, string[]> = {
  fecha: ['fecha'],
  numeroBastidor: ['nº bastidor', 'no bastidor', 'numero bastidor', 'n bastidor'],
  tipoAveria: ['tipo de avería', 'tipo de averia'],
  intervencion: ['intervención', 'intervencion'],
  lugar: ['lugar'],
  observacion: ['observación', 'observacion'],
  solucionado: ['solucionado'],
  ubicacionNombre: ['ubicación real', 'ubicacion real', 'direccion real'],
  latitud: ['latitud', 'latitude'],
  longitud: ['longitud', 'longitude'],
};

type RowValue = string | number | boolean | Date | null | undefined;
type ExcelRow = RowValue[];

/**
 * Parses an Excel file (ArrayBuffer) and returns an array of Averia records.
 */
export function parseExcelBuffer(buffer: ArrayBuffer): Averia[] {
  if (buffer.byteLength > MAX_EXCEL_FILE_SIZE_BYTES) {
    throw new Error('El archivo Excel es demasiado grande. El máximo permitido es 10 MB.');
  }

  const workbook = XLSX.read(buffer, { type: 'array' });
  const firstSheetName = workbook.SheetNames[0];

  if (!firstSheetName) {
    throw new Error('El archivo Excel no contiene hojas.');
  }

  const worksheet = workbook.Sheets[firstSheetName];

  if (!worksheet) {
    throw new Error('No se pudo leer la hoja del archivo Excel.');
  }

  const rows = XLSX.utils.sheet_to_json<ExcelRow>(worksheet, {
    header: 1,
    defval: '',
    blankrows: false,
    raw: true,
  });

  if (rows.length === 0) {
    return [];
  }

  if (rows.length > MAX_EXCEL_ROWS + 1) {
    throw new Error(`El archivo contiene demasiadas filas. El máximo permitido es ${MAX_EXCEL_ROWS}.`);
  }

  const headerRow = rows[0] ?? [];
  const columnMap = buildColumnMap(headerRow);
  const dataRows = rows.slice(1, MAX_EXCEL_ROWS + 1);

  return dataRows
    .map((row) => rowToAveria(row, columnMap))
    .filter(isValidAveria);
}

/**
 * Converts raw row data to an Averia object.
 */
function rowToAveria(
  row: ExcelRow,
  columnMap: Record<keyof typeof HEADER_ALIASES, number>
): Averia {
  const fecha = parseFechaField(getCellValue(row, columnMap.fecha));
  const numeroBastidor = String(getCellValue(row, columnMap.numeroBastidor) ?? '').trim();
  const tipoAveriaRaw = String(getCellValue(row, columnMap.tipoAveria) ?? '').trim();
  const intervencion = String(getCellValue(row, columnMap.intervencion) ?? '').trim();
  const lugar = String(getCellValue(row, columnMap.lugar) ?? '').trim();
  const observacion = String(getCellValue(row, columnMap.observacion) ?? '').trim();
  const solucionadoRaw = String(getCellValue(row, columnMap.solucionado) ?? '').trim().toUpperCase();
  const ubicacion = parseLocation(row, columnMap, lugar);

  return {
    id: generateId(),
    fecha,
    numeroBastidor,
    tipoAveria: normalizeAveriaType(tipoAveriaRaw),
    intervencion,
    lugar,
    ubicacion,
    observacion,
    solucionado: solucionadoRaw === 'SI' || solucionadoRaw === 'SÍ',
    fotos: [],
  };
}

function buildColumnMap(headerRow: ExcelRow): Record<keyof typeof HEADER_ALIASES, number> {
  const normalizedHeaders = headerRow.map((cell) => normalizeHeader(String(cell ?? '')));

  return {
    fecha: findColumnIndex(normalizedHeaders, HEADER_ALIASES.fecha),
    numeroBastidor: findColumnIndex(normalizedHeaders, HEADER_ALIASES.numeroBastidor),
    tipoAveria: findColumnIndex(normalizedHeaders, HEADER_ALIASES.tipoAveria),
    intervencion: findColumnIndex(normalizedHeaders, HEADER_ALIASES.intervencion),
    lugar: findColumnIndex(normalizedHeaders, HEADER_ALIASES.lugar),
    observacion: findColumnIndex(normalizedHeaders, HEADER_ALIASES.observacion),
    solucionado: findColumnIndex(normalizedHeaders, HEADER_ALIASES.solucionado),
    ubicacionNombre: findColumnIndex(normalizedHeaders, HEADER_ALIASES.ubicacionNombre),
    latitud: findColumnIndex(normalizedHeaders, HEADER_ALIASES.latitud),
    longitud: findColumnIndex(normalizedHeaders, HEADER_ALIASES.longitud),
  };
}

function findColumnIndex(headers: string[], aliases: string[]): number {
  for (const alias of aliases) {
    const index = headers.indexOf(normalizeHeader(alias));
    if (index !== -1) {
      return index;
    }
  }

  return -1;
}

function getCellValue(row: ExcelRow, index: number): RowValue {
  if (index < 0) {
    return '';
  }

  return row[index] ?? '';
}

function normalizeHeader(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/**
 * Parses the Fecha field which can be an Excel serial number or a date string.
 */
function parseFechaField(value: unknown): string {
  if (value === null || value === undefined || value === '') {
    return '';
  }

  if (typeof value === 'number') {
    return excelSerialToDate(value);
  }

  return String(value).trim();
}

/**
 * Normalizes a raw type string to a valid AveriaType.
 * Falls back to 'Otro' if the type is not recognized.
 */
function normalizeAveriaType(raw: string): AveriaType {
  const found = AVERIA_TYPES.find(
    (type) => type.toLowerCase() === raw.toLowerCase()
  );
  return found ?? 'Otro';
}

function parseLocation(
  row: ExcelRow,
  columnMap: Record<keyof typeof HEADER_ALIASES, number>,
  lugar: string
): Averia['ubicacion'] {
  const latitude = parseCoordinate(getCellValue(row, columnMap.latitud));
  const longitude = parseCoordinate(getCellValue(row, columnMap.longitud));

  if (latitude === null || longitude === null) {
    return null;
  }

  const displayName = String(getCellValue(row, columnMap.ubicacionNombre) ?? '').trim();

  return {
    latitude,
    longitude,
    displayName: displayName || lugar || 'Ubicación sin nombre',
  };
}

function parseCoordinate(value: RowValue): number | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const normalized = String(value).trim().replace(',', '.');
  const parsed = Number(normalized);

  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Basic validation: an Averia is valid if it has at least a fecha or observacion.
 */
function isValidAveria(averia: Averia): boolean {
  return averia.fecha !== '' || averia.observacion !== '';
}

/**
 * Exports an array of Averia records to an Excel ArrayBuffer.
 */
export function exportToExcelBuffer(averias: Averia[]): ArrayBuffer {
  const worksheetData = averias.map((averia) => ({
    [EXCEL_HEADERS[0]]: averia.fecha,
    [EXCEL_HEADERS[1]]: averia.numeroBastidor,
    [EXCEL_HEADERS[2]]: averia.tipoAveria,
    [EXCEL_HEADERS[3]]: averia.intervencion,
    [EXCEL_HEADERS[4]]: averia.lugar,
    [EXCEL_HEADERS[5]]: averia.observacion,
    [EXCEL_HEADERS[6]]: averia.solucionado ? 'SI' : 'NO',
    [EXCEL_HEADERS[7]]: averia.ubicacion?.displayName ?? '',
    [EXCEL_HEADERS[8]]: averia.ubicacion?.latitude ?? '',
    [EXCEL_HEADERS[9]]: averia.ubicacion?.longitude ?? '',
  }));

  const worksheet = XLSX.utils.json_to_sheet(worksheetData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Averias');

  const excelBuffer = XLSX.write(workbook, {
    bookType: 'xlsx',
    type: 'array',
  }) as ArrayBuffer;

  return excelBuffer;
}
