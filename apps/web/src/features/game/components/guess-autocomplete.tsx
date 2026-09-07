import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
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
  /**
   * Cote d'ouverture de la liste. Par defaut vers le haut : dans la Silhouette le champ est en bas
   * de l'arene, une liste descendante sortirait de l'ecran. Les ecrans ou le champ est en tete
   * passent 'bottom'.
   */
  placement?: 'top' | 'bottom';
  onChange: (value: string) => void;
}

export function GuessAutocomplete({
  value,
  names,
  disabled,
  excluded,
  placement = 'top',
  onChange,
}: GuessAutocompleteProps) {
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const listId = useId();

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

  // Le surlignage repart de zero a chaque changement de liste.
  useEffect(() => {
    setHighlight(-1);
  }, [value]);

  const showList = open && suggestions.length > 0;

  const select = (name: string) => {
    onChange(name);
    setOpen(false);
    setHighlight(-1);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (!showList) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setHighlight((h) => (h + 1) % suggestions.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setHighlight((h) => (h <= 0 ? suggestions.length - 1 : h - 1));
    } else if (event.key === 'Enter' && highlight >= 0) {
      // Entree sur une suggestion surlignee : on la choisit sans soumettre le formulaire.
      event.preventDefault();
      const picked = suggestions[highlight];
      if (picked) select(picked);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      setOpen(false);
      setHighlight(-1);
    }
  };

  // Garde l'option surlignee visible dans la liste scrollable.
  useEffect(() => {
    if (highlight < 0 || !listRef.current) return;
    const node = listRef.current.children[highlight] as HTMLElement | undefined;
    node?.scrollIntoView({ block: 'nearest' });
  }, [highlight]);

  const activeId = highlight >= 0 ? `${listId}-opt-${highlight}` : undefined;

  return (
    <div ref={containerRef} className="relative w-full">
      <Input
        value={value}
        disabled={disabled}
        placeholder="Nom du Pokémon"
        autoComplete="off"
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={activeId}
        onKeyDown={onKeyDown}
        onChange={(event) => {
          onChange(event.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
      />
      {showList && (
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          className={`absolute z-20 max-h-56 w-full overflow-auto rounded-control border-2 border-border-strong bg-surface py-1 shadow-lg ${
            placement === 'bottom' ? 'top-full mt-1' : 'bottom-full mb-1'
          }`}
        >
          {suggestions.map((name, index) => (
            <li key={name} id={`${listId}-opt-${index}`} role="option" aria-selected={index === highlight}>
              <button
                type="button"
                tabIndex={-1}
                className={`flex w-full cursor-pointer items-center px-3 py-2 text-left text-sm text-foreground transition-colors duration-150 ${
                  index === highlight ? 'bg-surface-2' : 'hover:bg-surface-2'
                }`}
                onMouseEnter={() => setHighlight(index)}
                onClick={() => select(name)}
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
