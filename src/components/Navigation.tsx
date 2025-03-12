
import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { UploadCloud, Play } from 'lucide-react';

const Navigation: React.FC = () => {
  const location = useLocation();
  
  const isActive = (path: string) => location.pathname === path;
  
  return (
    <nav className="w-full max-w-screen-xl mx-auto px-4 py-4 flex justify-between items-center">
      <Link to="/" className="text-2xl font-medium tracking-tight transition-opacity hover:opacity-80">
        VideoResponse
      </Link>
      
      <div className="flex space-x-2">
        <NavLink to="/" active={isActive('/')}>
          <Play className="w-4 h-4 mr-2" />
          Respond
        </NavLink>
        <NavLink to="/upload" active={isActive('/upload')}>
          <UploadCloud className="w-4 h-4 mr-2" />
          Upload
        </NavLink>
      </div>
    </nav>
  );
};

interface NavLinkProps {
  to: string;
  active: boolean;
  children: React.ReactNode;
}

const NavLink: React.FC<NavLinkProps> = ({ to, active, children }) => {
  return (
    <Link
      to={to}
      className={cn(
        "inline-flex items-center px-4 py-2 rounded-full text-sm font-medium transition-all duration-200",
        active 
          ? "bg-primary text-primary-foreground shadow-subtle" 
          : "bg-transparent hover:bg-secondary text-foreground"
      )}
    >
      {children}
    </Link>
  );
};

export default Navigation;
