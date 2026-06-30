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
    const matches = names
      .map((name) => ({ name, norm: normalize(name) }))
      .filter((entry) => entry.norm.includes(query) && !excludedSet.has(entry.norm));
    // Les noms qui commencent par la recherche d'abord, puis les autres, chacun en ordre alphabetique.
    matches.sort((a, b) => {
      const aStarts = a.norm.startsWith(query) ? 0 : 1;
      const bStarts = b.norm.startsWith(query) ? 0 : 1;
      if (aStarts !== bStarts) return aStarts - bStarts;
      return a.norm.localeCompare(b.norm);
    });
    return matches.map((entry) => entry.name);
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
