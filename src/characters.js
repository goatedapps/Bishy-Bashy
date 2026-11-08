import { CHARACTERS, validCharacter } from '../shared/characters.js';
export function setCharacter(element, id) {
  const selected = validCharacter(id) ? id : 0;
  element.dataset.character = String(selected);
  element.setAttribute('aria-label', CHARACTERS[selected]);
}
export function characterPortrait(id) {
  const element = document.createElement('span');
  element.className = 'character-portrait'; element.setAttribute('role', 'img');
  setCharacter(element, id); return element;
}
export class CharacterPicker {
  constructor(onChoose) {
    this.element = document.createElement('section'); this.element.id = 'character-picker'; this.element.hidden = true;
    this.element.setAttribute('aria-label', 'Choose your character');
    const title = document.createElement('h2'); title.textContent = 'Who will you be?';
    const grid = document.createElement('div'); grid.className = 'character-grid';
    this.cards = CHARACTERS.map((name, id) => {
      const button = document.createElement('button'); button.type = 'button'; button.className = 'character-card';
      const label = document.createElement('strong'); label.textContent = name;
      button.setAttribute('aria-label', `Choose ${name}`); button.append(characterPortrait(id), label);
      button.addEventListener('click', () => onChoose(id)); grid.append(button);
      return { button, label, name };
    });
    this.element.append(title, grid); document.getElementById('room-view').append(this.element);
  }
  render(room, playerId) {
    const choosing = Boolean(room && room.players.some(player => player.id === playerId && !validCharacter(player.characterId)));
    this.element.hidden = !choosing; document.body.classList.toggle('is-choosing-character', choosing);
    if (choosing) {
      const taken = new Set(room.players.filter(player => player.id !== playerId).map(player => player.characterId));
      this.cards.forEach(({ button, label, name }, id) => {
        button.disabled = taken.has(id);
        label.textContent = button.disabled ? `${name} · Taken` : name;
        button.setAttribute('aria-label', button.disabled ? `${name}, taken` : `Choose ${name}`);
      });
      document.querySelector('.game-title').textContent = 'Choose your character';
      document.title = 'Choose your character · Dokidoki Dash!';
    }
    return choosing;
  }
}
