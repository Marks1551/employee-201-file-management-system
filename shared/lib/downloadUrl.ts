/** Link that makes the browser save an uploaded file (rather than open it in the tab). */
export function downloadHref(fileUrl: string, fileName?: string | null): string {
  const params = new URLSearchParams({ url: fileUrl });
  if (fileName) params.set("name", fileName);
  return `/api/files/download?${params.toString()}`;
}
