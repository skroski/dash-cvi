import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  ShieldAlert,
  Ban,
  Plus,
  Trash2,
  RefreshCw,
  PhoneCall,
  Radio,
  AlertCircle,
  CheckCircle2,
  Search,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import { capitalizar, useIdentidadeAtendimento } from '@/hooks/useIdentidadeAtendimento';

export interface Bloqueio {
  id: string;
  telefone: string;
  session_id: string;
  motivo: string;
  observacao: string | null;
  bloqueado_em: string;
  ativo: boolean;
}

const MOTIVOS_LABELS: Record<string, { label: string; cor: string }> = {
  operadora_tim: { label: 'TIM (Operadora)', cor: 'bg-blue-500/10 text-blue-600 border-blue-200 dark:border-blue-800' },
  operadora: { label: 'Operadora de Telecom', cor: 'bg-sky-500/10 text-sky-600 border-sky-200 dark:border-sky-800' },
  operadora_ou_spam: { label: 'Operadora / Robô', cor: 'bg-amber-500/10 text-amber-600 border-amber-200 dark:border-amber-800' },
  bot_ura: { label: 'Robô / URA Automática', cor: 'bg-purple-500/10 text-purple-600 border-purple-200 dark:border-purple-800' },
  spam: { label: 'Spam / Telemarketing', cor: 'bg-red-500/10 text-red-600 border-red-200 dark:border-red-800' },
  outro: { label: 'Outro', cor: 'bg-zinc-500/10 text-zinc-600 border-zinc-200 dark:border-zinc-800' },
};

