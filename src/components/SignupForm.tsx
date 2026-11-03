
import React, { useState } from 'react';
import { z } from 'zod';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { PawPrint, Mail, Lock, Eye, EyeOff, User } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

const signupSchema = z.object({
  email: z.string().email({ message: "Email inválido" }),
  password: z.string().min(6, { message: "Senha deve ter pelo menos 6 caracteres" }),
  name: z.string().min(2, { message: "Nome deve ter pelo menos 2 caracteres" })
});

const SignupForm = ({ onSuccess }: { onSuccess: () => void }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: ''
  });
  const [errors, setErrors] = useState<{
    email?: string;
    password?: string;
    name?: string;
  }>({});

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    // Clear specific error when user starts typing
    if (errors[name as keyof typeof errors]) {
      setErrors(prev => ({
        ...prev,
        [name]: undefined
      }));
    }
  };

  const validateForm = () => {
    try {
      signupSchema.parse(formData);
      setErrors({});
      return true;
    } catch (error) {
      if (error instanceof z.ZodError) {
        const newErrors: {
          email?: string;
          password?: string;
          name?: string;
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
      const { error } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            name: formData.name
          }
        }
      });
      
      if (error) {
        console.error('Signup error:', error);
        toast.error(error.message || 'Erro ao criar conta. Tente novamente.');
      } else {
        toast.success('Conta criada com sucesso!');
        onSuccess();
      }
    } catch (error) {
      console.error('Unexpected error:', error);
      toast.error('Erro ao criar conta. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form 
      onSubmit={handleSubmit} 
      className="space-y-6"
    >
      <h1 className="text-2xl font-bold text-white text-center mb-2">
        Crie sua conta
      </h1>
      <p className="text-white/80 text-center mb-6">
        Junte-se ao C.V.I. - Centro Veterinário Integrado
      </p>

      <div className="space-y-4">
        <div className="relative group">
          <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-white/60 h-5 w-5 group-hover:text-amber-400 transition-colors duration-300" />
          <Input
            type="text"
            name="name"
            placeholder="Nome completo"
            value={formData.name}
            onChange={handleChange}
            className={`pl-10 h-12 bg-white/10 border-white/20 text-white rounded-md transition-all duration-300 hover:border-amber-400/50 ${errors.name ? 'border-red-300' : 'focus:border-amber-400'}`}
          />
          {errors.name && <p className="text-red-300 text-sm mt-1">{errors.name}</p>}
        </div>

        <div className="relative group">
          <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-white/60 h-5 w-5 group-hover:text-amber-400 transition-colors duration-300" />
          <Input
            type="email"
            name="email"
            placeholder="Email"
            value={formData.email}
            onChange={handleChange}
            className={`pl-10 h-12 bg-white/10 border-white/20 text-white rounded-md transition-all duration-300 hover:border-amber-400/50 ${errors.email ? 'border-red-300' : 'focus:border-amber-400'}`}
          />
          {errors.email && <p className="text-red-300 text-sm mt-1">{errors.email}</p>}
        </div>

        <div className="relative group">
          <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-white/60 h-5 w-5 group-hover:text-amber-400 transition-colors duration-300" />
          <Input
            type={showPassword ? "text" : "password"}
            name="password"
            placeholder="Senha"
            value={formData.password}
            onChange={handleChange}
            className={`pl-10 h-12 bg-white/10 border-white/20 text-white rounded-md transition-all duration-300 hover:border-amber-400/50 ${errors.password ? 'border-red-300' : 'focus:border-amber-400'}`}
          />
          <button 
            type="button"
            onClick={togglePasswordVisibility}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-white/60 h-5 w-5 hover:text-amber-400 transition-colors duration-300"
          >
            {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
          </button>
          {errors.password && <p className="text-red-300 text-sm mt-1">{errors.password}</p>}
        </div>
      </div>

      <button
        type="submit"
        disabled={isLoading}
        className="flex w-full items-center justify-center rounded-md bg-amber-400 px-4 py-3 font-bold text-[#06272e] transition-colors duration-300 hover:bg-amber-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200 disabled:opacity-70"
      >
        {isLoading ? (
          <div className="h-5 w-5 border-2 border-[#06272e] border-t-transparent rounded-full animate-spin mr-2"></div>
        ) : (
          <PawPrint className="mr-2 h-5 w-5" />
        )}
        {isLoading ? "Criando conta..." : "Criar conta"}
      </button>
      

    </form>
  );
};

export default SignupForm;
