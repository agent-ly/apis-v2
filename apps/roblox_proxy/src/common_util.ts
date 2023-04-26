const payloadMethods = new Set(["POST", "PUT", "DELETE"]);

export const isPayloadMethod = (method: string) => payloadMethods.has(method);

export const removeHeaders = (
  headers: Headers,
  headersToRemove: Set<string>
): Headers => {
  for (const header of headersToRemove) {
    headers.delete(header);
  }
  return headers;
};
