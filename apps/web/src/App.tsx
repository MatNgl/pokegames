import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { GamesPage } from '@/pages/games-page';
import { LoginPage } from '@/features/auth/login-page';
import { RegisterPage } from '@/features/auth/register-page';
import { WhoIsItPage } from '@/features/game/who-is-it-page';
import { MotusPage } from '@/features/game/motus-page';
import { PlusMinusPage } from '@/features/game/plus-minus-page';
import { IntruderPage } from '@/features/game/intruder-page';
import { ShinyPage } from '@/features/game/shiny-page';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<GamesPage />} />
        <Route path="/connexion" element={<LoginPage />} />
        <Route path="/inscription" element={<RegisterPage />} />
        <Route path="/jouer" element={<WhoIsItPage />} />
        <Route path="/motus" element={<MotusPage />} />
        <Route path="/plus-ou-moins" element={<PlusMinusPage />} />
        <Route path="/intrus" element={<IntruderPage />} />
        <Route path="/shiny" element={<ShinyPage mode="FIND_SHINY" />} />
        <Route path="/non-shiny" element={<ShinyPage mode="FIND_NON_SHINY" />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
