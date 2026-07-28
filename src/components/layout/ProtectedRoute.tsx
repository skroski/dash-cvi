import { Navigate, Outlet } from 'react-router-dom';
import { Loader2, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/AuthContext';

const ProtectedRoute = () => {
  const { user, perfil, isLoading, signOut } = useAuth();

  if (isLoading) {
    return (
      <div className="grid h-svh place-items-center bg-background" role="status" aria-label="Carregando">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-10 w-10 animate-spin text-primary" aria-hidden="true" />
          <span className="text-sm text-muted-foreground">Carregando...</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/" replace />;
  }

  // Contas novas nascem inativas e precisam ser liberadas por um administrador.
  // Quando a migração de perfis ainda não foi aplicada, `perfil` é null e o
  // acesso segue como antes — nada é bloqueado por falta de setup.
  if (perfil && !perfil.ativo) {
    return (
      <div className="grid h-svh place-items-center bg-background px-4">
        <div className="flex max-w-md flex-col items-center gap-4 text-center">
          <ShieldAlert className="h-10 w-10 text-muted-foreground" aria-hidden="true" />
          <div className="space-y-1.5">
            <h1 className="text-lg font-semibold">Conta aguardando liberação</h1>
            <p className="text-sm text-muted-foreground">
              Seu cadastro foi criado, mas ainda precisa ser liberado por um administrador
              do painel. Assim que isso acontecer, basta entrar novamente.
            </p>
          </div>
          <Button variant="outline" onClick={signOut}>
            Sair
          </Button>
        </div>
      </div>
    );
  }

  return <Outlet />;
};

export default ProtectedRoute;
