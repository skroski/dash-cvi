import React from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import PageContainer from '@/components/layout/PageContainer';
import ClientSearchBar from '@/components/clients/ClientSearchBar';
import ClientsTable from '@/components/clients/ClientsTable';
import AddClientDialog from '@/components/clients/AddClientDialog';
import EditClientDialog from '@/components/clients/EditClientDialog';
import ClientDetailSheet from '@/components/clients/ClientDetailSheet';
import { useClientManagement } from '@/hooks/useClientManagement';
import { usePendencias } from '@/hooks/usePendencias';
import { useTags } from '@/hooks/useTags';
import TagManagerDialog from '@/components/tags/TagManagerDialog';
import PendenciaTiposDialog from '@/components/pendencias/PendenciaTiposDialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { ClipboardList, FilterX, Tags, ChevronLeft, ChevronRight } from 'lucide-react';

const ClientsDashboard = () => {
  // Managers state
  const [isTagManagerOpen, setIsTagManagerOpen] = React.useState(false);
  const [isPendenciaTiposOpen, setIsPendenciaTiposOpen] = React.useState(false);

  const { abertasPorCliente } = usePendencias();
  const { tags, tagsPorCliente } = useTags();

  const {
    contacts,
    loadingContacts,
    refreshing,
    selectedContact,
    setSelectedContact,
    searchTerm,
    setSearchTerm,
    statusFilter,
    setStatusFilter,
    hasPetFilter,
    setHasPetFilter,
    petSizeFilter,
    setPetSizeFilter,
    petBreedFilter,
    setPetBreedFilter,
    pendenciasFilter,
    setPendenciasFilter,
    tagFilter,
    setTagFilter,
    sortField,
    sortDirection,
    handleSort,
    page,
    setPage,
    pageSize,
    setPageSize,
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
  } = useClientManagement();

  const fromRecord = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const toRecord = Math.min(page * pageSize, totalCount);

  return (
    <PageContainer>
      <Card className="shadow-sm">
        <CardHeader className="border-b bg-muted/50">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <CardTitle className="text-xl">Gerenciamento de Clientes</CardTitle>
                <CardDescription>Visualize, adicione e edite seus clientes</CardDescription>
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <ClientSearchBar
                  searchTerm={searchTerm}
                  onSearchTermChange={setSearchTerm}
                  onRefresh={handleRefresh}
                  isRefreshing={refreshing}
                  isLoading={loadingContacts}
                />
                <Button
                  variant="outline"
                  onClick={() => setIsTagManagerOpen(true)}
                  className="gap-2"
                >
                  <Tags className="h-4 w-4" />
                  Tags
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setIsPendenciaTiposOpen(true)}
                  className="gap-2"
                >
                  <ClipboardList className="h-4 w-4" />
                  Pendências
                </Button>
                <AddClientDialog
                  isOpen={isAddContactOpen}
                  onOpenChange={setIsAddContactOpen}
                  newContact={newContact}
                  setNewContact={setNewContact}
                  handleAddContact={handleAddContact}
                />
              </div>
            </div>

            {/* Filters Toolbar */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 pt-3 border-t border-border">
              <div className="flex flex-col gap-1.5">
                <span className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">Status</span>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="All">Todos os Status</SelectItem>
                    <SelectItem value="Active">Ativo</SelectItem>
                    <SelectItem value="Inactive">Inativo</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-1.5">
                <span className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">Posse de Pet</span>
                <Select value={hasPetFilter} onValueChange={setHasPetFilter}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="Tem Pet?" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="All">Com ou Sem Pet</SelectItem>
                    <SelectItem value="yes">Possui Pet</SelectItem>
                    <SelectItem value="no">Não possui Pet</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-1.5">
                <span className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">Porte do Pet</span>
                <Select value={petSizeFilter} onValueChange={setPetSizeFilter}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="Porte do Pet" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="All">Todos os Portes</SelectItem>
                    <SelectItem value="Pequeno">Pequeno</SelectItem>
                    <SelectItem value="Médio">Médio</SelectItem>
                    <SelectItem value="Grande">Grande</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-1.5">
                <span className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">Raça do Pet</span>
                <Select value={petBreedFilter} onValueChange={setPetBreedFilter}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="Raça do Pet" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="All">Todas as Raças</SelectItem>
                    {uniqueBreeds.map(breed => (
                      <SelectItem key={breed} value={breed}>{breed}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-1.5">
                <span className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">Pendências</span>
                <Select value={pendenciasFilter} onValueChange={setPendenciasFilter}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="Pendências" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="All">Com ou Sem Pendências</SelectItem>
                    <SelectItem value="with">Com Pendências</SelectItem>
                    <SelectItem value="without">Sem Pendências</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-1.5">
                <span className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">Tag</span>
                <Select value={tagFilter} onValueChange={setTagFilter}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="Tag" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="All">Todas as Tags</SelectItem>
                    <SelectItem value="none">Sem Tags</SelectItem>
                    {tags.map(tag => (
                      <SelectItem key={tag.id} value={String(tag.id)}>
                        <span className="flex items-center gap-2">
                          <span
                            className="h-2.5 w-2.5 rounded-full"
                            style={{ backgroundColor: tag.cor }}
                          />
                          {tag.nome}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <ClientsTable
            contacts={contacts}
            isLoading={loadingContacts}
            searchTerm=""
            tagsPorCliente={tagsPorCliente}
            abertasPorCliente={abertasPorCliente}
            sortField={sortField}
            sortDirection={sortDirection}
            onSort={handleSort}
            onContactClick={handleContactClick}
            onEditClick={openEditModal}
            onMessageClick={handleMessageClick}
            onDeleteClick={(contact) => {
              setSelectedContact(contact);
              setIsDeleteDialogOpen(true);
            }}
          />
        </CardContent>
        <CardFooter className="flex flex-col sm:flex-row items-center justify-between gap-4 border-t bg-muted/50 px-6 py-4">
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span>
              Exibindo <strong className="font-semibold text-foreground">{fromRecord}</strong> a <strong className="font-semibold text-foreground">{toRecord}</strong> de <strong className="font-semibold text-foreground">{totalCount.toLocaleString('pt-BR')}</strong> clientes
            </span>
            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearFilters}
                className="flex h-7 items-center gap-1 px-2 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
              >
                <FilterX className="h-3 w-3" /> Limpar Filtros
              </Button>
            )}
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>Por página:</span>
              <Select value={String(pageSize)} onValueChange={(val) => setPageSize(Number(val))}>
                <SelectTrigger className="h-8 w-16 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="25">25</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => setPage(page - 1)}
                disabled={page <= 1 || loadingContacts}
                title="Página Anterior"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-xs px-2 text-muted-foreground">
                Página <strong className="font-semibold text-foreground">{page}</strong> de <strong className="font-semibold text-foreground">{totalPages}</strong>
              </span>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => setPage(page + 1)}
                disabled={page >= totalPages || loadingContacts}
                title="Próxima Página"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardFooter>
      </Card>

      <ClientDetailSheet
        isOpen={isDetailSheetOpen}
        onOpenChange={setIsDetailSheetOpen}
        selectedContact={selectedContact}
        onEditClick={openEditModal}
        onDeleteClick={() => setIsDeleteDialogOpen(true)}
        onSendMessageClick={handleMessageClick}
        isDeleteDialogOpen={isDeleteDialogOpen}
        setIsDeleteDialogOpen={setIsDeleteDialogOpen}
        handleDeleteContact={handleDeleteContact}
        isMessageDialogOpen={isMessageDialogOpen}
        setIsMessageDialogOpen={setIsMessageDialogOpen}
        messageText={messageText}
        setMessageText={setMessageText}
        handleMessageSubmit={handleMessageSubmit}
        isPauseDurationDialogOpen={isPauseDurationDialogOpen}
        setIsPauseDurationDialogOpen={setIsPauseDurationDialogOpen}
        handlePauseDurationConfirm={handlePauseDurationConfirm}
      />
      
      <EditClientDialog
        isOpen={isEditModalOpen}
        onOpenChange={setIsEditModalOpen}
        selectedContact={selectedContact}
        editContactData={newContact}
        setEditContactData={setNewContact}
        handleEditContact={handleEditContact}
      />

      <TagManagerDialog open={isTagManagerOpen} onOpenChange={setIsTagManagerOpen} />
      <PendenciaTiposDialog open={isPendenciaTiposOpen} onOpenChange={setIsPendenciaTiposOpen} />
    </PageContainer>
  );
};

export default ClientsDashboard;
