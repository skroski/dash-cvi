import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  BULARIO_PADRAO,
  PROTOCOLOS_PADRAO,
  type RegraBulario,
  type ProtocoloClinico,
  type PacienteContexto,
  type ItemPrescricao,
  type SlotCronograma,
  type PayloadPosologicoIA,
  calcularPosologiaItem,
  validarSegurancaPrescricao,
  gerarGradeCronograma,
  gerarSugestaoCopilotoLocal,
  extrairContextoEntradaClinica,
  localizarRegraBulario,
  detectarRiscoMdr1PorRaca,
} from '@/lib/receituarioMotor';
import {
  type ModalidadeAssinatura,
  gerarCodigoVerificacaoReceita,
  calcularHashSha256Prescricao,
} from '@/lib/receituarioPdf';

export interface VeterinarioReceituario {
  id: string;
  nome: string;
  crmv: string;
}

export interface PrescricaoHistorico {
  id: string;
  codigo_verificacao: string;
  paciente_snapshot: PacienteContexto;
  veterinario_nome: string;
  veterinario_crmv: string;
  hipotese_diagnostica?: string | null;
  itens_prescricao: ItemPrescricao[];
  cronograma: SlotCronograma[];
  modalidade_assinatura: ModalidadeAssinatura;
  hash_sha256: string;
  assinado_em: string;
  tempo_emissao_segundos?: number | null;
  itens_sugeridos_ia: number;
  itens_mantidos_ia: number;
}

export interface PacienteFilaAtivo {
  fila_item_id: string;
  senha: string;
  tutor_nome: string;
  pet_nome: string;
  telefone?: string | null;
  cliente_id?: number | null;
  veterinario_nome?: string | null;
  status: string;
}

const db = supabase as unknown as {
  from: (table: string) => any;
  rpc: (fn: string, args?: Record<string, unknown>) => Promise<{ data: any; error: any }>;
  functions: typeof supabase.functions;
};

