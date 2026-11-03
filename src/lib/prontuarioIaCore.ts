/**
 * Prontuário com IA — Núcleo Agnóstico (Single-Tenant, Puro e Testável).
 *
 * Princípios arquiteturais (Seções 1, 4, 5, 6, 7, 8 e 9):
 * 1. Regra inviolável ("não inventar"): somente o que foi dito na consulta entra no rascunho.
 *    Campos ausentes ou inválidos são omitidos por `coerceProntuarioIaResult` (nunca null/default).
 * 2. Revisão humana obrigatória: nada é persistido no prontuário sem confirmação explícita do veterinário.
 * 3. Agnóstico: este arquivo NÃO importa `@supabase/supabase-js`, `fetch`, React ou nomes de tabelas.
 *    Toda comunicação externa ocorre exclusivamente pelas portas (interfaces da Seção 9.2).
 * 4. Single-tenant: nenhum tipo, path ou contrato carrega `clinic_id`.
 * 5. Segurança e LGPD:
 *    - Sem URL de webhook padrão fixa no código (G-02).
 *    - Sem `console.log` de `audioUrl`, request ou dados clínicos (G-01).
 *    - Signed URL de vida curta (15 min = 900 s, G-08) e falha explícita se não gerada (G-12).
 *    - Prova do ato médico via `confirmado_em` + hash SHA-256 em `assinatura_digital` (G-07).
 */

// ─── 1. Tipos de Domínio do Prontuário e Internação (Seções 3.1 a 3.7) ───────

export type ProntuarioStatus = 'em_andamento' | 'finalizado' | 'alta' | 'obito';
export type ProntuarioTipoAtendimento = 'consulta' | 'cirurgia' | 'internacao' | 'emergencia';
export type ProntuarioIaDraftStatus = 'pending' | 'ready' | 'error' | 'committed';

export type ProntuarioAnexoType =
  | 'audio'
  | 'transcript'
  | 'pdf'
  | 'image'
  | 'txt'
  | 'other';

export type ProntuarioAnexoOrigem =
  | 'audio_consulta'
  | 'transcricao'
  | 'upload_manual';

/** Item de `prontuarios.anexos[]` (Seção 3.7). */
export interface ProntuarioAnexo {
  id: string;
  /** Path no bucket privado `medical-files` (`{pet_id}/{record_id}/{arquivo}`). */
  url: string;
  name: string;
  type: ProntuarioAnexoType;
  origem: ProntuarioAnexoOrigem;
  uploadedAt: string;
}

/** Shape JSON de `prontuarios.anamnese` (Seção 3.5). */
export interface AnamnesisData {
  queixa_principal?: string;
  historico_doenca_atual?: string;
  historico_medico_pregresso?: string;
  vacinacao?: 'sim' | 'nao';
  apetite?: 'normal' | 'diminuido' | 'aumentado' | 'anorexia';
  urina_fezes?: 'normal' | 'alterada';
}

/** Shape JSON de `prontuarios.exame_fisico` (Seção 3.6). */
export interface PhysicalExamData {
  peso?: number;               // kg
  temperatura?: number;        // °C
  fc?: number;                 // bpm
  fr?: number;                 // mpm
  tpc?: number;                // segundos
  hidratacao?: 'normal' | 'desidratado';
  mucosas?: 'normocoradas' | 'hipocoradas' | 'congestas' | 'cianoticas' | 'ictericas';
  linfonodos?: 'normais' | 'aumentados';
  ausculta_cardiaca?: string;
  ausculta_pulmonar?: string;
  palpacao_abdominal?: string;
  outros_achados?: string;
}

/** Registro clínico da consulta (Seção 3.1). */
export interface MedicalRecord {
  id: string;
  pet_id: string;
  data_consulta: string;
  motivo_consulta: string;
  status?: ProntuarioStatus | null;
  tipo_atendimento?: ProntuarioTipoAtendimento | null;
  veterinario?: string | null;
  crmv_responsavel: string;
  anamnese?: AnamnesisData | null;
  exame_fisico?: PhysicalExamData | null;
  anexos?: ProntuarioAnexo[] | null;
  sintomas?: string | null;
  diagnostico?: string | null;
  diagnostico_definitivo?: string | null;
  cid_vet?: string | null;
  hipoteses_diagnosticas?: string[] | null;
  medicamentos?: string | null;
  tratamento?: string | null;
  observacoes?: string | null;
  procedimentos_realizados?: unknown | null;
  proxima_consulta?: string | null;
  assinatura_digital?: string | null;
  confirmado_em?: string | null;
  peso_atual?: number | null;
  temperatura?: number | null;
  frequencia_cardiaca?: number | null;
  frequencia_respiratoria?: number | null;
  created_at: string;
  updated_at: string;
}

export type InternacaoStatus = 'internado' | 'alta' | 'obito';
export type InternacaoEventoTipo = 'medicamento' | 'evolucao' | 'checkin' | 'monitoramento' | 'alta';

/** Ficha de internação (Seção 3.2). */
export interface Internacao {
  id: string;
  pet_id: string;
  prontuario_id?: string | null;
  motivo?: string | null;
  box?: string | null;
  data_entrada: string;
  previsao_alta?: string | null;
  data_alta?: string | null;
  status: InternacaoStatus;
  objetos_com_pet?: string | null;
  alergias?: string[] | null;
  sintomas_entrada?: string | null;
  observacoes?: string | null;
  responsavel?: string | null;
  crmv_responsavel?: string | null;
  created_at?: string;
  updated_at?: string;
}

