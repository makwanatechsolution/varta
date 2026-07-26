import React from "react";

interface GifIconProps extends React.SVGProps<SVGSVGElement> {
  className?: string;
}

export const GifIcon: React.FC<GifIconProps> = ({ className = "h-6 w-6", ...props }) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      {/* Outer rounded container box */}
      <rect x="3" y="3" width="18" height="18" rx="4" ry="4" />
      {/* 'G' */}
      <path d="M 9 9.5 H 7 A 1.5 1.5 0 0 0 5.5 11 v 2 A 1.5 1.5 0 0 0 7 14.5 H 9 v -2.5 H 7.5" />
      {/* 'I' */}
      <path d="M 12 9.5 v 5" />
      {/* 'F' */}
      <path d="M 15 14.5 v -5 h 3.5 M 15 12 h 2.5" />
    </svg>
  );
};

export default GifIcon;
