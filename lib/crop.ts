/** Pixel crop region from react-easy-crop `croppedAreaPixels`. */
export type CropPixels = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export function parseCropFromForm(
  formData: FormData,
  prefix: string,
): CropPixels | null {
  const x = formData.get(`${prefix}_x`);
  const y = formData.get(`${prefix}_y`);
  const width = formData.get(`${prefix}_width`);
  const height = formData.get(`${prefix}_height`);

  if (x == null || y == null || width == null || height == null) {
    return null;
  }

  const crop: CropPixels = {
    x: Number(x),
    y: Number(y),
    width: Number(width),
    height: Number(height),
  };

  if (
    [crop.x, crop.y, crop.width, crop.height].some(
      (n) => !Number.isFinite(n) || n < 0,
    ) ||
    crop.width < 1 ||
    crop.height < 1
  ) {
    return null;
  }

  return crop;
}

export function clampCropToImage(
  crop: CropPixels,
  imageWidth: number,
  imageHeight: number,
): { left: number; top: number; width: number; height: number } {
  const left = Math.max(0, Math.min(Math.round(crop.x), imageWidth - 1));
  const top = Math.max(0, Math.min(Math.round(crop.y), imageHeight - 1));
  const maxWidth = imageWidth - left;
  const maxHeight = imageHeight - top;
  const width = Math.max(1, Math.min(Math.round(crop.width), maxWidth));
  const height = Math.max(1, Math.min(Math.round(crop.height), maxHeight));

  return { left, top, width, height };
}
