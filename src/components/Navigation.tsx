import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { LayoutDashboard } from 'lucide-react';
import AuthButton from './AuthButton';
import { useAuth } from '@/hooks/useAuth';
import { useIsMobile } from '@/hooks/use-mobile';
import { useFadeInOnScroll } from '@/hooks/useFadeInOnScroll';

const logoPath = '/Open-Muse-logo.png';

const Navigation: React.FC = () => {
  const location = useLocation();
  const { isAdmin, isLoading, user } = useAuth();
  const [imageError, setImageError] = useState(false);
  const isMobile = useIsMobile();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const navRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    if (!isLoading) {
      setIsAuthenticated(!!user);
    }
  }, [user, isLoading]);
  
  useFadeInOnScroll(navRef);
  
  const isActive = (path: string) => location.pathname === path;
  const isAuthPage = location.pathname === '/auth';
  
  const handleImageError = () => {
    console.error('Error loading logo image');
    setImageError(true);
  };
  
  return (
    <div ref={navRef} className="w-full border-b border-olive/20">
      <nav className="w-full max-w-screen-2xl mx-auto px-3 py-4 flex justify-between items-center">
        <div className="flex items-center">
          <Link to="/" className="mr-3 flex items-center hover:opacity-80 transition-opacity">
            <div
              className={cn(
                "flex-shrink-0",
                isMobile ? "min-w-[90px]" : "min-w-[128px]",
              )}
            >
              <img
                src={logoPath}
                alt="OpenMuse Logo"
                className={cn(
                  "w-auto object-contain",
                  isMobile ? "max-h-[66px]" : "max-h-[76px]"
                )}
                onError={handleImageError}
              />
            </div>
          </Link>
          
          {!isAuthPage && isAdmin && (
            <div className="flex space-x-2 relative right-[10px] top-[2px]">
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
        <a 
          href="https://banodoco.ai/" 
          target="_blank" 
          rel="noopener noreferrer"
        >
          <img 
            src="/banodoco.png" 
            alt="Banodoco Logo" 
            className="h-10 w-auto"
          />
        </a>
        <div className="flex items-center text-xs pb-1">
          <a 
            href="https://github.com/banodoco/openmuse" 
            target="_blank" 
            rel="noopener noreferrer" 
            className="underline hover:text-foreground transition-colors"
          >
            Code
          </a>
        </div>
      </footer>
    </div>
  );
};

export default Navigation;
