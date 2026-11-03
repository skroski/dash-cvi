import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import {
  Mic,
  Stethoscope,
  ClipboardList,
  BedDouble,
  Settings,
  ShieldCheck,
  Plus,
  Search,
  Save,
  Sparkles,
  Activity,
  History,
  Download,
  Trash2,
  CheckCircle2,
  Hash,
  Clock,
  PawPrint,
  User,
  RotateCcw,
  Pill,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ProntuarioIaPanel } from '@/components/prontuario-ia/ProntuarioIaPanel';
import { BularioProntuarioDialog } from '@/components/prontuario-ia/BularioProntuarioDialog';
import {
  type PetCadastro,
  type MedicalRecord,
  type Internacao,
  type InternacaoEvento,
  type InternacaoEventoTipo,
  type AnamnesisData,
  type PhysicalExamData,
  type ConsentimentoProntuarioIa,
  DEFAULT_PRONTUARIO_IA_SYSTEM_PROMPT,
  calcularHashSha256Prontuario,
} from '@/lib/prontuarioIaCore';
import {
  type ProntuarioIaConfigRow,
  carregarConfigProntuarioIa,
  salvarConfigProntuarioIa,
  listarPetsCadastro,
  criarOuAtualizarPet,
  carregarProntuariosDoPet,
  atualizarProntuarioDireto,
  carregarInternacaoDoPet,
  salvarInternacaoManual,
  adicionarEventoInternacaoManual,
  registrarConsentimentoTutorIa,
  listarConsentimentosDoPet,
  executarExpurgoRetencaoIa,
  eliminarAudioTranscricaoDaConsulta,
  exportarDadosProntuarioTutor,
  SupabaseProntuarioRepository,
} from '@/services/prontuarioIaAdapters';

const repo = new SupabaseProntuarioRepository();

const ROTULO_STATUS_PRONTUARIO: Record<string, string> = {
  em_andamento: 'Em andamento',
  finalizado: 'Finalizado',
  alta: 'Alta',
  obito: 'Óbito',
};

const ROTULO_EVENTO_INTERNACAO: Record<string, string> = {
  evolucao: 'Evolução',
  medicamento: 'Medicamento',
  monitoramento: 'Monitoramento',
  checkin: 'Check-in',
  alta: 'Alta',
};

