import { COLORS, createSequence } from '../shared/totem.js';
import { PERM_GAME } from '../shared/perm.js';
import { SLOT_GAME, slotLayout } from '../shared/slots.js';
import { FIREWORK_GAME } from '../shared/fireworks.js';
import { FireworkStage, fireworkBadge } from './firework-view.js';
import { MONKEY_GAME } from '../shared/monkeys.js';
import { MonkeyStage, monkeyPortrait } from './monkey-view.js';
import { JUMP_GAME } from '../shared/jump.js';
import { JumpStage, dinoPortrait } from './jump-view.js';
import { SlotStage, facePortrait, renderTarget } from './slot-view.js';
import { GAMES, comparePlayers, isRoundActive } from '../shared/games.js';
import { GameFeedback } from './feedback.js';

const SHAPES = ['●', '▲', '◆'];
const $ = id => document.getElementById(id);
const node = (tag, className, text) => {
  const element = document.createElement(tag);
  element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
};
const resultLabel = (result, perm = false) => result?.status === 'finished' ? perm ? `${result.cleared} growth · ${result.score.toLocaleString()} pts` : `${(result.elapsed / 1000).toFixed(3)} s` : ({ forfeit: 'Forfeited', timeout: 'Time expired', missing: 'No result' }[result?.status] || 'Waiting…');

function block(color, surprised = false) {
  const element = node('div', `block ${COLORS[color]}${surprised ? ' surprised' : ''}`);
  element.dataset.color = color;
  element.setAttribute('role', 'img');
  element.setAttribute('aria-label', `${COLORS[color]} block`);
  element.append(node('span', 'glyph', SHAPES[color]));
  return element;
}

function dancer(index, growth = 0) {
  const element = node('div', 'perm-character');
  element.style.setProperty('--hair-size', `${45 + growth * 11}%`);
  element.append(node('div', 'perm-hair'), node('div', `perm-dancer dancer-${index % 4}`));
  element.setAttribute('role', 'img');
  element.setAttribute('aria-label', `Disco dancer, hair growth ${growth} of 8`);
  return element;
}

export class GameView {
  constructor() {
    this.feedback = new GameFeedback();
    this.lanes = Array.from({ length: 4 }, (_, index) => {
      const lane = node('article', 'lane');
      const name = node('h3', '');
      const zone = node('div', 'tower-zone');
      const tower = node('div', 'tower');
      const avatar = dancer(index);
      avatar.hidden = true;
      const slots = new SlotStage();
      const fireworks = new FireworkStage();
      const monkeys = new MonkeyStage();
      const jump = new JumpStage();
      zone.append(tower, avatar, slots.cabinet, fireworks.element, monkeys.element, jump.element);
      const effects = node('div', 'game-feedback');
      effects.setAttribute('aria-hidden', 'true');
      const ring = node('span', 'feedback-ring');
      const particles = Array.from({ length: 12 }, () => node('i', 'feedback-particle'));
      effects.append(ring, ...particles);
      zone.append(effects);
      const remaining = node('div', 'remaining');
      const progress = node('div', 'progress');
      const fill = node('span', '');
      progress.append(fill);
      const status = node('p', 'seat-status');
      lane.append(name, zone, node('div', 'base'), remaining, progress, status);
      $('player-lanes').append(lane);
      return { lane, name, tower, avatar, slots, fireworks, monkeys, jump, remaining, fill, status, effects, ring, particles, towerKey: '' };
    });
    this.pips = Array.from({ length: 8 }, (_, index) => {
      const pip = node('span', 'beat-dot');
      pip.dataset.step = index;
      $('rhythm-track').append(pip);
      return pip;
    });
    this.resultKey = '';
  }

