/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Adaptadores Supabase e HTTP para as portas do núcleo de Prontuário com IA (Seção 9.2 e 9.5).
 *
 * - Nenhum log de `audioUrl` ou payload clínico (G-01).
 * - Sem URL de webhook padrão fixa no código (G-02).
 * - Signed URL lança erro explícito se falhar (G-12).
 * - Realtime com reconexão automática e polling de contingência limpo no `stop()` (G-11, Seção 9.5).
 * - Commit transacional via RPC `public.confirmar_prontuario_ia` (G-06, G-07, G-14).
 */

import { supabase } from '@/integrations/supabase/client';
import {
  type ProntuarioRepository,
  type ProntuarioStorage,
  type AiGateway,
  type DraftWatcher,
  type DraftSubscription,
  type AppSettings,
  type PetDirectory,
  type ProntuarioIaPorts,
  type ProntuarioAnexo,
  type DraftRow,
  type CommitInput,
  type ProntuarioIaRequest,
  type MedicalRecord,
  type Internacao,
  type InternacaoEvento,
  type PetCadastro,
  type ConsentimentoProntuarioIa,
  MEDICAL_FILES_BUCKET,
  DEFAULT_PRONTUARIO_IA_SYSTEM_PROMPT,
  PRONTUARIO_IA_POLL_INTERVAL_MS,
  PRONTUARIO_IA_MAX_POLL_ATTEMPTS,
  TERMO_CONSENTIMENTO_IA_VERSAO,
  TERMO_CONSENTIMENTO_IA_OPERADORES,
} from '@/lib/prontuarioIaCore';

export interface ProntuarioIaConfigRow {
  id: number;
  webhook_url: string | null;
  system_prompt: string | null;
  veterinario_nome: string | null;
  crmv_responsavel: string | null;
  retencao_dias: number | null;
  updated_at?: string | null;
}

const db = supabase as unknown as {
  from: (table: string) => any;
  rpc: (fn: string, args?: Record<string, unknown>) => Promise<{ data: any; error: any }>;
  storage: typeof supabase.storage;
  channel: typeof supabase.channel;
  removeChannel: typeof supabase.removeChannel;
};

// ─── 1. Adaptador ProntuarioRepository (Seção 9.2) ───────────────────────────

export class SupabaseProntuarioRepository implements ProntuarioRepository {
  async ensureActiveRecord(petId: string): Promise<{ id: string }> {
    const { data: existing, error: fetchErr } = await db
      .from('prontuarios')
      .select('id, status')
      .eq('pet_id', petId)
      .eq('status', 'em_andamento')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (fetchErr) {
      throw new Error(fetchErr.message || 'Falha ao buscar prontuário ativo.');
    }

    if (existing?.id) {
      return { id: String(existing.id) };
    }

    const { data: created, error: createErr } = await db
      .from('prontuarios')
      .insert({
        pet_id: petId,
        motivo_consulta: 'Nova Consulta',
        tipo_atendimento: 'consulta',
        status: 'em_andamento',
      })
      .select('id')
      .single();

    if (createErr || !created?.id) {
      throw new Error(createErr?.message || 'Falha ao criar prontuário em andamento.');
    }

    return { id: String(created.id) };
  }

  async appendAnexo(recordId: string, anexo: ProntuarioAnexo): Promise<ProntuarioAnexo> {
    const { data: row, error: readErr } = await db
      .from('prontuarios')
      .select('anexos')
      .eq('id', recordId)
      .maybeSingle();

    if (readErr) {
      throw new Error(readErr.message || 'Falha ao ler anexos do prontuário.');
    }

    const currentList: ProntuarioAnexo[] = Array.isArray(row?.anexos) ? row.anexos : [];
    const updatedList = [...currentList, anexo];

    const { error: updateErr } = await db
      .from('prontuarios')
      .update({
        anexos: updatedList,
        updated_at: new Date().toISOString(),
      })
      .eq('id', recordId);

    if (updateErr) {
      throw new Error(updateErr.message || 'Falha ao anexar arquivo ao prontuário.');
    }

    return anexo;
  }

