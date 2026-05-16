interface ChipGroupProps {
  options: string[];
  selected: string[];
  onToggle(v: string): void;
  compact?: boolean;
}

export default function ChipGroup({ options, selected, onToggle, compact = false }: ChipGroupProps) {
  return (
    <div className={`chips ${compact ? 'compact' : ''}`}>
      {options.map(opt => (
        <button
          key={opt}
          type="button"
          className={`chip ${selected.includes(opt) ? 'on' : ''}`}
          onClick={() => onToggle(opt)}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}
