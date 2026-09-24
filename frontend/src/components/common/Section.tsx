import { ReactNode } from 'react';

interface SectionProps {
  id?: string;
  children: ReactNode;
  className?: string;
  bg?: 'paper' | 'raised' | 'forum' | 'slateteal';
}

const bgClasses = {
  paper: 'bg-paper',
  raised: 'bg-paper-raised',
  forum: 'bg-forum-50',
  slateteal: 'bg-slateteal-100',
};

export default function Section({
  id,
  children,
  className = '',
  bg = 'paper',
}: SectionProps) {
  return (
    <section id={id} className={`${bgClasses[bg]} ${className}`}>
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-6 lg:py-16 mt-4">
        {children}
      </div>
    </section>
  );
}