  async createDraft(input: {
    petId: string;
    recordId: string;
    audioAnexoId: string;
    audioPath: string;
  }): Promise<string> {
    const { data, error } = await db
      .from('prontuario_ia_drafts')
      .upsert(
        {
          pet_id: input.petId,
          prontuario_id: input.recordId,
          audio_anexo_id: input.audioAnexoId,
          audio_path: input.audioPath,
          status: 'pending',
          error_message: null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'prontuario_id,audio_anexo_id' }
      )
      .select('id')
      .single();

    if (error || !data?.id) {
      throw new Error(error?.message || 'Falha ao registrar rascunho de IA.');
    }

    return String(data.id);
  }

  async getDraft(draftId: string): Promise<DraftRow | null> {
    const { data, error } = await db
      .from('prontuario_ia_drafts')
      .select('*')
      .eq('id', draftId)
      .maybeSingle();

    if (error) {
      throw new Error(error.message || 'Falha ao consultar rascunho de IA.');
    }

    return (data as DraftRow) ?? null;
  }

  async markDraftCommitted(draftId: string): Promise<void> {
    const { data, error } = await db
      .from('prontuario_ia_drafts')
      .update({
        status: 'committed',
        updated_at: new Date().toISOString(),
      })
      .eq('id', draftId)
      .select('id')
      .maybeSingle();

    if (error || !data?.id) {
      throw new Error(error?.message || 'Falha ao marcar rascunho como confirmado (committed).');
    }
  }

  /**
   * Executa o commit transacional via RPC `public.confirmar_prontuario_ia` (Seção 6, G-06, G-07, G-14).
   * Se qualquer passo falhar (prontuário, anexo, internação ou draft), toda a transação sofre rollback.
   */
  async commitRecord(input: CommitInput): Promise<void> {
    const { error } = await db.rpc('confirmar_prontuario_ia', {
      p_pet_id: input.petId,
      p_record_id: input.recordId,
      p_draft_id: input.draftId ?? null,
      p_edited: input.edited as unknown as Record<string, unknown>,
      p_hash_sha256: input.hashSha256,
      p_confirmado_em: input.confirmadoEm,
      p_transcript_anexo: input.transcriptAnexo ?? null,
      p_veterinario: input.veterinario ?? null,
      p_crmv_responsavel: input.crmvResponsavel ?? null,
    });

    if (error) {
      throw new Error(error.message || 'Falha na confirmação transacional do prontuário.');
    }
  }
}

// ─── 2. Adaptador ProntuarioStorage (Seção 3.8, 9.2 e G-12) ─────────────────

export class SupabaseProntuarioStorage implements ProntuarioStorage {
  async upload(path: string, file: Blob): Promise<void> {
    const { error } = await db.storage.from(MEDICAL_FILES_BUCKET).upload(path, file, {
      upsert: false,
      contentType: file.type || 'application/octet-stream',
    });

    if (error) {
      throw new Error(error.message || 'Falha no upload do arquivo para o bucket medical-files.');
    }
  }

  async signedUrl(path: string, ttlSeconds: number): Promise<string> {
    const { data, error } = await db.storage
      .from(MEDICAL_FILES_BUCKET)
      .createSignedUrl(path, ttlSeconds);

    if (error || !data?.signedUrl) {
      throw new Error(error?.message || 'Falha ao gerar URL assinada do arquivo médico.');
    }

    return data.signedUrl;
  }
}

// ─── 3. Adaptador AiGateway (Seção 4.1, 9.2 e G-01) ──────────────────────────

/** Edge Function do próprio projeto que transcreve e estrutura a consulta (sem n8n). */
export const PRONTUARIO_IA_EDGE_FUNCTION = 'prontuario-ia-webhook';

/**
 * Chama a Edge Function pelo client do Supabase, que envia o JWT do usuário logado.
 * Um `fetch` simples sem Authorization é recusado (401) pelo gateway das Edge Functions.
 */
