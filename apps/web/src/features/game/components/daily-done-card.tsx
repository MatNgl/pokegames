import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

// Affichee quand le serveur refuse le defi car deja termine aujourd'hui (verrou 1x/jour).
export function DailyDoneCard({ onBack }: { onBack?: () => void }) {
  const navigate = useNavigate();
  return (
    <Card className="flex w-full max-w-md flex-col items-center gap-4 p-8 text-center">
      <span className="font-display text-[10px] uppercase tracking-widest text-success">
        Défi déjà terminé
      </span>
      <p className="text-sm font-semibold text-muted">
        Tu as déjà joué ce défi aujourd'hui. Reviens demain pour un nouveau défi.
      </p>
      <Button className="w-full" onClick={() => navigate('/')}>
        Retour à l'accueil
      </Button>
      {onBack && (
        <Button variant="secondary" size="sm" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
          Changer de niveau
        </Button>
      )}
    </Card>
  );
}
