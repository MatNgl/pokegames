import { useNavigate } from 'react-router-dom';
import { AppBackground } from '@/components/backgrounds/app-background';
import { AppHeader } from '@/components/layout/app-header';
import { Button } from '@/components/ui/button';
import { DailyQuestsPanel } from './daily-quests-panel';

export function QuestsPage() {
  const navigate = useNavigate();
  return (
    <AppBackground>
      <div className="flex min-h-screen flex-col">
        <AppHeader />
        <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-4 px-4 py-8">
          <DailyQuestsPanel />
          <Button className="w-full" onClick={() => navigate('/')}>
            Retour à l'accueil
          </Button>
        </main>
      </div>
    </AppBackground>
  );
}
