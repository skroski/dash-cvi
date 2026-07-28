import { MessageSquare } from 'lucide-react';
import EmptyState from '@/components/shared/EmptyState';

const NoSelectedChat = () => {
  return (
    <div className="flex h-full items-center justify-center">
      <EmptyState
        icon={<MessageSquare />}
        title="Selecione uma conversa"
        description="Escolha uma conversa na lista ao lado para ver as mensagens e responder."
      />
    </div>
  );
};

export default NoSelectedChat;
