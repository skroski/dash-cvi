import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  BookOpen,
  Check,
  Copy,
  Database,
  Eye,
  GitCommit,
  History,
  Layers,
  Plus,
  RotateCcw,
  Search,
  ShieldAlert,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';

import PageContainer from '@/components/layout/PageContainer';
import PageHeader from '@/components/shared/PageHeader';
import EmptyState from '@/components/shared/EmptyState';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

import { useAuth } from '@/context/AuthContext';
import { usePromptRegras } from '@/hooks/usePromptRegras';
import { ROTULO_GRUPO_VARIAVEL, marcadorDe, marcadoresDesconhecidos } from '@/lib/promptVariaveis';
import { PromptDiffViewer } from '@/components/prompt/PromptDiffViewer';
import { PromptRegraModal } from '@/components/prompt/PromptRegraModal';
import { PromptCommitModal } from '@/components/prompt/PromptCommitModal';
import type { CategoriaRegra, PromptRegra, PromptVersao } from '@/types/promptRegras';

const CATEGORIAS_CONFIG: Record<
  CategoriaRegra,
  { label: string; color: string; badgeClass: string }
> = {
  comportamento: {
    label: 'Comportamento',
    color: '#8b5cf6',
    badgeClass: 'bg-violet-500/10 text-violet-700 dark:text-violet-300 border-violet-500/20',
  },
  agendamento: {
    label: 'Agendamento',
    color: '#0284c7',
    badgeClass: 'bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/20',
  },
  servicos: {
    label: 'Serviços',
    color: '#059669',
    badgeClass: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20',
  },
  informacoes: {
    label: 'Informações',
    color: '#0891b2',
    badgeClass: 'bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border-cyan-500/20',
  },
  emergencia: {
    label: 'Emergência',
    color: '#ea580c',
    badgeClass: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20',
  },
  restricoes: {
    label: 'Restrições',
    color: '#e11d48',
    badgeClass: 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/20',
  },
  personalizadas: {
    label: 'Personalizadas',
    color: '#6366f1',
    badgeClass: 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-500/20',
  },
};

