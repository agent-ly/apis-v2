export const createRobloxApiErrorResponse = (
  statusCode: number,
  errorCode: number,
  message: string
) => {
  throw new Response(
    JSON.stringify({ errors: [{ code: errorCode, message }] }),
    { status: statusCode }
  );
};
