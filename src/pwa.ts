type InstallPrompt = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

export type PwaSnapshot = {
  online: boolean;
  supported: boolean;
  ready: boolean;
  installed: boolean;
  installable: boolean;
  updateReady: boolean;
  error: string | null;
};

const inBrowser = typeof window !== 'undefined' && typeof navigator !== 'undefined';
let snapshot: PwaSnapshot = {
  online: !inBrowser || navigator.onLine,
  supported: inBrowser && window.isSecureContext && 'serviceWorker' in navigator,
  ready: false,
  installed: inBrowser && (window.matchMedia('(display-mode: standalone)').matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone)),
  installable: false,
  updateReady: false,
  error: null,
};
const subscribers = new Set<() => void>();
let installPrompt: InstallPrompt | null = null;
let registration: ServiceWorkerRegistration | null = null;
let registrationPromise: Promise<void> | null = null;
let reloadAccepted = false;

function publish(changes: Partial<PwaSnapshot>) {
  snapshot = { ...snapshot, ...changes };
  subscribers.forEach((listener) => listener());
}

export function getPwaSnapshot() { return snapshot; }
export function subscribePwa(listener: () => void) {
  subscribers.add(listener);
  return () => { subscribers.delete(listener); };
}

/** Register once at app startup, before login, so install events cannot be lost. */
export function registerPwa(): Promise<void> {
  if (registrationPromise) return registrationPromise;
  if (!inBrowser) return Promise.resolve();
  window.addEventListener('online', () => publish({ online: true }));
  window.addEventListener('offline', () => publish({ online: false }));
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    installPrompt = event as InstallPrompt;
    publish({ installable: true });
  });
  window.addEventListener('appinstalled', () => {
    installPrompt = null;
    publish({ installed: true, installable: false });
  });

  registrationPromise = (async () => {
    if (!snapshot.supported) return;
    try {
      registration = await navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' });
      const refresh = () => publish({
        ready: Boolean(registration?.active),
        updateReady: Boolean(registration?.waiting && navigator.serviceWorker.controller),
      });
      const watchInstalling = () => {
        registration?.installing?.addEventListener('statechange', refresh);
        refresh();
      };
      registration.addEventListener('updatefound', watchInstalling);
      watchInstalling();
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        refresh();
        // Other tabs can activate a worker. They must not reload this exam page.
        if (reloadAccepted) {
          reloadAccepted = false;
          window.location.reload();
        }
      });
    } catch {
      publish({ error: 'Chưa chuẩn bị được chế độ ngoại tuyến. Bạn vẫn có thể dùng ứng dụng khi có mạng.' });
    }
  })();
  return registrationPromise;
}

export async function installPwa(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
  const prompt = installPrompt;
  if (!prompt) return 'unavailable';
  installPrompt = null;
  publish({ installable: false, error: null });
  try {
    await prompt.prompt();
    return (await prompt.userChoice).outcome;
  } catch {
    publish({ error: 'Chưa mở được cài đặt. Hãy thử mục “Cài đặt ứng dụng” trong menu trình duyệt.' });
    return 'unavailable';
  }
}

/** Call only following the current user's explicit agreement to reload. */
export function activatePwaUpdate(): boolean {
  if (!registration?.waiting) return false;
  reloadAccepted = true;
  registration.waiting.postMessage({ type: 'ACTIVATE_UPDATE' });
  return true;
}
