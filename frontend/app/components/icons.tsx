import React from "react";

interface IconProps {
  size?: number;
  strokeWidth?: number;
  style?: React.CSSProperties;
  className?: string;
}

const Icon = ({
  path, size = 14, strokeWidth = 1.6, fill = "none", style, className,
}: IconProps & { path: string; fill?: string }) => (
  <svg
    width={size} height={size} viewBox="0 0 24 24"
    fill={fill} stroke="currentColor"
    strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"
    style={{ flexShrink: 0, display: "inline-block", ...style }}
    className={className}
  >
    <path d={path} />
  </svg>
);

export const Ico = {
  play:    (p: IconProps) => <Icon {...p} path="M7 4v16l13-8z" fill="currentColor" strokeWidth={0} />,
  pause:   (p: IconProps) => <Icon {...p} path="M7 4v16M17 4v16" />,
  prev:    (p: IconProps) => <Icon {...p} path="M6 4v16M20 4l-10 8 10 8z" fill="currentColor" strokeWidth={0} />,
  next:    (p: IconProps) => <Icon {...p} path="M18 4v16M4 4l10 8-10 8z" fill="currentColor" strokeWidth={0} />,
  plus:    (p: IconProps) => <Icon {...p} path="M12 5v14M5 12h14" />,
  close:   (p: IconProps) => <Icon {...p} path="M6 6l12 12M18 6L6 18" />,
  send:    (p: IconProps) => <Icon {...p} path="M5 12l14-7-5 18-3-7-6-4z" fill="currentColor" strokeWidth={0} />,
  attach:  (p: IconProps) => <Icon {...p} path="M21 11l-9 9a6 6 0 01-8.5-8.5l9-9a4 4 0 015.6 5.6l-9 9a2 2 0 01-2.8-2.8l8-8" />,
  file:    (p: IconProps) => <Icon {...p} path="M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8zM14 3v5h5" />,
  sparkle: (p: IconProps) => <Icon {...p} path="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 3v4M21 5h-4M19 17v4M21 19h-4" />,
  scissors:(p: IconProps) => <Icon {...p} path="M6 9a3 3 0 100-6 3 3 0 000 6zM6 21a3 3 0 100-6 3 3 0 000 6zM20 4L8.12 15.88M14.47 14.48L20 20M8.12 8.12L12 12" />,
  type:    (p: IconProps) => <Icon {...p} path="M4 7V5h16v2M9 20h6M12 5v15" />,
  crop:    (p: IconProps) => <Icon {...p} path="M6 2v14a2 2 0 002 2h14M18 22V8a2 2 0 00-2-2H2" />,
  wand:    (p: IconProps) => <Icon {...p} path="M15 4V2M15 16v-2M8 9h2M20 9h2M17.8 11.8L19 13M17.8 6.2L19 5M3 21l9-9M12.2 6.2L11 5" />,
  mic:     (p: IconProps) => <Icon {...p} path="M12 2a3 3 0 00-3 3v7a3 3 0 006 0V5a3 3 0 00-3-3zM19 10v2a7 7 0 01-14 0v-2M12 19v3M8 22h8" />,
  check:   (p: IconProps) => <Icon {...p} path="M20 6L9 17l-5-5" />,
  back:    (p: IconProps) => <Icon {...p} path="M19 12H5M12 19l-7-7 7-7" />,
  chevDn:  (p: IconProps) => <Icon {...p} path="M6 9l6 6 6-6" />,
  download:(p: IconProps) => <Icon {...p} path="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />,
  arrow:   (p: IconProps) => <Icon {...p} path="M5 12h14M13 5l7 7-7 7" />,
  panelL:  (p: IconProps) => <Icon {...p} path="M3 5h18v14H3zM9 5v14" />,
  panelR:  (p: IconProps) => <Icon {...p} path="M3 5h18v14H3zM15 5v14" />,
  volume:  (p: IconProps) => <Icon {...p} path="M11 5L6 9H2v6h4l5 4V5zM19.07 4.93a10 10 0 010 14.14M15.54 8.46a5 5 0 010 7.07" />,
  zoomIn:  (p: IconProps) => <Icon {...p} path="M11 17a6 6 0 100-12 6 6 0 000 12zM21 21l-6.6-6.6M8 11h6M11 8v6" />,
  zoomOut: (p: IconProps) => <Icon {...p} path="M11 17a6 6 0 100-12 6 6 0 000 12zM21 21l-6.6-6.6M8 11h6" />,
};
