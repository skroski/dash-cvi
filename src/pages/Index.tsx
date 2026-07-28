import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { PawPrint, Mail, Lock, Eye, EyeOff, Loader2 } from 'lucide-react';
import { z } from 'zod';
import { useAuth } from '@/context/AuthContext';
import { ThemeToggle } from '@/components/ThemeToggle';
import SignupForm from '@/components/SignupForm';
import GoogleSignInButton from '@/components/GoogleSignInButton';

const loginSchema = z.object({
  email: z.string().email({ message: "Email inválido" }),
  password: z.string().min(6, { message: "Senha deve ter pelo menos 6 caracteres" })
});

const Index = () => {
  const navigate = useNavigate();
  const { signIn, user, isLoading: authLoading } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showSignup, setShowSignup] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [errors, setErrors] = useState<{
    email?: string;
    password?: string;
  }>({});

  const [isPageLoaded, setIsPageLoaded] = useState(false);

  useEffect(() => {
    setIsPageLoaded(true);
  }, []);

  useEffect(() => {
    if (user) {
      navigate('/dashboard');
    }
  }, [user, navigate]);

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));

    if (errors[name as keyof typeof errors]) {
      setErrors(prev => ({
        ...prev,
        [name]: undefined
      }));
    }
  };

  const validateForm = () => {
    try {
      loginSchema.parse(formData);
      setErrors({});
      return true;
    } catch (error) {
      if (error instanceof z.ZodError) {
        const newErrors: {
          email?: string;
          password?: string;
        } = {};

        error.errors.forEach(err => {
          if (err.path[0]) {
            newErrors[err.path[0] as keyof typeof newErrors] = err.message;
          }
        });

        setErrors(newErrors);
      }
      return false;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    setIsLoading(true);

    try {
      const { error } = await signIn(formData.email, formData.password);

      if (error) {
        console.error('Login error:', error);
        toast.error(error.message || 'Erro ao fazer login. Tente novamente.');
      } else {
        toast.success('Login realizado com sucesso!');
        // Navigate is handled by the auth state change in AuthContext
      }
    } catch (error) {
      console.error('Unexpected error:', error);
      toast.error('Erro ao fazer login. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignupSuccess = () => {
    setShowSignup(false);
    toast.success('Conta criada! Por favor, faça login.');
  };

  if (authLoading) {
    return (
      <div className="grid min-h-svh place-items-center bg-sidebar" role="status" aria-label="Carregando">
        <Loader2 className="h-10 w-10 animate-spin text-sidebar-primary" aria-hidden="true" />
      </div>
    );
  }

  return (
    <div className="relative flex min-h-svh overflow-hidden">
      <div className="absolute right-4 top-4 z-30">
        <ThemeToggle />
      </div>

      <div className="absolute inset-0 z-0">
        <img
          src="/lovable-uploads/7a96682a-47a3-4ed0-8036-8a31ad28cb4b.png"
          alt=""
          aria-hidden="true"
          className="h-full w-full object-cover opacity-80"
        />
        <div className="absolute inset-0 bg-sidebar/60 backdrop-blur-md"></div>
      </div>

      {/* Decorações sutis (respeitam prefers-reduced-motion via regra global) */}
      <div className="pointer-events-none absolute inset-0 z-10 overflow-hidden" aria-hidden="true">
        <div className="absolute left-[5%] top-[10%] h-28 w-28 rounded-full bg-amber-400 opacity-15 animate-pulse"></div>
        <div className="absolute bottom-[20%] right-[10%] h-40 w-40 rounded-full bg-amber-400 opacity-10 animate-pulse" style={{ animationDelay: '1.5s' }}></div>
        <PawPrint className="absolute bottom-[30%] left-[15%] h-20 w-20 text-white opacity-10" />
      </div>

      <div
        className={`z-20 m-auto transform px-6 py-8 transition-all duration-700 ${isPageLoaded ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`}
      >
        <div className="mx-auto w-full max-w-md">
          {!showSignup ? (
            <form
              onSubmit={handleSubmit}
              className="glass-card animate-fade-in space-y-6 rounded-2xl p-8"
            >
              <h1 className="mb-2 text-center text-2xl font-bold text-white">
                Bem-vindos ao Dashboard da VetBots!
              </h1>
              <p className="mb-6 text-center text-white/80">
                Entre para gerenciar seu petshop
              </p>

              <div className="space-y-4">
                <div className="group relative">
                  <label htmlFor="login-email" className="sr-only">Email</label>
                  <Mail className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 transform text-white/60 transition-colors duration-300 group-hover:text-amber-400" aria-hidden="true" />
                  <Input
                    id="login-email"
                    type="email"
                    name="email"
                    placeholder="Email"
                    autoComplete="email"
                    value={formData.email}
                    onChange={handleChange}
                    aria-invalid={!!errors.email}
                    className={`h-12 rounded-md border-white/20 bg-white/10 pl-10 text-white transition-all duration-300 placeholder:text-white/50 hover:border-amber-400/50 ${errors.email ? 'border-red-300' : 'focus:border-amber-400'}`}
                  />
                  {errors.email && <p className="mt-1 text-sm text-red-300" role="alert">{errors.email}</p>}
                </div>

                <div className="group relative">
                  <label htmlFor="login-password" className="sr-only">Senha</label>
                  <Lock className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 transform text-white/60 transition-colors duration-300 group-hover:text-amber-400" aria-hidden="true" />
                  <Input
                    id="login-password"
                    type={showPassword ? "text" : "password"}
                    name="password"
                    placeholder="Senha"
                    autoComplete="current-password"
                    value={formData.password}
                    onChange={handleChange}
                    aria-invalid={!!errors.password}
                    className={`h-12 rounded-md border-white/20 bg-white/10 pl-10 text-white transition-all duration-300 placeholder:text-white/50 hover:border-amber-400/50 ${errors.password ? 'border-red-300' : 'focus:border-amber-400'}`}
                  />
                  <button
                    type="button"
                    onClick={togglePasswordVisibility}
                    aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                    className="absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 transform text-white/60 transition-colors duration-300 hover:text-amber-400"
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                  {errors.password && <p className="mt-1 text-sm text-red-300" role="alert">{errors.password}</p>}
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="remember"
                    className="h-4 w-4 rounded border-white/20 bg-white/10 text-amber-400 focus:ring-amber-400"
                  />
                  <label htmlFor="remember" className="ml-2 text-sm text-white/80 transition-colors duration-300 hover:text-white">
                    Lembrar-me
                  </label>
                </div>
                <button
                  type="button"
                  onClick={() => toast.info('Recuperação de senha em breve. Fale com o administrador.')}
                  className="text-sm text-amber-300 transition-colors duration-300 hover:text-white"
                >
                  Esqueceu a senha?
                </button>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="flex w-full items-center justify-center rounded-md bg-amber-400 px-4 py-3 font-bold text-[#06272e] transition-colors duration-300 hover:bg-amber-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200 disabled:opacity-70"
              >
                {isLoading ? (
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" aria-hidden="true" />
                ) : (
                  <PawPrint className="mr-2 h-5 w-5" aria-hidden="true" />
                )}
                {isLoading ? "Entrando..." : "Login"}
              </button>

              <div className="flex items-center gap-3" aria-hidden="true">
                <span className="h-px flex-1 bg-white/20" />
                <span className="text-xs uppercase tracking-wide text-white/50">ou</span>
                <span className="h-px flex-1 bg-white/20" />
              </div>

              <GoogleSignInButton />

              <p className="mt-6 text-center text-sm text-white/80">
                Não tem uma conta?{' '}
                <button
                  type="button"
                  onClick={() => setShowSignup(true)}
                  className="text-amber-300 transition-colors duration-300 hover:text-white"
                >
                  Cadastre-se
                </button>
              </p>
            </form>
          ) : (
            <div className="glass-card animate-fade-in rounded-2xl p-8">
              <SignupForm onSuccess={handleSignupSuccess} />
              <p className="mt-6 text-center text-sm text-white/80">
                Já tem uma conta?{' '}
                <button
                  type="button"
                  onClick={() => setShowSignup(false)}
                  className="text-amber-300 transition-colors duration-300 hover:text-white"
                >
                  Faça login
                </button>
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Index;
