import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
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

function ConfigEditor({ configKey, value }: { configKey: string; value: unknown }) {
  const queryClient = useQueryClient();
  const [text, setText] = useState(() => JSON.stringify(value, null, 2));
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setText(JSON.stringify(value, null, 2));
  }, [value]);

  const mutation = useMutation({
    mutationFn: (parsed: unknown) => updateGameConfig(configKey, parsed),
    onSuccess: () => {
      setSaved(true);
      setError(null);
      void queryClient.invalidateQueries({ queryKey: ['admin-configs'] });
      window.setTimeout(() => setSaved(false), 2000);
    },
    onError: (err) => setError(getApiErrorMessage(err, 'Échec de la sauvegarde')),
  });

  const save = () => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      setError('JSON invalide.');
      return;
    }
    mutation.mutate(parsed);
  };

  return (
    <Card className="flex flex-col gap-2 p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-display text-xs uppercase text-foreground">
          {KEY_LABEL[configKey] ?? configKey}
        </h3>
        <div className="flex items-center gap-2">
          {saved && <span className="text-xs font-bold text-success">Enregistré</span>}
          <Button size="sm" onClick={save} disabled={mutation.isPending}>
            {mutation.isPending ? <Spinner className="h-4 w-4" /> : 'Enregistrer'}
          </Button>
        </div>
      </div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        spellCheck={false}
        className="h-56 w-full resize-y rounded-control border-2 border-border-strong bg-white p-3 font-mono text-xs text-foreground focus-visible:border-primary focus-visible:outline-none"
      />
      {error && <p className="text-sm font-semibold text-danger">{error}</p>}
    </Card>
  );
}

export function ConfigTab() {
  const { data, isLoading } = useQuery({ queryKey: ['admin-configs'], queryFn: getGameConfigs });

  if (isLoading) {
    return <Spinner className="mx-auto my-8 h-6 w-6 text-primary" />;
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs font-semibold text-muted">
        Source de vérité unique : ces valeurs pilotent les jeux à chaud (aucune constante). Édite le
        JSON puis enregistre.
      </p>
      {data?.map((c) => <ConfigEditor key={c.key} configKey={c.key} value={c.value} />)}
    </div>
  );
}
