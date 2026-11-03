import { AlertTriangle, MessageCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { WPP_VARIAVEIS, type FilaConfig } from '@/types/filaConfig';
import type { AbaConfigProps } from './tipos';

type CampoMensagem = 'wppMsgEmissao' | 'wppMsgProximo' | 'wppMsgChamada' | 'wppMsgAusente';

const MENSAGENS: Array<{ campo: CampoMensagem; titulo: string; quando: string; ligar?: keyof FilaConfig }> = [
  { campo: 'wppMsgEmissao', titulo: 'Senha emitida', quando: 'Quando a senha é gerada com telefone informado.', ligar: 'wppAvisarEmissao' },
  { campo: 'wppMsgProximo', titulo: 'Sua vez está chegando', quando: 'Quando restam poucas pessoas à frente (veja o número abaixo).' },
  { campo: 'wppMsgChamada', titulo: 'Senha chamada', quando: 'Na primeira chamada (repetir a chamada na TV não manda outra mensagem).', ligar: 'wppAvisarChamada' },
  { campo: 'wppMsgAusente', titulo: 'Não compareceu', quando: 'Quando o paciente é marcado como ausente.', ligar: 'wppAvisarAusente' },
];

function previa(texto: string): string {
  return WPP_VARIAVEIS.reduce((acc, v) => acc.split(v.chave).join(v.exemplo), texto).replace(/\{\{[a-z_]+\}\}/g, '');
}

/** Avisos ao tutor por WhatsApp. Usa a mesma fila de envio do atendimento (outbox). */
export default function WhatsappTab({ valor, alterar, somenteLeitura }: AbaConfigProps) {
  const inserir = (campo: CampoMensagem, chave: string) => alterar({ [campo]: `${valor[campo]}${valor[campo] && !valor[campo].endsWith(' ') ? ' ' : ''}${chave}` });

  return (
    <div className="space-y-5">
      <label className="flex items-center justify-between gap-3 rounded-lg border p-3">
        <span className="flex items-start gap-3">
          <MessageCircle className="mt-0.5 h-5 w-5 text-primary" />
          <span>
            <span className="block text-sm font-semibold">Avisar o tutor pelo WhatsApp</span>
            <span className="text-xs text-muted-foreground">Desligado de fábrica. Só envia para senhas que tenham telefone.</span>
          </span>
        </span>
        <Switch checked={valor.whatsappAtivo} onCheckedChange={(v) => alterar({ whatsappAtivo: v })} disabled={somenteLeitura} />
      </label>

      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle className="text-sm">Para enviar de verdade são necessárias 3 chaves</AlertTitle>
        <AlertDescription className="text-xs">
          1) esta chave; 2) o segredo <code className="rounded bg-muted px-1">ATENDIMENTO_SEND_ENABLED=true</code> nas Edge Functions; 3) a instância Uazapi conectada (menu Conexão WhatsApp). As mensagens saem pela mesma
          fila do atendimento, respeitam a lista de bloqueio e não aparecem no histórico da conversa. Cada telefone recebe no máximo 3 confirmações de senha por hora.
        </AlertDescription>
      </Alert>

      <label className="flex items-center justify-between gap-3 rounded-lg border p-3">
        <span>
          <span className="block text-sm font-medium">Só avisar quem já conversou com a clínica no WhatsApp</span>
          <span className="text-xs text-muted-foreground">
            Recomendado. Desligado, o primeiro aviso a um número que nunca falou com a clínica sai pela instância não oficial e aumenta o risco de bloqueio
            do número. Desligue só com o consentimento do tutor (balcão ou totem).
          </span>
        </span>
        <Switch checked={valor.wppSomenteConhecidos} onCheckedChange={(v) => alterar({ wppSomenteConhecidos: v })} disabled={somenteLeitura} />
      </label>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex items-center justify-between gap-3 rounded-lg border p-3 sm:col-span-2">
          <span>
            <span className="block text-sm font-medium">&quot;Sua vez está chegando&quot; quando faltarem até</span>
            <span className="text-xs text-muted-foreground">Número de pessoas à frente. 0 desliga este aviso.</span>
          </span>
          <Input
            type="number"
            min={0}
            max={20}
            value={valor.wppAvisarProximo}
            onChange={(e) => alterar({ wppAvisarProximo: Math.min(20, Math.max(0, Number(e.target.value) || 0)) })}
            className="h-9 w-20"
            disabled={somenteLeitura}
          />
        </div>
      </div>

      <div className="space-y-3">
        {MENSAGENS.map((m) => (
          <div key={m.campo} className="space-y-2 rounded-lg border p-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <Label className="text-sm font-semibold">{m.titulo}</Label>
                <p className="text-xs text-muted-foreground">{m.quando}</p>
              </div>
              {m.ligar && <Switch checked={Boolean(valor[m.ligar])} onCheckedChange={(v) => alterar({ [m.ligar as string]: v })} disabled={somenteLeitura} aria-label={`Enviar: ${m.titulo}`} />}
            </div>
            <Textarea value={valor[m.campo]} onChange={(e) => alterar({ [m.campo]: e.target.value })} rows={3} maxLength={600} disabled={somenteLeitura} className="text-sm" />
            <div className="flex flex-wrap gap-1.5">
              {WPP_VARIAVEIS.map((v) => (
                <button
                  key={v.chave}
                  type="button"
                  title={v.descricao}
                  disabled={somenteLeitura}
                  onClick={() => inserir(m.campo, v.chave)}
                  className="rounded-full border bg-muted/40 px-2 py-0.5 font-mono text-[11px] hover:bg-muted"
                >
                  {v.chave}
                </button>
              ))}
            </div>
            <p className="whitespace-pre-wrap rounded-md bg-emerald-50 p-2 text-xs text-emerald-950 dark:bg-emerald-950/30 dark:text-emerald-100">{previa(valor[m.campo]) || 'Mensagem vazia'}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
