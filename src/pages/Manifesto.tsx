
import React from 'react';
import Navigation, { Footer } from '@/components/Navigation';
import PageHeader from '@/components/PageHeader';

const ManifestoPage: React.FC = () => {
  return (
    <div className="flex flex-col min-h-screen bg-background">
      <Navigation />
      
      <div className="flex-1 w-full">
        <div className="max-w-screen-2xl mx-auto p-4">
          <PageHeader 
            title="Our Manifesto" 
            description="Our vision and guiding principles" 
            buttonText="Learn More"
            onButtonClick={() => {
              window.scrollTo({
                top: document.documentElement.scrollHeight,
                behavior: 'smooth'
              });
            }}
          />
          
          <div className="prose max-w-2xl mx-auto">
            <p className="text-muted-foreground leading-relaxed">
              This is a placeholder for our manifesto. Here we will outline our core beliefs, 
              mission, and the principles that drive our work. Our commitment is to create 
              meaningful technology that empowers creativity and collaboration.
            </p>
            
            <p className="text-muted-foreground leading-relaxed mt-4">
              More details will be added soon. Stay tuned for our full vision statement.
            </p>
          </div>
        </div>
      </div>
      
      <Footer />
    </div>
  );
};

export default ManifestoPage;