export class SupabaseFunctionAiGateway implements AiGateway {
  async requestProcessing(req: ProntuarioIaRequest, functionName: string): Promise<void> {
    // G-01: NUNCA logar req, audioUrl ou dados clínicos no console.
    const { error } = await supabase.functions.invoke(functionName, { body: req });
    if (!error) return;

    let detalhe = '';
    try {
      const corpo = await (error as { context?: Response }).context?.json();
      if (corpo && typeof corpo.error === 'string') detalhe = corpo.error;
    } catch {
      // Resposta sem JSON: fica a mensagem genérica.
    }
    throw new Error(
      detalhe === 'unauthorized'
        ? 'Sua sessão não tem permissão para usar a IA do prontuário. Entre novamente com um usuário da equipe.'
        : detalhe || 'O serviço de IA do prontuário não respondeu. Tente de novo em instantes.'
    );
  }
}

// ─── 4. Adaptador DraftWatcher (Seção 9.2, 9.5 e G-11) ───────────────────────

export class SupabaseDraftWatcher implements DraftWatcher {
  private readonly repository: ProntuarioRepository;
  private readonly pollIntervalMs: number;
  private readonly maxPollAttempts: number;

  constructor(
    repository: ProntuarioRepository,
    options?: { pollIntervalMs?: number; maxPollAttempts?: number }
  ) {
    this.repository = repository;
    this.pollIntervalMs = options?.pollIntervalMs ?? PRONTUARIO_IA_POLL_INTERVAL_MS;
    this.maxPollAttempts = options?.maxPollAttempts ?? PRONTUARIO_IA_MAX_POLL_ATTEMPTS;
  }

