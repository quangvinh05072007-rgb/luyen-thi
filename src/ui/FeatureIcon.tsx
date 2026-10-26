import { useId } from 'react';
import type { ReactNode } from 'react';

/** Decorative feature artwork; navigation icons remain small and monochrome. */
export function FeatureIcon({ name, size = 48 }: { name: string; size?: number }) {
  const id = useId();
  const paper = `url(#${id})`;
  let artwork: ReactNode;
  switch (name) {
    case 'edit': case 'matrix':
      artwork = <><rect x="8" y="6" width="29" height="35" rx="5" fill={paper}/><path d="M14 15h16M14 21h8M14 27h6"/><path d="m25 32 12-12a3 3 0 0 1 4 4L29 36l-6 2 2-6Z" fill="#dce7ff"/><path d="m34 23 4 4M13 34h4"/><circle cx="36" cy="9" r="4" fill="#f2b96d" stroke="none"/></>;
      break;
    case 'bank': case 'school':
      artwork = <><path d="m6 17 18-10 18 10v3H6v-3Z" fill={paper}/><path d="M10 23v13m9-13v13m10-13v13m9-13v13M7 39h34M5 43h38"/><path d="M24 12v2" strokeWidth="3"/><rect x="11" y="25" width="4" height="10" rx="1" fill="#dce7ff" stroke="none"/><rect x="29" y="25" width="4" height="10" rx="1" fill="#dce7ff" stroke="none"/><circle cx="39" cy="8" r="3" fill="#f2b96d" stroke="none"/></>;
      break;
    case 'import': case 'upload':
      artwork = <><path d="M13 29a9 9 0 0 1-1-18 11 11 0 0 1 21 2 8 8 0 0 1 4 16" fill={paper}/><rect x="15" y="23" width="19" height="20" rx="4" fill="#fff"/><path d="M24 18v16m-5-5 5 5 5-5M20 39h8"/><path d="m7 35-2 3m36-3 2 3" stroke="#9bb1eb"/><circle cx="38" cy="8" r="3" fill="#f2b96d" stroke="none"/></>;
      break;
    case 'class': case 'user':
      artwork = <><rect x="6" y="6" width="35" height="35" rx="9" fill={paper}/><circle cx="24" cy="19" r="6" fill="#dce7ff"/><path d="M13 36v-2a11 11 0 0 1 22 0v2M34 14a5 5 0 0 1 0 10m4 4a8 8 0 0 1 4 7M9 18h3m-2-2v4"/><circle cx="38" cy="8" r="4" fill="#f2b96d" stroke="none"/></>;
      break;
    case 'chart': case 'report': case 'log':
      artwork = <><rect x="6" y="8" width="35" height="32" rx="5" fill={paper}/><path d="M13 32V22h5v10m5 0V16h5v16m5 0V24h4v8" fill="#dce7ff"/><path d="M12 35h25"/><path d="m14 16 7-5 7 2 10-7" stroke="#7798e2"/><circle cx="39" cy="7" r="3" fill="#f2b96d" stroke="none"/></>;
      break;
    case 'book':
      artwork = <><path d="M5 10c8-3 14-2 19 2 5-4 11-5 19-2v28c-8-3-14-2-19 2-5-4-11-5-19-2V10Z" fill={paper}/><path d="M24 12v28M10 17c4-1 7 0 9 1m-9 6c4-1 7 0 9 1m11-7c3-1 5-1 8-1m-8 8c3-1 5-1 8-1"/><path d="M32 6v10l3-2 3 2V6" fill="#dce7ff"/><circle cx="9" cy="6" r="3" fill="#f2b96d" stroke="none"/></>;
      break;
    case 'practice': case 'clock':
      artwork = <><circle cx="24" cy="25" r="17" fill={paper}/><path d="M24 15v11l7 4M19 4h10M24 4v4M36 9l3-3"/><path d="m12 24 5-7" stroke="#9bb1eb"/><circle cx="38" cy="11" r="4" fill="#f2b96d" stroke="none"/></>;
      break;
    case 'gear':
      artwork = <><rect x="7" y="7" width="34" height="34" rx="9" fill={paper}/><path d="M14 18h20M14 25h20M14 32h20"/><circle cx="20" cy="18" r="3" fill="#dce7ff"/><circle cx="29" cy="25" r="3" fill="#dce7ff"/><circle cx="19" cy="32" r="3" fill="#dce7ff"/><circle cx="39" cy="8" r="4" fill="#f2b96d" stroke="none"/></>;
      break;
    case 'bulb':
      artwork = <><path d="M17 32c0-5-7-7-7-15a14 14 0 0 1 28 0c0 8-7 10-7 15H17Z" fill={paper}/><path d="M18 37h12m-10 5h8M24 24v8m-5-13 5 5 5-5M4 16H1m46 0h-3M9 5 6 2m33 3 3-3"/><circle cx="35" cy="8" r="4" fill="#f2b96d" stroke="none"/></>;
      break;
    default:
      artwork = <><path d="M11 5h19l9 9v25a4 4 0 0 1-4 4H11a4 4 0 0 1-4-4V9a4 4 0 0 1 4-4Z" fill={paper}/><path d="M29 5v10h10M14 22h17M14 29h12M14 36h8"/><rect x="28" y="29" width="16" height="16" rx="5" fill="#dce7ff"/><path d="m32 37 3 3 5-6"/><circle cx="39" cy="7" r="3" fill="#f2b96d" stroke="none"/></>;
  }
  return <svg className="feature-artwork" width={size} height={size} viewBox="0 0 48 48" fill="none" stroke="#3659bf" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><defs><linearGradient id={id} x1="8" y1="6" x2="40" y2="43" gradientUnits="userSpaceOnUse"><stop stopColor="#fff"/><stop offset="1" stopColor="#eaf0ff"/></linearGradient></defs>{artwork}</svg>;
}
