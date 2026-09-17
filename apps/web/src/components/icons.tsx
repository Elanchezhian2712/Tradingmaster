import React from "react";

export function IconCrosshair(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" {...props}>
      <circle cx="9" cy="9" r="3" />
      <line x1="9" y1="1" x2="9" y2="6" />
      <line x1="9" y1="12" x2="9" y2="17" />
      <line x1="1" y1="9" x2="6" y2="9" />
      <line x1="12" y1="9" x2="17" y2="9" />
    </svg>
  );
}

export function IconDot(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="currentColor" {...props}>
      <circle cx="9" cy="9" r="3" />
    </svg>
  );
}

export function IconArrowCursor(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="currentColor" {...props}>
      <path d="M4 2L13 9L8.5 10L11 15L9 16L6.5 11L4 13.5V2Z" />
    </svg>
  );
}

export function IconEraser(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" {...props}>
      <path d="M14 11L9 16L3 10L9 4L14 9" />
      <path d="M12 14H16" />
    </svg>
  );
}

export function IconTrendline(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" {...props}>
      <circle cx="4" cy="14" r="1.5" fill="currentColor" />
      <circle cx="14" cy="4" r="1.5" fill="currentColor" />
      <line x1="5.5" y1="12.5" x2="12.5" y2="5.5" />
    </svg>
  );
}

export function IconRay(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" {...props}>
      <circle cx="4" cy="14" r="1.5" fill="currentColor" />
      <line x1="5.5" y1="12.5" x2="16" y2="2" />
    </svg>
  );
}

export function IconHLine(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" {...props}>
      <circle cx="9" cy="9" r="1.5" fill="currentColor" />
      <line x1="1" y1="9" x2="17" y2="9" />
    </svg>
  );
}

export function IconVLine(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" {...props}>
      <circle cx="9" cy="9" r="1.5" fill="currentColor" />
      <line x1="9" y1="1" x2="9" y2="17" />
    </svg>
  );
}

export function IconChannel(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" {...props}>
      <line x1="2" y1="13" x2="16" y2="7" />
      <line x1="2" y1="8" x2="16" y2="2" />
      <line x1="2" y1="10.5" x2="16" y2="4.5" strokeDasharray="2 2" />
    </svg>
  );
}

export function IconFib(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" {...props}>
      <line x1="2" y1="3" x2="16" y2="3" />
      <line x1="2" y1="7" x2="16" y2="7" />
      <line x1="2" y1="11" x2="16" y2="11" />
      <line x1="2" y1="15" x2="16" y2="15" />
      <line x1="3" y1="15" x2="15" y2="3" strokeDasharray="2 2" stroke="currentColor" />
    </svg>
  );
}

export function IconBrush(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" {...props}>
      <path d="M14 2C15.5 3.5 16 5 13 8L8 13C6 15 4 15 3 14C2 13 2 11 4 9L9 4C12 1 13.5 1.5 14 2Z" />
      <path d="M3 14C2.5 15.5 3 16 3 16" />
    </svg>
  );
}

export function IconHighlighter(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" {...props}>
      <path d="M5 14L2 15L3 12L11 4L14 7L5 14Z" />
      <path d="M9 6L12 9" />
    </svg>
  );
}

export function IconRectangle(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" {...props}>
      <rect x="3" y="4" width="12" height="10" rx="1" />
    </svg>
  );
}

export function IconCircle(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" {...props}>
      <circle cx="9" cy="9" r="6" />
    </svg>
  );
}

export function IconText(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="currentColor" {...props}>
      <path d="M3 4H15V6H10V15H8V6H3V4Z" />
    </svg>
  );
}

export function IconCallout(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" {...props}>
      <path d="M3 4H15V12H7L3 15V4Z" />
    </svg>
  );
}

export function IconPriceLabel(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" {...props}>
      <path d="M2 9L7 4H15V14H7L2 9Z" />
      <circle cx="12" cy="9" r="1.5" fill="currentColor" />
    </svg>
  );
}

