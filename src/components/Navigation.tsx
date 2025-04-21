
import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { LayoutDashboard } from 'lucide-react';
import AuthButton from './AuthButton';
import { useAuth } from '@/hooks/useAuth';
import { useIsMobile } from '@/hooks/use-mobile';

const logoPath = 'https://i.ibb.co/C3ZhdXgS/cropped-Open-Muse-logo.png';

const Navigation: React.FC = () => {
  const location = useLocation();
  const { isAdmin, isLoading, user } = useAuth();
  const [imageError, setImageError] = useState(false);
  const isMobile = useIsMobile();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  
  useEffect(() => {
    if (!isLoading) {
      setIsAuthenticated(!!user);
    }
  }, [user, isLoading]);
  
  const isActive = (path: string) => location.pathname === path;
  const isAuthPage = location.pathname === '/auth';
  
  const handleImageError = () => {
    console.error('Error loading logo image');
    setImageError(true);
  };
  
  return (
    <div className="w-full border-b border-olive/20">
      <nav className="w-full max-w-screen-2xl mx-auto px-4 py-4 flex justify-between items-center">
        <div className="flex items-center">
          <Link to="/" className="mr-8 flex flex-col items-center hover:opacity-80 transition-opacity">
            <img 
              src={logoPath} 
              alt="OpenMuse Logo" 
              className={cn(
                "transition-all duration-300",
                isMobile 
                  ? "h-20 max-w-full w-auto" // bigger height, auto width to preserve aspect ratio on mobile
                  : "h-20 w-auto"
              )}
              onError={handleImageError}
            />
            {/* Removed version span */}
          </Link>
          
          {!isAuthPage && isAdmin && (
            <div className="flex space-x-2 relative right-[15px] top-[2px]">
              <NavLink to="/admin" active={isActive('/admin')}>
                <LayoutDashboard className="w-4 h-4 mr-2" />
                Admin
              </NavLink>
            </div>
          )}
          
          {/* Additional navigation links can be inserted here if needed */}
        </div>
        
        <AuthButton />
      </nav>
    </div>
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
          ? "bg-olive text-cream-light shadow-subtle" 
          : "bg-transparent hover:bg-cream text-foreground hover:text-olive"
      )}
    >
      {children}
    </Link>
  );
};

export { Navigation, NavLink };

export const Footer = () => {
  return (
    <div className="w-full border-t border-border">
      <footer className="w-full max-w-screen-2xl mx-auto px-4 py-4 text-center text-sm text-muted-foreground flex flex-col items-center justify-center space-y-1">
        <div className="pt-1">
          Made with 🦾 by <a 
            href="https://banodoco.ai/" 
            target="_blank" 
            rel="noopener noreferrer" 
            className="underline hover:text-foreground transition-colors"
          >
            Banodoco
          </a>
        </div>
        <hr className="w-[12.5%] border-t-2 border-border/50" />
        <div className="flex items-center text-xs pb-1">
          <a 
            href="https://github.com/peteromallet/openmuse" 
            target="_blank" 
            rel="noopener noreferrer" 
            className="underline hover:text-foreground transition-colors"
          >
            Code
          </a>
          <span className="mx-2">|</span>
          <a 
            href="#" 
            className="underline hover:text-foreground transition-colors"
          >
            Data
          </a>
        </div>
      </footer>
    </div>
  );
};

export default Navigation;

