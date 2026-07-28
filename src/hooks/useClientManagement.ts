import { useState, useEffect, useCallback, useMemo } from 'react';
import { Contact } from '@/types/client';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { getWebhookUrl } from '@/config/env';

export type SortField = 'name' | 'email' | 'phone' | 'petName' | 'status' | 'lastContact';
export type SortDirection = 'asc' | 'desc';

export const useClientManagement = () => {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loadingContacts, setLoadingContacts] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);

  // Search, Filters & Pagination State
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [hasPetFilter, setHasPetFilter] = useState('All');
  const [petSizeFilter, setPetSizeFilter] = useState('All');
  const [petBreedFilter, setPetBreedFilter] = useState('All');
  const [pendenciasFilter, setPendenciasFilter] = useState('All');
  const [tagFilter, setTagFilter] = useState('All');

  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [totalCount, setTotalCount] = useState(0);
  const [uniqueBreeds, setUniqueBreeds] = useState<string[]>([]);

  // Dialog & Modal state
  const [isAddContactOpen, setIsAddContactOpen] = useState(false);
  const [isDetailSheetOpen, setIsDetailSheetOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isMessageDialogOpen, setIsMessageDialogOpen] = useState(false);
  const [isPauseDurationDialogOpen, setIsPauseDurationDialogOpen] = useState(false);
  const [messageText, setMessageText] = useState('');

  const [newContact, setNewContact] = useState<Partial<Contact>>({
    name: '',
    email: '',
    phone: '',
    address: '',
    petName: '',
    petSize: '',
    petBreed: '',
    cpfCnpj: '',
    asaasCustomerId: '',
    status: 'Active',
    notes: '',
  });

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  // Reset page to 1 when filters or search change
  const handleSearchChange = (term: string) => {
    setSearchTerm(term);
    setPage(1);
  };

  const handleStatusFilterChange = (val: string) => {
    setStatusFilter(val);
    setPage(1);
  };

  const handleHasPetFilterChange = (val: string) => {
    setHasPetFilter(val);
    setPage(1);
  };

  const handlePetSizeFilterChange = (val: string) => {
    setPetSizeFilter(val);
    setPage(1);
  };

  const handlePetBreedFilterChange = (val: string) => {
    setPetBreedFilter(val);
    setPage(1);
  };

  const handlePendenciasFilterChange = (val: string) => {
    setPendenciasFilter(val);
    setPage(1);
  };

  const handleTagFilterChange = (val: string) => {
    setTagFilter(val);
    setPage(1);
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      if (sortDirection === 'asc') {
        setSortDirection('desc');
      } else {
        setSortField(null);
        setSortDirection('asc');
      }
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
    setPage(1);
  };

  const hasActiveFilters = useMemo(() => {
    return (
      statusFilter !== 'All' ||
      hasPetFilter !== 'All' ||
      petSizeFilter !== 'All' ||
      petBreedFilter !== 'All' ||
      pendenciasFilter !== 'All' ||
      tagFilter !== 'All' ||
      searchTerm.trim() !== ''
    );
  }, [statusFilter, hasPetFilter, petSizeFilter, petBreedFilter, pendenciasFilter, tagFilter, searchTerm]);

  const handleClearFilters = () => {
    setSearchTerm('');
    setStatusFilter('All');
    setHasPetFilter('All');
    setPetSizeFilter('All');
    setPetBreedFilter('All');
    setPendenciasFilter('All');
    setTagFilter('All');
    setSortField(null);
    setSortDirection('asc');
    setPage(1);
  };

  const fetchUniqueBreeds = useCallback(async () => {
    try {
      const { data } = await supabase
        .from('dados_cliente')
        .select('raca_pet')
        .not('raca_pet', 'is', null);

      if (data) {
        const breeds = new Set<string>();
        data.forEach(item => {
          if (item.raca_pet && item.raca_pet.trim()) {
            breeds.add(item.raca_pet.trim());
          }
        });
        setUniqueBreeds(Array.from(breeds).sort());
      }
    } catch (err) {
      console.error('Erro ao carregar raças de pets:', err);
    }
  }, []);

  const fetchClients = useCallback(async () => {
    try {
      setLoadingContacts(true);

      let query = supabase
        .from('dados_cliente')
        .select('*', { count: 'exact' });

      // 1. Termo de busca (nome, email, telefone, nome_pet, cpf_cnpj)
      const cleanSearch = searchTerm.trim();
      if (cleanSearch) {
        const sanitized = cleanSearch.replace(/[,()]/g, '');
        if (sanitized) {
          query = query.or(
            `nome.ilike.%${sanitized}%,email.ilike.%${sanitized}%,telefone.ilike.%${sanitized}%,nome_pet.ilike.%${sanitized}%,cpf_cnpj.ilike.%${sanitized}%`
          );
        }
      }

      // 2. Filtro de Posse de Pet
      if (hasPetFilter === 'yes') {
        query = query.not('nome_pet', 'is', null).neq('nome_pet', '');
      } else if (hasPetFilter === 'no') {
        query = query.or('nome_pet.is.null,nome_pet.eq.');
      }

      // 3. Filtro de Porte do Pet
      if (petSizeFilter !== 'All') {
        query = query.ilike('porte_pet', petSizeFilter);
      }

      // 4. Filtro de Raça do Pet
      if (petBreedFilter !== 'All') {
        query = query.eq('raca_pet', petBreedFilter);
      }

      // 5. Filtro de Pendências (com/sem pendências abertas)
      if (pendenciasFilter !== 'All') {
        const { data: pendenciesData } = await supabase
          .from('client_pendencias')
          .select('client_id')
          .eq('status', 'pendente');

        const clientIdsWithPendencies = Array.from(
          new Set((pendenciesData || []).map(p => p.client_id))
        );

        if (pendenciasFilter === 'with') {
          if (clientIdsWithPendencies.length === 0) {
            query = query.in('id', [-1]);
          } else {
            query = query.in('id', clientIdsWithPendencies);
          }
        } else if (pendenciasFilter === 'without') {
          if (clientIdsWithPendencies.length > 0) {
            query = query.not('id', 'in', `(${clientIdsWithPendencies.join(',')})`);
          }
        }
      }

      // 6. Filtro de Tags
      if (tagFilter !== 'All') {
        if (tagFilter === 'none') {
          const { data: allTagged } = await supabase
            .from('client_tags')
            .select('client_id');
          const taggedClientIds = Array.from(
            new Set((allTagged || []).map(t => t.client_id))
          );
          if (taggedClientIds.length > 0) {
            query = query.not('id', 'in', `(${taggedClientIds.join(',')})`);
          }
        } else {
          const tagIdNum = parseInt(tagFilter, 10);
          if (!isNaN(tagIdNum)) {
            const { data: tagMatches } = await supabase
              .from('client_tags')
              .select('client_id')
              .eq('tag_id', tagIdNum);
            const clientIds = Array.from(
              new Set((tagMatches || []).map(t => t.client_id))
            );
            if (clientIds.length === 0) {
              query = query.in('id', [-1]);
            } else {
              query = query.in('id', clientIds);
            }
          }
        }
      }

      // 7. Ordenação Server-side
      const sortColumnMap: Record<string, string> = {
        name: 'nome',
        email: 'email',
        phone: 'telefone',
        petName: 'nome_pet',
        status: 'id',
        lastContact: 'created_at',
      };

      const dbSortCol = sortField ? (sortColumnMap[sortField] || 'created_at') : 'created_at';
      const isAsc = sortDirection === 'asc';
      query = query.order(dbSortCol, { ascending: isAsc, nullsFirst: false });
      if (dbSortCol !== 'id') {
        query = query.order('id', { ascending: isAsc });
      }

      // 8. Paginação Server-side
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      query = query.range(from, to);

      const { data, count, error } = await query;

      if (error) {
        throw error;
      }

      if (data) {
        const formattedContacts: Contact[] = data.map(client => ({
          id: client.id.toString(),
          name: client.nome || 'Cliente sem nome',
          email: client.email,
          phone: client.telefone,
          petName: client.nome_pet,
          petSize: client.porte_pet,
          petBreed: client.raca_pet,
          cpfCnpj: client.cpf_cnpj,
          asaasCustomerId: client.asaas_customer_id,
          payments: client.payments,
          status: 'Active',
          notes: '',
          lastContact: client.created_at ? new Date(client.created_at).toLocaleDateString('pt-BR') : 'Desconhecido'
        }));

        setContacts(formattedContacts);
        setTotalCount(count ?? 0);
      }
    } catch (error) {
      console.error('Error fetching clients:', error);
      toast.error("Erro ao carregar clientes", { description: "Ocorreu um erro ao buscar os clientes do banco de dados." });
    } finally {
      setLoadingContacts(false);
      setRefreshing(false);
    }
  }, [searchTerm, statusFilter, hasPetFilter, petSizeFilter, petBreedFilter, pendenciasFilter, tagFilter, sortField, sortDirection, page, pageSize]);

  useEffect(() => {
    fetchClients();
  }, [fetchClients]);

  useEffect(() => {
    fetchUniqueBreeds();
  }, [fetchUniqueBreeds]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchClients();
    fetchUniqueBreeds();
    toast.success("Atualizando dados", { description: "Os dados da tabela estão sendo atualizados." });
  };

  const handleContactClick = (contact: Contact) => {
    setSelectedContact(contact);
    setIsDetailSheetOpen(true);
  };

  const handleAddContact = async () => {
    if (!newContact.name || !newContact.phone) {
      toast.error("Campos obrigatórios", { description: "Nome e telefone são campos obrigatórios." });
      return;
    }

    try {
      const { data, error } = await supabase
        .from('dados_cliente')
        .insert([
          {
            nome: newContact.name,
            email: newContact.email,
            telefone: newContact.phone,
            nome_pet: newContact.petName,
            porte_pet: newContact.petSize,
            raca_pet: newContact.petBreed,
            cpf_cnpj: newContact.cpfCnpj,
            asaas_customer_id: newContact.asaasCustomerId,
            payments: newContact.payments || null
          }
        ])
        .select();

      if (error) throw error;

      if (data && data.length > 0) {
        fetchClients();
        fetchUniqueBreeds();

        setNewContact({
          name: '',
          email: '',
          phone: '',
          address: '',
          petName: '',
          petSize: '',
          petBreed: '',
          cpfCnpj: '',
          asaasCustomerId: '',
          status: 'Active',
          notes: '',
        });

        setIsAddContactOpen(false);

        toast.success("Cliente adicionado", { description: `${newContact.name} foi adicionado com sucesso.` });

        try {
          await fetch(getWebhookUrl('cria_usuario', '/cria_usuario'), {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(newContact),
          });
        } catch (webhookError) {
          console.error('Erro ao enviar para webhook:', webhookError);
        }
      }
    } catch (error) {
      console.error('Erro ao cadastrar cliente:', error);
      toast.error("Erro ao adicionar cliente", { description: "Não foi possível salvar o cliente no banco de dados." });
    }
  };

  const handleEditContact = async () => {
    if (!selectedContact) return;

    try {
      const { error } = await supabase
        .from('dados_cliente')
        .update({
          nome: newContact.name,
          email: newContact.email,
          telefone: newContact.phone,
          nome_pet: newContact.petName,
          porte_pet: newContact.petSize,
          raca_pet: newContact.petBreed,
          cpf_cnpj: newContact.cpfCnpj,
          asaas_customer_id: newContact.asaasCustomerId,
          payments: newContact.payments
        })
        .eq('id', parseInt(selectedContact.id));

      if (error) throw error;

      fetchClients();
      fetchUniqueBreeds();

      setIsEditModalOpen(false);

      toast.success("Cliente atualizado", { description: `As informações de ${selectedContact.name} foram atualizadas.` });

      try {
        await fetch(getWebhookUrl('edita_usuario', '/edita_usuario'), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            id: selectedContact.id,
            ...newContact
          }),
        });
      } catch (webhookError) {
        console.error('Erro ao enviar para webhook:', webhookError);
      }
    } catch (error) {
      console.error('Erro ao atualizar cliente:', error);
      toast.error("Erro ao atualizar cliente", { description: "Não foi possível atualizar o cliente no banco de dados." });
    }
  };

  const handleDeleteContact = async () => {
    if (!selectedContact) return;

    try {
      const { error } = await supabase
        .from('dados_cliente')
        .delete()
        .eq('id', parseInt(selectedContact.id));

      if (error) throw error;

      fetchClients();
      fetchUniqueBreeds();

      setSelectedContact(null);
      setIsDetailSheetOpen(false);
      setIsDeleteDialogOpen(false);

      toast.error("Cliente removido", { description: `${selectedContact.name} foi removido da sua lista de clientes.` });

      try {
        await fetch(getWebhookUrl('exclui_usuario', '/exclui_usuario'), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ phone: selectedContact.phone }),
        });
      } catch (webhookError) {
        console.error('Erro ao enviar para webhook:', webhookError);
      }
    } catch (error) {
      console.error('Erro ao excluir cliente:', error);
      toast.error("Erro ao remover cliente", { description: "Não foi possível remover o cliente do banco de dados." });
      setIsDeleteDialogOpen(false);
    }
  };

  const openEditModal = (contact?: Contact) => {
    const target = contact || selectedContact;
    if (!target) return;
    setSelectedContact(target);
    setNewContact({
      name: target.name,
      email: target.email,
      phone: target.phone,
      address: target.address,
      petName: target.petName,
      petSize: target.petSize,
      petBreed: target.petBreed,
      cpfCnpj: target.cpfCnpj,
      asaasCustomerId: target.asaasCustomerId,
      payments: target.payments,
      status: target.status,
      notes: target.notes,
    });
    setIsEditModalOpen(true);
  };

  const handleMessageClick = (contact?: Contact) => {
    const target = contact || selectedContact;
    if (!target) return;
    setSelectedContact(target);
    setMessageText('');
    setIsMessageDialogOpen(true);
  };

  const handleMessageSubmit = () => {
    if (!messageText.trim() || !selectedContact) return;

    setIsMessageDialogOpen(false);
    setIsPauseDurationDialogOpen(true);
  };

  const handlePauseDurationConfirm = async (duration: number | null) => {
    if (!selectedContact) return;

    try {
      const response = await fetch(getWebhookUrl('mensagem', '/envia_mensagem'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          phone: selectedContact.phone,
          message: messageText,
          pauseDuration: duration
        }),
      });

      if (!response.ok) {
        throw new Error('Falha ao enviar dados para o webhook');
      }

      setIsPauseDurationDialogOpen(false);

      toast.success("Mensagem enviada", {
        description: duration === null
          ? `Mensagem enviada para ${selectedContact.name} sem pausar o bot.`
          : `Mensagem enviada para ${selectedContact.name}. O bot ficará pausado até ser reativado manualmente.`,
      });
    } catch (error) {
      console.error('Erro ao enviar mensagem:', error);
      setIsPauseDurationDialogOpen(false);

      toast.error("Erro ao enviar mensagem", { description: "Não foi possível enviar a mensagem para o servidor." });
    }
  };

  return {
    contacts,
    loadingContacts,
    refreshing,
    selectedContact,
    setSelectedContact,
    searchTerm,
    setSearchTerm: handleSearchChange,
    statusFilter,
    setStatusFilter: handleStatusFilterChange,
    hasPetFilter,
    setHasPetFilter: handleHasPetFilterChange,
    petSizeFilter,
    setPetSizeFilter: handlePetSizeFilterChange,
    petBreedFilter,
    setPetBreedFilter: handlePetBreedFilterChange,
    pendenciasFilter,
    setPendenciasFilter: handlePendenciasFilterChange,
    tagFilter,
    setTagFilter: handleTagFilterChange,
    sortField,
    sortDirection,
    handleSort,
    page,
    setPage,
    pageSize,
    setPageSize: (ps: number) => {
      setPageSize(ps);
      setPage(1);
    },
    totalCount,
    totalPages,
    uniqueBreeds,
    hasActiveFilters,
    handleClearFilters,
    isAddContactOpen,
    setIsAddContactOpen,
    isDetailSheetOpen,
    setIsDetailSheetOpen,
    isEditModalOpen,
    setIsEditModalOpen,
    isDeleteDialogOpen,
    setIsDeleteDialogOpen,
    isMessageDialogOpen,
    setIsMessageDialogOpen,
    isPauseDurationDialogOpen,
    setIsPauseDurationDialogOpen,
    messageText,
    setMessageText,
    newContact,
    setNewContact,
    handleRefresh,
    handleContactClick,
    handleAddContact,
    handleEditContact,
    handleDeleteContact,
    openEditModal,
    handleMessageClick,
    handleMessageSubmit,
    handlePauseDurationConfirm
  };
};
