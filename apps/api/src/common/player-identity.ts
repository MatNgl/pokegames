import type { Request } from 'express';
import type { PlayerIdentity } from '../daily-result/daily-result.service';

/**
 * Identite du joueur pour l'enregistrement des resultats du jour.
 * Un compte connecte (req.user) prime toujours. Sinon on lit l'identite invite transmise par le
 * client dans les en-tetes `x-guest-id` / `x-guest-name` (persistee cote client en localStorage).
 * Le pseudo invite est nettoye (ASCII court) pour ne jamais afficher de valeur arbitraire.
 */
export function playerFromRequest(req: Request & { user?: { id?: string } }): PlayerIdentity {
  if (req.user?.id) {
    return { userId: req.user.id };
  }
  const rawId = headerValue(req, 'x-guest-id');
  if (!rawId) {
    return {};
  }
  const guestId = rawId.slice(0, 64);
  const rawName = headerValue(req, 'x-guest-name');
  const guestName = sanitizeGuestName(rawName) ?? fallbackGuestName(guestId);
  return { guestId, guestName };
}

function headerValue(req: Request, name: string): string | undefined {
  const value = req.headers[name];
  if (Array.isArray(value)) {
    return value[0];
  }
  return typeof value === 'string' ? value : undefined;
}

function sanitizeGuestName(raw: string | undefined): string | undefined {
  if (!raw) {
    return undefined;
  }
  const cleaned = raw.trim().replace(/[^A-Za-z0-9_]/g, '').slice(0, 24);
  return cleaned.length >= 3 ? cleaned : undefined;
}

/** Pseudo de repli deterministe si le client n'a pas fourni de nom lisible. */
function fallbackGuestName(guestId: string): string {
  const suffix = guestId.replace(/[^A-Za-z0-9]/g, '').slice(-4) || '0000';
  return `player_${suffix}`;
}
