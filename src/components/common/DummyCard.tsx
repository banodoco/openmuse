import React from 'react';
import { cn } from '@/lib/utils';

interface DummyCardProps {
  colorClass: string;
  id: string;
}

// Define a list of pastel background colors using Tailwind classes
// Use the '50' variants for lighter/paler pastels
// Curated palette to complement the site theme (greens, golds, creams)
const pastelColorClasses = [
  'bg-yellow-50',  // Light Gold
  'bg-amber-50',   // Light Amber
  'bg-lime-50',    // Light Lime Green
  'bg-green-50',   // Light Green
  'bg-emerald-50', // Light Emerald
  'bg-teal-50',    // Light Teal
  'bg-stone-50',   // Light Stone/Cream
  'bg-orange-50',  // Light Orange/Terracotta
];

let colorIndex = 0;

const getNextPastelColor = () => {
  const color = pastelColorClasses[colorIndex];
  colorIndex = (colorIndex + 1) % pastelColorClasses.length;
  return color;
};

export const DummyCard: React.FC<DummyCardProps> = ({ colorClass, id }) => {
  return (
    <div 
      key={id}
      className={cn(
        "relative z-0 rounded-lg shadow-sm border border-muted/50",
        "aspect-[4/3]", // Give it a standard aspect ratio (e.g., 4:3)
        "flex items-center justify-center",
        colorClass // Apply the pastel background
      )}
    >
      {/* Optional: Add some subtle content or pattern */}
      {/* <span className="text-muted-foreground/50 text-xs">Placeholder</span> */}
    </div>
  );
};

// Function to generate dummy items
export const generateDummyItems = (count: number, startIndex: number): Array<{ type: 'dummy'; id: string; colorClass: string }> => {
  const dummies = [];
  // Reset color index when generating a new batch to ensure consistent colors per render
  colorIndex = 0; 
  for (let i = 0; i < count; i++) {
    dummies.push({
      type: 'dummy' as const,
      id: `dummy-${startIndex + i}`,
      colorClass: getNextPastelColor(),
    });
  }
  return dummies;
}; 