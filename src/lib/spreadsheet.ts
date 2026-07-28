import {
  SpreadsheetExportColumn,
  SpreadsheetSourceRow,
  SpreadsheetValue,
} from '@/types/spreadsheet';

function countDelimiter(line: string, delimiter: string) {
  let count = 0;
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      if (quoted && line[index + 1] === '"') {
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (!quoted && char === delimiter) {
      count += 1;
    }
  }
  return count;
}

function parseDelimitedText(text: string) {
  const cleanText = text.replace(/^\uFEFF/, '');
  const firstLine = cleanText.split(/\r?\n/, 1)[0] ?? '';
  const delimiter = [',', ';', '\t'].sort(
    (a, b) => countDelimiter(firstLine, b) - countDelimiter(firstLine, a)
  )[0];
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;

  for (let index = 0; index < cleanText.length; index += 1) {
    const char = cleanText[index];
    if (char === '"') {
      if (quoted && cleanText[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
      continue;
    }
    if (!quoted && char === delimiter) {
      row.push(cell.trim());
      cell = '';
      continue;
    }
    if (!quoted && (char === '\n' || char === '\r')) {
      if (char === '\r' && cleanText[index + 1] === '\n') index += 1;
      row.push(cell.trim());
      if (row.some((value) => value.length > 0)) rows.push(row);
      row = [];
      cell = '';
      continue;
    }
    cell += char;
  }

  row.push(cell.trim());
  if (row.some((value) => value.length > 0)) rows.push(row);
  return rows;
}

function rowsToSourceRows(matrix: SpreadsheetValue[][]) {
  const headers = (matrix[0] ?? []).map((value, index) => {
    const header = cellToText(value).trim();
    return header || `Coluna ${index + 1}`;
  });

  return matrix.slice(1).flatMap((row, index) => {
    if (row.every((value) => cellToText(value).trim().length === 0)) return [];
    const values = Object.fromEntries(
      headers.map((header, columnIndex) => [header, row[columnIndex] ?? null])
    );
    return [{ sourceRow: index + 2, values }];
  });
}

export async function readSpreadsheetFile(file: File): Promise<{
  sheetName: string;
  rows: SpreadsheetSourceRow[];
}> {
  const extension = file.name.split('.').pop()?.toLocaleLowerCase();

  if (extension === 'csv' || extension === 'tsv') {
    const matrix = parseDelimitedText(await file.text());
    return {
      sheetName: 'Dados',
      rows: rowsToSourceRows(matrix),
    };
  }

  if (extension !== 'xlsx') {
    throw new Error('Formato não suportado. Use um arquivo .xlsx ou .csv.');
  }

  const { default: readExcelFile } = await import('read-excel-file/browser');
  const sheets = await readExcelFile(file);
  const worksheet = sheets[0];
  if (!worksheet) throw new Error('A planilha não possui nenhuma aba.');

  return {
    sheetName: worksheet.sheet,
    rows: rowsToSourceRows(worksheet.data as SpreadsheetValue[][]),
  };
}

export function normalizeHeader(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
    .replace(/[^a-z0-9]+/g, '');
}

export function findSpreadsheetValue(
  values: Record<string, SpreadsheetValue>,
  aliases: string[]
) {
  const normalizedValues = new Map(
    Object.entries(values).map(([header, value]) => [normalizeHeader(header), value])
  );
  for (const alias of aliases) {
    const normalizedAlias = normalizeHeader(alias);
    if (normalizedValues.has(normalizedAlias)) {
      return normalizedValues.get(normalizedAlias) ?? null;
    }
  }
  return null;
}

export function cellToText(value: SpreadsheetValue | undefined) {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'number') {
    return Number.isInteger(value) ? value.toFixed(0) : String(value);
  }
  return String(value).trim();
}

function validDateParts(year: number, month: number, day: number) {
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

export function parseSpreadsheetDate(value: SpreadsheetValue | undefined) {
  if (value instanceof Date) {
    return [
      value.getUTCFullYear(),
      String(value.getUTCMonth() + 1).padStart(2, '0'),
      String(value.getUTCDate()).padStart(2, '0'),
    ].join('-');
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    const date = new Date(Date.UTC(1899, 11, 30) + Math.floor(value) * 86_400_000);
    return [
      date.getUTCFullYear(),
      String(date.getUTCMonth() + 1).padStart(2, '0'),
      String(date.getUTCDate()).padStart(2, '0'),
    ].join('-');
  }

  const text = cellToText(value).trim();
  if (!text) return null;
  const iso = text.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  const brazilian = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
  const parts = iso
    ? [Number(iso[1]), Number(iso[2]), Number(iso[3])]
    : brazilian
      ? [Number(brazilian[3]), Number(brazilian[2]), Number(brazilian[1])]
      : null;
  if (!parts || !validDateParts(parts[0], parts[1], parts[2])) return null;
  return `${parts[0]}-${String(parts[1]).padStart(2, '0')}-${String(parts[2]).padStart(2, '0')}`;
}

export function parseSpreadsheetTime(value: SpreadsheetValue | undefined) {
  if (value instanceof Date) {
    return `${String(value.getUTCHours()).padStart(2, '0')}:${String(
      value.getUTCMinutes()
    ).padStart(2, '0')}`;
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    const fraction = ((value % 1) + 1) % 1;
    const minutes = Math.round(fraction * 1440) % 1440;
    return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(
      minutes % 60
    ).padStart(2, '0')}`;
  }

  const text = cellToText(value);
  const match = text.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

export function parseSpreadsheetDateTime(value: SpreadsheetValue | undefined) {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString();
  }
  const text = cellToText(value);
  if (!text) return null;
  const direct = new Date(text);
  if (!Number.isNaN(direct.getTime())) return direct.toISOString();

  const match = text.match(
    /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})(?:\s+|T)(\d{1,2}):(\d{2})/
  );
  if (!match) return null;
  const [, day, month, year, hour, minute] = match;
  const iso = `${year}-${month.padStart(2, '0')}-${day.padStart(
    2,
    '0'
  )}T${hour.padStart(2, '0')}:${minute}:00-03:00`;
  const parsed = new Date(iso);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

export function parseSpreadsheetNumber(value: SpreadsheetValue | undefined) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const text = cellToText(value).replace(/\s|R\$/gi, '');
  if (!text) return null;
  const normalized =
    text.includes(',') && text.includes('.')
      ? text.replace(/\./g, '').replace(',', '.')
      : text.replace(',', '.');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function toExportDate(value: SpreadsheetValue | undefined) {
  if (value instanceof Date) return value;
  const parsed = parseSpreadsheetDate(value);
  return parsed ? new Date(`${parsed}T12:00:00Z`) : null;
}

function toExportDateTime(value: SpreadsheetValue | undefined) {
  if (value instanceof Date) return value;
  const text = cellToText(value);
  if (!text) return null;
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? text : date;
}

function toExportTime(value: SpreadsheetValue | undefined) {
  const parsed = parseSpreadsheetTime(value);
  if (!parsed) return null;
  const [hour, minute] = parsed.split(':').map(Number);
  return (hour * 60 + minute) / 1440;
}

function statusStyle(value: string) {
  const normalized = normalizeHeader(value);
  if (['enviado', 'confirmado'].includes(normalized)) {
    return { fill: 'D8F0E3', color: '166534' };
  }
  if (['cadastrado', 'processando'].includes(normalized)) {
    return { fill: 'DBEAFE', color: '1D4ED8' };
  }
  if (['falha', 'cancelado'].includes(normalized)) {
    return { fill: 'FEE2E2', color: 'B91C1C' };
  }
  return { fill: 'FEF3C7', color: '92400E' };
}

export async function exportSpreadsheet<T>({
  fileName,
  sheetName,
  columns,
  rows,
}: {
  fileName: string;
  sheetName: string;
  columns: SpreadsheetExportColumn<T>[];
  rows: T[];
}) {
  const { default: writeExcelFile } = await import('write-excel-file/browser');
  const header = columns.map((column) => ({
    value: column.header,
    fontWeight: 'bold' as const,
    textColor: '#FFFFFF',
    backgroundColor: '#2F6B58',
    height: 28,
    alignVertical: 'center' as const,
  }));
  const data = rows.map((row) =>
    columns.map((column) => {
      const rawValue = column.value(row);
      const value =
        column.kind === 'date'
          ? toExportDate(rawValue)
          : column.kind === 'datetime'
            ? toExportDateTime(rawValue)
            : column.kind === 'time'
              ? toExportTime(rawValue)
              : rawValue ?? null;
      const style =
        column.kind === 'status'
          ? statusStyle(cellToText(rawValue))
          : undefined;

      return {
        value,
        ...(value instanceof Date
          ? {
              type: Date,
              format:
                column.kind === 'datetime'
                  ? 'dd/mm/yyyy hh:mm'
                  : 'dd/mm/yyyy',
            }
          : {}),
        ...(typeof value === 'number'
          ? {
              type: Number,
              format:
                column.kind === 'time'
                  ? 'hh:mm'
                  : column.kind === 'currency'
                    ? '"R$" #,##0.00'
                    : column.kind === 'number'
                      ? '#,##0.00'
                      : undefined,
            }
          : {}),
        ...(typeof value === 'string' ? { type: String, format: '@' } : {}),
        ...(style
          ? {
              backgroundColor: `#${style.fill}`,
              textColor: `#${style.color}`,
            }
          : {}),
        height: 22,
        alignVertical: 'center' as const,
      };
    })
  );

  await writeExcelFile([header, ...data], {
    sheet: sheetName,
    columns: columns.map((column) => ({ width: column.width })),
    stickyRowsCount: 1,
    showGridLines: false,
    orientation: 'landscape',
  }).toFile(fileName.endsWith('.xlsx') ? fileName : `${fileName}.xlsx`);
}