  render(room, playerId, local, time) {
    const round = room.round;
    const active = isRoundActive(round);
    const game = active ? round.game : room.selectedGame;
    const perm = game === PERM_GAME;
    const slots = game === SLOT_GAME;
    const fireworks = game === FIREWORK_GAME;
    const monkeys = game === MONKEY_GAME;
    const jump = game === JUMP_GAME;
    const sequence = game === 'totem-shrinker' && round ? createSequence(round.seed, round.blockCount) : [];
    if (slots && active) renderTarget(round);
    $('arena').classList.toggle('lobby', !active);
    this.lanes.forEach((elements, index) => {
      const player = room.players[index];
      const own = player?.id === playerId;
      const ownRun = active && own && local?.id === round?.id ? local : null;
      const cleared = ownRun ? ownRun.run.cleared : player?.progress?.cleared || 0;
      const status = player?.result || (ownRun?.done ? { status: ownRun.status, elapsed: ownRun.run.elapsed, cleared, score: ownRun.run.score || 0 } : null);
      const frozen = ownRun && !ownRun.done && time < ownRun.run.blockedUntil;
      elements.lane.className = `lane${own ? ' you' : ''}${!player ? ' empty' : ''}${frozen ? ' frozen' : ''}${active && status?.status === 'finished' ? ' finished' : ''}${active && status && status.status !== 'finished' ? ' forfeit' : ''}`;
      elements.name.textContent = player ? `${player.name}${own ? ' · You' : ''}` : 'Open spot';
      elements.tower.hidden = perm || slots || fireworks || monkeys || jump;
      elements.avatar.hidden = !perm;
      elements.slots.cabinet.hidden = !slots;
      elements.fireworks.element.hidden = !fireworks;
      elements.monkeys.element.hidden = !monkeys;
      elements.jump.element.hidden = !jump;
      if (jump) {
        elements.jump.render(round || {}, ownRun?.run, time, 0, active, Boolean(player), cleared, Boolean(status));
      } else if (monkeys) {
        elements.monkeys.render(round || {}, ownRun?.run, time, active, Boolean(player), cleared, Boolean(status));
      } else if (fireworks) {
        elements.fireworks.render(round || {}, ownRun?.run, time, active, Boolean(player), cleared, Boolean(status));
      } else if (slots) {
        if (!active || ownRun) elements.slots.render(round || { seed: 0 }, ownRun?.run.reelMask ?? player?.progress?.reelMask ?? 0, ownRun ? time - ownRun.start : 0, ownRun?.run, active, Boolean(player));
      }
      else if (perm) {
        const growth = active && player ? cleared : 0;
        elements.avatar.style.setProperty('--hair-size', `${45 + growth * 11}%`);
        elements.avatar.setAttribute('aria-label', `Disco dancer, hair growth ${growth} of 8`);
      } else {
        const colors = !player || !active ? [index % 3] : sequence.slice(cleared, cleared + 5).reverse();
        const key = `${colors.join(',')}/${Boolean(frozen)}`;
        if (key !== elements.towerKey) {
          elements.tower.replaceChildren(...colors.map(color => block(color, Boolean(frozen))));
          elements.towerKey = key;
        }
      }
      const value = perm || slots || fireworks || monkeys || jump ? cleared : active && player ? Math.max(0, round.blockCount - cleared) : 0;
      const counterKey = `${game}/${value}/${round?.goal}`;
      if (elements.remaining.dataset.value !== counterKey) {
        elements.remaining.replaceChildren(node('strong', '', String(value)), document.createTextNode(jump ? ` / ${round?.goal || 6}` : monkeys ? ` / ${round?.goal || 5}` : fireworks ? ` / ${round?.goal || 12}` : slots ? ' / 3' : perm ? ' / 8' : 'left'));
        elements.remaining.dataset.value = counterKey;
      }
      elements.fill.style.width = `${active && player ? cleared / round.goal * 100 : 0}%`;
      const score = ownRun?.run.score ?? player?.progress?.score ?? 0;
      elements.status.textContent = !player ? 'Waiting to join' : !player.connected ? 'Reconnecting…' : active ? status ? resultLabel(status, perm) : frozen ? 'Oops!' : perm ? `${score.toLocaleString()} pts` : '' : player.ready ? '✓ Ready' : player.sync?.count >= 3 ? (player.id === room.hostId ? 'Host' : 'Not ready') : 'Syncing…';
    });
    this.updateFeedback(room, local, time);
    const hasResults = round?.phase === 'results';
    $('play-view').hidden = hasResults;
    $('results').hidden = !hasResults;
    if (hasResults) this.results(room, playerId);
  }

  updateFeedback(room, local, time) {
    const lane = room && this.lanes.find(elements => elements.lane.classList.contains('you'));
    this.feedback.update(room?.round, local, lane, time);
  }

