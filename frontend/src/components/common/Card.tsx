import { HTMLAttributes, ReactNode } from 'react';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export function Card({ children, className = '', ...rest }: CardProps) {
  return (
    <div
      className={`rounded-lg border border-paper-border bg-paper-raised shadow-sm ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}

export function CardHeader({ children, className = '', ...rest }: CardProps) {
  return (
    <div className={`border-b border-paper-border px-6 py-4 ${className}`} {...rest}>
      {children}
    </div>
  );
}

export function CardContent({ children, className = '', ...rest }: CardProps) {
  return (
    <div className={`px-6 py-5 ${className}`} {...rest}>
      {children}
    </div>
  );
}

export function CardFooter({ children, className = '', ...rest }: CardProps) {
  return (
    <div className={`border-t border-paper-border px-6 py-4 ${className}`} {...rest}>
      {children}
    </div>
  );
}
