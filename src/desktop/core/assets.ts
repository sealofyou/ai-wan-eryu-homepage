export const DESKTOP_IMAGE_URLS = {
  avatar: "/desktop/main-avatar.webp",
  avatarFallback: "/desktop/main-avatar.png",
  toy: "/desktop/q-avatar.webp",
  toyFallback: "/desktop/q-avatar.png",
} as const;

export const createDesktopImage = (
  src: string,
  fallbackSrc?: string,
): HTMLImageElement => {
  const image = new Image();
  image.decoding = "async";
  if (fallbackSrc) {
    image.addEventListener(
      "error",
      () => {
        image.src = fallbackSrc;
      },
      { once: true },
    );
  }
  image.src = src;
  return image;
};
