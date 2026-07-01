import {
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseIntPipe,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import { PokemonService } from './pokemon.service';

@Controller('pokemon')
export class PokemonController {
  constructor(private readonly pokemonService: PokemonService) {}

  @Get('names')
  async getNames(): Promise<string[]> {
    return this.pokemonService.getNames();
  }

  @Get(':id/sprite')
  async getSprite(
    @Param('id', ParseIntPipe) id: number,
    @Res() res: Response,
  ): Promise<void> {
    try {
      const { buffer, contentType } = await this.pokemonService.getSprite(id);
      res.setHeader('Content-Type', contentType);
      // Sprite public non masque : cache navigateur autorise.
      res.setHeader('Cache-Control', 'public, max-age=86400');
      res.send(buffer);
    } catch (error) {
      if (error instanceof NotFoundException) {
        res.status(404).send('Sprite introuvable');
      } else {
        res.status(500).send('Erreur lors du chargement du sprite');
      }
    }
  }

  @Get(':id/mega-sprite')
  async getMegaSprite(
    @Param('id', ParseIntPipe) id: number,
    @Res() res: Response,
  ): Promise<void> {
    try {
      const { buffer, contentType } = await this.pokemonService.getMegaSprite(id);
      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'public, max-age=86400');
      res.send(buffer);
    } catch (error) {
      if (error instanceof NotFoundException) {
        res.status(404).send('Méga-sprite introuvable');
      } else {
        res.status(500).send('Erreur lors du chargement du sprite');
      }
    }
  }
}
