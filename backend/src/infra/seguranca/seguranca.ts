import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { GeradorDeHash, GeradorDeToken } from '../../application/portas/portas';

export class HashBcrypt implements GeradorDeHash {
  constructor(private readonly custo = 10) {}

  gerar(texto: string): Promise<string> {
    return bcrypt.hash(texto, this.custo);
  }

  comparar(texto: string, hash: string): Promise<boolean> {
    return bcrypt.compare(texto, hash);
  }
}

export interface UsuarioDoToken {
  id: string;
  nome: string;
  email: string;
}

export class TokenJwt implements GeradorDeToken {
  constructor(private readonly jwt: JwtService) {}

  gerar(dados: UsuarioDoToken): string {
    return this.jwt.sign({ sub: dados.id, nome: dados.nome, email: dados.email });
  }

  verificar(token: string): UsuarioDoToken {
    const p = this.jwt.verify<{ sub: string; nome: string; email: string }>(token);
    return { id: p.sub, nome: p.nome, email: p.email };
  }
}
