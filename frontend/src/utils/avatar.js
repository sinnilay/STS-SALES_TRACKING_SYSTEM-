export const initials = (name) => {
  if (!name) return '?';
  const parts = name.trim().split(' ');
  return parts.length > 1 ? (parts[0][0] + parts[1][0]).toUpperCase() : parts[0].slice(0, 2).toUpperCase();
};

const AVATAR_GRADIENTS = [
  'from-indigo-500 to-purple-600',
  'from-emerald-400 to-emerald-600',
  'from-orange-400 to-rose-500',
  'from-blue-500 to-cyan-500',
  'from-fuchsia-500 to-pink-600',
];

export const avatarGradient = (id) => AVATAR_GRADIENTS[Math.abs(id || 0) % AVATAR_GRADIENTS.length];
