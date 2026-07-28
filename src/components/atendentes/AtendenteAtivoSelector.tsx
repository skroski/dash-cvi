import { UserRound } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAtendentes } from '@/hooks/useAtendentes';
import { useAtendenteAtivo } from '@/context/AtendenteAtivoContext';

/**
 * Seletor global (header) do atendente em uso no painel. Define o filtro
 * "Atribuídas" das conversas e a identificação padrão do input do chat.
 *
 * Para quem tem papel `atendente`, a identidade vem do login e o seletor vira
 * apenas um indicador (sem troca).
 */
const AtendenteAtivoSelector = () => {
  const { atendentes, setupError } = useAtendentes();
  const { atendenteAtivoId, atendenteAtivo, setAtendenteAtivoId, podeAlternar } =
    useAtendenteAtivo();

  const atendentesAtivos = atendentes.filter((a) => a.ativo);
  // Mantém o atendente selecionado visível mesmo se for desativado depois
  if (atendenteAtivo && !atendentesAtivos.some((a) => a.id === atendenteAtivo.id)) {
    atendentesAtivos.push(atendenteAtivo);
  }

  if (setupError || atendentesAtivos.length === 0) return null;

  if (!podeAlternar) {
    return (
      <span
        className="flex h-8 items-center gap-1.5 rounded-md border border-input bg-muted/40 px-2.5 text-xs font-medium"
        title="Identidade definida pelo seu login"
      >
        <UserRound className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
        <span className="max-w-[120px] truncate">{atendenteAtivo?.nome ?? 'Atendente'}</span>
      </span>
    );
  }

  return (
    <Select
      value={atendenteAtivoId !== null ? String(atendenteAtivoId) : 'none'}
      onValueChange={(value) =>
        setAtendenteAtivoId(value === 'none' ? null : Number(value))
      }
    >
      <SelectTrigger
        className="h-8 w-[160px] gap-1.5 text-xs"
        aria-label="Atendente em uso no painel"
        title="Quem está usando o painel: filtra as conversas atribuídas e assina as mensagens enviadas"
      >
        <UserRound
          className="h-3.5 w-3.5 shrink-0 text-muted-foreground"
          aria-hidden="true"
        />
        <SelectValue placeholder="Atendente" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="none">Sem atendente</SelectItem>
        {atendentesAtivos.map((atendente) => (
          <SelectItem key={atendente.id} value={String(atendente.id)}>
            {atendente.nome}
            {!atendente.ativo && ' (inativo)'}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};

export default AtendenteAtivoSelector;
