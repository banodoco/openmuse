import React, { createContext, useState, useEffect, useContext, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Logger } from '@/lib/logger';

const logger = new Logger('LoraContext');

export interface LoraOption {
  id: string;
  name: string;
}

interface LoraContextType {
  loras: LoraOption[];
  isLoading: boolean;
  error: string | null;
  refetchLoras: () => void;
}

const LoraContext = createContext<LoraContextType | undefined>(undefined);

interface LoraProviderProps {
  children: ReactNode;
}

export const LoraProvider: React.FC<LoraProviderProps> = ({ children }) => {
  const [loras, setLoras] = useState<LoraOption[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLoras = async () => {
    logger.log('Fetching available LoRAs...');
    setIsLoading(true);
    setError(null);
    try {
      const { data, error: dbError } = await supabase
        .from('assets')
        .select('id, name')
        .eq('type', 'lora')
        .order('name', { ascending: true });

      if (dbError) {
        throw new Error(dbError.message);
      }

      if (data) {
        const formattedLoras: LoraOption[] = data.map((item: any) => ({
          id: item.id,
          name: item.name || 'Unnamed LoRA', // Basic fallback for missing names
        }));
        
        // Filter out the specific LoRA ID that was previously hardcoded in VideoLightbox
        const filteredLoras = formattedLoras.filter(lora => lora.id !== '3f7885ef-389d-4208-bf20-0e4df29388d2');
        
        setLoras(filteredLoras);
        logger.log(`Successfully fetched ${filteredLoras.length} LoRAs.`);
      } else {
        setLoras([]);
        logger.log('No LoRAs found or data was null.');
      }
    } catch (fetchError: any) {
      logger.error('Error fetching LoRAs:', fetchError);
      setError(fetchError.message || 'Failed to fetch LoRA list.');
      setLoras([]); // Clear loras on error
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // Fetch LoRAs when the provider mounts
    fetchLoras();
  }, []); // Empty dependency array ensures this runs only once on mount

  const contextValue: LoraContextType = {
    loras,
    isLoading,
    error,
    refetchLoras: fetchLoras, // Provide the fetch function
  };

  return (
    <LoraContext.Provider value={contextValue}>
      {children}
    </LoraContext.Provider>
  );
};

// Custom hook to use the LoraContext
export const useLoras = (): LoraContextType => {
  const context = useContext(LoraContext);
  if (context === undefined) {
    throw new Error('useLoras must be used within a LoraProvider');
  }
  return context;
}; 