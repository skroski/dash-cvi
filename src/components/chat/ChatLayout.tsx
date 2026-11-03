import React, { useState } from 'react';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';
import ConversationList from './ConversationList';
import ChatArea from './ChatArea';
import ClientInfoPanel from './ClientInfoPanel';
import ClientInfoSheet from './ClientInfoSheet';
import ConversationSubHeader, { ChatFilterCounts } from './ConversationSubHeader';
import MessagesSubHeader from './MessagesSubHeader';
import ClientSubHeader from './ClientSubHeader';
import { Conversation, ChatMessage, ChatViewMode, ConversationAssignmentFilter, ConversationStatusFilter } from '@/types/chat';
import { ClientPendencia, Tag } from '@/types/crm';
import { PauseStatusMap } from '@/hooks/useRedisPauseStatus';
import { useIsMobile } from '@/hooks/use-mobile';

interface ChatLayoutProps {
  conversations: Conversation[];
  selectedChat: string | null;
  setSelectedChat: (id: string | null) => void;
  isLoading: Record<string, boolean>;
  openPauseDialog: (phoneNumber: string, e: React.MouseEvent) => void;
  startBot: (phoneNumber: string, e: React.MouseEvent) => void;
  loading: boolean;
  loadingMore?: boolean;
  hasMore?: boolean;
  onLoadMore?: () => void;
  messages: ChatMessage[];
  handleNewMessage: (message: ChatMessage) => void;
  selectedConversation?: Conversation;
  markConversationRead: (sessionId: string) => void;
  onSearchMessages?: (searchTerm: string) => void;
  onSearchConversations?: (searchTerm: string) => void;
  conversationSearchValue?: string;
  conversationCount?: number;
  searchingConversations?: boolean;
  pauseStatus?: PauseStatusMap;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  showOnlyPaused?: boolean;
  onTogglePausedFilter?: () => void;
  showOnlyUnanswered?: boolean;
  onToggleUnansweredFilter?: () => void;
  showOnlyPendencias?: boolean;
  onTogglePendenciasFilter?: () => void;
  viewMode?: ChatViewMode;
  showInactiveGroups?: boolean;
  onToggleInactiveGroupsFilter?: () => void;
  inactiveGroupsCount?: number;
  tagFilterId?: number | null;
  onTagFilterChange?: (tagId: number | null) => void;
  tags?: Tag[];
  statusFilter?: ConversationStatusFilter;
  onStatusFilterChange?: (status: ConversationStatusFilter) => void;
  assignmentFilter?: ConversationAssignmentFilter;
  onAssignmentFilterChange?: (filter: ConversationAssignmentFilter) => void;
  atendenteAtivoNome?: string | null;
  filterCounts?: ChatFilterCounts;
  tagsPorCliente?: Map<number, Tag[]>;
  abertasPorCliente?: Map<number, ClientPendencia[]>;
  onConversationUpdate?: () => void;
  onRefreshMessages?: () => void;
  isRefreshingMessages?: boolean;
  updateConversationLocal?: (sessionId: string, data: Partial<Conversation>) => void;
  onHistoryDeleted?: (sessionId: string) => void;
  conversationPageSize?: number;
}

