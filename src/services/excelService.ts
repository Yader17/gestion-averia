import * as XLSX from 'xlsx';
import { Averia, AveriaType, AVERIA_TYPES } from '../types/averia';
import { excelSerialToDate } from '../utils/dateUtils';
import { generateId } from '../utils/idGenerator';
import { EXCEL_HEADERS } from '../constants/tableHeaders';

/**
 * Parses an Excel file (ArrayBuffer) and returns an array of Averia records.
 */
export function parseExcelBuffer(buffer: ArrayBuffer): Averia[] {
  const workbook = XLSX.read(buffer, { type: 'array' });
  const firstSheetName = workbook.SheetNames[0];

  if (!firstSheetName) {
    throw new Error('El archivo Excel no contiene hojas.');
  }

  const worksheet = workbook.Sheets[firstSheetName];

  if (!worksheet) {
    throw new Error('No se pudo leer la hoja del archivo Excel.');
  }

  const rawData = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, {
    defval: '',
  });

  return rawData.map((row) => rowToAveria(row)).filter(isValidAveria);
}

/**
 * Converts raw row data to an Averia object.
 */
function rowToAveria(row: Record<string, unknown>): Averia {
  const fecha = parseFechaField(row['Fecha']);
  const numeroBastidor = String(row['Nº Bastidor'] ?? row['No Bastidor'] ?? '').trim();
  const tipoAveriaRaw = String(row['Tipo de Avería'] ?? row['Tipo de averia'] ?? row['Tipo de Averia'] ?? '').trim();
  const intervencion = String(row['Intervención'] ?? row['Intervencion'] ?? '').trim();
  const lugar = String(row['Lugar'] ?? '').trim();
  const observacion = String(row['Observación'] ?? row['Observacion'] ?? '').trim();
  const solucionadoRaw = String(row['Solucionado'] ?? '').trim().toUpperCase();

  return {
    id: generateId(),
    fecha,
    numeroBastidor,
    tipoAveria: normalizeAveriaType(tipoAveriaRaw),
    intervencion,
    lugar,
    observacion,
    solucionado: solucionadoRaw === 'SI' || solucionadoRaw === 'SÍ',
  };
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
