import { useMemo, useState, type CSSProperties } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowLeft, Hash, Lock, Ruler, Sparkles, Tag } from 'lucide-react';
import { AppBackground } from '@/components/backgrounds/app-background';
import { AppHeader } from '@/components/layout/app-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { HelpPopover } from '@/components/ui/help-popover';
import { cn } from '@/lib/utils';

// MAQUETTE (non branchee au jeu) : sert a valider la refonte visuelle de l'arene Silhouette.
// Donnees et interactions simulees localement, aucun appel reseau.

const LEVEL_COLOR = '#EAB308'; // Moyen (jaune), pour l'exemple.
const TOTAL_ROUNDS = 5;
const CURRENT_ROUND = 2;

const RULES = [
  'Devine le Pokémon caché derrière la silhouette.',
  'Chaque erreur débloque un nouvel indice.',
  'Objectif : trouver en le moins d’essais possible.',
];

interface Hint {
  type: string;
  label: string;
  value: string;
  unlockAt: number;
  Icon: typeof Tag;
}

const HINTS: Hint[] = [
  { type: 'TYPE_1', label: 'Type 1', value: 'Électrik', unlockAt: 1, Icon: Tag },
  { type: 'HEIGHT', label: 'Taille', value: '0,4 m', unlockAt: 2, Icon: Ruler },
  { type: 'GENERATION', label: 'Génération', value: '1', unlockAt: 3, Icon: Hash },
  { type: 'BLURRED_COLOR', label: 'Aperçu couleur', value: 'Dévoilé', unlockAt: 4, Icon: Sparkles },
];

// Silhouette generique (creature stylisee) : noire tant que non trouvee, coloree a la revelation.
function Creature({ revealed }: { revealed: boolean }) {
  return (
    <svg
      viewBox="0 0 200 210"
      className="h-4/5 w-4/5"
      style={{ color: revealed ? '#F7C948' : '#15151b' }}
      aria-hidden
    >
      <g fill="currentColor">
        {/* oreilles */}
        <path d="M62 60 L44 6 L86 46 Z" />
        <path d="M138 60 L156 6 L114 46 Z" />
        {/* corps */}
        <ellipse cx="100" cy="120" rx="58" ry="62" />
        {/* pieds */}
        <ellipse cx="78" cy="188" rx="18" ry="14" />
        <ellipse cx="122" cy="188" rx="18" ry="14" />
        {/* queue eclair */}
        <path d="M150 96 L188 70 L168 96 L196 92 L156 140 L170 108 L146 118 Z" />
      </g>
      {revealed && (
        <g>
          {/* pointes d'oreilles */}
          <path d="M50 22 L44 6 L60 22 Z" fill="#15151b" />
          <path d="M150 22 L156 6 L140 22 Z" fill="#15151b" />
          {/* joues */}
          <circle cx="66" cy="132" r="11" fill="#EE1515" />
          <circle cx="134" cy="132" r="11" fill="#EE1515" />
          {/* yeux + sourire */}
          <circle cx="82" cy="108" r="6" fill="#15151b" />
          <circle cx="118" cy="108" r="6" fill="#15151b" />
          <path d="M92 124 Q100 132 108 124" stroke="#15151b" strokeWidth="3" fill="none" strokeLinecap="round" />
        </g>
      )}
    </svg>
  );
}

function RoundPills() {
  return (
    <div className="flex items-center gap-1" aria-label={`Manche ${CURRENT_ROUND} sur ${TOTAL_ROUNDS}`}>
      {Array.from({ length: TOTAL_ROUNDS }, (_, i) => {
        const n = i + 1;
        const done = n < CURRENT_ROUND;
        const current = n === CURRENT_ROUND;
        return (
          <span
            key={n}
            className={cn(
              'h-2.5 w-2.5 rounded-full border-2 transition-colors',
              done && 'border-go-shadow bg-go',
              current && 'border-primary-shadow bg-primary',
              !done && !current && 'border-border-strong bg-surface-2',
            )}
          />
        );
      })}
    </div>
  );
}

