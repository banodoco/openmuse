import React from 'react';
import Navigation, { Footer } from '@/components/Navigation';

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  return (
    <div className="w-full min-h-screen flex flex-col bg-gradient-to-br from-cream-light via-cream-light to-olive-light text-foreground">
      <Navigation />
      {children}
      <Footer />
    </div>
  );
}  