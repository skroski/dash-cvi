import {
  cellToText,
  findSpreadsheetValue,
  normalizeHeader,
  parseSpreadsheetDate,
  parseSpreadsheetDateTime,
  parseSpreadsheetNumber,
  parseSpreadsheetTime,
  readSpreadsheetFile,
} from '@/lib/spreadsheet';
import {
  ReminderSpreadsheetImportRow,
  SatisfactionSpreadsheetImportRow,
  SpreadsheetImportItem,
  SpreadsheetImportPreview,
  SpreadsheetSourceRow,
} from '@/types/spreadsheet';

const ALIASES = {
  appointmentDate: ['Data Agendada', 'Data', 'Data do Agendamento'],
  appointmentTime: ['Horário', 'Horario', 'Hora'],
  service: ['Serviços', 'Servicos', 'Serviço', 'Servico'],
  description: ['Descrição', 'Descricao'],
  ownerName: ['Nome Cliente', 'Nome do Cliente', 'Cliente', 'Nome Tutor', 'Tutor'],
  phone: ['Telefone', 'WhatsApp', 'Celular'],
  email: ['E-mail', 'Email'],
  petName: ['Nome Pet', 'Pet', 'Nome do Pet'],
  petSize: ['Porte', 'Porte Pet'],
  price: ['Preço', 'Preco', 'Valor'],
  status: ['Status', 'Situação', 'Situacao'],
  deliveryStatus: ['Status Lembrete', 'Status do Lembrete'],
  sentAt: ['Enviado em', 'Data Envio', 'Data de Envio'],
  registeredAt: ['Cadastrado em', 'Respondido em', 'Data da Resposta'],
  error: ['Erro', 'Detalhes do Erro'],
  rating: ['Nota', 'Avaliação', 'Avaliacao', 'Rating'],
  nps: ['NPS'],
  comment: ['Comentário', 'Comentario', 'Feedback', 'Observação', 'Observacao'],
};

function value(row: SpreadsheetSourceRow, aliases: string[]) {
  return findSpreadsheetValue(row.values, aliases);
}

function normalizePhone(rawValue: ReturnType<typeof value>) {
  const text = cellToText(rawValue).replace(/\.0$/, '');
  const digits = text.replace(/\D/g, '');
  return digits;
}

function optionalText(rawValue: ReturnType<typeof value>) {
  return cellToText(rawValue).trim() || null;
}

function reminderStatus(rawValue: ReturnType<typeof value>) {
  const original = optionalText(rawValue);
  const normalized = normalizeHeader(original ?? '');
  const deliveryStatuses = [
    'pendente',
    'processando',
    'enviado',
    'falha',
    'ignorado',
  ] as const;
  const deliveryStatus = deliveryStatuses.includes(
    normalized as (typeof deliveryStatuses)[number]
  )
    ? (normalized as (typeof deliveryStatuses)[number])
    : 'pendente';
  return {
    appointmentStatus: original?.toLocaleUpperCase('pt-BR') ?? null,
    deliveryStatus,
  };
}

function satisfactionStatus(rawValue: ReturnType<typeof value>) {
  const normalized = normalizeHeader(optionalText(rawValue) ?? '');
  if (['enviado', 'cadastrado', 'pendente', 'falha'].includes(normalized)) {
    return normalized as SatisfactionSpreadsheetImportRow['status'];
  }
  return null;
}

function markDuplicates<T>(
  items: SpreadsheetImportItem<T>[],
  keyFor: (item: SpreadsheetImportItem<T>) => string | null
) {
  const seen = new Set<string>();
  return items.map((item) => {
    const key = keyFor(item);
    if (!key || item.errors.length > 0) return item;
    if (seen.has(key)) return { ...item, duplicate: true };
    seen.add(key);
    return item;
  });
}

