import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Conversation } from '@/types/chat';
import ClientSubHeader from './ClientSubHeader';
import ClientInfoPanel from './ClientInfoPanel';

interface ClientInfoSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedChat: string | null;
  selectedConversation?: Conversation;
  onConversationUpdate: () => void;
  updateConversationLocal?: (sessionId: string, data: Partial<Conversation>) => void;
}

const ClientInfoSheet = ({
  open,
  onOpenChange,
  selectedChat,
  selectedConversation,
  onConversationUpdate,
  updateConversationLocal,
}: ClientInfoSheetProps) => {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 overflow-y-auto p-0 sm:max-w-md">
        <SheetHeader className="border-b px-4 py-3 text-left">
          <SheetTitle>
            {selectedConversation?.isGroup ? 'Informações do grupo' : 'Informações do cliente'}
          </SheetTitle>
        </SheetHeader>
        <ClientSubHeader
          selectedConversation={selectedConversation}
          onConversationUpdate={onConversationUpdate}
          updateConversationLocal={updateConversationLocal}
        />
        <div className="min-h-0 flex-1">
          <ClientInfoPanel
            selectedChat={selectedChat}
            selectedConversation={selectedConversation}
            onConversationUpdate={onConversationUpdate}
            updateConversationLocal={updateConversationLocal}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default ClientInfoSheet;