  animate(room, local, time, elapsed) {
    if (room.round?.game === JUMP_GAME && isRoundActive(room.round)) {
      this.lanes.forEach((elements, index) => {
        const player = room.players[index];
        const own = elements.lane.classList.contains('you') ? local : null;
        elements.jump.render(room.round, own?.run, time, elapsed, true, Boolean(player), own?.run.cleared ?? player?.progress?.cleared ?? 0, Boolean(own?.done || player?.result));
      });
      return;
    }
    if (room.round?.game === MONKEY_GAME && isRoundActive(room.round)) {
      this.lanes.forEach((elements, index) => {
        const player = room.players[index];
        const own = elements.lane.classList.contains('you') ? local : null;
        elements.monkeys.render(room.round, own?.run, time, true, Boolean(player), own?.run.cleared ?? player?.progress?.cleared ?? 0, Boolean(own?.done || player?.result));
      });
      return;
    }
    if (room.round?.game === FIREWORK_GAME && isRoundActive(room.round)) {
      this.lanes.forEach((elements, index) => {
        const player = room.players[index];
        const own = player?.id && elements.lane.classList.contains('you') ? local : null;
        elements.fireworks.render(room.round, own?.run, time, true, Boolean(player), own?.run.cleared ?? player?.progress?.cleared ?? 0, Boolean(own?.done || player?.result));
      });
      return;
    }
    if (room.round?.game === SLOT_GAME && isRoundActive(room.round)) {
      this.lanes.forEach((elements, index) => {
        const own = elements.lane.classList.contains('you') ? local : null;
        const player = room.players[index];
        elements.slots.render(room.round, own?.run.reelMask ?? player?.progress?.reelMask ?? 0, Math.max(0, own ? time - own.start : elapsed), own?.run, true, Boolean(player));
      });
      return;
    }
    if (room.round?.game !== PERM_GAME || room.round.phase === 'results' || !local || time < local.start || local.done) return;
    const phase = local.run.phase(time);
    const heading = phase.mode === 'watch' ? 'Watch' : 'Your turn!';
    if ($('rhythm-phase').textContent !== heading) $('rhythm-phase').textContent = heading;
    $('rhythm-guide').classList.toggle('your-turn', phase.mode === 'play');
    $('rhythm-phrase').textContent = `Phrase ${phase.phrase + 1} / 8`;
    $('rhythm-track').setAttribute('aria-label', `${heading}. Rhythm positions ${phase.steps.map(step => step + 1).join(', ')}`);
    this.pips.forEach((pip, step) => {
      const note = local.run.notes.find(note => note.phrase === phase.phrase && note.step === step);
      pip.className = `beat-dot${phase.steps.includes(step) ? ' is-note' : ''}${phase.position === step ? ' is-current' : ''}${phase.mode === 'play' && note?.hit ? ' is-hit' : ''}${phase.mode === 'play' && note?.missed ? ' is-miss' : ''}`;
      pip.dataset.note = String(phase.steps.includes(step));
      pip.textContent = phase.steps.includes(step) ? '●' : '·';
    });
    const pulse = Math.max(0, 1 - ((time - local.start) % local.run.beatMs) / local.run.beatMs * 4);
    $('arena').style.setProperty('--disco-pulse', pulse.toFixed(3));
    const own = this.lanes.find(lane => lane.lane.classList.contains('you'));
    if (own && local.run.feedback && time - local.run.feedback.at < 600) own.status.textContent = local.run.feedback.kind;
  }

  results(room, playerId) {
    const key = JSON.stringify([room.round.id, room.players.map(player => [player.id, player.result])]);
    if (this.resultKey === key) return;
    this.resultKey = key;
    const game = room.round.game;
    const perm = game === PERM_GAME;
    $('results').classList.toggle('perm-results', perm);
    const sorted = room.players.filter(player => room.round.playerIds.includes(player.id)).sort((a, b) => comparePlayers(a, b, game));
    const finishers = sorted.filter(player => player.result?.status === 'finished' && (!perm || player.result.score > 0));
    const rank = player => finishers.findIndex(other => comparePlayers(other, player, game) === 0) + 1;
    const winners = finishers.filter(player => comparePlayers(player, finishers[0], game) === 0);
    $('result-round').textContent = `${GAMES[game]?.title || 'Round'} · Round ${room.round.setRound || room.testNumber}`;
    $('result-title').textContent = winners.length > 1 ? 'This round is a tie!' : winners.length ? `${winners[0].name} wins this round!` : 'Time’s up!';
    $('podium').replaceChildren(...finishers.slice(0, 3).map((player, index) => {
      const seat = node('div', 'podium-seat');
      const step = node('div', 'podium-step');
      step.append(node('strong', '', String(rank(player))), document.createTextNode(perm ? `${player.result.cleared} / 8` : resultLabel(player.result)));
      seat.append(game === JUMP_GAME ? dinoPortrait() : game === MONKEY_GAME ? monkeyPortrait() : game === FIREWORK_GAME ? fireworkBadge() : game === SLOT_GAME ? facePortrait(slotLayout(room.round.seed).target) : perm ? dancer(room.players.indexOf(player), player.result.cleared) : block(index % 3), node('div', 'podium-name', player.name), step);
      return seat;
    }));
    $('result-rows').replaceChildren(...sorted.map(player => {
      const result = player.result;
      const row = node('div', `result-row${player.id === playerId ? ' you' : ''}`);
      const timing = node('div', 'result-time', resultLabel(result, perm));
      if (result?.status === 'finished') timing.append(node('small', '', `${result.mistakes || 0} mistakes`));
      row.append(node('span', 'rank', result?.status === 'finished' ? String(rank(player)) : '—'), node('span', 'result-name', player.name + (player.id === playerId ? ' · You' : '')), timing);
      return row;
    }));
  }
}
