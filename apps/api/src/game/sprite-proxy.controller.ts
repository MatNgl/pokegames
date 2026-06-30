import { Controller, Get, Param, Res, NotFoundException } from '@nestjs/common';
import { Response } from 'express';
import { SpriteProxyService } from './sprite-proxy.service';

@Controller('sprites')
export class SpriteProxyController {
  constructor(private readonly spriteProxyService: SpriteProxyService) {}

  @Get(':sessionHash')
  async getSprite(
    @Param('sessionHash') sessionHash: string,
    @Res() res: Response,
  ): Promise<void> {
    try {
      const { buffer, contentType } = await this.spriteProxyService.getSpriteBuffer(sessionHash);
      
      // ANTI-TRICHE : Supprimer tout en-tête ou nom de fichier pouvant révéler le Pokémon
      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      
      res.send(buffer);
    } catch (error) {
      if (error instanceof NotFoundException) {
        res.status(404).send('Sprite introuvable ou expiré');
      } else {
        res.status(500).send('Erreur lors du chargement du sprite');
      }
    }
  }
}
