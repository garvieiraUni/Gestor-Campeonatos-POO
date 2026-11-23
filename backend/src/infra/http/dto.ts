import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { TIPOS_CRITERIO, TIPOS_FORMATO, TipoCriterio, TipoEvento, TipoFormato } from '../../domain';

/**
 * DTOs: validam o formato da entrada HTTP (tipos, tamanhos).
 * As regras de negócio continuam no domínio.
 */
export class RegistrarDto {
  @IsString() @MinLength(2) @MaxLength(80) nome!: string;
  @IsEmail({}, { message: 'E-mail inválido' }) email!: string;
  @IsString() @MinLength(6, { message: 'A senha precisa ter pelo menos 6 caracteres' }) senha!: string;
}

export class LoginDto {
  @IsEmail({}, { message: 'E-mail inválido' }) email!: string;
  @IsString() senha!: string;
}

export class RegulamentoDto {
  @IsOptional() @IsIn(TIPOS_FORMATO) formato?: TipoFormato;
  @IsOptional() @IsInt() @Min(1) @Max(50) minJogadores?: number;
  @IsOptional() @IsInt() @Min(1) @Max(50) maxJogadores?: number;
  @IsOptional() @IsInt() @Min(0) @Max(10) pontosVitoria?: number;
  @IsOptional() @IsInt() @Min(0) @Max(10) pontosEmpate?: number;
  @IsOptional() @IsInt() @Min(0) @Max(10) pontosDerrota?: number;
  @IsOptional() @IsArray() @ArrayNotEmpty() @IsIn(TIPOS_CRITERIO, { each: true }) criteriosDesempate?: TipoCriterio[];
  @IsOptional() @IsBoolean() idaEVolta?: boolean;
  @IsOptional() @IsIn([2, 4, 8]) numeroGrupos?: number;
  @IsOptional() @IsInt() @Min(2) @Max(10) amarelosParaSuspensao?: number;
  @IsOptional() @IsInt() @Min(1) @Max(10) jogosSuspensaoVermelho?: number;
}

export class CriarCampeonatoDto {
  @IsString() @MinLength(3) @MaxLength(100) nome!: string;
  @IsOptional() @IsString() @MaxLength(500) descricao?: string;
  @IsOptional() @IsString() @MaxLength(40) modalidade?: string;
  @IsOptional() @ValidateNested() @Type(() => RegulamentoDto) regulamento?: RegulamentoDto;
}

export class InscreverEquipeDto {
  @IsString() @MinLength(2) @MaxLength(60) nome!: string;
}

export class AdicionarJogadorDto {
  @IsString() @MinLength(2) @MaxLength(80) nome!: string;
  @IsInt() @Min(1) @Max(99) numero!: number;
  @IsString() @MinLength(1) @MaxLength(40) documento!: string;
  @IsOptional() @IsString() @MaxLength(30) posicao?: string;
}

export class RegistrarEventoDto {
  @IsIn(['GOL', 'CARTAO_AMARELO', 'CARTAO_VERMELHO']) tipo!: TipoEvento;
  @IsUUID() jogadorId!: string;
  @IsInt() @Min(0) @Max(200) minuto!: number;
}

export class FinalizarPartidaDto {
  @IsOptional() @IsInt() @Min(0) @Max(99) penaltisMandante?: number;
  @IsOptional() @IsInt() @Min(0) @Max(99) penaltisVisitante?: number;
}