export async function parseReminderSpreadsheet(
  file: File
): Promise<SpreadsheetImportPreview<ReminderSpreadsheetImportRow>> {
  const parsed = await readSpreadsheetFile(file);
  const items = parsed.rows.map((row): SpreadsheetImportItem<ReminderSpreadsheetImportRow> => {
    const errors: string[] = [];
    const appointmentDate = parseSpreadsheetDate(value(row, ALIASES.appointmentDate));
    const appointmentTime = parseSpreadsheetTime(value(row, ALIASES.appointmentTime));
    const ownerName = optionalText(value(row, ALIASES.ownerName));
    const phone = normalizePhone(value(row, ALIASES.phone));
    const service = optionalText(value(row, ALIASES.service));
    const appointmentStatus = optionalText(value(row, ALIASES.status));
    const status = reminderStatus(
      value(row, ALIASES.deliveryStatus) ?? value(row, ALIASES.status)
    );

    if (!appointmentDate) errors.push('Data agendada inválida ou ausente.');
    if (!ownerName) errors.push('Nome do cliente ausente.');
    if (phone.length < 8) errors.push('Telefone inválido ou ausente.');

    const importKey = [
      appointmentDate,
      appointmentTime ?? '',
      phone,
      normalizeHeader(service ?? ''),
    ].join(':');
    const data =
      appointmentDate && ownerName && phone.length >= 8
        ? {
            importKey,
            appointmentDate,
            appointmentTime,
            service,
            description: optionalText(value(row, ALIASES.description)),
            ownerName,
            phone,
            email: optionalText(value(row, ALIASES.email)),
            petName: optionalText(value(row, ALIASES.petName)),
            petSize: optionalText(value(row, ALIASES.petSize)),
            price: parseSpreadsheetNumber(value(row, ALIASES.price)),
            appointmentStatus:
              appointmentStatus?.toLocaleUpperCase('pt-BR') ??
              status.appointmentStatus,
            deliveryStatus: status.deliveryStatus,
            sentAt: parseSpreadsheetDateTime(value(row, ALIASES.sentAt)),
            error: optionalText(value(row, ALIASES.error)),
          }
        : null;

    return {
      sourceRow: row.sourceRow,
      data,
      preview: [
        appointmentDate ?? '—',
        appointmentTime ?? '—',
        ownerName ?? '—',
        phone || '—',
        appointmentStatus?.toLocaleUpperCase('pt-BR') ??
          status.appointmentStatus ??
          status.deliveryStatus.toLocaleUpperCase('pt-BR'),
      ],
      errors,
      duplicate: false,
    };
  });

  return {
    fileName: file.name,
    sheetName: parsed.sheetName,
    columns: ['Data', 'Horário', 'Cliente', 'Telefone', 'Status'],
    items: markDuplicates(items, (item) => item.data?.importKey ?? null),
  };
}

export async function parseSatisfactionSpreadsheet(
  file: File
): Promise<SpreadsheetImportPreview<SatisfactionSpreadsheetImportRow>> {
  const parsed = await readSpreadsheetFile(file);
  const items = parsed.rows.map(
    (row): SpreadsheetImportItem<SatisfactionSpreadsheetImportRow> => {
      const errors: string[] = [];
      const appointmentDate = parseSpreadsheetDate(value(row, ALIASES.appointmentDate));
      const appointmentTime = parseSpreadsheetTime(value(row, ALIASES.appointmentTime));
      const ownerName = optionalText(value(row, ALIASES.ownerName));
      const phone = normalizePhone(value(row, ALIASES.phone));
      const status = satisfactionStatus(value(row, ALIASES.status));
      const rating = parseSpreadsheetNumber(value(row, ALIASES.rating));
      const nps = parseSpreadsheetNumber(value(row, ALIASES.nps));

      if (!appointmentDate) errors.push('Data agendada inválida ou ausente.');
      if (!ownerName) errors.push('Nome do cliente ausente.');
      if (phone.length < 8) errors.push('Telefone inválido ou ausente.');
      if (!status) errors.push('Status deve ser Enviado, Cadastrado, Pendente ou Falha.');
      if (rating !== null && (rating < 1 || rating > 5)) {
        errors.push('Nota deve estar entre 1 e 5.');
      }
      if (nps !== null && (nps < 0 || nps > 10)) {
        errors.push('NPS deve estar entre 0 e 10.');
      }

      const data =
        appointmentDate && ownerName && phone.length >= 8 && status
          ? {
              importKey: phone,
              appointmentDate,
              appointmentTime,
              ownerName,
              phone,
              email: optionalText(value(row, ALIASES.email)),
              status,
              sentAt: parseSpreadsheetDateTime(value(row, ALIASES.sentAt)),
              registeredAt: parseSpreadsheetDateTime(
                value(row, ALIASES.registeredAt)
              ),
              rating,
              nps,
              comment: optionalText(value(row, ALIASES.comment)),
            }
          : null;

      return {
        sourceRow: row.sourceRow,
        data,
        preview: [
          appointmentDate ?? '—',
          appointmentTime ?? '—',
          ownerName ?? '—',
          phone || '—',
          status?.toLocaleUpperCase('pt-BR') ?? 'INVÁLIDO',
        ],
        errors,
        duplicate: false,
      };
    }
  );

  return {
    fileName: file.name,
    sheetName: parsed.sheetName,
    columns: ['Data', 'Horário', 'Cliente', 'Telefone', 'Status'],
    items: markDuplicates(items, (item) => item.data?.importKey ?? null),
  };
}
