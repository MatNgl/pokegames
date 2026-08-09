import { Test, TestingModule } from '@nestjs/testing';
import { AdminRetentionService } from './admin-retention.service';
import { PrismaService } from '../prisma/prisma.service';

describe('AdminRetentionService', () => {
  let service: AdminRetentionService;
  let prisma: { user: { findMany: jest.Mock }; gameAuditLog: { findMany: jest.Mock } };

  beforeEach(async () => {
    prisma = {
      user: { findMany: jest.fn().mockResolvedValue([]) },
      gameAuditLog: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [AdminRetentionService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get<AdminRetentionService>(AdminRetentionService);
  });

  it('doit être défini', () => {
    expect(service).toBeDefined();
  });

  it('calcule la rétention par cohorte hebdomadaire', async () => {
    // Deux inscrits le meme lundi ; un seul rejoue la semaine suivante.
    prisma.user.findMany.mockResolvedValue([
      { id: 'u1', username: 'Alice', createdAt: new Date('2026-07-06T10:00:00Z') },
      { id: 'u2', username: 'Bob', createdAt: new Date('2026-07-06T11:00:00Z') },
    ]);
    prisma.gameAuditLog.findMany.mockResolvedValue([
      { userId: 'u1', createdAt: new Date('2026-07-07T10:00:00Z') }, // semaine 0
      { userId: 'u2', createdAt: new Date('2026-07-08T10:00:00Z') }, // semaine 0
      { userId: 'u1', createdAt: new Date('2026-07-15T10:00:00Z') }, // semaine 1
    ]);

    const r = await service.getReport(new Date('2026-07-20T12:00:00Z'));
    const cohorte = r.cohorts[0];
    expect(cohorte?.week).toBe('2026-07-06');
    expect(cohorte?.size).toBe(2);
    expect(cohorte?.retentionPct[0]).toBe(100); // les deux jouent la 1re semaine
    expect(cohorte?.retentionPct[1]).toBe(50); // un seul revient
  });

  it('n’affiche pas de taux pour les semaines non encore écoulées', async () => {
    prisma.user.findMany.mockResolvedValue([
      { id: 'u1', username: 'Alice', createdAt: new Date('2026-07-13T10:00:00Z') },
    ]);
    prisma.gameAuditLog.findMany.mockResolvedValue([
      { userId: 'u1', createdAt: new Date('2026-07-13T12:00:00Z') },
    ]);

    const r = await service.getReport(new Date('2026-07-15T12:00:00Z'));
    // Semaine 0 en cours : chiffree. Les suivantes ne sont pas encore arrivees : null.
    expect(r.cohorts[0]?.retentionPct[0]).toBe(100);
    expect(r.cohorts[0]?.retentionPct[1]).toBeNull();
  });

  it('signale les joueurs sans activité depuis une semaine', async () => {
    prisma.user.findMany.mockResolvedValue([
      { id: 'u1', username: 'Parti', createdAt: new Date('2026-06-01T10:00:00Z') },
      { id: 'u2', username: 'Present', createdAt: new Date('2026-06-01T10:00:00Z') },
    ]);
    prisma.gameAuditLog.findMany.mockResolvedValue([
      { userId: 'u1', createdAt: new Date('2026-07-01T10:00:00Z') }, // 19 jours avant
      { userId: 'u2', createdAt: new Date('2026-07-19T10:00:00Z') }, // la veille
    ]);

    const r = await service.getReport(new Date('2026-07-20T12:00:00Z'));
    expect(r.atRisk.map((u) => u.username)).toEqual(['Parti']);
    expect(r.atRisk[0]?.daysSinceLastPlay).toBe(19);
  });

  it('distribue les joueurs par nombre de jours joués', async () => {
    prisma.user.findMany.mockResolvedValue([
      { id: 'u1', username: 'A', createdAt: new Date('2026-07-01T10:00:00Z') },
      { id: 'u2', username: 'B', createdAt: new Date('2026-07-01T10:00:00Z') },
    ]);
    prisma.gameAuditLog.findMany.mockResolvedValue([
      // u1 joue 2 jours distincts (dont deux fois le meme jour)
      { userId: 'u1', createdAt: new Date('2026-07-10T10:00:00Z') },
      { userId: 'u1', createdAt: new Date('2026-07-10T18:00:00Z') },
      { userId: 'u1', createdAt: new Date('2026-07-11T10:00:00Z') },
      // u2 joue 1 jour
      { userId: 'u2', createdAt: new Date('2026-07-10T10:00:00Z') },
    ]);

    const r = await service.getReport(new Date('2026-07-20T12:00:00Z'));
    expect(r.daysPlayed).toEqual([
      { days: 1, users: 1 },
      { days: 2, users: 1 },
    ]);
  });
});
