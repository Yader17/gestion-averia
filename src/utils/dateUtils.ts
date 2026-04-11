/**
 * Formats a date string to DD/MM/YYYY format.
 */
export function formatDate(date: Date): string {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

/**
 * Parses a date string in DD/MM/YYYY format to a Date object.
 * Returns null if the format is invalid.
 */
export function parseDate(dateString: string): Date | null {
  const parts = dateString.split('/');
  if (parts.length !== 3) return null;

  const day = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const year = parseInt(parts[2], 10);

  if (isNaN(day) || isNaN(month) || isNaN(year)) return null;

  const date = new Date(year, month, day);

  if (
    date.getDate() !== day ||
    date.getMonth() !== month ||
    date.getFullYear() !== year
  ) {
    return null;
  }

  return date;
}

/**
 * Returns today's date formatted as DD/MM/YYYY.
 */
export function getTodayFormatted(): string {
  return formatDate(new Date());
}

/**
 * Converts an Excel serial date number to DD/MM/YYYY string.
 * Excel serial dates start from 1900-01-01.
 */
export function excelSerialToDate(serial: number): string {
  const excelEpoch = new Date(1899, 11, 30);
  const resultDate = new Date(excelEpoch.getTime() + serial * 86400000);
  return formatDate(resultDate);
}