/** Evento de timeline e monitoramento de internação (Seção 3.3). */
export interface InternacaoEvento {
  id: string;
  internacao_id: string;
  tipo: InternacaoEventoTipo;
  descricao?: string | null;
  temperatura?: number | null;
  frequencia_cardiaca?: number | null;
  frequencia_respiratoria?: number | null;
  pressao_sistolica?: number | null;
  status?: 'realizado' | 'pendente' | null;
  responsavel?: string | null;
  horario: string;
  created_at?: string;
}

/** Cadastro resumido de Pet para exibição no cabeçalho (Seção 3.9). */
export interface PetCadastro {
  id: string;
  nome: string;
  especie: string;
  raca?: string | null;
  sexo?: string | null;
  idade?: number | null;
  peso?: number | null;
  data_nascimento?: string | null;
  porte?: string | null;
  castrado?: boolean | null;
  microchip?: string | null;
  status?: string | null;
  image_url?: string | null;
  observacoes?: string | null;
  tutor_id?: number | null;
  tutor_nome?: string | null;
  tutor_telefone?: string | null;
}

/** Registro de consentimento do tutor para processamento por IA (Seção 7.2 item 1). */
export interface ConsentimentoProntuarioIa {
  id: string;
  pet_id: string;
  tutor_id?: number | null;
  prontuario_id?: string | null;
  texto_versao: string;
  operadores_informados: string;
  aceito_em: string;
}

// ─── 2. Contratos de IA (Seções 4 e 5) ───────────────────────────────────────

/**
 * Request enviado do app para o serviço de IA via POST JSON (Seção 4.1).
 * Nunca envia chaves de API nem dados pessoais do tutor (nome, telefone, CPF).
 */
export interface ProntuarioIaRequest {
  draftId: string;
  petId: string;
  recordId: string;
  /** Signed URL de vida curta (15 min — G-08). */
  audioUrl: string;
  audioAnexoId: string;
  systemPrompt: string;
  context: {
    species?: string;
    petName?: string;
    veterinario?: string;
    crmvResponsavel?: string;
  };
}

export interface ProntuarioIaDiagnostico {
  diagnostico_definitivo?: string;
  cid_vet?: string;
  hipoteses_diagnosticas?: string[];
  tratamento?: string;
  medicamentos?: string;
  observacoes?: string;
}

export interface ProntuarioIaInternacaoEvento {
  tipo?: InternacaoEventoTipo;
  descricao?: string;
  temperatura?: number;
  fc?: number;
  fr?: number;
  pressao_sistolica?: number;
  horario?: string;
}

export interface ProntuarioIaInternacao {
  motivo?: string;
  box?: string;
  previsao_alta?: string;
  objetos_com_pet?: string;
  alergias?: string[];
  sintomas_entrada?: string;
  observacoes?: string;
  eventos?: ProntuarioIaInternacaoEvento[];
}

/** Resultado estruturado devolvido pela IA (Seção 5). */
export interface ProntuarioIaResult {
  transcript?: string;
  anamnese?: Partial<AnamnesisData>;
  exame_fisico?: Partial<PhysicalExamData>;
  diagnostico?: ProntuarioIaDiagnostico;
  internacao?: ProntuarioIaInternacao | null;
  /** Mapa "secao.campo" -> trecho exato do transcript que embasou o preenchimento. */
  _evidence?: Record<string, string>;
}

/** Linha da tabela `prontuario_ia_drafts` (Seção 3.4). */
export interface DraftRow {
  id: string;
  pet_id: string;
  prontuario_id: string;
  audio_anexo_id: string;
  audio_path?: string | null;
  transcript?: string | null;
  payload?: unknown;
  status: ProntuarioIaDraftStatus;
  error_message?: string | null;
  created_at?: string;
  updated_at?: string;
}

/** Dados de entrada para o commit transacional (Seção 6 e 9.2). */
export interface CommitInput {
  petId: string;
  recordId: string;
  draftId?: string | null;
  edited: ProntuarioIaResult;
  confirmadoEm: string;
  hashSha256: string;
  transcriptAnexo?: ProntuarioAnexo | null;
  veterinario?: string;
  crmvResponsavel?: string;
}

// ─── 3. Constantes do Módulo (Seções 3.8, 7.2, 8 e 10) ──────────────────────

/** Nome do bucket privado de arquivos médico-legais (Seção 3.8). */
export const MEDICAL_FILES_BUCKET = 'medical-files';

/**
 * TTL das Signed URLs enviadas ao serviço externo (15 minutos = 900 segundos).
 * Corrige o gap G-08 (antes era 90 minutos).
 */
export const MEDICAL_FILES_SIGNED_TTL = 15 * 60;

/** Timeout máximo em estado `processing` (90 s = 30 tentativas de 3 s — Seção 9.3 e 9.5). */
export const PRONTUARIO_IA_PROCESSING_TIMEOUT_MS = 90_000;
export const PRONTUARIO_IA_POLL_INTERVAL_MS = 3_000;
export const PRONTUARIO_IA_MAX_POLL_ATTEMPTS = 30;

/** Versão e texto padrão do Termo de Consentimento e Transferência Internacional (Seção 7.2 item 1, G-09). */
export const TERMO_CONSENTIMENTO_IA_VERSAO = 'v1.0-2026-lgpd-cfmv';
export const TERMO_CONSENTIMENTO_IA_OPERADORES =
  'Groq Inc. (transcrição de voz Whisper) e OpenAI OpCo, LLC (extração clínica GPT) — servidores nos Estados Unidos (EUA)';