  watch(draftId: string): DraftSubscription {
    const listeners = new Set<(row: DraftRow) => void>();
    let stopped = false;
    let pollTimer: ReturnType<typeof setInterval> | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let channel: ReturnType<typeof db.channel> | null = null;
    let attempts = 0;

    const emit = (row: DraftRow | null) => {
      if (stopped || !row || row.id !== draftId) return;
      for (const cb of listeners) {
        cb(row);
      }
    };

    const pollOnce = async () => {
      if (stopped) return;
      try {
        const row = await this.repository.getDraft(draftId);
        if (row) emit(row);
      } catch {
        // Silencia erro transitório de rede durante polling de contingência
      }
    };

    const removeChannelSafe = () => {
      if (channel) {
        const ch = channel;
        channel = null;
        void db.removeChannel(ch);
      }
    };

    const openChannel = () => {
      if (stopped) return;
      removeChannelSafe();

      channel = db
        .channel(`pia-draft-${draftId}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'prontuario_ia_drafts',
            filter: `id=eq.${draftId}`,
          },
          (payload) => {
            if (payload?.new) {
              emit(payload.new as DraftRow);
            }
          }
        )
        .subscribe((status: string) => {
          if (stopped) return;
          if (status === 'CLOSED' || status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            if (reconnectTimer) clearTimeout(reconnectTimer);
            reconnectTimer = setTimeout(() => {
              if (!stopped) openChannel();
            }, 1500);
          }
        });
    };

    openChannel();
    void pollOnce();

    pollTimer = setInterval(() => {
      if (stopped) return;
      attempts += 1;
      if (attempts > this.maxPollAttempts) {
        if (pollTimer) {
          clearInterval(pollTimer);
          pollTimer = null;
        }
        return;
      }
      void pollOnce();
    }, this.pollIntervalMs);

    const stop = () => {
      if (stopped) return;
      stopped = true;
      if (pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
      }
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
      removeChannelSafe();
      listeners.clear();
    };

    return {
      subscribe: (onUpdate) => {
        if (stopped) return () => undefined;
        listeners.add(onUpdate);
        return () => {
          listeners.delete(onUpdate);
        };
      },
      stop,
    };
  }
}

// ─── 5. Adaptador AppSettings (Seção 3.10, 9.2 e G-02) ──────────────────────

export class MutableAppSettings implements AppSettings {
  private config: ProntuarioIaConfigRow = {
    id: 1,
    webhook_url: null,
    system_prompt: null,
    veterinario_nome: null,
    crmv_responsavel: null,
    retencao_dias: 90,
  };

  constructor(initial?: Partial<ProntuarioIaConfigRow>) {
    if (initial) {
      this.config = { ...this.config, ...initial };
    }
  }

  setConfig(next: Partial<ProntuarioIaConfigRow>): void {
    this.config = { ...this.config, ...next };
  }

  getConfig(): ProntuarioIaConfigRow {
    return { ...this.config };
  }

  /**
   * O processamento roda sempre na Edge Function deste projeto; `webhook_url` do banco
   * fica sem uso (não há mais n8n nem URL externa para configurar).
   */
  getWebhookUrl(): string | null {
    return PRONTUARIO_IA_EDGE_FUNCTION;
  }

  getSystemPrompt(): string {
    const custom = this.config.system_prompt?.trim();
    return custom ? custom : DEFAULT_PRONTUARIO_IA_SYSTEM_PROMPT;
  }

  getVeterinario(): { nome?: string; crmv?: string } {
    return {
      ...(this.config.veterinario_nome?.trim()
        ? { nome: this.config.veterinario_nome.trim() }
        : {}),
      ...(this.config.crmv_responsavel?.trim()
        ? { crmv: this.config.crmv_responsavel.trim() }
        : {}),
    };
  }
}

// ─── 6. Adaptador PetDirectory (Seção 3.9, 4.1, 7.1 e 9.2) ──────────────────

export class SupabasePetDirectory implements PetDirectory {
  /**
   * Minimização LGPD (Seção 4.1 e 7.1): envia apenas nome do pet e espécie para a IA,
   * nunca dados pessoais do tutor (nome, telefone, CPF).
   */
  async getPetContext(petId: string): Promise<{ name?: string; species?: string } | null> {
    const { data, error } = await db
      .from('pets')
      .select('nome, especie')
      .eq('id', petId)
      .maybeSingle();

    if (error || !data) return null;
    return {
      ...(data.nome ? { name: String(data.nome) } : {}),
      ...(data.especie ? { species: String(data.especie) } : {}),
    };
  }
}

export function createDefaultSupabasePorts(settings?: MutableAppSettings): {
  ports: ProntuarioIaPorts;
  settings: MutableAppSettings;
} {
  const repository = new SupabaseProntuarioRepository();
  const storage = new SupabaseProntuarioStorage();
  const aiGateway = new SupabaseFunctionAiGateway();
  const draftWatcher = new SupabaseDraftWatcher(repository);
  const appSettings = settings ?? new MutableAppSettings();
  const petDirectory = new SupabasePetDirectory();

  return {
    ports: {
      repository,
      storage,
      aiGateway,
      draftWatcher,
      settings: appSettings,
      petDirectory,
    },
    settings: appSettings,
  };
}

// ─── 7. Operações Auxiliares de Leitura e Gestão para a UI ───────────────────

export async function carregarConfigProntuarioIa(): Promise<ProntuarioIaConfigRow> {
  try {
    const { data, error } = await db
      .from('prontuario_ia_config')
      .select('*')
      .eq('id', 1)
      .maybeSingle();

    if (error) {
      console.warn('[ProntuarioIA] Config não carregada (usando padrão):', error.message);
    }

    return {
      id: 1,
      webhook_url: data?.webhook_url ?? null,
      system_prompt: data?.system_prompt ?? null,
      veterinario_nome: data?.veterinario_nome ?? null,
      crmv_responsavel: data?.crmv_responsavel ?? null,
      retencao_dias: data?.retencao_dias ?? 90,
      updated_at: data?.updated_at ?? null,
    };
  } catch (err) {
    console.warn('[ProntuarioIA] Erro ao carregar config:', err);
    return {
      id: 1,
      webhook_url: null,
      system_prompt: null,
      veterinario_nome: null,
      crmv_responsavel: null,
      retencao_dias: 90,
      updated_at: null,
    };
  }
}

export async function salvarConfigProntuarioIa(
  input: Partial<Omit<ProntuarioIaConfigRow, 'id'>>
): Promise<ProntuarioIaConfigRow> {
  const payload = {
    id: 1,
    webhook_url: input.webhook_url?.trim() || null,
    system_prompt: input.system_prompt?.trim() || null,
    veterinario_nome: input.veterinario_nome?.trim() || null,
    crmv_responsavel: input.crmv_responsavel?.trim() || null,
    retencao_dias: input.retencao_dias ?? 90,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await db
    .from('prontuario_ia_config')
    .upsert(payload, { onConflict: 'id' })
    .select('*')
    .single();

  if (error) {
    throw new Error(error.message || 'Falha ao salvar configuração do Prontuário com IA.');
  }

  return data as ProntuarioIaConfigRow;
}

export async function listarPetsCadastro(): Promise<PetCadastro[]> {
  try {
    const { data: petsRows, error } = await db
      .from('pets')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(200);

    if (error) {
      console.warn('[ProntuarioIA] Falha ao listar pets (tabela pode estar inicializando):', error.message);
      return [];
    }

    // Busca só os tutores dos pets listados (antes vinham os 200 clientes mais novos e
    // pets de tutores antigos apareciam como "Não vinculado").
    const tutorIds = Array.isArray(petsRows)
      ? [...new Set(petsRows.map((p: any) => p.tutor_id).filter((id: unknown) => typeof id === 'number'))]
      : [];
    const { data: clientesRows } = tutorIds.length
      ? await db.from('dados_cliente').select('id, nome, telefone').in('id', tutorIds)
      : { data: [] };

    const clienteMap = new Map<number, { nome?: string | null; telefone?: string | null }>();
    if (Array.isArray(clientesRows)) {
      for (const c of clientesRows) {
        if (typeof c.id === 'number') {
          clienteMap.set(c.id, { nome: c.nome, telefone: c.telefone });
        }
      }
    }

    if (!Array.isArray(petsRows)) return [];

    return petsRows.map((p: any) => {
      const tutor = typeof p.tutor_id === 'number' ? clienteMap.get(p.tutor_id) : undefined;
      return {
        id: String(p.id),
        nome: String(p.nome || 'Pet'),
        especie: String(p.especie || 'canina'),
        raca: p.raca ?? null,
        sexo: p.sexo ?? 'macho',
        idade: p.idade != null ? Number(p.idade) : null,
        peso: p.peso != null ? Number(p.peso) : null,
        data_nascimento: p.data_nascimento ?? null,
        porte: p.porte ?? null,
        castrado: Boolean(p.castrado),
        microchip: p.microchip ?? null,
        status: p.status ?? 'ativo',
        image_url: p.image_url ?? null,
        observacoes: p.observacoes ?? null,
        tutor_id: typeof p.tutor_id === 'number' ? p.tutor_id : null,
        tutor_nome: tutor?.nome ?? null,
        tutor_telefone: tutor?.telefone ?? null,
      };
    });
  } catch (err) {
    console.warn('[ProntuarioIA] Erro ao listar pets:', err);
    return [];
  }
}

export async function criarOuAtualizarPet(input: {
  id?: string;
  nome: string;
  especie: string;
  raca?: string | null;
  sexo?: string | null;
  idade?: number | null;
  peso?: number | null;
  porte?: string | null;
  castrado?: boolean;
  microchip?: string | null;
  observacoes?: string | null;
  tutor_id?: number | null;
  tutor_nome?: string | null;
  tutor_telefone?: string | null;
}): Promise<PetCadastro> {
  let tutorId = input.tutor_id ?? null;

  if (!tutorId && input.tutor_nome?.trim()) {
    const { data: cliCreated } = await db
      .from('dados_cliente')
      .insert({
        nome: input.tutor_nome.trim(),
        telefone: input.tutor_telefone?.trim() || null,
        nome_pet: input.nome.trim(),
        raca_pet: input.raca?.trim() || null,
        porte_pet: input.porte?.trim() || null,
      })
      .select('id')
      .maybeSingle();

    if (cliCreated?.id) {
      tutorId = Number(cliCreated.id);
    }
  }

  const rowPayload: Record<string, unknown> = {
    nome: input.nome.trim(),
    especie: input.especie || 'canina',
    raca: input.raca?.trim() || null,
    sexo: input.sexo || 'macho',
    idade: input.idade ?? null,
    peso: input.peso ?? null,
    porte: input.porte?.trim() || null,
    castrado: Boolean(input.castrado),
    microchip: input.microchip?.trim() || null,
    observacoes: input.observacoes?.trim() || null,
    tutor_id: tutorId,
    updated_at: new Date().toISOString(),
  };

  if (input.id) {
    rowPayload.id = input.id;
  }

  const { data, error } = await db
    .from('pets')
    .upsert(rowPayload, { onConflict: 'id' })
    .select('*')
    .single();

  if (error || !data) {
    throw new Error(error?.message || 'Falha ao salvar cadastro do pet.');
  }

  return {
    id: String(data.id),
    nome: String(data.nome),
    especie: String(data.especie),
    raca: data.raca ?? null,
    sexo: data.sexo ?? null,
    idade: data.idade != null ? Number(data.idade) : null,
    peso: data.peso != null ? Number(data.peso) : null,
    porte: data.porte ?? null,
    castrado: Boolean(data.castrado),
    microchip: data.microchip ?? null,
    observacoes: data.observacoes ?? null,
    tutor_id: data.tutor_id ?? null,
    tutor_nome: input.tutor_nome ?? null,
    tutor_telefone: input.tutor_telefone ?? null,
  };
}

export async function carregarProntuariosDoPet(petId: string): Promise<MedicalRecord[]> {
  const { data, error } = await db
    .from('prontuarios')
    .select('*')
    .eq('pet_id', petId)
    .order('data_consulta', { ascending: false });

  if (error) {
    throw new Error(error.message || 'Falha ao carregar prontuários do pet.');
  }

  return (data || []) as MedicalRecord[];
}

export async function atualizarProntuarioDireto(
  recordId: string,
  updates: Partial<MedicalRecord>
): Promise<MedicalRecord> {
  const { data, error } = await db
    .from('prontuarios')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', recordId)
    .select('*')
    .single();

  if (error || !data) {
    throw new Error(error?.message || 'Falha ao atualizar prontuário.');
  }

  return data as MedicalRecord;
}

export async function carregarInternacaoDoPet(petId: string): Promise<{
  internacao: Internacao | null;
  eventos: InternacaoEvento[];
}> {
  const { data: intRow, error: intErr } = await db
    .from('internacoes')
    .select('*')
    .eq('pet_id', petId)
    .order('data_entrada', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (intErr) {
    throw new Error(intErr.message || 'Falha ao buscar internação do pet.');
  }

  if (!intRow?.id) {
    return { internacao: null, eventos: [] };
  }

  const { data: evRows, error: evErr } = await db
    .from('internacao_eventos')
    .select('*')
    .eq('internacao_id', intRow.id)
    .order('horario', { ascending: false });

  if (evErr) {
    throw new Error(evErr.message || 'Falha ao buscar eventos da internação.');
  }

  return {
    internacao: intRow as Internacao,
    eventos: (evRows || []) as InternacaoEvento[],
  };
}

export async function salvarInternacaoManual(
  petId: string,
  input: Partial<Internacao> & { id?: string }
): Promise<Internacao> {
  if (input.id) {
    const { data, error } = await db
      .from('internacoes')
      .update({
        motivo: input.motivo ?? null,
        box: input.box ?? null,
        previsao_alta: input.previsao_alta || null,
        status: input.status || 'internado',
        objetos_com_pet: input.objetos_com_pet ?? null,
        alergias: input.alergias ?? null,
        sintomas_entrada: input.sintomas_entrada ?? null,
        observacoes: input.observacoes ?? null,
        responsavel: input.responsavel ?? null,
        crmv_responsavel: input.crmv_responsavel ?? null,
        data_alta: input.status === 'alta' ? new Date().toISOString() : input.data_alta ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', input.id)
      .select('*')
      .single();

    if (error || !data) throw new Error(error?.message || 'Falha ao atualizar internação.');
    return data as Internacao;
  }

  const { data, error } = await db
    .from('internacoes')
    .insert({
      pet_id: petId,
      prontuario_id: input.prontuario_id ?? null,
      motivo: input.motivo ?? null,
      box: input.box ?? null,
      previsao_alta: input.previsao_alta || null,
      status: input.status || 'internado',
      objetos_com_pet: input.objetos_com_pet ?? null,
      alergias: input.alergias ?? null,
      sintomas_entrada: input.sintomas_entrada ?? null,
      observacoes: input.observacoes ?? null,
      responsavel: input.responsavel ?? null,
      crmv_responsavel: input.crmv_responsavel ?? null,
    })
    .select('*')
    .single();

  if (error || !data) throw new Error(error?.message || 'Falha ao criar internação.');
  return data as Internacao;
}

export async function adicionarEventoInternacaoManual(
  internacaoId: string,
  evento: Omit<InternacaoEvento, 'id' | 'internacao_id' | 'created_at'>
): Promise<InternacaoEvento> {
  const { data, error } = await db
    .from('internacao_eventos')
    .insert({
      internacao_id: internacaoId,
      tipo: evento.tipo || 'evolucao',
      descricao: evento.descricao ?? null,
      temperatura: evento.temperatura ?? null,
      frequencia_cardiaca: evento.frequencia_cardiaca ?? null,
      frequencia_respiratoria: evento.frequencia_respiratoria ?? null,
      pressao_sistolica: evento.pressao_sistolica ?? null,
      status: evento.status || 'realizado',
      responsavel: evento.responsavel ?? null,
      horario: evento.horario || new Date().toISOString(),
    })
    .select('*')
    .single();

  if (error || !data) throw new Error(error?.message || 'Falha ao registrar evento de internação.');
  return data as InternacaoEvento;
}

// ─── 8. Operações de Conformidade LGPD (Seção 7.2) ───────────────────────────

export async function registrarConsentimentoTutorIa(input: {
  petId: string;
  tutorId?: number | null;
  prontuarioId?: string | null;
  textoVersao?: string;
  operadoresInformados?: string;
}): Promise<ConsentimentoProntuarioIa> {
  const { data, error } = await db
    .from('prontuario_consentimentos')
    .insert({
      pet_id: input.petId,
      tutor_id: input.tutorId ?? null,
      prontuario_id: input.prontuarioId ?? null,
      texto_versao: input.textoVersao || TERMO_CONSENTIMENTO_IA_VERSAO,
      operadores_informados: input.operadoresInformados || TERMO_CONSENTIMENTO_IA_OPERADORES,
    })
    .select('*')
    .single();

  if (error || !data) {
    throw new Error(error?.message || 'Falha ao registrar consentimento do tutor.');
  }

  return data as ConsentimentoProntuarioIa;
}

export async function listarConsentimentosDoPet(petId: string): Promise<ConsentimentoProntuarioIa[]> {
  const { data, error } = await db
    .from('prontuario_consentimentos')
    .select('*')
    .eq('pet_id', petId)
    .order('aceito_em', { ascending: false });

  if (error) return [];
  return (data || []) as ConsentimentoProntuarioIa[];
}

export async function executarExpurgoRetencaoIa(dias = 90): Promise<{
  expurgados: number;
  audio_paths_para_remover: string[];
}> {
  const { data, error } = await db.rpc('expurgar_dados_ia_prontuario', {
    p_dias: dias,
  });

  if (error) {
    throw new Error(error.message || 'Falha ao executar rotina de retenção.');
  }

  const paths: string[] = Array.isArray(data?.audio_paths_para_remover)
    ? data.audio_paths_para_remover.filter(Boolean)
    : [];

  if (paths.length > 0) {
    await db.storage.from(MEDICAL_FILES_BUCKET).remove(paths).catch(() => null);
  }

  return {
    expurgados: Number(data?.expurgados ?? 0),
    audio_paths_para_remover: paths,
  };
}

export async function eliminarAudioTranscricaoDaConsulta(prontuarioId: string): Promise<void> {
  const { data, error } = await db.rpc('eliminar_audio_transcricao_consulta', {
    p_prontuario_id: prontuarioId,
  });

  if (error) {
    throw new Error(error.message || 'Falha ao eliminar áudio e transcrição da consulta.');
  }

  const paths: string[] = Array.isArray(data?.audio_paths_removidos)
    ? data.audio_paths_removidos.filter(Boolean)
    : [];

  if (paths.length > 0) {
    await db.storage.from(MEDICAL_FILES_BUCKET).remove(paths).catch(() => null);
  }
}

export async function exportarDadosProntuarioTutor(petId: string): Promise<Record<string, unknown>> {
  const { data, error } = await db.rpc('exportar_dados_prontuario_tutor', {
    p_pet_id: petId,
  });

  if (error || !data) {
    throw new Error(error?.message || 'Falha ao exportar dados do titular.');
  }

  return data as Record<string, unknown>;
}
