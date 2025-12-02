// src/components/ui/index.jsx
import React from 'react';

/* Simple Image wrapper (fallback handling) */
export function Image({ src, alt = '', width, height, className = '', style = {}, ...rest }) {
  const fallback = '/images/placeholder.png';
  const srcToUse = src || fallback;
  return <img src={srcToUse} alt={alt} width={width} height={height} className={className} style={style} {...rest} />;
}

/* Card / CardContent */
export function Card({ children, className = '', ...rest }) {
  return <div className={`rounded-2xl ${className}`} {...rest}>{children}</div>;
}
export function CardContent({ children, className = '', ...rest }) {
  return <div className={`p-0 ${className}`} {...rest}>{children}</div>;
}

/* Button */
export function Button({ children, className = '', variant = 'solid', ...rest }) {
  const base = 'inline-flex items-center justify-center gap-2 rounded-lg font-medium';
  const solid = 'bg-[#33504F] text-white';
  const outline = 'border border-[#CFD0C8] text-[#33504F] bg-white';
  const ghost = 'bg-transparent text-[#33504F]';
  const sel = variant === 'outline' ? outline : variant === 'ghost' ? ghost : solid;
  return <button className={`${base} ${sel} ${className}`} {...rest}>{children}</button>;
}

/* Input */
export function Input(props) {
  const { className = '', ...rest } = props;
  return <input className={`px-3 py-2 rounded-lg border-2 border-[#CFD0C8] ${className}`} {...rest} />;
}

/* Badge */
export function Badge({ children, className = '', variant = 'solid', ...rest }) {
  const solid = 'inline-flex items-center px-2 py-1 rounded text-xs font-semibold';
  const sel = variant === 'outline' ? 'border-2 border-[#CFD0C8] bg-white text-[#666]' : 'bg-[#D7B15B] text-[#33504F]';
  return <span className={`${solid} ${sel} ${className}`} {...rest}>{children}</span>;
}

export default { Image, Card, CardContent, Button, Input, Badge };
