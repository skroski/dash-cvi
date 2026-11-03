import React, { useState, useEffect, useMemo, useId, useRef } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import {
  Sparkles,
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  Pill,
  Droplets,
  Syringe,
  Ear,
  Eye,
  Wind,
  Clock,
  Sun,
  Sunset,
  Moon,
  Utensils,
  Coffee,
  CheckCircle2,
  Plus,
  Trash2,
  Calculator,
  ChevronDown,
  ChevronUp,
  FileCheck2,
  Printer,
  Search,
  Mic,
  MicOff,
  FlaskConical,
  History,
  Send,
  Stethoscope,
  Dna,
  RotateCcw,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import { useReceituario } from '@/hooks/useReceituario';
import {
  type EspeciePaciente,
  type ViaAdministracao,
  type CondicaoAlimentar,
  type VeiculoManipulado,
  type PacienteContexto,
  type ItemPrescricao,
  type RegraBulario,
  SABORES_POR_ESPECIE,
  ROTULO_VEICULO_MANIPULADO,
  ROTULO_CONDICAO_ALIMENTAR,
  calcularPosologiaItem,
  validarSegurancaPrescricao,
  gerarGradeCronograma,
  detectarRiscoMdr1PorRaca,
  localizarRegraBulario,
} from '@/lib/receituarioMotor';
import {
  type DadosEmissaoReceituario,
  MODALIDADE_ASSINATURA_PADRAO,
  gerarMatrizQrVisual,
  montarResumoWhatsappTutor,
  imprimirOuExportarReceituarioPdf,
  mascararTelefoneTutor,
} from '@/lib/receituarioPdf';
import { sendText } from '@/services/uazapi';

const COMORBIDADES_OPCOES = [
  { id: 'insuficiencia_renal', label: 'Insuficiência renal' },
  { id: 'insuficiencia_hepatica', label: 'Hepatopatia' },
  { id: 'gestante', label: 'Gestante / lactante' },
  { id: 'filhote', label: 'Filhote (< 6 meses)' },
  { id: 'cardiopatia', label: 'Cardiopatia' },
  { id: 'diabetes', label: 'Diabetes' },
  { id: 'ulcera_gastrica', label: 'Gastrite / úlcera' },
  { id: 'epilepsia', label: 'Epilepsia / convulsão' },
];

const FREQUENCIAS_RAPIDAS = [
  { horas: 8, rotulo: '8/8h' },
  { horas: 12, rotulo: '12/12h' },
  { horas: 24, rotulo: '24/24h' },
  { horas: 48, rotulo: '48/48h' },
];

const DURACOES_RAPIDAS = [3, 5, 7, 10, 14, 21, 30];

const ESPECIES_VALIDAS: EspeciePaciente[] = ['canina', 'felina', 'silvestre'];

const ROTULO_ESPECIE: Record<EspeciePaciente, string> = {
  canina: 'Cão',
  felina: 'Gato',
  silvestre: 'Silvestre / exótico',
};

const ROTULO_VIA: Record<ViaAdministracao, string> = {
  oral: 'Oral',
  topica: 'Tópica',
  otica: 'Ótica',
  oftalmica: 'Oftálmica',
  injetavel: 'Injetável',
  inalatoria: 'Inalatória',
};

function IconeVia({ via, className = 'h-4 w-4' }: { via: ViaAdministracao; className?: string }) {
  switch (via) {
    case 'otica':
      return <Ear className={className} aria-hidden="true" />;
    case 'topica':
      return <Droplets className={className} aria-hidden="true" />;
    case 'oftalmica':
      return <Eye className={className} aria-hidden="true" />;
    case 'injetavel':
      return <Syringe className={className} aria-hidden="true" />;
    case 'inalatoria':
      return <Wind className={className} aria-hidden="true" />;
    default:
      return <Pill className={className} aria-hidden="true" />;
  }
}

/** QR Code vetorial em nós SVG React (sem dangerouslySetInnerHTML). */
function QrCodeSvgInline({ texto, tamanho = 112 }: { texto: string; tamanho?: number }) {
  const matriz = useMemo(() => gerarMatrizQrVisual(texto), [texto]);
  const margem = 4;
  const viewBox = matriz.length + margem * 2;

  return (
    <svg
      viewBox={`0 0 ${viewBox} ${viewBox}`}
      width={tamanho}
      height={tamanho}
      shapeRendering="crispEdges"
      className="block rounded border border-slate-200"
      role="img"
      aria-label="QR Code de validação da receita"
    >
      <rect width={viewBox} height={viewBox} fill="#ffffff" />
      {matriz.map((linha, r) =>
        linha.map((celula, c) =>
          celula ? <rect key={`${r}-${c}`} x={c + margem} y={r + margem} width={1} height={1} fill="#0f172a" /> : null
        )
      )}
    </svg>
  );
}

function lerDecimal(texto: string): number | null {
  const n = Number(texto.trim().replace(',', '.'));
  return texto.trim() && Number.isFinite(n) ? n : null;
}

function formatarDecimal(valor: number): string {
  return valor > 0 ? String(valor).replace('.', ',') : '';
}

/**
 * Campo numérico que aceita vírgula e números parciais ("12," ou vazio) enquanto a pessoa digita.
 * Um <input type="number"> controlado trocava "12," por 0,1 no meio da digitação.
 */
function CampoDecimal({
  id,
  valor,
  onValor,
  min = 0,
  max = Number.POSITIVE_INFINITY,
  vazioVale,
  className,
  placeholder,
  ariaInvalid,
}: {
  id: string;
  valor: number;
  onValor: (n: number) => void;
  min?: number;
  max?: number;
  vazioVale?: number;
  className?: string;
  placeholder?: string;
  ariaInvalid?: boolean;
}) {
  const [texto, setTexto] = useState(formatarDecimal(valor));
  const ultimoValor = useRef(valor);

  useEffect(() => {
    if (valor !== ultimoValor.current) {
      ultimoValor.current = valor;
      setTexto(formatarDecimal(valor));
    }
  }, [valor]);

  return (
    <Input
      id={id}
      type="text"
      inputMode="decimal"
      autoComplete="off"
      value={texto}
      placeholder={placeholder}
      aria-invalid={ariaInvalid || undefined}
      onChange={(e) => {
        const t = e.target.value;
        setTexto(t);
        const n = lerDecimal(t);
        if (n !== null && n >= min && n <= max) {
          ultimoValor.current = n;
          onValor(n);
        } else if (!t.trim() && vazioVale !== undefined) {
          ultimoValor.current = vazioVale;
          onValor(vazioVale);
        }
      }}
      className={className}
    />
  );
}

/** Deixa só dígitos e põe o DDI 55 em números brasileiros sem código do país. */
function telefoneParaWhatsapp(telefone?: string | null): string {
  const digitos = (telefone || '').replace(/\D/g, '');
  return digitos.length === 10 || digitos.length === 11 ? `55${digitos}` : digitos;
}

function pacienteNovo(dados: Partial<PacienteContexto> = {}): PacienteContexto {
  return {
    tutor_nome: '',
    tutor_telefone: '',
    nome: '',
    especie: 'canina',
    raca: '',
    idade_texto: '',
    peso_kg: 0,
    mutacao_mdr1: false,
    comorbidades: [],
    alergias: [],
    ...dados,
  };
}

export default function SmartPrescriptionPage() {
  const [searchParams] = useSearchParams();
  const baseId = useId();

  const {
    bulario,
    protocolos,
    veterinarios,
    pacientesCadastrados,
    pacientesFilaAtivos,
    historicoPrescricoes,
    clinicaNome,
    clinicaLogoUrl,
    processandoIa,
    buscarClientesTutorPet,
    processarEntradaComIa,
    emitirPrescricao,
  } = useReceituario();

  // Cronômetro do tempo de prescrição (KPI gravado com a receita)
  const [inicioPrescricaoMs, setInicioPrescricaoMs] = useState<number>(() => Date.now());

  // Parâmetros da URL (prontuário, chamador do consultório). Aceita os nomes antigos
  // fila_id / vet_nome que guias anteriores mandavam usar.
  const paramUrl = (...nomes: string[]) =>
    nomes.map((n) => searchParams.get(n)?.trim()).find((v) => Boolean(v)) || '';

  // Paciente: vem da URL (prontuário / fila) ou começa vazio. O peso nunca é estimado.
  const [paciente, setPaciente] = useState<PacienteContexto>(() => {
    const especieUrl = searchParams.get('especie') as EspeciePaciente | null;
    const pesoUrl = Number(searchParams.get('peso'));
    const clienteUrl = Number(searchParams.get('cliente_id'));
    return pacienteNovo({
      cliente_id: Number.isInteger(clienteUrl) && clienteUrl > 0 ? clienteUrl : null,
      tutor_nome: searchParams.get('tutor') || '',
      tutor_telefone: searchParams.get('telefone') || '',
      nome: searchParams.get('pet') || '',
      especie: especieUrl && ESPECIES_VALIDAS.includes(especieUrl) ? especieUrl : 'canina',
      raca: searchParams.get('raca') || '',
      idade_texto: searchParams.get('idade') || '',
      peso_kg: pesoUrl > 0 && pesoUrl <= 250 ? pesoUrl : 0,
    });
  });
  const pacienteRef = useRef(paciente);
  pacienteRef.current = paciente;
  const [pesoAnteriorKg, setPesoAnteriorKg] = useState<number | null>(null);
  // Ação que descartaria uma receita ainda não emitida, aguardando confirmação
  const [descartePendente, setDescartePendente] = useState<(() => void) | null>(null);
  const [filaItemIdVinculado, setFilaItemIdVinculado] = useState<string | null>(
    paramUrl('fila', 'fila_id') || null
  );

  // Busca de clientes/pets do WhatsApp
  const [termoBuscaCliente, setTermoBuscaCliente] = useState('');
  const [resultadosClientes, setResultadosClientes] = useState<
    Array<{
      id: number;
      nome: string;
      telefone: string;
      nome_pet: string | null;
      raca_pet: string | null;
      porte_pet: string | null;
    }>
  >([]);

  // Sugestão por IA / bulário / histórico
  const [entradaClinica, setEntradaClinica] = useState('');
  const [ouvindoVoz, setOuvindoVoz] = useState(false);
  const [abaEsquerda, setAbaEsquerda] = useState<'ia' | 'bulario' | 'historico'>('ia');
  const [buscaBulario, setBuscaBulario] = useState('');
  const buscaBularioRef = useRef<HTMLInputElement>(null);

  // Itens da receita
  const [itensPrescricao, setItensPrescricao] = useState<ItemPrescricao[]>([]);
  const [itensSugeridosIaCount, setItensSugeridosIaCount] = useState<number>(0);
  const [memoriasAbertas, setMemoriasAbertas] = useState<Record<string, boolean>>({});
  const [observacoesGerais, setObservacoesGerais] = useState<string>('');

  // Veterinário responsável e emissão
  const [veterinarioNome, setVeterinarioNome] = useState<string>(() => paramUrl('vet', 'vet_nome'));
  const [veterinarioCrmv, setVeterinarioCrmv] = useState<string>(() => paramUrl('vet_crmv'));
  const [veterinarioId, setVeterinarioId] = useState<string | null>(null);
  const vetInicializadoRef = useRef(false);
  const [responsabilidadeConfirmada, setResponsabilidadeConfirmada] = useState<boolean>(false);
  const [overrideJustificativa, setOverrideJustificativa] = useState<string>('');
  const [modalAberto, setModalAberto] = useState<boolean>(false);
  const [emitindo, setEmitindo] = useState<boolean>(false);
  const [receitaEmitida, setReceitaEmitida] = useState<DadosEmissaoReceituario | null>(null);
  const [enviandoWpp, setEnviandoWpp] = useState<boolean>(false);

  // Escolhe o veterinário quando a lista do banco carrega (o da URL, se existir; senão o primeiro)
  useEffect(() => {
    if (vetInicializadoRef.current || veterinarios.length === 0) return;
    vetInicializadoRef.current = true;
    const nomeUrl = (searchParams.get('vet') || searchParams.get('vet_nome') || '').trim().toLowerCase();
    const crmvUrl = (searchParams.get('vet_crmv') || '').trim();
    const vet = nomeUrl
      ? veterinarios.find((v) => v.nome.trim().toLowerCase() === nomeUrl)
      : veterinarios[0];
    if (vet) {
      setVeterinarioId(vet.id);
      setVeterinarioNome(vet.nome);
      setVeterinarioCrmv(vet.crmv || crmvUrl);
    }
  }, [veterinarios, searchParams]);

  // Busca de clientes com debounce leve
  useEffect(() => {
    if (termoBuscaCliente.trim().length < 2) {
      setResultadosClientes([]);
      return;
    }
    const timer = window.setTimeout(async () => {
      const res = await buscarClientesTutorPet(termoBuscaCliente);
      setResultadosClientes(res);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [termoBuscaCliente, buscarClientesTutorPet]);

  const temPeso = paciente.peso_kg > 0;
  const riscoMdr1 = Boolean(paciente.mutacao_mdr1) || detectarRiscoMdr1PorRaca(paciente.especie, paciente.raca);

  /** Regra do bulário fixa do item (pelo slug); itens fora da lista não têm regra de cálculo. */
  const regraDoItem = (item: ItemPrescricao): RegraBulario | undefined =>
    item.slug_bulario ? bulario.find((b) => b.slug === item.slug_bulario) : undefined;

  const recalcularItens = (itens: ItemPrescricao[], pac: PacienteContexto): ItemPrescricao[] =>
    itens.map((item) =>
      calcularPosologiaItem({
        id: item.id,
        regra: regraDoItem(item),
        paciente: pac,
        tipo: item.tipo,
        principio_ativo: item.principio_ativo,
        nome_comercial_sugerido: item.nome_comercial_sugerido,
        dose_mg_kg: item.dose_mg_kg,
        frequencia_horas: item.posologia.frequencia_horas,
        duracao_dias: item.posologia.duracao_dias,
        icone_via: item.icone_via,
        condicao_alimentar: item.condicao_alimentar,
        orientacoes_tutor: item.orientacoes_tutor,
        veiculo_manipulado: item.manipulado?.veiculo,
        sabor_manipulado: item.manipulado?.sabor,
        origem_ia: item.origem_ia,
      })
    );

  /** Atualiza dados do paciente e recalcula as doses quando peso ou espécie mudam. */
  const atualizarPaciente = (novos: Partial<PacienteContexto>) => {
    const atualizado: PacienteContexto = { ...paciente, ...novos };
    setPaciente(atualizado);
    const mudouBase =
      (novos.peso_kg !== undefined && novos.peso_kg !== paciente.peso_kg) ||
      (novos.especie !== undefined && novos.especie !== paciente.especie);
    if (mudouBase && atualizado.peso_kg > 0 && itensPrescricao.length > 0) {
      setItensPrescricao(recalcularItens(itensPrescricao, atualizado));
    }
  };

  /** Troca de paciente: limpa receita, peso e dados clínicos do paciente anterior. */
  const trocarPaciente = (dados: Partial<PacienteContexto>, filaItemId: string | null) => {
    const nomePet = (dados.nome || '').trim().toLowerCase();
    const salvo = pacientesCadastrados.find(
      (p) =>
        p.nome.trim().toLowerCase() === nomePet &&
        ((dados.cliente_id && p.cliente_id === dados.cliente_id) ||
          (!!dados.tutor_nome && p.tutor_nome.trim().toLowerCase() === dados.tutor_nome.trim().toLowerCase()))
    );
    setPaciente(
      pacienteNovo({
        ...dados,
        id: salvo?.id ?? null,
        especie: salvo?.especie ?? 'canina',
        raca: dados.raca || salvo?.raca || '',
        idade_texto: salvo?.idade_texto || '',
        mutacao_mdr1: Boolean(salvo?.mutacao_mdr1),
        comorbidades: salvo?.comorbidades ?? [],
        alergias: salvo?.alergias ?? [],
        peso_kg: 0,
      })
    );
    setPesoAnteriorKg(salvo?.peso_kg && salvo.peso_kg > 0 ? salvo.peso_kg : null);
    setItensPrescricao([]);
    setItensSugeridosIaCount(0);
    setEntradaClinica('');
    setObservacoesGerais('');
    setOverrideJustificativa('');
    setResponsabilidadeConfirmada(false);
    setFilaItemIdVinculado(filaItemId);
    setInicioPrescricaoMs(Date.now());
  };

  const novaReceita = () => {
    trocarPaciente({}, null);
    setPesoAnteriorKg(null);
    setReceitaEmitida(null);
    setModalAberto(false);
  };

  /** Pede confirmação antes de uma ação que apagaria itens ainda não emitidos. */
  const confirmarDescarte = (acao: () => void) => {
    if (itensPrescricao.length > 0 && !receitaEmitida) {
      setDescartePendente(() => acao);
    } else {
      acao();
    }
  };

  // Validação de segurança e cronograma em tempo real
  const validacaoSeguranca = useMemo(
    () => validarSegurancaPrescricao(paciente, itensPrescricao, bulario),
    [paciente, itensPrescricao, bulario]
  );
  const gradeCronograma = useMemo(() => gerarGradeCronograma(itensPrescricao), [itensPrescricao]);

  const exigirPeso = (): boolean => {
    if (temPeso) return true;
    toast.error('Informe o peso aferido do paciente.', {
      description: 'As doses são calculadas pelo peso; ele não é estimado.',
    });
    document.getElementById(`${baseId}-pet-peso`)?.focus();
    return false;
  };

  const handleSugerirComIa = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!entradaClinica.trim()) {
      toast.error('Escreva ou dite o diagnóstico ou a conduta.');
      return;
    }
    const pistaPeso = /\d+([.,]\d+)?\s*kg/i.test(entradaClinica);
    if (!temPeso && !pistaPeso) {
      exigirPeso();
      return;
    }

    try {
      const resultado = await processarEntradaComIa(entradaClinica, paciente);
      // A IA pode levar até 15 s: preserva o que foi editado no formulário durante a espera e
      // aplica só o que o texto pode preencher (peso/raça vazios, espécie citada).
      const atual = pacienteRef.current;
      const sugerido = resultado.pacienteAtualizado;
      const mesclado: PacienteContexto = {
        ...atual,
        especie: sugerido.especie,
        peso_kg: atual.peso_kg > 0 ? atual.peso_kg : sugerido.peso_kg,
        raca: atual.raca?.trim() ? atual.raca : sugerido.raca,
      };
      setPaciente(mesclado);
      setItensPrescricao(
        mesclado.peso_kg !== sugerido.peso_kg || mesclado.especie !== sugerido.especie
          ? recalcularItens(resultado.itens, mesclado)
          : resultado.itens
      );
      setItensSugeridosIaCount(resultado.itens.length);
      setInicioPrescricaoMs(Date.now());

      if (resultado.itens.length === 0) {
        toast.info('Nenhum medicamento reconhecido no texto.', {
          description: 'Tente citar o diagnóstico ou o fármaco, ou adicione pelo bulário.',
        });
      } else if (resultado.validacao.bloqueia_emissao) {
        toast.error('Atenção: há um risco grave nesta sugestão.', {
          description: 'Veja os alertas em vermelho antes de continuar.',
        });
      } else {
        toast.success(
          `${resultado.itens.length} ${resultado.itens.length === 1 ? 'medicamento sugerido' : 'medicamentos sugeridos'} para ${String(resultado.pacienteAtualizado.peso_kg).replace('.', ',')} kg`,
          {
            description: resultado.usouIa
              ? 'Sugestão da IA conferida pelas regras de segurança. Revise antes de emitir.'
              : 'A IA não respondeu a tempo; sugestão feita pelas regras do bulário. Revise antes de emitir.',
          }
        );
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível gerar a sugestão.');
    }
  };

  // Ditado por voz no navegador
  const alternarDitadoVoz = () => {
    type Reconhecimento = {
      lang: string;
      continuous: boolean;
      interimResults: boolean;
      onstart: () => void;
      onend: () => void;
      onerror: () => void;
      onresult: (event: { results?: ArrayLike<ArrayLike<{ transcript?: string }>> }) => void;
      start: () => void;
    };
    const janela = window as unknown as Record<string, (new () => Reconhecimento) | undefined>;
    const SpeechRecognitionApi = janela.SpeechRecognition || janela.webkitSpeechRecognition;

    if (!SpeechRecognitionApi) {
      toast.error('Ditado por voz não funciona neste navegador. Use o Chrome ou digite o texto.');
      return;
    }
    if (ouvindoVoz) {
      setOuvindoVoz(false);
      return;
    }

    try {
      const recognition = new SpeechRecognitionApi();
      recognition.lang = 'pt-BR';
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.onstart = () => setOuvindoVoz(true);
      recognition.onend = () => setOuvindoVoz(false);
      recognition.onerror = () => setOuvindoVoz(false);
      recognition.onresult = (event) => {
        const transcrito = event?.results?.[0]?.[0]?.transcript;
        if (transcrito) {
          setEntradaClinica((prev) => (prev ? `${prev.trim()} ${transcrito}` : transcrito));
        }
      };
      recognition.start();
    } catch {
      setOuvindoVoz(false);
    }
  };

  const aplicarProtocolo = (prot: (typeof protocolos)[number]) => {
    if (!exigirPeso()) return;
    const novosItens: ItemPrescricao[] = [];
    for (const tpl of prot.itens_template) {
      const regra = localizarRegraBulario(tpl.slug, bulario);
      if (regra) {
        novosItens.push(
          calcularPosologiaItem({
            regra,
            paciente,
            dose_mg_kg: tpl.dose_mg_kg,
            frequencia_horas: tpl.frequencia_horas,
            duracao_dias: tpl.duracao_dias,
            origem_ia: true,
          })
        );
      }
    }
    if (novosItens.length === 0) return;
    setEntradaClinica(prot.descricao_clinica);
    setItensPrescricao(novosItens);
    setItensSugeridosIaCount(novosItens.length);
    toast.success(`Protocolo "${prot.titulo}" aplicado para ${String(paciente.peso_kg).replace('.', ',')} kg.`);
  };

  const adicionarDoBulario = (regra: RegraBulario, manipulado = false) => {
    if (!exigirPeso()) return;
    const novo = calcularPosologiaItem({
      id: `item_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      regra,
      paciente,
      tipo: manipulado ? 'manipulado' : regra.tipo_padrao,
      origem_ia: false,
    });
    setItensPrescricao((prev) => [...prev, novo]);
    toast.success(`${regra.principio_ativo} adicionado à receita.`);
  };

  /** Item fora do bulário: o veterinário preenche nome e dose. */
  const adicionarItemLivre = (tipo: 'industrializado' | 'manipulado') => {
    if (!exigirPeso()) return;
    const novo = calcularPosologiaItem({
      id: `manual_${Date.now()}`,
      paciente,
      tipo,
      principio_ativo: '',
      nome_comercial_sugerido: '',
      dose_mg_kg: 0,
      frequencia_horas: 12,
      duracao_dias: 7,
      icone_via: 'oral',
      condicao_alimentar: 'com_alimento',
      orientacoes_tutor: '',
      origem_ia: false,
    });
    setItensPrescricao((prev) => [...prev, novo]);
    window.setTimeout(() => document.getElementById(`${baseId}-principio-${novo.id}`)?.focus(), 50);
  };

  /** Campos de texto livre: só troca o texto, sem refazer o cálculo. */
  const editarTextoItem = (
    itemId: string,
    campo: 'nome_comercial_sugerido' | 'principio_ativo' | 'orientacoes_tutor' | 'quantidade_por_tomada' | 'condicao_alimentar',
    valor: string
  ) => {
    setItensPrescricao((prev) =>
      prev.map((item) => {
        if (item.id !== itemId) return item;
        if (campo === 'quantidade_por_tomada') {
          return { ...item, posologia: { ...item.posologia, quantidade_por_tomada: valor } };
        }
        if (campo === 'condicao_alimentar') {
          return { ...item, condicao_alimentar: valor as CondicaoAlimentar };
        }
        return { ...item, [campo]: valor };
      })
    );
  };

  /**
   * Mudanças que afetam a dose ou a forma refazem o cálculo. Frequência e duração mantêm o
   * nome e a quantidade por tomada que o veterinário ajustou (a dose por tomada não muda).
   */
  const recalcularItem = (
    itemId: string,
    alteracoes: Partial<{
      tipo: 'industrializado' | 'manipulado';
      dose_mg_kg: number;
      frequencia_horas: number;
      duracao_dias: number;
      icone_via: ViaAdministracao;
      veiculo_manipulado: VeiculoManipulado;
      sabor_manipulado: string;
    }>
  ) => {
    const soTempo = Object.keys(alteracoes).every((k) => k === 'frequencia_horas' || k === 'duracao_dias');
    setItensPrescricao((prev) =>
      prev.map((item) => {
        if (item.id !== itemId) return item;
        const recalculado = calcularPosologiaItem({
          id: item.id,
          regra: regraDoItem(item),
          paciente,
          tipo: alteracoes.tipo ?? item.tipo,
          principio_ativo: item.principio_ativo,
          nome_comercial_sugerido: item.nome_comercial_sugerido,
          dose_mg_kg: alteracoes.dose_mg_kg ?? item.dose_mg_kg,
          frequencia_horas: alteracoes.frequencia_horas ?? item.posologia.frequencia_horas,
          duracao_dias: alteracoes.duracao_dias ?? item.posologia.duracao_dias,
          icone_via: alteracoes.icone_via ?? item.icone_via,
          condicao_alimentar: item.condicao_alimentar,
          orientacoes_tutor: item.orientacoes_tutor,
          veiculo_manipulado: alteracoes.veiculo_manipulado ?? item.manipulado?.veiculo,
          sabor_manipulado: alteracoes.sabor_manipulado ?? item.manipulado?.sabor,
          origem_ia: item.origem_ia,
        });
        if (soTempo) {
          recalculado.nome_comercial_sugerido = item.nome_comercial_sugerido;
          recalculado.posologia.quantidade_por_tomada = item.posologia.quantidade_por_tomada;
        }
        return recalculado;
      })
    );
  };

  const removerItem = (itemId: string) => {
    setItensPrescricao((prev) => prev.filter((i) => i.id !== itemId));
  };

  const toggleComorbidade = (comorbId: string) => {
    const atual = paciente.comorbidades || [];
    atualizarPaciente({
      comorbidades: atual.includes(comorbId) ? atual.filter((c) => c !== comorbId) : [...atual, comorbId],
    });
  };

  const bularioFiltrado = useMemo(() => {
    const q = buscaBulario.toLowerCase().trim();
    if (!q) return bulario;
    return bulario.filter(
      (b) =>
        b.principio_ativo.toLowerCase().includes(q) ||
        b.nome_comercial_sugerido.toLowerCase().includes(q) ||
        b.classe_terapeutica.toLowerCase().includes(q) ||
        b.palavras_chave.some((p) => p.toLowerCase().includes(q))
    );
  }, [bulario, buscaBulario]);

  // O que ainda falta para emitir (mostrado no lugar de um botão que "não faz nada")
  const pendencias = useMemo(() => {
    const lista: string[] = [];
    if (!paciente.nome.trim()) lista.push('nome do pet');
    if (!paciente.tutor_nome.trim()) lista.push('nome do tutor');
    if (!temPeso) lista.push('peso');
    if (itensPrescricao.length === 0) lista.push('ao menos um medicamento');
    if (itensPrescricao.some((i) => !i.principio_ativo.trim())) lista.push('nome de todos os medicamentos');
    if (!veterinarioNome.trim()) lista.push('veterinário');
    if (!veterinarioCrmv.trim()) lista.push('CRMV');
    return lista;
  }, [paciente.nome, paciente.tutor_nome, temPeso, itensPrescricao, veterinarioNome, veterinarioCrmv]);

  const abrirRevisao = () => {
    setReceitaEmitida(null);
    setResponsabilidadeConfirmada(false);
    setModalAberto(true);
  };

  const handleConfirmarEmissao = async () => {
    try {
      setEmitindo(true);
      const tempoSegundos = Math.max(1, Math.round((Date.now() - inicioPrescricaoMs) / 1000));
      const dados = await emitirPrescricao({
        paciente,
        veterinarioNome: veterinarioNome.trim(),
        veterinarioCrmv: veterinarioCrmv.trim(),
        veterinarioId,
        entradaClinica,
        hipoteseDiagnostica: entradaClinica,
        itens: itensPrescricao,
        observacoesGerais,
        modalidadeAssinatura: MODALIDADE_ASSINATURA_PADRAO,
        responsabilidadeConfirmada,
        overrideJustificativa,
        tempoEmissaoSegundos: tempoSegundos,
        itensSugeridosIaCount,
        filaItemId: filaItemIdVinculado,
      });
      setReceitaEmitida(dados);
    } catch (err) {
      toast.error('A receita não foi emitida', {
        description: err instanceof Error ? err.message : 'Tente novamente.',
      });
    } finally {
      setEmitindo(false);
    }
  };

  const handleEnviarWhatsapp = async () => {
    if (!receitaEmitida) return;
    const numero = telefoneParaWhatsapp(receitaEmitida.paciente.tutor_telefone);
    if (numero.length < 12) {
      toast.error('WhatsApp do tutor ausente ou incompleto. Use DDD + número.');
      return;
    }
    try {
      setEnviandoWpp(true);
      await sendText(numero, montarResumoWhatsappTutor(receitaEmitida));
      toast.success('Receita e horários enviados ao WhatsApp do tutor.');
    } catch {
      toast.error('Não foi possível enviar pelo WhatsApp agora. Verifique a conexão do WhatsApp da clínica.');
    } finally {
      setEnviandoWpp(false);
    }
  };

  /** Copia uma receita antiga sem o peso: as doses só voltam a valer com o peso de hoje. */
  const carregarDoHistorico = (hist: (typeof historicoPrescricoes)[number]) => {
    const pesoAntigo = Number(hist.paciente_snapshot?.peso_kg) || 0;
    setPaciente(pacienteNovo({ ...(hist.paciente_snapshot ?? {}), peso_kg: 0 }));
    setPesoAnteriorKg(pesoAntigo > 0 ? pesoAntigo : null);
    setItensPrescricao(Array.isArray(hist.itens_prescricao) ? hist.itens_prescricao : []);
    setItensSugeridosIaCount(0);
    setEntradaClinica(hist.hipotese_diagnostica || '');
    setOverrideJustificativa('');
    setReceitaEmitida(null);
    setFilaItemIdVinculado(null);
    setInicioPrescricaoMs(Date.now());
    toast.info('Receita copiada. Pese o paciente: as doses são recalculadas com o peso de hoje.');
  };

  const reimprimirDoHistorico = (hist: (typeof historicoPrescricoes)[number]) => {
    imprimirOuExportarReceituarioPdf({
      codigoVerificacao: hist.codigo_verificacao,
      clinicaNome,
      clinicaLogoUrl,
      veterinarioNome: hist.veterinario_nome,
      veterinarioCrmv: hist.veterinario_crmv,
      modalidadeAssinatura: hist.modalidade_assinatura,
      hashSha256: hist.hash_sha256,
      assinadoEmIso: hist.assinado_em,
      urlValidacaoPublica: `${window.location.origin}/validar-receita/${hist.codigo_verificacao}`,
      paciente: hist.paciente_snapshot,
      hipoteseDiagnostica: hist.hipotese_diagnostica,
      itens: hist.itens_prescricao,
      cronograma: hist.cronograma || [],
    });
  };

  const corBanner = validacaoSeguranca.cor_semantica;

  return (
    <div className="flex h-full min-h-0 flex-col overflow-y-auto bg-slate-50/70 dark:bg-slate-950 lg:overflow-hidden">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b bg-background px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-teal-600 text-white">
            <Stethoscope className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-foreground">Receituário</h1>
            <p className="text-sm text-muted-foreground">
              Escolha o paciente, monte a receita e emita. As doses são calculadas pelo peso.
            </p>
          </div>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => confirmarDescarte(novaReceita)} className="gap-1.5">
          <RotateCcw className="h-4 w-4" aria-hidden="true" />
          Nova receita
        </Button>
      </header>

      <div className="grid grid-cols-1 lg:min-h-0 lg:flex-1 lg:grid-cols-12">
        {/* ===================== ESQUERDA: paciente e como montar a receita ===================== */}
        <section
          aria-label="Paciente e sugestões"
          className="flex flex-col border-b lg:col-span-5 lg:min-h-0 lg:border-b-0 lg:border-r bg-background lg:overflow-y-auto lg:[scrollbar-gutter:stable] lg:[overscroll-behavior:contain] p-4 space-y-4"
        >
          <Card className="shadow-sm">
            <CardHeader className="pb-3 pt-4 px-4">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-teal-600 text-xs font-bold text-white">
                    1
                  </span>
                  Paciente
                </CardTitle>
                {riscoMdr1 ? (
                  <Badge variant="destructive" className="text-xs gap-1">
                    <Dna className="h-3 w-3" aria-hidden="true" />
                    Sensível a MDR1
                  </Badge>
                ) : null}
              </div>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-3">
              {pacientesFilaAtivos.length > 0 ? (
                <div className="space-y-1.5">
                  <span className="text-xs font-medium text-muted-foreground">Na fila agora:</span>
                  <div className="flex flex-wrap gap-1.5">
                    {pacientesFilaAtivos.slice(0, 6).map((pf) => (
                      <Button
                        key={pf.fila_item_id}
                        type="button"
                        variant={filaItemIdVinculado === pf.fila_item_id ? 'default' : 'outline'}
                        size="sm"
                        className="h-8 text-xs gap-1.5 px-2.5"
                        onClick={() => confirmarDescarte(() => {
                          trocarPaciente(
                            {
                              cliente_id: pf.cliente_id,
                              tutor_nome: pf.tutor_nome,
                              tutor_telefone: pf.telefone || '',
                              nome: pf.pet_nome || '',
                            },
                            pf.fila_item_id
                          );
                          if (pf.veterinario_nome) {
                            const vet = veterinarios.find((v) => v.nome === pf.veterinario_nome);
                            setVeterinarioNome(pf.veterinario_nome);
                            setVeterinarioId(vet?.id ?? null);
                            if (vet?.crmv) setVeterinarioCrmv(vet.crmv);
                          }
                          toast.info(`${pf.pet_nome} (${pf.senha}) carregado. Informe o peso aferido.`);
                        })}
                      >
                        <Badge variant="secondary" className="px-1 py-0 text-[11px]">
                          {pf.senha}
                        </Badge>
                        <span>{pf.pet_nome}</span>
                      </Button>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="relative">
                <Label htmlFor={`${baseId}-busca-cliente`} className="text-xs font-medium">
                  Buscar tutor ou pet cadastrado
                </Label>
                <div className="relative mt-1">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
                  <Input
                    id={`${baseId}-busca-cliente`}
                    type="search"
                    value={termoBuscaCliente}
                    onChange={(e) => setTermoBuscaCliente(e.target.value)}
                    placeholder="Nome do pet, do tutor ou telefone"
                    className="h-9 pl-8 text-sm"
                    autoComplete="off"
                    spellCheck={false}
                  />
                </div>
                {resultadosClientes.length > 0 ? (
                  <div className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-md border bg-popover p-1 shadow-md">
                    {resultadosClientes.map((cli) => (
                      <button
                        key={cli.id}
                        type="button"
                        className="flex w-full items-center justify-between gap-2 rounded px-2.5 py-2 text-left text-sm hover:bg-accent"
                        onClick={() => confirmarDescarte(() => {
                          trocarPaciente(
                            {
                              cliente_id: cli.id,
                              tutor_nome: cli.nome,
                              tutor_telefone: cli.telefone,
                              nome: cli.nome_pet || '',
                              raca: cli.raca_pet || '',
                            },
                            null
                          );
                          setTermoBuscaCliente('');
                          setResultadosClientes([]);
                          toast.info(`${cli.nome_pet || cli.nome} carregado. Informe o peso aferido.`);
                        })}
                      >
                        <span>
                          <span className="font-semibold">{cli.nome_pet || 'Pet sem nome'}</span>
                          <span className="text-muted-foreground"> · {cli.nome}</span>
                          {cli.raca_pet ? <span className="text-muted-foreground"> · {cli.raca_pet}</span> : null}
                        </span>
                        <span className="text-xs text-muted-foreground shrink-0">
                          {mascararTelefoneTutor(cli.telefone)}
                        </span>
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>

              <fieldset className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <legend className="sr-only">Dados do paciente</legend>
                <div className="col-span-2 sm:col-span-1">
                  <Label htmlFor={`${baseId}-pet-nome`} className="text-xs">
                    Pet *
                  </Label>
                  <Input
                    id={`${baseId}-pet-nome`}
                    value={paciente.nome}
                    onChange={(e) => atualizarPaciente({ nome: e.target.value })}
                    className="h-9 text-sm font-semibold"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor={`${baseId}-pet-especie`} className="text-xs">
                    Espécie *
                  </Label>
                  <Select
                    value={paciente.especie}
                    onValueChange={(val) => atualizarPaciente({ especie: val as EspeciePaciente })}
                  >
                    <SelectTrigger id={`${baseId}-pet-especie`} className="h-9 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ESPECIES_VALIDAS.map((esp) => (
                        <SelectItem key={esp} value={esp}>
                          {ROTULO_ESPECIE[esp]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor={`${baseId}-pet-peso`} className="text-xs font-semibold text-teal-700 dark:text-teal-300">
                    Peso (kg) *
                  </Label>
                  <CampoDecimal
                    id={`${baseId}-pet-peso`}
                    valor={paciente.peso_kg}
                    onValor={(n) => atualizarPaciente({ peso_kg: n })}
                    min={0.05}
                    max={250}
                    vazioVale={0}
                    placeholder={pesoAnteriorKg ? `último: ${formatarDecimal(pesoAnteriorKg)}` : 'Pesar'}
                    ariaInvalid={!temPeso}
                    className={`h-9 text-sm font-bold ${temPeso ? 'border-teal-400' : 'border-amber-500 bg-amber-50 dark:bg-amber-950/30'}`}
                  />
                </div>
                <div>
                  <Label htmlFor={`${baseId}-pet-raca`} className="text-xs">
                    Raça
                  </Label>
                  <Input
                    id={`${baseId}-pet-raca`}
                    value={paciente.raca || ''}
                    onChange={(e) => atualizarPaciente({ raca: e.target.value })}
                    placeholder="SRD"
                    className="h-9 text-sm"
                  />
                </div>
              </fieldset>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div>
                  <Label htmlFor={`${baseId}-tutor-nome`} className="text-xs">
                    Tutor *
                  </Label>
                  <Input
                    id={`${baseId}-tutor-nome`}
                    value={paciente.tutor_nome}
                    onChange={(e) => atualizarPaciente({ tutor_nome: e.target.value })}
                    className="h-9 text-sm"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor={`${baseId}-tutor-tel`} className="text-xs">
                    WhatsApp do tutor
                  </Label>
                  <Input
                    id={`${baseId}-tutor-tel`}
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    value={paciente.tutor_telefone || ''}
                    onChange={(e) => atualizarPaciente({ tutor_telefone: e.target.value })}
                    placeholder="(41) 99999-0000"
                    className="h-9 text-sm"
                  />
                </div>
                <div>
                  <Label htmlFor={`${baseId}-pet-idade`} className="text-xs">
                    Idade
                  </Label>
                  <Input
                    id={`${baseId}-pet-idade`}
                    value={paciente.idade_texto || ''}
                    onChange={(e) => atualizarPaciente({ idade_texto: e.target.value })}
                    placeholder="Ex.: 4 anos"
                    className="h-9 text-sm"
                  />
                </div>
              </div>

              <div className="space-y-2 pt-2 border-t">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-medium text-muted-foreground">
                    Condições de saúde (ajudam nos alertas):
                  </span>
                  <label className="flex items-center gap-1.5 text-xs font-medium text-amber-800 dark:text-amber-300 cursor-pointer">
                    <Checkbox
                      checked={riscoMdr1}
                      disabled={detectarRiscoMdr1PorRaca(paciente.especie, paciente.raca)}
                      onCheckedChange={(checked) => atualizarPaciente({ mutacao_mdr1: Boolean(checked) })}
                    />
                    <span>
                      Mutação MDR1
                      {detectarRiscoMdr1PorRaca(paciente.especie, paciente.raca) ? ' (pela raça)' : ''}
                    </span>
                  </label>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {COMORBIDADES_OPCOES.map((com) => {
                    const ativo = (paciente.comorbidades || []).includes(com.id);
                    return (
                      <button
                        key={com.id}
                        type="button"
                        aria-pressed={ativo}
                        onClick={() => toggleComorbidade(com.id)}
                        className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                          ativo
                            ? 'border-amber-500 bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200'
                            : 'border-border bg-muted/40 text-muted-foreground hover:bg-muted'
                        }`}
                      >
                        {com.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex rounded-lg border bg-muted/50 p-1 text-sm font-medium" role="tablist" aria-label="Como montar a receita">
            {(
              [
                { id: 'ia', rotulo: 'Sugerir com IA', icone: Sparkles },
                { id: 'bulario', rotulo: 'Bulário', icone: Search },
                { id: 'historico', rotulo: `Histórico (${historicoPrescricoes.length})`, icone: History },
              ] as const
            ).map((aba) => (
              <button
                key={aba.id}
                type="button"
                role="tab"
                aria-selected={abaEsquerda === aba.id}
                onClick={() => setAbaEsquerda(aba.id)}
                className={`flex-1 whitespace-nowrap rounded-md px-1 py-2 text-xs sm:text-sm flex items-center justify-center gap-1 sm:gap-1.5 transition-colors ${
                  abaEsquerda === aba.id ? 'bg-background text-teal-700 dark:text-teal-300 shadow-sm font-semibold' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <aba.icone className="h-4 w-4" aria-hidden="true" />
                {aba.rotulo}
              </button>
            ))}
          </div>

          {abaEsquerda === 'ia' ? (
            <div className="space-y-4">
              <Card className="border-teal-200 dark:border-teal-900 bg-teal-50/40 dark:bg-teal-950/10 shadow-sm">
                <CardContent className="p-4">
                  <form onSubmit={handleSugerirComIa} className="space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <Label htmlFor={`${baseId}-entrada-clinica`} className="text-sm font-semibold">
                        Diagnóstico ou conduta
                      </Label>
                      <Button
                        type="button"
                        variant={ouvindoVoz ? 'destructive' : 'outline'}
                        size="sm"
                        className="h-8 text-xs gap-1.5"
                        onClick={alternarDitadoVoz}
                      >
                        {ouvindoVoz ? (
                          <>
                            <MicOff className="h-3.5 w-3.5" aria-hidden="true" />
                            Parar
                          </>
                        ) : (
                          <>
                            <Mic className="h-3.5 w-3.5" aria-hidden="true" />
                            Ditar
                          </>
                        )}
                      </Button>
                    </div>
                    <Textarea
                      id={`${baseId}-entrada-clinica`}
                      rows={3}
                      value={entradaClinica}
                      onChange={(e) => setEntradaClinica(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.nativeEvent.isComposing) return;
                        if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                          e.preventDefault();
                          void handleSugerirComIa();
                        }
                      }}
                      placeholder="Ex.: otite fúngica bilateral moderada"
                      className="text-sm bg-background resize-y"
                    />
                    <Button
                      type="submit"
                      disabled={processandoIa}
                      className="w-full bg-teal-600 hover:bg-teal-700 text-white h-10 gap-2"
                    >
                      {processandoIa ? (
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                      ) : (
                        <Sparkles className="h-4 w-4" aria-hidden="true" />
                      )}
                      {processandoIa ? 'Calculando e conferindo…' : 'Sugerir receita'}
                    </Button>
                    <p className="text-xs text-muted-foreground">
                      A sugestão substitui os itens atuais e sempre passa pelas regras de segurança.
                    </p>
                  </form>
                </CardContent>
              </Card>

              {protocolos.length > 0 ? (
                <div className="space-y-2">
                  <h2 className="text-sm font-semibold text-foreground">Protocolos prontos</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {protocolos
                      .filter((prot) => prot.especie_alvo === 'ambas' || prot.especie_alvo === paciente.especie)
                      .map((prot) => (
                        <button
                          key={prot.codigo}
                          type="button"
                          onClick={() => aplicarProtocolo(prot)}
                          className="flex flex-col items-start rounded-lg border bg-card p-3 text-left transition-colors hover:border-teal-500"
                        >
                          <span className="text-sm font-semibold text-foreground line-clamp-1">{prot.titulo}</span>
                          <span className="mt-0.5 text-xs text-muted-foreground line-clamp-2">
                            {prot.descricao_clinica}
                          </span>
                        </button>
                      ))}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          {abaEsquerda === 'bulario' ? (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between gap-2 px-0.5">
                <span className="text-xs text-muted-foreground font-medium">
                  {bulario.length} fármacos no catálogo
                </span>
                <Link
                  to="/bulario"
                  className="text-xs text-primary hover:underline font-semibold flex items-center gap-1"
                >
                  <Pill className="h-3 w-3" /> Gerenciar & Importar CSV
                </Link>
              </div>
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
                <Input
                  ref={buscaBularioRef}
                  type="search"
                  aria-label="Buscar no bulário"
                  value={buscaBulario}
                  onChange={(e) => setBuscaBulario(e.target.value)}
                  placeholder="Princípio ativo, nome comercial ou indicação"
                  className="h-9 pl-8 text-sm"
                  autoComplete="off"
                  spellCheck={false}
                />
              </div>

              <div className="space-y-2">
                {bularioFiltrado.map((regra) => {
                  const toxicoEspecie = regra.especies_contraindicadas.includes(paciente.especie);
                  const alertaMdr1 = regra.risco_mdr1 && riscoMdr1;
                  return (
                    <div
                      key={regra.slug}
                      className={`rounded-lg border p-3 text-sm ${
                        toxicoEspecie || alertaMdr1 ? 'border-red-300 bg-red-50/60 dark:bg-red-950/20' : 'bg-card'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="font-semibold text-foreground flex flex-wrap items-center gap-1.5">
                            <span>{regra.principio_ativo}</span>
                            {toxicoEspecie ? (
                              <Badge variant="destructive" className="text-[11px]">
                                Tóxico para {ROTULO_ESPECIE[paciente.especie].toLowerCase()}
                              </Badge>
                            ) : null}
                            {alertaMdr1 ? (
                              <Badge variant="destructive" className="text-[11px]">
                                Risco MDR1
                              </Badge>
                            ) : null}
                          </div>
                          <div className="text-xs text-muted-foreground">{regra.nome_comercial_sugerido}</div>
                          <div className="mt-1 text-xs text-teal-700 dark:text-teal-300">
                            {regra.dose_padrao_mg_kg} mg/kg (faixa {regra.dose_min_mg_kg}–{regra.dose_max_mg_kg}) ·
                            a cada {regra.frequencia_horas_padrao}h
                          </div>
                        </div>
                        <div className="flex flex-col gap-1 shrink-0">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-8 text-xs gap-1"
                            onClick={() => adicionarDoBulario(regra, false)}
                          >
                            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                            Adicionar
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="h-8 text-xs gap-1 text-blue-700 dark:text-blue-300"
                            onClick={() => adicionarDoBulario(regra, true)}
                          >
                            <FlaskConical className="h-3.5 w-3.5" aria-hidden="true" />
                            Manipular
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
                {bularioFiltrado.length === 0 ? (
                  <p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
                    Nada encontrado para “{buscaBulario}”.
                  </p>
                ) : null}
              </div>

              <div className="flex flex-wrap gap-2 pt-1">
                <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => adicionarItemLivre('industrializado')}>
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  Medicamento fora da lista
                </Button>
                <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => adicionarItemLivre('manipulado')}>
                  <FlaskConical className="h-4 w-4" aria-hidden="true" />
                  Fórmula manipulada livre
                </Button>
              </div>
            </div>
          ) : null}

          {abaEsquerda === 'historico' ? (
            <div className="space-y-2">
              {historicoPrescricoes.length === 0 ? (
                <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                  Nenhuma receita emitida ainda.
                </div>
              ) : (
                historicoPrescricoes.map((hist) => (
                  <div key={hist.id} className="rounded-lg border bg-card p-3 text-sm space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-foreground">
                        {hist.paciente_snapshot?.nome || 'Paciente'} · {hist.paciente_snapshot?.peso_kg} kg
                      </span>
                      <Badge variant="outline" className="font-mono text-[11px]">
                        {hist.codigo_verificacao}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {hist.paciente_snapshot?.tutor_nome} · {hist.veterinario_nome} ·{' '}
                      {new Date(hist.assinado_em).toLocaleString('pt-BR')}
                    </div>
                    <div className="flex items-center justify-end gap-1.5 pt-1">
                      <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={() => confirmarDescarte(() => carregarDoHistorico(hist))}>
                        Copiar para nova receita
                      </Button>
                      <Button type="button" variant="secondary" size="sm" className="h-8 text-xs gap-1" onClick={() => reimprimirDoHistorico(hist)}>
                        <Printer className="h-3.5 w-3.5" aria-hidden="true" />
                        Imprimir
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          ) : null}
        </section>

        {/* ===================== DIREITA: receita, horários e emissão ===================== */}
        <section
          aria-label="Receita"
          className="flex flex-col lg:col-span-7 lg:min-h-0 lg:overflow-y-auto lg:[scrollbar-gutter:stable] lg:[overscroll-behavior:contain] p-4 space-y-4"
        >
          {itensPrescricao.length > 0 ? (
            <div
              role="status"
              aria-live="polite"
              className={`rounded-xl border-2 p-3.5 ${
                corBanner === 'vermelho'
                  ? 'border-red-500 bg-red-50 text-red-950 dark:bg-red-950/40 dark:text-red-200'
                  : corBanner === 'amarelo'
                    ? 'border-amber-400 bg-amber-50 text-amber-950 dark:bg-amber-950/40 dark:text-amber-200'
                    : 'border-emerald-500 bg-emerald-50/80 text-emerald-950 dark:bg-emerald-950/30 dark:text-emerald-200'
              }`}
            >
              <div className="flex items-start gap-3">
                {corBanner === 'vermelho' ? (
                  <ShieldAlert className="h-6 w-6 shrink-0 text-red-600" aria-hidden="true" />
                ) : corBanner === 'amarelo' ? (
                  <AlertTriangle className="h-6 w-6 shrink-0 text-amber-600" aria-hidden="true" />
                ) : (
                  <ShieldCheck className="h-6 w-6 shrink-0 text-emerald-600" aria-hidden="true" />
                )}
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="text-sm font-bold">
                    {corBanner === 'vermelho'
                      ? 'Risco grave para este paciente'
                      : corBanner === 'amarelo'
                        ? 'Atenção a alguns pontos'
                        : 'Doses dentro da faixa segura'}
                  </p>
                  {validacaoSeguranca.alertas.length === 0 ? (
                    <p className="text-sm opacity-90">
                      Conferido para {ROTULO_ESPECIE[paciente.especie].toLowerCase()} de{' '}
                      {temPeso ? `${formatarDecimal(paciente.peso_kg)} kg` : 'peso não informado'}. Nenhuma
                      contraindicação ou interação encontrada no bulário.
                    </p>
                  ) : (
                    <ul className="space-y-1 text-sm">
                      {validacaoSeguranca.alertas.map((al) => (
                        <li key={al.id}>
                          <strong>{al.titulo}:</strong> {al.mensagem}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-bold text-foreground flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-teal-600 text-xs font-bold text-white">
                2
              </span>
              Receita{paciente.nome ? ` de ${paciente.nome}` : ''}
              {temPeso ? (
                <Badge variant="outline" className="text-xs font-semibold">
                  {formatarDecimal(paciente.peso_kg)} kg · {ROTULO_ESPECIE[paciente.especie]}
                </Badge>
              ) : null}
            </h2>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 gap-1.5"
              onClick={() => {
                setAbaEsquerda('bulario');
                window.setTimeout(() => buscaBularioRef.current?.focus(), 50);
              }}
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              Adicionar medicamento
            </Button>
          </div>

          <div className="space-y-3">
            {itensPrescricao.length === 0 ? (
              <Card className="border-dashed shadow-none p-8 text-center space-y-1">
                <p className="text-sm font-semibold text-foreground">Nenhum medicamento ainda</p>
                <p className="text-sm text-muted-foreground">
                  {temPeso
                    ? 'Descreva o caso em “Sugerir com IA”, use um protocolo pronto ou adicione pelo bulário.'
                    : 'Comece informando o peso do paciente; as doses dependem dele.'}
                </p>
              </Card>
            ) : (
              itensPrescricao.map((item, index) => {
                const alertasDoItem = validacaoSeguranca.alertas_por_item[item.id] || [];
                const temCriticoItem = alertasDoItem.some((a) => a.cor === 'vermelho');
                const temCautelaItem = !temCriticoItem && alertasDoItem.some((a) => a.cor === 'amarelo');
                const memoriaAberta = Boolean(memoriasAbertas[item.id]);
                const saboresDisponiveis = SABORES_POR_ESPECIE[paciente.especie] || SABORES_POR_ESPECIE.canina;
                const doBulario = Boolean(item.slug_bulario);
                const nomeItem = item.principio_ativo || 'Novo medicamento';

                return (
                  <Card
                    key={item.id}
                    className={`shadow-sm ${
                      temCriticoItem
                        ? 'border-2 border-red-500'
                        : temCautelaItem
                          ? 'border-2 border-amber-400'
                          : 'border-l-4 border-l-teal-600'
                    }`}
                  >
                    <CardContent className="p-4 space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2 min-w-0">
                          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-teal-600 text-xs font-bold text-white">
                            {index + 1}
                          </span>
                          <span className="font-semibold text-foreground truncate">{nomeItem}</span>
                          {item.tipo === 'manipulado' ? (
                            <Badge className="bg-blue-600 text-white text-[11px] hover:bg-blue-600">Manipulado</Badge>
                          ) : null}
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            aria-expanded={memoriaAberta}
                            aria-controls={`${baseId}-memoria-${item.id}`}
                            onClick={() => setMemoriasAbertas((prev) => ({ ...prev, [item.id]: !prev[item.id] }))}
                            className="h-8 text-xs gap-1 text-teal-700 dark:text-teal-300"
                          >
                            <Calculator className="h-3.5 w-3.5" aria-hidden="true" />
                            {String(item.posologia.dose_calculada_mg).replace('.', ',')} mg por dose
                            {memoriaAberta ? (
                              <ChevronUp className="h-3.5 w-3.5" aria-hidden="true" />
                            ) : (
                              <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
                            )}
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:bg-destructive/10"
                            onClick={() => removerItem(item.id)}
                            aria-label={`Remover ${nomeItem}`}
                          >
                            <Trash2 className="h-4 w-4" aria-hidden="true" />
                          </Button>
                        </div>
                      </div>

                      {memoriaAberta ? (
                        <div
                          id={`${baseId}-memoria-${item.id}`}
                          className="rounded-md border border-teal-200 dark:border-teal-900 bg-teal-50/70 dark:bg-teal-950/30 px-3 py-2 text-sm text-teal-950 dark:text-teal-200"
                        >
                          <strong>Como foi calculado:</strong> {item.memoria_calculo}
                        </div>
                      ) : null}

                      {alertasDoItem.length > 0 ? (
                        <div className="space-y-1">
                          {alertasDoItem.map((al) => (
                            <div
                              key={al.id}
                              role="alert"
                              className={`rounded-md px-3 py-2 text-sm flex items-start gap-2 ${
                                al.cor === 'vermelho'
                                  ? 'bg-red-100 text-red-900 border border-red-300 dark:bg-red-950 dark:text-red-200'
                                  : 'bg-amber-100 text-amber-900 border border-amber-300 dark:bg-amber-950 dark:text-amber-200'
                              }`}
                            >
                              <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
                              <span>
                                <strong>{al.titulo}:</strong> {al.mensagem}
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : null}

                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
                        <div className="sm:col-span-4">
                          <Label htmlFor={`${baseId}-principio-${item.id}`} className="text-xs">
                            Princípio ativo {doBulario ? '' : '*'}
                          </Label>
                          <Input
                            id={`${baseId}-principio-${item.id}`}
                            value={item.principio_ativo}
                            readOnly={doBulario}
                            title={doBulario ? 'Do bulário. Para trocar o fármaco, remova e adicione outro.' : undefined}
                            onChange={(e) => editarTextoItem(item.id, 'principio_ativo', e.target.value)}
                            className={`h-9 text-sm ${doBulario ? 'bg-muted/50' : ''}`}
                          />
                        </div>
                        <div className="sm:col-span-4">
                          <Label htmlFor={`${baseId}-nome-${item.id}`} className="text-xs">
                            Nome comercial / apresentação
                          </Label>
                          <Input
                            id={`${baseId}-nome-${item.id}`}
                            value={item.nome_comercial_sugerido}
                            onChange={(e) => editarTextoItem(item.id, 'nome_comercial_sugerido', e.target.value)}
                            className="h-9 text-sm font-semibold"
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <Label htmlFor={`${baseId}-dose-${item.id}`} className="text-xs font-semibold text-teal-700 dark:text-teal-300">
                            Dose (mg/kg)
                          </Label>
                          <CampoDecimal
                            id={`${baseId}-dose-${item.id}`}
                            valor={item.dose_mg_kg}
                            onValor={(n) => recalcularItem(item.id, { dose_mg_kg: n })}
                            min={0.001}
                            className="h-9 text-sm font-bold"
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <Label htmlFor={`${baseId}-via-${item.id}`} className="text-xs">
                            Via
                          </Label>
                          <Select
                            value={item.icone_via}
                            onValueChange={(val) => recalcularItem(item.id, { icone_via: val as ViaAdministracao })}
                          >
                            <SelectTrigger id={`${baseId}-via-${item.id}`} className="h-9 text-sm">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {(Object.keys(ROTULO_VIA) as ViaAdministracao[]).map((via) => (
                                <SelectItem key={via} value={via}>
                                  <span className="inline-flex items-center gap-1.5">
                                    <IconeVia via={via} className="h-3.5 w-3.5" />
                                    {ROTULO_VIA[via]}
                                  </span>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      {item.tipo === 'manipulado' && item.manipulado ? (
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 rounded-lg border border-blue-200 dark:border-blue-900 bg-blue-50/50 dark:bg-blue-950/20 p-3">
                          <div>
                            <Label htmlFor={`${baseId}-veiculo-${item.id}`} className="text-xs text-blue-900 dark:text-blue-300">
                              Forma farmacêutica
                            </Label>
                            <Select
                              value={item.manipulado.veiculo}
                              onValueChange={(val) => recalcularItem(item.id, { veiculo_manipulado: val as VeiculoManipulado })}
                            >
                              <SelectTrigger id={`${baseId}-veiculo-${item.id}`} className="h-9 text-sm bg-background">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {Object.entries(ROTULO_VEICULO_MANIPULADO).map(([k, label]) => (
                                  <SelectItem key={k} value={k}>
                                    {label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label htmlFor={`${baseId}-sabor-${item.id}`} className="text-xs text-blue-900 dark:text-blue-300">
                              Sabor
                            </Label>
                            <Select
                              value={item.manipulado.sabor}
                              onValueChange={(val) => recalcularItem(item.id, { sabor_manipulado: val })}
                            >
                              <SelectTrigger id={`${baseId}-sabor-${item.id}`} className="h-9 text-sm bg-background">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {saboresDisponiveis.map((sabor) => (
                                  <SelectItem key={sabor} value={sabor}>
                                    {sabor}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <span className="text-xs text-blue-900 dark:text-blue-300 block mb-1.5">Quantidade a manipular</span>
                            <p className="text-sm text-blue-950 dark:text-blue-200">
                              {item.manipulado.quantidade_total_unidades}
                            </p>
                          </div>
                        </div>
                      ) : null}

                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end">
                        <div className="sm:col-span-4">
                          <Label htmlFor={`${baseId}-qtd-${item.id}`} className="text-xs">
                            Quanto dar por vez
                          </Label>
                          <Input
                            id={`${baseId}-qtd-${item.id}`}
                            value={item.posologia.quantidade_por_tomada}
                            onChange={(e) => editarTextoItem(item.id, 'quantidade_por_tomada', e.target.value)}
                            className="h-9 text-sm font-semibold"
                          />
                        </div>
                        <div className="sm:col-span-4 space-y-1">
                          <span className="text-xs text-muted-foreground block" id={`${baseId}-freq-${item.id}`}>
                            De quanto em quanto tempo
                          </span>
                          <div className="flex flex-wrap gap-1" role="group" aria-labelledby={`${baseId}-freq-${item.id}`}>
                            {FREQUENCIAS_RAPIDAS.map((f) => (
                              <button
                                key={f.horas}
                                type="button"
                                aria-pressed={item.posologia.frequencia_horas === f.horas}
                                onClick={() => recalcularItem(item.id, { frequencia_horas: f.horas })}
                                className={`rounded-md border px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                                  item.posologia.frequencia_horas === f.horas
                                    ? 'border-teal-600 bg-teal-600 text-white'
                                    : 'bg-background hover:bg-muted'
                                }`}
                              >
                                {f.rotulo}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div className="sm:col-span-4 space-y-1">
                          <span className="text-xs text-muted-foreground block" id={`${baseId}-dur-${item.id}`}>
                            Por quantos dias
                          </span>
                          <div className="flex flex-wrap gap-1" role="group" aria-labelledby={`${baseId}-dur-${item.id}`}>
                            {DURACOES_RAPIDAS.map((d) => (
                              <button
                                key={d}
                                type="button"
                                aria-pressed={item.posologia.duracao_dias === d}
                                onClick={() => recalcularItem(item.id, { duracao_dias: d })}
                                className={`rounded-md border px-2 py-1.5 text-xs font-semibold transition-colors ${
                                  item.posologia.duracao_dias === d
                                    ? 'border-teal-600 bg-teal-600 text-white'
                                    : 'bg-background hover:bg-muted'
                                }`}
                              >
                                {d}d
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
                        <div className="sm:col-span-4">
                          <Label htmlFor={`${baseId}-alim-${item.id}`} className="text-xs">
                            Alimentação
                          </Label>
                          <Select
                            value={item.condicao_alimentar}
                            onValueChange={(val) => editarTextoItem(item.id, 'condicao_alimentar', val)}
                          >
                            <SelectTrigger id={`${baseId}-alim-${item.id}`} className="h-9 text-sm">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {Object.entries(ROTULO_CONDICAO_ALIMENTAR).map(([k, label]) => (
                                <SelectItem key={k} value={k}>
                                  {label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="sm:col-span-8">
                          <Label htmlFor={`${baseId}-orient-${item.id}`} className="text-xs">
                            Orientação para o tutor
                          </Label>
                          <Input
                            id={`${baseId}-orient-${item.id}`}
                            value={item.orientacoes_tutor}
                            onChange={(e) => editarTextoItem(item.id, 'orientacoes_tutor', e.target.value)}
                            className="h-9 text-sm"
                          />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>

          {gradeCronograma.length > 0 ? (
            <Card className="shadow-sm">
              <CardHeader className="py-3 px-4 border-b bg-muted/30">
                <div className="flex flex-wrap items-center justify-between gap-1">
                  <CardTitle className="text-sm font-bold flex items-center gap-1.5">
                    <Clock className="h-4 w-4 text-teal-600" aria-hidden="true" />
                    Horários para o tutor
                  </CardTitle>
                  <span className="text-xs text-muted-foreground">Vai junto no PDF e no WhatsApp</span>
                </div>
              </CardHeader>
              <CardContent className="p-3.5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                  {gradeCronograma.map((slot) => (
                    <div key={slot.horario} className="flex items-start gap-3 rounded-lg border bg-card p-2.5">
                      <div className="flex flex-col items-center justify-center rounded-md bg-teal-50 dark:bg-teal-950/50 border border-teal-200 dark:border-teal-900 px-2.5 py-1.5 text-teal-800 dark:text-teal-200 shrink-0">
                        <div className="flex items-center gap-1">
                          {slot.periodo === 'manha' ? (
                            <Sun className="h-3.5 w-3.5 text-amber-500" aria-hidden="true" />
                          ) : slot.periodo === 'tarde' ? (
                            <Sunset className="h-3.5 w-3.5 text-orange-500" aria-hidden="true" />
                          ) : (
                            <Moon className="h-3.5 w-3.5 text-indigo-500" aria-hidden="true" />
                          )}
                          <span className="text-sm font-bold tabular-nums">{slot.horario}</span>
                        </div>
                        <span className="text-[11px] font-medium">{slot.rotulo_periodo}</span>
                      </div>
                      <div className="min-w-0 flex-1 space-y-1.5">
                        {slot.itens.map((it) => (
                          <div key={`${slot.horario}-${it.item_id}`} className="text-sm">
                            <div className="font-semibold text-foreground flex items-center gap-1">
                              <IconeVia via={it.icone_via} className="h-3.5 w-3.5 text-teal-600 shrink-0" />
                              <span className="truncate">{it.nome_exibicao}</span>
                            </div>
                            <div className="text-xs text-muted-foreground flex flex-wrap items-center gap-1.5">
                              <span className="font-semibold text-foreground">{it.quantidade_por_tomada}</span>
                              <span aria-hidden="true">·</span>
                              <span className="inline-flex items-center gap-1">
                                {it.condicao_alimentar === 'com_alimento' ? (
                                  <Utensils className="h-3 w-3 text-emerald-600" aria-hidden="true" />
                                ) : it.condicao_alimentar === 'jejum' ? (
                                  <Coffee className="h-3 w-3 text-amber-600" aria-hidden="true" />
                                ) : null}
                                {it.rotulo_alimentar}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : null}

          <Card className="border-teal-300 dark:border-teal-800 shadow-sm">
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-teal-600 text-xs font-bold text-white">
                  3
                </span>
                Emitir
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <Label htmlFor={`${baseId}-vet-nome`} className="text-xs">
                    Veterinário responsável *
                  </Label>
                  {veterinarios.length > 0 ? (
                    <Select
                      value={veterinarioId ?? ''}
                      onValueChange={(id) => {
                        const vet = veterinarios.find((v) => v.id === id);
                        if (!vet) return;
                        setVeterinarioId(vet.id);
                        setVeterinarioNome(vet.nome);
                        setVeterinarioCrmv(vet.crmv);
                      }}
                    >
                      <SelectTrigger id={`${baseId}-vet-nome`} className="h-9 text-sm">
                        <SelectValue placeholder={veterinarioNome || 'Selecione'} />
                      </SelectTrigger>
                      <SelectContent>
                        {veterinarios.map((v) => (
                          <SelectItem key={v.id} value={v.id}>
                            {v.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      id={`${baseId}-vet-nome`}
                      value={veterinarioNome}
                      onChange={(e) => setVeterinarioNome(e.target.value)}
                      className="h-9 text-sm"
                    />
                  )}
                </div>
                <div>
                  <Label htmlFor={`${baseId}-vet-crmv`} className="text-xs">
                    CRMV *
                  </Label>
                  <Input
                    id={`${baseId}-vet-crmv`}
                    value={veterinarioCrmv}
                    onChange={(e) => setVeterinarioCrmv(e.target.value)}
                    placeholder="CRMV-UF 00000"
                    className="h-9 text-sm font-mono"
                    autoCapitalize="characters"
                    spellCheck={false}
                  />
                </div>
              </div>

              <div>
                <Label htmlFor={`${baseId}-obs-gerais`} className="text-xs">
                  Recomendações e retorno
                </Label>
                <Textarea
                  id={`${baseId}-obs-gerais`}
                  rows={2}
                  value={observacoesGerais}
                  onChange={(e) => setObservacoesGerais(e.target.value)}
                  placeholder="Ex.: retorno em 10 dias para reavaliação."
                  className="text-sm resize-y"
                />
              </div>

              <div className="flex flex-col items-stretch gap-2 pt-2 border-t sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-muted-foreground" aria-live="polite">
                  {pendencias.length > 0 ? `Falta: ${pendencias.join(', ')}.` : 'Tudo pronto para revisar e emitir.'}
                </p>
                <Button
                  type="button"
                  disabled={pendencias.length > 0}
                  onClick={abrirRevisao}
                  className={`h-10 font-semibold gap-2 px-5 text-white ${
                    validacaoSeguranca.bloqueia_emissao ? 'bg-red-600 hover:bg-red-700' : 'bg-teal-600 hover:bg-teal-700'
                  }`}
                >
                  <FileCheck2 className="h-4 w-4" aria-hidden="true" />
                  {validacaoSeguranca.bloqueia_emissao ? 'Revisar risco e emitir' : 'Revisar e emitir'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </section>
      </div>

      <Dialog
        open={modalAberto}
        onOpenChange={(aberto) => {
          if (!emitindo) setModalAberto(aberto);
        }}
      >
        <DialogContent className="max-w-lg">
          {receitaEmitida ? (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-base">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" aria-hidden="true" />
                  Receita emitida
                </DialogTitle>
                <DialogDescription>
                  Registrada com o código <strong className="font-mono">{receitaEmitida.codigoVerificacao}</strong>.
                  O QR Code da receita abre a página de validação.
                </DialogDescription>
              </DialogHeader>
              <div className="flex items-center gap-4 rounded-lg border bg-muted/30 p-3">
                <QrCodeSvgInline texto={receitaEmitida.urlValidacaoPublica} tamanho={104} />
                <div className="text-sm space-y-1 min-w-0">
                  <div>
                    <strong>{receitaEmitida.paciente.nome}</strong> · {receitaEmitida.paciente.tutor_nome}
                  </div>
                  <div className="text-muted-foreground">
                    {receitaEmitida.itens.length}{' '}
                    {receitaEmitida.itens.length === 1 ? 'medicamento' : 'medicamentos'}
                  </div>
                  <Link
                    to={`/validar-receita/${receitaEmitida.codigoVerificacao}`}
                    target="_blank"
                    className="text-xs text-teal-700 dark:text-teal-300 underline"
                  >
                    Abrir página de validação
                  </Link>
                </div>
              </div>
              <DialogFooter className="gap-2 sm:justify-between">
                <Button type="button" variant="ghost" onClick={novaReceita}>
                  Nova receita
                </Button>
                <div className="flex flex-col-reverse gap-2 sm:flex-row">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={enviandoWpp || !receitaEmitida.paciente.tutor_telefone}
                    title={receitaEmitida.paciente.tutor_telefone ? undefined : 'Informe o WhatsApp do tutor'}
                    onClick={handleEnviarWhatsapp}
                    className="gap-1.5"
                  >
                    {enviandoWpp ? (
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    ) : (
                      <Send className="h-4 w-4" aria-hidden="true" />
                    )}
                    {enviandoWpp ? 'Enviando…' : 'Enviar ao WhatsApp'}
                  </Button>
                  <Button
                    type="button"
                    onClick={() => imprimirOuExportarReceituarioPdf(receitaEmitida)}
                    className="bg-teal-600 hover:bg-teal-700 text-white gap-1.5"
                  >
                    <Printer className="h-4 w-4" aria-hidden="true" />
                    Imprimir / salvar PDF
                  </Button>
                </div>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-base">
                  <FileCheck2 className="h-5 w-5 text-teal-600" aria-hidden="true" />
                  Revisar e emitir
                </DialogTitle>
                <DialogDescription>Confira antes de emitir. Depois de emitida, a receita recebe um código de validação.</DialogDescription>
              </DialogHeader>

              <div className="space-y-3 text-sm">
                <div className="rounded-lg border bg-muted/40 p-3 space-y-0.5">
                  <div>
                    <strong>{paciente.nome}</strong> · {ROTULO_ESPECIE[paciente.especie]}
                    {paciente.raca ? ` · ${paciente.raca}` : ''} · <strong>{formatarDecimal(paciente.peso_kg)} kg</strong>
                  </div>
                  <div className="text-muted-foreground">Tutor: {paciente.tutor_nome}</div>
                  <div className="text-muted-foreground">
                    Responsável: {veterinarioNome} ({veterinarioCrmv})
                  </div>
                </div>

                <ol className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
                  {itensPrescricao.map((it, idx) => (
                    <li key={it.id} className="rounded border p-2 bg-background">
                      <div className="font-semibold">
                        {idx + 1}. {it.nome_comercial_sugerido || it.principio_ativo}
                      </div>
                      <div className="text-muted-foreground">
                        {it.posologia.quantidade_por_tomada}, a cada {it.posologia.frequencia_horas}h, por{' '}
                        {it.posologia.duracao_dias} dias
                      </div>
                    </li>
                  ))}
                </ol>

                {validacaoSeguranca.bloqueia_emissao ? (
                  <div className="rounded-lg border-2 border-red-500 bg-red-50 dark:bg-red-950/40 p-3 space-y-2 text-red-950 dark:text-red-200">
                    <div className="font-bold flex items-center gap-1.5 text-red-700 dark:text-red-300">
                      <ShieldAlert className="h-4 w-4 shrink-0" aria-hidden="true" />
                      Risco grave detectado
                    </div>
                    <p>
                      O recomendado é trocar o medicamento. Se for uma exceção clínica sob sua responsabilidade,
                      escreva a justificativa (mínimo 10 caracteres):
                    </p>
                    <Label htmlFor={`${baseId}-justificativa`} className="sr-only">
                      Justificativa clínica
                    </Label>
                    <Textarea
                      id={`${baseId}-justificativa`}
                      rows={2}
                      value={overrideJustificativa}
                      onChange={(e) => setOverrideJustificativa(e.target.value)}
                      placeholder="Justificativa clínica"
                      className="text-sm bg-background"
                    />
                  </div>
                ) : null}

                <label className="flex items-start gap-2.5 rounded-lg border p-3 cursor-pointer bg-teal-50/40 dark:bg-teal-950/20">
                  <Checkbox
                    checked={responsabilidadeConfirmada}
                    onCheckedChange={(checked) => setResponsabilidadeConfirmada(Boolean(checked))}
                    className="mt-0.5"
                  />
                  <span>
                    Revisei doses, apresentações e alertas e assumo a responsabilidade técnica por esta receita (
                    {veterinarioCrmv}).
                  </span>
                </label>
              </div>

              <DialogFooter className="gap-2">
                <Button type="button" variant="outline" onClick={() => setModalAberto(false)} disabled={emitindo}>
                  Voltar e ajustar
                </Button>
                <Button
                  type="button"
                  disabled={
                    emitindo ||
                    !responsabilidadeConfirmada ||
                    (validacaoSeguranca.bloqueia_emissao && overrideJustificativa.trim().length < 10)
                  }
                  onClick={handleConfirmarEmissao}
                  className="bg-teal-600 hover:bg-teal-700 text-white gap-1.5"
                >
                  {emitindo ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                  )}
                  {emitindo ? 'Emitindo…' : 'Emitir receita'}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={descartePendente !== null}
        onOpenChange={(aberto) => {
          if (!aberto) setDescartePendente(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Descartar a receita atual?</AlertDialogTitle>
            <AlertDialogDescription>
              Ela ainda não foi emitida. Os {itensPrescricao.length}{' '}
              {itensPrescricao.length === 1 ? 'medicamento será perdido' : 'medicamentos serão perdidos'}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Continuar editando</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                descartePendente?.();
                setDescartePendente(null);
              }}
            >
              Descartar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
