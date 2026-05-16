export const STICKER_TYPE = "sticker";

export type StickerPack = {
  id: string;
  label: string;
  icon: string;
  stickers: string[];
};

export const STICKER_PACKS: StickerPack[] = [
  {
    id: "smileys",
    label: "Smileys",
    icon: "😀",
    stickers: [
      "😀", "😃", "😄", "😁", "😆", "😅", "🤣", "😂", "🙂", "🙃",
      "😉", "😊", "😇", "🥰", "😍", "🤩", "😘", "😗", "😚", "😙",
      "🥲", "😋", "😛", "😜", "🤪", "😝", "🤑", "🤗", "🤭", "🫢",
    ],
  },
  {
    id: "gestures",
    label: "Gestures",
    icon: "👋",
    stickers: [
      "👋", "🤚", "🖐️", "✋", "🖖", "👌", "🤌", "🤏", "✌️", "🤞",
      "🫰", "🤟", "🤘", "🤙", "👈", "👉", "👆", "👇", "☝️", "👍",
      "👎", "✊", "👊", "🤛", "🤜", "👏", "🙌", "🫶", "👐", "🤲",
    ],
  },
  {
    id: "hearts",
    label: "Hearts",
    icon: "❤️",
    stickers: [
      "❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍", "🤎", "💔",
      "❤️‍🔥", "❤️‍🩹", "💕", "💞", "💓", "💗", "💖", "💘", "💝", "💟",
      "😻", "💑", "💏", "🫶", "😍", "🥰", "😘", "💋", "🌹", "✨",
    ],
  },
  {
    id: "animals",
    label: "Animals",
    icon: "🐶",
    stickers: [
      "🐶", "🐱", "🐭", "🐹", "🐰", "🦊", "🐻", "🐼", "🐨", "🐯",
      "🦁", "🐮", "🐷", "🐸", "🐵", "🐔", "🐧", "🐦", "🐤", "🦆",
      "🦉", "🦋", "🐛", "🐝", "🐞", "🐢", "🐍", "🦎", "🐙", "🦄",
    ],
  },
  {
    id: "food",
    label: "Food",
    icon: "🍕",
    stickers: [
      "🍎", "🍊", "🍋", "🍌", "🍉", "🍇", "🍓", "🫐", "🍒", "🍑",
      "🍕", "🍔", "🍟", "🌭", "🍿", "🧁", "🍩", "🍪", "🎂", "🍰",
      "☕", "🧋", "🍵", "🥤", "🍺", "🍻", "🥂", "🍷", "🍾", "🧃",
    ],
  },
  {
    id: "activities",
    label: "Fun",
    icon: "🎉",
    stickers: [
      "⚽", "🏀", "🏈", "⚾", "🎾", "🏐", "🎱", "🏓", "🥊", "🎯",
      "🎮", "🕹️", "🎲", "🧩", "🎭", "🎨", "🎬", "🎤", "🎧", "🎵",
      "🎉", "🎊", "🎈", "🎁", "🏆", "🥇", "🥈", "🥉", "🔥", "💯",
    ],
  },
];

export function isStickerMessage(message: { attachment_type: string | null }): boolean {
  return message.attachment_type === STICKER_TYPE;
}

export function formatStickerPreview(content: string): string {
  return content.trim() || "Sticker";
}
