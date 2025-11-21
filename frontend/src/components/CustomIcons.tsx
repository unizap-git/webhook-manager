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

export const ProjectsIcon: React.FC<IconProps> = ({ sx }) => (
  <svg
    width={sx?.fontSize || 24}
    height={sx?.fontSize || 24}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    style={sx}
  >
    <defs>
      <linearGradient id="projectsGradient" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#7b1fa2" />
        <stop offset="100%" stopColor="#9c27b0" />
      </linearGradient>
    </defs>
    <path
      d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2z"
      fill="url(#projectsGradient)"
      opacity="0.3"
    />
    <path
      d="M7 7h10v2H7zm0 4h10v2H7zm0 4h7v2H7z"
      fill="url(#projectsGradient)"
    />
    <circle cx="17" cy="17" r="1.5" fill="#ce93d8" />
  </svg>
);

export const ChildAccountsIcon: React.FC<IconProps> = ({ sx }) => (
  <svg
    width={sx?.fontSize || 24}
    height={sx?.fontSize || 24}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    style={sx}
  >
    <defs>
      <linearGradient id="childAccountsGradient" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#f57c00" />
        <stop offset="100%" stopColor="#ff9800" />
      </linearGradient>
    </defs>
    <circle cx="9" cy="8" r="3" fill="url(#childAccountsGradient)" />
    <circle cx="15" cy="8" r="3" fill="url(#childAccountsGradient)" opacity="0.7" />
    <path
      d="M9 13c-3.3 0-6 1.3-6 3v2h12v-2c0-1.7-2.7-3-6-3z"
      fill="url(#childAccountsGradient)"
    />
    <path
      d="M15 13c-0.5 0-1 0.1-1.5 0.2C14.5 13.9 15 14.9 15 16v2h6v-2c0-1.7-2.7-3-6-3z"
      fill="url(#childAccountsGradient)"
      opacity="0.7"
    />
  </svg>
);

export const SuccessRateIcon: React.FC<IconProps> = ({ sx }) => (
  <svg
    width={sx?.fontSize || 24}
    height={sx?.fontSize || 24}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    style={sx}
  >
    <defs>
      <linearGradient id="successGradient" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#388e3c" />
        <stop offset="100%" stopColor="#66bb6a" />
      </linearGradient>
    </defs>
    <circle cx="12" cy="12" r="10" fill="url(#successGradient)" opacity="0.2" />
    <circle cx="12" cy="12" r="8" stroke="url(#successGradient)" strokeWidth="2" fill="none" />
    <path
      d="M8 12l3 3 5-6"
      stroke="url(#successGradient)"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <circle cx="12" cy="12" r="3" fill="#81c784" opacity="0.3" />
  </svg>
);

export const DailyAverageIcon: React.FC<IconProps> = ({ sx }) => (
  <svg
    width={sx?.fontSize || 24}
    height={sx?.fontSize || 24}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    style={sx}
  >
    <defs>
      <linearGradient id="dailyGradient" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#00838f" />
        <stop offset="100%" stopColor="#00acc1" />
      </linearGradient>
    </defs>
    <rect x="4" y="14" width="3" height="6" fill="url(#dailyGradient)" opacity="0.6" rx="1" />
    <rect x="9" y="10" width="3" height="10" fill="url(#dailyGradient)" opacity="0.8" rx="1" />
    <rect x="14" y="6" width="3" height="14" fill="url(#dailyGradient)" rx="1" />
    <path
      d="M3 18h18"
      stroke="#00acc1"
      strokeWidth="1.5"
      strokeLinecap="round"
      opacity="0.5"
    />
  </svg>
);

export const ConfigurationsIcon: React.FC<IconProps> = ({ sx }) => (
  <svg
    width={sx?.fontSize || 24}
    height={sx?.fontSize || 24}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    style={sx}
  >
    <defs>
      <linearGradient id="configGradient" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#1565c0" />
        <stop offset="100%" stopColor="#42a5f5" />
      </linearGradient>
    </defs>
    <circle cx="12" cy="12" r="3" fill="url(#configGradient)" />
    <path
      d="M19.4 15c-.1-.3-.1-.6-.1-1s0-.7.1-1l2.1-1.6c.2-.1.2-.4.1-.6l-2-3.5c-.1-.2-.3-.3-.6-.2l-2.5 1c-.5-.4-1.1-.7-1.7-1l-.4-2.6c0-.2-.3-.4-.5-.4h-4c-.3 0-.5.2-.5.4l-.4 2.6c-.6.2-1.1.6-1.7 1l-2.5-1c-.2-.1-.5 0-.6.2l-2 3.5c-.1.2 0 .5.1.6L4.6 13c-.1.3-.1.6-.1 1s0 .7.1 1l-2.1 1.6c-.2.1-.2.4-.1.6l2 3.5c.1.2.3.3.6.2l2.5-1c.5.4 1.1.7 1.7 1l.4 2.6c0 .2.3.4.5.4h4c.3 0 .5-.2.5-.4l.4-2.6c.6-.2 1.1-.6 1.7-1l2.5 1c.2.1.5 0 .6-.2l2-3.5c.1-.2 0-.5-.1-.6L19.4 15z"
      fill="url(#configGradient)"
      opacity="0.3"
    />
  </svg>
);
