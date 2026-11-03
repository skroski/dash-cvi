// Testes unitários e de orquestração do Prontuário com IA (Seção 11: Cenários T1 a T12 + Gaps G-01 a G-14)
//   node --experimental-strip-types --test supabase/tests/clinica/prontuario_ia.test.ts

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  coerceProntuarioIaResult,
  hasAnyClinicalContent,
  mapInternacaoEventoToRow,
  mapDraftToProntuarioUpdates,
  calcularHashSha256Prontuario,
  buildMedicalFilePath,
  transitionProntuarioIaState,
  createProntuarioIaController,
  MEDICAL_FILES_SIGNED_TTL,
  DEFAULT_PRONTUARIO_IA_SYSTEM_PROMPT,
  type ProntuarioIaPorts,
  type DraftRow,
  type CommitInput,
  type ProntuarioIaRequest,
  type ProntuarioAnexo,
} from '../../../src/lib/prontuarioIaCore.ts';

const aqui = path.dirname(fileURLToPath(import.meta.url));
const raiz = path.resolve(aqui, '../../..');

// ─── T1 a T5: Coerção estrita ("Não inventar" — Seção 5.1 e Seção 11) ────────

test('T1: IA devolve apetite: "faminto" -> campo ausente no resultado (sem chutar enum)', () => {
  const r = coerceProntuarioIaResult({
    anamnese: {
      apetite: 'faminto',
      vacinacao: 'sim',
      queixa_principal: '   ',
    },
  });
  assert.deepEqual(r.anamnese, { vacinacao: 'sim' });
  assert.equal('apetite' in (r.anamnese ?? {}), false);
  assert.equal('queixa_principal' in (r.anamnese ?? {}), false);
});

test('T2: IA devolve peso: -3 -> campo ausente no resultado (rejeita negativos e NaN)', () => {
  const r = coerceProntuarioIaResult({
    exame_fisico: {
      peso: -3,
      temperatura: 'abc',
      fc: 110,
      fr: 0,
    },
  });
  assert.deepEqual(r.exame_fisico, { fc: 110, fr: 0 });
  assert.equal('peso' in (r.exame_fisico ?? {}), false);
  assert.equal('temperatura' in (r.exame_fisico ?? {}), false);
});

test('T3: IA devolve peso: "4.2" -> coage string numérica para 4.2', () => {
  const r = coerceProntuarioIaResult({
    exame_fisico: {
      peso: '4.2',
      temperatura: '38.5',
    },
  });
  assert.deepEqual(r.exame_fisico, { peso: 4.2, temperatura: 38.5 });
});

test('T4: IA devolve hipoteses_diagnosticas: ["", "  "] -> campo ausente (E objeto diagnostico vazio omitido)', () => {
  const r = coerceProntuarioIaResult({
    diagnostico: {
      hipoteses_diagnosticas: ['', '  '],
    },
  });
  assert.equal(r.diagnostico, undefined);
  assert.equal('diagnostico' in r, false);
});

test('T5: IA devolve internacao: null -> internacao ausente no resultado (nunca null)', () => {
  const r = coerceProntuarioIaResult({
    transcript: 'Paciente veio apenas para revisão dermatológica.',
    internacao: null,
  });
  assert.equal(r.internacao, undefined);
  assert.equal('internacao' in r, false);
  assert.equal(hasAnyClinicalContent(r), false);
});

test('Seção 5.2: Mapeamento único de fc/fr para frequencia_cardiaca/frequencia_respiratoria e espelhamento de vitais', () => {
  const evRow = mapInternacaoEventoToRow(
    {
      tipo: 'monitoramento',
      descricao: 'Aferição noturna',
      temperatura: 38.4,
      fc: 118,
      fr: 24,
      pressao_sistolica: 130,
      horario: '2026-10-31T12:00:00.000Z',
    },
    'Dra. Mariana'
  );

  assert.equal(evRow.frequencia_cardiaca, 118);
  assert.equal(evRow.frequencia_respiratoria, 24);
  assert.equal(evRow.temperatura, 38.4);
  assert.equal(evRow.pressao_sistolica, 130);
  assert.equal(evRow.responsavel, 'Dra. Mariana');

  const updates = mapDraftToProntuarioUpdates(
    {
      exame_fisico: { peso: 12.4, temperatura: 38.7, fc: 98, fr: 22 },
      diagnostico: { diagnostico_definitivo: 'Gastroenterite aguda' },
    },
    {
      veterinario: 'Dra. Mariana',
      crmvResponsavel: 'CRMV-PR 14820',
      confirmadoEm: '2026-10-31T12:05:00.000Z',
      hashSha256: 'abc123hash',
    }
  );

  assert.equal(updates.peso_atual, 12.4);
  assert.equal(updates.temperatura, 38.7);
  assert.equal(updates.frequencia_cardiaca, 98);
  assert.equal(updates.frequencia_respiratoria, 22);
  assert.equal(updates.diagnostico, 'Gastroenterite aguda');
  assert.equal(updates.diagnostico_definitivo, 'Gastroenterite aguda');
  assert.equal(updates.confirmado_em, '2026-10-31T12:05:00.000Z');
  assert.equal(updates.assinatura_digital, 'abc123hash');
});

