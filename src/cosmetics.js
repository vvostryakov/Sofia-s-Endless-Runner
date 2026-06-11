import { STORAGE_KEYS, saveNumber, loadNumber, saveString, loadString } from './constants.js';

// Outfit palettes map straight onto the primitive-drawn player in GameScene.
export const OUTFITS = [
  { id: 'classic', name: 'Classic',      price: 0,
    palette: { body: 0xe91e8c, stripe: 0xff9bd0, arms: 0xe91e8c, legs: 0x1565c0, hair: 0x5d4037, hairShine: 0x6d4c41, ponytail: 0x4e342e, bow: 0xffd54f, trail: 0x00e5ff } },
  { id: 'mint',    name: 'Mint Dash',    price: 150,
    palette: { body: 0x26a69a, stripe: 0xa7ffeb, arms: 0x26a69a, legs: 0x37474f, hair: 0x5d4037, hairShine: 0x6d4c41, ponytail: 0x4e342e, bow: 0xfff176, trail: 0x69f0ae } },
  { id: 'sunset',  name: 'Sunset Pop',   price: 250,
    palette: { body: 0xff7043, stripe: 0xffd180, arms: 0xff7043, legs: 0x4e342e, hair: 0x3e2723, hairShine: 0x4e342e, ponytail: 0x33211d, bow: 0xff4081, trail: 0xffab40 } },
  { id: 'royal',   name: 'Royal Runner', price: 400,
    palette: { body: 0x5e35b1, stripe: 0xb39ddb, arms: 0x5e35b1, legs: 0x263238, hair: 0x212121, hairShine: 0x37474f, ponytail: 0x121212, bow: 0xffd700, trail: 0xb388ff } },
  { id: 'neon',    name: 'Neon Night',   price: 600,
    palette: { body: 0x00e676, stripe: 0xccff90, arms: 0x00c853, legs: 0x1a237e, hair: 0x4a148c, hairShine: 0x6a1b9a, ponytail: 0x38006b, bow: 0x00e5ff, trail: 0x76ff03 } },
  { id: 'gold',    name: 'Golden Girl',  price: 1000,
    palette: { body: 0xffc107, stripe: 0xfff8e1, arms: 0xffb300, legs: 0x6d4c41, hair: 0x8d6e63, hairShine: 0xa1887f, ponytail: 0x795548, bow: 0xe91e8c, trail: 0xffd700 } },
];

export const getWallet = () => loadNumber(STORAGE_KEYS.totalCoins);
export const addToWallet = (coins) => saveNumber(STORAGE_KEYS.totalCoins, getWallet() + coins);
export const spendFromWallet = (coins) => {
  if (getWallet() < coins) return false;
  saveNumber(STORAGE_KEYS.totalCoins, getWallet() - coins);
  return true;
};

export const ownedOutfits = () => {
  try {
    const parsed = JSON.parse(loadString(STORAGE_KEYS.outfitsOwned) || '["classic"]');
    return Array.isArray(parsed) ? parsed : ['classic'];
  } catch {
    return ['classic'];
  }
};
export const ownOutfit = (id) => {
  const owned = ownedOutfits();
  if (!owned.includes(id)) {
    owned.push(id);
    saveString(STORAGE_KEYS.outfitsOwned, JSON.stringify(owned));
  }
};
export const equippedOutfit = () => {
  const id = loadString(STORAGE_KEYS.outfitEquipped) || 'classic';
  return OUTFITS.find(o => o.id === id) || OUTFITS[0];
};
export const equipOutfit = (id) => saveString(STORAGE_KEYS.outfitEquipped, id);
