import { characterPortrait, setCharacter } from './characters.js';

export class PlayerFooter {
  constructor(player, own = false) {
    this.element = document.createElement('div'); this.element.className = 'player-footer';
    this.avatar = characterPortrait(player?.characterId);
    this.name = document.createElement('span');
    this.element.append(this.avatar, this.name);
    this.update(player, own);
  }
  update(player, own = false) {
    this.element.hidden = !player;
    if (!player) return;
    setCharacter(this.avatar, player.characterId);
    this.name.textContent = own ? `You · ${player.name}` : player.name;
    this.element.setAttribute('title', this.name.textContent);
  }
}