const ChatLayout = ({
  conversations,
  selectedChat,
  setSelectedChat,
  isLoading,
  openPauseDialog,
  startBot,
  loading,
  loadingMore,
  hasMore,
  onLoadMore,
  messages,
  handleNewMessage,
  selectedConversation,
  markConversationRead,
  onSearchMessages,
  onSearchConversations,
  conversationSearchValue = '',
  conversationCount,
  searchingConversations = false,
  pauseStatus,
  onRefresh,
  isRefreshing = false,
  showOnlyPaused = false,
  onTogglePausedFilter,
  showOnlyUnanswered = false,
  onToggleUnansweredFilter,
  showOnlyPendencias = false,
  onTogglePendenciasFilter,
  viewMode = 'chats',
  showInactiveGroups = false,
  onToggleInactiveGroupsFilter,
  inactiveGroupsCount,
  tagFilterId = null,
  onTagFilterChange,
  tags,
  statusFilter = 'todas',
  onStatusFilterChange,
  assignmentFilter = 'todas',
  onAssignmentFilterChange,
  atendenteAtivoNome = null,
  filterCounts,
  tagsPorCliente,
  abertasPorCliente,
  onConversationUpdate,
  onRefreshMessages,
  isRefreshingMessages = false,
  updateConversationLocal,
  onHistoryDeleted,
  conversationPageSize = 200
}: ChatLayoutProps) => {
  const isMobile = useIsMobile();
  const [isInfoSheetOpen, setIsInfoSheetOpen] = useState(false);
  const hasConversationSearch = Boolean(conversationSearchValue.trim());

  const handleSelectChat = (id: string) => {
    setSelectedChat(id);
    markConversationRead(id);
  };

  const handleConversationUpdate = () => {
    if (onConversationUpdate) {
      onConversationUpdate();
    }
  };

  const conversationPanel = (
    <>
      <ConversationSubHeader
        selectedConversation={selectedConversation}
        onConversationUpdate={handleConversationUpdate}
        onSearchConversations={onSearchConversations}
        searchValue={conversationSearchValue}
        conversationCount={conversationCount ?? conversations.length}
        searching={searchingConversations}
        onRefresh={onRefresh}
        isRefreshing={isRefreshing}
        showOnlyPaused={showOnlyPaused}
        onTogglePausedFilter={onTogglePausedFilter}
        showOnlyUnanswered={showOnlyUnanswered}
        onToggleUnansweredFilter={onToggleUnansweredFilter}
        showOnlyPendencias={showOnlyPendencias}
        onTogglePendenciasFilter={onTogglePendenciasFilter}
        viewMode={viewMode}
        showInactiveGroups={showInactiveGroups}
        onToggleInactiveGroupsFilter={onToggleInactiveGroupsFilter}
        inactiveGroupsCount={inactiveGroupsCount}
        tagFilterId={tagFilterId}
        onTagFilterChange={onTagFilterChange}
        tags={tags}
        statusFilter={statusFilter}
        onStatusFilterChange={onStatusFilterChange}
        assignmentFilter={assignmentFilter}
        onAssignmentFilterChange={onAssignmentFilterChange}
        atendenteAtivoNome={atendenteAtivoNome}
        filterCounts={filterCounts}
      />
      <div className="min-h-0 flex-1 overflow-hidden">
        <ConversationList
          conversations={conversations}
          selectedChat={selectedChat}
          setSelectedChat={handleSelectChat}
          isLoading={isLoading}
          openPauseDialog={openPauseDialog}
          startBot={startBot}
          loading={loading}
          loadingMore={loadingMore}
          hasMore={hasMore}
          onLoadMore={onLoadMore}
          pauseStatus={pauseStatus}
          tagsPorCliente={tagsPorCliente}
          abertasPorCliente={abertasPorCliente}
          onHistoryDeleted={onHistoryDeleted}
          conversationPageSize={conversationPageSize}
          emptyTitle={
            viewMode === 'groups'
              ? 'Nenhum grupo encontrado'
              : hasConversationSearch
                ? 'Nenhum cliente encontrado'
                : undefined
          }
          emptyDescription={
            hasConversationSearch
              ? viewMode === 'groups'
                ? 'Tente buscar por outro nome de grupo.'
                : 'Tente buscar por outro nome, telefone ou pet.'
              : viewMode === 'groups'
                ? 'Verifique a conexão da instância Uazapi ou atualize a lista.'
                : undefined
          }
          endOfListText={
            hasConversationSearch
              ? 'Todos os resultados da busca foram carregados'
              : viewMode === 'groups'
                ? 'Todos os grupos foram carregados'
                : undefined
          }
        />
      </div>
    </>
  );

  // ─── Mobile: pilha de coluna única (lista ⇄ thread; info em Sheet) ───
  if (isMobile) {
    return (
      <div className="flex h-full flex-col bg-background">
        {selectedChat ? (
          <>
            <ChatArea
              selectedChat={selectedChat}
              selectedConversation={selectedConversation}
              messages={messages}
              loading={loading}
              onNewMessage={handleNewMessage}
              onHistoryDeleted={onHistoryDeleted}
              onBack={() => setSelectedChat(null)}
              onOpenInfo={() => setIsInfoSheetOpen(true)}
            />
            <ClientInfoSheet
              open={isInfoSheetOpen}
              onOpenChange={setIsInfoSheetOpen}
              selectedChat={selectedChat}
              selectedConversation={selectedConversation}
              onConversationUpdate={handleConversationUpdate}
              updateConversationLocal={updateConversationLocal}
            />
          </>
        ) : (
          conversationPanel
        )}
      </div>
    );
  }

  // ─── Desktop: três painéis redimensionáveis ───
  return (
    <ResizablePanelGroup direction="horizontal" className="h-full">
      <ResizablePanel
        defaultSize={25}
        minSize={20}
        maxSize={30}
        className="flex flex-col bg-card"
        data-tour="chat-panel-list"
      >
        {conversationPanel}
      </ResizablePanel>

      <ResizableHandle withHandle />

      <ResizablePanel
        defaultSize={50}
        minSize={40}
        className="flex flex-col bg-background"
        data-tour="chat-panel-thread"
      >
        <MessagesSubHeader
          selectedConversation={selectedConversation}
          messages={messages}
          onSearchMessages={onSearchMessages}
        />
        {/* min-h-0 é obrigatório: sem ele um item flex não encolhe abaixo do
            conteúdo, o viewport interno cresce até a altura total da thread e a
            rolagem acontece aqui fora — fora do alcance do MessageList. Mesmo
            padrão do painel de informações do cliente abaixo. */}
        <div className="min-h-0 flex-1 overflow-hidden">
          <ChatArea
            selectedChat={selectedChat}
            selectedConversation={selectedConversation}
            messages={messages}
            loading={loading}
            onNewMessage={handleNewMessage}
            onHistoryDeleted={onHistoryDeleted}
          />
        </div>
      </ResizablePanel>

      <ResizableHandle withHandle />

      <ResizablePanel
        defaultSize={25}
        minSize={20}
        maxSize={30}
        className="flex flex-col bg-card"
        data-tour="chat-panel-client"
      >
        <ClientSubHeader
          selectedConversation={selectedConversation}
          onConversationUpdate={handleConversationUpdate}
          updateConversationLocal={updateConversationLocal}
        />
        <div className="min-h-0 flex-1 overflow-hidden">
          <ClientInfoPanel
            selectedChat={selectedChat}
            selectedConversation={selectedConversation}
            onConversationUpdate={handleConversationUpdate}
            updateConversationLocal={updateConversationLocal}
          />
        </div>
      </ResizablePanel>
    </ResizablePanelGroup>
  );
};

export default ChatLayout;