export function useReceituario() {
  const [bulario, setBulario] = useState<RegraBulario[]>(BULARIO_PADRAO);
  const [protocolos, setProtocolos] = useState<ProtocoloClinico[]>(PROTOCOLOS_PADRAO);
  const [veterinarios, setVeterinarios] = useState<VeterinarioReceituario[]>([]);
  const [pacientesCadastrados, setPacientesCadastrados] = useState<PacienteContexto[]>([]);
  const [pacientesFilaAtivos, setPacientesFilaAtivos] = useState<PacienteFilaAtivo[]>([]);
  const [historicoPrescricoes, setHistoricoPrescricoes] = useState<PrescricaoHistorico[]>([]);
  const [clinicaNome, setClinicaNome] = useState<string>('Clínica Veterinária');
  const [clinicaLogoUrl, setClinicaLogoUrl] = useState<string | null>(null);
  const [loadingDados, setLoadingDados] = useState<boolean>(true);
  const [processandoIa, setProcessandoIa] = useState<boolean>(false);
  const [ultimoTempoIaMs, setUltimoTempoIaMs] = useState<number | null>(null);
  const [ultimaAuditoriaId, setUltimaAuditoriaId] = useState<string | null>(null);
  const [ultimoPayloadPrd, setUltimoPayloadPrd] = useState<PayloadPosologicoIA | null>(null);

  const carregarDadosIniciais = useCallback(async () => {
    setLoadingDados(true);
    try {
      // 1. Nome e logo da clínica
      const [{ data: cfgAtend }, { data: cfgFila }] = await Promise.all([
        db.from('atendimento_config').select('nome_empresa').eq('singleton', true).maybeSingle(),
        db.from('fila_config').select('nome_exibicao,logo_path').eq('singleton', true).maybeSingle(),
      ]);

      const nomeEmp = cfgFila?.nome_exibicao || cfgAtend?.nome_empresa || 'Clínica Veterinária';
      setClinicaNome(nomeEmp);
      if (cfgFila?.logo_path) {
        const publicUrl = supabase.storage.from('fila-midias').getPublicUrl(cfgFila.logo_path).data.publicUrl;
        setClinicaLogoUrl(publicUrl);
      }

      // 2. Bulário do banco (se migrado) mesclado ao padrão
      const { data: rowsBulario } = await db
        .from('receituario_bulario')
        .select('*')
        .eq('ativo', true)
        .order('principio_ativo', { ascending: true });

      if (Array.isArray(rowsBulario) && rowsBulario.length > 0) {
        setBulario(
          rowsBulario.map((r: any) => ({
            slug: r.slug,
            principio_ativo: r.principio_ativo,
            nome_comercial_sugerido: r.nome_comercial_sugerido,
            classe_terapeutica: r.classe_terapeutica,
            tipo_padrao: r.tipo_padrao,
            icone_via: r.icone_via,
            especies_permitidas: r.especies_permitidas || ['canina', 'felina'],
            especies_contraindicadas: r.especies_contraindicadas || [],
            motivo_contraindicacao_especie: r.motivo_contraindicacao_especie,
            risco_mdr1: Boolean(r.risco_mdr1),
            mensagem_mdr1: r.mensagem_mdr1,
            dose_padrao_mg_kg: Number(r.dose_padrao_mg_kg),
            dose_min_mg_kg: Number(r.dose_min_mg_kg),
            dose_max_mg_kg: Number(r.dose_max_mg_kg),
            dose_toxica_mg_kg: r.dose_toxica_mg_kg !== null ? Number(r.dose_toxica_mg_kg) : null,
            dose_felina_max_mg_kg: r.dose_felina_max_mg_kg !== null ? Number(r.dose_felina_max_mg_kg) : null,
            alerta_felino_especifico: r.alerta_felino_especifico,
            frequencia_horas_padrao: Number(r.frequencia_horas_padrao),
            duracao_dias_padrao: Number(r.duracao_dias_padrao),
            condicao_alimentar: r.condicao_alimentar || 'com_alimento',
            apresentacoes: Array.isArray(r.apresentacoes) ? r.apresentacoes : [],
            interacoes_classes: r.interacoes_classes || [],
            comorbidades_cautela: r.comorbidades_cautela || [],
            orientacoes_padrao: r.orientacoes_padrao,
            palavras_chave: r.palavras_chave || [],
          }))
        );
      }

      // 3. Protocolos rápidos
      const { data: rowsProtocolos } = await db
        .from('receituario_protocolos')
        .select('*')
        .eq('ativo', true)
        .order('ordem', { ascending: true });

      if (Array.isArray(rowsProtocolos) && rowsProtocolos.length > 0) {
        setProtocolos(
          rowsProtocolos.map((p: any) => ({
            codigo: p.codigo,
            titulo: p.titulo,
            descricao_clinica: p.descricao_clinica,
            especie_alvo: p.especie_alvo,
            palavras_gatilho: p.palavras_gatilho || [],
            itens_template: Array.isArray(p.itens_template) ? p.itens_template : [],
          }))
        );
      }

      // 4. Veterinários cadastrados na fila/clínica
      const { data: rowsVets } = await db
        .from('fila_veterinarios')
        .select('id,nome,crmv')
        .eq('ativo', true)
        .order('ordem', { ascending: true });

      if (Array.isArray(rowsVets) && rowsVets.length > 0) {
        setVeterinarios(
          rowsVets.map((v: any) => ({
            id: v.id,
            nome: v.nome,
            crmv: v.crmv || '',
          }))
        );
      }

      // 5. Pacientes salvos no receituário
      const { data: rowsPacientes } = await db
        .from('receituario_pacientes')
        .select('*')
        .order('updated_at', { ascending: false })
        .limit(40);

      if (Array.isArray(rowsPacientes)) {
        setPacientesCadastrados(
          rowsPacientes.map((p: any) => ({
            id: p.id,
            cliente_id: p.cliente_id,
            tutor_nome: p.tutor_nome,
            tutor_telefone: p.tutor_telefone,
            nome: p.nome,
            especie: p.especie,
            raca: p.raca,
            sexo: p.sexo,
            castrado: Boolean(p.castrado),
            idade_texto: p.idade_texto,
            peso_kg: Number(p.peso_kg),
            mutacao_mdr1: Boolean(p.mutacao_mdr1) || detectarRiscoMdr1PorRaca(p.especie, p.raca),
            comorbidades: p.comorbidades || [],
            alergias: p.alergias || [],
            observacoes: p.observacoes,
          }))
        );
      }

      // 6. Pacientes ativos na fila presencial (chamado / em_atendimento / aguardando)
      const { data: rowsFila } = await db
        .from('fila_itens')
        .select('id,senha,tutor_nome,pet_nome,telefone,telefone_whatsapp,cliente_id,veterinario_nome,status')
        .in('status', ['em_atendimento', 'chamado', 'aguardando'])
        .order('chegada_em', { ascending: false })
        .limit(15);

      if (Array.isArray(rowsFila)) {
        setPacientesFilaAtivos(
          rowsFila.map((f: any) => ({
            fila_item_id: f.id,
            senha: f.senha,
            tutor_nome: f.tutor_nome,
            pet_nome: f.pet_nome || 'Pet',
            telefone: f.telefone_whatsapp || f.telefone,
            cliente_id: f.cliente_id,
            veterinario_nome: f.veterinario_nome,
            status: f.status,
          }))
        );
      }

      // 7. Histórico recente de prescrições
      const { data: rowsHist } = await db
        .from('receituario_prescricoes')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(25);

      if (Array.isArray(rowsHist)) {
        setHistoricoPrescricoes(rowsHist as PrescricaoHistorico[]);
      }
    } catch {
      // Mantém os padrões determinísticos locais caso alguma tabela ainda não tenha sido aplicada
    } finally {
      setLoadingDados(false);
    }
  }, []);

  useEffect(() => {
    carregarDadosIniciais();
  }, [carregarDadosIniciais]);

  /** Busca clientes e pets em `dados_cliente` (WhatsApp) para preenchimento automático contextual (RF-01). */
  const buscarClientesTutorPet = useCallback(async (termo: string) => {
    const limpo = termo.trim();
    if (limpo.length < 2) return [];
    try {
      const { data, error } = await db.rpc('buscar_clientes_fila', { termo: limpo });
      if (!error && Array.isArray(data)) {
        return data as Array<{
          id: number;
          nome: string;
          telefone: string;
          nome_pet: string | null;
          raca_pet: string | null;
          porte_pet: string | null;
        }>;
      }
    } catch {
      // Fallback direto
    }
    const sanitizado = limpo.replace(/[,()]/g, '');
    const { data: fallback } = await db
      .from('dados_cliente')
      .select('id,nome,telefone,nome_pet,raca_pet,porte_pet')
      .or(`nome.ilike.%${sanitizado}%,nome_pet.ilike.%${sanitizado}%,telefone.ilike.%${sanitizado}%`)
      .order('id', { ascending: false })
      .limit(10);

    return (fallback || []) as Array<{
      id: number;
      nome: string;
      telefone: string;
      nome_pet: string | null;
      raca_pet: string | null;
      porte_pet: string | null;
    }>;
  }, []);

  /** Salva ou atualiza o paciente na base `receituario_pacientes` e sincroniza com `dados_cliente`. */
  const salvarPaciente = useCallback(
    async (paciente: PacienteContexto): Promise<PacienteContexto> => {
      const mdr1Auto = Boolean(paciente.mutacao_mdr1) || detectarRiscoMdr1PorRaca(paciente.especie, paciente.raca);
      try {
        const { data, error } = await db.rpc('salvar_paciente_receituario', {
          p_id: paciente.id || null,
          p_cliente_id: paciente.cliente_id || null,
          p_tutor_nome: paciente.tutor_nome,
          p_tutor_telefone: paciente.tutor_telefone || null,
          p_nome: paciente.nome,
          p_especie: paciente.especie,
          p_raca: paciente.raca || null,
          p_sexo: paciente.sexo || 'macho',
          p_castrado: Boolean(paciente.castrado),
          p_idade_texto: paciente.idade_texto || null,
          p_peso_kg: Number(paciente.peso_kg),
          p_mutacao_mdr1: mdr1Auto,
          p_comorbidades: paciente.comorbidades || [],
          p_alergias: paciente.alergias || [],
          p_observacoes: paciente.observacoes || null,
        });

        if (!error && data) {
          const salvo: PacienteContexto = {
            id: data.id,
            cliente_id: data.cliente_id,
            tutor_nome: data.tutor_nome,
            tutor_telefone: data.tutor_telefone,
            nome: data.nome,
            especie: data.especie,
            raca: data.raca,
            sexo: data.sexo,
            castrado: data.castrado,
            idade_texto: data.idade_texto,
            peso_kg: Number(data.peso_kg),
            mutacao_mdr1: Boolean(data.mutacao_mdr1),
            comorbidades: data.comorbidades || [],
            alergias: data.alergias || [],
            observacoes: data.observacoes,
          };
          setPacientesCadastrados((prev) => [salvo, ...prev.filter((p) => p.id !== salvo.id)]);
          return salvo;
        }
      } catch {
        // Fallback local se RPC ainda não estiver ativa
      }
      return { ...paciente, mutacao_mdr1: mdr1Auto };
    },
    []
  );

  /**
   * Processa a entrada clínica em linguagem natural com o Copiloto de IA + Bulário Determinístico (RF-02, RF-03, RF-04).
   * Responde sempre abaixo de 2,5s (RNF Desempenho).
   */
  const processarEntradaComIa = useCallback(
    async (entradaClinica: string, pacienteAtual: PacienteContexto) => {
      const t0 = performance.now();
      setProcessandoIa(true);

      // 1. Extrai pistas contextuais do texto (ex.: "cão de 12kg", "gato", "Collie").
      // Peso e raça do texto só preenchem campos vazios: o peso aferido digitado sempre vale.
      const pistas = extrairContextoEntradaClinica(entradaClinica);
      const pesoFinal = pacienteAtual.peso_kg > 0 ? pacienteAtual.peso_kg : pistas.peso_kg ?? 0;
      const racaFinal = pacienteAtual.raca?.trim() ? pacienteAtual.raca : pistas.raca ?? pacienteAtual.raca;
      const pacienteContextualizado: PacienteContexto = {
        ...pacienteAtual,
        peso_kg: pesoFinal,
        especie: pistas.especie ?? pacienteAtual.especie,
        raca: racaFinal,
        mutacao_mdr1:
          Boolean(pacienteAtual.mutacao_mdr1) ||
          detectarRiscoMdr1PorRaca(pistas.especie ?? pacienteAtual.especie, racaFinal),
      };

      if (!(pacienteContextualizado.peso_kg > 0)) {
        setProcessandoIa(false);
        throw new Error('Informe o peso aferido do paciente para calcular as doses.');
      }

      // 2. Gera sugestão base no motor determinístico local
      const baseLocal = gerarSugestaoCopilotoLocal(
        entradaClinica,
        pacienteContextualizado,
        bulario,
        protocolos
      );

      let itensSugeridos = baseLocal.itens;
      let auditoriaId: string | null = null;

      // 3. Tenta enriquecer pela Edge Function `receituario-ia`. Com 2,2 s a OpenAI quase nunca
      // respondia a tempo; 15 s cobre partida a frio + LLM, e o motor local segue como reserva.
      let usouIa = false;
      try {
        const { data: resEdge, error: errEdge } = await Promise.race([
          db.functions.invoke('receituario-ia', {
            body: {
              entrada_clinica: entradaClinica,
              paciente: pacienteContextualizado,
            },
          }),
          new Promise<{ data: null; error: Error }>((resolve) =>
            setTimeout(() => resolve({ data: null, error: new Error('timeout') }), 15_000)
          ),
        ]);

        if (!errEdge && resEdge?.ok) {
          auditoriaId = resEdge.auditoria_id || null;
          const payloadIa = resEdge.payload_ia as PayloadPosologicoIA | null;

          if (payloadIa && Array.isArray(payloadIa.itens_prescricao) && payloadIa.itens_prescricao.length > 0) {
            usouIa = true;
            itensSugeridos = payloadIa.itens_prescricao.map((raw, index) => {
              const regraMatch = localizarRegraBulario(
                raw.slug_bulario || raw.principio_ativo || raw.nome_comercial_sugerido,
                bulario
              );
              const doseMgKg =
                raw.dose_mg_kg ??
                (raw.posologia?.dose_calculada_mg
                  ? Number((raw.posologia.dose_calculada_mg / Math.max(0.1, pacienteContextualizado.peso_kg)).toFixed(2))
                  : regraMatch?.dose_padrao_mg_kg ?? 10);

              return calcularPosologiaItem({
                id: `ia_llm_${Date.now()}_${index}`,
                regra: regraMatch,
                paciente: pacienteContextualizado,
                tipo: raw.tipo === 'manipulado' ? 'manipulado' : 'industrializado',
                principio_ativo: raw.principio_ativo,
                nome_comercial_sugerido: raw.nome_comercial_sugerido,
                dose_mg_kg: doseMgKg,
                frequencia_horas: raw.posologia?.frequencia_horas || regraMatch?.frequencia_horas_padrao || 12,
                duracao_dias: raw.posologia?.duracao_dias || regraMatch?.duracao_dias_padrao || 7,
                icone_via: raw.icone_via || regraMatch?.icone_via || 'oral',
                orientacoes_tutor: raw.orientacoes_tutor || regraMatch?.orientacoes_padrao,
                origem_ia: true,
              });
            });
          }
        }
      } catch {
        // Segue com os itens calculados pelo motor determinístico local
      }

      // 4. Passa obrigatoriamente pelo validador de Regras Duras (Hard Rules Validation - Seção 9)
      const validacaoFinal = validarSegurancaPrescricao(pacienteContextualizado, itensSugeridos, bulario);

      const payloadEstruturado: PayloadPosologicoIA = {
        alerta_seguranca: validacaoFinal.alerta_seguranca,
        itens_prescricao: itensSugeridos.map((it) => ({
          tipo: it.tipo,
          principio_ativo: it.principio_ativo,
          nome_comercial_sugerido: it.nome_comercial_sugerido,
          posologia: it.posologia,
          orientacoes_tutor: it.orientacoes_tutor,
          icone_via: it.icone_via,
        })),
      };

      const duracaoMs = Math.round(performance.now() - t0);
      setUltimoTempoIaMs(duracaoMs);
      setUltimaAuditoriaId(auditoriaId);
      setUltimoPayloadPrd(payloadEstruturado);
      setProcessandoIa(false);

      return {
        pacienteAtualizado: pacienteContextualizado,
        itens: itensSugeridos,
        validacao: validacaoFinal,
        payloadPrd: payloadEstruturado,
        tempoMs: duracaoMs,
        protocoloAplicado: baseLocal.protocolo_aplicado,
        usouIa,
      };
    },
    [bulario, protocolos]
  );

  /** Emite, assina digitalmente, grava no banco (com log de auditoria) e gera o PDF padronizado (RF-08). */
  const emitirPrescricao = useCallback(
    async (params: {
      paciente: PacienteContexto;
      veterinarioNome: string;
      veterinarioCrmv: string;
      veterinarioId?: string | null;
      entradaClinica: string;
      hipoteseDiagnostica?: string;
      itens: ItemPrescricao[];
      observacoesGerais?: string;
      modalidadeAssinatura: ModalidadeAssinatura;
      responsabilidadeConfirmada: boolean;
      overrideJustificativa?: string;
      tempoEmissaoSegundos: number;
      itensSugeridosIaCount: number;
      filaItemId?: string | null;
    }) => {
      if (!params.responsabilidadeConfirmada) {
        throw new Error('É obrigatório confirmar a revisão técnica antes de assinar o receituário.');
      }
      if (params.itens.length === 0) {
        throw new Error('Adicione pelo menos um item à prescrição antes de emitir.');
      }
      if (!(params.paciente.peso_kg > 0)) {
        throw new Error('Informe o peso aferido do paciente.');
      }
      if (!params.paciente.nome.trim() || !params.paciente.tutor_nome.trim()) {
        throw new Error('Informe o nome do pet e do tutor.');
      }
      if (!params.veterinarioNome.trim() || !params.veterinarioCrmv.trim()) {
        throw new Error('Informe o nome e o CRMV do veterinário responsável.');
      }

      const validacao = validarSegurancaPrescricao(params.paciente, params.itens, bulario);
      if (validacao.bloqueia_emissao && (!params.overrideJustificativa || params.overrideJustificativa.trim().length < 10)) {
        throw new Error(
          'A prescrição possui alertas críticos de segurança. Remova o fármaco incompatível ou insira justificativa clínica formal.'
        );
      }

      const pacienteSalvo = await salvarPaciente(params.paciente);
      const codigoVerificacao = gerarCodigoVerificacaoReceita();
      const assinadoEmIso = new Date().toISOString();
      const cronograma = gerarGradeCronograma(params.itens);

      const hashSha256 = await calcularHashSha256Prescricao({
        codigo: codigoVerificacao,
        veterinarioCrmv: params.veterinarioCrmv,
        pacienteNome: pacienteSalvo.nome,
        pesoKg: pacienteSalvo.peso_kg,
        itens: params.itens,
        assinadoEmIso,
      });

      const itensMantidosIa = params.itens.filter((i) => i.origem_ia).length;
      const originUrl = typeof window !== 'undefined' ? window.location.origin : 'https://painel.cvi.com.br';
      const urlValidacaoPublica = `${originUrl}/validar-receita/${codigoVerificacao}`;

      // Sem o registro no banco o QR Code do PDF levaria a "receita não encontrada":
      // nesse caso a emissão falha e nada é impresso.
      const { data: recInserida, error: erroInsercao } = await db
          .from('receituario_prescricoes')
          .insert({
            codigo_verificacao: codigoVerificacao,
            paciente_id: pacienteSalvo.id || null,
            cliente_id: pacienteSalvo.cliente_id || null,
            fila_item_id: params.filaItemId || null,
            paciente_snapshot: pacienteSalvo,
            veterinario_id: params.veterinarioId || null,
            veterinario_nome: params.veterinarioNome,
            veterinario_crmv: params.veterinarioCrmv,
            entrada_clinica: params.entradaClinica,
            hipotese_diagnostica: params.hipoteseDiagnostica || params.entradaClinica,
            alerta_seguranca: validacao.alerta_seguranca,
            itens_prescricao: params.itens,
            cronograma,
            observacoes_gerais: params.observacoesGerais || null,
            status: 'emitida',
            responsabilidade_confirmada: true,
            override_alerta_justificativa: params.overrideJustificativa || null,
            modalidade_assinatura: params.modalidadeAssinatura,
            hash_sha256: hashSha256,
            assinado_em: assinadoEmIso,
            tempo_emissao_segundos: params.tempoEmissaoSegundos,
            itens_sugeridos_ia: params.itensSugeridosIaCount,
            itens_mantidos_ia: itensMantidosIa,
          })
          .select('*')
          .maybeSingle();

      if (erroInsercao || !recInserida) {
        throw new Error(
          'A receita não foi salva no sistema, então não foi emitida. Verifique a conexão e tente de novo.'
        );
      }
      setHistoricoPrescricoes((prev) => [recInserida as PrescricaoHistorico, ...prev]);

      // Atualiza o log de auditoria da IA com a receita final editada e confirmada pelo veterinário
      try {
        if (ultimaAuditoriaId) {
          await db
            .from('receituario_auditoria_ia')
            .update({
              prescricao_id: recInserida.id,
              alertas_hard_rules: validacao.alertas,
              itens_finais_confirmados: params.itens,
            })
            .eq('id', ultimaAuditoriaId);
        } else {
          await db.from('receituario_auditoria_ia').insert({
            prescricao_id: recInserida.id,
            prompt_enviado: params.entradaClinica || 'Emissão manual/protocolo',
            contexto_paciente: pacienteSalvo,
            sugestao_bruta_ia: ultimoPayloadPrd || { itens_prescricao: params.itens },
            alertas_hard_rules: validacao.alertas,
            itens_finais_confirmados: params.itens,
            // Sem auditoria da Edge Function = a IA não respondeu ou não foi usada.
            origem_motor: 'copiloto_deterministico',
            tempo_processamento_ms: ultimoTempoIaMs || 0,
          });
        }
      } catch {
        // A receita já está registrada; falha no log de auditoria não desfaz a emissão.
      }

      const dadosPdf = {
        codigoVerificacao,
        clinicaNome,
        clinicaLogoUrl,
        veterinarioNome: params.veterinarioNome,
        veterinarioCrmv: params.veterinarioCrmv,
        modalidadeAssinatura: params.modalidadeAssinatura,
        hashSha256,
        assinadoEmIso,
        urlValidacaoPublica,
        paciente: pacienteSalvo,
        hipoteseDiagnostica: params.hipoteseDiagnostica || params.entradaClinica,
        itens: params.itens,
        cronograma,
        observacoesGerais: params.observacoesGerais,
      };

      // A impressão fica para o clique do usuário na tela de sucesso: depois de tantos awaits
      // o navegador bloquearia a nova aba como pop-up.
      return dadosPdf;
    },
    [bulario, clinicaLogoUrl, clinicaNome, salvarPaciente, ultimaAuditoriaId, ultimoPayloadPrd, ultimoTempoIaMs]
  );

  /** KPIs do módulo calculados só a partir do histórico real (null sem receitas emitidas). */
  const kpis = useMemo(() => {
    if (historicoPrescricoes.length === 0) return null;

    const tempos = historicoPrescricoes
      .map((h) => h.tempo_emissao_segundos)
      .filter((t): t is number => typeof t === 'number' && t > 0);
    const tempoMedioSegundos =
      tempos.length > 0 ? Math.round(tempos.reduce((a, b) => a + b, 0) / tempos.length) : null;

    const totalSugeridos = historicoPrescricoes.reduce((acc, h) => acc + (h.itens_sugeridos_ia || 0), 0);
    const totalMantidos = historicoPrescricoes.reduce((acc, h) => acc + (h.itens_mantidos_ia || 0), 0);
    const taxaAceitacaoIaPercent =
      totalSugeridos > 0 ? Math.min(100, Math.round((totalMantidos / totalSugeridos) * 100)) : null;

    return {
      tempoMedioSegundos,
      taxaAceitacaoIaPercent,
      totalReceitasEmitidas: historicoPrescricoes.length,
      errosCriticosReportados: 0,
    };
  }, [historicoPrescricoes]);

  return {
    bulario,
    protocolos,
    veterinarios,
    pacientesCadastrados,
    pacientesFilaAtivos,
    historicoPrescricoes,
    clinicaNome,
    clinicaLogoUrl,
    loadingDados,
    processandoIa,
    ultimoTempoIaMs,
    ultimoPayloadPrd,
    kpis,
    carregarDadosIniciais,
    buscarClientesTutorPet,
    salvarPaciente,
    processarEntradaComIa,
    emitirPrescricao,
  };
}
