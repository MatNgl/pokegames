import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { History, RotateCcw, TriangleAlert } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';
import { getApiErrorMessage } from '@/lib/errors';
import {
  getGameConfigDefaults,
  getGameConfigLogs,
  getGameConfigs,
  resetGameConfig,
  updateGameConfig,
} from './admin-api';

const KEY_LABEL: Record<string, string> = {
  WHO_IS_IT: 'Quel est ce Pokémon',
  MOTUS: 'Poké-Motus',
  PLUS_MINUS: 'Plus ou Moins',
  INTRUDER: "L'Intrus",
  SHINY: 'Trouve le shiny',
  TRUE_SHINY: 'Le Bon Shiny',
  JUST_STAT: 'La Juste Stat',
  GUESS_WHO: 'Qui est-ce',
  POKEDEX: 'Le Pokédex',
  ANTI_REPEAT: 'Anti-répétition',
};

type Json = unknown;

function isPlainObject(v: Json): v is Record<string, Json> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/**
 * Serialisation a cles triees. Comparer deux configs avec JSON.stringify brut donne des faux
 * positifs : le serveur complete les valeurs stockees avec les nouveaux champs par defaut, ce qui
 * change l'ordre des cles sans changer le contenu, et tous les jeux passaient pour "personnalises".
 */
