import { Badge } from '@/components/ui/badge';

export function ScorePill({ score, mistakes }: { score: number; mistakes: number }) {
  return (
    <div className="flex items-center gap-2">
      <Badge className="border-primary/40 bg-primary-soft text-primary">{score} pts</Badge>
      <Badge>
        {mistakes} erreur{mistakes > 1 ? 's' : ''}
      </Badge>
    </div>
  );
}
