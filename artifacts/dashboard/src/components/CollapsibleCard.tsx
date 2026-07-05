import { useState } from 'react';

interface CollapsibleCardProps {
  title: string;
  badge?: string | number;
  badgeVariant?: 'default' | 'warn' | 'danger';
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (v: boolean) => void;
  children: React.ReactNode;
  className?: string;
}

export default function CollapsibleCard({
  title, badge, badgeVariant = 'default', defaultOpen = true,
  open: controlledOpen, onOpenChange, children, className = ''
}: CollapsibleCardProps) {
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const isOpen = controlledOpen !== undefined ? controlledOpen : internalOpen;

  function toggle() {
    if (controlledOpen !== undefined) {
      onOpenChange?.(!isOpen);
    } else {
      setInternalOpen(o => !o);
    }
  }

  return (
    <div className={`ccard ${className}`}>
      <button type="button" className="ccard-header" onClick={toggle} aria-expanded={isOpen}>
        <span className="ccard-title">{title}</span>
        <span className="ccard-right">
          {badge !== undefined && (
            <span className={`cbadge ${badgeVariant}`}>{badge}</span>
          )}
          <span className={`chevron ${isOpen ? 'open' : ''}`}>›</span>
        </span>
      </button>
      {isOpen && <div className="ccard-body">{children}</div>}
    </div>
  );
}
