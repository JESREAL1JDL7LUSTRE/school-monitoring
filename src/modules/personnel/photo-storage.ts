export const employeePhotoBucket = "employee-photos";
export const employeePhotoPath = (employeeId: string, photoId: string) => `${employeeId}/${photoId}`;
export const employeePhotoUrl = (employeeId: string, photoId: string) => `/api/employee-photos/${employeeId}?v=${photoId}`;

export const employeePhotoSignatures = {
  "image/jpeg": [0xff, 0xd8, 0xff],
  "image/png": [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
  "image/webp": [0x52, 0x49, 0x46, 0x46, null, null, null, null, 0x57, 0x45, 0x42, 0x50],
};
