import React, { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Plus, Sparkles, Tag } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { marcadorDe, marcadoresDesconhecidos, type VariavelPrompt } from '@/lib/promptVariaveis';
import type { CategoriaRegra, PromptRegra } from '@/types/promptRegras';

interface PromptRegraModalProps {
  isOpen: boolean;
  onClose: () => void;
  regraEmEdicao?: PromptRegra | null;
  variaveisDisponiveis: VariavelPrompt[];
  onSave: (dados: {
    id?: string;
    titulo: string;
    categoria: CategoriaRegra;
    conteudo: string;
  }) => Promise<void>;
}

const CATEGORIAS: { id: CategoriaRegra; label: string; desc: string }[] = [
  { id: 'comportamento', label: 'Comportamento & Tom', desc: 'Saudação, tom de voz, empatia e regras de diálogo' },
  { id: 'agendamento', label: 'Agendamento & Horários', desc: 'Regras de busca de vagas, confirmação e limites de pets' },
  { id: 'servicos', label: 'Serviços & Protocolos', desc: 'Vacinas, consultas, exames e profilaxia' },
  { id: 'informacoes', label: 'Informações da Empresa', desc: 'Endereço, contatos, horários, Pix e planos aceitos' },
  { id: 'restricoes', label: 'Restrições & Políticas', desc: 'O que a IA NÃO pode fazer (cirurgias direto, estética, etc.)' },
  { id: 'emergencia', label: 'Emergência & Urgência', desc: 'Triagem de sintomas graves e avisos noturnos' },
  { id: 'personalizadas', label: 'Personalizadas da Empresa', desc: 'Avisos da equipe, campanhas e regras livres' },
];

export const PromptRegraModal: React.FC<PromptRegraModalProps> = ({
  isOpen,
  onClose,
  regraEmEdicao,
  variaveisDisponiveis,
  onSave,
}) => {
  const [titulo, setTitulo] = useState('');
  const [categoria, setCategoria] = useState<CategoriaRegra>('personalizadas');
  const [conteudo, setConteudo] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (regraEmEdicao) {
      setTitulo(regraEmEdicao.titulo);
      setCategoria(regraEmEdicao.categoria);
      setConteudo(regraEmEdicao.conteudo);
    } else {
      setTitulo('');
      setCategoria('personalizadas');
      setConteudo('');
    }
  }, [regraEmEdicao, isOpen]);

  const handleInserirVariavel = (tag: string) => {
    const textarea = textareaRef.current;
    if (!textarea) {
      setConteudo((prev) => prev + ` ${tag} `);
      return;
    }

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const novoConteudo = conteudo.substring(0, start) + tag + conteudo.substring(end);
    setConteudo(novoConteudo);

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + tag.length, start + tag.length);
    }, 50);
  };

  const desconhecidas = marcadoresDesconhecidos(conteudo, variaveisDisponiveis);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!titulo.trim() || !conteudo.trim() || desconhecidas.length) return;

    try {
      setIsSaving(true);
      await onSave({
        id: regraEmEdicao?.id,
        titulo: titulo.trim(),
        categoria,
        conteudo: conteudo.trim(),
      });
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Sparkles className="h-5 w-5 text-primary" />
            {regraEmEdicao ? 'Editar Regra do Prompt' : 'Nova Regra para a IA'}
          </DialogTitle>
          <DialogDescription className="text-xs">
            Esta instrução será seguida pelo assistente virtual durante as conversas no WhatsApp e no chat web.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto space-y-4 py-2 pr-1">
          {/* Título da Regra */}
          <div className="space-y-1.5">
            <Label htmlFor="regra-titulo" className="text-xs font-semibold">
              Título explicativo da regra
            </Label>
            <Input
              id="regra-titulo"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Ex: Campanha de vacinação de outono ou Regra para não agendar castração"
              required
              className="text-sm"
            />
          </div>

          {/* Categoria */}
          <div className="space-y-1.5">
            <Label htmlFor="regra-categoria" className="text-xs font-semibold">
              Categoria
            </Label>
            <select
              id="regra-categoria"
              value={categoria}
              onChange={(e) => setCategoria(e.target.value as CategoriaRegra)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            >
              {CATEGORIAS.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.label} — {cat.desc}
                </option>
              ))}
            </select>
          </div>

          {/* Inserir variáveis rápidas */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="regra-conteudo" className="text-xs font-semibold flex items-center gap-1.5">
                <Tag className="h-3.5 w-3.5 text-muted-foreground" />
                Instruções da Regra (o que a IA deve saber ou fazer)
              </Label>
            </div>

            {/* Pílulas de variáveis do sistema */}
            <div className="p-2.5 rounded-lg border bg-muted/40 space-y-1.5">
              <span className="text-[11px] font-medium text-muted-foreground block">
                Variáveis disponíveis (preenchidas a cada mensagem com os dados atuais da empresa):
              </span>
              <div className="flex flex-wrap gap-1.5">
                {variaveisDisponiveis.filter((v) => !v.alias_de).map((v) => (
                  <button
                    key={v.nome}
                    type="button"
                    onClick={() => handleInserirVariavel(marcadorDe(v))}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono bg-background hover:bg-primary/10 hover:text-primary border border-border/80 transition-colors cursor-pointer"
                    title={`${v.descricao}${v.exemplo ? ` — ex.: ${v.exemplo}` : ''}`}
                  >
                    <Plus className="h-3 w-3" />
                    {marcadorDe(v)}
                  </button>
                ))}
              </div>
            </div>

            <Textarea
              ref={textareaRef}
              id="regra-conteudo"
              value={conteudo}
              onChange={(e) => setConteudo(e.target.value)}
              placeholder="Escreva claramente a regra para o assistente virtual. Exemplo: Sempre que o cliente perguntar sobre castração, informe que é necessária consulta prévia e nunca agende direto..."
              className="min-h-[160px] font-mono text-xs leading-5 resize-y"
              required
            />
            {desconhecidas.length > 0 && (
              <p className="flex items-start gap-1.5 rounded-md border border-amber-500/40 bg-amber-500/10 p-2 text-xs text-amber-800 dark:text-amber-300" role="alert">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>Variável desconhecida: <code>{desconhecidas.join(', ')}</code>. Use as variáveis acima (expressões de outras ferramentas, como {'{{ $now }}'}, não funcionam aqui).</span>
              </p>
            )}
            <div className="flex justify-between text-[11px] text-muted-foreground">
              <span>{conteudo.length} caracteres</span>
              {regraEmEdicao?.padrao && (
                <Badge variant="outline" className="text-[10px]">
                  Regra Padrão do Sistema
                </Badge>
              )}
            </div>
          </div>
        </form>

        <DialogFooter className="border-t pt-3 flex items-center justify-end gap-2">
          <Button variant="outline" type="button" onClick={onClose} disabled={isSaving}>
            Cancelar
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={isSaving || !titulo.trim() || !conteudo.trim() || desconhecidas.length > 0}>
            {isSaving ? 'Salvando...' : regraEmEdicao ? 'Salvar Alterações' : 'Adicionar Regra'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
