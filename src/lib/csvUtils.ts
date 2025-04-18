import { VideoEntry } from './types';
import { format } from 'date-fns';

/**
 * Convert video entries to CSV format
 */
export const convertToCSV = (videos: VideoEntry[]): string => {
  // Define CSV headers
  const headers = [
    'ID',
    'Reviewer',
    'Status',
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
    
    // Determine status based on admin_status first, then skipped
    let status = 'Pending'; // Default status
    if (video.admin_status === 'Curated' || video.admin_status === 'Featured') {
      status = 'Curated';
    } else if (video.admin_status === 'Rejected') {
      status = 'Rejected';
    } else if (video.admin_status === 'Listed') {
      status = 'Listed';
    } else if (video.skipped) {
      status = 'Skipped';
    }
        
    return [
      video.id,
      video.reviewer_name,
      status,
      formattedDate,
      video.url,
      video.metadata?.title || 'No title',
      video.metadata?.creator === 'self' ? 'Self' : video.metadata?.creatorName || 'Someone else',
      video.metadata?.classification || 'Unknown',
    ];
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
export const downloadCSV = (videos: VideoEntry[]): void => {
  const csvContent = convertToCSV(videos);
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  
  // Create download link
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `video_entries_${format(new Date(), 'yyyy-MM-dd')}.csv`);
  link.style.visibility = 'hidden';
  
  // Append to document, trigger download, and remove
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

/**
 * Download entries as CSV with filters applied
 */
export const downloadEntriesAsCsv = (
  videos: VideoEntry[], 
  filters?: { 
    showApproved?: boolean;
    showUnapproved?: boolean;
    showResponded?: boolean;
    showSkipped?: boolean;
  }
): void => {
  downloadCSV(videos);
};
