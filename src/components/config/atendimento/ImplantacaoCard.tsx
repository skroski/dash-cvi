import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2, Circle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useAgendaConfiguracao } from '@/hooks/useAgendaConfiguracao';
import type { TipoAgendaResumo } from '@/hooks/useAtendimentoConfig';
import { supabase } from '@/integrations/supabase/client';
import { calcularChecklist, type Situacao } from '@/lib/implantacao';
import type { AtendimentoConfig, ClinicaServico, NotificacaoDestinatario } from '@/types/atendimentoConfig';


// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as unknown as { from: (t: string) => any; rpc: (fn: string) => any };

function useStatusExterno() {
  return useQuery({
    queryKey: ['implantacao-status-externo'],
    staleTime: 30_000,
    queryFn: async () => {
      const [chave, versoes] = await Promise.all([
        db.rpc('obter_status_openai_key'),
        db.from('meu_prompt_versoes').select('versao', { count: 'exact', head: true }),
      ]);
      return {
        openaiConfigurada: chave.error ? null : Boolean((chave.data as { configurada?: boolean } | null)?.configurada),
        versoesPrompt: versoes.error ? null : (versoes.count as number | null) ?? 0,
      };
    },
  });
}

const ICONE: Record<Situacao, JSX.Element> = {
  ok: <CheckCircle2 className="h-5 w-5 text-emerald-600" aria-label="Pronto" />,
  atencao: <AlertTriangle className="h-5 w-5 text-amber-600" aria-label="Atenção" />,
  pendente: <Circle className="h-5 w-5 text-muted-foreground" aria-label="Pendente" />,
};

export function ImplantacaoCard({
  config, servicos, destinatarios, tipos, onAbrirAba,
}: {
  config: AtendimentoConfig;
  servicos: ClinicaServico[];
  destinatarios: NotificacaoDestinatario[];
  tipos: TipoAgendaResumo[];
  onAbrirAba: (aba: string) => void;
}) {
  const agenda = useAgendaConfiguracao();
  const externo = useStatusExterno();
  const itens = calcularChecklist({
    config, servicos, destinatarios, tipos,
    regras: agenda.regrasComNomes ?? [],
    janelas: agenda.janelas ?? [],
    openaiConfigurada: externo.data?.openaiConfigurada ?? null,
    versoesPrompt: externo.data?.versoesPrompt ?? null,
  });
  const prontos = itens.filter((i) => i.situacao === 'ok').length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Checklist de implantação</CardTitle>
        <CardDescription>
          Tudo o que muda de uma clínica para outra é configurado nestas telas, sem alterar código. Conclua os itens antes de ligar o envio de mensagens.
        </CardDescription>
        <div className="flex items-center gap-3 pt-2">
          <Progress value={(prontos / itens.length) * 100} className="h-2 max-w-sm" />
          <span className="text-xs text-muted-foreground">{prontos} de {itens.length} prontos</span>
        </div>
      </CardHeader>
      <CardContent className="divide-y">
        {itens.map((item) => (
          <div key={item.chave} className="flex flex-wrap items-center gap-3 py-3">
            {ICONE[item.situacao]}
            <div className="min-w-60 flex-1">
              <p className="text-sm font-medium">{item.titulo}</p>
              <p className="text-xs text-muted-foreground">{item.detalhe}</p>
            </div>
            {item.destino?.aba && <Button size="sm" variant="outline" onClick={() => onAbrirAba(item.destino!.aba!)}>{item.destino.rotulo}</Button>}
            {item.destino?.rota && <Button size="sm" variant="outline" asChild><Link to={item.destino.rota}>{item.destino.rotulo}</Link></Button>}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
