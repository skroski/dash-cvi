import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import PageContainer from '@/components/layout/PageContainer';
import EmptyState from '@/components/shared/EmptyState';
import { useAuth } from '@/context/AuthContext';
import { papelEfetivo, podeAcessarRota } from '@/config/modulos';

/**
 * Impede que uma rota escondida do menu seja aberta digitando a URL.
 *
 * Renderiza dentro do AppShell de propósito: o usuário continua com a barra
 * lateral e entende que errou o caminho, em vez de cair numa tela órfã.
 * Para veterinários, redireciona diretamente para a Agenda em vez de exibir tela de erro.
 */
const ModuloGuard = () => {
  const { pathname } = useLocation();
  const { papel, setupPendente, user } = useAuth();
  const papelAtual = papelEfetivo(papel, setupPendente, user?.email);

  if (!podeAcessarRota(pathname, papelAtual)) {
    if (papelAtual === 'veterinario') {
      return <Navigate to="/dashboard" replace />;
    }
    if (papelAtual === 'totem') {
      return <Navigate to="/totem" replace />;
    }

    return (
      <PageContainer>
        <EmptyState
          icon={<ShieldAlert />}
          title="Acesso restrito"
          description="Você não tem permissão para acessar esta área. Se precisar dela, fale com um administrador do painel."
        />
      </PageContainer>
    );
  }

  return <Outlet />;
};

export default ModuloGuard;
