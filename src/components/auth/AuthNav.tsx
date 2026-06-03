import { Link } from 'react-router-dom';
import { AuthAvatar } from './AuthAvatar';

interface AuthNavProps {
  alternateLink: {
    to: string;
    label: string;
  };
}

export function AuthNav({ alternateLink }: AuthNavProps) {
  return (
    <nav className="barra-nav" aria-label="Navegación de autenticación">
      <div className="logo">
        <AuthAvatar size="nav" />
        <span>Classify</span>
      </div>
      <ul>
        <li>
          <Link to={alternateLink.to}>{alternateLink.label}</Link>
        </li>
      </ul>
    </nav>
  );
}