export const TERMO_CONSENTIMENTO_IA_TEXTO =
  'O tutor foi informado e autorizou a gravação de áudio desta consulta para transcrição automatizada e auxílio na estruturação do rascunho de prontuário por Inteligência Artificial (operadores: Groq Inc. e OpenAI OpCo, LLC, com processamento internacional nos Estados Unidos, conforme arts. 7º, 11 e 33 da LGPD — Lei 13.709/2018). Nenhum dado de identificação civil ou contato do tutor é enviado no contexto da IA, e o prontuário passa obrigatoriamente por revisão e confirmação do médico-veterinário antes da gravação definitiva.';

/**
 * System prompt padrão (Seção 10).
 * Mantém rigorosamente as regras de não invenção, omissão de campos não ditos,
 * valores categóricos exatos, internação condicional e `_evidence` por campo.
 */
export const DEFAULT_PRONTUARIO_IA_SYSTEM_PROMPT = `Você é um assistente clínico veterinário. Recebe a TRANSCRIÇÃO de uma consulta gravada pelo veterinário e deve estruturar o conteúdo em um prontuário.

REGRA ABSOLUTA: preencha SOMENTE o que foi explicitamente dito na transcrição. NUNCA invente, deduza ou complete dados não mencionados. Se um campo não foi dito, OMITA-O do JSON (não use null nem placeholders).

Responda APENAS com um objeto JSON válido neste formato (todos os campos opcionais):
{
  "transcript": "<transcrição bruta>",
  "anamnese": {
    "queixa_principal": "", "historico_doenca_atual": "", "historico_medico_pregresso": "",
    "vacinacao": "sim|nao", "apetite": "normal|diminuido|aumentado|anorexia", "urina_fezes": "normal|alterada"
  },
  "exame_fisico": {
    "peso": 0, "temperatura": 0, "fc": 0, "fr": 0, "tpc": 0,
    "hidratacao": "normal|desidratado",
    "mucosas": "normocoradas|hipocoradas|congestas|cianoticas|ictericas",
    "linfonodos": "normais|aumentados",
    "ausculta_cardiaca": "", "ausculta_pulmonar": "", "palpacao_abdominal": "", "outros_achados": ""
  },
  "diagnostico": {
    "diagnostico_definitivo": "", "cid_vet": "", "hipoteses_diagnosticas": [],
    "tratamento": "", "medicamentos": "", "observacoes": ""
  },
  "internacao": {
    "motivo": "", "box": "", "previsao_alta": "", "objetos_com_pet": "",
    "alergias": [], "sintomas_entrada": "", "observacoes": "",
    "eventos": [ { "tipo": "medicamento|evolucao|checkin|monitoramento|alta", "descricao": "", "temperatura": 0, "fc": 0, "fr": 0, "pressao_sistolica": 0, "horario": "" } ]
  },
  "_evidence": { "exame_fisico.peso": "trecho da transcrição que embasou o valor" }
}

Use os valores categóricos EXATAMENTE como listados acima. Inclua "internacao" apenas se houver menção a internação/hospitalização. Em "_evidence", para cada campo preenchido, cite o trecho da transcrição que o embasou.`;

// ─── 4. Coerção e Validação Pura ("Não Inventar" — Seção 5.1) ────────────────

function asRecord(v: unknown): Record<string, unknown> | undefined {
  return v !== null && typeof v === 'object' && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : undefined;
}

