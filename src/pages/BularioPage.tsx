import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  Pill,
  Search,
  Plus,
  Upload,
  Download,
  FileSpreadsheet,
  FileCode,
  Sparkles,
  AlertTriangle,
  ShieldAlert,
  Calculator,
  CheckCircle2,
  Trash2,
  Edit,
  Utensils,
  Clock,
  Calendar,
  Layers,
  ChevronDown,
  Info,
  Filter,
  Check,
  RefreshCw,
  FileText,
  ClipboardPaste,
  X,
  LayoutGrid,
  List,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  SlidersHorizontal,
  RotateCcw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { useBulario } from '@/hooks/useBulario';
import {
  type RegraBulario,
  type ApresentacaoComercial,
  type EspeciePaciente,
  type ViaAdministracao,
  type CondicaoAlimentar,
  ROTULO_CONDICAO_ALIMENTAR,
} from '@/lib/receituarioMotor';
import { gerarSlugBulario } from '@/lib/bularioParser';

export default function BularioPage() {
  const {
    medicamentos,
    medicamentosFiltrados,
    carregando,
    filtros,
    setFiltros,
    limparFiltros,
    recarregar,
    salvarMedicamento,
    excluirMedicamento,
    importarLote,
    processarCsvParaImportacao,
    exportarCsv,
    exportarJson,
    baixarModeloCsv,
    calcularDose,
  } = useBulario();

  // Estados de visualização, filtros avançados e paginação
  const [modoVisualizacao, setModoVisualizacao] = useState<'grid' | 'tabela'>('grid');
  const [filtrosAvancadosAbertos, setFiltrosAvancadosAbertos] = useState<boolean>(false);
  const [paginaAtual, setPaginaAtual] = useState<number>(1);
  const [itensPorPagina, setItensPorPagina] = useState<number>(12);
  const listTopRef = useRef<HTMLDivElement>(null);

  // Estados dos modais
  const [modalNovoAberto, setModalNovoAberto] = useState(false);
  const [modalImportarAberto, setModalImportarAberto] = useState(false);
  const [modalCalculadoraAberto, setModalCalculadoraAberto] = useState(false);
  const [itemParaExcluir, setItemParaExcluir] = useState<RegraBulario | null>(null);

  // Fármaco selecionado para edição ou cálculo detalhado
  const [medicamentoEditando, setMedicamentoEditando] = useState<RegraBulario | null>(null);
  const [medicamentoCalculo, setMedicamentoCalculo] = useState<RegraBulario | null>(null);

  // Parâmetros do simulador posológico
  const [simPeso, setSimPeso] = useState<number>(10);
  const [simEspecie, setSimEspecie] = useState<EspeciePaciente>('canina');
  const [simRaca, setSimRaca] = useState<string>('');

  // Estados do formulário de importação (Arquivo ou Colar Texto)
  const [abaImportacao, setAbaImportacao] = useState<'arquivo' | 'texto'>('arquivo');
  const [arquivoImportando, setArquivoImportando] = useState<File | null>(null);
  const [textoColado, setTextoColado] = useState<string>('');
  const [previaImportacao, setPreviaImportacao] = useState<{
    itens: RegraBulario[];
    erros: string[];
    totalLido: number;
  } | null>(null);
  const [salvandoImportacao, setSalvandoImportacao] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Gerenciador de Apresentação Comercial do modal de criação/edição
  const [novoRotuloApres, setNovoRotuloApres] = useState('');
  const [novaFormaApres, setNovaFormaApres] = useState<ApresentacaoComercial['forma']>('comprimido');
  const [novaConcApres, setNovaConcApres] = useState('');
  const [novoDivisivelApres, setNovoDivisivelApres] = useState(true);

  // Formulário de criação / edição de fármaco
  const [formData, setFormData] = useState<Partial<RegraBulario>>({
    principio_ativo: '',
    nome_comercial_sugerido: '',
    classe_terapeutica: 'antibiotico',
    tipo_padrao: 'industrializado',
    icone_via: 'oral',
    especies_permitidas: ['canina', 'felina'],
    especies_contraindicadas: [],
    motivo_contraindicacao_especie: '',
    risco_mdr1: false,
    mensagem_mdr1: '',
    dose_padrao_mg_kg: 10,
    dose_min_mg_kg: 5,
    dose_max_mg_kg: 15,
    dose_toxica_mg_kg: null,
    dose_felina_max_mg_kg: null,
    alerta_felino_especifico: '',
    frequencia_horas_padrao: 12,
    duracao_dias_padrao: 7,
    condicao_alimentar: 'com_alimento',
    orientacoes_padrao: 'Administrar conforme prescrição médica veterinária.',
    palavras_chave: [],
    apresentacoes: [],
  });

  // Reset de página sempre que filtros ou itensPorPagina mudarem
  useEffect(() => {
    setPaginaAtual(1);
  }, [
    filtros.termo,
    filtros.especie,
    filtros.classe,
    filtros.via,
    filtros.tipo,
    filtros.forma,
    filtros.apenasMdr1,
    filtros.segurancaFelina,
    filtros.ordenacao,
    itensPorPagina,
  ]);

  // Métricas rápidas
  const metricas = useMemo(() => {
    let canina = 0;
    let felina = 0;
    let mdr1 = 0;
    let contraGatos = 0;

    medicamentos.forEach((m) => {
      if (m.especies_permitidas?.includes('canina')) canina++;
      if (m.especies_permitidas?.includes('felina')) felina++;
      if (m.risco_mdr1) mdr1++;
      if (m.especies_contraindicadas?.includes('felina')) contraGatos++;
    });

    return {
      total: medicamentos.length,
      canina,
      felina,
      mdr1,
      contraGatos,
    };
  }, [medicamentos]);

  // Lista única de classes terapêuticas
  const classesDisponiveis = useMemo(() => {
    const set = new Set<string>();
    medicamentos.forEach((m) => {
      if (m.classe_terapeutica) set.add(m.classe_terapeutica);
    });
    return Array.from(set).sort();
  }, [medicamentos]);

  // Formas farmacêuticas disponíveis
  const formasDisponiveis = useMemo(() => {
    const set = new Set<string>();
    medicamentos.forEach((m) => {
      m.apresentacoes?.forEach((ap) => {
        if (ap.forma) set.add(ap.forma);
      });
    });
    return Array.from(set).sort();
  }, [medicamentos]);

  // Verifica se há algum filtro aplicado
  const temFiltroAtivo = useMemo(() => {
    return Boolean(
      (filtros.termo && filtros.termo.trim().length > 0) ||
      (filtros.especie && filtros.especie !== 'todas') ||
      (filtros.classe && filtros.classe !== 'todas') ||
      (filtros.via && filtros.via !== 'todas') ||
      (filtros.tipo && filtros.tipo !== 'todas') ||
      (filtros.forma && filtros.forma !== 'todas') ||
      filtros.apenasMdr1 ||
      (filtros.segurancaFelina && filtros.segurancaFelina !== 'todas')
    );
  }, [filtros]);

  // Cálculos de Paginação
  const totalItens = medicamentosFiltrados.length;
  const totalPaginas = itensPorPagina >= 9999 ? 1 : Math.max(1, Math.ceil(totalItens / itensPorPagina));
  const paginaEfetiva = Math.min(Math.max(1, paginaAtual), totalPaginas);

  const itensExibidos = useMemo(() => {
    if (itensPorPagina >= 9999) return medicamentosFiltrados;
    const inicio = (paginaEfetiva - 1) * itensPorPagina;
    return medicamentosFiltrados.slice(inicio, inicio + itensPorPagina);
  }, [medicamentosFiltrados, paginaEfetiva, itensPorPagina]);

  const itemInicio = totalItens === 0 ? 0 : (paginaEfetiva - 1) * (itensPorPagina >= 9999 ? totalItens : itensPorPagina) + 1;
  const itemFim = itensPorPagina >= 9999 ? totalItens : Math.min(paginaEfetiva * itensPorPagina, totalItens);

  const mudarPagina = (novaPagina: number) => {
    const val = Math.min(Math.max(1, novaPagina), totalPaginas);
    setPaginaAtual(val);
    if (listTopRef.current) {
      listTopRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  // Botões de navegação numérica para a paginação
  const gerarBotoesPagina = () => {
    const botoes: (number | 'ellipsis')[] = [];
    if (totalPaginas <= 7) {
      for (let i = 1; i <= totalPaginas; i++) {
        botoes.push(i);
      }
    } else {
      if (paginaEfetiva <= 4) {
        botoes.push(1, 2, 3, 4, 5, 'ellipsis', totalPaginas);
      } else if (paginaEfetiva >= totalPaginas - 3) {
        botoes.push(1, 'ellipsis', totalPaginas - 4, totalPaginas - 3, totalPaginas - 2, totalPaginas - 1, totalPaginas);
      } else {
        botoes.push(1, 'ellipsis', paginaEfetiva - 1, paginaEfetiva, paginaEfetiva + 1, 'ellipsis', totalPaginas);
      }
    }
    return botoes;
  };

  // Alterna ordenação clicando no cabeçalho da tabela
  const alternarOrdenacaoTabela = (campo: 'nome' | 'principio' | 'classe' | 'dose') => {
    setFiltros((prev) => {
      const ordAtual = prev.ordenacao || 'nome_asc';
      if (campo === 'nome') {
        return { ...prev, ordenacao: ordAtual === 'nome_asc' ? 'nome_desc' : 'nome_asc' };
      }
      if (campo === 'principio') {
        return { ...prev, ordenacao: ordAtual === 'principio_asc' ? 'principio_desc' : 'principio_asc' };
      }
      if (campo === 'classe') {
        return { ...prev, ordenacao: ordAtual === 'classe_asc' ? 'nome_asc' : 'classe_asc' };
      }
      if (campo === 'dose') {
        return { ...prev, ordenacao: ordAtual === 'dose_asc' ? 'dose_desc' : 'dose_asc' };
      }
      return prev;
    });
  };

  // Abre formulário para criação (INCLUIR)
  const handleAbrirCriacao = () => {
    setMedicamentoEditando(null);
    setFormData({
      slug: '',
      principio_ativo: '',
      nome_comercial_sugerido: '',
      classe_terapeutica: 'antibiotico',
      tipo_padrao: 'industrializado',
      icone_via: 'oral',
      especies_permitidas: ['canina', 'felina'],
      especies_contraindicadas: [],
      motivo_contraindicacao_especie: '',
      risco_mdr1: false,
      mensagem_mdr1: '',
      dose_padrao_mg_kg: 10,
      dose_min_mg_kg: 5,
      dose_max_mg_kg: 15,
      dose_toxica_mg_kg: null,
      dose_felina_max_mg_kg: null,
      alerta_felino_especifico: '',
      frequencia_horas_padrao: 12,
      duracao_dias_padrao: 7,
      condicao_alimentar: 'com_alimento',
      orientacoes_padrao: 'Administrar após a alimentação.',
      palavras_chave: [],
      apresentacoes: [
        { rotulo: 'Comprimido 50 mg', forma: 'comprimido', concentracao_mg: 50, divisivel: true },
      ],
    });
    setNovoRotuloApres('');
    setNovaConcApres('');
    setModalNovoAberto(true);
  };

  // Abre formulário para edição
  const handleAbrirEdicao = (med: RegraBulario) => {
    setMedicamentoEditando(med);
    setFormData({
      ...med,
      apresentacoes: [...(med.apresentacoes || [])],
      especies_permitidas: [...med.especies_permitidas],
      especies_contraindicadas: [...med.especies_contraindicadas],
      palavras_chave: [...med.palavras_chave],
    });
    setNovoRotuloApres('');
    setNovaConcApres('');
    setModalNovoAberto(true);
  };

  // Adiciona apresentação na lista do fármaco
  const handleAdicionarApresentacao = () => {
    if (!novoRotuloApres.trim()) {
      toast.warning('Informe o rótulo da apresentação (ex: Comprimido 250 mg).');
      return;
    }
    const conc = parseFloat(novaConcApres.replace(',', '.'));
    const nova: ApresentacaoComercial = {
      rotulo: novoRotuloApres.trim(),
      forma: novaFormaApres,
      concentracao_mg: !isNaN(conc) && ['comprimido', 'manipulado'].includes(novaFormaApres) ? conc : undefined,
      concentracao_mg_ml: !isNaN(conc) && ['suspensao_ml', 'gotas', 'gotas_otologicas'].includes(novaFormaApres) ? conc : undefined,
      divisivel: novoDivisivelApres,
    };

    setFormData((prev) => ({
      ...prev,
      apresentacoes: [...(prev.apresentacoes || []), nova],
    }));

    setNovoRotuloApres('');
    setNovaConcApres('');
    toast.success('Apresentação adicionada!');
  };

  // Remove apresentação da lista do fármaco
  const handleRemoverApresentacao = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      apresentacoes: (prev.apresentacoes || []).filter((_, i) => i !== index),
    }));
  };

  // Alterna espécie permitida
  const toggleEspeciePermitida = (esp: EspeciePaciente) => {
    const atuais = formData.especies_permitidas || [];
    if (atuais.includes(esp)) {
      if (atuais.length === 1) {
        toast.warning('O fármaco deve ser permitido para ao menos uma espécie.');
        return;
      }
      setFormData({
        ...formData,
        especies_permitidas: atuais.filter((e) => e !== esp),
      });
    } else {
      setFormData({
        ...formData,
        especies_permitidas: [...atuais, esp],
        especies_contraindicadas: (formData.especies_contraindicadas || []).filter((e) => e !== esp),
      });
    }
  };

  // Alterna espécie contraindicada
  const toggleEspecieContraindicada = (esp: EspeciePaciente) => {
    const atuais = formData.especies_contraindicadas || [];
    if (atuais.includes(esp)) {
      setFormData({
        ...formData,
        especies_contraindicadas: atuais.filter((e) => e !== esp),
      });
    } else {
      setFormData({
        ...formData,
        especies_contraindicadas: [...atuais, esp],
        especies_permitidas: (formData.especies_permitidas || []).filter((e) => e !== esp),
      });
    }
  };

  // Salva fármaco (INCLUIR ou EDITAR)
  const handleSalvarFormulario = async () => {
    if (!formData.principio_ativo?.trim()) {
      toast.error('Informe o princípio ativo.');
      return;
    }

    const principio = formData.principio_ativo.trim();
    const nomeComercial = formData.nome_comercial_sugerido?.trim() || principio;
    const slug = formData.slug?.trim() || gerarSlugBulario(`${nomeComercial}-${principio}`);

    const itemCompleto: RegraBulario = {
      slug,
      principio_ativo: principio,
      nome_comercial_sugerido: nomeComercial,
      classe_terapeutica: formData.classe_terapeutica || 'clinica_geral',
      tipo_padrao: formData.tipo_padrao || 'industrializado',
      icone_via: formData.icone_via || 'oral',
      especies_permitidas: formData.especies_permitidas || ['canina', 'felina'],
      especies_contraindicadas: formData.especies_contraindicadas || [],
      motivo_contraindicacao_especie: formData.motivo_contraindicacao_especie || null,
      risco_mdr1: Boolean(formData.risco_mdr1),
      mensagem_mdr1: formData.mensagem_mdr1 || null,
      dose_padrao_mg_kg: Number(formData.dose_padrao_mg_kg) || 1.0,
      dose_min_mg_kg: Number(formData.dose_min_mg_kg) || Number(formData.dose_padrao_mg_kg) || 1.0,
      dose_max_mg_kg: Number(formData.dose_max_mg_kg) || Number(formData.dose_padrao_mg_kg) || 1.0,
      dose_toxica_mg_kg: formData.dose_toxica_mg_kg ? Number(formData.dose_toxica_mg_kg) : null,
      dose_felina_max_mg_kg: formData.dose_felina_max_mg_kg ? Number(formData.dose_felina_max_mg_kg) : null,
      alerta_felino_especifico: formData.alerta_felino_especifico || null,
      frequencia_horas_padrao: Number(formData.frequencia_horas_padrao) || 12,
      duracao_dias_padrao: Number(formData.duracao_dias_padrao) || 7,
      condicao_alimentar: formData.condicao_alimentar || 'com_alimento',
      apresentacoes: formData.apresentacoes && formData.apresentacoes.length > 0 ? formData.apresentacoes : [
        { rotulo: nomeComercial, forma: 'comprimido', divisivel: true },
      ],
      interacoes_classes: formData.interacoes_classes || [],
      comorbidades_cautela: formData.comorbidades_cautela || [],
      orientacoes_padrao: formData.orientacoes_padrao || 'Administrar conforme prescrição médica veterinária.',
      palavras_chave: formData.palavras_chave && formData.palavras_chave.length > 0 ? formData.palavras_chave : [principio.toLowerCase()],
    };

    const res = await salvarMedicamento(itemCompleto);
    if (res.sucesso) {
      toast.success(medicamentoEditando ? 'Medicamento atualizado no bulário!' : 'Novo medicamento cadastrado com sucesso!');
      setModalNovoAberto(false);
    } else {
      toast.error(res.mensagem || 'Erro ao salvar medicamento.');
    }
  };

  // Confirmação e EXCLUSÃO real
  const handleConfirmarExclusao = async () => {
    if (!itemParaExcluir) return;
    const res = await excluirMedicamento(itemParaExcluir.slug);
    if (res.sucesso) {
      toast.success(`Medicamento "${itemParaExcluir.nome_comercial_sugerido}" excluído do bulário!`);
    } else {
      toast.error(res.mensagem || 'Erro ao excluir fármaco.');
    }
    setItemParaExcluir(null);
  };

  // Processa arquivo CSV ou JSON
  const handleArquivoSelecionado = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setArquivoImportando(file);
    try {
      const text = await file.text();
      if (file.name.endsWith('.json')) {
        const parsed = JSON.parse(text);
        if (Array.isArray(parsed)) {
          setPreviaImportacao({
            itens: parsed,
            erros: [],
            totalLido: parsed.length,
          });
        } else {
          toast.error('O arquivo JSON deve conter um array de medicamentos.');
        }
      } else {
        const resultado = processarCsvParaImportacao(text);
        setPreviaImportacao(resultado);
        if (resultado.erros.length > 0) {
          toast.warning(`${resultado.erros.length} aviso(s) encontrado(s) no CSV.`);
        }
      }
    } catch (err: any) {
      toast.error(`Erro ao ler arquivo: ${err.message}`);
    }
  };

  // Processa texto CSV colado diretamente na caixa de texto
  const handleAnalisarTextoColado = () => {
    if (!textoColado.trim()) {
      toast.warning('Cole o conteúdo CSV ou JSON na caixa de texto.');
      return;
    }

    try {
      const trimmed = textoColado.trim();
      if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          setPreviaImportacao({
            itens: parsed,
            erros: [],
            totalLido: parsed.length,
          });
          toast.success(`${parsed.length} itens JSON identificados!`);
          return;
        }
      }

      const resultado = processarCsvParaImportacao(textoColado);
      setPreviaImportacao(resultado);
      if (resultado.itens.length > 0) {
        toast.success(`${resultado.itens.length} medicamentos identificados no texto!`);
      } else {
        toast.error('Nenhum medicamento reconhecido. Confira se há linha de cabeçalho.');
      }
    } catch (err: any) {
      toast.error(`Erro ao processar texto: ${err.message}`);
    }
  };

  // Executa importação dos dados previamente analisados (IMPORTAR)
  const handleConfirmarImportacao = async () => {
    if (!previaImportacao || previaImportacao.itens.length === 0) return;

    setSalvandoImportacao(true);
    try {
      const res = await importarLote(previaImportacao.itens);
      if (res.sucesso) {
        toast.success(`Importação realizada com sucesso! ${res.total} produtos gravados.`);
        setModalImportarAberto(false);
        setPreviaImportacao(null);
        setArquivoImportando(null);
        setTextoColado('');
      } else {
        toast.error(res.mensagem || 'Falha na importação.');
      }
    } finally {
      setSalvandoImportacao(false);
    }
  };

  // EXPORTAR CSV
  const handleDownloadCsv = () => {
    const csvContent = exportarCsv();
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `bulario_veterinario_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success('Download do Bulário em CSV concluído!');
  };

  // EXPORTAR JSON
  const handleDownloadJson = () => {
    const jsonContent = exportarJson();
    const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `bulario_veterinario_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success('Download do Bulário em JSON concluído!');
  };

  // Simulação posológica rápida
  const resultadoCalculo = useMemo(() => {
    if (!medicamentoCalculo) return null;
    return calcularDose(medicamentoCalculo, simPeso, simEspecie, simRaca);
  }, [medicamentoCalculo, simPeso, simEspecie, simRaca, calcularDose]);

  return (
    <div className="flex-1 h-full min-h-0 overflow-y-auto space-y-5 p-4 md:p-8 max-w-7xl mx-auto [scrollbar-gutter:stable]">
      {/* Topo / Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b pb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-primary/10 rounded-lg text-primary">
              <Pill className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                Bulário Veterinário & Índice Terapêutico
              </h1>
              <p className="text-sm text-muted-foreground">
                Catálogo clínico de fármacos, calculadora posológica instantânea, importação/exportação e controle de estoque.
              </p>
            </div>
          </div>
        </div>

        {/* Botões de Ação Principais: Incluir, Importar, Exportar */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Botão INCLUIR NOVO ITEM */}
          <Button
            variant="default"
            size="sm"
            onClick={handleAbrirCriacao}
            className="text-xs gap-1.5 h-8 font-bold shadow-xs"
          >
            <Plus className="h-4 w-4" />
            Novo Fármaco
          </Button>

          {/* Botão IMPORTAR */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setPreviaImportacao(null);
              setArquivoImportando(null);
              setTextoColado('');
              setModalImportarAberto(true);
            }}
            className="text-xs gap-1.5 h-8 border-primary/30 text-primary hover:bg-primary/5"
          >
            <Upload className="h-3.5 w-3.5" />
            Importar CSV / JSON
          </Button>

          {/* Botão EXPORTAR CSV */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownloadCsv}
            className="text-xs gap-1.5 h-8"
            title="Exportar todos os fármacos cadastrados em formato CSV (compatível com Excel)"
          >
            <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
            Exportar CSV
          </Button>

          {/* Botão EXPORTAR JSON */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownloadJson}
            className="text-xs gap-1.5 h-8"
            title="Exportar todos os fármacos cadastrados em formato JSON estruturado"
          >
            <FileCode className="h-3.5 w-3.5 text-blue-600" />
            Exportar JSON
          </Button>

          {/* Botão BAIXAR MODELO CSV */}
          <Button
            variant="ghost"
            size="sm"
            onClick={baixarModeloCsv}
            className="text-xs gap-1.5 h-8 text-muted-foreground"
            title="Baixar planilha modelo vazia/exemplificada para scraping ou preenchimento manual"
          >
            <Download className="h-3.5 w-3.5" />
            Modelo CSV
          </Button>
        </div>
      </div>

      {/* Cards de Métricas Interativas (Clicáveis para filtrar) */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <Card
          onClick={() => {
            setFiltros((prev) => ({
              ...prev,
              especie: 'todas',
              apenasMdr1: false,
              segurancaFelina: 'todas',
            }));
          }}
          className={`p-3 shadow-none border bg-card cursor-pointer transition-all hover:border-primary/40 hover:shadow-xs ${
            filtros.especie === 'todas' && !filtros.apenasMdr1 && (!filtros.segurancaFelina || filtros.segurancaFelina === 'todas')
              ? 'ring-1 ring-primary/40 bg-primary/5'
              : ''
          }`}
          title="Clique para ver todos os fármacos"
        >
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-medium text-muted-foreground">Total no Catálogo</p>
            {filtros.especie === 'todas' && !filtros.apenasMdr1 && (!filtros.segurancaFelina || filtros.segurancaFelina === 'todas') && (
              <Badge variant="secondary" className="text-[9px] h-4 px-1 py-0 font-normal">Todos</Badge>
            )}
          </div>
          <p className="text-xl font-bold text-foreground mt-0.5">{metricas.total}</p>
        </Card>

        <Card
          onClick={() => {
            setFiltros((prev) => ({
              ...prev,
              especie: prev.especie === 'canina' ? 'todas' : 'canina',
            }));
          }}
          className={`p-3 shadow-none border bg-card cursor-pointer transition-all hover:border-primary/40 hover:shadow-xs ${
            filtros.especie === 'canina' ? 'ring-2 ring-primary border-primary bg-primary/5' : ''
          }`}
          title="Clique para filtrar apenas fármacos para cães"
        >
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-medium text-muted-foreground">Uso Canino 🐶</p>
            {filtros.especie === 'canina' && (
              <Badge variant="default" className="text-[9px] h-4 px-1 py-0 font-medium">Ativo</Badge>
            )}
          </div>
          <p className="text-xl font-bold text-foreground mt-0.5">{metricas.canina}</p>
        </Card>

        <Card
          onClick={() => {
            setFiltros((prev) => ({
              ...prev,
              especie: prev.especie === 'felina' ? 'todas' : 'felina',
            }));
          }}
          className={`p-3 shadow-none border bg-card cursor-pointer transition-all hover:border-primary/40 hover:shadow-xs ${
            filtros.especie === 'felina' ? 'ring-2 ring-primary border-primary bg-primary/5' : ''
          }`}
          title="Clique para filtrar fármacos permitidos para gatos"
        >
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-medium text-muted-foreground">Uso Felino 🐱</p>
            {filtros.especie === 'felina' && (
              <Badge variant="default" className="text-[9px] h-4 px-1 py-0 font-medium">Ativo</Badge>
            )}
          </div>
          <p className="text-xl font-bold text-foreground mt-0.5">{metricas.felina}</p>
        </Card>

        <Card
          onClick={() => {
            setFiltros((prev) => ({
              ...prev,
              apenasMdr1: !prev.apenasMdr1,
            }));
          }}
          className={`p-3 shadow-none border bg-card border-amber-500/20 bg-amber-500/5 cursor-pointer transition-all hover:border-amber-500/50 hover:shadow-xs ${
            filtros.apenasMdr1 ? 'ring-2 ring-amber-500 border-amber-500 bg-amber-500/15' : ''
          }`}
          title="Clique para filtrar apenas fármacos com risco de mutação MDR1"
        >
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-medium text-amber-700 dark:text-amber-400">Risco MDR1 ⚠️</p>
            {filtros.apenasMdr1 && (
              <Badge className="bg-amber-600 text-white text-[9px] h-4 px-1 py-0 font-medium">Ativo</Badge>
            )}
          </div>
          <p className="text-xl font-bold text-amber-800 dark:text-amber-300 mt-0.5">{metricas.mdr1}</p>
        </Card>

        <Card
          onClick={() => {
            setFiltros((prev) => ({
              ...prev,
              segurancaFelina: prev.segurancaFelina === 'toxicos' ? 'todas' : 'toxicos',
            }));
          }}
          className={`p-3 shadow-none border bg-card border-destructive/20 bg-destructive/5 cursor-pointer transition-all hover:border-destructive/50 hover:shadow-xs ${
            filtros.segurancaFelina === 'toxicos' ? 'ring-2 ring-destructive border-destructive bg-destructive/15' : ''
          }`}
          title="Clique para filtrar fármacos contraindicados / tóxicos para felinos"
        >
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-medium text-destructive">Tóxicos Felinos ⚠️</p>
            {filtros.segurancaFelina === 'toxicos' && (
              <Badge variant="destructive" className="text-[9px] h-4 px-1 py-0 font-medium">Ativo</Badge>
            )}
          </div>
          <p className="text-xl font-bold text-destructive mt-0.5">{metricas.contraGatos}</p>
        </Card>
      </div>

      {/* Âncora para scroll suave de paginação */}
      <div ref={listTopRef} />

      {/* Barra de Filtros, Busca, Ordenação e Alternador de Visão */}
      <Card className="p-4 shadow-none border space-y-3">
        {/* Linha 1: Busca principal, Espécie, Classe, Via e Ações */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-12 gap-3">
          {/* Busca por texto */}
          <div className="sm:col-span-2 md:col-span-4 relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome comercial, princípio ativo, indicação..."
              value={filtros.termo || ''}
              onChange={(e) => setFiltros((prev) => ({ ...prev, termo: e.target.value }))}
              className="pl-9 pr-8 h-9 text-xs"
            />
            {filtros.termo && (
              <button
                type="button"
                onClick={() => setFiltros((prev) => ({ ...prev, termo: '' }))}
                className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
                title="Limpar busca"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Filtro Espécie */}
          <div className="md:col-span-2">
            <Select
              value={filtros.especie || 'todas'}
              onValueChange={(val) => setFiltros((prev) => ({ ...prev, especie: val as any }))}
            >
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="Espécie" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas as Espécies</SelectItem>
                <SelectItem value="canina">🐶 Canina (Cães)</SelectItem>
                <SelectItem value="felina">🐱 Felina (Gatos)</SelectItem>
                <SelectItem value="silvestre">🐰 Silvestres</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Filtro Classe Terapêutica */}
          <div className="md:col-span-3">
            <Select
              value={filtros.classe || 'todas'}
              onValueChange={(val) => setFiltros((prev) => ({ ...prev, classe: val }))}
            >
              <SelectTrigger className="h-9 text-xs truncate">
                <SelectValue placeholder="Classe Terapêutica" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas as Classes</SelectItem>
                {classesDisponiveis.map((cls) => (
                  <SelectItem key={cls} value={cls}>
                    {cls.replace(/_/g, ' ')}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Filtro Via de Administração */}
          <div className="md:col-span-2">
            <Select
              value={filtros.via || 'todas'}
              onValueChange={(val) => setFiltros((prev) => ({ ...prev, via: val }))}
            >
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="Via" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas as Vias</SelectItem>
                <SelectItem value="oral">Oral</SelectItem>
                <SelectItem value="topica">Tópica</SelectItem>
                <SelectItem value="injetavel">Injetável</SelectItem>
                <SelectItem value="otica">Ótica</SelectItem>
                <SelectItem value="oftalmica">Oftálmica</SelectItem>
                <SelectItem value="inalatoria">Inalatória</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Botão de Filtros Avançados */}
          <div className="md:col-span-1 flex items-center">
            <Button
              type="button"
              variant={filtrosAvancadosAbertos ? 'secondary' : 'outline'}
              size="sm"
              onClick={() => setFiltrosAvancadosAbertos((prev) => !prev)}
              className="h-9 w-full px-2 text-xs gap-1 justify-center"
              title="Filtros avançados (Tipo, Forma Farmacêutica, Segurança Felina)"
            >
              <SlidersHorizontal className="h-3.5 w-3.5 shrink-0" />
              <span className="hidden xl:inline">Mais</span>
              {(filtros.tipo !== 'todas' || filtros.forma !== 'todas' || (filtros.segurancaFelina && filtros.segurancaFelina !== 'todas')) && (
                <span className="h-2 w-2 rounded-full bg-primary shrink-0" />
              )}
            </Button>
          </div>
        </div>

        {/* Linha Opcional de Filtros Avançados (Colapsável) */}
        {filtrosAvancadosAbertos && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 bg-muted/30 rounded-lg border text-xs">
            {/* Tipo: Industrializado / Manipulado */}
            <div className="space-y-1">
              <Label className="text-[11px] text-muted-foreground font-medium">Tipo de Fármaco</Label>
              <Select
                value={filtros.tipo || 'todas'}
                onValueChange={(val) => setFiltros((prev) => ({ ...prev, tipo: val }))}
              >
                <SelectTrigger className="h-8 text-xs bg-background">
                  <SelectValue placeholder="Todos os tipos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todos os tipos</SelectItem>
                  <SelectItem value="industrializado">Industrializado</SelectItem>
                  <SelectItem value="manipulado">Manipulado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Forma Farmacêutica */}
            <div className="space-y-1">
              <Label className="text-[11px] text-muted-foreground font-medium">Forma Farmacêutica</Label>
              <Select
                value={filtros.forma || 'todas'}
                onValueChange={(val) => setFiltros((prev) => ({ ...prev, forma: val }))}
              >
                <SelectTrigger className="h-8 text-xs bg-background">
                  <SelectValue placeholder="Todas as formas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas as formas</SelectItem>
                  {formasDisponiveis.map((forma) => (
                    <SelectItem key={forma} value={forma}>
                      {forma.charAt(0).toUpperCase() + forma.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Segurança para Felinos */}
            <div className="space-y-1">
              <Label className="text-[11px] text-muted-foreground font-medium">Segurança Felina</Label>
              <Select
                value={filtros.segurancaFelina || 'todas'}
                onValueChange={(val) => setFiltros((prev) => ({ ...prev, segurancaFelina: val as any }))}
              >
                <SelectTrigger className="h-8 text-xs bg-background">
                  <SelectValue placeholder="Todas as situações" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas as situações</SelectItem>
                  <SelectItem value="seguros">✓ Apenas seguros para gatos</SelectItem>
                  <SelectItem value="toxicos">⚠️ Apenas contraindicados (Tóxicos)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {/* Linha de Ordenação, Controles e Alternador de Visualização (Grid vs Tabela) */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t text-xs">
          {/* Lado Esquerdo: Ordenação e Toggle MDR1 */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-muted-foreground font-medium whitespace-nowrap">Ordenar por:</span>
              <Select
                value={filtros.ordenacao || 'nome_asc'}
                onValueChange={(val) => setFiltros((prev) => ({ ...prev, ordenacao: val as any }))}
              >
                <SelectTrigger className="h-8 text-xs min-w-[190px] bg-background">
                  <ArrowUpDown className="h-3 w-3 mr-1.5 text-muted-foreground" />
                  <SelectValue placeholder="Ordenação" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="nome_asc">Nome Comercial (A → Z)</SelectItem>
                  <SelectItem value="nome_desc">Nome Comercial (Z → A)</SelectItem>
                  <SelectItem value="principio_asc">Princípio Ativo (A → Z)</SelectItem>
                  <SelectItem value="principio_desc">Princípio Ativo (Z → A)</SelectItem>
                  <SelectItem value="classe_asc">Classe Terapêutica (A → Z)</SelectItem>
                  <SelectItem value="dose_asc">Dose Padrão (Menor primeiro)</SelectItem>
                  <SelectItem value="dose_desc">Dose Padrão (Maior primeiro)</SelectItem>
                  <SelectItem value="mdr1_primeiro">Risco MDR1 primeiro</SelectItem>
                  <SelectItem value="toxicos_primeiro">Tóxicos Felinos primeiro</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <label className="flex items-center gap-1.5 cursor-pointer select-none">
              <Switch
                checked={Boolean(filtros.apenasMdr1)}
                onCheckedChange={(checked) => setFiltros((prev) => ({ ...prev, apenasMdr1: checked }))}
              />
              <span className="font-medium text-foreground text-xs">Risco MDR1</span>
            </label>
          </div>

          {/* Lado Direito: Alternador Grid/Tabela, Contador e Limpar */}
          <div className="flex items-center gap-2.5">
            {temFiltroAtivo && (
              <Button
                variant="ghost"
                size="sm"
                onClick={limparFiltros}
                className="h-8 px-2 text-xs gap-1 text-destructive hover:bg-destructive/10"
                title="Limpar todos os filtros ativos"
              >
                <RotateCcw className="h-3 w-3" /> Limpar filtros
              </Button>
            )}

            <Button
              variant="ghost"
              size="sm"
              onClick={() => recarregar()}
              className="h-8 px-2 text-xs gap-1 text-muted-foreground hover:text-foreground"
              title="Recarregar catálogo"
            >
              <RefreshCw className="h-3 w-3" />
            </Button>

            {/* Alternador de Modo de Exibição (Cards vs Tabela) */}
            <div className="flex items-center border rounded-md p-0.5 bg-muted/40">
              <Button
                type="button"
                variant={modoVisualizacao === 'grid' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setModoVisualizacao('grid')}
                className="h-7 px-2.5 text-xs gap-1.5 shadow-none"
                title="Visualização em Grade de Cards"
              >
                <LayoutGrid className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Cards</span>
              </Button>
              <Button
                type="button"
                variant={modoVisualizacao === 'tabela' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setModoVisualizacao('tabela')}
                className="h-7 px-2.5 text-xs gap-1.5 shadow-none"
                title="Visualização em Tabela Compacta"
              >
                <List className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Tabela</span>
              </Button>
            </div>
          </div>
        </div>

        {/* Chips de Filtros Ativos (Removíveis com 1 clique) */}
        {temFiltroAtivo && (
          <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t">
            <span className="text-[11px] font-medium text-muted-foreground mr-1">Filtros ativos:</span>
            {filtros.termo && (
              <Badge variant="secondary" className="text-[11px] gap-1 py-0.5">
                Busca: "{filtros.termo}"
                <X
                  className="h-3 w-3 cursor-pointer hover:text-foreground"
                  onClick={() => setFiltros((prev) => ({ ...prev, termo: '' }))}
                />
              </Badge>
            )}
            {filtros.especie && filtros.especie !== 'todas' && (
              <Badge variant="secondary" className="text-[11px] gap-1 py-0.5 capitalize">
                Espécie: {filtros.especie}
                <X
                  className="h-3 w-3 cursor-pointer hover:text-foreground"
                  onClick={() => setFiltros((prev) => ({ ...prev, especie: 'todas' }))}
                />
              </Badge>
            )}
            {filtros.classe && filtros.classe !== 'todas' && (
              <Badge variant="secondary" className="text-[11px] gap-1 py-0.5">
                Classe: {filtros.classe.replace(/_/g, ' ')}
                <X
                  className="h-3 w-3 cursor-pointer hover:text-foreground"
                  onClick={() => setFiltros((prev) => ({ ...prev, classe: 'todas' }))}
                />
              </Badge>
            )}
            {filtros.via && filtros.via !== 'todas' && (
              <Badge variant="secondary" className="text-[11px] gap-1 py-0.5 uppercase">
                Via: {filtros.via}
                <X
                  className="h-3 w-3 cursor-pointer hover:text-foreground"
                  onClick={() => setFiltros((prev) => ({ ...prev, via: 'todas' }))}
                />
              </Badge>
            )}
            {filtros.tipo && filtros.tipo !== 'todas' && (
              <Badge variant="secondary" className="text-[11px] gap-1 py-0.5 capitalize">
                Tipo: {filtros.tipo}
                <X
                  className="h-3 w-3 cursor-pointer hover:text-foreground"
                  onClick={() => setFiltros((prev) => ({ ...prev, tipo: 'todas' }))}
                />
              </Badge>
            )}
            {filtros.forma && filtros.forma !== 'todas' && (
              <Badge variant="secondary" className="text-[11px] gap-1 py-0.5 capitalize">
                Forma: {filtros.forma}
                <X
                  className="h-3 w-3 cursor-pointer hover:text-foreground"
                  onClick={() => setFiltros((prev) => ({ ...prev, forma: 'todas' }))}
                />
              </Badge>
            )}
            {filtros.apenasMdr1 && (
              <Badge className="bg-amber-600 text-white text-[11px] gap-1 py-0.5">
                Risco MDR1
                <X
                  className="h-3 w-3 cursor-pointer hover:opacity-80"
                  onClick={() => setFiltros((prev) => ({ ...prev, apenasMdr1: false }))}
                />
              </Badge>
            )}
            {filtros.segurancaFelina && filtros.segurancaFelina !== 'todas' && (
              <Badge
                variant={filtros.segurancaFelina === 'toxicos' ? 'destructive' : 'secondary'}
                className="text-[11px] gap-1 py-0.5"
              >
                {filtros.segurancaFelina === 'toxicos' ? 'Tóxicos Felinos' : 'Seguros para Gatos'}
                <X
                  className="h-3 w-3 cursor-pointer hover:opacity-80"
                  onClick={() => setFiltros((prev) => ({ ...prev, segurancaFelina: 'todas' }))}
                />
              </Badge>
            )}
            <Button
              variant="link"
              size="sm"
              onClick={limparFiltros}
              className="h-auto p-0 text-[11px] text-muted-foreground hover:text-foreground ml-1"
            >
              Limpar todos
            </Button>
          </div>
        )}
      </Card>

      {/* Resumo de Resultados Superior */}
      <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
        <span>
          Mostrando <strong>{itemInicio}</strong> a <strong>{itemFim}</strong> de <strong>{totalItens}</strong> fármacos encontrados
          {totalItens !== medicamentos.length && (
            <span className="text-muted-foreground/70"> (filtrados de {medicamentos.length})</span>
          )}
        </span>
        <span className="hidden sm:inline font-mono">
          Página {paginaEfetiva} de {totalPaginas}
        </span>
      </div>

      {/* VISUALIZAÇÃO 1: GRADE DE CARDS (MODO GRID) */}
      {modoVisualizacao === 'grid' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {itensExibidos.map((med) => {
            const isContraGatos = med.especies_contraindicadas?.includes('felina');
            const isMdr1 = med.risco_mdr1;

            return (
              <Card
                key={med.slug}
                className={`flex flex-col justify-between border shadow-none hover:shadow-xs transition-shadow relative overflow-hidden ${
                  isContraGatos
                    ? 'border-destructive/40 bg-gradient-to-b from-destructive/[0.02] to-transparent'
                    : isMdr1
                    ? 'border-amber-500/40 bg-gradient-to-b from-amber-500/[0.02] to-transparent'
                    : 'hover:border-primary/40'
                }`}
              >
                {/* Linha sutil de destaque no topo do card */}
                {isContraGatos ? (
                  <div className="h-1 w-full bg-destructive" />
                ) : isMdr1 ? (
                  <div className="h-1 w-full bg-amber-500" />
                ) : null}

                <CardHeader className="p-4 pb-2 space-y-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <CardTitle className="text-sm font-bold text-foreground leading-snug truncate" title={med.nome_comercial_sugerido}>
                        {med.nome_comercial_sugerido}
                      </CardTitle>
                      <p className="text-xs text-muted-foreground font-medium truncate" title={med.principio_ativo}>
                        {med.principio_ativo}
                      </p>
                    </div>
                    <Badge variant="outline" className="text-[10px] uppercase tracking-wider shrink-0 font-mono">
                      {med.icone_via}
                    </Badge>
                  </div>

                  <div className="flex flex-wrap gap-1 pt-1">
                    <Badge variant="secondary" className="text-[10px] py-0">
                      {med.classe_terapeutica?.replace(/_/g, ' ')}
                    </Badge>
                    {med.tipo_padrao && (
                      <Badge variant="outline" className="text-[10px] py-0 capitalize text-muted-foreground">
                        {med.tipo_padrao}
                      </Badge>
                    )}
                    {isContraGatos && (
                      <Badge variant="destructive" className="text-[10px] py-0 gap-1">
                        <ShieldAlert className="h-2.5 w-2.5" /> Tóxico Felinos
                      </Badge>
                    )}
                    {isMdr1 && (
                      <Badge className="text-[10px] py-0 bg-amber-600 text-white gap-1">
                        <AlertTriangle className="h-2.5 w-2.5" /> Risco MDR1
                      </Badge>
                    )}
                  </div>
                </CardHeader>

                <CardContent className="p-4 pt-1 space-y-3 flex-1">
                  {/* Faixa de Dosagem */}
                  <div className="p-2.5 bg-muted/40 rounded-md text-xs space-y-1 border border-border/50">
                    <div className="flex justify-between items-baseline">
                      <span className="text-muted-foreground font-medium">Dose padrão:</span>
                      <span className="font-bold text-foreground font-mono text-sm">
                        {med.dose_padrao_mg_kg} mg/kg
                      </span>
                    </div>
                    <div className="flex justify-between items-baseline text-[11px] text-muted-foreground">
                      <span>Faixa terapêutica:</span>
                      <span className="font-mono">
                        {med.dose_min_mg_kg} a {med.dose_max_mg_kg} mg/kg
                      </span>
                    </div>
                    <div className="flex justify-between items-baseline text-[11px] text-muted-foreground pt-0.5 border-t border-border/40">
                      <span>Posologia comum:</span>
                      <span className="font-medium text-foreground">
                        a cada {med.frequencia_horas_padrao}h · {med.duracao_dias_padrao} dias
                      </span>
                    </div>
                  </div>

                  {/* Apresentações */}
                  {med.apresentacoes && med.apresentacoes.length > 0 && (
                    <div className="space-y-1">
                      <p className="text-[11px] font-semibold text-muted-foreground">Apresentações:</p>
                      <div className="flex flex-wrap gap-1">
                        {med.apresentacoes.slice(0, 3).map((ap, idx) => (
                          <span
                            key={idx}
                            className="text-[10px] bg-background border px-1.5 py-0.5 rounded text-foreground font-mono truncate max-w-[140px]"
                            title={ap.rotulo}
                          >
                            {ap.rotulo}
                          </span>
                        ))}
                        {med.apresentacoes.length > 3 && (
                          <span className="text-[10px] text-muted-foreground px-1 self-center">
                            +{med.apresentacoes.length - 3} mais
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Condição Alimentar e Espécies Permitidas */}
                  <div className="flex flex-wrap items-center justify-between gap-1 text-[11px] text-muted-foreground pt-1 border-t">
                    <div className="flex items-center gap-1.5">
                      <Utensils className="h-3 w-3 shrink-0 text-muted-foreground/70" />
                      <span className="truncate max-w-[120px]">
                        {ROTULO_CONDICAO_ALIMENTAR[med.condicao_alimentar] || 'Com alimento'}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      {med.especies_permitidas?.includes('canina') && <span title="Cães permitidos">🐶</span>}
                      {med.especies_permitidas?.includes('felina') && !isContraGatos && <span title="Gatos permitidos">🐱</span>}
                      {med.especies_permitidas?.includes('silvestre') && <span title="Silvestres permitidos">🐰</span>}
                    </div>
                  </div>
                </CardContent>

                {/* Rodapé do Card: Calcular, Editar, Excluir */}
                <div className="p-3 border-t bg-muted/20 flex items-center justify-between gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs gap-1.5 px-2.5 font-medium hover:bg-primary hover:text-primary-foreground hover:border-primary transition-colors"
                    onClick={() => {
                      setMedicamentoCalculo(med);
                      setModalCalculadoraAberto(true);
                    }}
                  >
                    <Calculator className="h-3 w-3" /> Calcular Dose
                  </Button>

                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 hover:bg-muted"
                      onClick={() => handleAbrirEdicao(med)}
                      title="Editar medicamento"
                    >
                      <Edit className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-destructive hover:bg-destructive/10"
                      onClick={() => setItemParaExcluir(med)}
                      title="Excluir medicamento"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* VISUALIZAÇÃO 2: TABELA COMPACTA (MODO TABELA) */}
      {modoVisualizacao === 'tabela' && (
        <div className="border rounded-lg bg-card overflow-hidden shadow-none">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow className="hover:bg-transparent">
                  <TableHead
                    className="cursor-pointer select-none hover:text-primary transition-colors py-3"
                    onClick={() => alternarOrdenacaoTabela('nome')}
                  >
                    <div className="flex items-center gap-1.5 font-bold text-xs">
                      <span>Fármaco / Nome Comercial</span>
                      {filtros.ordenacao === 'nome_asc' && <ArrowUp className="h-3.5 w-3.5 text-primary" />}
                      {filtros.ordenacao === 'nome_desc' && <ArrowDown className="h-3.5 w-3.5 text-primary" />}
                      {filtros.ordenacao !== 'nome_asc' && filtros.ordenacao !== 'nome_desc' && (
                        <ArrowUpDown className="h-3 w-3 text-muted-foreground/60" />
                      )}
                    </div>
                  </TableHead>
                  <TableHead
                    className="cursor-pointer select-none hover:text-primary transition-colors py-3"
                    onClick={() => alternarOrdenacaoTabela('principio')}
                  >
                    <div className="flex items-center gap-1.5 font-bold text-xs">
                      <span>Princípio Ativo</span>
                      {filtros.ordenacao === 'principio_asc' && <ArrowUp className="h-3.5 w-3.5 text-primary" />}
                      {filtros.ordenacao === 'principio_desc' && <ArrowDown className="h-3.5 w-3.5 text-primary" />}
                      {filtros.ordenacao !== 'principio_asc' && filtros.ordenacao !== 'principio_desc' && (
                        <ArrowUpDown className="h-3 w-3 text-muted-foreground/60" />
                      )}
                    </div>
                  </TableHead>
                  <TableHead
                    className="cursor-pointer select-none hover:text-primary transition-colors py-3"
                    onClick={() => alternarOrdenacaoTabela('classe')}
                  >
                    <div className="flex items-center gap-1.5 font-bold text-xs">
                      <span>Classe Terapêutica</span>
                      {filtros.ordenacao === 'classe_asc' && <ArrowUp className="h-3.5 w-3.5 text-primary" />}
                      {filtros.ordenacao !== 'classe_asc' && <ArrowUpDown className="h-3 w-3 text-muted-foreground/60" />}
                    </div>
                  </TableHead>
                  <TableHead className="py-3 font-bold text-xs">Via & Tipo</TableHead>
                  <TableHead
                    className="cursor-pointer select-none hover:text-primary transition-colors py-3"
                    onClick={() => alternarOrdenacaoTabela('dose')}
                  >
                    <div className="flex items-center gap-1.5 font-bold text-xs">
                      <span>Dose Padrão (mg/kg)</span>
                      {filtros.ordenacao === 'dose_asc' && <ArrowUp className="h-3.5 w-3.5 text-primary" />}
                      {filtros.ordenacao === 'dose_desc' && <ArrowDown className="h-3.5 w-3.5 text-primary" />}
                      {filtros.ordenacao !== 'dose_asc' && filtros.ordenacao !== 'dose_desc' && (
                        <ArrowUpDown className="h-3 w-3 text-muted-foreground/60" />
                      )}
                    </div>
                  </TableHead>
                  <TableHead className="py-3 font-bold text-xs">Espécies & Alertas</TableHead>
                  <TableHead className="py-3 font-bold text-xs">Apresentações</TableHead>
                  <TableHead className="text-right py-3 font-bold text-xs">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {itensExibidos.map((med) => {
                  const isContraGatos = med.especies_contraindicadas?.includes('felina');
                  const isMdr1 = med.risco_mdr1;

                  return (
                    <TableRow key={med.slug} className="hover:bg-muted/40 transition-colors">
                      <TableCell className="py-2.5 font-semibold text-xs text-foreground">
                        <div>
                          <span className="font-bold">{med.nome_comercial_sugerido}</span>
                          {isContraGatos && (
                            <Badge variant="destructive" className="ml-2 text-[9px] py-0 px-1 font-normal">
                              Tóxico Felinos
                            </Badge>
                          )}
                          {isMdr1 && (
                            <Badge className="ml-2 bg-amber-600 text-white text-[9px] py-0 px-1 font-normal">
                              Risco MDR1
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="py-2.5 text-xs text-muted-foreground">
                        {med.principio_ativo}
                      </TableCell>
                      <TableCell className="py-2.5 text-xs">
                        <Badge variant="secondary" className="text-[10px] font-normal py-0">
                          {med.classe_terapeutica?.replace(/_/g, ' ')}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-2.5 text-xs">
                        <div className="flex items-center gap-1">
                          <Badge variant="outline" className="text-[10px] uppercase font-mono py-0">
                            {med.icone_via}
                          </Badge>
                          <span className="text-[10px] text-muted-foreground capitalize">
                            {med.tipo_padrao}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="py-2.5 text-xs">
                        <div className="font-mono font-bold text-foreground">
                          {med.dose_padrao_mg_kg} mg/kg
                        </div>
                        <div className="text-[10px] text-muted-foreground font-mono">
                          {med.dose_min_mg_kg} - {med.dose_max_mg_kg} mg/kg
                        </div>
                      </TableCell>
                      <TableCell className="py-2.5 text-xs">
                        <div className="flex items-center gap-1.5">
                          {med.especies_permitidas?.includes('canina') && <span title="Cães">🐶</span>}
                          {med.especies_permitidas?.includes('felina') && !isContraGatos && <span title="Gatos">🐱</span>}
                          {med.especies_permitidas?.includes('silvestre') && <span title="Silvestres">🐰</span>}
                          {isContraGatos && <span title="Contraindicado para gatos!" className="text-destructive font-bold text-xs">🚫🐱</span>}
                        </div>
                      </TableCell>
                      <TableCell className="py-2.5 text-xs">
                        <div className="flex flex-wrap gap-1 max-w-[200px]">
                          {med.apresentacoes?.slice(0, 2).map((ap, i) => (
                            <span key={i} className="text-[10px] bg-background border px-1.5 py-0.5 rounded text-foreground font-mono truncate max-w-[120px]">
                              {ap.rotulo}
                            </span>
                          ))}
                          {(med.apresentacoes?.length || 0) > 2 && (
                            <span className="text-[10px] text-muted-foreground">
                              +{(med.apresentacoes?.length || 0) - 2}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="py-2.5 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs px-2 gap-1 font-medium hover:bg-primary hover:text-primary-foreground"
                            onClick={() => {
                              setMedicamentoCalculo(med);
                              setModalCalculadoraAberto(true);
                            }}
                            title="Calcular dose para paciente"
                          >
                            <Calculator className="h-3 w-3" />
                            <span className="hidden sm:inline">Calcular</span>
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0"
                            onClick={() => handleAbrirEdicao(med)}
                            title="Editar fármaco"
                          >
                            <Edit className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-destructive hover:bg-destructive/10"
                            onClick={() => setItemParaExcluir(med)}
                            title="Excluir fármaco"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* ESTADO VAZIO (NENHUM ITEM ENCONTRADO) */}
      {totalItens === 0 && !carregando && (
        <Card className="py-16 text-center text-muted-foreground space-y-3 shadow-none border">
          <Pill className="h-12 w-12 mx-auto opacity-30 stroke-1 text-primary" />
          <div className="space-y-1">
            <p className="text-base font-semibold text-foreground">Nenhum medicamento encontrado</p>
            <p className="text-xs max-w-md mx-auto text-muted-foreground">
              Nenhum fármaco coincide com os filtros aplicados. Tente ajustar os termos de busca, limpar os filtros ou cadastrar um novo medicamento.
            </p>
          </div>
          {temFiltroAtivo && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={limparFiltros}
              className="text-xs gap-1.5 mt-2"
            >
              <RotateCcw className="h-3.5 w-3.5" /> Limpar Filtros e Ver Todos
            </Button>
          )}
        </Card>
      )}

      {/* BARRA DE PAGINAÇÃO COMPLETA */}
      {totalItens > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t text-xs text-muted-foreground">
          {/* Indicador de Itens */}
          <div className="flex items-center gap-2">
            <span>
              Exibindo <strong>{itemInicio}</strong>–<strong>{itemFim}</strong> de <strong>{totalItens}</strong> fármacos
            </span>
          </div>

          {/* Controles de Navegação de Página */}
          <div className="flex items-center gap-1">
            {/* Primeira Página */}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 w-8 p-0"
              disabled={paginaEfetiva <= 1}
              onClick={() => mudarPagina(1)}
              title="Primeira página"
            >
              <ChevronsLeft className="h-4 w-4" />
            </Button>

            {/* Página Anterior */}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 w-8 p-0"
              disabled={paginaEfetiva <= 1}
              onClick={() => mudarPagina(paginaEfetiva - 1)}
              title="Página anterior"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>

            {/* Botões Numéricos de Página */}
            {gerarBotoesPagina().map((item, idx) => {
              if (item === 'ellipsis') {
                return (
                  <span key={`ellipsis-${idx}`} className="px-2 py-1 text-xs text-muted-foreground">
                    ...
                  </span>
                );
              }

              const num = item as number;
              const isAtiva = num === paginaEfetiva;
              return (
                <Button
                  key={`pag-${num}`}
                  type="button"
                  variant={isAtiva ? 'default' : 'outline'}
                  size="sm"
                  className={`h-8 w-8 p-0 text-xs font-semibold ${isAtiva ? 'shadow-xs' : ''}`}
                  onClick={() => mudarPagina(num)}
                >
                  {num}
                </Button>
              );
            })}

            {/* Próxima Página */}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 w-8 p-0"
              disabled={paginaEfetiva >= totalPaginas}
              onClick={() => mudarPagina(paginaEfetiva + 1)}
              title="Próxima página"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>

            {/* Última Página */}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 w-8 p-0"
              disabled={paginaEfetiva >= totalPaginas}
              onClick={() => mudarPagina(totalPaginas)}
              title="Última página"
            >
              <ChevronsRight className="h-4 w-4" />
            </Button>
          </div>

          {/* Seletor de Itens Por Página */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground">Itens por pág:</span>
            <Select
              value={String(itensPorPagina)}
              onValueChange={(val) => setItensPorPagina(Number(val))}
            >
              <SelectTrigger className="h-8 text-xs w-[110px] bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="12">12 por pág</SelectItem>
                <SelectItem value="24">24 por pág</SelectItem>
                <SelectItem value="48">48 por pág</SelectItem>
                <SelectItem value="96">96 por pág</SelectItem>
                <SelectItem value="9999">Mostrar todos</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {/* MODAL 1: Simulador Posológico Rápido */}
      <Dialog open={modalCalculadoraAberto} onOpenChange={setModalCalculadoraAberto}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Calculator className="h-4 w-4 text-primary" />
              Calculadora Posológica Rápida
            </DialogTitle>
            <DialogDescription className="text-xs">
              Simule a posologia e apresentações para o peso do paciente.
            </DialogDescription>
          </DialogHeader>

          {medicamentoCalculo && (
            <div className="space-y-4 py-2">
              <div className="p-3 bg-muted/40 rounded-lg">
                <p className="font-bold text-sm text-foreground">
                  {medicamentoCalculo.nome_comercial_sugerido}
                </p>
                <p className="text-xs text-muted-foreground">{medicamentoCalculo.principio_ativo}</p>
                <div className="flex gap-2 text-xs font-mono mt-1 text-primary">
                  <span>Dose base: {medicamentoCalculo.dose_padrao_mg_kg} mg/kg</span>
                  <span>·</span>
                  <span>Via: {medicamentoCalculo.icone_via}</span>
                </div>
              </div>

              {/* Controles do Simulador */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Espécie</Label>
                  <Select
                    value={simEspecie}
                    onValueChange={(val) => setSimEspecie(val as EspeciePaciente)}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="canina">🐶 Canina (Cão)</SelectItem>
                      <SelectItem value="felina">🐱 Felina (Gato)</SelectItem>
                      <SelectItem value="silvestre">🐰 Silvestre</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Peso (kg)</Label>
                  <Input
                    type="number"
                    step="0.1"
                    min="0.1"
                    value={simPeso}
                    onChange={(e) => setSimPeso(parseFloat(e.target.value) || 1)}
                    className="h-8 text-xs font-mono"
                  />
                </div>
              </div>

              {simEspecie === 'canina' && (
                <div className="space-y-1">
                  <Label className="text-xs">Raça (para teste MDR1)</Label>
                  <Input
                    placeholder="Ex: Collie, Border Collie, Poodle..."
                    value={simRaca}
                    onChange={(e) => setSimRaca(e.target.value)}
                    className="h-8 text-xs"
                  />
                </div>
              )}

              {/* Resultado do Cálculo */}
              {resultadoCalculo && (
                <div className="p-3 bg-primary/5 border border-primary/20 rounded-lg space-y-2">
                  <div className="flex justify-between items-baseline">
                    <span className="text-xs text-muted-foreground">Dose Total Calculada:</span>
                    <span className="text-base font-bold text-primary">
                      {resultadoCalculo.posologia.dose_calculada_mg} mg
                    </span>
                  </div>

                  <div className="flex justify-between items-baseline">
                    <span className="text-xs text-muted-foreground">Posologia Sugerida:</span>
                    <span className="text-sm font-semibold text-foreground">
                      {resultadoCalculo.posologia.quantidade_por_tomada}
                    </span>
                  </div>

                  <p className="text-[11px] text-muted-foreground font-mono pt-1 border-t">
                    {resultadoCalculo.memoria_calculo}
                  </p>

                  <div className="text-xs text-muted-foreground pt-1 flex items-center gap-1.5">
                    <Utensils className="h-3.5 w-3.5" />
                    <span>
                      {ROTULO_CONDICAO_ALIMENTAR[medicamentoCalculo.condicao_alimentar] || 'Com alimento'}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setModalCalculadoraAberto(false)}
            >
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL 2: IMPORTAR CSV / JSON (com Tabs: Arquivo ou Colar Texto) */}
      <Dialog open={modalImportarAberto} onOpenChange={setModalImportarAberto}>
        <DialogContent className="max-w-2xl max-h-[88vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Upload className="h-4 w-4 text-primary" />
              Importar Medicamentos em Lote (CSV / JSON)
            </DialogTitle>
            <DialogDescription className="text-xs">
              Adicione dezenas ou centenas de fármacos de uma só vez a partir de planilhas ou dados raspados.
            </DialogDescription>
          </DialogHeader>

          <Tabs
            value={abaImportacao}
            onValueChange={(v) => setAbaImportacao(v as any)}
            className="flex-1 flex flex-col overflow-hidden"
          >
            <TabsList className="grid grid-cols-2 mb-3">
              <TabsTrigger value="arquivo" className="text-xs gap-1.5">
                <FileSpreadsheet className="h-3.5 w-3.5" /> Enviar Arquivo (.csv / .json)
              </TabsTrigger>
              <TabsTrigger value="texto" className="text-xs gap-1.5">
                <ClipboardPaste className="h-3.5 w-3.5" /> Colar Texto / Planilha
              </TabsTrigger>
            </TabsList>

            <div className="flex-1 overflow-y-auto space-y-4 pr-1">
              <TabsContent value="arquivo" className="mt-0 space-y-3">
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 hover:bg-muted/20 transition-colors"
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,.json,.txt"
                    className="hidden"
                    onChange={handleArquivoSelecionado}
                  />
                  <FileSpreadsheet className="h-8 w-8 mx-auto text-muted-foreground/60 mb-2" />
                  <p className="text-xs font-semibold text-foreground">
                    {arquivoImportando ? arquivoImportando.name : 'Clique para selecionar arquivo CSV ou JSON'}
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Delimitado por vírgula (,) ou ponto-e-vírgula (;). Codificação UTF-8 recomendada.
                  </p>
                </div>
              </TabsContent>

              <TabsContent value="texto" className="mt-0 space-y-2">
                <Label className="text-xs text-muted-foreground">
                  Cole os dados CSV ou JSON abaixo (copiados do Excel, Google Sheets ou scraper):
                </Label>
                <Textarea
                  rows={6}
                  placeholder={`principio_ativo;nome_comercial;dose_mg_kg;apresentacoes\nAmoxicilina;Synulox 250 mg;12.5;Synulox 50 mg | Synulox 250 mg\nMeloxicam;Maxicam 0,5 mg;0.1;Maxicam 0,5 mg | Maxicam 2,0 mg`}
                  value={textoColado}
                  onChange={(e) => setTextoColado(e.target.value)}
                  className="font-mono text-xs"
                />
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={handleAnalisarTextoColado}
                  className="text-xs gap-1.5"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" /> Analisar Texto
                </Button>
              </TabsContent>

              {/* Prévia dos itens identificados */}
              {previaImportacao && (
                <div className="space-y-3 pt-2 border-t">
                  <div className="flex items-center justify-between text-xs p-2 bg-muted/40 rounded-md">
                    <span>
                      Total lido: <strong>{previaImportacao.totalLido}</strong> linhas
                    </span>
                    <span className="text-emerald-600 font-semibold">
                      ✓ {previaImportacao.itens.length} fármacos válidos
                    </span>
                    {previaImportacao.erros.length > 0 && (
                      <span className="text-destructive font-semibold">
                        ⚠️ {previaImportacao.erros.length} erros
                      </span>
                    )}
                  </div>

                  {previaImportacao.erros.length > 0 && (
                    <div className="p-2 bg-destructive/10 rounded text-destructive text-[11px] max-h-24 overflow-y-auto">
                      {previaImportacao.erros.slice(0, 5).map((err, i) => (
                        <p key={i}>• {err}</p>
                      ))}
                    </div>
                  )}

                  <div className="space-y-1">
                    <p className="text-xs font-semibold">Pré-visualização dos primeiros produtos:</p>
                    <div className="border rounded-md overflow-hidden text-[11px]">
                      <div className="grid grid-cols-4 bg-muted/60 p-2 font-bold text-foreground">
                        <span>Nome Comercial</span>
                        <span>Princípio Ativo</span>
                        <span>Dose (mg/kg)</span>
                        <span>Via</span>
                      </div>
                      {previaImportacao.itens.slice(0, 6).map((item, idx) => (
                        <div
                          key={idx}
                          className="grid grid-cols-4 p-2 border-t hover:bg-muted/20"
                        >
                          <span className="font-medium truncate">{item.nome_comercial_sugerido}</span>
                          <span className="text-muted-foreground truncate">{item.principio_ativo}</span>
                          <span className="font-mono">{item.dose_padrao_mg_kg}</span>
                          <span className="uppercase text-[10px]">{item.icone_via}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </Tabs>

          <DialogFooter className="border-t pt-3 flex justify-between items-center sm:justify-between">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setModalImportarAberto(false)}
            >
              Cancelar
            </Button>

            <Button
              type="button"
              size="sm"
              disabled={!previaImportacao || previaImportacao.itens.length === 0 || salvandoImportacao}
              onClick={handleConfirmarImportacao}
              className="gap-1.5 font-bold"
            >
              {salvandoImportacao ? (
                <>Importando no banco...</>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  Confirmar e Gravar {previaImportacao?.itens.length || 0} Medicamentos
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL 3: INCLUIR / EDITAR FÁRMACO (com Gerenciador de Apresentações e Espécies) */}
      <Dialog open={modalNovoAberto} onOpenChange={setModalNovoAberto}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Pill className="h-4 w-4 text-primary" />
              {medicamentoEditando ? 'Editar Medicamento' : 'Incluir Novo Medicamento no Bulário'}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Preencha os dados do fármaco, faixas de dosagem e apresentações comerciais.
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="flex-1 pr-3 py-2">
            <div className="space-y-4 text-xs">
              {/* Identificação Principal */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Princípio Ativo *</Label>
                  <Input
                    placeholder="Ex: Amoxicilina + Clavulanato de Potássio"
                    value={formData.principio_ativo || ''}
                    onChange={(e) =>
                      setFormData({ ...formData, principio_ativo: e.target.value })
                    }
                    className="h-8 text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Nome Comercial Sugerido</Label>
                  <Input
                    placeholder="Ex: Synulox 250 mg"
                    value={formData.nome_comercial_sugerido || ''}
                    onChange={(e) =>
                      setFormData({ ...formData, nome_comercial_sugerido: e.target.value })
                    }
                    className="h-8 text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Classe Terapêutica</Label>
                  <Input
                    placeholder="antibiotico, aine, analgesico..."
                    value={formData.classe_terapeutica || ''}
                    onChange={(e) =>
                      setFormData({ ...formData, classe_terapeutica: e.target.value })
                    }
                    className="h-8 text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Via de Administração</Label>
                  <Select
                    value={formData.icone_via || 'oral'}
                    onValueChange={(val) =>
                      setFormData({ ...formData, icone_via: val as ViaAdministracao })
                    }
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="oral">Oral</SelectItem>
                      <SelectItem value="topica">Tópica</SelectItem>
                      <SelectItem value="injetavel">Injetável</SelectItem>
                      <SelectItem value="otica">Ótica</SelectItem>
                      <SelectItem value="oftalmica">Oftálmica</SelectItem>
                      <SelectItem value="inalatoria">Inalatória</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Condição Alimentar</Label>
                  <Select
                    value={formData.condicao_alimentar || 'com_alimento'}
                    onValueChange={(val) =>
                      setFormData({ ...formData, condicao_alimentar: val as CondicaoAlimentar })
                    }
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="com_alimento">Com alimento</SelectItem>
                      <SelectItem value="jejum">Em jejum</SelectItem>
                      <SelectItem value="livre">Com ou sem alimento</SelectItem>
                      <SelectItem value="uso_externo">Uso externo / tópico</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Doses mg/kg */}
              <div className="p-3 bg-muted/30 border rounded-lg space-y-2">
                <p className="font-semibold text-foreground text-xs">Faixa Posológica (mg/kg)</p>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label className="text-[11px] text-muted-foreground">Dose Padrão (mg/kg)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={formData.dose_padrao_mg_kg ?? ''}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          dose_padrao_mg_kg: parseFloat(e.target.value) || 0,
                        })
                      }
                      className="h-8 text-xs font-mono"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px] text-muted-foreground">Dose Mínima (mg/kg)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={formData.dose_min_mg_kg ?? ''}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          dose_min_mg_kg: parseFloat(e.target.value) || 0,
                        })
                      }
                      className="h-8 text-xs font-mono"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px] text-muted-foreground">Dose Máxima (mg/kg)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={formData.dose_max_mg_kg ?? ''}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          dose_max_mg_kg: parseFloat(e.target.value) || 0,
                        })
                      }
                      className="h-8 text-xs font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div className="space-y-1">
                    <Label className="text-[11px] text-muted-foreground">Intervalo Padrão (horas)</Label>
                    <Input
                      type="number"
                      value={formData.frequencia_horas_padrao ?? 12}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          frequencia_horas_padrao: parseInt(e.target.value) || 12,
                        })
                      }
                      className="h-8 text-xs font-mono"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px] text-muted-foreground">Duração Padrão (dias)</Label>
                    <Input
                      type="number"
                      value={formData.duracao_dias_padrao ?? 7}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          duracao_dias_padrao: parseInt(e.target.value) || 7,
                        })
                      }
                      className="h-8 text-xs font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Gerenciador de Apresentações Comerciais */}
              <div className="p-3 bg-muted/30 border rounded-lg space-y-2.5">
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-foreground text-xs">
                    Apresentações Comerciais ({formData.apresentacoes?.length || 0})
                  </p>
                </div>

                {/* Lista de Apresentações já cadastradas */}
                <div className="space-y-1.5">
                  {formData.apresentacoes?.map((ap, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-2 bg-background border rounded-md text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-foreground">{ap.rotulo}</span>
                        <Badge variant="outline" className="text-[10px] capitalize">
                          {ap.forma.replace(/_/g, ' ')}
                        </Badge>
                        {ap.concentracao_mg && (
                          <span className="text-[10px] text-muted-foreground font-mono">
                            {ap.concentracao_mg} mg
                          </span>
                        )}
                        {ap.concentracao_mg_ml && (
                          <span className="text-[10px] text-muted-foreground font-mono">
                            {ap.concentracao_mg_ml} mg/mL
                          </span>
                        )}
                        {ap.divisivel && (
                          <span className="text-[10px] text-emerald-600 font-medium">Divisível</span>
                        )}
                      </div>

                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoverApresentacao(idx)}
                        className="h-6 w-6 p-0 text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}

                  {(!formData.apresentacoes || formData.apresentacoes.length === 0) && (
                    <p className="text-muted-foreground text-[11px] italic">
                      Nenhuma apresentação comercial cadastrada.
                    </p>
                  )}
                </div>

                {/* Sub-formulário para adicionar nova apresentação */}
                <div className="pt-2 border-t space-y-2">
                  <p className="text-[11px] font-semibold text-muted-foreground">
                    Adicionar Apresentação:
                  </p>
                  <div className="grid grid-cols-12 gap-2">
                    <div className="col-span-5">
                      <Input
                        placeholder="Rótulo (ex: Comprimido 250 mg)"
                        value={novoRotuloApres}
                        onChange={(e) => setNovoRotuloApres(e.target.value)}
                        className="h-8 text-xs"
                      />
                    </div>
                    <div className="col-span-3">
                      <Select
                        value={novaFormaApres}
                        onValueChange={(val) => setNovaFormaApres(val as any)}
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="comprimido">Comprimido</SelectItem>
                          <SelectItem value="suspensao_ml">Suspensão (mL)</SelectItem>
                          <SelectItem value="gotas">Gotas</SelectItem>
                          <SelectItem value="pipeta_topica">Pipeta / Spot-on</SelectItem>
                          <SelectItem value="gotas_otologicas">Gotas Óticas</SelectItem>
                          <SelectItem value="manipulado">Manipulado</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-2">
                      <Input
                        placeholder="Conc. (mg)"
                        value={novaConcApres}
                        onChange={(e) => setNovaConcApres(e.target.value)}
                        className="h-8 text-xs font-mono"
                      />
                    </div>
                    <div className="col-span-2 flex items-center justify-end">
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={handleAdicionarApresentacao}
                        className="h-8 px-3 text-xs gap-1 font-semibold"
                      >
                        <Plus className="h-3 w-3" /> Adicionar
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Espécies e Segurança Clínica */}
              <div className="p-3 bg-muted/30 border rounded-lg space-y-3">
                <p className="font-semibold text-foreground text-xs">Espécies & Restrições Clínicas</p>

                {/* Espécies Permitidas */}
                <div className="space-y-1.5">
                  <Label className="text-[11px] text-muted-foreground">Espécies Permitidas:</Label>
                  <div className="flex gap-2">
                    {(['canina', 'felina', 'silvestre'] as EspeciePaciente[]).map((esp) => {
                      const permits = formData.especies_permitidas?.includes(esp);
                      return (
                        <Button
                          key={esp}
                          type="button"
                          variant={permits ? 'default' : 'outline'}
                          size="sm"
                          className="h-7 text-xs px-2.5 capitalize"
                          onClick={() => toggleEspeciePermitida(esp)}
                        >
                          {esp === 'canina' ? '🐶 Cães' : esp === 'felina' ? '🐱 Gatos' : '🐰 Silvestres'}
                        </Button>
                      );
                    })}
                  </div>
                </div>

                {/* Espécies Contraindicadas */}
                <div className="space-y-1.5 pt-1">
                  <Label className="text-[11px] text-destructive font-semibold">
                    Espécies Contraindicadas (Toxicidade):
                  </Label>
                  <div className="flex gap-2">
                    {(['canina', 'felina', 'silvestre'] as EspeciePaciente[]).map((esp) => {
                      const contra = formData.especies_contraindicadas?.includes(esp);
                      return (
                        <Button
                          key={esp}
                          type="button"
                          variant={contra ? 'destructive' : 'outline'}
                          size="sm"
                          className="h-7 text-xs px-2.5 capitalize"
                          onClick={() => toggleEspecieContraindicada(esp)}
                        >
                          {esp === 'canina' ? 'Cães' : esp === 'felina' ? 'Gatos' : 'Silvestres'}
                        </Button>
                      );
                    })}
                  </div>
                  {formData.especies_contraindicadas?.includes('felina') && (
                    <Input
                      placeholder="Motivo da contraindicação felina (ex: toxicidade fatal / metemoglobinemia)..."
                      value={formData.motivo_contraindicacao_especie || ''}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          motivo_contraindicacao_especie: e.target.value,
                        })
                      }
                      className="h-8 text-xs mt-1 border-destructive/40"
                    />
                  )}
                </div>

                {/* MDR1 */}
                <div className="flex items-center gap-4 pt-1">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <Switch
                      checked={Boolean(formData.risco_mdr1)}
                      onCheckedChange={(checked) =>
                        setFormData({ ...formData, risco_mdr1: checked })
                      }
                    />
                    <span className="font-medium text-foreground">
                      Risco genético MDR1 (Collie, Australian Shepherd, Shetland)
                    </span>
                  </label>
                </div>
              </div>

              {/* Orientações */}
              <div className="space-y-1">
                <Label className="text-xs">Orientações Padrão ao Tutor</Label>
                <Textarea
                  rows={2}
                  value={formData.orientacoes_padrao || ''}
                  onChange={(e) =>
                    setFormData({ ...formData, orientacoes_padrao: e.target.value })
                  }
                  className="text-xs"
                />
              </div>
            </div>
          </ScrollArea>

          <DialogFooter className="border-t pt-3 flex justify-between items-center sm:justify-between">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setModalNovoAberto(false)}
            >
              Cancelar
            </Button>
            <Button type="button" size="sm" onClick={handleSalvarFormulario} className="font-bold">
              {medicamentoEditando ? 'Salvar Alterações' : 'Cadastrar Fármaco'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL 4: CONFIRMAÇÃO DE EXCLUSÃO (EXCLUIR) */}
      <AlertDialog open={Boolean(itemParaExcluir)} onOpenChange={(open) => !open && setItemParaExcluir(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-5 w-5" />
              Excluir Medicamento do Bulário?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs leading-relaxed">
              Você está prestes a excluir definitivamente o medicamento <strong>"{itemParaExcluir?.nome_comercial_sugerido}"</strong> ({itemParaExcluir?.principio_ativo}).
              <br /><br />
              Ele será removido do catálogo de busca, do receituário e do prontuário. Prescrições antigas já impressas não serão afetadas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmarExclusao}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 font-bold"
            >
              Excluir Definitivamente
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
