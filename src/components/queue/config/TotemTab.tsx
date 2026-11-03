import { ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Switch } from '@/components/ui/switch';
import EnderecoCopiavel from './EnderecoCopiavel';
import type { AbaConfigProps } from './tipos';

/** Totem de autoatendimento: opções e passo a passo de instalação do aparelho. */
export default function TotemTab({ valor, alterar, somenteLeitura }: AbaConfigProps) {
  return (
    <div className="space-y-5">
      <label className="flex items-center justify-between gap-3 rounded-lg border p-3">
        <span>
          <span className="block text-sm font-medium">Perguntar o WhatsApp no totem</span>
          <span className="text-xs text-muted-foreground">
            O tutor pode informar o número para receber os avisos. Só aparece se os avisos por WhatsApp estiverem ligados.
          </span>
        </span>
        <Switch checked={valor.totemPedeTelefone} onCheckedChange={(v) => alterar({ totemPedeTelefone: v })} disabled={somenteLeitura} />
      </label>

      <div className="space-y-2">
        <EnderecoCopiavel rotulo="Totem (tablet ou touch na entrada)" caminho="/totem" />
        <EnderecoCopiavel rotulo="Chamador do consultório (celular ou notebook do veterinário)" caminho="/chamar" />
      </div>

      <div className="space-y-2 rounded-lg border bg-muted/30 p-3 text-sm">
        <p className="flex items-center gap-2 font-semibold">
          <ShieldCheck className="h-4 w-4 text-primary" />
          Como colocar o totem para funcionar
        </p>
        <ol className="list-decimal space-y-1 pl-5 text-xs text-muted-foreground">
          <li>
            Em <Link to="/users" className="font-medium text-primary underline">Usuários</Link>, crie um login para o aparelho com o papel <strong>Totem</strong> (ele só emite senha; as regras do banco bloqueiam os demais dados).
            Antes de instalar, a equipe técnica deve rodar a auditoria de segurança do totem (<code className="rounded bg-muted px-1">select * from public.fila_auditar_totem();</code>) e tratar o que ela listar.
          </li>
          <li>No tablet, abra o endereço do totem, entre com esse login e marque para manter conectado.</li>
          <li>
            Para imprimir sem janela de confirmação, abra o navegador em modo quiosque com <code className="rounded bg-muted px-1">--kiosk --kiosk-printing</code> e deixe a térmica como impressora padrão.
          </li>
          <li>No iPad use Acesso Guiado; no Android, Fully Kiosk Browser ou fixação de tela. Deixe na tomada e sem bloqueio automático.</li>
          <li>Se o aparelho for perdido, desative o login em Usuários: ele deixa de emitir senhas e as regras do banco continuam barrando o resto.</li>
        </ol>
      </div>
    </div>
  );
}
