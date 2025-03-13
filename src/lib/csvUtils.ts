
/**
 * Utility functions for CSV operations
 */

import { VideoEntry } from "./types";

/**
 * Creates and downloads a CSV file with the provided entries
 * 
 * @param entries Video entries to include in the CSV
 * @param filters Current filter settings (used for filename)
 */
export const downloadEntriesAsCsv = (
  entries: VideoEntry[],
  filters: { showApproved: boolean; showUnapproved: boolean; showResponded: boolean; showSkipped: boolean }
) => {
  // Generate CSV content
  const csvRows: string[] = [];
  
  // Add header row
  csvRows.push('input_video_url,output_video_url');
  
  // Add data rows
  entries.forEach(entry => {
    const inputUrl = entry.video_location ? `"${entry.video_location}"` : '""';
    const outputUrl = entry.acting_video_location ? `"${entry.acting_video_location}"` : '""';
    csvRows.push(`${inputUrl},${outputUrl}`);
  });
  
  // Join rows with newlines
  const csvContent = csvRows.join('\n');
  
  // Create blob and download link
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  
  // Create filename based on active filters and current datetime
  const filterParts: string[] = [];
  if (filters.showApproved) filterParts.push('approved');
  if (filters.showUnapproved) filterParts.push('unapproved');
  if (filters.showResponded) filterParts.push('responded');
  if (filters.showSkipped) filterParts.push('skipped');
  
  const filtersString = filterParts.length > 0 ? filterParts.join('_') : 'all';
  const datetime = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').split('Z')[0];
  const filename = `${filtersString}_${datetime}.csv`;
  
  // Create temporary link and trigger download
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  
  // Clean up
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
