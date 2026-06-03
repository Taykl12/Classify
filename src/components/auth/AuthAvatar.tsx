import { Mail, User } from 'lucide-react';

interface AuthAvatarProps {
  size: 'nav' | 'form';
  icon?: 'user' | 'mail';
}

export function AuthAvatar({ size, icon = 'user' }: AuthAvatarProps) {
  const sizeClass = size === 'nav' ? 'auth-avatar--nav' : 'auth-avatar--form';
  const iconSize = size === 'nav' ? 20 : 48;
  const IconComponent = icon === 'mail' ? Mail : User;

  return (
    <div className={`auth-avatar ${sizeClass}`} aria-hidden>
      <IconComponent size={iconSize} strokeWidth={2} />
    </div>
  );
}
