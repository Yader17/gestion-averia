import { Asset } from 'expo-asset';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';
import { REPORT_LOGO_FALLBACK_DATA_URI } from '../constants/reportLogoDataUri';
import { Averia, getAveriaPhotos } from '../types/averia';
import { photoUriToDataUri } from './photoService';

const REPORT_LOGO = require('../../assets/tenax-logo-def.png');

type PhotoReportItem = {
  caption: string;
  dataUri: string;
};

export async function exportAveriaReportPdf(averia: Averia): Promise<string | void> {
  const logoDataUri = await loadLogoDataUri();
  const photoItems = await loadPhotoItems(averia);
  const html = buildReportHtml(averia, logoDataUri, photoItems);

  const generatePdf =
    typeof window !== 'undefined' ? window.electronApi?.generatePdf : undefined;
  if (typeof generatePdf === 'function') {
    return generatePdf(html, `reporte-averia-${averia.id || Date.now()}.pdf`);
  }

  if (Platform.OS === 'web') {
    const reportWindow = window.open('', '_blank', 'noopener,noreferrer');
    if (!reportWindow) {
      throw new Error('No se pudo abrir la vista previa del reporte.');
    }

    reportWindow.document.open();
    reportWindow.document.write(html);
    reportWindow.document.close();
    reportWindow.focus();

    setTimeout(() => {
      reportWindow.print();
    }, 400);

    return;
  }

  const file = await Print.printToFileAsync({
    html,
    width: 794,
    height: 1123,
    margins: {
      left: 24,
      right: 24,
      top: 24,
      bottom: 24,
    },
  });

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(file.uri, {
      mimeType: 'application/pdf',
      dialogTitle: 'Reporte de avería',
    });
  }

  return file.uri;
}

async function loadLogoDataUri(): Promise<string> {
  try {
    const [asset] = await Asset.loadAsync(REPORT_LOGO);
    const dataUri = await convertAssetToDataUri(asset);
    if (dataUri) {
      return dataUri;
    }
  } catch {
    // Fall through to the embedded logo when Android exposes an unreadable asset URI.
  }

  return REPORT_LOGO_FALLBACK_DATA_URI;
}

async function convertAssetToDataUri(asset: Asset): Promise<string | null> {
  const candidates = [asset.localUri, asset.uri].filter(
    (value): value is string => Boolean(value)
  );

  for (const candidate of candidates) {
    try {
      return await photoUriToDataUri(candidate, 'image/png');
    } catch {
      continue;
    }
  }

  return null;
}

async function loadPhotoItems(averia: Averia): Promise<PhotoReportItem[]> {
  const photos = getAveriaPhotos(averia);
  const photoItems = await Promise.all(
    photos.map(async (photo, index) => {
      try {
        return {
          caption: photo.fileName || `Foto ${index + 1}`,
          dataUri: await photoUriToDataUri(photo.uri, photo.mimeType),
        };
      } catch {
        return null;
      }
    })
  );

  return photoItems.filter((item): item is PhotoReportItem => item !== null);
}

function buildReportHtml(
  averia: Averia,
  logoDataUri: string,
  photoItems: PhotoReportItem[]
): string {
  const fieldRows = [
    { label: 'Fecha', value: averia.fecha },
    { label: 'Nº Bastidor', value: averia.numeroBastidor },
    { label: 'Tipo de Avería', value: averia.tipoAveria },
    { label: 'Intervención', value: averia.intervencion },
    { label: 'Lugar', value: averia.lugar },
    { label: 'Estado', value: averia.solucionado ? 'Solucionado' : 'Pendiente' },
  ]
    .map(
      (row) => `
        <tr>
          <th>${escapeHtml(row.label)}</th>
          <td>${escapeHtml(row.value || 'No especificado')}</td>
        </tr>
      `
    )
    .join('');

  const annexSection =
    photoItems.length === 0
      ? '<p class="empty-annex">Sin fotos adjuntas.</p>'
      : photoItems
          .map(
            (photo, index) => `
              <div class="photo-card">
                <img src="${photo.dataUri}" alt="Foto ${index + 1}" />
                <div class="photo-caption">${escapeHtml(photo.caption)}</div>
              </div>
            `
          )
          .join('');

  return `
    <!DOCTYPE html>
    <html lang="es">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Reporte de Avería</title>
        <style>
          @page {
            size: A4;
            margin: 16mm;
          }

          * {
            box-sizing: border-box;
          }

          body {
            font-family: Arial, Helvetica, sans-serif;
            color: #1f2933;
            margin: 0;
            padding: 0;
            background: #ffffff;
          }

          .page {
            display: flex;
            flex-direction: column;
            gap: 18px;
          }

          .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 3px solid #114b8b;
            padding-bottom: 12px;
            gap: 24px;
          }

          .header-copy {
            flex: 1;
          }

          .title {
            margin: 0;
            font-size: 26px;
            letter-spacing: 0.08em;
            color: #114b8b;
          }

          .subtitle {
            margin: 8px 0 0;
            font-size: 13px;
            color: #52606d;
          }

          .logo {
            width: 240px;
            max-width: 42%;
            object-fit: contain;
          }

          .section {
            border: 1px solid #d9e2ec;
            border-radius: 14px;
            padding: 16px 18px;
            page-break-inside: avoid;
          }

          .section-title {
            margin: 0 0 14px;
            font-size: 16px;
            font-weight: 700;
            color: #102a43;
          }

          table {
            width: 100%;
            border-collapse: collapse;
          }

          th,
          td {
            padding: 10px 12px;
            border-bottom: 1px solid #e5e7eb;
            text-align: left;
            vertical-align: top;
            font-size: 13px;
          }

          th {
            width: 180px;
            color: #52606d;
            font-weight: 700;
            background: #f8fbff;
          }

          td {
            color: #102a43;
          }

          .description {
            white-space: pre-wrap;
            line-height: 1.6;
            font-size: 14px;
          }

          .annex-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
            gap: 14px;
          }

          .photo-card {
            border: 1px solid #d9e2ec;
            border-radius: 12px;
            padding: 10px;
            display: flex;
            flex-direction: column;
            gap: 8px;
            page-break-inside: avoid;
          }

          .photo-card img {
            width: 100%;
            height: 180px;
            object-fit: cover;
            border-radius: 8px;
            background: #f3f4f6;
          }

          .photo-caption {
            font-size: 12px;
            color: #52606d;
          }

          .empty-annex {
            margin: 0;
            color: #7b8794;
            font-size: 13px;
          }
        </style>
      </head>
      <body>
        <div class="page">
          <header class="header">
            <div class="header-copy">
              <h1 class="title">REPORTE DE AVERIA</h1>
              <p class="subtitle">Generado desde Gestión de Averías. Fecha de emisión: ${escapeHtml(new Date().toLocaleDateString('es-ES'))}</p>
            </div>
            <img class="logo" src="${logoDataUri}" alt="Tenax" />
          </header>

          <section class="section">
            <h2 class="section-title">Datos generales</h2>
            <table>
              <tbody>${fieldRows}</tbody>
            </table>
          </section>

          <section class="section">
            <h2 class="section-title">Descripción / Observaciones</h2>
            <div class="description">${escapeHtml(averia.observacion || 'Sin observaciones registradas.')}</div>
          </section>

          <section class="section">
            <h2 class="section-title">Anexo fotográfico</h2>
            <div class="annex-grid">${annexSection}</div>
          </section>
        </div>
      </body>
    </html>
  `;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/\n/g, '<br />');
}