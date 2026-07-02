import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';
import { getApiErrorMessage } from '@/lib/errors';
import { getGameConfigs, updateGameConfig } from './admin-api';

const KEY_LABEL: Record<string, string> = {
  WHO_IS_IT: 'Quel est ce Pokémon',
  MOTUS: 'Poké-Motus',
  PLUS_MINUS: 'Plus ou Moins',
  INTRUDER: "L'Intrus",
  SHINY: 'Trouve le shiny',
  TRUE_SHINY: 'Le Bon Shiny',
  JUST_STAT: 'La Juste Stat',
  ANTI_REPEAT: 'Anti-répétition',
};

type Json = unknown;

function isPlainObject(v: Json): v is Record<string, Json> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function ArrayField({ value, onChange }: { value: Json[]; onChange: (v: Json[]) => void }) {
  const numeric = value.every((v) => typeof v === 'number');
  const [text, setText] = useState(value.join(', '));
  useEffect(() => setText(value.join(', ')), [value]);

  const commit = (raw: string) => {
    setText(raw);
    const parts = raw
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    onChange(numeric ? parts.map((p) => Number(p)).filter((n) => Number.isFinite(n)) : parts);
  };

  return (
    <Input
      value={text}
      onChange={(e) => commit(e.target.value)}
      placeholder={numeric ? '1, 2, 3' : 'valeurs séparées par des virgules'}
    />
  );
}

function FieldEditor({
  label,
  value,
  onChange,
}: {
  label: string;
  value: Json;
  onChange: (v: Json) => void;
}) {
  if (typeof value === 'boolean') {
    return (
      <label className="flex items-center justify-between gap-3 py-1">
        <span className="text-xs font-semibold text-foreground">{label}</span>
        <input type="checkbox" checked={value} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4" />
      </label>
    );
  }
  if (typeof value === 'number') {
    return (
      <label className="flex items-center justify-between gap-3 py-1">
        <span className="text-xs font-semibold text-foreground">{label}</span>
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(e.target.value === '' ? 0 : Number(e.target.value))}
          className="h-8 w-24 rounded-control border-2 border-border-strong bg-white px-2 text-sm text-foreground focus-visible:border-primary focus-visible:outline-none"
        />
      </label>
    );
  }
  if (typeof value === 'string') {
    return (
      <label className="flex items-center justify-between gap-3 py-1">
        <span className="text-xs font-semibold text-foreground">{label}</span>
        <Input value={value} onChange={(e) => onChange(e.target.value)} className="h-8 w-40" />
      </label>
    );
  }
  if (Array.isArray(value)) {
    return (
      <div className="flex flex-col gap-1 py-1">
        <span className="text-xs font-semibold text-foreground">{label}</span>
        <ArrayField value={value} onChange={onChange} />
      </div>
    );
  }
  if (isPlainObject(value)) {
    return (
      <div className="flex flex-col gap-1 border-l-2 border-border-strong/40 pl-3">
        <span className="font-display text-[10px] uppercase text-muted">{label}</span>
        <ObjectEditor value={value} onChange={onChange} />
      </div>
    );
  }
  return null;
}

function ObjectEditor({
  value,
  onChange,
}: {
  value: Record<string, Json>;
  onChange: (v: Record<string, Json>) => void;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      {Object.entries(value).map(([k, v]) => (
        <FieldEditor
          key={k}
          label={k}
          value={v}
          onChange={(nv) => onChange({ ...value, [k]: nv })}
        />
      ))}
    </div>
  );
}

function ConfigEditor({ configKey, value }: { configKey: string; value: Json }) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<Json>(value);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => setDraft(value), [value]);

  const mutation = useMutation({
    mutationFn: () => updateGameConfig(configKey, draft),
    onSuccess: () => {
      setSaved(true);
      setError(null);
      void queryClient.invalidateQueries({ queryKey: ['admin-configs'] });
      window.setTimeout(() => setSaved(false), 2000);
    },
    onError: (err) => setError(getApiErrorMessage(err, 'Échec de la sauvegarde')),
  });

  return (
    <Card className="flex flex-col gap-2 p-4">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center justify-between gap-2"
      >
        <h3 className="font-display text-xs uppercase text-foreground">
          {KEY_LABEL[configKey] ?? configKey}
        </h3>
        <span className="text-xs font-semibold text-muted">{open ? 'Replier' : 'Modifier'}</span>
      </button>
      {open && (
        <>
          <div className="flex flex-col gap-1">
            {isPlainObject(draft) ? (
              <ObjectEditor value={draft} onChange={setDraft} />
            ) : (
              <FieldEditor label={configKey} value={draft} onChange={setDraft} />
            )}
          </div>
          <div className="flex items-center gap-2 pt-1">
            <Button size="sm" onClick={() => mutation.mutate()} disabled={mutation.isPending}>
              {mutation.isPending ? <Spinner className="h-4 w-4" /> : 'Enregistrer'}
            </Button>
            {saved && <span className="text-xs font-bold text-success">Enregistré</span>}
            {error && <span className={cn('text-xs font-semibold text-danger')}>{error}</span>}
          </div>
        </>
      )}
    </Card>
  );
}

export function ConfigTab() {
  const { data, isLoading } = useQuery({ queryKey: ['admin-configs'], queryFn: getGameConfigs });

  if (isLoading) {
    return <Spinner className="mx-auto my-8 h-6 w-6 text-primary" />;
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs font-semibold text-muted">
        Source de vérité unique : ces paramètres pilotent les jeux à chaud. Modifie les valeurs puis
        enregistre.
      </p>
      {data?.map((c) => <ConfigEditor key={c.key} configKey={c.key} value={c.value} />)}
    </div>
  );
}
