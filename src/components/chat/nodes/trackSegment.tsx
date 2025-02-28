import React from 'react';

interface TrackSegmentProps {
  color: string;
  height?: string;
  width?: string;
  position?: 'above' | 'below' | 'both';
  styles?: React.CSSProperties;
}

export const TrackSegment: React.FC<TrackSegmentProps> = ({
  color,
  height = '30px',
  width = '2.5px', // Consistent width for all tracks
  position = 'below',
  styles = {},
}) => {
  // For 'both' position, we render two segments - one above and one below
  if (position === 'both') {
    return (
      <>
        <div 
          className="absolute left-1/2 transform -translate-x-1/2 rounded-full z-0"
          style={{
            background: color,
            width,
            height: 'calc(50% - 10px)', // Extend to middle from top
            bottom: '50%',
            marginBottom: '10px',
            ...styles
          }}
        />
        <div 
          className="absolute left-1/2 transform -translate-x-1/2 rounded-full z-0"
          style={{
            background: color,
            width,
            height: 'calc(50% - 10px)', // Extend to middle from bottom
            top: '50%',
            marginTop: '10px',
            ...styles
          }}
        />
      </>
    );
  }
  
  // Standard single segment (above or below)
  // Extending tracks beyond the padding to ensure connection
  const extensionAmount = position === 'below' ? '8px' : '8px';
  
  return (
    <div 
      className="absolute left-1/2 transform -translate-x-1/2 rounded-full z-0"
      style={{
        background: color,
        width,
        // Add extra length to tracks to bridge the gap
        height: `calc(${height} + ${extensionAmount})`,
        // Position tracks to extend beyond their containers
        top: position === 'below' ? '100%' : 'auto',
        bottom: position === 'above' ? '100%' : 'auto',
        // Shift positions to account for container padding
        marginTop: position === 'below' ? '-4px' : '0',
        marginBottom: position === 'above' ? '-4px' : '0',
        ...styles
      }}
    />
  );
}; 