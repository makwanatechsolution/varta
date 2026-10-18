export interface AuthSession<User, Profile> {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  error: string | null;
}

/** Coordinate popup/redirect results and auth events without stale account updates. */
export function createAuthSession<User extends { uid: string }, Profile>(options: {
  currentUser: () => { uid: string } | null;
  loadProfile: () => Promise<Profile>;
  publish: (state: AuthSession<User, Profile>) => void;
}) {
  let generation = 0;
  let disposed = false;
  let readyUid: string | null = null;
  let pending: { uid: string; promise: Promise<void> } | null = null;

  function restore(user: User | null, force = false): Promise<void> {
    if (disposed || (user?.uid ?? null) !== (options.currentUser()?.uid ?? null)) return Promise.resolve();
    if (user && readyUid === user.uid && !force) return Promise.resolve();
    if (user && pending?.uid === user.uid) return pending.promise;
    const revision = ++generation;
    pending = null;
    readyUid = null;
    options.publish({ user, profile: null, loading: Boolean(user), error: null });
    if (!user) return Promise.resolve();
    const isCurrent = () => !disposed && generation === revision && options.currentUser()?.uid === user.uid;
    const promise = (async () => {
      try {
        const profile = await options.loadProfile();
        if (isCurrent()) { readyUid = user.uid; options.publish({ user, profile, loading: false, error: null }); }
      } catch (error) {
        if (isCurrent()) options.publish({ user, profile: null, loading: false, error: error instanceof Error ? error.message : 'Could not load your Varta account.' });
      } finally {
        if (generation === revision) pending = null;
      }
    })();
    pending = { uid: user.uid, promise };
    return promise;
  }

  return { restore, dispose() { disposed = true; ++generation; pending = null; } };
}
