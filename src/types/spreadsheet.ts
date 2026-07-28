export type SpreadsheetValue = string | number | boolean | Date | null;

export interface SpreadsheetSourceRow {
  sourceRow: number;
  values: Record<string, SpreadsheetValue>;
}

export interface SpreadsheetImportItem<T> {
  sourceRow: number;
  data: T | null;
  preview: string[];
  errors: string[];
  duplicate: boolean;
}

export interface SpreadsheetImportPreview<T> {
  fileName: string;
  sheetName: string;
  columns: string[];
  items: SpreadsheetImportItem<T>[];
}

export interface SpreadsheetImportResult {
  imported: number;
  updated?: number;
  ignored: number;
  responsesImported?: number;
}

export interface ReminderSpreadsheetImportRow {
  importKey: string;
  appointmentDate: string;
  appointmentTime: string | null;
  service: string | null;
  description: string | null;
  ownerName: string;
  phone: string;
  email: string | null;
  petName: string | null;
  petSize: string | null;
  price: number | null;
  appointmentStatus: string | null;
  deliveryStatus: 'pendente' | 'processando' | 'enviado' | 'falha' | 'ignorado';
  sentAt: string | null;
  error: string | null;
}

export interface SatisfactionSpreadsheetImportRow {
  importKey: string;
  appointmentDate: string;
  appointmentTime: string | null;
  ownerName: string;
  phone: string;
  email: string | null;
  status: 'pendente' | 'enviado' | 'cadastrado' | 'falha';
  sentAt: string | null;
  registeredAt: string | null;
  rating: number | null;
  nps: number | null;
  comment: string | null;
}

export type SpreadsheetColumnKind =
  | 'text'
  | 'date'
  | 'datetime'
  | 'time'
  | 'number'
  | 'currency'
  | 'status';

export interface SpreadsheetExportColumn<T> {
  header: string;
  width: number;
  kind?: SpreadsheetColumnKind;
  value: (row: T) => SpreadsheetValue | undefined;
}
