
// This endpoint is deprecated. The application now uses direct client-side SDK calls.
export default async function handler(req: any, res: any) {
  return res.status(410).json({ error: 'Endpoint migrated to client-side. Please refresh your browser.' });
}
