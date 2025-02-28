import React from 'react';

interface TrackSegmentProps {
  color: string;
  height?: string;
  width?: string;
  position?: 'above' | 'below';
  styles?: React.CSSProperties;
}

export const TrackSegment: React.FC<TrackSegmentProps> = ({
  color,
  height = '30px',
  width = '2.5px',
  position = 'below',
  styles = {},
}) => {
  return (
    <div 
      className="absolute left-1/2 transform -translate-x-1/2 rounded-full z-0"
      style={{
        background: color,
        width,
        height,
        top: position === 'below' ? '100%' : 'auto',
        bottom: position === 'above' ? '100%' : 'auto',
        ...styles
      }}
    />
  );
}; 