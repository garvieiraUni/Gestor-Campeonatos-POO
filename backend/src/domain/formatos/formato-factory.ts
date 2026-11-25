import { RegraDeNegocioError } from '../compartilhado/erros';
import { TipoFormato } from '../entidades/regulamento';
import { FaseDeGrupos } from './fase-de-grupos';
import { FormatoTorneio } from './formato-torneio';
import { MataMata } from './mata-mata';
import { PontosCorridos } from './pontos-corridos';

/** Factory: escolhe a Strategy certa a partir do formato salvo no regulamento. */
export class FormatoFactory {
  static criar(tipo: TipoFormato): FormatoTorneio {
    switch (tipo) {
      case 'PONTOS_CORRIDOS':
        return new PontosCorridos();
      case 'MATA_MATA':
        return new MataMata();
      case 'GRUPOS_E_MATA_MATA':
        return new FaseDeGrupos();
      default:
        throw new RegraDeNegocioError(`Formato desconhecido: ${String(tipo)}`);
    }
  }
}
