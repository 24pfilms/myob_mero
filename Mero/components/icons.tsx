import React from 'react';

const iconProps = {
  className: "w-5 h-5",
  strokeWidth: 1.5,
  stroke: "currentColor",
  fill: "none",
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export const MousePointerIcon = () => (
  <svg {...iconProps} viewBox="0 0 24 24">
    <path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z"></path>
    <path d="M13 13l6 6"></path>
  </svg>
);

export const JournalIcon = () => (
  <svg {...iconProps} viewBox="0 0 24 24">
    <path d="M4 4a2 2 0 0 1 2-2h12a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H6a2 2 0 0 1-2-2z"></path>
    <path d="M4 18h15"></path>
    <path d="M8 7h7"></path>
    <path d="M8 11h7"></path>
  </svg>
);

export const StickyNoteIcon = () => (
  <svg {...iconProps} viewBox="0 0 24 24">
    <path d="M16 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8l-7-5z"></path>
    <path d="M15 3v5h5"></path>
  </svg>
);

export const SquareIcon = () => (
  <svg {...iconProps} viewBox="0 0 24 24">
    <rect x="3" y="3" width="18" height="18" rx="4" ry="4"></rect>
  </svg>
);

export const TextIcon = () => (
    <svg {...iconProps} viewBox="0 0 24 24">
        <path d="M17 6.1H7a1 1 0 00-1 1v2.5a1 1 0 001 1h3.5v7.8a1 1 0 001 1h1a1 1 0 001-1V10.6H17a1 1 0 001-1V7.1a1 1 0 00-1-1z"/>
    </svg>
);

export const FrameIcon = () => (
    <svg {...iconProps} viewBox="0 0 24 24">
        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
        <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
        <line x1="12" y1="22.08" x2="12" y2="12"/>
    </svg>
);

export const ZoomInIcon = () => (
  <svg {...iconProps} viewBox="0 0 24 24">
    <circle cx="11" cy="11" r="8"></circle>
    <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
    <line x1="11" y1="8" x2="11" y2="14"></line>
    <line x1="8" y1="11" x2="14" y2="11"></line>
  </svg>
);

export const ZoomOutIcon = () => (
  <svg {...iconProps} viewBox="0 0 24 24">
    <circle cx="11" cy="11" r="8"></circle>
    <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
    <line x1="8" y1="11" x2="14" y2="11"></line>
  </svg>
);

export const FitToScreenIcon = () => (
    <svg {...iconProps} viewBox="0 0 24 24">
        <path d="M15 3h6v6M9 3H3v6M15 21h6v-6M9 21H3v-6" />
    </svg>
);

export const VoteIcon = () => (
  <svg {...iconProps} viewBox="0 0 24 24">
    <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"></path>
  </svg>
);

export const MoonIcon = () => (
    <svg {...iconProps} viewBox="0 0 24 24">
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
    </svg>
);

export const SunIcon = () => (
    <svg {...iconProps} viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="5"></circle>
        <line x1="12" y1="1" x2="12" y2="3"></line>
        <line x1="12" y1="21" x2="12" y2="23"></line>
        <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
        <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
        <line x1="1" y1="12" x2="3" y2="12"></line>
        <line x1="21" y1="12" x2="23" y2="12"></line>
        <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
        <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
    </svg>
);

export const TrashIcon = () => (
    <svg {...iconProps} viewBox="0 0 24 24">
        <polyline points="3 6 5 6 21 6"></polyline>
        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
        <line x1="10" y1="11" x2="10" y2="17"></line>
        <line x1="14" y1="11" x2="14" y2="17"></line>
    </svg>
);

export const HeartIcon = () => (
    <svg className="w-4 h-4 text-red-500" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd"></path>
    </svg>
);

export const ArrowUpIcon = () => (
    <svg {...iconProps} viewBox="0 0 24 24">
        <line x1="12" y1="19" x2="12" y2="5"></line>
        <polyline points="5 12 12 5 19 12"></polyline>
    </svg>
);

export const ArrowDownIcon = () => (
    <svg {...iconProps} viewBox="0 0 24 24">
        <line x1="12" y1="5" x2="12" y2="19"></line>
        <polyline points="19 12 12 19 5 12"></polyline>
    </svg>
);

export const NoFillIcon = () => (
    <svg {...iconProps} viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5" fill="none" />
        <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" stroke="currentColor" strokeWidth="1.5" />
    </svg>
);

export const ExportIcon = () => (
    <svg {...iconProps} viewBox="0 0 24 24">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
        <polyline points="17 8 12 3 7 8"></polyline>
        <line x1="12" y1="3" x2="12" y2="15"></line>
    </svg>
);

export const SparklesIcon = () => (
    <svg {...iconProps} viewBox="0 0 24 24">
        <path d="M12 3L9.5 8.5L4 11L9.5 13.5L12 19L14.5 13.5L20 11L14.5 8.5L12 3Z"/>
        <path d="M3 21L4.5 16.5L9 15L4.5 13.5L3 9L1.5 13.5L-3 15L1.5 16.5L3 21Z" transform="translate(15, -6)"/>
        <path d="M19 21L20.5 16.5L25 15L20.5 13.5L19 9L17.5 13.5L13 15L17.5 16.5L19 21Z" transform="translate(-14, -13)"/>
    </svg>
);

export const PlayIcon = () => (
    <svg {...iconProps} viewBox="0 0 24 24" fill="currentColor" stroke="none">
        <path d="M5 3l14 9-14 9V3z"></path>
    </svg>
);

export const PauseIcon = () => (
    <svg {...iconProps} viewBox="0 0 24 24" fill="currentColor" stroke="none">
        <path d="M6 4h4v16H6zM14 4h4v16h-4z"></path>
    </svg>
);

export const DownloadIcon = () => (
    <svg {...iconProps} viewBox="0 0 24 24">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
      <polyline points="7 10 12 15 17 10"></polyline>
      <line x1="12" y1="15" x2="12" y2="3"></line>
    </svg>
);

export const CircleIcon = () => (
  <svg {...iconProps} viewBox="0 0 24 24">
    <circle cx="12" cy="12" r="9"></circle>
  </svg>
);

export const TriangleIcon = () => (
  <svg {...iconProps} viewBox="0 0 24 24">
    <path d="M12 2 L2 22 H22 Z" strokeWidth="1" fill="currentColor"></path>
  </svg>
);

export const DiamondIcon = () => (
  <svg {...iconProps} viewBox="0 0 24 24">
    <path d="M12 2 L22 12 L12 22 L2 12 Z"></path>
  </svg>
);

export const RoundedRectangleIcon = () => (
    <svg {...iconProps} viewBox="0 0 24 24">
      <rect x="3" y="3" width="18" height="18" rx="4" ry="4"></rect>
    </svg>
);

export const HexagonIcon = () => (
    <svg {...iconProps} viewBox="0 0 24 24">
      <path d="M16.5 3.5h-9L3 12l4.5 8.5h9l4.5-8.5-4.5-8.5z"></path>
    </svg>
);

export const ShapesIcon = () => (
    <svg {...iconProps} viewBox="0 0 24 24">
        <circle cx="16" cy="16" r="6" />
        <rect x="2" y="2" width="12" height="12" rx="2" />
    </svg>
);

export const MicrophoneIcon = () => (
    <svg {...iconProps} viewBox="0 0 24 24">
        <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
        <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
        <line x1="12" y1="19" x2="12" y2="22"></line>
    </svg>
);

export const CheckIcon = () => (
    <svg {...iconProps} viewBox="0 0 24 24">
        <polyline points="20 6 9 17 4 12"></polyline>
    </svg>
);

export const BotIcon = () => (
    <svg {...iconProps} viewBox="0 0 24 24">
        <path d="M12 8V4H8" />
        <rect width="16" height="12" x="4" y="8" rx="2" />
        <path d="M2 14h2" />
        <path d="M20 14h2" />
        <path d="M15 13v2" />
        <path d="M9 13v2" />
    </svg>
);

export const CopyIcon = () => (
    <svg {...iconProps} viewBox="0 0 24 24" className="w-4 h-4">
      <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
      <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
    </svg>
);

export const ClipboardPlusIcon = () => (
    <svg {...iconProps} viewBox="0 0 24 24" className="w-4 h-4">
        <rect width="8" height="4" x="8" y="2" rx="1" ry="1" />
        <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
        <path d="M12 11v6" />
        <path d="M9 14h6" />
    </svg>
);

export const PaletteIcon = () => (
    <svg {...iconProps} viewBox="0 0 24 24">
        <circle cx="12" cy="7.5" r="5.5" />
        <path d="M12 12.5a5.5 5.5 0 0 0-5.5 5.5c0 2.2 1.2 4.1 3 5" />
        <path d="M12 12.5a5.5 5.5 0 0 1 5.5 5.5c0 2.2-1.2 4.1-3 5" />
    </svg>
);

export const GridIcon = () => (
  <svg {...iconProps} viewBox="0 0 24 24">
    <path d="M10 4H4v6h6V4zm10 0h-6v6h6V4zM10 14H4v6h6v-6zm10 0h-6v6h6v-6z" />
  </svg>
);

export const LineIcon = () => (
    <svg {...iconProps} viewBox="0 0 24 24">
        <line x1="4" y1="12" x2="20" y2="12" />
    </svg>
);

export const ArrowRightIcon = () => (
    <svg {...iconProps} viewBox="0 0 24 24">
        <line x1="4" y1="12" x2="20" y2="12" />
        <polyline points="14 6 20 12 14 18" />
    </svg>
);

export const ArrowLeftIcon = () => (
    <svg {...iconProps} viewBox="0 0 24 24">
        <line x1="20" y1="12" x2="4" y2="12" />
        <polyline points="10 18 4 12 10 6" />
    </svg>
);

export const ArrowBothIcon = () => (
    <svg {...iconProps} viewBox="0 0 24 24">
        <line x1="4" y1="12" x2="20" y2="12" />
        <polyline points="14 6 20 12 14 18" />
        <polyline points="10 18 4 12 10 6" />
    </svg>
);

export const RotateCwIcon = () => (
    <svg {...iconProps} viewBox="0 0 24 24">
        <path d="M21 2v6h-6"></path>
        <path d="M3 12a9 9 0 0 1 15-6.7L21 8"></path>
    </svg>
);

export const CropIcon = () => (
    <svg {...iconProps} viewBox="0 0 24 24">
        <path d="M6.13 1L6 16a2 2 0 0 0 2 2h15"></path>
        <path d="M1 6.13L16 6a2 2 0 0 1 2 2v15"></path>
    </svg>
);

export const LayoutHorizontalIcon = () => (
    <svg {...iconProps} viewBox="0 0 24 24">
        <rect x="4" y="3" width="6" height="18" rx="1" />
        <rect x="14" y="3" width="6" height="18" rx="1" />
    </svg>
);

export const LayoutVerticalIcon = () => (
    <svg {...iconProps} viewBox="0 0 24 24">
        <rect x="3" y="4" width="18" height="6" rx="1" />
        <rect x="3" y="14" width="18" height="6" rx="1" />
    </svg>
);

export const YouTubeIcon = () => (
    <svg {...iconProps} viewBox="0 0 24 24" fill="currentColor" stroke="none">
        <path d="M21.582 6.186a2.04 2.04 0 0 0-1.44-1.441C18.27 4 12 4 12 4s-6.27 0-8.142.745A2.04 2.04 0 0 0 2.418 6.186 21.36 21.36 0 0 0 2 12c0 3.17.418 5.814 1.441 6.628a2.04 2.04 0 0 0 1.441 1.441C6.73 20 12 20 12 20s6.27 0 8.142-.745a2.04 2.04 0 0 0 1.44-1.441A21.36 21.36 0 0 0 22 12c0-3.17-.418-5.814-1.418-6.814z"></path>
        <path d="M9.5 15.5V8.5l6 3.5-6 3.5z" fill="#1f2937"></path>
    </svg>
);

export const FolderOpen = () => (
    <svg {...iconProps} viewBox="0 0 24 24">
        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
    </svg>
);

export const FileText = () => (
    <svg {...iconProps} viewBox="0 0 24 24">
        <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"></path>
        <polyline points="14 2 14 8 20 8"></polyline>
    </svg>
);

export const Search = () => (
    <svg {...iconProps} viewBox="0 0 24 24">
        <circle cx="11" cy="11" r="8"></circle>
        <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
    </svg>
);

export const RefreshCw = () => (
    <svg {...iconProps} viewBox="0 0 24 24">
        <polyline points="23 4 23 10 17 10"></polyline>
        <polyline points="1 20 1 14 7 14"></polyline>
        <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"></path>
    </svg>
);

export const Filter = () => (
    <svg {...iconProps} viewBox="0 0 24 24">
        <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon>
    </svg>
);

export const Tag = () => (
    <svg {...iconProps} viewBox="0 0 24 24">
        <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path>
        <line x1="7" y1="7" x2="7.01" y2="7"></line>
    </svg>
);

export const Calendar = () => (
    <svg {...iconProps} viewBox="0 0 24 24">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
        <line x1="16" y1="2" x2="16" y2="6"></line>
        <line x1="8" y1="2" x2="8" y2="6"></line>
        <line x1="3" y1="10" x2="21" y2="10"></line>
    </svg>
);

export const Hash = () => (
    <svg {...iconProps} viewBox="0 0 24 24">
        <line x1="4" y1="9" x2="20" y2="9"></line>
        <line x1="4" y1="15" x2="20" y2="15"></line>
        <line x1="10" y1="3" x2="8" y2="21"></line>
        <line x1="16" y1="3" x2="14" y2="21"></line>
    </svg>
);

export const Clock = () => (
    <svg {...iconProps} viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="10"></circle>
        <polyline points="12 6 12 12 16 14"></polyline>
    </svg>
);

export const Eye = () => (
    <svg {...iconProps} viewBox="0 0 24 24">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
        <circle cx="12" cy="12" r="3"></circle>
    </svg>
);

export const Link = () => (
    <svg {...iconProps} viewBox="0 0 24 24">
        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
    </svg>
);

export const XIcon = () => (
    <svg {...iconProps} viewBox="0 0 24 24">
        <line x1="18" y1="6" x2="6" y2="18"></line>
        <line x1="6" y1="6" x2="18" y2="18"></line>
    </svg>
);

export const ImageEditIcon = () => (
    <svg {...iconProps} viewBox="0 0 24 24">
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
        <circle cx="8.5" cy="8.5" r="1.5"></circle>
        <path d="M21 15l-5-5L5 21"></path>
        <path d="M16 2l3 3-9 9-3-3 9-9z"></path>
        <path d="M14.5 7.5l3 3"></path>
    </svg>
);

export const VideoIcon = () => (
    <svg {...iconProps} viewBox="0 0 24 24">
        <path d="M23 7l-7 5 7 5V7z"></path>
        <rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect>
    </svg>
);

export const MaximizeIcon = () => (
    <svg {...iconProps} viewBox="0 0 24 24">
        <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"></path>
    </svg>
);

export const MinimizeIcon = () => (
    <svg {...iconProps} viewBox="0 0 24 24">
        <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"></path>
    </svg>
);

export const AspectRatioIcon = () => (
    <svg {...iconProps} viewBox="0 0 24 24">
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
        <path d="M9 9h6v6H9z"></path>
    </svg>
);

export const RefreshIcon = () => (
    <svg {...iconProps} viewBox="0 0 24 24">
        <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"></path>
        <path d="M21 3v5h-5"></path>
        <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"></path>
        <path d="M3 21v-5h5"></path>
    </svg>
);

export const RotateClockwiseIcon = () => (
    <svg {...iconProps} viewBox="0 0 24 24">
        <path d="M21.888 12.09a9 9 0 1 1-1.222-4.556"></path>
        <path d="M16.5 7.5l4.5 1.5-1.5 4.5"></path>
    </svg>
);

export const MoveIcon = () => (
    <svg {...iconProps} viewBox="0 0 24 24">
        <polyline points="5 9 2 12 5 15"></polyline>
        <polyline points="9 5 12 2 15 5"></polyline>
        <polyline points="15 19 12 22 9 19"></polyline>
        <polyline points="19 9 22 12 19 15"></polyline>
        <line x1="2" y1="12" x2="22" y2="12"></line>
        <line x1="12" y1="2" x2="12" y2="22"></line>
    </svg>
);

export const BoardIcon = () => (
  <svg {...iconProps} viewBox="0 0 24 24">
    <rect x="3" y="3" width="7" height="7" />
    <rect x="14" y="3" width="7" height="7" />
    <rect x="14" y="14" width="7" height="7" />
    <rect x="3" y="14" width="7" height="7" />
  </svg>
);

export const FontSizeIncreaseIcon = () => (
  <svg {...iconProps} viewBox="0 0 24 24">
    <path d="M4 19h6l-3-9-3 9z" />
    <path d="M7 13L4 19" />
    <path d="M10 19l-3-9" />
    <line x1="4" y1="16" x2="10" y2="16" />
    <line x1="17" y1="10" x2="17" y2="18" />
    <line x1="13" y1="14" x2="21" y2="14" />
  </svg>
);

export const FontSizeDecreaseIcon = () => (
  <svg {...iconProps} viewBox="0 0 24 24">
    <path d="M4 19h6l-3-9-3 9z" />
    <path d="M7 13L4 19" />
    <path d="M10 19l-3-9" />
    <line x1="4" y1="16" x2="10" y2="16" />
    <line x1="13" y1="14" x2="21" y2="14" />
  </svg>
);

// Pen tool icon
export const PenToolIcon = () => (
  <svg {...iconProps} viewBox="0 0 24 24">
    <path d="M12 19l7-7 3 3-7 7-3-3z" />
    <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" />
    <path d="M2 2l7.586 7.586" />
    <circle cx="11" cy="11" r="2" />
  </svg>
);

// Eraser tool icon
export const EraserIcon = () => (
  <svg {...iconProps} viewBox="0 0 24 24">
    <path d="M7 21h10" />
    <path d="M5.5 13.5L12 7l5 5-6.5 6.5a2.12 2.12 0 0 1-3 0l-2-2a2.12 2.12 0 0 1 0-3z" />
    <path d="M18 13l3-3" />
  </svg>
);
