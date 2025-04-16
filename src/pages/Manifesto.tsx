
import React from 'react';
import { PageHeader } from '@/components/PageHeader';

const ManifestoPage: React.FC = () => {
  return (
    <div className="container mx-auto px-4 py-8">
      <PageHeader 
        title="Our Manifesto" 
        description="Our vision and guiding principles" 
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
  );
};

export default ManifestoPage;
