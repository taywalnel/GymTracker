import {
  Query,
  QuerySnapshot,
  getDocs,
  getDocsFromCache,
} from "@angular/fire/firestore";

/** How long to wait for the server before showing what's cached on the device. */
const SERVER_WAIT_MS = 1500;

/**
 * Reads a query from the server, but falls back to the offline cache when the
 * server is slow to answer (a gym with one bar of signal). getDocs on its own
 * can wait many seconds for the server before using the cache.
 *
 * When the cached copy is returned, `onLateServerResult` receives the server
 * result once it arrives, so later screens see fresh data. With nothing
 * cached (e.g. first launch) it waits for the server.
 */
export async function getDocsPreferringServer<T>(
  q: Query<T>,
  onLateServerResult: (snapshot: QuerySnapshot<T>) => void,
): Promise<QuerySnapshot<T>> {
  const server = getDocs(q);
  const timeout = new Promise<null>((resolve) =>
    setTimeout(() => resolve(null), SERVER_WAIT_MS),
  );
  const first = await Promise.race([server, timeout]);
  if (first) return first;

  const cached = await getDocsFromCache(q).catch(() => null);
  if (!cached || cached.empty) return server;
  server.then(onLateServerResult, () => undefined);
  return cached;
}
