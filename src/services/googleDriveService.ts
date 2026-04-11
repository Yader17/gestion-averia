import { Platform } from 'react-native';
import * as LegacyFileSystem from 'expo-file-system/legacy';

const GOOGLE_DRIVE_API = 'https://www.googleapis.com/drive/v3';
const GOOGLE_DRIVE_UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3';

export type DriveFileInfo = {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime: string;
};

type DriveFileListResponse = {
  files: DriveFileInfo[];
};

/**
 * Lists Excel files from the user's Google Drive.
 */
export async function listExcelFiles(
  accessToken: string
): Promise<DriveFileInfo[]> {
  const query = encodeURIComponent(
    "(mimeType='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' or mimeType='application/vnd.ms-excel.sheet.macroEnabled.12' or mimeType='application/vnd.ms-excel') and trashed=false"
  );

  const response = await fetch(
    `${GOOGLE_DRIVE_API}/files?q=${query}&fields=files(id,name,mimeType,modifiedTime)&orderBy=modifiedTime desc&pageSize=20`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Error al listar archivos de Drive: ${errorText}`);
  }

  const data: DriveFileListResponse = await response.json();
  return data.files ?? [];
}

/**
 * Downloads a file from Google Drive and returns it as an ArrayBuffer.
 */
export async function downloadDriveFile(
  accessToken: string,
  fileId: string
): Promise<ArrayBuffer> {
  const response = await fetch(
    `${GOOGLE_DRIVE_API}/files/${encodeURIComponent(fileId)}?alt=media`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Error al descargar archivo de Drive: ${errorText}`);
  }

  return response.arrayBuffer();
}

/**
 * Uploads an ArrayBuffer as an Excel file to Google Drive.
 * If fileId is provided, updates the existing file. Otherwise creates new.
 */
export async function uploadToDrive(
  accessToken: string,
  buffer: ArrayBuffer,
  fileName: string,
  existingFileId?: string
): Promise<DriveFileInfo> {
  const metadata = {
    name: fileName,
    mimeType:
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  };

  const boundary = '-------GestionAveriasBoundary';
  const metadataJson = JSON.stringify(metadata);

  const uint8 = new Uint8Array(buffer);
  let binaryStr = '';
  for (let i = 0; i < uint8.length; i++) {
    binaryStr += String.fromCharCode(uint8[i]);
  }
  const base64Data = btoa(binaryStr);

  const body = [
    `--${boundary}`,
    'Content-Type: application/json; charset=UTF-8',
    '',
    metadataJson,
    `--${boundary}`,
    'Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'Content-Transfer-Encoding: base64',
    '',
    base64Data,
    `--${boundary}--`,
  ].join('\r\n');

  const url = existingFileId
    ? `${GOOGLE_DRIVE_UPLOAD_API}/files/${encodeURIComponent(existingFileId)}?uploadType=multipart&fields=id,name,mimeType,modifiedTime`
    : `${GOOGLE_DRIVE_UPLOAD_API}/files?uploadType=multipart&fields=id,name,mimeType,modifiedTime`;

  const method = existingFileId ? 'PATCH' : 'POST';

  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': `multipart/related; boundary=${boundary}`,
    },
    body,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Error al subir archivo a Drive: ${errorText}`);
  }

  return response.json();
}