/** String com trim(); vazia ou só espaços -> omitida (undefined). */
function str(v: unknown): string | undefined {
  if (typeof v !== 'string') return undefined;
  const trimmed = v.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

/** Número ou string numérica ('4.2' -> 4.2); finito e >= 0; senão omitido. */
function num(v: unknown): number | undefined {
  if (typeof v === 'string') {
    const trimmed = v.trim();
    if (!trimmed) return undefined;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
  }
  if (typeof v === 'number') {
    return Number.isFinite(v) && v >= 0 ? v : undefined;
  }
  return undefined;
}

/** Enum: só aceita valor exato do conjunto; senão omitido (sem normalização de acento ou caixa). */
function oneOf<T extends string>(v: unknown, allowed: readonly T[]): T | undefined {
  return typeof v === 'string' && (allowed as readonly string[]).includes(v)
    ? (v as T)
    : undefined;
}

/** Array de string: remove itens vazios; se sobrar nada, omitido. */
function strArray(v: unknown): string[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const out = v.map(str).filter((s): s is string => s !== undefined);
  return out.length > 0 ? out : undefined;
}

/** Remove chaves undefined; se o objeto ficar vazio, retorna undefined. */
function prune<T extends object>(obj: T): Partial<T> | undefined {
  const out: Record<string, unknown> = {};
  for (const [k, val] of Object.entries(obj)) {
    if (val !== undefined) out[k] = val;
  }
  return Object.keys(out).length > 0 ? (out as Partial<T>) : undefined;
}

const VACINACAO_ALLOWED = ['sim', 'nao'] as const;
const APETITE_ALLOWED = ['normal', 'diminuido', 'aumentado', 'anorexia'] as const;
const URINA_FEZES_ALLOWED = ['normal', 'alterada'] as const;
const HIDRATACAO_ALLOWED = ['normal', 'desidratado'] as const;
const MUCOSAS_ALLOWED = [
  'normocoradas',
  'hipocoradas',
  'congestas',
  'cianoticas',
  'ictericas',
] as const;
const LINFONODOS_ALLOWED = ['normais', 'aumentados'] as const;
const EVENTO_TIPO_ALLOWED = [
  'medicamento',
  'evolucao',
  'checkin',
  'monitoramento',
  'alta',
] as const;

function coerceAnamnese(v: unknown): Partial<AnamnesisData> | undefined {
  const r = asRecord(v);
  if (!r) return undefined;
  return prune<AnamnesisData>({
    queixa_principal: str(r['queixa_principal']),
    historico_doenca_atual: str(r['historico_doenca_atual']),
    historico_medico_pregresso: str(r['historico_medico_pregresso']),
    vacinacao: oneOf(r['vacinacao'], VACINACAO_ALLOWED),
    apetite: oneOf(r['apetite'], APETITE_ALLOWED),
    urina_fezes: oneOf(r['urina_fezes'], URINA_FEZES_ALLOWED),
  });
}

function coercePhysical(v: unknown): Partial<PhysicalExamData> | undefined {
  const r = asRecord(v);
  if (!r) return undefined;
  return prune<PhysicalExamData>({
    peso: num(r['peso']),
    temperatura: num(r['temperatura']),
    fc: num(r['fc']),
    fr: num(r['fr']),
    tpc: num(r['tpc']),
    hidratacao: oneOf(r['hidratacao'], HIDRATACAO_ALLOWED),
    mucosas: oneOf(r['mucosas'], MUCOSAS_ALLOWED),
    linfonodos: oneOf(r['linfonodos'], LINFONODOS_ALLOWED),
    ausculta_cardiaca: str(r['ausculta_cardiaca']),
    ausculta_pulmonar: str(r['ausculta_pulmonar']),
    palpacao_abdominal: str(r['palpacao_abdominal']),
    outros_achados: str(r['outros_achados']),
  });
}

function coerceDiagnostico(v: unknown): ProntuarioIaDiagnostico | undefined {
  const r = asRecord(v);
  if (!r) return undefined;
  return prune<ProntuarioIaDiagnostico>({
    diagnostico_definitivo: str(r['diagnostico_definitivo']),
    cid_vet: str(r['cid_vet']),
    hipoteses_diagnosticas: strArray(r['hipoteses_diagnosticas']),
    tratamento: str(r['tratamento']),
    medicamentos: str(r['medicamentos']),
    observacoes: str(r['observacoes']),
  });
}

function coerceInternacaoEvento(v: unknown): ProntuarioIaInternacaoEvento | undefined {
  const r = asRecord(v);
  if (!r) return undefined;
  return prune<ProntuarioIaInternacaoEvento>({
    tipo: oneOf(r['tipo'], EVENTO_TIPO_ALLOWED),
    descricao: str(r['descricao']),
    temperatura: num(r['temperatura']),
    fc: num(r['fc']),
    fr: num(r['fr']),
    pressao_sistolica: num(r['pressao_sistolica']),
    horario: str(r['horario']),
  });
}

function coerceInternacao(v: unknown): ProntuarioIaInternacao | undefined {
  const r = asRecord(v);
  if (!r) return undefined;
  const eventos = Array.isArray(r['eventos'])
    ? (r['eventos'] as unknown[])
        .map(coerceInternacaoEvento)
        .filter((e): e is ProntuarioIaInternacaoEvento => e !== undefined)
    : undefined;
  return prune<ProntuarioIaInternacao>({
    motivo: str(r['motivo']),
    box: str(r['box']),
    previsao_alta: str(r['previsao_alta']),
    objetos_com_pet: str(r['objetos_com_pet']),
    alergias: strArray(r['alergias']),
    sintomas_entrada: str(r['sintomas_entrada']),
    observacoes: str(r['observacoes']),
    eventos: eventos && eventos.length > 0 ? eventos : undefined,
  });
}

function coerceEvidence(v: unknown): Record<string, string> | undefined {
  const r = asRecord(v);
  if (!r) return undefined;
  const out: Record<string, string> = {};
  for (const [k, val] of Object.entries(r)) {
    const keyTrimmed = k.trim();
    const s = str(val);
    if (keyTrimmed && s) {
      out[keyTrimmed] = s;
    }
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

/**
 * Sanitiza o JSON cru vindo da IA (Seção 5.1).
 * Nunca retorna null, undefined ou placeholder em nenhum subcampo.
 */
export function coerceProntuarioIaResult(raw: unknown): ProntuarioIaResult {
  const r = asRecord(raw) ?? {};
  const result: ProntuarioIaResult = {};

  const transcript = str(r['transcript']);
  if (transcript) result.transcript = transcript;

  const anamnese = coerceAnamnese(r['anamnese']);
  if (anamnese) result.anamnese = anamnese;

  const exame = coercePhysical(r['exame_fisico']);
  if (exame) result.exame_fisico = exame;

  const diag = coerceDiagnostico(r['diagnostico']);
  if (diag) result.diagnostico = diag;

  const internacao = coerceInternacao(r['internacao']);
  if (internacao) result.internacao = internacao;

  const evidence = coerceEvidence(r['_evidence']);
  if (evidence) result._evidence = evidence;

  return result;
}

/** Retorna true se ao menos uma seção clínica foi preenchida. */
export function hasAnyClinicalContent(r: ProntuarioIaResult): boolean {
  return Boolean(r.anamnese || r.exame_fisico || r.diagnostico || r.internacao);
}

// ─── 5. Mapeamento Único de Commit, Unidades e Hash SHA-256 (Seções 5.2, 6, 7.2) ──

/**
 * Único lugar do sistema que converte `fc`/`fr` da IA para `frequencia_cardiaca`/`frequencia_respiratoria`
 * da tabela `internacao_eventos` (Seção 5.2).
 */
export function mapInternacaoEventoToRow(
  ev: ProntuarioIaInternacaoEvento,
  responsavel?: string
): Omit<InternacaoEvento, 'id' | 'internacao_id' | 'created_at'> {
  const row: Record<string, unknown> = {
    tipo: ev.tipo ?? 'evolucao',
    horario: ev.horario ?? new Date().toISOString(),
  };
  if (ev.descricao !== undefined) row.descricao = ev.descricao;
  if (ev.temperatura !== undefined) row.temperatura = ev.temperatura;
  if (ev.fc !== undefined) row.frequencia_cardiaca = Math.round(ev.fc);
  if (ev.fr !== undefined) row.frequencia_respiratoria = Math.round(ev.fr);
  if (ev.pressao_sistolica !== undefined) row.pressao_sistolica = Math.round(ev.pressao_sistolica);
  if (responsavel && responsavel.trim()) row.responsavel = responsavel.trim();
  return row as Omit<InternacaoEvento, 'id' | 'internacao_id' | 'created_at'>;
}

/**
 * Monta o objeto de atualização da tabela `prontuarios` a partir do rascunho revisado pelo veterinário,
 * espelhando os sinais vitais e o diagnóstico definitivo (Seção 6 passo 1).
 */
export function mapDraftToProntuarioUpdates(
  edited: ProntuarioIaResult,
  meta?: {
    veterinario?: string;
    crmvResponsavel?: string;
    confirmadoEm?: string;
    hashSha256?: string;
  }
): Partial<MedicalRecord> {
  const updates: Partial<MedicalRecord> = {};

  if (edited.anamnese && Object.keys(edited.anamnese).length > 0) {
    updates.anamnese = edited.anamnese;
  }

  if (edited.exame_fisico && Object.keys(edited.exame_fisico).length > 0) {
    updates.exame_fisico = edited.exame_fisico;
    const e = edited.exame_fisico;
    if (e.peso != null) updates.peso_atual = e.peso;
    if (e.temperatura != null) updates.temperatura = e.temperatura;
    if (e.fc != null) updates.frequencia_cardiaca = Math.round(e.fc);
    if (e.fr != null) updates.frequencia_respiratoria = Math.round(e.fr);
  }

  if (edited.diagnostico && Object.keys(edited.diagnostico).length > 0) {
    const d = edited.diagnostico;
    if (d.diagnostico_definitivo) {
      updates.diagnostico_definitivo = d.diagnostico_definitivo;
      updates.diagnostico = d.diagnostico_definitivo;
    }
    if (d.cid_vet) updates.cid_vet = d.cid_vet;
    if (d.hipoteses_diagnosticas && d.hipoteses_diagnosticas.length > 0) {
      updates.hipoteses_diagnosticas = d.hipoteses_diagnosticas;
    }
    if (d.tratamento) updates.tratamento = d.tratamento;
    if (d.medicamentos) updates.medicamentos = d.medicamentos;
    if (d.observacoes) updates.observacoes = d.observacoes;
  }

  if (meta?.veterinario?.trim()) {
    updates.veterinario = meta.veterinario.trim();
  }
  if (meta?.crmvResponsavel?.trim()) {
    updates.crmv_responsavel = meta.crmvResponsavel.trim();
  }
  if (meta?.confirmadoEm) {
    updates.confirmado_em = meta.confirmadoEm;
  }
  if (meta?.hashSha256) {
    updates.assinatura_digital = meta.hashSha256;
  }

  return updates;
}

/** Ordena chaves recursivamente para serialização determinística antes do SHA-256. */
function canonicalizeJson(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(canonicalizeJson);
  }
  if (value !== null && typeof value === 'object') {
    const sorted: Record<string, unknown> = {};
    for (const k of Object.keys(value as Record<string, unknown>).sort()) {
      const v = (value as Record<string, unknown>)[k];
      if (v !== undefined) {
        sorted[k] = canonicalizeJson(v);
      }
    }
    return sorted;
  }
  return value;
}

/**
 * Calcula o hash SHA-256 (hexadecimal de 64 caracteres) do JSON confirmado no ato médico
 * para preencher `prontuarios.assinatura_digital` junto com `confirmado_em` (Seção 7.2 item 4, G-07).
 */
export async function calcularHashSha256Prontuario(input: {
  petId: string;
  recordId: string;
  confirmadoEmIso: string;
  edited: ProntuarioIaResult;
  veterinario?: string;
  crmvResponsavel?: string;
}): Promise<string> {
  const payload = JSON.stringify(
    canonicalizeJson({
      petId: input.petId,
      recordId: input.recordId,
      confirmadoEm: input.confirmadoEmIso,
      veterinario: input.veterinario?.trim() || '',
      crmvResponsavel: input.crmvResponsavel?.trim() || '',
      edited: input.edited,
    })
  );

  const bytes = new TextEncoder().encode(payload);
  const hashBuffer = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Gera o path seguro no bucket privado `medical-files`: `{pet_id}/{record_id}/{arquivo}` (Seção 3.8).
 * Remove sequências de path traversal e caracteres inválidos do nome/extensão.
 */
export function buildMedicalFilePath(
  petId: string,
  recordId: string,
  fileName: string,
  nowMs: number = Date.now(),
  randStr: string = Math.random().toString(36).slice(2, 10)
): string {
  const cleanId = (val: string, label: string): string => {
    const sanitized = String(val || '').replace(/[^a-zA-Z0-9_-]/g, '');
    if (!sanitized) throw new Error(`Identificador inválido para path de storage: ${label}`);
    return sanitized;
  };

  const safePetId = cleanId(petId, 'petId');
  const safeRecordId = cleanId(recordId, 'recordId');
  const baseName = String(fileName || 'arquivo.bin').split(/[/\\]/).pop() || 'arquivo.bin';
  const rawExt = baseName.includes('.') ? baseName.split('.').pop() || 'bin' : 'bin';
  const safeExt = rawExt.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 10) || 'bin';
  const safeRand = String(randStr).replace(/[^a-zA-Z0-9]/g, '').slice(0, 12) || 'r0';

  return `${safePetId}/${safeRecordId}/${nowMs}_${safeRand}.${safeExt}`;
}

/** Infere o tipo de anexo a partir do MIME type ou nome do arquivo. */
export function inferAnexoType(mimeType?: string, fileName?: string): ProntuarioAnexoType {
  const t = (mimeType || '').toLowerCase();
  if (t.startsWith('audio/')) return 'audio';
  if (t.startsWith('image/')) return 'image';
  if (t === 'application/pdf') return 'pdf';
  if (t.startsWith('text/')) return 'txt';

  const ext = (fileName || '').split('.').pop()?.toLowerCase() || '';
  if (['webm', 'ogg', 'mp3', 'm4a', 'wav', 'aac'].includes(ext)) return 'audio';
  if (['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(ext)) return 'image';
  if (ext === 'pdf') return 'pdf';
  if (ext === 'txt') return 'txt';
  return 'other';
}

// ─── 6. Máquina de Estados Pura (Seção 9.3) ──────────────────────────────────

export type ProntuarioIaState =
  | { kind: 'idle' }
  | { kind: 'uploading' }
  | { kind: 'processing'; draftId: string }
  | { kind: 'ready'; draftId: string; draft: ProntuarioIaResult }
  | { kind: 'committing'; draftId: string }
  | { kind: 'committed' }
  | { kind: 'error'; message: string; draftId?: string };

export type ProntuarioIaEvent =
  | { type: 'RECORD_STOP'; audio?: Blob; petId: string }
  | { type: 'DRAFT_CREATED'; draftId: string }
  | { type: 'DRAFT_UPDATED'; row: DraftRow }
  | { type: 'CONFIRM'; edited: ProntuarioIaResult }
  | { type: 'COMMIT_OK' }
  | { type: 'FAIL'; message: string; draftId?: string }
  | { type: 'RESET' };

/**
 * Redutor puro de transições da máquina de estados (Seção 9.3).
 * Transições válidas:
 * - idle | error | committed -> uploading (em RECORD_STOP)
 * - uploading -> processing (em DRAFT_CREATED)
 * - processing -> ready (em DRAFT_UPDATED com status='ready')
 * - processing -> error (em DRAFT_UPDATED com status='error' ou FAIL)
 * - ready -> committing (em CONFIRM)
 * - committing -> committed (em COMMIT_OK) | error (em FAIL)
 * - qualquer -> idle (em RESET)
 */
export function transitionProntuarioIaState(
  state: ProntuarioIaState,
  event: ProntuarioIaEvent
): ProntuarioIaState {
  switch (event.type) {
    case 'RESET':
      return { kind: 'idle' };

    case 'FAIL': {
      const currentDraftId =
        event.draftId ??
        ('draftId' in state && typeof state.draftId === 'string' ? state.draftId : undefined);
      return currentDraftId
        ? { kind: 'error', message: event.message, draftId: currentDraftId }
        : { kind: 'error', message: event.message };
    }

    case 'RECORD_STOP': {
      if (state.kind === 'idle' || state.kind === 'error' || state.kind === 'committed') {
        return { kind: 'uploading' };
      }
      return state;
    }

    case 'DRAFT_CREATED': {
      if (state.kind === 'uploading') {
        return { kind: 'processing', draftId: event.draftId };
      }
      return state;
    }

    case 'DRAFT_UPDATED': {
      if (state.kind !== 'processing' || state.draftId !== event.row.id) {
        return state;
      }
      if (event.row.status === 'ready') {
        const rawPayload =
          event.row.payload && typeof event.row.payload === 'object'
            ? {
                ...(event.row.payload as Record<string, unknown>),
                transcript:
                  (event.row.payload as Record<string, unknown>).transcript ??
                  event.row.transcript ??
                  undefined,
              }
            : { transcript: event.row.transcript ?? undefined };
        return {
          kind: 'ready',
          draftId: event.row.id,
          draft: coerceProntuarioIaResult(rawPayload),
        };
      }
      if (event.row.status === 'error') {
        return {
          kind: 'error',
          draftId: event.row.id,
          message: event.row.error_message?.trim() || 'Falha ao processar o áudio na IA.',
        };
      }
      return state;
    }

    case 'CONFIRM': {
      if (state.kind === 'ready') {
        return { kind: 'committing', draftId: state.draftId };
      }
      return state;
    }

    case 'COMMIT_OK': {
      if (state.kind === 'committing') {
        return { kind: 'committed' };
      }
      return state;
    }

    default:
      return state;
  }
}

// ─── 7. Portas (Interfaces Agnósticas — Seção 9.2) ──────────────────────────

export interface ProntuarioRepository {
  ensureActiveRecord(petId: string): Promise<{ id: string }>;
  appendAnexo(recordId: string, anexo: ProntuarioAnexo): Promise<ProntuarioAnexo>;
  createDraft(input: {
    petId: string;
    recordId: string;
    audioAnexoId: string;
    audioPath: string;
  }): Promise<string>;
  getDraft(draftId: string): Promise<DraftRow | null>;
  markDraftCommitted(draftId: string): Promise<void>;
  commitRecord(input: CommitInput): Promise<void>;
}

export interface ProntuarioStorage {
  /** Sobe arquivo no path `{pet_id}/{record_id}/{arquivo}` (Seção 3.8). */
  upload(path: string, file: Blob): Promise<void>;
  /** Gera signed URL; DEVE lançar erro se falhar (nunca retornar null/path — G-12). */
  signedUrl(path: string, ttlSeconds: number): Promise<string>;
}

export interface AiGateway {
  requestProcessing(req: ProntuarioIaRequest, webhookUrl: string): Promise<void>;
}

export interface DraftSubscription {
  subscribe(onUpdate: (row: DraftRow) => void): () => void;
  stop(): void;
}

/** Entrega eventos de atualização de UM rascunho (Realtime, polling ou SSE — Seção 9.2). */
export interface DraftWatcher {
  watch(draftId: string): DraftSubscription;
}

export interface AppSettings {
  /** Sem URL padrão fixa no código (G-02). Retorna null se não configurado. */
  getWebhookUrl(): string | null;
  /** Retorna o prompt configurado ou `DEFAULT_PRONTUARIO_IA_SYSTEM_PROMPT`. */
  getSystemPrompt(): string;
  getVeterinario(): { nome?: string; crmv?: string };
}

export interface PetDirectory {
  getPetContext(petId: string): Promise<{ name?: string; species?: string } | null>;
}

export interface ProntuarioIaPorts {
  repository: ProntuarioRepository;
  storage: ProntuarioStorage;
  aiGateway: AiGateway;
  draftWatcher: DraftWatcher;
  settings: AppSettings;
  petDirectory: PetDirectory;
}

// ─── 8. Orquestrador Agnóstico sobre as Portas (Seções 2, 6, 8 e 9) ─────────

export interface ProntuarioIaController {
  getState(): ProntuarioIaState;
  getRecordId(): string | null;
  getLastAudio(): { petId: string; audio: Blob; fileName: string } | null;
  subscribe(listener: (state: ProntuarioIaState) => void): () => void;
  processAudio(petId: string, audio: Blob, fileName?: string): Promise<void>;
  retryLastAudio(): Promise<void>;
  confirm(petId: string, recordId: string, edited: ProntuarioIaResult): Promise<void>;
  uploadManualAttachment(petId: string, recordId: string, file: Blob, fileName: string): Promise<ProntuarioAnexo>;
  reset(): void;
  dispose(): void;
}

/**
 * Cria uma instância isolada do controlador de Prontuário com IA operando exclusivamente
 * sobre as portas injetadas (sem dependência direta de Supabase, fetch ou React).
 */
export function createProntuarioIaController(
  ports: ProntuarioIaPorts,
  options?: {
    timeoutMs?: number;
  }
): ProntuarioIaController {
  let state: ProntuarioIaState = { kind: 'idle' };
  let currentRecordId: string | null = null;
  let lastAudio: { petId: string; audio: Blob; fileName: string } | null = null;
  let activeSubscription: DraftSubscription | null = null;
  let activeUnsubscribe: (() => void) | null = null;
  let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
  const listeners = new Set<(s: ProntuarioIaState) => void>();
  const timeoutMs = options?.timeoutMs ?? PRONTUARIO_IA_PROCESSING_TIMEOUT_MS;

  const notify = () => {
    for (const listener of listeners) {
      listener(state);
    }
  };

  const dispatch = (event: ProntuarioIaEvent) => {
    state = transitionProntuarioIaState(state, event);
    notify();
  };

  const teardownWatcher = () => {
    if (timeoutHandle !== null) {
      clearTimeout(timeoutHandle);
      timeoutHandle = null;
    }
    if (activeUnsubscribe) {
      activeUnsubscribe();
      activeUnsubscribe = null;
    }
    if (activeSubscription) {
      activeSubscription.stop();
      activeSubscription = null;
    }
  };

  const handleDraftRow = (row: DraftRow) => {
    if (state.kind !== 'processing' || state.draftId !== row.id) return;
    if (row.status === 'ready' || row.status === 'error') {
      teardownWatcher();
      dispatch({ type: 'DRAFT_UPDATED', row });
    }
  };

  const startWatching = (draftId: string) => {
    teardownWatcher();
    const sub = ports.draftWatcher.watch(draftId);
    activeSubscription = sub;
    activeUnsubscribe = sub.subscribe((row) => {
      handleDraftRow(row);
    });

    timeoutHandle = setTimeout(() => {
      if (state.kind === 'processing' && state.draftId === draftId) {
        teardownWatcher();
        dispatch({
          type: 'FAIL',
          draftId,
          message: 'Tempo limite de 90s excedido aguardando o processamento da IA. Você pode tentar novamente reutilizando o mesmo áudio.',
        });
      }
    }, timeoutMs);
  };

  const processAudio = async (
    petId: string,
    audio: Blob,
    fileName = `consulta_${Date.now()}.webm`
  ): Promise<void> => {
    lastAudio = { petId, audio, fileName };

    const webhookUrl = ports.settings.getWebhookUrl();
    if (!webhookUrl || !webhookUrl.trim()) {
      dispatch({
        type: 'FAIL',
        message: 'O serviço de IA do prontuário não está disponível nesta instalação.',
      });
      return;
    }

    teardownWatcher();
    dispatch({ type: 'RECORD_STOP', audio, petId });

    try {
      // [2] Garantir prontuário ativo do pet
      const record = await ports.repository.ensureActiveRecord(petId);
      currentRecordId = record.id;

      // [3] Upload do áudio para bucket privado `medical-files` (path: pet_id/record_id/arquivo)
      const audioPath = buildMedicalFilePath(petId, record.id, fileName);
      await ports.storage.upload(audioPath, audio);

      // [4] Anexar em `prontuarios.anexos[]`
      const anexoId = `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
      const anexo: ProntuarioAnexo = {
        id: anexoId,
        url: audioPath,
        name: fileName,
        type: 'audio',
        origem: 'audio_consulta',
        uploadedAt: new Date().toISOString(),
      };
      const savedAnexo = await ports.repository.appendAnexo(record.id, anexo);

      // [5] INSERT em `prontuario_ia_drafts` (status='pending')
      const draftId = await ports.repository.createDraft({
        petId,
        recordId: record.id,
        audioAnexoId: savedAnexo.id,
        audioPath,
      });

      // [6] Inscreve-se no evento de UPDATE do draft + 1 leitura imediata de corrida
      dispatch({ type: 'DRAFT_CREATED', draftId });
      startWatching(draftId);

      const immediateRow = await ports.repository.getDraft(draftId);
      if (immediateRow && (immediateRow.status === 'ready' || immediateRow.status === 'error')) {
        handleDraftRow(immediateRow);
        return;
      }

      // [7] Gera signed URL (TTL curto de 15 min — G-08; lança se falhar — G-12) e faz POST no webhook
      const signedAudioUrl = await ports.storage.signedUrl(audioPath, MEDICAL_FILES_SIGNED_TTL);
      if (!signedAudioUrl || !signedAudioUrl.trim()) {
        throw new Error('Não foi possível gerar a URL assinada do áudio.');
      }

      const petCtx = await ports.petDirectory.getPetContext(petId);
      const vet = ports.settings.getVeterinario();

      const request: ProntuarioIaRequest = {
        draftId,
        petId,
        recordId: record.id,
        audioUrl: signedAudioUrl,
        audioAnexoId: savedAnexo.id,
        systemPrompt: ports.settings.getSystemPrompt() || DEFAULT_PRONTUARIO_IA_SYSTEM_PROMPT,
        context: {
          ...(petCtx?.species ? { species: petCtx.species } : {}),
          ...(petCtx?.name ? { petName: petCtx.name } : {}),
          ...(vet.nome ? { veterinario: vet.nome } : {}),
          ...(vet.crmv ? { crmvResponsavel: vet.crmv } : {}),
        },
      };

      await ports.aiGateway.requestProcessing(request, webhookUrl.trim());
    } catch (err) {
      teardownWatcher();
      const msg = err instanceof Error ? err.message : 'Falha ao enviar áudio para processamento.';
      dispatch({ type: 'FAIL', message: msg });
    }
  };

  const retryLastAudio = async (): Promise<void> => {
    if (!lastAudio) {
      dispatch({
        type: 'FAIL',
        message: 'Nenhum áudio anterior disponível para nova tentativa.',
      });
      return;
    }
    await processAudio(lastAudio.petId, lastAudio.audio, lastAudio.fileName);
  };

  const confirm = async (
    petId: string,
    recordId: string,
    editedRaw: ProntuarioIaResult
  ): Promise<void> => {
    const draftId = state.kind === 'ready' ? state.draftId : undefined;
    const edited = coerceProntuarioIaResult(editedRaw);

    dispatch({ type: 'CONFIRM', edited });

    try {
      const confirmadoEmIso = new Date().toISOString();
      const vet = ports.settings.getVeterinario();
      const hashSha256 = await calcularHashSha256Prontuario({
        petId,
        recordId,
        confirmadoEmIso,
        edited,
        veterinario: vet.nome,
        crmvResponsavel: vet.crmv,
      });

      let transcriptAnexo: ProntuarioAnexo | null = null;
      if (edited.transcript) {
        const transcriptFileName = `transcricao_${Date.now()}.txt`;
        const transcriptPath = buildMedicalFilePath(petId, recordId, transcriptFileName);
        const transcriptBlob = new Blob([edited.transcript], { type: 'text/plain;charset=utf-8' });
        await ports.storage.upload(transcriptPath, transcriptBlob);
        transcriptAnexo = {
          id: `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
          url: transcriptPath,
          name: transcriptFileName,
          type: 'transcript',
          origem: 'transcricao',
          uploadedAt: confirmadoEmIso,
        };
      }

      // Executa o commit transacional (prontuarios + anexo transcript + internacoes/eventos + draft committed)
      await ports.repository.commitRecord({
        petId,
        recordId,
        draftId,
        edited,
        confirmadoEm: confirmadoEmIso,
        hashSha256,
        transcriptAnexo,
        veterinario: vet.nome,
        crmvResponsavel: vet.crmv,
      });

      teardownWatcher();
      dispatch({ type: 'COMMIT_OK' });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Falha ao confirmar e salvar o prontuário.';
      dispatch({ type: 'FAIL', message: msg, draftId });
    }
  };

  const uploadManualAttachment = async (
    petId: string,
    recordId: string,
    file: Blob,
    fileName: string
  ): Promise<ProntuarioAnexo> => {
    const path = buildMedicalFilePath(petId, recordId, fileName);
    await ports.storage.upload(path, file);
    const anexo: ProntuarioAnexo = {
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
      url: path,
      name: fileName,
      type: inferAnexoType(file.type, fileName),
      origem: 'upload_manual',
      uploadedAt: new Date().toISOString(),
    };
    return ports.repository.appendAnexo(recordId, anexo);
  };

  const reset = () => {
    teardownWatcher();
    dispatch({ type: 'RESET' });
  };

  const dispose = () => {
    teardownWatcher();
    listeners.clear();
  };

  return {
    getState: () => state,
    getRecordId: () => currentRecordId,
    getLastAudio: () => lastAudio,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    processAudio,
    retryLastAudio,
    confirm,
    uploadManualAttachment,
    reset,
    dispose,
  };
}
