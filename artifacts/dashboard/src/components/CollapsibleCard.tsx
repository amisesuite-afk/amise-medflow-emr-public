import { useState } from 'react';

interface CollapsibleCardProps {
  title: string;
  badge?: string | number;
  badgeVariant?: 'default' | 'warn' | 'danger';
  defaultOpen?: boolean;
  children: React.ReactNode;
  className?: string;
}

export default function CollapsibleCard({
  title, badge, badgeVariant = 'default', defaultOpen = true, children, className = ''
}: CollapsibleCardProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className={`ccard ${className}`}>
      <button type="button" className="ccard-header" onClick={() => setOpen(o => !o)} aria-expanded={open}>
        <span className="ccard-title">{title}</span>
        <span className="ccard-right">
          {badge !== undefined && (
            <span className={`cbadge ${badgeVariant}`}>{badge}</span>
          )}
          <span className={`chevron ${open ? 'open' : ''}`}>›</span>
        </span>
      </button>
      {open && <div className="ccard-body">{children}</div>}
    </div>
  );
}
