import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { LoginPage } from '@/features/auth/login-page';
import { RegisterPage } from '@/features/auth/register-page';
import { WhoIsItPage } from '@/features/game/who-is-it-page';
import { MotusPage } from '@/features/game/motus-page';
import { PlusMinusPage } from '@/features/game/plus-minus-page';
import { IntruderPage } from '@/features/game/intruder-page';
import { ShinyPage } from '@/features/game/shiny-page';
import { JustStatPage } from '@/features/game/just-stat-page';
import { TrueShinyPage } from '@/features/game/true-shiny-page';
import { HistoryPage } from '@/features/daily/history-page';
import { LeaderboardPage } from '@/features/daily/leaderboard-page';
import { QuestsPage } from '@/features/daily/quests-page';
import { AdminPage } from '@/features/admin/admin-page';
import { GuessWhoPage } from '@/features/guess-who/guess-who-page';
import { HomePage } from '@/features/home/home-page';
import { PokedexPage } from '@/features/pokedex/pokedex-page';
import { EasterEggLayer } from '@/features/pokedex/easter-egg-layer';

export default function App() {
  return (
    <BrowserRouter>
      <EasterEggLayer />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/connexion" element={<LoginPage />} />
        <Route path="/inscription" element={<RegisterPage />} />
        <Route path="/jouer" element={<WhoIsItPage />} />
        <Route path="/motus" element={<MotusPage />} />
        <Route path="/plus-ou-moins" element={<PlusMinusPage />} />
        <Route path="/intrus" element={<IntruderPage />} />
        <Route path="/shiny" element={<ShinyPage mode="FIND_SHINY" />} />
        <Route path="/non-shiny" element={<ShinyPage mode="FIND_NON_SHINY" />} />
        <Route path="/juste-stat" element={<JustStatPage />} />
        <Route path="/bon-shiny" element={<TrueShinyPage />} />
        <Route path="/historique" element={<HistoryPage />} />
        <Route path="/classements" element={<LeaderboardPage />} />
        <Route path="/quetes" element={<QuestsPage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/qui-est-ce" element={<GuessWhoPage />} />
        <Route path="/pokedex" element={<PokedexPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
