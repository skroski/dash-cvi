import { useEffect, useMemo, useRef, useState } from 'react';
import { Clapperboard, MessageCircle, Palette, Receipt, Smartphone } from 'lucide-react';
import { toast } from 'sonner';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/context/AuthContext';
import { useFilaConfig } from '@/hooks/useFilaConfig';
import type { FilaConfig } from '@/types/filaConfig';
import AparenciaTab from './config/AparenciaTab';
import CupomTab from './config/CupomTab';
import TotemTab from './config/TotemTab';
import TvTab from './config/TvTab';
import WhatsappTab from './config/WhatsappTab';

/**
 * Ajustes da fila: aparência, TV e vídeos, cupom e numeração, avisos por WhatsApp e totem.
 * Mudanças valem em todas as telas abertas assim que salvas. Só gestor altera (a RLS confere no banco).
 */
export default function QueueConfigDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (aberto: boolean) => void }) {
  const { isGestor } = useAuth();
  const { config, atualizar } = useFilaConfig();
  const [rascunho, setRascunho] = useState<FilaConfig>(config);
  const base = useRef(JSON.stringify(config));

  // Quando a configuração salva muda (outro gestor, ou este mesmo), só substitui o rascunho se ele não tinha edição pendente.
  useEffect(() => {
    const nova = JSON.stringify(config);
    if (nova === base.current) return;
    setRascunho((atual) => (JSON.stringify(atual) === base.current ? config : atual));
    base.current = nova;
  }, [config]);

  useEffect(() => {
    if (open) {
      setRascunho(config);
      base.current = JSON.stringify(config);
    }
    // Reinicia o rascunho só ao abrir.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const alteracoes = useMemo(() => {
    const diff: Partial<FilaConfig> = {};
    for (const chave of Object.keys(rascunho) as Array<keyof FilaConfig>) {
      if (rascunho[chave] !== config[chave]) (diff as Record<string, unknown>)[chave] = rascunho[chave];
    }
    return diff;
  }, [rascunho, config]);
  const sujo = Object.keys(alteracoes).length > 0;

  const alterar = (parcial: Partial<FilaConfig>) => setRascunho((atual) => ({ ...atual, ...parcial }));

  const salvar = async () => {
    try {
      await atualizar.mutateAsync(alteracoes);
      toast.success('Ajustes da fila salvos. As telas abertas já usam os novos valores.');
    } catch (err) {
      const mensagem = (err as { message?: string })?.message || '';
      toast.error(mensagem.includes('check') ? 'Algum valor está fora do permitido. Confira os campos.' : mensagem || 'Não foi possível salvar.');
    }
  };

  const tentarFechar = (aberto: boolean) => {
    if (!aberto && sujo && !window.confirm('Há alterações não salvas. Descartar?')) return;
    onOpenChange(aberto);
  };

  const props = { valor: rascunho, alterar, somenteLeitura: !isGestor };

  return (
    <Dialog open={open} onOpenChange={tentarFechar}>
      <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Ajustes da fila presencial</DialogTitle>
          <DialogDescription>Aparência, TV, cupom, numeração, avisos por WhatsApp e totem.</DialogDescription>
        </DialogHeader>

        {!isGestor && (
          <Alert>
            <AlertDescription className="text-xs">Somente gestores (administrador ou líder) podem alterar estes ajustes.</AlertDescription>
          </Alert>
        )}

        <Tabs defaultValue="aparencia">
          <TabsList className="grid h-auto w-full grid-cols-5">
            <TabsTrigger value="aparencia" className="gap-1.5 text-xs">
              <Palette className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Aparência</span>
            </TabsTrigger>
            <TabsTrigger value="tv" className="gap-1.5 text-xs">
              <Clapperboard className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">TV e vídeos</span>
            </TabsTrigger>
            <TabsTrigger value="cupom" className="gap-1.5 text-xs">
              <Receipt className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Cupom</span>
            </TabsTrigger>
            <TabsTrigger value="whatsapp" className="gap-1.5 text-xs">
              <MessageCircle className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">WhatsApp</span>
            </TabsTrigger>
            <TabsTrigger value="totem" className="gap-1.5 text-xs">
              <Smartphone className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Totem</span>
            </TabsTrigger>
          </TabsList>
          <TabsContent value="aparencia" className="pt-4">
            <AparenciaTab {...props} />
          </TabsContent>
          <TabsContent value="tv" className="pt-4">
            <TvTab {...props} />
          </TabsContent>
          <TabsContent value="cupom" className="pt-4">
            <CupomTab {...props} />
          </TabsContent>
          <TabsContent value="whatsapp" className="pt-4">
            <WhatsappTab {...props} />
          </TabsContent>
          <TabsContent value="totem" className="pt-4">
            <TotemTab {...props} />
          </TabsContent>
        </Tabs>

        <DialogFooter className="items-center gap-2 sm:justify-between">
          <p className="text-xs text-muted-foreground">
            {sujo ? 'Há alterações ainda não salvas.' : 'Vídeos e logotipo são salvos na hora; os demais campos usam o botão.'}
          </p>
          <div className="flex gap-2">
            <Button type="button" variant="ghost" size="sm" disabled={!sujo} onClick={() => setRascunho(config)}>
              Descartar
            </Button>
            <Button type="button" size="sm" disabled={!sujo || !isGestor || atualizar.isPending} onClick={salvar}>
              {atualizar.isPending ? 'Salvando...' : 'Salvar alterações'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
