import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { lazy, Suspense } from "react";
import Index from "./pages/Index";
import Dashboard from "./pages/Dashboard";
import MetricsDashboard from "./pages/MetricsDashboard";
import ChatsDashboard from "./pages/ChatsDashboard";
import KnowledgeManager from "./pages/KnowledgeManager";
import ClientsDashboard from "./pages/ClientsDashboard";
import AttendantsPage from "./pages/AttendantsPage";
import UsersPage from "./pages/UsersPage";
import Evolution from "./pages/Evolution";
import Schedule from "./pages/Schedule";
import AgendaSettingsPage from "./pages/AgendaSettingsPage";
import AtendimentoConfigPage from "./pages/AtendimentoConfigPage";
import NotFound from "./pages/NotFound";
import ConfigurationManager from "./pages/ConfigurationManager";
import WebChatPage from "./pages/WebChatPage";
import QueuePage from "./pages/QueuePage";
import QueueTvPage from "./pages/QueueTvPage";
import QueueRoomCallerPage from "./pages/QueueRoomCallerPage";
import QueueTotemPage from "./pages/QueueTotemPage";
import MyPromptPage from "./pages/MyPromptPage";
import ProntuarioIaPage from "./pages/ProntuarioIaPage";
import SmartPrescriptionPage from "./pages/SmartPrescriptionPage";
import BularioPage from "./pages/BularioPage";
import PrescriptionValidationPage from "./pages/PrescriptionValidationPage";
import ProtectedRoute from "./components/layout/ProtectedRoute";
import ModuloGuard from "./components/layout/ModuloGuard";
import AppShell from "./components/layout/AppShell";
import { AuthProvider } from "./context/AuthContext";
import { ThemeProvider } from "./context/ThemeContext";
import { AtendenteAtivoProvider } from "./context/AtendenteAtivoContext";

const queryClient = new QueryClient();
const RemindersPage = lazy(() => import("./pages/RemindersPage"));
const SatisfactionSurveysPage = lazy(
  () => import("./pages/SatisfactionSurveysPage")
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider defaultTheme="light">
      <TooltipProvider>
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <AtendenteAtivoProvider>
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/tv" element={<QueueTvPage />} />
                <Route path="/chamar" element={<QueueRoomCallerPage />} />
                <Route path="/chamar/:roomId" element={<QueueRoomCallerPage />} />
                <Route path="/validar-receita" element={<PrescriptionValidationPage />} />
                <Route path="/validar-receita/:codigo" element={<PrescriptionValidationPage />} />
                <Route element={<ProtectedRoute />}>
                  {/* Totem: login com papel "totem", fora do AppShell (tela cheia de quiosque) */}
                  <Route path="/totem" element={<QueueTotemPage />} />
                  <Route element={<AppShell />}>
                    <Route element={<ModuloGuard />}>
                      <Route path="/dashboard" element={<Dashboard />} />
                      <Route path="/metrics" element={<MetricsDashboard />} />
                      <Route path="/chats" element={<ChatsDashboard />} />
                      <Route path="/groups" element={<ChatsDashboard />} />
                      <Route path="/knowledge" element={<KnowledgeManager />} />
                      <Route path="/clients" element={<ClientsDashboard />} />
                      <Route path="/attendants" element={<AttendantsPage />} />
                      <Route path="/users" element={<UsersPage />} />
                      <Route path="/evolution" element={<Evolution />} />
                      <Route path="/uazapi" element={<Evolution />} />
                      <Route path="/schedule" element={<Schedule />} />
                      <Route path="/calendar" element={<Schedule />} />
                      <Route path="/agenda-configuracao" element={<AgendaSettingsPage />} />
                      <Route path="/atendimento-configuracao" element={<AtendimentoConfigPage />} />
                      <Route
                        path="/reminders"
                        element={
                          <Suspense
                            fallback={
                              <div
                                className="flex h-full items-center justify-center text-sm text-muted-foreground"
                                role="status"
                              >
                                Carregando lembretes...
                              </div>
                            }
                          >
                            <RemindersPage />
                          </Suspense>
                        }
                      />
                      <Route
                        path="/satisfaction-surveys"
                        element={
                          <Suspense
                            fallback={
                              <div
                                className="flex h-full items-center justify-center text-sm text-muted-foreground"
                                role="status"
                              >
                                Carregando pesquisas de satisfação...
                              </div>
                            }
                          >
                            <SatisfactionSurveysPage />
                          </Suspense>
                        }
                      />
                      <Route path="/configuration" element={<ConfigurationManager />} />
                      <Route path="/web-chat" element={<WebChatPage />} />
                      <Route path="/queue" element={<QueuePage />} />
                      <Route path="/prontuario" element={<ProntuarioIaPage />} />
                      <Route path="/receituario" element={<SmartPrescriptionPage />} />
                      <Route path="/bulario" element={<BularioPage />} />
                      <Route path="/my-prompt" element={<MyPromptPage />} />
                    </Route>
                  </Route>
                </Route>
                {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </AtendenteAtivoProvider>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