export function SilhouetteMockupPage() {
  const reduceMotion = useReducedMotion();
  const [mistakes, setMistakes] = useState(2);
  const [revealed, setRevealed] = useState(false);
  const [revealedHints, setRevealedHints] = useState<Set<string>>(new Set(['TYPE_1']));

  const attempts = useMemo(() => mistakes, [mistakes]);

  const reveal = (type: string) =>
    setRevealedHints((prev) => {
      const next = new Set(prev);
      next.add(type);
      return next;
    });

  return (
    <AppBackground>
      <div className="flex min-h-screen flex-col">
        <AppHeader />
        <main className="flex flex-1 items-center justify-center px-4 py-8">
          <Card className="flex w-full max-w-xl flex-col gap-5 p-4 sm:p-6">
            {/* En-tete de manche */}
            <div className="flex flex-wrap items-start justify-between gap-2 sm:gap-4">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  aria-label="Changer de niveau"
                  className="flex h-9 w-9 items-center justify-center rounded-full text-muted transition-colors hover:text-primary"
                >
                  <ArrowLeft className="h-5 w-5" />
                </button>
                <div>
                  <h1 className="font-display text-sm leading-relaxed text-foreground">
                    Quel est ce Pokémon ?
                  </h1>
                  <div className="mt-1 flex items-center gap-2">
                    <span className="font-display text-lg leading-none text-primary">{attempts}</span>
                    <span className="text-xs font-bold text-muted">
                      essai{attempts > 1 ? 's' : ''} · vise le minimum
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex flex-col items-end gap-1.5">
                <div className="flex items-center gap-2">
                  <Badge
                    style={{ borderColor: LEVEL_COLOR, backgroundColor: LEVEL_COLOR, color: '#2B2A24' } as CSSProperties}
                  >
                    Moyen
                  </Badge>
                  <HelpPopover ariaLabel="Règles du jeu" rules={RULES} />
                </div>
                <RoundPills />
              </div>
            </div>

            <div className="flex w-full flex-wrap items-stretch justify-center gap-4">
              {/* Scene : cadre console + halo + ombre au sol */}
              <div className="relative mx-auto flex aspect-square w-full max-w-xs items-center justify-center overflow-hidden rounded-card border-4 border-border-strong bg-tile p-3">
                {/* liseré console interne */}
                <div className="pointer-events-none absolute inset-1.5 rounded-[14px] border-2 border-border-strong/40" />
                {/* LED */}
                <span className="absolute left-3 top-3 flex items-center gap-1">
                  <span className="h-2.5 w-2.5 rounded-full bg-danger shadow-[0_0_6px_rgba(238,21,21,0.8)]" />
                  <span className="h-1.5 w-1.5 rounded-full bg-go" />
                </span>
                {/* halo radial derriere le pokemon */}
                <div
                  className="pointer-events-none absolute inset-0"
                  style={{
                    background:
                      'radial-gradient(circle at 50% 44%, rgba(255,203,5,0.28), rgba(255,203,5,0) 62%)',
                  }}
                />
                {/* Pokemon + ombre au sol */}
                <div className="relative flex h-full w-full flex-col items-center justify-center">
                  <motion.div
                    key={revealed ? 'revealed' : 'hidden'}
                    initial={revealed && !reduceMotion ? { scale: 1.15, opacity: 0.6 } : false}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ duration: 0.5, ease: 'easeOut' }}
                    className={cn(
                      'flex h-4/5 w-4/5 items-center justify-center',
                      revealed && 'drop-shadow-[0_0_18px_rgba(255,203,5,0.6)]',
                    )}
                  >
                    <Creature revealed={revealed} />
                  </motion.div>
                  <span
                    aria-hidden
                    className="absolute bottom-[8%] h-3 w-2/5 rounded-[50%] bg-black/25 blur-[3px]"
                  />
                </div>
                {/* flash de revelation */}
                {revealed && !reduceMotion && (
                  <motion.div
                    className="pointer-events-none absolute inset-0 bg-white"
                    initial={{ opacity: 0.7 }}
                    animate={{ opacity: 0 }}
                    transition={{ duration: 0.5 }}
                  />
                )}
              </div>

              {/* Indices : boutons de jeu, largeur fixe */}
              <div className="flex w-36 shrink-0 flex-col gap-2">
                <span className="font-display text-[9px] uppercase tracking-widest text-muted">Indices</span>
                {HINTS.map((hint) => {
                  const isRevealed = revealedHints.has(hint.type);
                  const unlocked = mistakes >= hint.unlockAt;
                  const plural = hint.unlockAt > 1 ? 's' : '';

                  if (isRevealed) {
                    return (
                      <div key={hint.type} className="flex items-center justify-end gap-2" title={hint.label}>
                        <span className="min-w-0 flex-1 truncate text-right text-xs font-bold text-foreground">
                          {hint.value}
                        </span>
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-control border-2 border-go-shadow bg-go text-go-foreground shadow-[0_2px_0_var(--color-go-shadow)]">
                          <hint.Icon className="h-4 w-4" />
                        </span>
                      </div>
                    );
                  }

                  if (!unlocked) {
                    return (
                      <div
                        key={hint.type}
                        className="flex items-center justify-end gap-2"
                        title={`${hint.label} : débloqué à ${hint.unlockAt} erreur${plural}`}
                      >
                        <span className="text-[10px] font-bold text-muted/70">{hint.unlockAt} err.</span>
                        <span className="flex h-9 w-9 items-center justify-center rounded-control border-2 border-border-strong bg-surface-2 text-muted/60">
                          <Lock className="h-4 w-4" />
                        </span>
                      </div>
                    );
                  }

                  return (
                    <div key={hint.type} className="flex justify-end">
                      <motion.button
                        type="button"
                        onClick={() => reveal(hint.type)}
                        aria-label={`Révéler ${hint.label}`}
                        title={`${hint.label} : révéler`}
                        initial={!reduceMotion ? { scale: 0.6, opacity: 0 } : false}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ type: 'spring', stiffness: 500, damping: 18 }}
                        className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-control border-2 border-go bg-surface text-go-shadow shadow-[0_2px_0_var(--color-go)] transition-colors duration-200 hover:bg-go hover:text-white"
                      >
                        <hint.Icon className="h-4 w-4" />
                      </motion.button>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Saisie */}
            <div className="mx-auto flex w-full max-w-md flex-col gap-2">
              <div className="flex gap-2">
                <input
                  placeholder="Nom du Pokémon…"
                  className="h-11 flex-1 rounded-control border-2 border-border-strong bg-white px-3 text-base font-semibold text-foreground focus-visible:border-primary focus-visible:outline-none"
                />
                <Button type="button" className="h-11 px-5">
                  Valider
                </Button>
              </div>
              <p role="status" className="min-h-5 text-center text-sm font-semibold text-danger" />
            </div>

            {/* Panneau maquette (ne figurera pas dans le jeu final) */}
            <div className="flex flex-wrap items-center justify-center gap-2 rounded-control border-2 border-dashed border-border-strong/60 p-3">
              <span className="font-display text-[9px] uppercase text-muted">Maquette</span>
              <Button type="button" variant="secondary" size="sm" onClick={() => setMistakes((m) => Math.min(4, m + 1))}>
                +1 erreur
              </Button>
              <Button type="button" variant="secondary" size="sm" onClick={() => setRevealed((r) => !r)}>
                {revealed ? 'Masquer' : 'Révéler'}
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => {
                  setMistakes(0);
                  setRevealed(false);
                  setRevealedHints(new Set());
                }}
              >
                Reset
              </Button>
            </div>
          </Card>
        </main>
      </div>
    </AppBackground>
  );
}
