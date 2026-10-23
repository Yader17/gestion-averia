import { createHash } from 'node:crypto';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';
import { collection, doc, getDocs, getFirestore, writeBatch } from 'firebase/firestore';
import XLSX from 'xlsx';

const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyAHGL3Ou0g-NkOSH5kO1iFY5ZzTh7uZCrs',
  authDomain: 'averias-2026yj.firebaseapp.com',
  projectId: 'averias-2026yj',
  storageBucket: 'averias-2026yj.firebasestorage.app',
  messagingSenderId: '987360820448',
  appId: '1:987360820448:web:01e5228f87ec6e1274a485',
};

const WORKSPACE_ID = 'averias-2026yj';
const DEFAULT_EXCEL_PATH = '..\\Gestion de averias_form.xlsm';
const excelPathArg = process.argv[2]?.trim();
const EXCEL_PATH = excelPathArg || DEFAULT_EXCEL_PATH;

const HEADER_ALIASES = {
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

async function main() {
  const workbook = XLSX.readFile(EXCEL_PATH);
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    throw new Error('El Excel no contiene hojas.');
  }

  const sheet = workbook.Sheets[firstSheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: '',
    blankrows: false,
    raw: true,
  });

  const headerRow = (rows[0] ?? []).map((cell) => normalizeHeader(String(cell ?? '')));
  const dataRows = rows.slice(1);
  const columnMap = Object.fromEntries(
    Object.entries(HEADER_ALIASES).map(([key, aliases]) => [key, findColumnIndex(headerRow, aliases)])
  );

  const averias = dataRows
    .map((row) => rowToAveria(row, columnMap))
    .filter((averia) => averia.fecha !== '' || averia.observacion !== '');

  const app = initializeApp(FIREBASE_CONFIG);
  const auth = getAuth(app);
  await signInAnonymously(auth);

  const firestore = getFirestore(app);
  const collectionRef = collection(firestore, 'workspaces', WORKSPACE_ID, 'averias');
  const existingSnapshot = await getDocs(collectionRef);

  const batch = writeBatch(firestore);
  existingSnapshot.docs.forEach((entry) => batch.delete(entry.ref));

  averias.forEach((averia) => {
    const averiaRef = doc(firestore, 'workspaces', WORKSPACE_ID, 'averias', averia.id);
    batch.set(averiaRef, averia, { merge: true });
  });

  await batch.commit();

  console.log(
    JSON.stringify(
      {
        imported: averias.length,
        excelPath: EXCEL_PATH,
        workspaceId: WORKSPACE_ID,
        collectionPath: `workspaces/${WORKSPACE_ID}/averias`,
      },
      null,
      2
    )
  );
}

function normalizeHeader(value) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function findColumnIndex(headers, aliases) {
  for (const alias of aliases) {
    const index = headers.indexOf(normalizeHeader(alias));
    if (index !== -1) {
      return index;
    }
  }

  return -1;
}

function getCellValue(row, index) {
  if (index < 0) {
    return '';
  }

  return row[index] ?? '';
}

function excelSerialToDate(serial) {
  const excelEpoch = new Date(Date.UTC(1899, 11, 30));
  const wholeDays = Math.floor(Number(serial));
  const date = new Date(excelEpoch.getTime() + wholeDays * 24 * 60 * 60 * 1000);
  const day = String(date.getUTCDate()).padStart(2, '0');
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const year = date.getUTCFullYear();
  return `${day}/${month}/${year}`;
}

function normalizeAveriaType(raw) {
  const validTypes = [
    'Mecanica',
    'Electrica',
    'Canbus',
    'Actuadores',
    'Direccion',
    'Calibracion',
    'Bateria',
    'Inversor',
    'Software',
    'Motores',
    'Cargador',
    'Otro',
  ];

  const found = validTypes.find(
    (type) => type.toLowerCase() === String(raw ?? '').trim().toLowerCase()
  );

  return found ?? 'Otro';
}

function parseCoordinate(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const parsed = Number(String(value).trim().replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : null;
}

function stableId(parts) {
  return createHash('sha1').update(parts.join('|')).digest('hex').slice(0, 20);
}

function rowToAveria(row, columnMap) {
  const fechaRaw = getCellValue(row, columnMap.fecha);
  const fecha = typeof fechaRaw === 'number' ? excelSerialToDate(fechaRaw) : String(fechaRaw ?? '').trim();
  const numeroBastidor = String(getCellValue(row, columnMap.numeroBastidor) ?? '').trim();
  const tipoAveria = normalizeAveriaType(getCellValue(row, columnMap.tipoAveria));
  const intervencion = String(getCellValue(row, columnMap.intervencion) ?? '').trim();
  const lugar = String(getCellValue(row, columnMap.lugar) ?? '').trim();
  const observacion = String(getCellValue(row, columnMap.observacion) ?? '').trim();
  const solucionadoRaw = String(getCellValue(row, columnMap.solucionado) ?? '').trim().toUpperCase();
  const latitud = parseCoordinate(getCellValue(row, columnMap.latitud));
  const longitud = parseCoordinate(getCellValue(row, columnMap.longitud));
  const ubicacionNombre = String(getCellValue(row, columnMap.ubicacionNombre) ?? '').trim();

  const ubicacion =
    latitud === null || longitud === null
      ? null
      : {
          latitude: latitud,
          longitude: longitud,
          displayName: ubicacionNombre || lugar || 'Ubicación sin nombre',
        };

  return {
    id: stableId([fecha, numeroBastidor, tipoAveria, intervencion, lugar, observacion]),
    fecha,
    numeroBastidor,
    tipoAveria,
    intervencion,
    lugar,
    ubicacion,
    observacion,
    solucionado: solucionadoRaw === 'SI' || solucionadoRaw === 'SÍ',
    fotos: [],
  };
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
