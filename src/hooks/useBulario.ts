import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  BULARIO_PADRAO,
  calcularPosologiaItem,
  detectarRiscoMdr1PorRaca,
  type RegraBulario,
  type EspeciePaciente,
  type ItemPrescricao,
} from '@/lib/receituarioMotor';
import {
  parseCsvBulario,
  exportarBularioCsv,
  exportarBularioJson,
  gerarModeloCsvBulario,
  type ResultadoParseCsvBulario,
} from '@/lib/bularioParser';

export type OrdenacaoBulario =
  | 'nome_asc'
  | 'nome_desc'
  | 'principio_asc'
  | 'principio_desc'
  | 'classe_asc'
  | 'dose_asc'
  | 'dose_desc'
  | 'mdr1_primeiro'
  | 'toxicos_primeiro';

export interface FiltrosBulario {
  termo?: string;
  especie?: EspeciePaciente | 'todas';
  classe?: string;
  via?: string;
  tipo?: string;
  forma?: string;
  apenasMdr1?: boolean;
  segurancaFelina?: 'todas' | 'seguros' | 'toxicos';
  ordenacao?: OrdenacaoBulario;
}

export interface UseBularioReturn {
  medicamentos: RegraBulario[];
  medicamentosFiltrados: RegraBulario[];
  carregando: boolean;
  erro: string | null;
  totalNoBanco: number;
  filtros: FiltrosBulario;
  setFiltros: React.Dispatch<React.SetStateAction<FiltrosBulario>>;
  limparFiltros: () => void;
  recarregar: () => Promise<void>;
  salvarMedicamento: (item: RegraBulario) => Promise<{ sucesso: boolean; mensagem?: string }>;
  excluirMedicamento: (slug: string) => Promise<{ sucesso: boolean; mensagem?: string }>;
  importarLote: (itens: RegraBulario[]) => Promise<{ sucesso: boolean; inseridos: number; atualizados: number; total: number; mensagem?: string }>;
  processarCsvParaImportacao: (csvText: string) => ResultadoParseCsvBulario;
  exportarCsv: () => string;
  exportarJson: () => string;
  baixarModeloCsv: () => void;
  calcularDose: (regra: RegraBulario, pesoKg: number, especie: EspeciePaciente, raca?: string) => ItemPrescricao;
}

export const FILTROS_BULARIO_PADRAO: FiltrosBulario = {
  termo: '',
  especie: 'todas',
  classe: 'todas',
  via: 'todas',
  tipo: 'todas',
  forma: 'todas',
  apenasMdr1: false,
  segurancaFelina: 'todas',
  ordenacao: 'nome_asc',
};

