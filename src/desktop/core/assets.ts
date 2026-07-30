export const DESKTOP_IMAGE_URLS = {
  avatar: "/desktop/main-avatar.png",
  toy: "/desktop/q-avatar.png",
} as const;

export const createDesktopImage = (src: string): HTMLImageElement => {
  const image = new Image();
  image.src = src;
  return image;
};
