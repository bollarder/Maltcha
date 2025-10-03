export const isMobile = (): boolean => {
  if (typeof navigator === 'undefined') return false;
  
  return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
};