function stableStringify(v: Json): string {
  if (Array.isArray(v)) return `[${v.map(stableStringify).join(',')}]`;
  if (isPlainObject(v)) {
    const body = Object.keys(v)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${stableStringify(v[k])}`)
      .join(',');
    return `{${body}}`;
  }
  return JSON.stringify(v) ?? 'null';
}

function sameValue(a: Json, b: Json): boolean {
  return stableStringify(a) === stableStringify(b);
}

/** Rend une valeur par defaut sur une ligne, sans guillemets parasites sur les chaines. */
function showDefault(v: Json): string {
  if (Array.isArray(v)) return v.join(', ');
  if (typeof v === 'string') return v;
  return JSON.stringify(v) ?? '';
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

interface FieldContext {
  /** Chemin complet du champ, ex. "levels.FACILE.gridSize" : sert au rappel du defaut et a l'erreur. */
  path: string;
  /** Valeur par defaut du champ, affichee quand l'admin s'en ecarte. */
  fallback: Json;
  /** Chemin signale en erreur par le serveur, mis en evidence dans le formulaire. */
  errorPath: string | null;
}

/**
 * Ligne de champ : libelle a gauche, controle a droite. Un champ qui s'ecarte du defaut porte une
 * pastille et rappelle la valeur d'origine, sinon l'admin ne sait plus ce qu'il a touche.
 */
function FieldRow({
  label,
  ctx,
  control,
  stacked,
}: {
  label: string;
  ctx: FieldContext;
  control: React.ReactNode;
  stacked?: boolean;
}) {
  const faulty = ctx.errorPath === ctx.path;

  return (
    <div
      className={cn(
        'rounded-control px-1.5 py-1',
        faulty && 'bg-danger/10 ring-2 ring-danger',
      )}
    >
      <div
        className={cn(
          'gap-3',
          stacked ? 'flex flex-col' : 'flex flex-wrap items-center justify-between',
        )}
      >
        <span className="text-xs font-semibold text-foreground">{label}</span>
        {control}
      </div>
    </div>
  );
}

function FieldEditor({
  label,
  value,
  ctx,
  onChange,
}: {
  label: string;
  value: Json;
  ctx: FieldContext;
  onChange: (v: Json) => void;
}) {
  if (typeof value === 'boolean') {
    return (
      <FieldRow
        label={label}
        ctx={ctx}
        control={
          <input
            type="checkbox"
            checked={value}
            onChange={(e) => onChange(e.target.checked)}
            aria-label={label}
            className="h-4 w-4"
          />
        }
      />
    );
  }
  if (typeof value === 'number') {
    return (
      <FieldRow
        label={label}
        ctx={ctx}
        control={
          <input
            type="number"
            value={value}
            aria-label={label}
            onChange={(e) => onChange(e.target.value === '' ? 0 : Number(e.target.value))}
            className="h-8 w-24 rounded-control border-2 border-border-strong bg-white px-2 text-sm text-foreground focus-visible:border-primary focus-visible:outline-none"
          />
        }
      />
    );
  }
  if (typeof value === 'string') {
    return (
      <FieldRow
        label={label}
        ctx={ctx}
        control={
          <Input
            value={value}
            aria-label={label}
            onChange={(e) => onChange(e.target.value)}
            className="h-8 w-40"
          />
        }
      />
    );
  }
  if (Array.isArray(value)) {
    return (
      <FieldRow
        label={label}
        ctx={ctx}
        stacked
        control={<ArrayField value={value} onChange={onChange} />}
      />
    );
  }
  if (isPlainObject(value)) {
    return (
      <div className="flex flex-col gap-1 border-l-2 border-border-strong/40 pl-3">
        <span className="text-[11px] font-bold uppercase tracking-wide text-muted">{label}</span>
        <ObjectEditor
          value={value}
          fallback={isPlainObject(ctx.fallback) ? ctx.fallback : {}}
          path={ctx.path}
          errorPath={ctx.errorPath}
          onChange={onChange}
        />
      </div>
    );
  }
  return null;
}

function ObjectEditor({
  value,
  fallback,
  path,
  errorPath,
  onChange,
}: {
  value: Record<string, Json>;
  fallback: Record<string, Json>;
  path: string;
  errorPath: string | null;
  onChange: (v: Record<string, Json>) => void;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      {Object.entries(value).map(([k, v]) => {
        const childPath = path ? `${path}.${k}` : k;
        const def = fallback[k];
        const modified = def !== undefined && !sameValue(v, def) && !isPlainObject(v);
        return (
          <div key={k} className={cn(modified && 'border-l-2 border-accent-shadow pl-1.5')}>
            <FieldEditor
              label={k}
              value={v}
              ctx={{ path: childPath, fallback: def, errorPath }}
              onChange={(nv) => onChange({ ...value, [k]: nv })}
            />
            {modified && (
              <p className="px-1.5 pb-1 text-[10px] font-semibold text-muted">
                défaut : {showDefault(def)}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** Extrait le chemin du champ fautif d'un message serveur ("levels.FACILE.gridSize : ..."). */
function faultyPath(message: string | null): string | null {
  if (!message) return null;
  const match = /([A-Za-z0-9_.]+)\s:\s/.exec(message);
  return match?.[1] ?? null;
}

function ConfigEditor({
  configKey,
  value,
  defaults,
}: {
  configKey: string;
  value: Json;
  defaults: Json;
}) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<Json>(value);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  useEffect(() => setDraft(value), [value]);

  const isDefault = sameValue(value, defaults);
  const dirty = !sameValue(draft, value);

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['admin-configs'] });
    void queryClient.invalidateQueries({ queryKey: ['admin-config-logs'] });
  };

  const save = useMutation({
    mutationFn: () => updateGameConfig(configKey, draft),
    onSuccess: () => {
      setSaved(true);
      setError(null);
      invalidate();
      window.setTimeout(() => setSaved(false), 2000);
    },
    onError: (err) => setError(getApiErrorMessage(err, 'Échec de la sauvegarde')),
  });

  const reset = useMutation({
    mutationFn: () => resetGameConfig(configKey),
    onSuccess: (restored) => {
      setDraft(restored);
      setError(null);
      setConfirmReset(false);
      invalidate();
    },
    onError: (err) => setError(getApiErrorMessage(err, 'Échec de la remise aux défauts')),
  });

  return (
    <Card className="flex flex-col gap-2 p-4">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex items-center justify-between gap-2"
      >
        <span className="flex min-w-0 items-center gap-2">
          <h3 className="truncate text-sm font-extrabold uppercase tracking-wide text-foreground">
            {KEY_LABEL[configKey] ?? configKey}
          </h3>
          {!isDefault && (
            <Badge className="shrink-0 border-accent-shadow bg-accent text-foreground">
              Personnalisé
            </Badge>
          )}
        </span>
        <span className="shrink-0 text-xs font-semibold text-muted">
          {open ? 'Replier' : 'Modifier'}
        </span>
      </button>

      {open && (
        <>
          <div className="flex flex-col gap-1">
            {isPlainObject(draft) ? (
              <ObjectEditor
                value={draft}
                fallback={isPlainObject(defaults) ? defaults : {}}
                path=""
                errorPath={faultyPath(error)}
                onChange={setDraft}
              />
            ) : (
              <FieldEditor
                label={configKey}
                value={draft}
                ctx={{ path: configKey, fallback: defaults, errorPath: faultyPath(error) }}
                onChange={setDraft}
              />
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Button size="sm" onClick={() => save.mutate()} disabled={save.isPending || !dirty}>
              {save.isPending ? <Spinner className="h-4 w-4" /> : 'Enregistrer'}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setConfirmReset(true)}
              disabled={reset.isPending || isDefault}
            >
              <RotateCcw className="mr-1 h-3.5 w-3.5" />
              Réinitialiser
            </Button>
            {saved && <span className="text-xs font-bold text-success">Enregistré</span>}
            {dirty && !saved && (
              <span className="text-xs font-semibold text-muted">Modifications non enregistrées</span>
            )}
          </div>

          {error && (
            <p className="flex items-start gap-2 rounded-control border-2 border-danger bg-danger/10 px-3 py-2 text-xs font-semibold text-foreground">
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-danger" />
              {error}
            </p>
          )}

          {confirmReset && (
            <div className="flex flex-wrap items-center gap-2 rounded-control border-2 border-accent-shadow/50 bg-accent/10 px-3 py-2">
              <span className="text-xs font-semibold text-foreground">
                Rétablir toutes les valeurs par défaut de {KEY_LABEL[configKey] ?? configKey} ?
              </span>
              <Button size="sm" onClick={() => reset.mutate()} disabled={reset.isPending}>
                {reset.isPending ? <Spinner className="h-4 w-4" /> : 'Confirmer'}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setConfirmReset(false)}>
                Annuler
              </Button>
            </div>
          )}
        </>
      )}
    </Card>
  );
}

/** Journal des changements : qui a touche a quoi, et quelle valeur exacte a bouge. */
function ConfigHistory() {
  const { data, isLoading } = useQuery({
    queryKey: ['admin-config-logs'],
    queryFn: getGameConfigLogs,
  });

  return (
    <Card className="flex flex-col gap-2 p-4">
      <h3 className="flex items-center gap-2 text-sm font-extrabold uppercase tracking-wide text-foreground">
        <History className="h-4 w-4" />
        Modifications récentes
      </h3>

      {isLoading ? (
        <Spinner className="mx-auto my-4 h-5 w-5 text-primary" />
      ) : !data || data.length === 0 ? (
        <p className="py-3 text-center text-sm font-semibold text-muted">
          Aucune modification enregistrée.
        </p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {data.map((log) => (
            <li
              key={log.id}
              className="rounded-control border-2 border-border-strong bg-surface-2/50 px-3 py-2"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-bold text-foreground">
                  {KEY_LABEL[log.key] ?? log.key}
                  <span className="ml-1.5 font-semibold text-muted">
                    {log.action === 'RESET' ? 'remis aux défauts' : 'modifié'} par {log.adminName}
                  </span>
                </span>
                <span className="text-[11px] font-semibold tabular-nums text-muted">
                  {new Date(log.createdAt).toLocaleString('fr-FR', {
                    dateStyle: 'short',
                    timeStyle: 'short',
                  })}
                </span>
              </div>
              {log.changes.length > 0 && (
                <ul className="mt-1 flex flex-col gap-0.5">
                  {log.changes.slice(0, 6).map((c) => (
                    <li key={c.path} className="text-[11px] font-semibold text-muted">
                      <span className="text-foreground">{c.path}</span> : {c.before}{' '}
                      <span aria-hidden="true">-&gt;</span>{' '}
                      <span className="text-foreground">{c.after}</span>
                    </li>
                  ))}
                  {log.changes.length > 6 && (
                    <li className="text-[11px] font-semibold text-muted/70">
                      et {log.changes.length - 6} autre(s) champ(s)
                    </li>
                  )}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export function ConfigTab() {
  const { data, isLoading } = useQuery({ queryKey: ['admin-configs'], queryFn: getGameConfigs });
  const { data: defaults } = useQuery({
    queryKey: ['admin-config-defaults'],
    queryFn: getGameConfigDefaults,
  });

  const defaultByKey = useMemo(
    () => new Map((defaults ?? []).map((d) => [d.key, d.value])),
    [defaults],
  );

  if (isLoading) {
    return <Spinner className="mx-auto my-8 h-6 w-6 text-primary" />;
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs font-semibold text-muted">
        Source de vérité unique : ces paramètres pilotent les jeux à chaud. Les valeurs sont
        contrôlées à l'enregistrement (bornes minimales et maximales), et chaque modification est
        journalisée avec son auteur.
      </p>
      {data?.map((c) => (
        <ConfigEditor
          key={c.key}
          configKey={c.key}
          value={c.value}
          defaults={defaultByKey.get(c.key)}
        />
      ))}
      <ConfigHistory />
    </div>
  );
}
