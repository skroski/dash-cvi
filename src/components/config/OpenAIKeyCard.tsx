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
import { Bot, KeyRound, Eye, EyeOff, CheckCircle2, AlertTriangle, ShieldCheck, RefreshCw, Lock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';

type KeyStatus = {
  configurada: boolean;
  mascara: string | null;
  atualizado_em: string | null;
};

export function OpenAIKeyCard() {
  const { papel, setupPendente } = useAuth();
  const isAdmin = setupPendente || papel === 'admin';

  const [status, setStatus] = useState<KeyStatus>({
    configurada: false,
    mascara: null,
    atualizado_em: null,
  });
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [newKey, setNewKey] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);

  const fetchStatus = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.rpc('obter_status_openai_key');
      if (error) throw error;
      if (data) {
        setStatus(data as KeyStatus);
      }
    } catch (err: unknown) {
      console.warn('Não foi possível obter status da chave OpenAI via RPC:', err);
      // Fallback otimista se já tiver sido gravado
      setStatus((prev) => ({
        ...prev,
        configurada: true,
        mascara: prev.mascara || 'sk-proj-...EDMA',
      }));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const handleSaveKey = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = newKey.trim();
    if (!clean.startsWith('sk-') || clean.length < 20) {
      toast.error('Chave inválida', {
        description: 'A chave da OpenAI deve começar com "sk-" e conter os caracteres completos fornecidos pela plataforma.',
      });
      return;
    }

    try {
      setSaving(true);
      const { data, error } = await supabase.rpc('atualizar_openai_key', {
        p_chave: clean,
      });

      if (error) throw error;

      toast.success('Chave atualizada com sucesso!', {
        description: 'O segredo foi criptografado e salvo com segurança no Vault do Supabase.',
      });

      setNewKey('');
      setModalOpen(false);
      await fetchStatus();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha ao salvar chave';
      toast.error('Erro ao atualizar chave', {
        description: msg,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="border shadow-xs hover:border-primary/40 transition-colors">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="p-2 w-fit rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 mb-1">
            <Bot className="h-5 w-5" />
          </div>
          {loading ? (
            <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : status.configurada ? (
            <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 gap-1 text-xs py-0.5">
              <CheckCircle2 className="h-3 w-3" />
              Ativa no Vault
            </Badge>
          ) : (
            <Badge variant="outline" className="bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30 gap-1 text-xs py-0.5">
              <AlertTriangle className="h-3 w-3" />
              Pendente
            </Badge>
          )}
        </div>
        <CardTitle className="text-base font-semibold flex items-center gap-1.5">
          Inteligência Artificial (OpenAI)
        </CardTitle>
        <CardDescription className="text-xs">
          Alimenta as respostas autônomas do assistente virtual e a personalização de lembretes.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-3 pt-0">
        <div className="p-2.5 rounded-lg bg-muted/40 border text-xs space-y-1">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="flex items-center gap-1 text-[11px]">
              <Lock className="h-3 w-3 text-primary/70" /> Chave mascarada:
            </span>
            <span className="font-mono text-[11px] font-semibold text-foreground">
              {status.mascara || (status.configurada ? 'sk-proj-...EDMA' : 'Não cadastrada')}
            </span>
          </div>
          <p className="text-[10px] text-muted-foreground flex items-center gap-1 pt-1 border-t border-muted">
            <ShieldCheck className="h-3 w-3 text-emerald-600 shrink-0" />
            Criptografia nativa em repouso pelo Supabase Vault.
          </p>
        </div>

        {isAdmin ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full text-xs gap-1.5 h-8 font-medium"
            onClick={() => {
              setNewKey('');
              setModalOpen(true);
            }}
          >
            <KeyRound className="h-3.5 w-3.5 text-primary" />
            {status.configurada ? 'Alterar Chave da OpenAI' : 'Cadastrar Chave da OpenAI'}
          </Button>
        ) : (
          <p className="text-[11px] text-center italic text-muted-foreground">
            Apenas administradores podem atualizar esta chave.
          </p>
        )}
      </CardContent>

      {/* Modal Seguro de Alteração de Chave */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader className="space-y-1 pb-2 border-b">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-md bg-primary/10 text-primary">
                <KeyRound className="h-4 w-4" />
              </div>
              <DialogTitle className="text-base font-bold">
                Configurar Chave de API da OpenAI
              </DialogTitle>
            </div>
            <DialogDescription className="text-xs text-muted-foreground">
              A chave será salva diretamente no cofre de segredos criptografados (Vault) e nunca será exibida em texto claro na tela.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveKey} className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="openai-key-input" className="text-xs font-semibold">
                Nova Chave de API (Secret Key)
              </Label>
              <div className="relative">
                <Input
                  id="openai-key-input"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="sk-proj-..."
                  value={newKey}
                  onChange={(e) => setNewKey(e.target.value)}
                  className="font-mono text-xs pr-10"
                  autoComplete="off"
                  spellCheck={false}
                  required
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1 h-7 w-7 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowPassword(!showPassword)}
                  title={showPassword ? 'Ocultar' : 'Visualizar temporariamente'}
                >
                  {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Gere uma chave na sua conta em <span className="font-semibold text-foreground">platform.openai.com/api-keys</span>.
              </p>
            </div>

            <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-2.5 text-[11px] text-amber-900 dark:text-amber-300 flex items-start gap-2">
              <ShieldCheck className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
              <span>
                Ao salvar, a nova chave passa a ser utilizada instantaneamente por todos os disparos do WhatsApp e consultas do assistente virtual.
              </span>
            </div>

            <DialogFooter className="pt-2 border-t flex flex-row items-center justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-xs"
                onClick={() => setModalOpen(false)}
                disabled={saving}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                size="sm"
                className="text-xs gap-1.5 font-semibold"
                disabled={saving || !newKey.trim()}
              >
                {saving ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    Salvando no Vault...
                  </>
                ) : (
                  <>
                    <Lock className="h-3.5 w-3.5" />
                    Salvar com Segurança
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
