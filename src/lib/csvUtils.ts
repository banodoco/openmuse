// @ts-nocheck
import { VideoEntry, AdminStatus } from './types';
import { format } from 'date-fns';

// Define the filter keys based on the AdminStatus and skipped status
type FilterKey = 'listed' | 'curated' | 'featured' | 'hidden' | 'skipped';

/**
 * Convert video entries to CSV format, respecting the new AdminStatus
 */
export const convertToCSV = (videos: VideoEntry[]): string => {
  // Define CSV headers
  const headers = [
    'ID',
    'Reviewer',
    'Admin Status',
    'Skipped',
    'Creation Date',
    'Video URL',
    'Title',
    'Creator',
    'Classification',
  ];

  // Map data to CSV rows
  const rows = videos.map(video => {
    const date = new Date(video.created_at);
    const formattedDate = format(date, 'yyyy-MM-dd HH:mm:ss');
    
    // Get admin status, defaulting to 'Listed' if null/undefined
    const adminStatus = video.admin_status ?? 'Listed';
    const skippedStatus = video.skipped ? 'Yes' : 'No';
        
    return [
      `"${video.id}"`,
      `"${video.reviewer_name.replace(/"/g, '""')}"`,
      adminStatus,
      skippedStatus,
      formattedDate,
      `"${video.url}"`,
      `"${(video.metadata?.title || 'No title').replace(/"/g, '""')}"`,
      `"${(video.metadata?.creator === 'self' ? 'Self' : video.metadata?.creatorName || 'Someone else').replace(/"/g, '""')}"`,
      `"${(video.metadata?.classification || 'Unknown').replace(/"/g, '""')}"`,
    ].map(field => field === undefined || field === null ? '' : field);
  });

  // Combine headers and rows
  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.join(','))
  ].join('\n');

  return csvContent;
};

/**
 * Create a downloadable CSV file from video entries
 */
export const downloadCSV = (videos: VideoEntry[], filters?: Record<FilterKey, boolean>): void => {
  const csvContent = convertToCSV(videos);
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  
  // Create download link
  const filterSuffix = filters 
    ? '_' + (Object.keys(filters) as FilterKey[]).filter(key => filters[key]).join('_')
    : '';
  const filename = `video_entries_${format(new Date(), 'yyyy-MM-dd')}${filterSuffix}.csv`;

  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  
  // Append to document, trigger download, and remove
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

/**
 * Download entries as CSV (wrapper function)
 * Accepts the new filters object type.
 */
export const downloadEntriesAsCsv = (
  videos: VideoEntry[], 
  filters?: Record<FilterKey, boolean>
): void => {
  downloadCSV(videos, filters);
};