export default function ProntuarioIaPage() {
  const [searchParams] = useSearchParams();
  const queryPetId = searchParams.get('petId') || '';
  const queryPetName = searchParams.get('pet') || '';
  const queryTutorName = searchParams.get('tutor') || '';
  const queryVetName = searchParams.get('vet') || '';

  const [pets, setPets] = useState<PetCadastro[]>([]);
  const [selectedPetId, setSelectedPetId] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<string>('ia');

  const [config, setConfig] = useState<ProntuarioIaConfigRow>({
    id: 1,
    webhook_url: null,
    system_prompt: null,
    veterinario_nome: null,
    crmv_responsavel: null,
    retencao_dias: 90,
  });

  const [prontuarios, setProntuarios] = useState<MedicalRecord[]>([]);
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);
  const [internacao, setInternacao] = useState<Internacao | null>(null);
  const [eventosInternacao, setEventosInternacao] = useState<InternacaoEvento[]>([]);
  const [consentimentos, setConsentimentos] = useState<ConsentimentoProntuarioIa[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal de novo Pet
  const [petModalOpen, setPetModalOpen] = useState(false);
  const [novoPet, setNovoPet] = useState({
    nome: '',
    especie: 'canina',
    raca: '',
    sexo: 'macho',
    peso: '',
    idade: '',
    tutor_nome: '',
    tutor_telefone: '',
    observacoes: '',
  });
  const [savingPet, setSavingPet] = useState(false);

  // Estado editável da aba Ficha Clínica
  const [fichaForm, setFichaForm] = useState<{
    motivo_consulta: string;
    tipo_atendimento: MedicalRecord['tipo_atendimento'];
    status: MedicalRecord['status'];
    veterinario: string;
    crmv_responsavel: string;
    anamnese: AnamnesisData;
    exame_fisico: PhysicalExamData;
    diagnostico_definitivo: string;
    cid_vet: string;
    hipotesesText: string;
    tratamento: string;
    medicamentos: string;
    observacoes: string;
  }>({
    motivo_consulta: 'Nova Consulta',
    tipo_atendimento: 'consulta',
    status: 'em_andamento',
    veterinario: '',
    crmv_responsavel: '',
    anamnese: {},
    exame_fisico: {},
    diagnostico_definitivo: '',
    cid_vet: '',
    hipotesesText: '',
    tratamento: '',
    medicamentos: '',
    observacoes: '',
  });
  const [savingFicha, setSavingFicha] = useState(false);

  // Estado editável da aba Internação
  const [internacaoForm, setInternacaoForm] = useState<{
    motivo: string;
    box: string;
    previsao_alta: string;
    status: Internacao['status'];
    objetos_com_pet: string;
    alergiasText: string;
    sintomas_entrada: string;
    observacoes: string;
  }>({
    motivo: '',
    box: '',
    previsao_alta: '',
    status: 'internado',
    objetos_com_pet: '',
    alergiasText: '',
    sintomas_entrada: '',
    observacoes: '',
  });
  const [novoEvento, setNovoEvento] = useState<{
    tipo: InternacaoEventoTipo;
    descricao: string;
    temperatura: string;
    frequencia_cardiaca: string;
    frequencia_respiratoria: string;
    pressao_sistolica: string;
  }>({
    tipo: 'evolucao',
    descricao: '',
    temperatura: '',
    frequencia_cardiaca: '',
    frequencia_respiratoria: '',
    pressao_sistolica: '',
  });
  const [savingInternacao, setSavingInternacao] = useState(false);

  // Estado editável da aba Configuração IA
  const [configForm, setConfigForm] = useState({
    system_prompt: '',
    veterinario_nome: '',
    crmv_responsavel: '',
    retencao_dias: '90',
  });
  const [savingConfig, setSavingConfig] = useState(false);
  const [bularioDialogOpen, setBularioDialogOpen] = useState(false);

  const handleInserirMedicamentoDoBulario = (texto: string) => {
    setFichaForm((prev) => ({
      ...prev,
      medicamentos: prev.medicamentos ? `${prev.medicamentos}\n${texto}` : texto,
    }));
  };

  const selectedPet = useMemo(
    () => pets.find((p) => p.id === selectedPetId) ?? null,
    [pets, selectedPetId]
  );

  const currentRecord = useMemo(
    () =>
      prontuarios.find((r) => r.id === selectedRecordId) ??
      prontuarios.find((r) => r.status === 'em_andamento') ??
      prontuarios[0] ??
      null,
    [prontuarios, selectedRecordId]
  );

  // Leva para o receituário os dados do paciente. O peso só vai se foi aferido na consulta
  // em andamento; o peso do cadastro pode ser antigo e calcularia dose errada.
  const linkReceituario = useMemo(() => {
    if (!selectedPet) return '/receituario';
    const params = new URLSearchParams({ pet: selectedPet.nome });
    if (selectedPet.tutor_nome) params.set('tutor', selectedPet.tutor_nome);
    if (selectedPet.tutor_telefone) params.set('telefone', selectedPet.tutor_telefone);
    if (['canina', 'felina', 'silvestre'].includes(selectedPet.especie)) {
      params.set('especie', selectedPet.especie);
    }
    if (selectedPet.raca) params.set('raca', selectedPet.raca);
    const peso = currentRecord?.status === 'em_andamento' ? currentRecord.peso_atual : null;
    if (peso && peso > 0) params.set('peso', String(peso));
    if (fichaForm.veterinario) params.set('vet', fichaForm.veterinario);
    return `/receituario?${params.toString()}`;
  }, [selectedPet, currentRecord, fichaForm.veterinario]);

  const filteredPets = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return pets;
    return pets.filter(
      (p) =>
        p.nome.toLowerCase().includes(q) ||
        (p.tutor_nome && p.tutor_nome.toLowerCase().includes(q)) ||
        (p.raca && p.raca.toLowerCase().includes(q))
    );
  }, [pets, searchTerm]);

  const carregarTudoInicial = useCallback(async () => {
    setLoading(true);
    try {
      const [cfg, listaPets] = await Promise.all([
        carregarConfigProntuarioIa(),
        listarPetsCadastro(),
      ]);

      setConfig(cfg);
      setConfigForm({
        system_prompt: cfg.system_prompt ?? '',
        veterinario_nome: cfg.veterinario_nome || queryVetName || '',
        crmv_responsavel: cfg.crmv_responsavel ?? '',
        retencao_dias: String(cfg.retencao_dias ?? 90),
      });

      setPets(listaPets);

      if (queryPetId && listaPets.some((p) => p.id === queryPetId)) {
        setSelectedPetId(queryPetId);
      } else if (queryPetName) {
        const match = listaPets.find(
          (p) =>
            p.nome.toLowerCase() === queryPetName.toLowerCase() &&
            (!queryTutorName ||
              (p.tutor_nome && p.tutor_nome.toLowerCase().includes(queryTutorName.toLowerCase())))
        );
        if (match) {
          setSelectedPetId(match.id);
        } else if (listaPets[0]) {
          setSelectedPetId(listaPets[0].id);
        }
      } else if (listaPets[0]) {
        setSelectedPetId((prev) => prev || listaPets[0].id);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao carregar dados iniciais.');
    } finally {
      setLoading(false);
    }
  }, [queryPetId, queryPetName, queryTutorName, queryVetName]);

  const recarregarDadosDoPet = useCallback(async (petId: string) => {
    if (!petId) return;
    try {
      const [listaRecs, dadosInt, listaCons] = await Promise.all([
        carregarProntuariosDoPet(petId),
        carregarInternacaoDoPet(petId),
        listarConsentimentosDoPet(petId),
      ]);

      // Não cria consulta só por abrir o pet: ela nasce ao gravar ou ao clicar em "Nova consulta".
      const recs = listaRecs;
      setProntuarios(recs);
      const active = recs.find((r) => r.status === 'em_andamento') ?? recs[0] ?? null;
      setSelectedRecordId(active?.id ?? null);

      setInternacao(dadosInt.internacao);
      setEventosInternacao(dadosInt.eventos);
      setConsentimentos(listaCons);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao carregar prontuário do pet.');
    }
  }, []);

  useEffect(() => {
    void carregarTudoInicial();
  }, [carregarTudoInicial]);

  useEffect(() => {
    if (selectedPetId) {
      void recarregarDadosDoPet(selectedPetId);
    }
  }, [selectedPetId, recarregarDadosDoPet]);

  // Sincroniza formulário da ficha clínica com o prontuário selecionado
  useEffect(() => {
    if (!currentRecord) return;
    setFichaForm({
      motivo_consulta: currentRecord.motivo_consulta || 'Nova Consulta',
      tipo_atendimento: currentRecord.tipo_atendimento || 'consulta',
      status: currentRecord.status || 'em_andamento',
      veterinario: currentRecord.veterinario || config.veterinario_nome || '',
      crmv_responsavel: currentRecord.crmv_responsavel || config.crmv_responsavel || '',
      anamnese: { ...(currentRecord.anamnese ?? {}) },
      exame_fisico: { ...(currentRecord.exame_fisico ?? {}) },
      diagnostico_definitivo:
        currentRecord.diagnostico_definitivo || currentRecord.diagnostico || '',
      cid_vet: currentRecord.cid_vet || '',
      hipotesesText: (currentRecord.hipoteses_diagnosticas ?? []).join('\n'),
      tratamento: currentRecord.tratamento || '',
      medicamentos: currentRecord.medicamentos || '',
      observacoes: currentRecord.observacoes || '',
    });
  }, [currentRecord, config.veterinario_nome, config.crmv_responsavel]);

  // Sincroniza formulário de internação
  useEffect(() => {
    if (internacao) {
      setInternacaoForm({
        motivo: internacao.motivo || '',
        box: internacao.box || '',
        previsao_alta: internacao.previsao_alta || '',
        status: internacao.status || 'internado',
        objetos_com_pet: internacao.objetos_com_pet || '',
        alergiasText: (internacao.alergias ?? []).join('\n'),
        sintomas_entrada: internacao.sintomas_entrada || '',
        observacoes: internacao.observacoes || '',
      });
    } else {
      setInternacaoForm({
        motivo: '',
        box: '',
        previsao_alta: '',
        status: 'internado',
        objetos_com_pet: '',
        alergiasText: '',
        sintomas_entrada: '',
        observacoes: '',
      });
    }
  }, [internacao]);

  const handleCreatePet = async () => {
    if (!novoPet.nome.trim()) {
      toast.error('Informe o nome do paciente (pet).');
      return;
    }
    setSavingPet(true);
    try {
      const created = await criarOuAtualizarPet({
        nome: novoPet.nome,
        especie: novoPet.especie,
        raca: novoPet.raca || null,
        sexo: novoPet.sexo,
        peso: novoPet.peso ? Number(novoPet.peso) : null,
        idade: novoPet.idade ? Number(novoPet.idade) : null,
        tutor_nome: novoPet.tutor_nome || null,
        tutor_telefone: novoPet.tutor_telefone || null,
        observacoes: novoPet.observacoes || null,
      });

      const updatedList = await listarPetsCadastro();
      setPets(updatedList);
      setSelectedPetId(created.id);
      setPetModalOpen(false);
      setNovoPet({
        nome: '',
        especie: 'canina',
        raca: '',
        sexo: 'macho',
        peso: '',
        idade: '',
        tutor_nome: '',
        tutor_telefone: '',
        observacoes: '',
      });
      toast.success(`Pet "${created.nome}" cadastrado com sucesso.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao cadastrar pet.');
    } finally {
      setSavingPet(false);
    }
  };

  const handleSaveFicha = async () => {
    if (!currentRecord || !selectedPetId) return;
    setSavingFicha(true);
    try {
      const confirmadoEmIso = new Date().toISOString();
      const hip = fichaForm.hipotesesText
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean);

      const hash = await calcularHashSha256Prontuario({
        petId: selectedPetId,
        recordId: currentRecord.id,
        confirmadoEmIso,
        veterinario: fichaForm.veterinario,
        crmvResponsavel: fichaForm.crmv_responsavel,
        edited: {
          anamnese: fichaForm.anamnese,
          exame_fisico: fichaForm.exame_fisico,
          diagnostico: {
            diagnostico_definitivo: fichaForm.diagnostico_definitivo || undefined,
            cid_vet: fichaForm.cid_vet || undefined,
            hipoteses_diagnosticas: hip.length > 0 ? hip : undefined,
            tratamento: fichaForm.tratamento || undefined,
            medicamentos: fichaForm.medicamentos || undefined,
            observacoes: fichaForm.observacoes || undefined,
          },
        },
      });

      await atualizarProntuarioDireto(currentRecord.id, {
        motivo_consulta: fichaForm.motivo_consulta,
        tipo_atendimento: fichaForm.tipo_atendimento,
        status: fichaForm.status,
        veterinario: fichaForm.veterinario || null,
        crmv_responsavel: fichaForm.crmv_responsavel || '',
        anamnese: fichaForm.anamnese,
        exame_fisico: fichaForm.exame_fisico,
        peso_atual: fichaForm.exame_fisico.peso ?? null,
        temperatura: fichaForm.exame_fisico.temperatura ?? null,
        frequencia_cardiaca:
          fichaForm.exame_fisico.fc != null ? Math.round(fichaForm.exame_fisico.fc) : null,
        frequencia_respiratoria:
          fichaForm.exame_fisico.fr != null ? Math.round(fichaForm.exame_fisico.fr) : null,
        diagnostico_definitivo: fichaForm.diagnostico_definitivo || null,
        diagnostico: fichaForm.diagnostico_definitivo || null,
        cid_vet: fichaForm.cid_vet || null,
        hipoteses_diagnosticas: hip.length > 0 ? hip : null,
        tratamento: fichaForm.tratamento || null,
        medicamentos: fichaForm.medicamentos || null,
        observacoes: fichaForm.observacoes || null,
        confirmado_em: confirmadoEmIso,
        assinatura_digital: hash,
      });

      await recarregarDadosDoPet(selectedPetId);
      toast.success('Prontuário salvo e assinado com hash SHA-256.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao salvar prontuário.');
    } finally {
      setSavingFicha(false);
    }
  };

  const handleSaveInternacao = async () => {
    if (!selectedPetId) return;
    setSavingInternacao(true);
    try {
      const alergias = internacaoForm.alergiasText
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean);

      await salvarInternacaoManual(selectedPetId, {
        id: internacao?.id,
        prontuario_id: currentRecord?.id ?? null,
        motivo: internacaoForm.motivo || null,
        box: internacaoForm.box || null,
        previsao_alta: internacaoForm.previsao_alta || null,
        status: internacaoForm.status,
        objetos_com_pet: internacaoForm.objetos_com_pet || null,
        alergias: alergias.length > 0 ? alergias : null,
        sintomas_entrada: internacaoForm.sintomas_entrada || null,
        observacoes: internacaoForm.observacoes || null,
        responsavel: config.veterinario_nome || null,
        crmv_responsavel: config.crmv_responsavel || null,
      });

      await recarregarDadosDoPet(selectedPetId);
      toast.success('Ficha de internação salva.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao salvar internação.');
    } finally {
      setSavingInternacao(false);
    }
  };

  const handleAddEventoInternacao = async () => {
    if (!internacao?.id || !selectedPetId) return;
    try {
      await adicionarEventoInternacaoManual(internacao.id, {
        tipo: novoEvento.tipo,
        descricao: novoEvento.descricao || null,
        temperatura: novoEvento.temperatura ? Number(novoEvento.temperatura) : null,
        frequencia_cardiaca: novoEvento.frequencia_cardiaca
          ? Math.round(Number(novoEvento.frequencia_cardiaca))
          : null,
        frequencia_respiratoria: novoEvento.frequencia_respiratoria
          ? Math.round(Number(novoEvento.frequencia_respiratoria))
          : null,
        pressao_sistolica: novoEvento.pressao_sistolica
          ? Math.round(Number(novoEvento.pressao_sistolica))
          : null,
        status: 'realizado',
        responsavel: config.veterinario_nome || null,
        horario: new Date().toISOString(),
      });

      setNovoEvento({
        tipo: 'evolucao',
        descricao: '',
        temperatura: '',
        frequencia_cardiaca: '',
        frequencia_respiratoria: '',
        pressao_sistolica: '',
      });
      await recarregarDadosDoPet(selectedPetId);
      toast.success('Evento de monitoramento registrado na timeline.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao registrar evento.');
    }
  };

  const handleSaveConfig = async () => {
    setSavingConfig(true);
    try {
      const saved = await salvarConfigProntuarioIa({
        system_prompt: configForm.system_prompt || null,
        veterinario_nome: configForm.veterinario_nome || null,
        crmv_responsavel: configForm.crmv_responsavel || null,
        retencao_dias: configForm.retencao_dias ? Number(configForm.retencao_dias) : 90,
      });
      setConfig(saved);
      toast.success('Configuração do Prontuário com IA salva com sucesso.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao salvar configuração.');
    } finally {
      setSavingConfig(false);
    }
  };

  const handleNovaConsulta = async () => {
    if (!selectedPetId) return;
    try {
      const created = await repo.ensureActiveRecord(selectedPetId);
      await recarregarDadosDoPet(selectedPetId);
      setSelectedRecordId(created.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível abrir a consulta.');
    }
  };

  const handleRegisterConsent = async () => {
    if (!selectedPet) return;
    await registrarConsentimentoTutorIa({
      petId: selectedPet.id,
      tutorId: selectedPet.tutor_id ?? null,
      prontuarioId: currentRecord?.id ?? null,
    });
    const lista = await listarConsentimentosDoPet(selectedPet.id);
    setConsentimentos(lista);
  };

  const handleExportTutorData = async () => {
    if (!selectedPetId) return;
    try {
      const data = await exportarDadosProntuarioTutor(selectedPetId);
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: 'application/json;charset=utf-8',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `prontuario_lgpd_${selectedPet?.nome || selectedPetId}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Exportação LGPD gerada com sucesso.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao exportar dados do titular.');
    }
  };

  const handleEliminateAudioTranscript = async () => {
    if (!currentRecord?.id || !selectedPetId) return;
    try {
      await eliminarAudioTranscricaoDaConsulta(currentRecord.id);
      await recarregarDadosDoPet(selectedPetId);
      toast.success('Áudio bruto e transcrição da consulta eliminados (prontuário preservado).');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao eliminar áudio/transcrição.');
    }
  };

  const handleRunRetentionPurge = async () => {
    try {
      const dias = Number(configForm.retencao_dias) || 90;
      const res = await executarExpurgoRetencaoIa(dias);
      toast.success(
        `Expurgo de retenção concluído (${res.expurgados} rascunho(s) antigo(s) higienizado(s)).`
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha no expurgo de retenção.');
    }
  };

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-background p-4 md:p-6 space-y-6">
      {/* Topo: Título + Seletor de Pet + Ações Rápidas */}
      <header className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 border-b border-border pb-4">
        <div className="space-y-1">
          <h1 className="text-xl md:text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" aria-hidden="true" />
            Prontuário com IA
          </h1>
          <p className="text-sm text-muted-foreground">
            Grave a consulta, revise o que a IA preencheu e salve. Nada é salvo sem a sua revisão.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-56">
            <Search
              className="h-3.5 w-3.5 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2"
              aria-hidden="true"
            />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Filtrar pet ou tutor..."
              className="h-9 pl-8 text-xs"
            />
          </div>

          <select
            aria-label="Selecionar paciente (pet)"
            className="h-9 rounded-md border border-input bg-background px-3 text-xs font-medium min-w-[220px]"
            value={selectedPetId}
            onChange={(e) => setSelectedPetId(e.target.value)}
          >
            {filteredPets.length === 0 ? (
              <option value="">Nenhum pet encontrado</option>
            ) : (
              filteredPets.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nome} ({p.especie}){p.tutor_nome ? ` — Tutor: ${p.tutor_nome}` : ''}
                </option>
              ))
            )}
          </select>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setPetModalOpen(true)}
            className="gap-1.5 text-xs"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            Novo Pet
          </Button>

          {selectedPet ? (
            <Button asChild variant="secondary" size="sm" className="gap-1.5 text-xs">
              <Link to={linkReceituario}>
                <Stethoscope className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                Fazer receita
              </Link>
            </Button>
          ) : null}
        </div>
      </header>

      {/* Resumo do Paciente e do Prontuário Ativo (Seção 3.1 e 3.9) */}
      {selectedPet ? (
        <Card className="border-border/80 bg-muted/20 shadow-sm">
          <CardContent className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20 shrink-0">
                <PawPrint className="h-6 w-6" aria-hidden="true" />
              </div>
              <div className="space-y-0.5">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-base font-black text-foreground">{selectedPet.nome}</h2>
                  <Badge variant="secondary" className="text-[10px] uppercase">
                    {selectedPet.especie}
                  </Badge>
                  {selectedPet.raca ? (
                    <Badge variant="outline" className="text-[10px]">
                      {selectedPet.raca}
                    </Badge>
                  ) : null}
                </div>
                <p className="text-xs text-muted-foreground flex flex-wrap items-center gap-3">
                  <span className="inline-flex items-center gap-1">
                    <User className="h-3 w-3" aria-hidden="true" />
                    Tutor: <strong>{selectedPet.tutor_nome || 'Não vinculado'}</strong>
                  </span>
                  <span>
                    Peso:{' '}
                    <strong>
                      {currentRecord?.peso_atual ?? selectedPet.peso ?? '—'} kg
                    </strong>
                  </span>
                  {currentRecord?.temperatura != null ? (
                    <span>
                      Temp: <strong>{currentRecord.temperatura} °C</strong>
                    </span>
                  ) : null}
                  {currentRecord?.frequencia_cardiaca != null ? (
                    <span>
                      FC: <strong>{currentRecord.frequencia_cardiaca} bpm</strong>
                    </span>
                  ) : null}
                  {currentRecord?.frequencia_respiratoria != null ? (
                    <span>
                      FR: <strong>{currentRecord.frequencia_respiratoria} mpm</strong>
                    </span>
                  ) : null}
                </p>
              </div>
            </div>

            {currentRecord ? (
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <Badge
                  variant={currentRecord.status === 'em_andamento' ? 'default' : 'secondary'}
                  className="text-[11px]"
                >
                  {ROTULO_STATUS_PRONTUARIO[currentRecord.status || 'em_andamento'] ?? currentRecord.status}
                </Badge>
                {currentRecord.confirmado_em ? (
                  <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 border border-emerald-500/25 px-2.5 py-1 text-[11px] font-medium text-emerald-700 dark:text-emerald-300">
                    <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                    Confirmado em {new Date(currentRecord.confirmado_em).toLocaleString('pt-BR')}
                  </span>
                ) : null}
                {currentRecord.assinatura_digital ? (
                  <span
                    className="inline-flex items-center gap-1 rounded-md bg-muted border border-border px-2 py-1 font-mono text-[11px] text-muted-foreground"
                    title={`Código de integridade (SHA-256): ${currentRecord.assinatura_digital}`}
                  >
                    <Hash className="h-3 w-3 text-primary" aria-hidden="true" />
                    {currentRecord.assinatura_digital.slice(0, 12)}…
                  </span>
                ) : null}
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {/* Abas do Módulo */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-2 lg:grid-cols-4 h-auto gap-1 p-1">
          <TabsTrigger value="ia" className="gap-1.5 text-sm py-2">
            <Mic className="h-4 w-4" aria-hidden="true" />
            Gravar consulta
          </TabsTrigger>
          <TabsTrigger value="ficha" className="gap-1.5 text-sm py-2">
            <ClipboardList className="h-4 w-4" aria-hidden="true" />
            Ficha e histórico ({prontuarios.length})
          </TabsTrigger>
          <TabsTrigger value="internacao" className="gap-1.5 text-sm py-2">
            <BedDouble className="h-4 w-4" aria-hidden="true" />
            Internação
          </TabsTrigger>
          <TabsTrigger value="config" className="gap-1.5 text-sm py-2">
            <Settings className="h-4 w-4" aria-hidden="true" />
            Configurações
          </TabsTrigger>
        </TabsList>

        {/* ABA 1: Painel Agnóstico de Gravação e Revisão IA */}
        <TabsContent value="ia" className="mt-0">
          <ProntuarioIaPanel
            petId={selectedPetId || null}
            recordId={currentRecord?.id ?? null}
            anexos={currentRecord?.anexos ?? []}
            config={config}
            consentAlreadyRegistered={consentimentos.length > 0}
            onRegisterConsent={handleRegisterConsent}
            onCommitted={() => {
              if (selectedPetId) void recarregarDadosDoPet(selectedPetId);
            }}
            onAnexoUploaded={() => {
              if (selectedPetId) void recarregarDadosDoPet(selectedPetId);
            }}
            onEliminateAudioTranscript={handleEliminateAudioTranscript}
          />
        </TabsContent>

        {/* ABA 2: Ficha Completa do Prontuário e Histórico */}
        <TabsContent value="ficha" className="mt-0 space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <aside className="lg:col-span-4 space-y-4">
              <Card>
                <CardHeader className="pb-3 flex flex-row items-center justify-between">
                  <CardTitle className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
                    <History className="h-4 w-4 text-primary" aria-hidden="true" />
                    Consultas do Pet
                  </CardTitle>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs gap-1"
                    disabled={!selectedPetId}
                    onClick={() => void handleNovaConsulta()}
                    title="Abre a consulta em andamento ou cria uma nova"
                  >
                    <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                    Nova consulta
                  </Button>
                </CardHeader>
                <CardContent className="space-y-2">
                  {prontuarios.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-2">
                      Nenhuma consulta registrada para este pet.
                    </p>
                  ) : null}
                  {prontuarios.map((rec) => (
                    <button
                      key={rec.id}
                      type="button"
                      onClick={() => setSelectedRecordId(rec.id)}
                      className={`w-full text-left rounded-md border p-3 transition-colors space-y-1 ${
                        currentRecord?.id === rec.id
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:bg-muted/50'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold">{rec.motivo_consulta}</span>
                        <Badge variant="outline" className="text-[11px]">
                          {ROTULO_STATUS_PRONTUARIO[rec.status || 'em_andamento'] ?? rec.status}
                        </Badge>
                      </div>
                      <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" aria-hidden="true" />
                        {new Date(rec.data_consulta).toLocaleString('pt-BR')}
                      </p>
                    </button>
                  ))}
                </CardContent>
              </Card>
            </aside>

            <main className="lg:col-span-8">
              {currentRecord ? (
                <Card>
                  <CardHeader className="pb-4">
                    <CardTitle className="text-sm font-bold">
                      Consulta de {new Date(currentRecord.data_consulta).toLocaleDateString('pt-BR')}
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Ajuste o que precisar e salve. Ao salvar, o registro recebe data, hora e um
                      código de integridade.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs">Motivo da consulta</Label>
                        <Input
                          value={fichaForm.motivo_consulta}
                          onChange={(e) =>
                            setFichaForm({ ...fichaForm, motivo_consulta: e.target.value })
                          }
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Tipo de atendimento</Label>
                        <select
                          className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-xs"
                          value={fichaForm.tipo_atendimento ?? 'consulta'}
                          onChange={(e) =>
                            setFichaForm({
                              ...fichaForm,
                              tipo_atendimento: e.target
                                .value as MedicalRecord['tipo_atendimento'],
                            })
                          }
                        >
                          <option value="consulta">Consulta</option>
                          <option value="cirurgia">Cirurgia</option>
                          <option value="internacao">Internação</option>
                          <option value="emergencia">Emergência</option>
                        </select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Status do prontuário</Label>
                        <select
                          className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-xs"
                          value={fichaForm.status ?? 'em_andamento'}
                          onChange={(e) =>
                            setFichaForm({
                              ...fichaForm,
                              status: e.target.value as MedicalRecord['status'],
                            })
                          }
                        >
                          <option value="em_andamento">Em andamento</option>
                          <option value="finalizado">Finalizado</option>
                          <option value="alta">Alta</option>
                          <option value="obito">Óbito</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs">Veterinário responsável</Label>
                        <Input
                          value={fichaForm.veterinario}
                          onChange={(e) =>
                            setFichaForm({ ...fichaForm, veterinario: e.target.value })
                          }
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">CRMV responsável</Label>
                        <Input
                          value={fichaForm.crmv_responsavel}
                          onChange={(e) =>
                            setFichaForm({ ...fichaForm, crmv_responsavel: e.target.value })
                          }
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-2">
                      <div className="space-y-1">
                        <Label className="text-xs">Peso (kg)</Label>
                        <Input
                          type="number"
                          step="0.1"
                          value={fichaForm.exame_fisico.peso ?? ''}
                          onChange={(e) =>
                            setFichaForm({
                              ...fichaForm,
                              exame_fisico: {
                                ...fichaForm.exame_fisico,
                                peso: e.target.value ? Number(e.target.value) : undefined,
                              },
                            })
                          }
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Temperatura (°C)</Label>
                        <Input
                          type="number"
                          step="0.1"
                          value={fichaForm.exame_fisico.temperatura ?? ''}
                          onChange={(e) =>
                            setFichaForm({
                              ...fichaForm,
                              exame_fisico: {
                                ...fichaForm.exame_fisico,
                                temperatura: e.target.value ? Number(e.target.value) : undefined,
                              },
                            })
                          }
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">FC (bpm)</Label>
                        <Input
                          type="number"
                          value={fichaForm.exame_fisico.fc ?? ''}
                          onChange={(e) =>
                            setFichaForm({
                              ...fichaForm,
                              exame_fisico: {
                                ...fichaForm.exame_fisico,
                                fc: e.target.value ? Number(e.target.value) : undefined,
                              },
                            })
                          }
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">FR (mpm)</Label>
                        <Input
                          type="number"
                          value={fichaForm.exame_fisico.fr ?? ''}
                          onChange={(e) =>
                            setFichaForm({
                              ...fichaForm,
                              exame_fisico: {
                                ...fichaForm.exame_fisico,
                                fr: e.target.value ? Number(e.target.value) : undefined,
                              },
                            })
                          }
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs">Queixa principal (Anamnese)</Label>
                      <Textarea
                        rows={2}
                        value={fichaForm.anamnese.queixa_principal ?? ''}
                        onChange={(e) =>
                          setFichaForm({
                            ...fichaForm,
                            anamnese: {
                              ...fichaForm.anamnese,
                              queixa_principal: e.target.value,
                            },
                          })
                        }
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs">Diagnóstico definitivo</Label>
                        <Input
                          value={fichaForm.diagnostico_definitivo}
                          onChange={(e) =>
                            setFichaForm({
                              ...fichaForm,
                              diagnostico_definitivo: e.target.value,
                            })
                          }
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">CID-Vet</Label>
                        <Input
                          value={fichaForm.cid_vet}
                          onChange={(e) =>
                            setFichaForm({ ...fichaForm, cid_vet: e.target.value })
                          }
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs">Tratamento</Label>
                        <Textarea
                          rows={2}
                          value={fichaForm.tratamento}
                          onChange={(e) =>
                            setFichaForm({ ...fichaForm, tratamento: e.target.value })
                          }
                        />
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <Label className="text-xs">Medicamentos</Label>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-6 text-[11px] gap-1 px-2 border-primary/30 text-primary hover:bg-primary/10"
                            onClick={() => setBularioDialogOpen(true)}
                          >
                            <Pill className="h-3 w-3" />
                            Consultar Bulário & Prescrever
                          </Button>
                        </div>
                        <Textarea
                          rows={2}
                          value={fichaForm.medicamentos}
                          onChange={(e) =>
                            setFichaForm({ ...fichaForm, medicamentos: e.target.value })
                          }
                        />
                      </div>
                    </div>

                    <div className="flex justify-end pt-2">
                      <Button
                        type="button"
                        onClick={handleSaveFicha}
                        disabled={savingFicha}
                        className="gap-2 font-bold"
                      >
                        <Save className="h-4 w-4" aria-hidden="true" />
                        {savingFicha ? 'Salvando…' : 'Salvar prontuário'}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card className="border-dashed shadow-none">
                  <CardContent className="flex flex-col items-center justify-center gap-3 py-14 text-center">
                    <ClipboardList className="h-9 w-9 text-muted-foreground/60" aria-hidden="true" />
                    <p className="text-sm font-semibold text-foreground">
                      {selectedPet ? `${selectedPet.nome} ainda não tem consulta aberta` : 'Selecione um pet'}
                    </p>
                    <p className="text-xs text-muted-foreground max-w-sm">
                      Grave a consulta na aba “Gravar consulta” ou abra uma consulta para preencher à mão.
                    </p>
                    {selectedPet ? (
                      <Button type="button" size="sm" onClick={() => void handleNovaConsulta()} className="gap-1.5">
                        <Plus className="h-4 w-4" aria-hidden="true" />
                        Nova consulta
                      </Button>
                    ) : null}
                  </CardContent>
                </Card>
              )}
            </main>
          </div>
        </TabsContent>

        {/* ABA 3: Internação e Timeline de Monitoramento (Seções 3.2 e 3.3) */}
        <TabsContent value="internacao" className="mt-0 space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <aside className="lg:col-span-4 space-y-4">
              <Card className="border-primary/20 bg-primary/5">
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-2">
                    <Activity className="h-4 w-4" aria-hidden="true" />
                    Parâmetros de Referência ({selectedPet?.especie === 'felina' ? 'Felinos' : 'Caninos'})
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-xs">
                  <div className="flex justify-between border-b border-primary/10 pb-1.5">
                    <span className="text-muted-foreground">Temperatura</span>
                    <span className="font-semibold">37.8 – 39.2 °C</span>
                  </div>
                  <div className="flex justify-between border-b border-primary/10 pb-1.5">
                    <span className="text-muted-foreground">Freq. Cardíaca (FC)</span>
                    <span className="font-semibold">
                      {selectedPet?.especie === 'felina' ? '120 – 220 bpm' : '70 – 160 bpm'}
                    </span>
                  </div>
                  <div className="flex justify-between border-b border-primary/10 pb-1.5">
                    <span className="text-muted-foreground">Freq. Respiratória (FR)</span>
                    <span className="font-semibold">18 – 36 mpm</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Pressão Sistólica (PA)</span>
                    <span className="font-semibold">120 – 140 mmHg</span>
                  </div>
                </CardContent>
              </Card>
            </aside>

            <main className="lg:col-span-8 space-y-6">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-bold flex items-center gap-2">
                    <BedDouble className="h-4 w-4 text-primary" aria-hidden="true" />
                    Ficha de internação
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Motivo da internação</Label>
                      <Input
                        value={internacaoForm.motivo}
                        onChange={(e) =>
                          setInternacaoForm({ ...internacaoForm, motivo: e.target.value })
                        }
                        placeholder="Ex.: Fluidoterapia, pós-operatório..."
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Box</Label>
                      <Input
                        value={internacaoForm.box}
                        onChange={(e) =>
                          setInternacaoForm({ ...internacaoForm, box: e.target.value })
                        }
                        placeholder="Ex.: Box 01 - Canil"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Situação</Label>
                      <select
                        className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-xs"
                        value={internacaoForm.status}
                        onChange={(e) =>
                          setInternacaoForm({
                            ...internacaoForm,
                            status: e.target.value as Internacao['status'],
                          })
                        }
                      >
                        <option value="internado">Internado</option>
                        <option value="alta">Alta</option>
                        <option value="obito">Óbito</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Sintomas na entrada</Label>
                      <Textarea
                        rows={2}
                        value={internacaoForm.sintomas_entrada}
                        onChange={(e) =>
                          setInternacaoForm({
                            ...internacaoForm,
                            sintomas_entrada: e.target.value,
                          })
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Alergias (uma por linha)</Label>
                      <Textarea
                        rows={2}
                        value={internacaoForm.alergiasText}
                        onChange={(e) =>
                          setInternacaoForm({ ...internacaoForm, alergiasText: e.target.value })
                        }
                      />
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <Button
                      type="button"
                      onClick={handleSaveInternacao}
                      disabled={savingInternacao || !selectedPetId}
                      className="gap-2 font-bold"
                    >
                      <Save className="h-4 w-4" aria-hidden="true" />
                      {internacao ? 'Atualizar Internação' : 'Registrar Internação'}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {internacao ? (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-bold">
                      Evolução da internação
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-6 gap-2 rounded-lg border border-border bg-muted/30 p-3">
                      <div className="md:col-span-2">
                        <Label className="text-[11px]">Tipo</Label>
                        <select
                          className="flex h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
                          value={novoEvento.tipo}
                          onChange={(e) =>
                            setNovoEvento({
                              ...novoEvento,
                              tipo: e.target.value as InternacaoEventoTipo,
                            })
                          }
                        >
                          <option value="evolucao">Evolução</option>
                          <option value="medicamento">Medicamento</option>
                          <option value="monitoramento">Monitoramento</option>
                          <option value="checkin">Check-in</option>
                          <option value="alta">Alta</option>
                        </select>
                      </div>
                      <div className="md:col-span-4">
                        <Label className="text-[11px]">Descrição</Label>
                        <Input
                          className="h-8 text-xs"
                          value={novoEvento.descricao}
                          onChange={(e) =>
                            setNovoEvento({ ...novoEvento, descricao: e.target.value })
                          }
                          placeholder="Ex.: Dipirona 25mg/kg IV, paciente calmo"
                        />
                      </div>
                      <div>
                        <Label className="text-[11px]">Temp (°C)</Label>
                        <Input
                          type="number"
                          step="0.1"
                          className="h-8 text-xs"
                          value={novoEvento.temperatura}
                          onChange={(e) =>
                            setNovoEvento({ ...novoEvento, temperatura: e.target.value })
                          }
                        />
                      </div>
                      <div>
                        <Label className="text-[11px]">FC (bpm)</Label>
                        <Input
                          type="number"
                          className="h-8 text-xs"
                          value={novoEvento.frequencia_cardiaca}
                          onChange={(e) =>
                            setNovoEvento({ ...novoEvento, frequencia_cardiaca: e.target.value })
                          }
                        />
                      </div>
                      <div>
                        <Label className="text-[11px]">FR (mpm)</Label>
                        <Input
                          type="number"
                          className="h-8 text-xs"
                          value={novoEvento.frequencia_respiratoria}
                          onChange={(e) =>
                            setNovoEvento({
                              ...novoEvento,
                              frequencia_respiratoria: e.target.value,
                            })
                          }
                        />
                      </div>
                      <div>
                        <Label className="text-[11px]">PA (mmHg)</Label>
                        <Input
                          type="number"
                          className="h-8 text-xs"
                          value={novoEvento.pressao_sistolica}
                          onChange={(e) =>
                            setNovoEvento({ ...novoEvento, pressao_sistolica: e.target.value })
                          }
                        />
                      </div>
                      <div className="md:col-span-2 flex items-end">
                        <Button
                          type="button"
                          size="sm"
                          onClick={handleAddEventoInternacao}
                          className="w-full h-8 text-xs gap-1"
                        >
                          <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                          Adicionar evento
                        </Button>
                      </div>
                    </div>

                    {eventosInternacao.length === 0 ? (
                      <p className="text-xs text-muted-foreground py-4 text-center">
                        Nenhum evento registrado nesta internação.
                      </p>
                    ) : (
                      <ul className="space-y-2">
                        {eventosInternacao.map((ev) => (
                          <li
                            key={ev.id}
                            className="rounded-md border border-border p-3 text-xs space-y-1"
                          >
                            <div className="flex items-center justify-between">
                              <Badge variant="outline" className="text-[11px]">
                                {ROTULO_EVENTO_INTERNACAO[ev.tipo] ?? ev.tipo}
                              </Badge>
                              <span className="text-[11px] text-muted-foreground">
                                {new Date(ev.horario).toLocaleString('pt-BR')}
                              </span>
                            </div>
                            {ev.descricao ? <p className="font-medium">{ev.descricao}</p> : null}
                            <div className="flex flex-wrap gap-3 text-[11px] text-muted-foreground">
                              {ev.temperatura != null && <span>Temp: {ev.temperatura}°C</span>}
                              {ev.frequencia_cardiaca != null && (
                                <span>FC: {ev.frequencia_cardiaca} bpm</span>
                              )}
                              {ev.frequencia_respiratoria != null && (
                                <span>FR: {ev.frequencia_respiratoria} mpm</span>
                              )}
                              {ev.pressao_sistolica != null && (
                                <span>PA: {ev.pressao_sistolica} mmHg</span>
                              )}
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </CardContent>
                </Card>
              ) : null}
            </main>
          </div>
        </TabsContent>

        {/* ABA 4: Configuração Single-Tenant da IA (Seção 3.10) e Controles LGPD (Seção 7.2) */}
        <TabsContent value="config" className="mt-0 space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-7">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-bold flex items-center gap-2">
                    <Settings className="h-4 w-4 text-primary" aria-hidden="true" />
                    Veterinário responsável
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Nome e CRMV usados ao salvar prontuários. A IA roda no Supabase com a chave da
                    OpenAI já cadastrada no painel; não há nada para conectar aqui.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <Label htmlFor="pia-cfg-vet" className="text-xs">Nome do veterinário</Label>
                      <Input
                        id="pia-cfg-vet"
                        value={configForm.veterinario_nome}
                        onChange={(e) =>
                          setConfigForm({ ...configForm, veterinario_nome: e.target.value })
                        }
                        placeholder="Ex.: Dra. Ana Souza"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="pia-cfg-crmv" className="text-xs">CRMV</Label>
                      <Input
                        id="pia-cfg-crmv"
                        value={configForm.crmv_responsavel}
                        onChange={(e) =>
                          setConfigForm({ ...configForm, crmv_responsavel: e.target.value })
                        }
                        placeholder="Ex.: CRMV-PR 00000"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="pia-cfg-retencao" className="text-xs">Guardar áudios por (dias)</Label>
                      <Input
                        id="pia-cfg-retencao"
                        type="number"
                        min="1"
                        value={configForm.retencao_dias}
                        onChange={(e) =>
                          setConfigForm({ ...configForm, retencao_dias: e.target.value })
                        }
                      />
                    </div>
                  </div>

                  <details className="rounded-md border border-border p-3 text-xs">
                    <summary className="cursor-pointer font-semibold text-foreground">
                      Avançado: instruções da IA
                    </summary>
                    <div className="mt-3 space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <Label htmlFor="pia-cfg-prompt" className="text-xs text-muted-foreground">
                          Deixe em branco para usar o padrão.
                        </Label>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            setConfigForm({
                              ...configForm,
                              system_prompt: DEFAULT_PRONTUARIO_IA_SYSTEM_PROMPT,
                            })
                          }
                          className="h-7 px-2 text-[11px] gap-1"
                        >
                          <RotateCcw className="h-3 w-3" aria-hidden="true" />
                          Restaurar padrão
                        </Button>
                      </div>
                      <Textarea
                        id="pia-cfg-prompt"
                        rows={10}
                        value={configForm.system_prompt}
                        onChange={(e) =>
                          setConfigForm({ ...configForm, system_prompt: e.target.value })
                        }
                        placeholder={DEFAULT_PRONTUARIO_IA_SYSTEM_PROMPT}
                        className="font-mono text-xs"
                      />
                    </div>
                  </details>

                  <div className="flex justify-end">
                    <Button
                      type="button"
                      onClick={handleSaveConfig}
                      disabled={savingConfig}
                      className="gap-2 font-bold"
                    >
                      <Save className="h-4 w-4" aria-hidden="true" />
                      {savingConfig ? 'Salvando…' : 'Salvar Configuração'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="lg:col-span-5 space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-bold flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-emerald-600" aria-hidden="true" />
                    Privacidade (LGPD)
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleExportTutorData}
                    disabled={!selectedPetId}
                    className="w-full justify-start gap-2 text-xs"
                  >
                    <Download className="h-4 w-4 text-primary" aria-hidden="true" />
                    Exportar dados deste pet para o tutor (JSON)
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleRunRetentionPurge}
                    className="w-full justify-start gap-2 text-xs"
                  >
                    <Trash2 className="h-4 w-4 text-amber-600" aria-hidden="true" />
                    Apagar áudios com mais de {configForm.retencao_dias || 90} dias
                  </Button>

                  <div className="pt-2 border-t border-border space-y-2">
                    <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Autorizações do tutor para este pet ({consentimentos.length})
                    </p>
                    {consentimentos.length === 0 ? (
                      <p className="text-xs text-muted-foreground">
                        O tutor ainda não autorizou gravação para este pet.
                      </p>
                    ) : (
                      <ul className="space-y-1.5 text-xs">
                        {consentimentos.map((c) => (
                          <li
                            key={c.id}
                            className="rounded border border-border bg-muted/30 p-2 space-y-0.5"
                          >
                            <p className="font-semibold text-foreground">{c.texto_versao}</p>
                            <p className="text-[11px] text-muted-foreground">
                              Aceito em {new Date(c.aceito_em).toLocaleString('pt-BR')} ·{' '}
                              {c.operadores_informados}
                            </p>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Dialog para cadastro rápido de Pet */}
      <Dialog open={petModalOpen} onOpenChange={setPetModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cadastrar Paciente (Pet)</DialogTitle>
            <DialogDescription>
              Cadastre o pet e o tutor responsável.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Nome do Pet *</Label>
                <Input
                  value={novoPet.nome}
                  onChange={(e) => setNovoPet({ ...novoPet, nome: e.target.value })}
                  placeholder="Ex.: Mel"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Espécie</Label>
                <select
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-xs"
                  value={novoPet.especie}
                  onChange={(e) => setNovoPet({ ...novoPet, especie: e.target.value })}
                >
                  <option value="canina">Canina</option>
                  <option value="felina">Felina</option>
                  <option value="silvestre">Silvestre</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Raça</Label>
                <Input
                  value={novoPet.raca}
                  onChange={(e) => setNovoPet({ ...novoPet, raca: e.target.value })}
                  placeholder="SRD"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Peso (kg)</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={novoPet.peso}
                  onChange={(e) => setNovoPet({ ...novoPet, peso: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Idade (anos)</Label>
                <Input
                  type="number"
                  value={novoPet.idade}
                  onChange={(e) => setNovoPet({ ...novoPet, idade: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Nome do Tutor</Label>
                <Input
                  value={novoPet.tutor_nome}
                  onChange={(e) => setNovoPet({ ...novoPet, tutor_nome: e.target.value })}
                  placeholder="Nome completo"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">WhatsApp do tutor</Label>
                <Input
                  value={novoPet.tutor_telefone}
                  onChange={(e) => setNovoPet({ ...novoPet, tutor_telefone: e.target.value })}
                  placeholder="5541999990000"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPetModalOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreatePet} disabled={savingPet}>
              {savingPet ? 'Salvando…' : 'Salvar Pet'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <BularioProntuarioDialog
        aberto={bularioDialogOpen}
        onOpenChange={setBularioDialogOpen}
        paciente={{
          nome: selectedPet?.nome || 'Paciente',
          especie: (selectedPet?.especie as any) || 'canina',
          raca: selectedPet?.raca || null,
          peso_kg: currentRecord?.peso_atual || (selectedPet as any)?.peso || null,
          tutor_nome: selectedPet?.tutor_nome || null,
          tutor_telefone: selectedPet?.tutor_telefone || null,
          veterinario: fichaForm.veterinario || null,
        }}
        onInserirNoProntuario={handleInserirMedicamentoDoBulario}
      />
    </div>
  );
}
