import { AcessoNegadoError, NaoEncontradoError } from '../compartilhado/erros';
import type { Campeonato } from '../entidades/campeonato';
import { Ator } from './ator';
import {
  Acao,
  AdministradorGlobal,
  Bloqueado,
  Criador,
  Espectador,
  OrganizadorConvidado,
  PapelNoCampeonato,
  Visitante,
} from './papel-no-campeonato';

const NEGADO: Record<Acao, string> = {
  [Acao.VER]: 'Você não tem acesso a este campeonato',
  [Acao.INSCREVER_PROPRIO_TIME]: 'Entre com a sua conta para inscrever um time',
  [Acao.GERENCIAR_EQUIPES]: 'Só os organizadores podem gerenciar as equipes',
  [Acao.PREENCHER_SUMULA]: 'Só os organizadores podem preencher a súmula',
  [Acao.INICIAR]: 'Só os organizadores podem iniciar o campeonato',
  [Acao.EDITAR_REGULAMENTO]: 'Só os organizadores podem alterar o regulamento',
  [Acao.BANIR]: 'Só os organizadores podem banir contas',
  [Acao.CONFIGURAR]: 'Só o criador pode alterar as configurações do campeonato',
  [Acao.GERENCIAR_ORGANIZADORES]: 'Só o criador pode gerenciar os organizadores',
  [Acao.EXCLUIR]: 'Só o criador pode excluir o campeonato',
};

/**
 * Serviço de domínio: descobre o papel de alguém em um campeonato e confere permissões.
 * É o ÚNICO lugar que responde "quem pode o quê"; as entidades cuidam só das regras do jogo.
 */
export class PoliticaDeAcesso {
  papelDe(ator: Ator, c: Campeonato, chaveInformada?: string | null): PapelNoCampeonato {
    if (ator.temAcessoGlobal) return new AdministradorGlobal();
    const id = ator.usuarioId;
    if (id && c.ehCriador(id)) return new Criador();
    if (id && c.ehOrganizadorConvidado(id)) return new OrganizadorConvidado();
    if (id && c.estaBanidoDeVer(id)) return new Bloqueado();
    const podeVer = c.visibilidade.permiteVer({
      participa: id ? c.participa(id) : false,
      chave: c.chaveDeAcesso,
      chaveInformada,
    });
    if (!podeVer) return new Bloqueado();
    return id ? new Espectador() : new Visitante();
  }

  /**
   * Lança erro se o ator não puder fazer a ação. Quem não pode nem VER recebe 404,
   * para que um campeonato privado não revele que existe.
   */
  exigir(ator: Ator, c: Campeonato, acao: Acao, chaveInformada?: string | null): PapelNoCampeonato {
    const papel = this.papelDe(ator, c, chaveInformada);
    if (!papel.pode(Acao.VER)) throw new NaoEncontradoError('Campeonato não encontrado');
    if (!papel.pode(acao)) throw new AcessoNegadoError(NEGADO[acao]);
    return papel;
  }

  /** Na lista do site: os públicos, mais os privados de que a pessoa participa (o ADM vê todos). */
  apareceNaListagem(ator: Ator, c: Campeonato): boolean {
    const papel = this.papelDe(ator, c);
    if (!papel.pode(Acao.VER)) return false;
    if (c.visibilidade.apareceNaListaPublica()) return true;
    return ator.temAcessoGlobal || (ator.usuarioId !== null && c.participa(ator.usuarioId));
  }
}
