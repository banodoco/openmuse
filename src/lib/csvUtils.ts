
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
    
    const status = video.admin_approved 
      ? 'Approved' 
      : video.skipped 
        ? 'Skipped' 
        : 'Pending';
        
    return [
      video.id,
      video.reviewer_name,
      status,
      formattedDate,
      video.video_location,
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
