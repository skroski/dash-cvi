import { useState, useEffect, useRef, useCallback } from 'react';
import { Search, Loader2, User, Dog, Phone, X, CheckCircle2, UserPlus, Sparkles } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export interface ClientSearchResult {
  id: number;
  nome: string | null;
  telefone: string | null;
  nome_pet: string | null;
  raca_pet: string | null;
  porte_pet: string | null;
}

export interface SelectedClientData {
  clienteId: number;
  tutorName: string;
  petName: string;
  petId?: string;
  phone?: string | null;
}

interface QueueClientSearchProps {
  selectedClient: SelectedClientData | null;
  onSelectClient: (client: SelectedClientData) => void;
  onClearSelection: () => void;
  onOpenQuickRegister?: () => void;
}

function formatPhoneDisplay(rawPhone?: string | null): string {
  if (!rawPhone) return '';
  const digits = rawPhone.replace(/\D/g, '');
  if (digits.length === 13 && digits.startsWith('55')) {
    const ddd = digits.slice(2, 4);
    const num = digits.slice(4);
    return `(${ddd}) ${num.slice(0, 5)}-${num.slice(5)}`;
  }
  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }
  return rawPhone.replace('@s.whatsapp.net', '');
}

export default function QueueClientSearch({
  selectedClient,
  onSelectClient,
  onClearSelection,
  onOpenQuickRegister,
}: QueueClientSearchProps) {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<ClientSearchResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [candidateTutor, setCandidateTutor] = useState<ClientSearchResult | null>(null);
  const [tutorPets, setTutorPets] = useState<Array<{ petName: string; petId: string; raca?: string }>>([]);

  const containerRef = useRef<HTMLDivElement>(null);

  // Fecha dropdown se clicar fora
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Busca no Supabase (dados_cliente) por nome, telefone ou nome do pet
  const performSearch = useCallback(async (searchTerm: string) => {
    const clean = searchTerm.trim().replace(/[,()]/g, '');
    if (!clean || clean.length < 2) {
      setResults([]);
      setIsOpen(false);
      return;
    }

    setLoading(true);
    try {
      // Busca simultânea por nome do tutor, telefone ou nome do pet
      const { data, error } = await supabase
        .from('dados_cliente')
        .select('id, nome, telefone, nome_pet, raca_pet, porte_pet')
        .or(`nome.ilike.%${clean}%,telefone.ilike.%${clean}%,nome_pet.ilike.%${clean}%`)
        .order('id', { ascending: false })
        .limit(10);

      if (error) {
        console.warn('Erro ao pesquisar clientes na fila:', error);
        setResults([]);
      } else {
        setResults((data as ClientSearchResult[]) || []);
        setIsOpen(true);
      }
    } catch (err) {
      console.warn('Exceção ao buscar clientes:', err);
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Debounce de 300ms
  useEffect(() => {
    if (!query || selectedClient) {
      setResults([]);
      setIsOpen(false);
      return;
    }
    const timer = setTimeout(() => {
      performSearch(query);
    }, 300);
    return () => clearTimeout(timer);
  }, [query, performSearch, selectedClient]);

  // Ao selecionar um resultado inicial da lista
  const handleSelectResult = async (item: ClientSearchResult) => {
    setCandidateTutor(item);

    // Busca todos os registros vinculados ao mesmo tutor (por telefone ou nome) para listar múltiplos pets
    try {
      const tutorPhone = item.telefone ? item.telefone.replace(/\D/g, '') : '';
      let filter = `nome.eq.${item.nome || ''}`;
      if (tutorPhone && tutorPhone.length >= 8) {
        filter = `telefone.ilike.%${tutorPhone.slice(-8)}%,nome.eq.${item.nome || ''}`;
      }

      const { data: siblings } = await supabase
        .from('dados_cliente')
        .select('id, nome_pet, raca_pet')
        .or(filter);

      const foundPetsMap = new Map<string, { petName: string; petId: string; raca?: string }>();

      // Inclui o pet do próprio item se houver
      if (item.nome_pet && item.nome_pet.trim()) {
        foundPetsMap.set(item.nome_pet.trim().toLowerCase(), {
          petName: item.nome_pet.trim(),
          petId: String(item.id),
          raca: item.raca_pet || undefined,
        });
      }

      // Inclui pets dos irmãos
      if (siblings && siblings.length > 0) {
        siblings.forEach((s) => {
          if (s.nome_pet && s.nome_pet.trim()) {
            const key = s.nome_pet.trim().toLowerCase();
            if (!foundPetsMap.has(key)) {
              foundPetsMap.set(key, {
                petName: s.nome_pet.trim(),
                petId: String(s.id),
                raca: s.raca_pet || undefined,
              });
            }
          }
        });
      }

      const petsList = Array.from(foundPetsMap.values());
      setTutorPets(petsList);

      // Se houver apenas 1 pet ou nenhum, finaliza a seleção direto
      if (petsList.length <= 1) {
        const petToUse = petsList[0] || { petName: item.nome_pet || '', petId: String(item.id) };
        onSelectClient({
          clienteId: item.id,
          tutorName: item.nome || 'Cliente',
          petName: petToUse.petName,
          petId: petToUse.petId,
          phone: item.telefone,
        });
        setIsOpen(false);
        setCandidateTutor(null);
        setQuery('');
      } else {
        // Mostra o seletor de múltiplos pets do tutor
        setIsOpen(true);
      }
    } catch (err) {
      console.warn('Erro ao buscar pets vinculados:', err);
      onSelectClient({
        clienteId: item.id,
        tutorName: item.nome || 'Cliente',
        petName: item.nome_pet || '',
        petId: String(item.id),
        phone: item.telefone,
      });
      setIsOpen(false);
      setCandidateTutor(null);
      setQuery('');
    }
  };

  const handlePickPet = (pet: { petName: string; petId: string }) => {
    if (!candidateTutor) return;
    onSelectClient({
      clienteId: candidateTutor.id,
      tutorName: candidateTutor.nome || 'Cliente',
      petName: pet.petName,
      petId: pet.petId,
      phone: candidateTutor.telefone,
    });
    setCandidateTutor(null);
    setTutorPets([]);
    setIsOpen(false);
    setQuery('');
  };

  // Se já há um cliente selecionado, mostra o card de confirmação com opção de desmarcar
  if (selectedClient) {
    return (
      <div className="rounded-lg border border-emerald-300/80 bg-emerald-50/70 p-3 dark:border-emerald-900/60 dark:bg-emerald-950/20">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-2.5">
            <div className="mt-0.5 grid h-7 w-7 place-items-center rounded-full bg-emerald-500/20 text-emerald-700 dark:text-emerald-300">
              <CheckCircle2 className="h-4 w-4" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs font-semibold text-emerald-950 dark:text-emerald-100">
                  {selectedClient.tutorName}
                </span>
                <Badge variant="outline" className="h-4 border-emerald-500/40 bg-emerald-500/10 text-[10px] text-emerald-700 dark:text-emerald-300">
                  Cadastro #{selectedClient.clienteId}
                </Badge>
              </div>
              <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span className="flex items-center gap-1 font-medium text-foreground">
                  <Dog className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                  {selectedClient.petName || 'Pet não informado'}
                </span>
                {selectedClient.phone && (
                  <span className="flex items-center gap-1">
                    <Phone className="h-3 w-3 opacity-60" />
                    {formatPhoneDisplay(selectedClient.phone)}
                  </span>
                )}
              </div>
            </div>
          </div>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 gap-1 text-xs text-muted-foreground hover:text-foreground"
            onClick={onClearSelection}
            title="Remover vínculo e preencher manualmente"
          >
            <X className="h-3.5 w-3.5" />
            <span>Alterar</span>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative space-y-1">
      <div className="relative">
        <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            if (!e.target.value) {
              setIsOpen(false);
              setCandidateTutor(null);
            }
          }}
          placeholder="Buscar cliente por tutor, telefone ou pet..."
          className="h-9 pl-8 pr-8 text-xs"
          onFocus={() => {
            if (results.length > 0) setIsOpen(true);
          }}
        />
        {loading ? (
          <Loader2 className="absolute right-2.5 top-2.5 h-3.5 w-3.5 animate-spin text-muted-foreground" />
        ) : query ? (
          <button
            type="button"
            onClick={() => {
              setQuery('');
              setIsOpen(false);
              setCandidateTutor(null);
            }}
            className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>

      {/* Dropdown de resultados e seleção de pets */}
      {isOpen && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-64 overflow-y-auto rounded-md border bg-popover p-1 shadow-lg">
          {candidateTutor && tutorPets.length > 1 ? (
            <div className="p-2 space-y-2">
              <div className="flex items-center justify-between border-b pb-1.5">
                <div>
                  <p className="text-xs font-semibold text-foreground">
                    Selecione o pet de {candidateTutor.nome}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    Este tutor possui {tutorPets.length} pets cadastrados
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 text-[11px]"
                  onClick={() => setCandidateTutor(null)}
                >
                  Voltar
                </Button>
              </div>

              <div className="grid gap-1.5">
                {tutorPets.map((p) => (
                  <button
                    key={p.petId + p.petName}
                    type="button"
                    onClick={() => handlePickPet(p)}
                    className="flex items-center justify-between rounded-md border border-border/70 p-2 text-left text-xs transition hover:bg-muted/80"
                  >
                    <div className="flex items-center gap-2">
                      <div className="grid h-6 w-6 place-items-center rounded-full bg-emerald-500/10 text-emerald-600">
                        <Dog className="h-3.5 w-3.5" />
                      </div>
                      <div>
                        <p className="font-semibold text-foreground">{p.petName}</p>
                        {p.raca && (
                          <p className="text-[10px] text-muted-foreground">Raça: {p.raca}</p>
                        )}
                      </div>
                    </div>
                    <Badge variant="outline" className="text-[10px]">
                      Selecionar
                    </Badge>
                  </button>
                ))}
              </div>
            </div>
          ) : results.length > 0 ? (
            <div className="divide-y divide-border/40">
              <div className="px-2 py-1 text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                Cadastros Encontrados no C.V.I.
              </div>
              {results.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => handleSelectResult(r)}
                  className="flex w-full items-center justify-between px-2.5 py-2 text-left transition hover:bg-muted/70 rounded"
                >
                  <div className="flex items-start gap-2">
                    <div className="mt-0.5 grid h-6 w-6 place-items-center rounded-full bg-primary/10 text-primary">
                      <User className="h-3.5 w-3.5" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-foreground leading-tight">
                        {r.nome || 'Sem Nome'}
                      </p>
                      <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                        {r.nome_pet && (
                          <span className="flex items-center gap-0.5 font-medium text-emerald-600 dark:text-emerald-400">
                            <Dog className="h-3 w-3" />
                            {r.nome_pet}
                            {r.raca_pet && ` (${r.raca_pet})`}
                          </span>
                        )}
                        {r.telefone && (
                          <span className="flex items-center gap-0.5">
                            <Phone className="h-3 w-3 opacity-60" />
                            {formatPhoneDisplay(r.telefone)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <span className="text-[10px] text-muted-foreground font-mono">
                    #{r.id}
                  </span>
                </button>
              ))}
            </div>
          ) : query.length >= 2 && !loading ? (
            <div className="p-3 text-center">
              <p className="text-xs text-muted-foreground">Nenhum cliente cadastrado com esse termo.</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                Você pode prosseguir preenchendo os dados manuais abaixo.
              </p>
              {onOpenQuickRegister && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-2 h-7 gap-1 text-xs"
                  onClick={() => {
                    setIsOpen(false);
                    onOpenQuickRegister();
                  }}
                >
                  <UserPlus className="h-3 w-3" />
                  Cadastrar Cliente no CRM
                </Button>
              )}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
