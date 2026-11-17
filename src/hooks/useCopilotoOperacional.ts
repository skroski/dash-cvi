import { useCallback, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  type ContextoOperacionalSnapshot,
  type MensagemCopiloto,
  MODELO_COPILOTO_FIXO,
} from '@/types/copilotoOperacional';
import {
  extrairAtalhosDeRota,
  normalizarSnapshotOperacional,
  obterSugestoesContextuais,
  responderCopilotoDeterministico,
  SNAPSHOT_OPERACIONAL_PADRAO,
} from '@/lib/copilotoOperacionalMotor';

async function carregarSnapshotFallbackDireto(): Promise<ContextoOperacionalSnapshot> {
  const hojeInicio = new Date();
  hojeInicio.setHours(0, 0, 0, 0);
  const mesInicio = new Date(hojeInicio.getFullYear(), hojeInicio.getMonth(), 1);
  const seteDias = new Date(hojeInicio.getTime() + 7 * 86_400_000);

  const [
    empRes,
    cliTotalRes,
    cliPetsRes,
    cliMesRes,
    ateAbertasRes,
    ateHojeRes,
    ageHojeRes,
    age7dRes,
    lemAgendadosRes,
    pipCardsRes,
    promptRegrasRes,
    promptVersaoRes,
  ] = await Promise.allSettled([
    supabase
      .from('atendimento_config')
      .select('nome_empresa, nome_assistente, telefone_contato, endereco, fuso_horario, planos_aceitos')
      .limit(1)
      .maybeSingle(),
    supabase.from('dados_cliente').select('*', { count: 'exact', head: true }),
    supabase.from('dados_cliente').select('*', { count: 'exact', head: true }).not('nome_pet', 'is', null),
    supabase
      .from('dados_cliente')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', mesInicio.toISOString()),
    supabase
      .from('atendimentos')
      .select('*', { count: 'exact', head: true })
      .in('status', ['aberto', 'em_atendimento', 'aguardando']),
    supabase
      .from('atendimentos')
      .select('*', { count: 'exact', head: true })
      .gte('updated_at', hojeInicio.toISOString()),
    supabase
      .from('agenda_agendamentos')
      .select('*', { count: 'exact', head: true })
      .gte('inicio', hojeInicio.toISOString())
      .lt('inicio', new Date(hojeInicio.getTime() + 86_400_000).toISOString()),
    supabase
      .from('agenda_agendamentos')
      .select('*', { count: 'exact', head: true })
      .gte('inicio', hojeInicio.toISOString())
      .lt('inicio', seteDias.toISOString()),
    supabase
      .from('lembretes_envios')
      .select('*', { count: 'exact', head: true })
      .in('status', ['AGENDADO', 'PENDENTE']),
    supabase.from('crm_pipeline_cards').select('*', { count: 'exact', head: true }),
    supabase.from('prompt_regras').select('*', { count: 'exact', head: true }).eq('ativa', true),
    supabase
      .from('meu_prompt_versoes')
      .select('versao')
      .order('versao', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const empData =
    empRes.status === 'fulfilled' && empRes.value.data
      ? (empRes.value.data as Record<string, unknown>)
      : {};

  const versaoAtiva =
    promptVersaoRes.status === 'fulfilled' && promptVersaoRes.value.data
      ? Number((promptVersaoRes.value.data as Record<string, unknown>).versao) || 0
      : 0;

  return normalizarSnapshotOperacional({
    atualizado_em: new Date().toISOString(),
    modelo_copiloto: MODELO_COPILOTO_FIXO,
    empresa: empData,
    clientes: {
      total_clientes: cliTotalRes.status === 'fulfilled' ? cliTotalRes.value.count || 0 : 0,
      total_pets: cliPetsRes.status === 'fulfilled' ? cliPetsRes.value.count || 0 : 0,
      novos_clientes_mes: cliMesRes.status === 'fulfilled' ? cliMesRes.value.count || 0 : 0,
    },
    atendimento: {
      conversas_abertas: ateAbertasRes.status === 'fulfilled' ? ateAbertasRes.value.count || 0 : 0,
      conversas_hoje: ateHojeRes.status === 'fulfilled' ? ateHojeRes.value.count || 0 : 0,
    },
    agenda: {
      agendamentos_hoje: ageHojeRes.status === 'fulfilled' ? ageHojeRes.value.count || 0 : 0,
      agendamentos_proximos_7d: age7dRes.status === 'fulfilled' ? age7dRes.value.count || 0 : 0,
    },
    lembretes: {
      agendados: lemAgendadosRes.status === 'fulfilled' ? lemAgendadosRes.value.count || 0 : 0,
    },
    pipelines: {
      total_cards: pipCardsRes.status === 'fulfilled' ? pipCardsRes.value.count || 0 : 0,
    },
    prompt_ia: {
      versao_ativa: versaoAtiva,
      regras_ativas: promptRegrasRes.status === 'fulfilled' ? promptRegrasRes.value.count || 0 : 0,
    },
  });
}

async function fetchContextoOperacional(): Promise<ContextoOperacionalSnapshot> {
  try {
    const { data, error } = await supabase.rpc('obter_contexto_copiloto_operacional' as never);
    if (!error && data) {
      return normalizarSnapshotOperacional(data);
    }
  } catch {
    // RPC ainda não aplicada no banco: usa fallback de contagens leves
  }
  return carregarSnapshotFallbackDireto();
}

function criarMensagemBoasVindas(): MensagemCopiloto {
  return {
    id: 'boas-vindas-copiloto',
    role: 'assistant',
    content: [
      `**Olá! Sou o Copiloto da sua Operação** (\`${MODELO_COPILOTO_FIXO}\`).`,
      'Posso responder a qualquer momento sobre:',
      '• **Sua operação ao vivo**: conversas no WhatsApp, agendamentos do dia, clientes, lembretes, fila presencial e Pipelines CRM.',
      '• **Uso do sistema**: como funciona a tela em que você está, onde configurar horários, QR Code ou regras do Meu Prompt.',
    ].join('\n'),
    createdAt: new Date().toISOString(),
    rotaContexto: '/dashboard',
    modelo: MODELO_COPILOTO_FIXO,
    origemMotor: 'copiloto_deterministico',
    atalhosRota: [
      { url: '/chats', label: 'Conversas' },
      { url: '/schedule', label: 'Agenda' },
      { url: '/clients', label: 'Clientes & CRM' },
    ],
  };
}

export function useCopilotoOperacional(rotaAtual = '/dashboard') {
  const [mensagens, setMensagens] = useState<MensagemCopiloto[]>(() => [criarMensagemBoasVindas()]);
  const [enviando, setEnviando] = useState(false);

  const snapshotQuery = useQuery({
    queryKey: ['copiloto-operacional', 'snapshot'],
    queryFn: fetchContextoOperacional,
    staleTime: 45_000,
    refetchOnWindowFocus: false,
  });

  const snapshot = snapshotQuery.data ?? SNAPSHOT_OPERACIONAL_PADRAO;

  const sugestoes = useMemo(() => obterSugestoesContextuais(rotaAtual), [rotaAtual]);

  const enviarPergunta = useCallback(
    async (perguntaBruta: string, tituloTela = 'Painel') => {
      const pergunta = perguntaBruta.trim();
      if (!pergunta || enviando) return;

      const msgUsuario: MensagemCopiloto = {
        id: `user-${Date.now()}`,
        role: 'user',
        content: pergunta,
        createdAt: new Date().toISOString(),
        rotaContexto: rotaAtual,
        modelo: MODELO_COPILOTO_FIXO,
        origemMotor: 'copiloto_deterministico',
      };

      setMensagens((prev) => [...prev, msgUsuario]);
      setEnviando(true);

      const t0 = performance.now();

      try {
        const historicoRecente = mensagens.slice(-6).map((m) => ({
          role: m.role,
          content: m.content,
        }));

        const { data, error } = await supabase.functions.invoke('copiloto-operacional', {
          body: {
            pergunta,
            rota_atual: rotaAtual,
            titulo_tela: tituloTela,
            historico: historicoRecente,
            contexto_operacional: snapshot,
          },
        });

        const payload = (data as Record<string, unknown>) || null;
        if (!error && payload?.ok && typeof payload.resposta === 'string' && payload.resposta.trim()) {
          const textoResp = payload.resposta.trim();
          const msgIa: MensagemCopiloto = {
            id: `assistant-${Date.now()}`,
            role: 'assistant',
            content: textoResp,
            createdAt: new Date().toISOString(),
            rotaContexto: rotaAtual,
            modelo: MODELO_COPILOTO_FIXO,
            origemMotor: 'openai_gpt_5_4_nano',
            tempoMs: Number(payload.tempo_processamento_ms) || Math.round(performance.now() - t0),
            atalhosRota: extrairAtalhosDeRota(textoResp),
          };
          setMensagens((prev) => [...prev, msgIa]);
          return;
        }
      } catch {
        // Segue imediatamente para o motor determinístico local caso a Edge Function não esteja publicada
      } finally {
        setEnviando(false);
      }

      const resultadoLocal = responderCopilotoDeterministico(pergunta, snapshot, rotaAtual);
      const msgFallback: MensagemCopiloto = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: resultadoLocal.resposta,
        createdAt: new Date().toISOString(),
        rotaContexto: rotaAtual,
        modelo: MODELO_COPILOTO_FIXO,
        origemMotor: 'copiloto_deterministico',
        tempoMs: Math.max(12, Math.round(performance.now() - t0)),
        atalhosRota: resultadoLocal.atalhosRota,
      };
      setMensagens((prev) => [...prev, msgFallback]);
    },
    [enviando, mensagens, rotaAtual, snapshot]
  );

  const limparConversa = useCallback(() => {
    setMensagens([criarMensagemBoasVindas()]);
  }, []);

  return {
    modeloFixo: MODELO_COPILOTO_FIXO,
    mensagens,
    enviando,
    snapshot,
    carregandoSnapshot: snapshotQuery.isPending,
    atualizandoSnapshot: snapshotQuery.isFetching,
    atualizarSnapshot: snapshotQuery.refetch,
    sugestoes,
    enviarPergunta,
    limparConversa,
  };
}