export function IconLongPosition(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" {...props}>
      <rect x="3" y="3" width="12" height="5" fill="#26a69a" fillOpacity="0.4" stroke="#26a69a" />
      <rect x="3" y="8" width="12" height="7" fill="#ef5350" fillOpacity="0.4" stroke="#ef5350" />
      <line x1="2" y1="8" x2="16" y2="8" stroke="#ffffff" strokeWidth="1.5" />
    </svg>
  );
}

export function IconShortPosition(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" {...props}>
      <rect x="3" y="3" width="12" height="7" fill="#ef5350" fillOpacity="0.4" stroke="#ef5350" />
      <rect x="3" y="10" width="12" height="5" fill="#26a69a" fillOpacity="0.4" stroke="#26a69a" />
      <line x1="2" y1="10" x2="16" y2="10" stroke="#ffffff" strokeWidth="1.5" />
    </svg>
  );
}

export function IconRuler(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" {...props}>
      <path d="M3 15L15 3L16 4L4 16L3 15Z" />
      <line x1="6" y1="12" x2="8" y2="14" />
      <line x1="9" y1="9" x2="11" y2="11" />
      <line x1="12" y1="6" x2="14" y2="8" />
    </svg>
  );
}

export function IconZoomIn(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" {...props}>
      <circle cx="8" cy="8" r="5" />
      <line x1="12" y1="12" x2="16" y2="16" />
      <line x1="6" y1="8" x2="10" y2="8" />
      <line x1="8" y1="6" x2="8" y2="10" />
    </svg>
  );
}

export function IconMagnet(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" {...props}>
      <path d="M4 3V8C4 10.76 6.24 13 9 13C11.76 13 14 10.76 14 8V3" />
      <line x1="4" y1="5.5" x2="7" y2="5.5" />
      <line x1="11" y1="5.5" x2="14" y2="5.5" />
    </svg>
  );
}

export function IconStayInDrawing(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" {...props}>
      <path d="M3 15L6 14L13 7L10 4L3 11V15Z" />
      <rect x="11" y="10" width="5" height="4" rx="1" stroke="currentColor" />
      <path d="M12.5 10V8.5C12.5 7.67 13.5 7.67 13.5 8.5V10" />
    </svg>
  );
}

export function IconLock(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" {...props}>
      <rect x="4" y="8" width="10" height="8" rx="1.5" />
      <path d="M6.5 8V5.5C6.5 4.12 7.62 3 9 3C10.38 3 11.5 4.12 11.5 5.5V8" />
    </svg>
  );
}

export function IconEye(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" {...props}>
      <path d="M1 9C3.5 4.5 14.5 4.5 17 9C14.5 13.5 3.5 13.5 1 9Z" />
      <circle cx="9" cy="9" r="3" />
    </svg>
  );
}

export function IconEyeClosed(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" {...props}>
      <path d="M2 2L16 16" />
      <path d="M5.5 5.5C3 7 1.5 9 1.5 9C4 13.5 14 13.5 16.5 9C15.5 7.5 14 6.5 12.5 5.8" />
      <path d="M7 7.5C7.5 7.2 8.2 7 9 7C11.2 7 12 8.5 12 9" />
    </svg>
  );
}

export function IconTrash(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" {...props}>
      <path d="M3 5H15" />
      <path d="M7 5V3H11V5" />
      <path d="M5 5L6 15H12L13 5" />
      <line x1="8" y1="8" x2="8" y2="12" />
      <line x1="10" y1="8" x2="10" y2="12" />
    </svg>
  );
}

export function IconSmiley(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" {...props}>
      <circle cx="9" cy="9" r="7" />
      <circle cx="6.5" cy="7.5" r="1" fill="currentColor" />
      <circle cx="11.5" cy="7.5" r="1" fill="currentColor" />
      <path d="M6 11C7 12.5 11 12.5 12 11" />
    </svg>
  );
}

