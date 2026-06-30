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
  onChange: (value: string) => void;
}

export function GuessAutocomplete({ value, names, disabled, onChange }: GuessAutocompleteProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const suggestions = useMemo(() => {
    const query = normalize(value.trim());
    if (!query) return [];
    return names.filter((name) => normalize(name).includes(query)).slice(0, 8);
  }, [value, names]);

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
        <ul className="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-control border border-border bg-surface py-1 shadow-lg">
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