test('Seção 3.8 e G-08: Path single-tenant sem clinic_id e TTL curto de 15 minutos (900s)', () => {
  assert.equal(MEDICAL_FILES_SIGNED_TTL, 900);
  const p = buildMedicalFilePath('pet-123', 'rec-456', '../../../malicioso/consulta.webm', 1700000000000, 'abc123');
  assert.equal(p, 'pet-123/rec-456/1700000000000_abc123.webm');
  assert.ok(!p.includes('..'));
});

// ─── T6, T7, T8, T9, T12: Orquestrador sobre Portas Agnósticas ───────────────

function criarPortasMock(overrides?: Partial<ProntuarioIaPorts>) {
  const drafts = new Map<string, DraftRow>();
  const anexos: ProntuarioAnexo[] = [];
  const commits: CommitInput[] = [];
  const requests: { req: ProntuarioIaRequest; url: string }[] = [];
  let watcherStoppedCount = 0;
  let subscriberCallback: ((row: DraftRow) => void) | null = null;

  const basePorts: ProntuarioIaPorts = {
    repository: {
      ensureActiveRecord: async () => ({ id: 'rec-001' }),
      appendAnexo: async (_recId, anexo) => {
        anexos.push(anexo);
        return anexo;
      },
      createDraft: async (input) => {
        const id = 'draft-001';
        drafts.set(id, {
          id,
          pet_id: input.petId,
          prontuario_id: input.recordId,
          audio_anexo_id: input.audioAnexoId,
          audio_path: input.audioPath,
          status: 'pending',
        });
        return id;
      },
      getDraft: async (draftId) => drafts.get(draftId) ?? null,
      markDraftCommitted: async (draftId) => {
        const d = drafts.get(draftId);
        if (!d) throw new Error('Draft inexistente');
        d.status = 'committed';
      },
      commitRecord: async (input) => {
        commits.push(input);
        if (input.draftId) {
          const d = drafts.get(input.draftId);
          if (d) d.status = 'committed';
        }
      },
    },
    storage: {
      upload: async () => undefined,
      signedUrl: async (path, ttl) => `https://signed.local/${path}?ttl=${ttl}`,
    },
    aiGateway: {
      requestProcessing: async (req, url) => {
        requests.push({ req, url });
      },
    },
    draftWatcher: {
      watch: (_draftId) => ({
        subscribe: (cb) => {
          subscriberCallback = cb;
          return () => {
            subscriberCallback = null;
          };
        },
        stop: () => {
          watcherStoppedCount += 1;
          subscriberCallback = null;
        },
      }),
    },
    settings: {
      getWebhookUrl: () => 'https://webhook.clinica.local/prontuario-ia',
      getSystemPrompt: () => DEFAULT_PRONTUARIO_IA_SYSTEM_PROMPT,
      getVeterinario: () => ({ nome: 'Dra. Mariana', crmv: 'CRMV-PR 14820' }),
    },
    petDirectory: {
      getPetContext: async () => ({ name: 'Thor', species: 'canina' }),
    },
    ...overrides,
  };

  return {
    ports: basePorts,
    drafts,
    anexos,
    commits,
    requests,
    getWatcherStoppedCount: () => watcherStoppedCount,
    emitDraftUpdate: (row: DraftRow) => {
      drafts.set(row.id, row);
      subscriberCallback?.(row);
    },
  };
}

test('T6: Draft volta status="error" -> máquina entra em error com error_message e permite retry reutilizando o mesmo áudio', async () => {
  const mock = criarPortasMock();
  const ctrl = createProntuarioIaController(mock.ports);

  const audioBlob = new Blob(['audio-bytes'], { type: 'audio/webm' });
  await ctrl.processAudio('pet-1', audioBlob, 'consulta.webm');
  assert.equal(ctrl.getState().kind, 'processing');

  mock.emitDraftUpdate({
    id: 'draft-001',
    pet_id: 'pet-1',
    prontuario_id: 'rec-001',
    audio_anexo_id: 'anexo-1',
    status: 'error',
    error_message: 'Áudio inaudível na transcrição Whisper.',
  });

  const errState = ctrl.getState();
  assert.equal(errState.kind, 'error');
  if (errState.kind === 'error') {
    assert.equal(errState.message, 'Áudio inaudível na transcrição Whisper.');
  }

  // Permite tentar de novo reutilizando o mesmo áudio sem regravar
  await ctrl.retryLastAudio();
  assert.equal(mock.requests.length, 2);
  ctrl.dispose();
});