export function BlacklistCard() {
  const { papel, setupPendente } = useAuth();
  const { rotuloAssistente } = useIdentidadeAtendimento();
  const isAdmin = setupPendente || papel === 'admin' || papel === 'lider';

  const [bloqueios, setBloqueios] = useState<Bloqueio[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [search, setSearch] = useState('');

  // Formulário de novo bloqueio
  const [novoTelefone, setNovoTelefone] = useState('');
  const [novoMotivo, setNovoMotivo] = useState('operadora_ou_spam');
  const [novaObservacao, setNovaObservacao] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchBloqueios = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.rpc('obter_bloqueios_atendimento');
      if (error) throw error;
      setBloqueios((data as Bloqueio[]) || []);
    } catch (err: unknown) {
      console.warn('Erro ao carregar números bloqueados:', err);
      // Fallback: se a RPC ainda não tiver sido propagada, carrega via fallback local
      setBloqueios((prev) => {
        if (!prev.some((b) => b.telefone.includes('552120181083'))) {
          return [
            {
              id: 'local-tim',
              telefone: '552120181083',
              session_id: '552120181083@s.whatsapp.net',
              motivo: 'operadora_tim',
              observacao: 'Número institucional da operadora TIM bloqueado para evitar loop',
              bloqueado_em: new Date().toISOString(),
              ativo: true,
            },
            ...prev,
          ];
        }
        return prev;
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBloqueios();
  }, []);

  const handleBloquear = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = novoTelefone.replace(/\D/g, '');
    if (clean.length < 8) {
      toast.error('Telefone inválido', {
        description: 'Informe o número com DDD (ex: 2120181083 ou 552120181083).',
      });
      return;
    }

    try {
      setSubmitting(true);
      const { error } = await supabase.rpc('bloquear_telefone_atendimento', {
        p_telefone: clean,
        p_motivo: novoMotivo,
        p_observacao: novaObservacao.trim() || null,
      });

      if (error) throw error;

      toast.success('Número bloqueado com sucesso', {
        description: `O assistente foi permanentemente desativado para ${clean}. Nenhuma mensagem será enviada ou processada.`,
      });

      setNovoTelefone('');
      setNovaObservacao('');
      setModalOpen(false);
      await fetchBloqueios();
    } catch (err: unknown) {
      console.error('Erro ao bloquear número:', err);
      toast.error('Erro ao bloquear', {
        description: err instanceof Error ? err.message : 'Não foi possível bloquear o número.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDesbloquear = async (telefone: string) => {
    if (!confirm(`Deseja realmente desbloquear o número ${telefone}? ${capitalizar(rotuloAssistente)} voltará a responder se o contato enviar mensagens.`)) {
      return;
    }

    try {
      const { error } = await supabase.rpc('desbloquear_telefone_atendimento', {
        p_telefone: telefone,
      });

      if (error) throw error;

      toast.success('Número desbloqueado', {
        description: `O número ${telefone} foi removido da lista de bloqueios.`,
      });
      await fetchBloqueios();
    } catch (err: unknown) {
      console.error('Erro ao desbloquear número:', err);
      toast.error('Erro ao desbloquear', {
        description: err instanceof Error ? err.message : 'Falha ao desbloquear número.',
      });
    }
  };

  const formatarTelefone = (tel: string) => {
    const limpo = tel.replace(/\D/g, '');
    if (limpo.length === 12 && limpo.startsWith('55')) {
      // 55 21 2018 1083 (fixo com 8 digitos)
      return `+55 (${limpo.slice(2, 4)}) ${limpo.slice(4, 8)}-${limpo.slice(8)}`;
    }
    if (limpo.length === 13 && limpo.startsWith('55')) {
      // 55 11 99999 9999 (celular com 9 digitos)
      return `+55 (${limpo.slice(2, 4)}) ${limpo.slice(4, 9)}-${limpo.slice(9)}`;
    }
    if (limpo.length === 10) {
      return `(${limpo.slice(0, 2)}) ${limpo.slice(2, 6)}-${limpo.slice(6)}`;
    }
    if (limpo.length === 11) {
      return `(${limpo.slice(0, 2)}) ${limpo.slice(2, 7)}-${limpo.slice(7)}`;
    }
    return tel;
  };

  const bloqueiosFiltrados = bloqueios.filter((b) => {
    if (!search.trim()) return true;
    const termo = search.toLowerCase();
    return (
      b.telefone.includes(termo) ||
      b.motivo.toLowerCase().includes(termo) ||
      (b.observacao || '').toLowerCase().includes(termo)
    );
  });

  return (
    <>
      <Card className="flex flex-col justify-between">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="p-2 w-fit rounded-lg bg-red-500/10 text-red-600 dark:text-red-400 mb-1">
              <Ban className="h-5 w-5" />
            </div>
            <Badge variant="outline" className="text-[11px] gap-1 font-medium bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-400 dark:border-red-800">
              {bloqueios.length} {bloqueios.length === 1 ? 'bloqueado' : 'bloqueados'}
            </Badge>
          </div>
          <CardTitle className="text-base font-semibold">Números Bloqueados (Blacklist)</CardTitle>
          <CardDescription className="text-xs">
            Impede que robôs de operadoras (TIM, Claro), URAs e spams entrem em loop com {rotuloAssistente}.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 pt-0">
          <div className="text-xs text-muted-foreground flex items-center justify-between">
            <span>Proteção ativa contra loops de IA</span>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-muted-foreground hover:text-foreground"
              onClick={fetchBloqueios}
              disabled={loading}
              title="Recarregar"
            >
              <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>

          <div className="flex gap-2">
            <Button
              variant="default"
              size="sm"
              className="flex-1 text-xs h-8 bg-red-600 hover:bg-red-700 text-white gap-1.5"
              onClick={() => setModalOpen(true)}
              disabled={!isAdmin}
            >
              <Plus className="h-3.5 w-3.5" />
              Bloquear Número
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="text-xs h-8"
              onClick={() => setDetailsModalOpen(true)}
            >
              Ver Lista ({bloqueios.length})
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* MODAL 1: Bloquear Novo Número */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <Ban className="h-5 w-5" />
              Bloquear Número de Telefone
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              O número adicionado será silenciado imediatamente. {capitalizar(rotuloAssistente)} nunca mais responderá mensagens deste remetente e quaisquer mensagens pendentes na fila serão canceladas.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleBloquear} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="tel-input" className="text-xs font-semibold">Número de Telefone (com DDD)</Label>
              <Input
                id="tel-input"
                placeholder="Ex: 552120181083 ou (21) 2018-1083"
                value={novoTelefone}
                onChange={(e) => setNovoTelefone(e.target.value)}
                required
                className="font-mono text-sm"
              />
              <span className="text-[11px] text-muted-foreground">
                Dica: Digite apenas os números ou com DDD. Ex: 552120181083.
              </span>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="motivo-select" className="text-xs font-semibold">Motivo do Bloqueio</Label>
              <select
                id="motivo-select"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                value={novoMotivo}
                onChange={(e) => setNovoMotivo(e.target.value)}
              >
                <option value="operadora_tim">TIM (Operadora / URA)</option>
                <option value="operadora">Outra Operadora (Claro, Vivo, Oi)</option>
                <option value="bot_ura">Robô / Atendimento Automático</option>
                <option value="spam">Spam / Telemarketing / Cobrança</option>
                <option value="outro">Outro motivo</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="obs-input" className="text-xs font-semibold">Observação interna (opcional)</Label>
              <Input
                id="obs-input"
                placeholder="Ex: Disparo contínuo de URA automática"
                value={novaObservacao}
                onChange={(e) => setNovaObservacao(e.target.value)}
              />
            </div>

            <DialogFooter className="gap-2 sm:gap-0 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setModalOpen(false)}
                disabled={submitting}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                size="sm"
                className="bg-red-600 hover:bg-red-700 text-white gap-1.5"
                disabled={submitting}
              >
                {submitting ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    Bloqueando...
                  </>
                ) : (
                  <>
                    <Ban className="h-3.5 w-3.5" />
                    Confirmar Bloqueio
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* MODAL 2: Lista Completa de Números Bloqueados */}
      <Dialog open={detailsModalOpen} onOpenChange={setDetailsModalOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle className="flex items-center gap-2">
                <ShieldAlert className="h-5 w-5 text-red-600" />
                Gerenciar Números Bloqueados ({bloqueios.length})
              </DialogTitle>
              <Button
                variant="default"
                size="sm"
                className="bg-red-600 hover:bg-red-700 text-white text-xs h-7 gap-1"
                onClick={() => {
                  setDetailsModalOpen(false);
                  setModalOpen(true);
                }}
              >
                <Plus className="h-3 w-3" />
                Bloquear Novo
              </Button>
            </div>
            <DialogDescription className="text-xs text-muted-foreground">
              Estes números estão permanentemente silenciados para {rotuloAssistente}. A empresa não enviará nenhuma mensagem automática para eles.
            </DialogDescription>
          </DialogHeader>

          <div className="relative my-2">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por telefone, motivo ou observação..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 text-xs h-9"
            />
          </div>

          <div className="flex-1 overflow-y-auto space-y-2 pr-1 min-h-[200px]">
            {bloqueiosFiltrados.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center text-muted-foreground space-y-2">
                <CheckCircle2 className="h-8 w-8 text-emerald-500 opacity-60" />
                <p className="text-xs">Nenhum número bloqueado encontrado.</p>
              </div>
            ) : (
              bloqueiosFiltrados.map((item) => {
                const badgeInfo = MOTIVOS_LABELS[item.motivo] || MOTIVOS_LABELS.operadora_ou_spam;
                return (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-3 rounded-lg border bg-card/60 hover:bg-accent/40 transition-colors"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-semibold text-sm">
                          {formatarTelefone(item.telefone)}
                        </span>
                        <Badge variant="outline" className={`text-[10px] py-0 px-2 font-medium border ${badgeInfo.cor}`}>
                          {badgeInfo.label}
                        </Badge>
                      </div>
                      {item.observacao && (
                        <p className="text-xs text-muted-foreground">{item.observacao}</p>
                      )}
                      <p className="text-[10px] text-muted-foreground">
                        Bloqueado em: {new Date(item.bloqueado_em).toLocaleDateString('pt-BR')} às{' '}
                        {new Date(item.bloqueado_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>

                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs text-muted-foreground hover:text-red-600 h-8 gap-1"
                      onClick={() => handleDesbloquear(item.telefone)}
                      title="Desbloquear número"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Desbloquear
                    </Button>
                  </div>
                );
              })
            )}
          </div>

          <DialogFooter className="pt-2">
            <Button variant="outline" size="sm" onClick={() => setDetailsModalOpen(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
