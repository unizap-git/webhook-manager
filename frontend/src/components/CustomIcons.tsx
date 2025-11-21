import React from 'react';

interface IconProps {
  sx?: any;
}

export const MessagesSentIcon: React.FC<IconProps> = ({ sx }) => (
  <svg
    width={sx?.fontSize || 24}
    height={sx?.fontSize || 24}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    style={sx}
  >
    <defs>
      <linearGradient id="messageGradient" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#1976d2" />
        <stop offset="100%" stopColor="#42a5f5" />
      </linearGradient>
    </defs>
    <path
      d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"
      fill="url(#messageGradient)"
    />
    <circle cx="19" cy="12" r="1.5" fill="#64b5f6" opacity="0.8" />
  </svg>
);

export const DeliveredIcon: React.FC<IconProps> = ({ sx }) => (
  <svg
    width={sx?.fontSize || 24}
    height={sx?.fontSize || 24}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    style={sx}
  >
    <defs>
      <linearGradient id="deliveredGradient" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#2e7d32" />
        <stop offset="100%" stopColor="#66bb6a" />
      </linearGradient>
    </defs>
    {/* Envelope */}
    <path
      d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"
      fill="url(#deliveredGradient)"
      opacity="0.9"
    />
    {/* Checkmark */}
    <circle cx="17" cy="17" r="5" fill="#4caf50" />
    <path
      d="M15.5 17l1.5 1.5 3-3"
      stroke="white"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
  </svg>
);

export const ReadIcon: React.FC<IconProps> = ({ sx }) => (
  <svg
    width={sx?.fontSize || 24}
    height={sx?.fontSize || 24}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    style={sx}
  >
    <defs>
      <linearGradient id="readGradient" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#0288d1" />
        <stop offset="100%" stopColor="#29b6f6" />
      </linearGradient>
    </defs>
    {/* Eye shape */}
    <path
      d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5z"
      fill="url(#readGradient)"
      opacity="0.3"
    />
    <path
      d="M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z"
      fill="url(#readGradient)"
    />
    {/* Highlight */}
    <circle cx="13" cy="11" r="1.5" fill="#e3f2fd" opacity="0.8" />
    {/* Reading marks */}
    <path
      d="M8 12c0-2.21 1.79-4 4-4s4 1.79 4 4"
      stroke="#0288d1"
      strokeWidth="1.5"
      strokeLinecap="round"
      fill="none"
      opacity="0.5"
    />
  </svg>
);

export const FailedIcon: React.FC<IconProps> = ({ sx }) => (
  <svg
    width={sx?.fontSize || 24}
    height={sx?.fontSize || 24}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    style={sx}
  >
    <defs>
      <linearGradient id="failedGradient" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#d32f2f" />
        <stop offset="100%" stopColor="#f44336" />
      </linearGradient>
    </defs>
    {/* Outer circle */}
    <circle cx="12" cy="12" r="10" fill="url(#failedGradient)" opacity="0.2" />
    <circle cx="12" cy="12" r="8" fill="url(#failedGradient)" />
    {/* Warning symbol */}
    <path
      d="M12 7v6"
      stroke="white"
      strokeWidth="2"
      strokeLinecap="round"
    />
    <circle cx="12" cy="16" r="1" fill="white" />
    {/* Highlight */}
    <path
      d="M12 4a8 8 0 0 1 8 8"
      stroke="#ffebee"
      strokeWidth="1.5"
      strokeLinecap="round"
      fill="none"
      opacity="0.4"
    />
  </svg>
);