export function useBulario(): UseBularioReturn {
  const [medicamentos, setMedicamentos] = useState<RegraBulario[]>(BULARIO_PADRAO);
  const [carregando, setCarregando] = useState<boolean>(true);
  const [erro, setErro] = useState<string | null>(null);
  const [totalNoBanco, setTotalNoBanco] = useState<number>(0);

  const [filtros, setFiltros] = useState<FiltrosBulario>(FILTROS_BULARIO_PADRAO);

  const limparFiltros = useCallback(() => {
    setFiltros(FILTROS_BULARIO_PADRAO);
  }, []);

  const carregarBulario = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const { data, error } = await supabase
        .from('receituario_bulario')
        .select('*')
        .eq('ativo', true)
        .order('principio_ativo', { ascending: true });

      if (error) {
        // Se a tabela ainda não existir ou falhar por RLS, mantém os padrões
        console.warn('[useBulario] Aviso ao carregar receituario_bulario:', error.message);
        setMedicamentos(BULARIO_PADRAO);
        setTotalNoBanco(0);
        return;
      }

      if (Array.isArray(data) && data.length > 0) {
        const mapeados: RegraBulario[] = data.map((r: any) => ({
          slug: r.slug,
          principio_ativo: r.principio_ativo,
          nome_comercial_sugerido: r.nome_comercial_sugerido,
          classe_terapeutica: r.classe_terapeutica,
          tipo_padrao: r.tipo_padrao || 'industrializado',
          icone_via: r.icone_via || 'oral',
          especies_permitidas: r.especies_permitidas || ['canina', 'felina'],
          especies_contraindicadas: r.especies_contraindicadas || [],
          motivo_contraindicacao_especie: r.motivo_contraindicacao_especie,
          risco_mdr1: Boolean(r.risco_mdr1),
          mensagem_mdr1: r.mensagem_mdr1,
          dose_padrao_mg_kg: Number(r.dose_padrao_mg_kg),
          dose_min_mg_kg: Number(r.dose_min_mg_kg),
          dose_max_mg_kg: Number(r.dose_max_mg_kg),
          dose_toxica_mg_kg: r.dose_toxica_mg_kg !== null && r.dose_toxica_mg_kg !== undefined ? Number(r.dose_toxica_mg_kg) : null,
          dose_felina_max_mg_kg: r.dose_felina_max_mg_kg !== null && r.dose_felina_max_mg_kg !== undefined ? Number(r.dose_felina_max_mg_kg) : null,
          alerta_felino_especifico: r.alerta_felino_especifico,
          frequencia_horas_padrao: Number(r.frequencia_horas_padrao) || 12,
          duracao_dias_padrao: Number(r.duracao_dias_padrao) || 7,
          condicao_alimentar: r.condicao_alimentar || 'com_alimento',
          apresentacoes: Array.isArray(r.apresentacoes) ? r.apresentacoes : [],
          interacoes_classes: r.interacoes_classes || [],
          comorbidades_cautela: r.comorbidades_cautela || [],
          orientacoes_padrao: r.orientacoes_padrao || 'Administrar conforme prescrição médica veterinária.',
          palavras_chave: r.palavras_chave || [],
        }));
        setMedicamentos(mapeados);
        setTotalNoBanco(mapeados.length);
      } else {
        setMedicamentos(BULARIO_PADRAO);
        setTotalNoBanco(0);
      }
    } catch (err: any) {
      console.error('[useBulario] Erro ao carregar bulário:', err);
      setErro(err.message || 'Erro ao carregar fármacos');
      setMedicamentos(BULARIO_PADRAO);
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    carregarBulario();
  }, [carregarBulario]);

  const medicamentosFiltrados = useMemo(() => {
    const filtrados = medicamentos.filter((item) => {
      // 1. Termo de busca (princípio ativo, nome comercial, indicação, apresentações ou palavras-chave)
      if (filtros.termo && filtros.termo.trim().length > 0) {
        const termoLimpo = filtros.termo.trim().toLowerCase();
        const coincidePrincipio = (item.principio_ativo || '').toLowerCase().includes(termoLimpo);
        const coincideNome = (item.nome_comercial_sugerido || '').toLowerCase().includes(termoLimpo);
        const coincideClasse = (item.classe_terapeutica || '').toLowerCase().includes(termoLimpo);
        const coincideTags = Array.isArray(item.palavras_chave) && item.palavras_chave.some((tag) => tag.toLowerCase().includes(termoLimpo));
        const coincideApres = Array.isArray(item.apresentacoes) && item.apresentacoes.some((ap) => (ap.rotulo || '').toLowerCase().includes(termoLimpo));

        if (!coincidePrincipio && !coincideNome && !coincideClasse && !coincideTags && !coincideApres) {
          return false;
        }
      }

      // 2. Filtro de espécie
      if (filtros.especie && filtros.especie !== 'todas') {
        const permite = item.especies_permitidas?.includes(filtros.especie);
        const contraindicado = item.especies_contraindicadas?.includes(filtros.especie);
        if (!permite || contraindicado) return false;
      }

      // 3. Filtro de classe terapêutica
      if (filtros.classe && filtros.classe !== 'todas') {
        if (item.classe_terapeutica !== filtros.classe) return false;
      }

      // 4. Filtro de via de administração
      if (filtros.via && filtros.via !== 'todas') {
        if (item.icone_via !== filtros.via) return false;
      }

      // 5. Filtro de tipo (industrializado / manipulado)
      if (filtros.tipo && filtros.tipo !== 'todas') {
        if (item.tipo_padrao !== filtros.tipo) return false;
      }

      // 6. Filtro de forma farmacêutica (comprimido, gotas, etc.)
      if (filtros.forma && filtros.forma !== 'todas') {
        const temForma = Array.isArray(item.apresentacoes) && item.apresentacoes.some((ap) => ap.forma === filtros.forma);
        if (!temForma) return false;
      }

      // 7. Filtro MDR1
      if (filtros.apenasMdr1) {
        if (!item.risco_mdr1) return false;
      }

      // 8. Segurança Felina
      if (filtros.segurancaFelina === 'seguros') {
        if (item.especies_contraindicadas?.includes('felina')) return false;
      } else if (filtros.segurancaFelina === 'toxicos') {
        if (!item.especies_contraindicadas?.includes('felina')) return false;
      }

      return true;
    });

    // Ordenação
    const ordenacao = filtros.ordenacao || 'nome_asc';
    return [...filtrados].sort((a, b) => {
      switch (ordenacao) {
        case 'nome_asc':
          return (a.nome_comercial_sugerido || '').localeCompare(b.nome_comercial_sugerido || '', 'pt-BR');
        case 'nome_desc':
          return (b.nome_comercial_sugerido || '').localeCompare(a.nome_comercial_sugerido || '', 'pt-BR');
        case 'principio_asc':
          return (a.principio_ativo || '').localeCompare(b.principio_ativo || '', 'pt-BR');
        case 'principio_desc':
          return (b.principio_ativo || '').localeCompare(a.principio_ativo || '', 'pt-BR');
        case 'classe_asc':
          return (a.classe_terapeutica || '').localeCompare(b.classe_terapeutica || '', 'pt-BR');
        case 'dose_asc':
          return (a.dose_padrao_mg_kg ?? 0) - (b.dose_padrao_mg_kg ?? 0);
        case 'dose_desc':
          return (b.dose_padrao_mg_kg ?? 0) - (a.dose_padrao_mg_kg ?? 0);
        case 'mdr1_primeiro': {
          const mdrA = a.risco_mdr1 ? 1 : 0;
          const mdrB = b.risco_mdr1 ? 1 : 0;
          if (mdrA !== mdrB) return mdrB - mdrA;
          return (a.nome_comercial_sugerido || '').localeCompare(b.nome_comercial_sugerido || '', 'pt-BR');
        }
        case 'toxicos_primeiro': {
          const toxA = a.especies_contraindicadas?.includes('felina') ? 1 : 0;
          const toxB = b.especies_contraindicadas?.includes('felina') ? 1 : 0;
          if (toxA !== toxB) return toxB - toxA;
          return (a.nome_comercial_sugerido || '').localeCompare(b.nome_comercial_sugerido || '', 'pt-BR');
        }
        default:
          return 0;
      }
    });
  }, [medicamentos, filtros]);

  const salvarMedicamento = useCallback(
    async (item: RegraBulario): Promise<{ sucesso: boolean; mensagem?: string }> => {
      try {
        const { error } = await supabase.from('receituario_bulario').upsert(
          {
            slug: item.slug,
            principio_ativo: item.principio_ativo,
            nome_comercial_sugerido: item.nome_comercial_sugerido,
            classe_terapeutica: item.classe_terapeutica,
            tipo_padrao: item.tipo_padrao,
            icone_via: item.icone_via,
            especies_permitidas: item.especies_permitidas,
            especies_contraindicadas: item.especies_contraindicadas,
            motivo_contraindicacao_especie: item.motivo_contraindicacao_especie,
            risco_mdr1: item.risco_mdr1,
            mensagem_mdr1: item.mensagem_mdr1,
            dose_padrao_mg_kg: item.dose_padrao_mg_kg,
            dose_min_mg_kg: item.dose_min_mg_kg,
            dose_max_mg_kg: item.dose_max_mg_kg,
            dose_toxica_mg_kg: item.dose_toxica_mg_kg,
            dose_felina_max_mg_kg: item.dose_felina_max_mg_kg,
            alerta_felino_especifico: item.alerta_felino_especifico,
            frequencia_horas_padrao: item.frequencia_horas_padrao,
            duracao_dias_padrao: item.duracao_dias_padrao,
            condicao_alimentar: item.condicao_alimentar,
            apresentacoes: item.apresentacoes,
            interacoes_classes: item.interacoes_classes,
            comorbidades_cautela: item.comorbidades_cautela,
            orientacoes_padrao: item.orientacoes_padrao,
            palavras_chave: item.palavras_chave,
            ativo: true,
          },
          { onConflict: 'slug' }
        );

        if (error) throw error;

        // Atualiza estado local
        setMedicamentos((prev) => {
          const idx = prev.findIndex((m) => m.slug === item.slug);
          if (idx >= 0) {
            const copia = [...prev];
            copia[idx] = item;
            return copia;
          }
          return [...prev, item].sort((a, b) => a.principio_ativo.localeCompare(b.principio_ativo));
        });

        return { sucesso: true };
      } catch (err: any) {
        console.error('[useBulario] Erro ao salvar medicamento:', err);
        return { sucesso: false, mensagem: err.message || 'Erro ao salvar no banco' };
      }
    },
    []
  );

  const excluirMedicamento = useCallback(
    async (slug: string): Promise<{ sucesso: boolean; mensagem?: string }> => {
      try {
        // Tenta exclusão física direta do banco
        const { error: deleteError } = await supabase
          .from('receituario_bulario')
          .delete()
          .eq('slug', slug);

        if (deleteError) {
          // Se houver restrição de integridade ou chave estrangeira, faz exclusão lógica (desativação)
          const { error: updateError } = await supabase
            .from('receituario_bulario')
            .update({ ativo: false })
            .eq('slug', slug);

          if (updateError) throw updateError;
        }

        // Remove imediatamente do estado em memória
        setMedicamentos((prev) => prev.filter((m) => m.slug !== slug));
        return { sucesso: true };
      } catch (err: any) {
        console.error('[useBulario] Erro ao excluir medicamento:', err);
        return { sucesso: false, mensagem: err.message || 'Erro ao remover medicamento' };
      }
    },
    []
  );

  const importarLote = useCallback(
    async (
      itens: RegraBulario[]
    ): Promise<{ sucesso: boolean; inseridos: number; atualizados: number; total: number; mensagem?: string }> => {
      if (!itens || itens.length === 0) {
        return { sucesso: false, inseridos: 0, atualizados: 0, total: 0, mensagem: 'Nenhum item para importar' };
      }

      try {
        // Tenta executar via RPC importar_bulario_em_lote se disponível
        const { data: rpcRes, error: rpcError } = await supabase.rpc('importar_bulario_em_lote', {
          p_medicamentos: itens,
        });

        if (!rpcError && rpcRes && rpcRes.sucesso) {
          await carregarBulario();
          return {
            sucesso: true,
            total: rpcRes.total_recebido || itens.length,
            inseridos: rpcRes.inseridos || 0,
            atualizados: rpcRes.atualizados || 0,
          };
        }

        // Fallback: upsert direto via cliente Supabase se RPC não existir
        const linhasBanco = itens.map((item) => ({
          slug: item.slug,
          principio_ativo: item.principio_ativo,
          nome_comercial_sugerido: item.nome_comercial_sugerido,
          classe_terapeutica: item.classe_terapeutica,
          tipo_padrao: item.tipo_padrao,
          icone_via: item.icone_via,
          especies_permitidas: item.especies_permitidas,
          especies_contraindicadas: item.especies_contraindicadas,
          motivo_contraindicacao_especie: item.motivo_contraindicacao_especie,
          risco_mdr1: item.risco_mdr1,
          mensagem_mdr1: item.mensagem_mdr1,
          dose_padrao_mg_kg: item.dose_padrao_mg_kg,
          dose_min_mg_kg: item.dose_min_mg_kg,
          dose_max_mg_kg: item.dose_max_mg_kg,
          dose_toxica_mg_kg: item.dose_toxica_mg_kg,
          dose_felina_max_mg_kg: item.dose_felina_max_mg_kg,
          alerta_felino_especifico: item.alerta_felino_especifico,
          frequencia_horas_padrao: item.frequencia_horas_padrao,
          duracao_dias_padrao: item.duracao_dias_padrao,
          condicao_alimentar: item.condicao_alimentar,
          apresentacoes: item.apresentacoes,
          interacoes_classes: item.interacoes_classes,
          comorbidades_cautela: item.comorbidades_cautela,
          orientacoes_padrao: item.orientacoes_padrao,
          palavras_chave: item.palavras_chave,
          ativo: true,
        }));

        const { error: upsertError } = await supabase
          .from('receituario_bulario')
          .upsert(linhasBanco, { onConflict: 'slug' });

        if (upsertError) throw upsertError;

        await carregarBulario();
        return {
          sucesso: true,
          total: itens.length,
          inseridos: itens.length,
          atualizados: 0,
        };
      } catch (err: any) {
        console.error('[useBulario] Erro na importação em lote:', err);
        return {
          sucesso: false,
          total: itens.length,
          inseridos: 0,
          atualizados: 0,
          mensagem: err.message || 'Erro durante importação dos produtos',
        };
      }
    },
    [carregarBulario]
  );

  const processarCsvParaImportacao = useCallback((csvText: string): ResultadoParseCsvBulario => {
    return parseCsvBulario(csvText);
  }, []);

  const exportarCsv = useCallback((): string => {
    return exportarBularioCsv(medicamentos);
  }, [medicamentos]);

  const exportarJson = useCallback((): string => {
    return exportarBularioJson(medicamentos);
  }, [medicamentos]);

  const baixarModeloCsv = useCallback(() => {
    const csvContent = gerarModeloCsvBulario();
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'modelo_bulario_veterinario.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, []);

  const calcularDose = useCallback(
    (regra: RegraBulario, pesoKg: number, especie: EspeciePaciente, raca?: string): ItemPrescricao => {
      const mutacaoMdr1 = detectarRiscoMdr1PorRaca(especie, raca);
      return calcularPosologiaItem({
        regra,
        paciente: {
          especie,
          peso_kg: pesoKg,
          raca: raca || null,
          mutacao_mdr1: mutacaoMdr1,
        },
      });
    },
    []
  );

  return {
    medicamentos,
    medicamentosFiltrados,
    carregando,
    erro,
    totalNoBanco,
    filtros,
    setFiltros,
    limparFiltros,
    recarregar: carregarBulario,
    salvarMedicamento,
    excluirMedicamento,
    importarLote,
    processarCsvParaImportacao,
    exportarCsv,
    exportarJson,
    baixarModeloCsv,
    calcularDose,
  };
}
