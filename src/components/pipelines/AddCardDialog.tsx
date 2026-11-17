import React, { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Check,
  Dog,
  Phone,
  Search,
  Sparkles,
  UserCheck,
  UserPlus,
  Users,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import {
  CARD_ORIGEM_LABELS,
  CARD_PRIORIDADE_LABELS,
  CardOrigem,
  CardPrioridade,
  CrmPipelineStage,
  SERVICOS_SUGERIDOS,
} from '@/types/pipeline';
import { Atendente } from '@/types/atendimento';
import { Tag } from '@/types/crm';
import { CreateCardInput } from '@/hooks/usePipelines';

interface ClientCandidate {
  id: number;
  nome: string;
  telefone: string | null;
  email: string | null;
  nomePet: string | null;
  racaPet: string | null;
  portePet: string | null;
  sessionId: string | null;
}

interface AddCardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pipelineId: string;
  pipelineNome: string;
  stages: CrmPipelineStage[];
  defaultStageId?: string | null;
  atendentes: Atendente[];
  tags: Tag[];
  existingClientIdsInPipeline: Set<number>;
  onCreateCard: (input: CreateCardInput) => Promise<unknown>;
  onImportBatch: (input: {
    pipelineId: string;
    stageId: string;
    origem: CardOrigem;
    campanha?: string | null;
    servicoInteresse?: string | null;
    valorEstimado?: number;
    prioridade?: CardPrioridade;
    atendenteId?: number | null;
    contatos: Array<{
      clientId?: number | null;
      sessionId?: string | null;
      nomeContato: string;
      telefone?: string | null;
      email?: string | null;
      nomePet?: string | null;
      racaPet?: string | null;
      portePet?: string | null;
    }>;
  }) => Promise<unknown>;
  isSubmitting?: boolean;
}

