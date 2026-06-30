import { useEffect, useMemo, useRef, useState } from 'react';
import { Input } from '@/components/ui/input';

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

interface GuessAutocompleteProps {
  value: string;
  names: string[];
  disabled?: boolean;
  excluded?: string[];
  onChange: (value: string) => void;
}

export function GuessAutocomplete({
  value,
  names,
  disabled,
  excluded,
  onChange,
}: GuessAutocompleteProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const excludedSet = useMemo(() => new Set((excluded ?? []).map(normalize)), [excluded]);

  const suggestions = useMemo(() => {
    const query = normalize(value.trim());
    if (!query) return [];
    return names
      .filter((name) => {
        const normalized = normalize(name);
        return normalized.includes(query) && !excludedSet.has(normalized);
      })
      .slice(0, 8);
  }, [value, names, excludedSet]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const showList = open && suggestions.length > 0;

  return (
    <div ref={containerRef} className="relative w-full">
      <Input
        value={value}
        disabled={disabled}
        placeholder="Nom du Pokémon"
        autoComplete="off"
        onChange={(event) => {
          onChange(event.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
      />
      {showList && (
        <ul className="absolute bottom-full z-20 mb-1 max-h-56 w-full overflow-auto rounded-control border-2 border-border-strong bg-surface py-1 shadow-lg">
          {suggestions.map((name) => (
            <li key={name}>
              <button
                type="button"
                className="flex w-full cursor-pointer items-center px-3 py-2 text-left text-sm text-foreground transition-colors duration-150 hover:bg-surface-2"
                onClick={() => {
                  onChange(name);
                  setOpen(false);
                }}
              >
                {name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