export function IconCandlestick(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="currentColor" {...props}>
      <rect x="4" y="6" width="3" height="7" rx="0.5" />
      <line x1="5.5" y1="2" x2="5.5" y2="6" stroke="currentColor" strokeWidth="1.2" />
      <line x1="5.5" y1="13" x2="5.5" y2="16" stroke="currentColor" strokeWidth="1.2" />
      <rect x="11" y="4" width="3" height="9" rx="0.5" />
      <line x1="12.5" y1="1" x2="12.5" y2="4" stroke="currentColor" strokeWidth="1.2" />
      <line x1="12.5" y1="13" x2="12.5" y2="17" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}

export function IconIndicators(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" {...props}>
      <path d="M2 13L6 8L10 11L16 4" />
      <circle cx="16" cy="4" r="1.5" fill="currentColor" />
      <path d="M2 6L5 9" strokeDasharray="1.5 1.5" />
    </svg>
  );
}

export function IconAlert(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" {...props}>
      <circle cx="9" cy="9.5" r="6" />
      <line x1="9" y1="6.5" x2="9" y2="9.5" />
      <line x1="9" y1="9.5" x2="11.5" y2="11" />
      <path d="M7 1.5L9 3.5L11 1.5" />
    </svg>
  );
}

export function IconReplay(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" {...props}>
      <path d="M3 9C3 5.68 5.68 3 9 3C11.5 3 13.6 4.5 14.5 6.7" />
      <path d="M15 9C15 12.32 12.32 15 9 15C6.5 15 4.4 13.5 3.5 11.3" />
      <polygon points="2,3 4,7 7,5" fill="currentColor" />
      <polygon points="16,15 14,11 11,13" fill="currentColor" />
    </svg>
  );
}

export function IconUndo(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" {...props}>
      <path d="M4 7H11C13.2 7 15 8.8 15 11C15 13.2 13.2 15 11 15H5" />
      <path d="M7 4L4 7L7 10" />
    </svg>
  );
}

export function IconRedo(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" {...props}>
      <path d="M14 7H7C4.8 7 3 8.8 3 11C3 13.2 4.8 15 7 15H13" />
      <path d="M11 4L14 7L11 10" />
    </svg>
  );
}

export function IconSettings(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" {...props}>
      <circle cx="9" cy="9" r="2.5" />
      <path d="M9 2V4M9 14V16M2 9H4M14 9H16M4 4L5.5 5.5M12.5 12.5L14 14M4 14L5.5 12.5M12.5 5.5L14 4" />
    </svg>
  );
}

export function IconFullscreen(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" {...props}>
      <path d="M3 6V3H6M12 3H15V6M15 12V15H12M6 15H3V12" />
    </svg>
  );
}

export function IconCamera(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" {...props}>
      <path d="M3 6H5.5L7 4H11L12.5 6H15C15.5 6 16 6.5 16 7V14C16 14.5 15.5 15 15 15H3C2.5 15 2 14.5 2 14V7C2 6.5 2.5 6 3 6Z" />
      <circle cx="9" cy="10.5" r="2.5" />
    </svg>
  );
}

export function IconChevronDown(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" {...props}>
      <path d="M3 4.5L6 7.5L9 4.5" />
    </svg>
  );
}

export function IconChevronRight(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" {...props}>
      <path d="M3.5 2L6.5 5L3.5 8" />
    </svg>
  );
}

export function IconStar(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor" {...props}>
      <polygon points="7,1 9,5 13.5,5.5 10,8.5 11,13 7,10.5 3,13 4,8.5 0.5,5.5 5,5" />
    </svg>
  );
}

export function IconPlus(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" {...props}>
      <line x1="8" y1="3" x2="8" y2="13" />
      <line x1="3" y1="8" x2="13" y2="8" />
    </svg>
  );
}