test('T7: Sem Realtime (leitura imediata / polling de contingência pega o ready) -> estado ready sem recarregar', async () => {
  const mock = criarPortasMock();
  // Simula o serviço de IA terminando e atualizando o banco para 'ready' antes/sem evento Realtime
  const origCreateDraft = mock.ports.repository.createDraft;
  mock.ports.repository.createDraft = async (input) => {
    const id = await origCreateDraft(input);
    mock.drafts.set(id, {
      id,
      pet_id: input.petId,
      prontuario_id: input.recordId,
      audio_anexo_id: input.audioAnexoId,
      audio_path: input.audioPath,
      status: 'ready',
      transcript: 'Animal com peso de 8.5 kg e apetite normal.',
      payload: {
        anamnese: { apetite: 'normal', urina_fezes: 'invalido_ignorado' },
        exame_fisico: { peso: '8.5', fc: -10 },
      },
    });
    return id;
  };

  const ctrl = createProntuarioIaController(mock.ports);
  await ctrl.processAudio('pet-1', new Blob(['audio']), 'consulta.webm');

  const st = ctrl.getState();
  assert.equal(st.kind, 'ready');
  if (st.kind === 'ready') {
    assert.equal(st.draft.transcript, 'Animal com peso de 8.5 kg e apetite normal.');
    assert.deepEqual(st.draft.anamnese, { apetite: 'normal' });
    assert.deepEqual(st.draft.exame_fisico, { peso: 8.5 });
  }
  ctrl.dispose();
});

test('T8: Commit com internação e falha na internação -> erro exibido e rascunho não fica marcado como committed', async () => {
  const mock = criarPortasMock();
  mock.ports.repository.commitRecord = async () => {
    throw new Error('Falha simulada ao gravar internacao_eventos.');
  };

  const ctrl = createProntuarioIaController(mock.ports);
  await ctrl.processAudio('pet-1', new Blob(['audio']), 'consulta.webm');
  mock.emitDraftUpdate({
    id: 'draft-001',
    pet_id: 'pet-1',
    prontuario_id: 'rec-001',
    audio_anexo_id: 'a-1',
    status: 'ready',
    payload: {
      anamnese: { queixa_principal: 'Vômito' },
      internacao: { motivo: 'Desidratação severa' },
    },
  });

  await ctrl.confirm('pet-1', 'rec-001', {
    anamnese: { queixa_principal: 'Vômito' },
    internacao: { motivo: 'Desidratação severa' },
  });

  const st = ctrl.getState();
  assert.equal(st.kind, 'error');
  if (st.kind === 'error') {
    assert.match(st.message, /Falha simulada ao gravar internacao_eventos/);
  }
  // Draft permanece 'ready', não foi marcado como 'committed'
  assert.equal(mock.drafts.get('draft-001')?.status, 'ready');
  ctrl.dispose();
});

test('T9: Rascunho confirmado -> envia rascunho editado pelo vet, gera anexo transcript, confirmado_em e hash SHA-256 (64 chars)', async () => {
  const mock = criarPortasMock();
  const ctrl = createProntuarioIaController(mock.ports);

  await ctrl.processAudio('pet-1', new Blob(['audio']), 'consulta.webm');
  mock.emitDraftUpdate({
    id: 'draft-001',
    pet_id: 'pet-1',
    prontuario_id: 'rec-001',
    audio_anexo_id: 'a-1',
    status: 'ready',
    transcript: 'Paciente pesando 10 kg, temperatura 38.5.',
    payload: {
      exame_fisico: { peso: 10, temperatura: 38.5 },
    },
  });

  // Veterinário edita o peso de 10 para 10.4 kg antes de confirmar
  await ctrl.confirm('pet-1', 'rec-001', {
    transcript: 'Paciente pesando 10 kg, temperatura 38.5.',
    exame_fisico: { peso: 10.4, temperatura: 38.5, fc: 100 },
    diagnostico: { diagnostico_definitivo: 'Check-up anual normal' },
  });

  assert.equal(ctrl.getState().kind, 'committed');
  assert.equal(mock.commits.length, 1);

  const commit = mock.commits[0];
  assert.equal(commit.edited.exame_fisico?.peso, 10.4);
  assert.equal(commit.hashSha256.length, 64);
  assert.ok(commit.confirmadoEm);
  assert.equal(commit.transcriptAnexo?.type, 'transcript');
  assert.equal(commit.transcriptAnexo?.origem, 'transcricao');
  assert.equal(mock.drafts.get('draft-001')?.status, 'committed');
  ctrl.dispose();
});