export const AddCardDialog: React.FC<AddCardDialogProps> = ({
  open,
  onOpenChange,
  pipelineId,
  pipelineNome,
  stages,
  defaultStageId,
  atendentes,
  tags,
  existingClientIdsInPipeline,
  onCreateCard,
  onImportBatch,
  isSubmitting = false,
}) => {
  const [tab, setTab] = useState<'single' | 'batch'>('single');

  // Single card state
  const [stageId, setStageId] = useState('');
  const [clientSearch, setClientSearch] = useState('');
  const [searchingClients, setSearchingClients] = useState(false);
  const [searchResults, setSearchResults] = useState<ClientCandidate[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<number | null>(null);
  const [sessionId, setSessionId] = useState<string>('');
  const [nomeContato, setNomeContato] = useState('');
  const [telefone, setTelefone] = useState('');
  const [email, setEmail] = useState('');
  const [nomePet, setNomePet] = useState('');
  const [especiePet, setEspeciePet] = useState('');
  const [racaPet, setRacaPet] = useState('');
  const [portePet, setPortePet] = useState('');
  const [servicoInteresse, setServicoInteresse] = useState('');
  const [valorEstimado, setValorEstimado] = useState('');
  const [prioridade, setPrioridade] = useState<CardPrioridade>('media');
  const [origem, setOrigem] = useState<CardOrigem>('whatsapp');
  const [campanha, setCampanha] = useState('');
  const [atendenteId, setAtendenteId] = useState<string>('none');
  const [proximaAcao, setProximaAcao] = useState('');
  const [proximaAcaoEm, setProximaAcaoEm] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [criarClienteNaBase, setCriarClienteNaBase] = useState(true);

  // Batch import state
  const [batchSearch, setBatchSearch] = useState('');
  const [batchTagId, setBatchTagId] = useState<string>('all');
  const [batchCandidates, setBatchCandidates] = useState<ClientCandidate[]>([]);
  const [batchLoading, setBatchLoading] = useState(false);
  const [selectedBatchIds, setSelectedBatchIds] = useState<Set<number>>(new Set());
  const [batchOrigem, setBatchOrigem] = useState<CardOrigem>('campanha');
  const [batchCampanha, setBatchCampanha] = useState('');
  const [batchServico, setBatchServico] = useState('');
  const [batchValor, setBatchValor] = useState('');

  useEffect(() => {
    if (!open) return;
    const firstStage = defaultStageId || stages[0]?.id || '';
    setStageId(firstStage);
    setClientSearch('');
    setSearchResults([]);
    setSelectedClientId(null);
    setSessionId('');
    setNomeContato('');
    setTelefone('');
    setEmail('');
    setNomePet('');
    setEspeciePet('');
    setRacaPet('');
    setPortePet('');
    setServicoInteresse('');
    setValorEstimado('');
    setPrioridade('media');
    setOrigem('whatsapp');
    setCampanha('');
    setAtendenteId('none');
    setProximaAcao('');
    setProximaAcaoEm('');
    setObservacoes('');
    setCriarClienteNaBase(true);
    setSelectedBatchIds(new Set());
  }, [open, defaultStageId, stages]);

  // Busca rápida de clientes existentes para autocompletar
  useEffect(() => {
    if (!open || tab !== 'single') return;
    const clean = clientSearch.trim().replace(/[,()]/g, '');
    if (clean.length < 2) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setSearchingClients(true);
        const { data } = await supabase
          .from('dados_cliente')
          .select('id, nome, telefone, email, nome_pet, raca_pet, porte_pet, sessionid')
          .or(
            `nome.ilike.%${clean}%,telefone.ilike.%${clean}%,nome_pet.ilike.%${clean}%,email.ilike.%${clean}%`
          )
          .order('id', { ascending: false })
          .limit(8);

        setSearchResults(
          (data || []).map((row) => ({
            id: row.id,
            nome: row.nome || 'Cliente sem nome',
            telefone: row.telefone,
            email: row.email,
            nomePet: row.nome_pet,
            racaPet: row.raca_pet,
            portePet: row.porte_pet,
            sessionId: row.sessionid,
          }))
        );
      } catch {
        setSearchResults([]);
      } finally {
        setSearchingClients(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [clientSearch, open, tab]);

  // Busca clientes para importação em lote
  useEffect(() => {
    if (!open || tab !== 'batch') return;

    const loadBatch = async () => {
      try {
        setBatchLoading(true);
        let clientIdsFilter: number[] | null = null;
        if (batchTagId !== 'all') {
          const tagNum = parseInt(batchTagId, 10);
          if (!Number.isNaN(tagNum)) {
            const { data: tagRows } = await supabase
              .from('client_tags')
              .select('client_id')
              .eq('tag_id', tagNum);
            clientIdsFilter = (tagRows || []).map((r) => r.client_id);
          }
        }

        let query = supabase
          .from('dados_cliente')
          .select('id, nome, telefone, email, nome_pet, raca_pet, porte_pet, sessionid')
          .order('id', { ascending: false })
          .limit(60);

        if (clientIdsFilter !== null) {
          if (clientIdsFilter.length === 0) {
            setBatchCandidates([]);
            setBatchLoading(false);
            return;
          }
          query = query.in('id', clientIdsFilter);
        }

        const clean = batchSearch.trim().replace(/[,()]/g, '');
        if (clean) {
          query = query.or(
            `nome.ilike.%${clean}%,telefone.ilike.%${clean}%,nome_pet.ilike.%${clean}%,raca_pet.ilike.%${clean}%`
          );
        }

        const { data } = await query;
        setBatchCandidates(
          (data || []).map((row) => ({
            id: row.id,
            nome: row.nome || 'Cliente sem nome',
            telefone: row.telefone,
            email: row.email,
            nomePet: row.nome_pet,
            racaPet: row.raca_pet,
            portePet: row.porte_pet,
            sessionId: row.sessionid,
          }))
        );
      } catch {
        setBatchCandidates([]);
      } finally {
        setBatchLoading(false);
      }
    };

    const timer = setTimeout(loadBatch, 250);
    return () => clearTimeout(timer);
  }, [open, tab, batchSearch, batchTagId]);

  const handleSelectCandidate = (c: ClientCandidate) => {
    setSelectedClientId(c.id);
    setNomeContato(c.nome);
    setTelefone(c.telefone || '');
    setEmail(c.email || '');
    setNomePet(c.nomePet || '');
    setRacaPet(c.racaPet || '');
    setPortePet(c.portePet || '');
    setSessionId(c.sessionId || c.telefone?.replace(/\D/g, '') || '');
    setClientSearch('');
    setSearchResults([]);
  };

  const handleSubmitSingle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nomeContato.trim() || !stageId) return;

    const valorNum = parseFloat(valorEstimado.replace(',', '.'));
    await onCreateCard({
      pipelineId,
      stageId,
      clientId: selectedClientId,
      sessionId: sessionId.trim() || telefone.replace(/\D/g, '') || null,
      titulo: nomeContato.trim(),
      nomeContato: nomeContato.trim(),
      telefone: telefone.trim() || null,
      email: email.trim() || null,
      nomePet: nomePet.trim() || null,
      especiePet: especiePet.trim() || null,
      racaPet: racaPet.trim() || null,
      portePet: portePet.trim() || null,
      servicoInteresse: servicoInteresse.trim() || null,
      valorEstimado: !Number.isNaN(valorNum) && valorNum >= 0 ? valorNum : 0,
      prioridade,
      origem,
      campanha: campanha.trim() || null,
      atendenteId: atendenteId !== 'none' ? parseInt(atendenteId, 10) : null,
      proximaAcao: proximaAcao.trim() || null,
      proximaAcaoEm: proximaAcaoEm ? new Date(proximaAcaoEm).toISOString() : null,
      observacoes: observacoes.trim() || null,
      criarClienteNaBase: !selectedClientId && criarClienteNaBase,
    });
    onOpenChange(false);
  };

  const toggleBatchCandidate = (id: number) => {
    setSelectedBatchIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAllBatch = () => {
    const available = batchCandidates.filter((c) => !existingClientIdsInPipeline.has(c.id));
    if (selectedBatchIds.size >= available.length && available.length > 0) {
      setSelectedBatchIds(new Set());
    } else {
      setSelectedBatchIds(new Set(available.map((c) => c.id)));
    }
  };

  const handleSubmitBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedBatchIds.size === 0 || !stageId) return;
    const chosen = batchCandidates.filter((c) => selectedBatchIds.has(c.id));
    const valorNum = parseFloat(batchValor.replace(',', '.'));

    await onImportBatch({
      pipelineId,
      stageId,
      origem: batchOrigem,
      campanha: batchCampanha.trim() || null,
      servicoInteresse: batchServico.trim() || null,
      valorEstimado: !Number.isNaN(valorNum) && valorNum >= 0 ? valorNum : 0,
      prioridade: 'media',
      atendenteId: atendenteId !== 'none' ? parseInt(atendenteId, 10) : null,
      contatos: chosen.map((c) => ({
        clientId: c.id,
        sessionId: c.sessionId || c.telefone?.replace(/\D/g, '') || null,
        nomeContato: c.nome,
        telefone: c.telefone,
        email: c.email,
        nomePet: c.nomePet,
        racaPet: c.racaPet,
        portePet: c.portePet,
      })),
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-primary" />
            Adicionar ao Pipeline — {pipelineNome}
          </DialogTitle>
          <DialogDescription>
            Vincule um cliente existente da clínica, cadastre um novo lead ou importe contatos em
            lote para campanhas de marketing.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={(v) => setTab(v as 'single' | 'batch')}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="single" className="gap-1.5">
              <UserPlus className="h-4 w-4" />
              Contato Individual / Novo Lead
            </TabsTrigger>
            <TabsTrigger value="batch" className="gap-1.5">
              <Users className="h-4 w-4" />
              Importar da Base em Lote
            </TabsTrigger>
          </TabsList>

          {/* ABA 1: INDIVIDUAL */}
          <TabsContent value="single" className="mt-4">
            <form onSubmit={handleSubmitSingle} className="space-y-4">
              {/* Busca na base de clientes */}
              <div className="rounded-lg border bg-muted/40 p-3 space-y-2">
                <Label className="text-xs font-semibold flex items-center gap-1.5">
                  <Search className="h-3.5 w-3.5 text-primary" />
                  Buscar cliente já cadastrado na clínica (opcional)
                </Label>
                <div className="relative">
                  <Input
                    value={clientSearch}
                    onChange={(e) => setClientSearch(e.target.value)}
                    placeholder="Digite nome do tutor, nome do pet ou telefone..."
                    className="h-9 text-xs bg-background"
                  />
                  {searchingClients && (
                    <span className="absolute right-3 top-2.5 text-[11px] text-muted-foreground">
                      Buscando...
                    </span>
                  )}
                </div>

                {searchResults.length > 0 && (
                  <div className="max-h-40 overflow-y-auto rounded-md border bg-card divide-y">
                    {searchResults.map((cand) => (
                      <button
                        key={cand.id}
                        type="button"
                        onClick={() => handleSelectCandidate(cand)}
                        className="flex w-full items-center justify-between px-3 py-2 text-left text-xs hover:bg-accent transition-colors"
                      >
                        <div>
                          <span className="font-semibold text-foreground">{cand.nome}</span>
                          {cand.nomePet && (
                            <span className="ml-2 text-primary font-medium">
                              🐾 {cand.nomePet} {cand.racaPet ? `(${cand.racaPet})` : ''}
                            </span>
                          )}
                          <div className="text-[11px] text-muted-foreground">
                            {cand.telefone || 'Sem telefone'} {cand.email ? `· ${cand.email}` : ''}
                          </div>
                        </div>
                        <span className="rounded bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                          Selecionar
                        </span>
                      </button>
                    ))}
                  </div>
                )}

                {selectedClientId && (
                  <div className="flex items-center justify-between rounded bg-primary/10 px-3 py-1.5 text-xs text-primary">
                    <span className="flex items-center gap-1.5 font-medium">
                      <UserCheck className="h-4 w-4" />
                      Vinculado ao cliente #{selectedClientId} ({nomeContato})
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-xs"
                      onClick={() => setSelectedClientId(null)}
                    >
                      Desvincular
                    </Button>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label htmlFor="card-nome" className="text-xs">
                    Nome do Contato / Tutor *
                  </Label>
                  <Input
                    id="card-nome"
                    value={nomeContato}
                    onChange={(e) => setNomeContato(e.target.value)}
                    placeholder="Ex.: Mariana Silva"
                    className="h-9 text-xs"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="card-telefone" className="text-xs">
                    WhatsApp / Telefone
                  </Label>
                  <Input
                    id="card-telefone"
                    value={telefone}
                    onChange={(e) => setTelefone(e.target.value)}
                    placeholder="Ex.: (61) 99999-0000"
                    className="h-9 text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="card-stage" className="text-xs">
                    Estágio Inicial *
                  </Label>
                  <Select value={stageId} onValueChange={setStageId}>
                    <SelectTrigger id="card-stage" className="h-9 text-xs">
                      <SelectValue placeholder="Selecione o estágio" />
                    </SelectTrigger>
                    <SelectContent>
                      {stages.map((st) => (
                        <SelectItem key={st.id} value={st.id} className="text-xs">
                          <span className="flex items-center gap-2">
                            <span
                              className="h-2 w-2 rounded-full"
                              style={{ backgroundColor: st.cor }}
                            />
                            {st.nome}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label htmlFor="card-email" className="text-xs">
                    Email
                  </Label>
                  <Input
                    id="card-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="cliente@email.com"
                    className="h-9 text-xs"
                  />
                </div>
              </div>

              {/* Dados do Pet */}
              <div className="rounded-lg border p-3 space-y-2.5">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                  <Dog className="h-4 w-4 text-primary" />
                  Dados do Pet
                </div>
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-4">
                  <div className="space-y-1">
                    <Label className="text-[11px]">Nome do Pet</Label>
                    <Input
                      value={nomePet}
                      onChange={(e) => setNomePet(e.target.value)}
                      placeholder="Ex.: Thor"
                      className="h-8 text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px]">Espécie</Label>
                    <Select
                      value={especiePet || 'none'}
                      onValueChange={(v) => setEspeciePet(v === 'none' ? '' : v)}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="Espécie" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Não informado</SelectItem>
                        <SelectItem value="Cão">Cão</SelectItem>
                        <SelectItem value="Gato">Gato</SelectItem>
                        <SelectItem value="Silvestre / Exótico">Silvestre / Exótico</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px]">Raça</Label>
                    <Input
                      value={racaPet}
                      onChange={(e) => setRacaPet(e.target.value)}
                      placeholder="Ex.: Golden, SRD..."
                      className="h-8 text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px]">Porte</Label>
                    <Select
                      value={portePet || 'none'}
                      onValueChange={(v) => setPortePet(v === 'none' ? '' : v)}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="Porte" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Não informado</SelectItem>
                        <SelectItem value="Pequeno">Pequeno</SelectItem>
                        <SelectItem value="Médio">Médio</SelectItem>
                        <SelectItem value="Grande">Grande</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Interesse, Origem e Atendimento */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="space-y-1 sm:col-span-2">
                  <Label className="text-xs">Serviço / Especialidade de Interesse</Label>
                  <Input
                    value={servicoInteresse}
                    onChange={(e) => setServicoInteresse(e.target.value)}
                    placeholder="Ex.: Consulta Clínica, Vacina V10, Castração..."
                    className="h-9 text-xs"
                  />
                  <div className="flex flex-wrap gap-1 pt-1">
                    {SERVICOS_SUGERIDOS.slice(0, 5).map((sug) => (
                      <button
                        key={sug}
                        type="button"
                        onClick={() => setServicoInteresse(sug)}
                        className="rounded-full border bg-muted/60 px-2 py-0.5 text-[10px] text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                      >
                        {sug}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Valor Estimado (R$)</Label>
                  <Input
                    value={valorEstimado}
                    onChange={(e) => setValorEstimado(e.target.value)}
                    placeholder="Ex.: 180,00"
                    className="h-9 text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Prioridade</Label>
                  <Select
                    value={prioridade}
                    onValueChange={(v) => setPrioridade(v as CardPrioridade)}
                  >
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(CARD_PRIORIDADE_LABELS) as CardPrioridade[]).map((p) => (
                        <SelectItem key={p} value={p} className="text-xs">
                          {CARD_PRIORIDADE_LABELS[p]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Origem do Contato</Label>
                  <Select value={origem} onValueChange={(v) => setOrigem(v as CardOrigem)}>
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(CARD_ORIGEM_LABELS) as CardOrigem[]).map((o) => (
                        <SelectItem key={o} value={o} className="text-xs">
                          {CARD_ORIGEM_LABELS[o]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Atendente Responsável</Label>
                  <Select value={atendenteId} onValueChange={setAtendenteId}>
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue placeholder="Sem atendente" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sem atendente definido</SelectItem>
                      {atendentes
                        .filter((a) => a.ativo)
                        .map((a) => (
                          <SelectItem key={a.id} value={String(a.id)} className="text-xs">
                            {a.nome}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="space-y-1">
                  <Label className="text-xs">Campanha de Marketing</Label>
                  <Input
                    value={campanha}
                    onChange={(e) => setCampanha(e.target.value)}
                    placeholder="Ex.: Check-up Sênior / Vacinas"
                    className="h-8 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Próxima Ação / Follow-up</Label>
                  <Input
                    value={proximaAcao}
                    onChange={(e) => setProximaAcao(e.target.value)}
                    placeholder="Ex.: Confirmar horário amanhã"
                    className="h-8 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Data/Hora do Follow-up</Label>
                  <Input
                    type="datetime-local"
                    value={proximaAcaoEm}
                    onChange={(e) => setProximaAcaoEm(e.target.value)}
                    className="h-8 text-xs"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Observações / Contexto do Atendimento</Label>
                <Textarea
                  value={observacoes}
                  onChange={(e) => setObservacoes(e.target.value)}
                  placeholder="Anotações importantes sobre a necessidade do cliente ou histórico da conversa..."
                  rows={2}
                  className="text-xs"
                />
              </div>

              {!selectedClientId && (
                <div className="flex items-center space-x-2 pt-1">
                  <Checkbox
                    id="criar-na-base"
                    checked={criarClienteNaBase}
                    onCheckedChange={(checked) => setCriarClienteNaBase(Boolean(checked))}
                  />
                  <Label htmlFor="criar-na-base" className="text-xs cursor-pointer">
                    Salvar este contato também na base geral de <strong>Clientes</strong> da clínica
                  </Label>
                </div>
              )}

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={isSubmitting || !nomeContato.trim()}>
                  {isSubmitting ? 'Adicionando...' : 'Adicionar ao Pipeline'}
                </Button>
              </DialogFooter>
            </form>
          </TabsContent>

          {/* ABA 2: IMPORTAÇÃO EM LOTE */}
          <TabsContent value="batch" className="mt-4">
            <form onSubmit={handleSubmitBatch} className="space-y-4">
              <div className="rounded-lg border bg-muted/40 p-3 space-y-3">
                <div className="flex items-center gap-1.5 text-xs font-semibold">
                  <Sparkles className="h-4 w-4 text-primary" />
                  Filtre clientes da base por Tag ou busca para disparar uma ação de Marketing ou Repescagem
                </div>

                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                  <Input
                    value={batchSearch}
                    onChange={(e) => setBatchSearch(e.target.value)}
                    placeholder="Buscar nome, pet, raça..."
                    className="h-8 text-xs bg-background"
                  />
                  <Select value={batchTagId} onValueChange={setBatchTagId}>
                    <SelectTrigger className="h-8 text-xs bg-background">
                      <SelectValue placeholder="Filtrar por Tag" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas as Tags</SelectItem>
                      {tags.map((t) => (
                        <SelectItem key={t.id} value={String(t.id)} className="text-xs">
                          {t.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={stageId} onValueChange={setStageId}>
                    <SelectTrigger className="h-8 text-xs bg-background">
                      <SelectValue placeholder="Estágio de destino" />
                    </SelectTrigger>
                    <SelectContent>
                      {stages.map((st) => (
                        <SelectItem key={st.id} value={st.id} className="text-xs">
                          Etapa: {st.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                  <Input
                    value={batchCampanha}
                    onChange={(e) => setBatchCampanha(e.target.value)}
                    placeholder="Nome da campanha (ex.: Vacina V10)"
                    className="h-8 text-xs bg-background"
                  />
                  <Input
                    value={batchServico}
                    onChange={(e) => setBatchServico(e.target.value)}
                    placeholder="Serviço alvo (ex.: Check-up)"
                    className="h-8 text-xs bg-background"
                  />
                  <Input
                    value={batchValor}
                    onChange={(e) => setBatchValor(e.target.value)}
                    placeholder="Valor unitário R$ (opcional)"
                    className="h-8 text-xs bg-background"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-muted-foreground">
                    {batchCandidates.length} clientes listados ·{' '}
                    <strong className="text-foreground">{selectedBatchIds.size}</strong> selecionados
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={toggleSelectAllBatch}
                  >
                    Selecionar / Desmarcar todos disponíveis
                  </Button>
                </div>

                <div className="max-h-60 overflow-y-auto rounded-lg border divide-y">
                  {batchLoading ? (
                    <div className="p-6 text-center text-xs text-muted-foreground">
                      Carregando clientes da base...
                    </div>
                  ) : batchCandidates.length === 0 ? (
                    <div className="p-6 text-center text-xs text-muted-foreground">
                      Nenhum cliente encontrado para este filtro.
                    </div>
                  ) : (
                    batchCandidates.map((cand) => {
                      const alreadyIn = existingClientIdsInPipeline.has(cand.id);
                      const checked = selectedBatchIds.has(cand.id);
                      return (
                        <label
                          key={cand.id}
                          className={`flex items-center justify-between px-3 py-2 text-xs cursor-pointer hover:bg-muted/50 ${
                            alreadyIn ? 'opacity-50 cursor-not-allowed' : ''
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <Checkbox
                              checked={checked}
                              disabled={alreadyIn}
                              onCheckedChange={() => !alreadyIn && toggleBatchCandidate(cand.id)}
                            />
                            <div>
                              <span className="font-medium">{cand.nome}</span>
                              {cand.nomePet && (
                                <span className="ml-2 text-primary">🐾 {cand.nomePet}</span>
                              )}
                              <div className="text-[11px] text-muted-foreground flex items-center gap-2">
                                {cand.telefone && (
                                  <span className="flex items-center gap-1">
                                    <Phone className="h-3 w-3" />
                                    {cand.telefone}
                                  </span>
                                )}
                                {cand.racaPet && <span>· {cand.racaPet}</span>}
                              </div>
                            </div>
                          </div>
                          {alreadyIn ? (
                            <span className="inline-flex items-center gap-1 rounded bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                              <Check className="h-3 w-3" /> Já está no pipeline
                            </span>
                          ) : null}
                        </label>
                      );
                    })
                  )}
                </div>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={isSubmitting || selectedBatchIds.size === 0}>
                  {isSubmitting
                    ? 'Importando...'
                    : `Importar ${selectedBatchIds.size} Contato(s)`}
                </Button>
              </DialogFooter>
            </form>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
