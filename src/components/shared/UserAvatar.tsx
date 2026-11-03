import { User, Users } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

interface UserAvatarProps {
  /** URL da imagem; emojis e valores vazios são tratados como "sem imagem". */
  src?: string;
  name?: string;
  isGroup?: boolean;
  className?: string;
}

const isValidUrl = (value?: string): value is string =>
  !!value && (value.startsWith('http://') || value.startsWith('https://') || value.startsWith('data:'));

const getInitials = (name?: string): string => {
  if (!name) return '';
  const cleaned = name.replace(/[^\p{L}\p{N} ]/gu, '').trim();
  if (!cleaned) return '';
  return cleaned
    .split(/\s+/)
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
};

const UserAvatar = ({ src, name, isGroup = false, className }: UserAvatarProps) => {
  const initials = getInitials(name);
  const FallbackIcon = isGroup ? Users : User;

  return (
    <Avatar className={cn('h-10 w-10', className)}>
      {isValidUrl(src) && (
        <AvatarImage
          src={src}
          alt={name ? `Foto de ${name}` : 'Foto do contato'}
          referrerPolicy="no-referrer"
        />
      )}
      <AvatarFallback className="bg-accent text-accent-foreground text-sm font-medium">
        {initials || <FallbackIcon className="h-5 w-5" aria-hidden="true" />}
      </AvatarFallback>
    </Avatar>
  );
};

export default UserAvatar;
