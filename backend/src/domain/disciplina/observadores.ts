import type { Campeonato } from '../entidades/campeonato';
import type { Partida } from '../entidades/partida';
import { Suspensao } from './suspensao';

/**
 * Observer: quem quer reagir ao fim de uma partida implementa esta interface
 * e é avisado pelo Campeonato. Novas reações (ex.: notificações) entram sem mexer no Campeonato.
 */
export interface ObservadorDePartida {
  aoFinalizarPartida(partida: Partida, campeonato: Campeonato): void;
}

/** R9 e R10: cumpre suspensões pendentes e gera novas suspensões. */
export class ControleDisciplinar implements ObservadorDePartida {
  aoFinalizarPartida(partida: Partida, campeonato: Campeonato): void {
    const reg = campeonato.regulamento.props;

    // 1) quem estava suspenso cumpriu a suspensão nesta partida da sua equipe
    for (const s of campeonato.suspensoes) {
      if (partida.envolve(s.equipeId) && s.valePara(partida.id)) s.cumprirEm(partida.id);
    }

    // 2) novas suspensões geradas por esta partida
    const jogadores = new Set(partida.eventos.map((e) => e.jogadorId));
    for (const jogadorId of jogadores) {
      const equipeId = partida.eventosDo(jogadorId)[0].equipeId;

      if (partida.foiExpulso(jogadorId)) {
        campeonato.aplicarSuspensao(
          Suspensao.aplicar({
            jogadorId,
            equipeId,
            motivo: 'CARTAO_VERMELHO',
            partidaOrigemId: partida.id,
            jogos: reg.jogosSuspensaoVermelho,
          }),
        );
        continue;
      }

      if (partida.amarelosDo(jogadorId) > 0) {
        const total = campeonato.amarelosAcumuladosDo(jogadorId);
        if (total % reg.amarelosParaSuspensao === 0) {
          campeonato.aplicarSuspensao(
            Suspensao.aplicar({
              jogadorId,
              equipeId,
              motivo: 'ACUMULO_DE_AMARELOS',
              partidaOrigemId: partida.id,
              jogos: 1,
            }),
          );
        }
      }
    }
  }
}

/** R16: quando a fase termina, gera a próxima ou encerra o campeonato com o campeão. */
export class AvancoDeFase implements ObservadorDePartida {
  aoFinalizarPartida(_partida: Partida, campeonato: Campeonato): void {
    const fase = campeonato.faseAtual;
    if (!fase || !fase.completa()) return;

    const formato = campeonato.formato;
    const ctx = campeonato.contextoDoFormato();
    const proxima = formato.gerarProximaFase(fase, ctx);
    if (proxima) campeonato.adicionarFase(proxima);
    else campeonato.encerrar(formato.campeao(fase, ctx));
  }
}
