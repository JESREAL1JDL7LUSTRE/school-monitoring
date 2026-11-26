export const employeePhotoBucket = "employee-photos";
export const employeePhotoPath = (employeeId: string, photoId: string) => `${employeeId}/${photoId}`;
export const employeePhotoUrl = (employeeId: string, photoId: string) => `/api/employee-photos/${employeeId}?v=${photoId}`;

export const employeePhotoSignatures = {
  "image/jpeg": [0xff, 0xd8, 0xff],
  "image/png": [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
  "image/webp": [0x52, 0x49, 0x46, 0x46, null, null, null, null, 0x57, 0x45, 0x42, 0x50],
};

export async function validatePhoto(file: FormDataEntryValue | null) {
  if (!(file instanceof File) || !file.size) return "Choose a photo to upload.";
  if (file.size > 4 * 1024 * 1024) return "Choose a photo of 4 MB or less.";
  if (!Object.hasOwn(employeePhotoSignatures, file.type)) return "Choose a JPEG, PNG, or WebP image.";
  const signature = employeePhotoSignatures[file.type as keyof typeof employeePhotoSignatures];
  const header = new Uint8Array(await file.slice(0, signature.length).arrayBuffer());
  return signature.every((byte, index) => byte === null || header[index] === byte) && header.length === signature.length
    ? file : "The file contents do not match the image format.";
}