export default function MyPromptPage() {
  const { isAdmin } = useAuth();
  const allowed = isAdmin;

  const {
    regras,
    isLoadingRegras,
    versoes,
    variaveis,
    compilado,
    previa,
    toggleRegra,
    createRegra,
    updateRegra,
    deleteRegra,
    saveVersion,
    rollbackVersion,
  } = usePromptRegras(allowed);

  const [activeTab, setActiveTab] = useState<'regras' | 'variaveis' | 'preview' | 'historico'>('regras');
  const [categoriaFiltro, setCategoriaFiltro] = useState<string>('todas');
  const [busca, setBusca] = useState('');

  // Modais
  const [modalRegraAberto, setModalRegraAberto] = useState(false);
  const [regraEmEdicao, setRegraEmEdicao] = useState<PromptRegra | null>(null);
  const [modalCommitAberto, setModalCommitAberto] = useState(false);

  // Versão selecionada para visualização do Diff
  const [versaoSelecionadaId, setVersaoSelecionadaId] = useState<string | null>(null);
  const [copiadoTag, setCopiadoTag] = useState<string | null>(null);
  const [copiadoPrompt, setCopiadoPrompt] = useState(false);
  const [modoPrevia, setModoPrevia] = useState<'modelo' | 'renderizado'>('modelo');

  const versaoAtual = versoes[0] as PromptVersao | undefined;

  // Versão em foco para o comparador de Diff
  const versaoEmFoco = useMemo(() => {
    if (!versoes.length) return null;
    if (versaoSelecionadaId) {
      return versoes.find((v) => v.id === versaoSelecionadaId) || versaoAtual || null;
    }
    return versaoAtual || null;
  }, [versoes, versaoSelecionadaId, versaoAtual]);

  // Versão anterior para comparação de diff
  const versaoComparada = useMemo(() => {
    if (!versaoEmFoco) return null;
    const index = versoes.findIndex((v) => v.id === versaoEmFoco.id);
    if (index >= 0 && index + 1 < versoes.length) {
      return versoes[index + 1];
    }
    return null;
  }, [versoes, versaoEmFoco]);

  // Texto compilado pelo banco (regras ativas, com os marcadores {{...}} que o atendimento preenche a cada mensagem)
  const promptModelo = compilado?.prompt_completo ?? '';
  const promptExibido = modoPrevia === 'renderizado' && previa.data ? previa.data.texto : promptModelo;
  const gruposVariaveis = useMemo(() => {
    const ordem = ['data', 'empresa', 'cliente', 'catalogo'] as const;
    return ordem
      .map((grupo) => ({ grupo, itens: variaveis.filter((v) => v.grupo === grupo && !v.alias_de) }))
      .filter((g) => g.itens.length);
  }, [variaveis]);

  // Filtro de regras
  const regrasFiltradas = useMemo(() => {
    return regras.filter((r) => {
      const matchCat = categoriaFiltro === 'todas' || r.categoria === categoriaFiltro;
      const matchBusca =
        !busca.trim() ||
        r.titulo.toLowerCase().includes(busca.toLowerCase()) ||
        r.conteudo.toLowerCase().includes(busca.toLowerCase());
      return matchCat && matchBusca;
    });
  }, [regras, categoriaFiltro, busca]);

  const totalAtivas = useMemo(() => regras.filter((r) => r.ativa).length, [regras]);

  const handleCopiarTag = (tag: string) => {
    navigator.clipboard.writeText(tag);
    setCopiadoTag(tag);
    toast.success(`Tag ${tag} copiada para a área de transferência!`);
    setTimeout(() => setCopiadoTag(null), 2000);
  };

  const handleCopiarPromptCompleto = () => {
    navigator.clipboard.writeText(promptExibido);
    setCopiadoPrompt(true);
    toast.success('Prompt copiado com sucesso!');
    setTimeout(() => setCopiadoPrompt(false), 2000);
  };

  if (!allowed) {
    return (
      <PageContainer>
        <EmptyState
          icon={<ShieldAlert className="h-10 w-10 text-muted-foreground" />}
          title="Acesso restrito"
          description="Este editor de prompt está liberado apenas para administradores."
        />
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      {/* Topo / Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl font-bold tracking-tight">Meu Prompt</h1>
            {versaoAtual && (
              <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 font-mono text-xs">
                v{versaoAtual.versao} Ativa
              </Badge>
            )}
            <Badge variant="secondary" className="text-xs">
              {totalAtivas} de {regras.length} regras ativas
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            Instruções do assistente virtual. Regras modulares no banco, com versionamento auditável; dados da empresa, serviços e horários entram por variáveis.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" asChild className="gap-2 text-xs">
            <Link to="/knowledge">
              <BookOpen className="h-4 w-4 text-primary" />
              Base de Conhecimento (RAG)
            </Link>
          </Button>
          <Button
            onClick={() => setModalCommitAberto(true)}
            disabled={saveVersion.isPending || isLoadingRegras}
            className="gap-2 shadow-xs"
          >
            <GitCommit className="h-4 w-4" />
            Salvar Nova Versão
          </Button>
        </div>
      </div>

      {/* Navegação por Abas */}
      <Tabs value={activeTab} onValueChange={(val) => setActiveTab(val as typeof activeTab)} className="space-y-4">
        <TabsList className="grid grid-cols-2 md:grid-cols-4 w-full max-w-2xl bg-muted/60 p-1">
          <TabsTrigger value="regras" className="gap-1.5 text-xs">
            <Layers className="h-3.5 w-3.5" />
            Regras ({regras.length})
          </TabsTrigger>
          <TabsTrigger value="variaveis" className="gap-1.5 text-xs">
            <Database className="h-3.5 w-3.5" />
            Variáveis ({variaveis.filter((v) => !v.alias_de).length})
          </TabsTrigger>
          <TabsTrigger value="preview" className="gap-1.5 text-xs">
            <Eye className="h-3.5 w-3.5" />
            Prévia Compilada
          </TabsTrigger>
          <TabsTrigger value="historico" className="gap-1.5 text-xs">
            <History className="h-3.5 w-3.5" />
            Histórico & Diff ({versoes.length})
          </TabsTrigger>
        </TabsList>

        {/* ========================================================================= */}
        {/* ABA 1: REGRAS MODULARES DO PROMPT */}
        {/* ========================================================================= */}
        <TabsContent value="regras" className="space-y-4">
          {/* Barra de Filtros e Busca */}
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-card p-3 rounded-xl border shadow-2xs">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar regras por título ou instrução..."
                className="pl-9 h-9 text-xs"
              />
            </div>

            <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0">
              <Button
                variant={categoriaFiltro === 'todas' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setCategoriaFiltro('todas')}
                className="text-xs h-8 shrink-0"
              >
                Todas ({regras.length})
              </Button>
              {(Object.keys(CATEGORIAS_CONFIG) as CategoriaRegra[]).map((cat) => {
                const count = regras.filter((r) => r.categoria === cat).length;
                return (
                  <Button
                    key={cat}
                    variant={categoriaFiltro === cat ? 'secondary' : 'ghost'}
                    size="sm"
                    onClick={() => setCategoriaFiltro(cat)}
                    className="text-xs h-8 shrink-0"
                  >
                    {CATEGORIAS_CONFIG[cat].label} ({count})
                  </Button>
                );
              })}

              <Button
                size="sm"
                onClick={() => {
                  setRegraEmEdicao(null);
                  setModalRegraAberto(true);
                }}
                className="h-8 text-xs gap-1 ml-auto shrink-0"
              >
                <Plus className="h-3.5 w-3.5" />
                Nova Regra
              </Button>
            </div>
          </div>

          {/* Lista de Regras */}
          {regrasFiltradas.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center p-12 text-center text-muted-foreground">
                <Sparkles className="h-8 w-8 text-muted-foreground/40 mb-2" />
                <p className="text-sm font-semibold">Nenhuma regra encontrada</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Ajuste o filtro de categoria ou crie uma nova regra personalizada.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3">
              {regrasFiltradas.map((regra) => {
                const catInfo = CATEGORIAS_CONFIG[regra.categoria] || CATEGORIAS_CONFIG.personalizadas;

                return (
                  <Card
                    key={regra.id}
                    className={`transition-all border ${
                      regra.ativa ? 'bg-card shadow-2xs' : 'bg-muted/30 opacity-70 border-dashed'
                    }`}
                  >
                    <CardContent className="p-4 flex flex-col md:flex-row md:items-start justify-between gap-4">
                      <div className="space-y-2 flex-1 min-w-0">
                        {/* Badges e Título */}
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-semibold border ${catInfo.badgeClass}`}
                          >
                            {catInfo.label}
                          </span>

                          {regra.padrao ? (
                            <Badge variant="outline" className="text-[10px] bg-muted/50">
                              Padrão do Sistema
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="text-[10px] bg-indigo-500/10 text-indigo-600 border-indigo-500/20">
                              Personalizada
                            </Badge>
                          )}

                          <h3 className="font-semibold text-sm text-foreground truncate">
                            {regra.titulo}
                          </h3>
                        </div>

                        {/* Conteúdo da Regra */}
                        <p className="text-xs text-muted-foreground whitespace-pre-wrap font-mono leading-relaxed bg-muted/20 p-2.5 rounded-md border border-border/40">
                          {regra.conteudo}
                        </p>
                      </div>

                      {/* Ações da Regra */}
                      <div className="flex items-center gap-3 shrink-0 self-end md:self-start">
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] text-muted-foreground">
                            {regra.ativa ? 'Ativa' : 'Desativada'}
                          </span>
                          <Switch
                            checked={regra.ativa}
                            onCheckedChange={(checked) => {
                              toggleRegra.mutate({ id: regra.id, ativa: checked });
                              toast.info(`Regra "${regra.titulo}" ${checked ? 'ativada' : 'desativada'}. Salve uma versão para aplicar à IA.`);
                            }}
                          />
                        </div>

                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setRegraEmEdicao(regra);
                            setModalRegraAberto(true);
                          }}
                          className="h-8 text-xs"
                        >
                          Editar
                        </Button>

                        {!regra.padrao && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-rose-500 hover:text-rose-600 hover:bg-rose-50">
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Excluir regra personalizada?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  A regra "{regra.titulo}" será excluída do banco de dados. Para aplicar essa remoção à IA em produção, salve uma nova versão em seguida.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => {
                                    deleteRegra.mutate(regra.id);
                                    toast.success('Regra excluída com sucesso');
                                  }}
                                  className="bg-rose-600 hover:bg-rose-700"
                                >
                                  Excluir
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* ========================================================================= */}
        {/* ABA 2: VARIÁVEIS DO SISTEMA */}
        {/* ========================================================================= */}
        <TabsContent value="variaveis" className="space-y-4">
          <Card>
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Database className="h-4 w-4 text-primary" />
                Variáveis do prompt
              </CardTitle>
              <CardDescription className="text-xs">
                Escreva a variável em qualquer regra e, a cada mensagem, o sistema a troca pelo dado atual (empresa, cliente, data e hora no fuso da empresa, serviços e horários da agenda).
                Mudou o endereço ou um preço? Altere em Configuração do atendimento — não precisa editar o texto nem salvar nova versão.
                Variáveis com <code>:chave</code> usam a chave de um serviço ou tipo de agenda, ex.: <code>{'{{preco:consulta}}'}</code>.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 pt-2 space-y-5">
              {variaveis.length === 0 && (
                <p className="text-xs text-muted-foreground">Registro de variáveis indisponível: aplique a migração <code>20261027100000_clinica_configuracao_prompt</code>.</p>
              )}
              {gruposVariaveis.map(({ grupo, itens }) => (
                <section key={grupo} className="space-y-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{ROTULO_GRUPO_VARIAVEL[grupo]}</h3>
                  <div className="grid gap-3 md:grid-cols-2">
                    {itens.map((v) => {
                      const tag = marcadorDe(v);
                      return (
                        <div key={v.nome} className="p-3.5 rounded-xl border bg-card hover:border-primary/40 transition-colors space-y-2 flex flex-col justify-between">
                          <div>
                            <p className="text-[11px] text-muted-foreground">{v.descricao}</p>
                            {v.exemplo !== '' && (
                              <p className="mt-1 text-[11px]"><span className="text-muted-foreground">Exemplo: </span><span className="font-medium">{v.exemplo}</span></p>
                            )}
                          </div>
                          <div className="flex items-center justify-between gap-2 pt-2 border-t border-border/40">
                            <code className="text-xs font-mono font-bold text-primary bg-primary/10 px-2 py-0.5 rounded">{tag}</code>
                            <Button variant="ghost" size="sm" onClick={() => handleCopiarTag(tag)} className="h-7 text-[11px] gap-1 px-2">
                              {copiadoTag === tag ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                              {copiadoTag === tag ? 'Copiado' : 'Copiar'}
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ========================================================================= */}
        {/* ABA 3: PRÉVIA DO PROMPT COMPILADO */}
        {/* ========================================================================= */}
        <TabsContent value="preview" className="space-y-4">
          <Card>
            <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between gap-3">
              <div>
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Eye className="h-4 w-4 text-primary" />
                  Prévia do prompt
                </CardTitle>
                <CardDescription className="text-xs">
                  <strong>Modelo</strong>: o texto das regras ativas, com as variáveis, que fica salvo em cada versão.{' '}
                  <strong>Como o assistente recebe</strong>: o mesmo texto com data, hora, empresa, serviços e horários já preenchidos (cliente de exemplo).
                </CardDescription>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <div className="inline-flex rounded-md border p-0.5" role="group" aria-label="Tipo de prévia">
                  <Button size="sm" variant={modoPrevia === 'modelo' ? 'secondary' : 'ghost'} className="h-7 text-xs" onClick={() => setModoPrevia('modelo')}>Modelo</Button>
                  <Button
                    size="sm" variant={modoPrevia === 'renderizado' ? 'secondary' : 'ghost'} className="h-7 text-xs"
                    onClick={() => {
                      setModoPrevia('renderizado');
                      previa.mutate(promptModelo || undefined, { onError: () => toast.error('Não foi possível gerar a prévia', { description: 'Publique a função atendimento-config e confira se você é administrador.' }) });
                    }}
                  >Como o assistente recebe</Button>
                </div>
                <Button variant="outline" size="sm" onClick={handleCopiarPromptCompleto} className="h-8 text-xs gap-1.5">
                  {copiadoPrompt ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                  {copiadoPrompt ? 'Copiado!' : 'Copiar'}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-4 pt-2">
              {modoPrevia === 'renderizado' && previa.data && previa.data.desconhecidas.length > 0 && (
                <p className="mb-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-2 text-xs text-amber-800 dark:text-amber-300" role="alert">
                  Variáveis desconhecidas removidas na prévia: <code>{previa.data.desconhecidas.join(', ')}</code>. Corrija as regras que as usam.
                </p>
              )}
              {modoPrevia === 'modelo' && marcadoresDesconhecidos(promptModelo, variaveis).length > 0 && (
                <p className="mb-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-2 text-xs text-amber-800 dark:text-amber-300" role="alert">
                  Há variáveis desconhecidas no texto: <code>{marcadoresDesconhecidos(promptModelo, variaveis).join(', ')}</code>.
                </p>
              )}
              <div className="flex items-center justify-between text-xs text-muted-foreground mb-2 px-1">
                <span>{compilado?.total_regras_ativas ?? totalAtivas} regras ativas incluídas</span>
                <span>
                  {promptExibido.length.toLocaleString('pt-BR')} caracteres
                  {modoPrevia === 'renderizado' && previa.data ? ` · ≈ ${previa.data.tokens_estimados.toLocaleString('pt-BR')} tokens` : ''}
                </span>
              </div>
              <ScrollArea className="h-[520px] rounded-lg border bg-muted/20 p-4 font-mono text-xs leading-relaxed whitespace-pre-wrap">
                {modoPrevia === 'renderizado' && previa.isPending ? 'Gerando prévia…' : promptExibido || 'Nenhuma regra ativa.'}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ========================================================================= */}
        {/* ABA 4: HISTÓRICO & DIFF ESTILO GITHUB */}
        {/* ========================================================================= */}
        <TabsContent value="historico" className="space-y-4">
          <div className="grid gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
            {/* Lista de Versões no Histórico */}
            <Card>
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Histórico de Versões
                </CardTitle>
                <CardDescription className="text-[11px]">
                  Clique em uma versão para inspecionar e comparar as mudanças.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-2 pt-0">
                <ScrollArea className="h-[520px]">
                  <div className="space-y-1.5 p-1">
                    {versoes.map((v, index) => {
                      const isSelected = versaoEmFoco?.id === v.id;
                      const isLatest = index === 0;

                      return (
                        <button
                          key={v.id}
                          onClick={() => setVersaoSelecionadaId(v.id)}
                          className={`w-full rounded-lg p-2.5 text-left transition-all border ${
                            isSelected
                              ? 'bg-primary/10 border-primary/40 text-foreground'
                              : 'bg-card border-transparent hover:bg-muted/60 text-muted-foreground hover:text-foreground'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-1 mb-1">
                            <span className="font-bold text-xs font-mono">v{v.versao}</span>
                            {isLatest && (
                              <Badge variant="outline" className="text-[9px] bg-emerald-500/10 text-emerald-600 border-emerald-500/30">
                                Ativa
                              </Badge>
                            )}
                          </div>
                          <p className="text-[11px] font-medium text-foreground line-clamp-2">
                            {v.descricao || 'Atualização do prompt'}
                          </p>
                          <div className="flex items-center justify-between text-[10px] text-muted-foreground mt-1.5">
                            <span>{new Date(v.criado_em).toLocaleDateString('pt-BR')}</span>
                            {v.autor_nome && <span>{v.autor_nome.split(' ')[0]}</span>}
                          </div>
                        </button>
                      );
                    })}

                    {versoes.length === 0 && (
                      <p className="text-xs text-muted-foreground p-3 text-center">
                        Nenhuma versão encontrada.
                      </p>
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

            {/* Painel de Diff Visual */}
            <div className="min-h-[520px]">
              {versaoEmFoco ? (
                <PromptDiffViewer
                  versaoBase={versaoEmFoco}
                  versaoComparada={versaoComparada}
                  onRollback={async (versao) => {
                    try {
                      await rollbackVersion.mutateAsync(versao);
                      toast.success(`Versão v${versao.versao} restaurada como a nova versão ativa!`);
                    } catch {
                      toast.error('Erro ao restaurar versão do prompt.');
                    }
                  }}
                  isRollbackPending={rollbackVersion.isPending}
                />
              ) : (
                <Card className="h-full flex items-center justify-center p-8 text-center text-muted-foreground">
                  <p className="text-sm">Selecione uma versão para visualizar as mudanças.</p>
                </Card>
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Modal de Criação / Edição de Regra */}
      <PromptRegraModal
        isOpen={modalRegraAberto}
        onClose={() => {
          setModalRegraAberto(false);
          setRegraEmEdicao(null);
        }}
        regraEmEdicao={regraEmEdicao}
        variaveisDisponiveis={variaveis}
        onSave={async (dados) => {
          if (dados.id) {
            await updateRegra.mutateAsync({
              id: dados.id,
              titulo: dados.titulo,
              categoria: dados.categoria,
              conteudo: dados.conteudo,
            });
            toast.success('Regra atualizada com sucesso! Salve uma nova versão para publicar.');
          } else {
            await createRegra.mutateAsync({
              titulo: dados.titulo,
              categoria: dados.categoria,
              conteudo: dados.conteudo,
            });
            toast.success('Regra adicionada com sucesso! Salve uma nova versão para publicar.');
          }
        }}
      />

      {/* Modal de Commit (Salvar Versão) */}
      <PromptCommitModal
        isOpen={modalCommitAberto}
        onClose={() => setModalCommitAberto(false)}
        versaoAtual={versaoAtual?.versao || 0}
        totalRegrasAtivas={totalAtivas}
        isSaving={saveVersion.isPending}
        onConfirm={async (descricao) => {
          try {
            await saveVersion.mutateAsync({ descricao });
            toast.success(`Nova versão v${(versaoAtual?.versao || 0) + 1} publicada com sucesso!`);
          } catch {
            toast.error('Não foi possível salvar a nova versão.');
          }
        }}
      />
    </PageContainer>
  );
}
