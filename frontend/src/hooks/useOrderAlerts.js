import { useCallback, useRef, useState } from 'react';

const STORAGE_KEY = 'pedidos:orders-alerts';

const hasNotification = () => typeof window !== 'undefined' && 'Notification' in window;

/**
 * Alertas de pedidos nuevos para el panel admin: sonido + notificacion del
 * navegador.
 *
 * - El sonido se genera con Web Audio (sin assets binarios) y solo puede
 *   arrancar despues de un gesto del usuario, por eso `enable()` DEBE llamarse
 *   desde un onClick (ahi desbloqueamos el AudioContext).
 * - La preferencia on/off se persiste en localStorage, pero el sonido/notif
 *   reales dependen del permiso del navegador y del gesto inicial.
 *
 * Devuelve: { enabled, toggle, notify, supported, permission }.
 */
export function useOrderAlerts() {
  const [enabled, setEnabled] = useState(() => {
    try { return localStorage.getItem(STORAGE_KEY) === 'on'; } catch { return false; }
  });
  const audioCtxRef = useRef(null);

  // Crea (lazy) y resume el AudioContext. Llamarlo dentro de un gesto del
  // usuario es lo que lo deja en estado 'running'.
  const getAudioCtx = useCallback(() => {
    const AC = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
    if (!AC) return null;
    if (!audioCtxRef.current) audioCtxRef.current = new AC();
    if (audioCtxRef.current.state === 'suspended') audioCtxRef.current.resume();
    return audioCtxRef.current;
  }, []);

  // Un "ding" corto de dos tonos ascendentes.
  const playSound = useCallback(() => {
    const ctx = getAudioCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    [880, 1320].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const t = now + i * 0.18;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.3, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.24);
    });
  }, [getAudioCtx]);

  // Activa: desbloquea audio (gesto) + pide permiso de notificaciones y toca
  // un ding de prueba para confirmar. Debe llamarse desde un onClick.
  const enable = useCallback(async () => {
    getAudioCtx(); // desbloquea el audio dentro del gesto del usuario
    if (hasNotification() && Notification.permission === 'default') {
      try { await Notification.requestPermission(); } catch { /* ignore */ }
    }
    setEnabled(true);
    try { localStorage.setItem(STORAGE_KEY, 'on'); } catch { /* ignore */ }
    playSound(); // confirma que el audio quedo activo
  }, [getAudioCtx, playSound]);

  const disable = useCallback(() => {
    setEnabled(false);
    try { localStorage.setItem(STORAGE_KEY, 'off'); } catch { /* ignore */ }
  }, []);

  const toggle = useCallback(() => {
    if (enabled) disable(); else enable();
  }, [enabled, enable, disable]);

  // Dispara sonido + notificacion del SO para los pedidos nuevos recibidos.
  const notify = useCallback((orders) => {
    if (!enabled || !orders?.length) return;
    playSound();
    if (hasNotification() && Notification.permission === 'granted') {
      const title = orders.length === 1
        ? `Nuevo pedido #${orders[0].short_code}`
        : `${orders.length} pedidos nuevos`;
      const body = orders.length === 1
        ? orders[0].customer_name
        : orders.map((o) => `#${o.short_code} ${o.customer_name}`).join(', ');
      try {
        const n = new Notification(title, { body, tag: 'pedido-nuevo', renotify: true });
        n.onclick = () => { window.focus(); n.close(); };
      } catch { /* algunos navegadores requieren ServiceWorker; el sonido ya sono */ }
    }
  }, [enabled, playSound]);

  return {
    enabled,
    toggle,
    notify,
    supported: hasNotification(),
    permission: hasNotification() ? Notification.permission : 'unsupported',
  };
}
