export const CHARACTERS = [
  'Star Cat', 'Flower Bunny', 'Axolotl', 'Blue Bear',
  'Busy Bee', 'Raincoat Pig', 'Scarf Otter', 'Beret Sheep',
  'Sailor Corgi', 'Hoodie Panda', 'Chef Hamster', 'Bookish Red Panda',
  'Cozy Penguin', 'Sunny Frog', 'Cloak Fox', 'Bow Seal',
];
export const validCharacter = id => Number.isInteger(id) && id >= 0 && id < CHARACTERS.length;
