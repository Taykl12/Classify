import { Link } from 'react-router-dom';
import { ThemeToggleButton } from '../layout/ThemeToggleButton';
import { AuthAvatar } from './AuthAvatar';
import '../../styles/theme-toggle.css';

interface AuthNavProps {
  alternateLink: {
    to: string;
    label: string;
  };
}

export function AuthNav({ alternateLink }: AuthNavProps) {
  return (
    <nav className="barra-nav" aria-label="Navegación de autenticación">
      <div className="barra-nav__start">
        <ThemeToggleButton className="theme-toggle theme-toggle--auth" collapsed />
        <Link to="/" className="logo">
          <AuthAvatar size="nav" />
          <span>Classify</span>
        </Link>
      </div>
      <ul>
        <li>
          <Link to={alternateLink.to}>{alternateLink.label}</Link>
        </li>
      </ul>
    </nav>
  );
}
