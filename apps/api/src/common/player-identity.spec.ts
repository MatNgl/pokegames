import type { Request } from 'express';
import { playerFromRequest } from './player-identity';

type ReqWithUser = Request & { user?: { id?: string } };

/** Construit une fausse requête Express minimale (en-têtes + user optionnel). */
function makeRequest(
  headers: Record<string, string | string[] | undefined>,
  user?: { id?: string },
): ReqWithUser {
  return { headers, ...(user ? { user } : {}) } as unknown as ReqWithUser;
}

describe('playerFromRequest', () => {
  it('un compte connecté prime : renvoie userId, ignore les en-têtes invité', () => {
    const req = makeRequest({ 'x-guest-id': 'g_abcd', 'x-guest-name': 'player_abcd' }, { id: 'u1' });
    expect(playerFromRequest(req)).toEqual({ userId: 'u1' });
  });

  it('invité : lit guestId et pseudo nettoyé', () => {
    const req = makeRequest({ 'x-guest-id': 'g_abcd', 'x-guest-name': 'player_abcd' });
    expect(playerFromRequest(req)).toEqual({ guestId: 'g_abcd', guestName: 'player_abcd' });
  });

  it('ni compte ni guestId : identité vide (rien ne sera enregistré)', () => {
    expect(playerFromRequest(makeRequest({}))).toEqual({});
  });

  it('pseudo invité invalide (caractères spéciaux, trop court) : repli player_<suffixe>', () => {
    const req = makeRequest({ 'x-guest-id': 'guest-wx99', 'x-guest-name': '@@' });
    expect(playerFromRequest(req)).toEqual({ guestId: 'guest-wx99', guestName: 'player_wx99' });
  });

  it('pseudo invité sans caractère lisible du tout : repli player_0000', () => {
    const req = makeRequest({ 'x-guest-id': '----', 'x-guest-name': '   ' });
    expect(playerFromRequest(req)).toEqual({ guestId: '----', guestName: 'player_0000' });
  });

  it('pseudo invité : caractères interdits retirés, longueur max 24', () => {
    const req = makeRequest({
      'x-guest-id': 'g_1',
      'x-guest-name': 'Sacha!!! le dresseur de pokemon super long',
    });
    const player = playerFromRequest(req);
    expect(player.guestId).toBe('g_1');
    expect(player.guestName).toBe('Sachaledresseurdepokemon');
    expect(player.guestName?.length).toBe(24);
  });

  it('en-tête multi-valeur (tableau) : prend la première valeur', () => {
    const req = makeRequest({ 'x-guest-id': ['g_first', 'g_second'], 'x-guest-name': ['player_first'] });
    expect(playerFromRequest(req)).toEqual({ guestId: 'g_first', guestName: 'player_first' });
  });

  it('guestId tronqué à 64 caractères', () => {
    const longId = 'g_'.padEnd(120, 'x');
    const player = playerFromRequest(makeRequest({ 'x-guest-id': longId }));
    expect(player.guestId?.length).toBe(64);
    expect(player.guestId).toBe(longId.slice(0, 64));
  });
});