test('T11 e G-01 / G-02 / G-12: Nenhum console.log de audioUrl/request no código de produção, falha sem webhookUrl e falha sem signedUrl', async () => {
  const arquivosProducao = [
    'src/lib/prontuarioIaCore.ts',
    'src/services/prontuarioIaAdapters.ts',
    'src/hooks/useProntuarioIa.ts',
    'src/components/prontuario-ia/ProntuarioIaPanel.tsx',
    'src/pages/ProntuarioIaPage.tsx',
  ];

  for (const rel of arquivosProducao) {
    const conteudo = fs.readFileSync(path.join(raiz, rel), 'utf8');
    assert.equal(
      /console\.(log|info|debug)\s*\(/.test(conteudo),
      false,
      `Arquivo ${rel} não pode conter console.log em produção (G-01 / T11)`
    );
    assert.equal(
      conteudo.includes('webhook.vetbot.com.br'),
      false,
      `Arquivo ${rel} não pode conter URL de webhook padrão fixa no código (G-02)`
    );
  }

  // G-02: Sem webhook configurado -> falha explicitamente
  const mockSemWebhook = criarPortasMock({
    settings: {
      getWebhookUrl: () => null,
      getSystemPrompt: () => DEFAULT_PRONTUARIO_IA_SYSTEM_PROMPT,
      getVeterinario: () => ({}),
    },
  });
  const ctrl1 = createProntuarioIaController(mockSemWebhook.ports);
  await ctrl1.processAudio('pet-1', new Blob(['a']), 'a.webm');
  assert.equal(ctrl1.getState().kind, 'error');
  ctrl1.dispose();

  // G-12: Falha ao gerar signedUrl -> falha explicitamente (não cai no path)
  const mockSemSigned = criarPortasMock({
    storage: {
      upload: async () => undefined,
      signedUrl: async () => {
        throw new Error('Storage negou criação de Signed URL');
      },
    },
  });
  const ctrl2 = createProntuarioIaController(mockSemSigned.ports);
  await ctrl2.processAudio('pet-1', new Blob(['a']), 'a.webm');
  const st2 = ctrl2.getState();
  assert.equal(st2.kind, 'error');
  if (st2.kind === 'error') {
    assert.match(st2.message, /Signed URL/);
  }
  assert.equal(mockSemSigned.requests.length, 0);
  ctrl2.dispose();
});

test('T12: Desmontar o painel (dispose) durante estado "processing" remove o canal Realtime e limpa timers ativos', async () => {
  const mock = criarPortasMock();
  const ctrl = createProntuarioIaController(mock.ports, { timeoutMs: 5000 });

  await ctrl.processAudio('pet-1', new Blob(['audio']), 'consulta.webm');
  assert.equal(ctrl.getState().kind, 'processing');
  assert.equal(mock.getWatcherStoppedCount(), 0);

  // Simula unmount do painel React
  ctrl.dispose();
  assert.equal(mock.getWatcherStoppedCount(), 1);
});

test('Seção 9.3: transitionProntuarioIaState respeita todas as transições e RESET volta a idle de qualquer estado', () => {
  let s = transitionProntuarioIaState({ kind: 'idle' }, { type: 'RECORD_STOP', petId: 'p1' });
  assert.equal(s.kind, 'uploading');

  s = transitionProntuarioIaState(s, { type: 'DRAFT_CREATED', draftId: 'd1' });
  assert.deepEqual(s, { kind: 'processing', draftId: 'd1' });

  s = transitionProntuarioIaState(s, { type: 'RESET' });
  assert.deepEqual(s, { kind: 'idle' });
});

test('calcularHashSha256Prontuario é determinístico independente da ordem das chaves JSON', async () => {
  const h1 = await calcularHashSha256Prontuario({
    petId: 'p1',
    recordId: 'r1',
    confirmadoEmIso: '2026-10-31T10:00:00.000Z',
    veterinario: 'Dra. Ana',
    crmvResponsavel: 'CRMV-PR 1000',
    edited: {
      exame_fisico: { peso: 5, fc: 100 },
      anamnese: { apetite: 'normal', vacinacao: 'sim' },
    },
  });

  const h2 = await calcularHashSha256Prontuario({
    petId: 'p1',
    recordId: 'r1',
    confirmadoEmIso: '2026-10-31T10:00:00.000Z',
    veterinario: 'Dra. Ana',
    crmvResponsavel: 'CRMV-PR 1000',
    edited: {
      anamnese: { vacinacao: 'sim', apetite: 'normal' },
      exame_fisico: { fc: 100, peso: 5 },
    },
  });

  assert.equal(h1.length, 64);
  assert.equal(h1, h2);
});
