import { api } from '@/lib/api';
import type {
  PokedexCatalogEntry,
  PokedexCollectResponse,
  PokedexCollectionDTO,
  PokedexDetailDTO,
  PokedexSpawnDTO,
} from '@pokegames/shared-types';

export async function getSpawns(): Promise<PokedexSpawnDTO[]> {
  const res = await api.get<PokedexSpawnDTO[]>('/pokedex/spawns');
  return res.data;
}

export async function collectSpawn(token: string): Promise<PokedexCollectResponse> {
  const res = await api.post<PokedexCollectResponse>('/pokedex/collect', { token });
  return res.data;
}

export async function getPokedexCatalog(): Promise<PokedexCatalogEntry[]> {
  const res = await api.get<PokedexCatalogEntry[]>('/pokedex/catalog');
  return res.data;
}

export async function getPokedexCollection(): Promise<PokedexCollectionDTO> {
  const res = await api.get<PokedexCollectionDTO>('/pokedex/collection');
  return res.data;
}

export async function markPokedexSeen(): Promise<void> {
  await api.post('/pokedex/seen', {});
}

export async function getPokedexDetail(id: number): Promise<PokedexDetailDTO> {
  const res = await api.get<PokedexDetailDTO>(`/pokedex/detail/${id}`);
  return res.data;
}

// Correspondance route -> zone d'apparition des easter eggs.
export const ROUTE_ZONE: Record<string, string> = {
  '/': 'home',
  '/quetes': 'quests',
  '/classements': 'leaderboard',
  '/historique': 'history',
  '/jouer': 'silhouette',
  '/motus': 'motus',
  '/plus-ou-moins': 'plus-minus',
  '/intrus': 'intruder',
  '/juste-stat': 'just-stat',
  '/bon-shiny': 'true-shiny',
  '/shiny': 'shiny',
  '/non-shiny': 'shiny',
  '/qui-est-ce': 'guess-who',
};
