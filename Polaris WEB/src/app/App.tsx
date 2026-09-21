import { type FormEvent, type KeyboardEvent, useEffect, useMemo, useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';

import { appConfig, isApiConfigured, isSupabaseConfigured } from '../services/config';
import {
  getCurrentSession,
  listenForAuthChanges,
  register,
  requestPasswordRecovery,
  signIn,
  signOut,
  updatePassword,
} from '../services/auth';
import { getOrCreateWebClientId } from '../services/device';
import {
  polarisApi,
  type Conversation,
  type Device,
  type Memory,
  type MemoryCategory,
  type Message,
  type Preferences,
  type Profile,
  type RelayCommand,
} from '../services/polaris';
import { PolarisApiError, type SseEvent } from '../services/api';
import { getSupabaseClient } from '../services/supabase';
import { PolarisOrbit } from './PolarisOrbit';

type View = 'home' | 'chat' | 'history' | 'memories' | 'profile' | 'settings' | 'devices' | 'capabilities';
type AuthView = 'sign-in' | 'sign-up' | 'recover' | 'update-password';

const memoryCategories: MemoryCategory[] = ['PERSONAL', 'PREFERENCE', 'PROJECT', 'CONTEXT', 'FACT', 'GOAL'];

function dateTime(value: string | null | undefined): string {
  if (!value) return 'Sin actividad';
  return new Intl.DateTimeFormat('es-PE', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

function memoryCategoryName(category: MemoryCategory): string {
  const names: Record<MemoryCategory, string> = {
    PERSONAL: 'Personal',
    PREFERENCE: 'Preferencia',
    PROJECT: 'Proyecto',
    CONTEXT: 'Contexto',
    FACT: 'Hecho',
    GOAL: 'Meta',
  };
  return names[category];
}

function errorText(error: unknown): string {
  if (error instanceof PolarisApiError) return error.message;
  if (error instanceof Error) return error.message;
  return 'Polaris no pudo completar la operación.';
}

function brand() {
  return (
    <span className="polaris-brand" aria-label="Polaris">
      <svg viewBox="0 0 64 64" aria-hidden="true">
        <path d="M32 5l4.4 19.3L59 32l-22.6 7.7L32 59l-4.4-19.3L5 32l22.6-7.7L32 5z" />
        <circle cx="32" cy="32" r="5.8" />
      </svg>
      <strong>POLARIS</strong>
    </span>
  );
}

export function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [isBooting, setIsBooting] = useState(true);
  const [view, setView] = useState<View>('home');
  const [recoveryMode, setRecoveryMode] = useState(window.location.hash === '#recovery');

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setIsBooting(false);
      return;
    }

    let alive = true;
    void getCurrentSession()
      .then((current) => {
        if (alive) setSession(current);
      })
      .catch(() => {
        if (alive) setSession(null);
      })
      .finally(() => {
        if (alive) setIsBooting(false);
      });

    return listenForAuthChanges(({ event, session: next }) => {
      if (!alive) return;
      setSession(next);
      if (event === 'PASSWORD_RECOVERY') {
        setRecoveryMode(true);
        window.location.hash = 'recovery';
      }
    });
  }, []);

  useEffect(() => {
    const onShortcut = (event: globalThis.KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey)) return;
      const key = event.key.toLowerCase();
      if (key === 'k') {
        event.preventDefault();
        setView('chat');
      } else if (key >= '1' && key <= '8') {
        event.preventDefault();
        const views: View[] = ['home', 'chat', 'history', 'memories', 'devices', 'capabilities', 'profile', 'settings'];
        setView(views[Number(key) - 1]);
      }
    };
    window.addEventListener('keydown', onShortcut);
    return () => window.removeEventListener('keydown', onShortcut);
  }, []);

  if (isBooting) {
    return <div className="boot"><span className="orbital-star">✦</span><p>Iniciando Polaris…</p></div>;
  }

  if (!isSupabaseConfigured) {
    return <ConfigurationScreen />;
  }

  if (!session) {
    return <Landing onAuthenticated={setSession} initialRecovery={recoveryMode} />;
  }

  return <Workspace session={session} view={view} setView={setView} onSignOut={() => void signOut()} />;
}

function ConfigurationScreen() {
  return (
    <main className="configuration-screen">
      {brand()}
      <h1>Configura la identidad de Polaris</h1>
      <p>Faltan los valores públicos de Supabase en el entorno de esta web. No se habilitan accesos ni respuestas ficticias.</p>
      <code>VITE_SUPABASE_URL y VITE_SUPABASE_PUBLISHABLE_KEY</code>
      <small>La URL API actual es: {appConfig.apiBaseUrl || 'sin configurar'}.</small>
    </main>
  );
}

function Landing({
  onAuthenticated,
  initialRecovery,
}: {
  onAuthenticated(session: Session | null): void;
  initialRecovery: boolean;
}) {
  const [authView, setAuthView] = useState<AuthView>(initialRecovery ? 'update-password' : 'sign-in');
  const [notice, setNotice] = useState<string | null>(null);

  return (
    <main className="landing">
      <nav className="landing-nav">
        {brand()}
        <div>
          <button type="button" onClick={() => setAuthView('sign-in')}>Entrar</button>
          <button type="button" className="nav-cta" onClick={() => setAuthView('sign-up')}>Crear cuenta</button>
        </div>
      </nav>
      <section className="landing-hero">
        <div className="hero-copy">
          <span className="eyebrow">UN ASISTENTE · TODAS TUS PLATAFORMAS</span>
          <h1>Tu norte para pensar, recordar y avanzar.</h1>
          <p>Polaris reúne tu identidad, conversaciones y memorias en una misma experiencia segura para web, Android y PC.</p>
          <div className="hero-buttons">
            <button type="button" className="primary-button" onClick={() => setAuthView('sign-up')}>Comenzar ahora <span>→</span></button>
            <a href="#features">Descubrir Polaris</a>
          </div>
        </div>
        <div className="hero-orbit" aria-hidden="true">
          <span className="orbit one" /><span className="orbit two" /><span className="orbit three" />
          <div className="hero-star">✦</div>
          <span className="orbit-label">CLARIDAD</span><span className="orbit-label second">MEMORIA</span>
        </div>
      </section>
      <section id="features" className="feature-band">
        <article><span>01</span><h2>Una identidad</h2><p>Entra con la misma cuenta en cada plataforma.</p></article>
        <article><span>02</span><h2>Memoria visible</h2><p>Revisa, busca, edita y elimina lo que Polaris conserva.</p></article>
        <article><span>03</span><h2>Honestidad real</h2><p>Cuando falta una conexión o un proveedor, Polaris lo dice.</p></article>
      </section>
      <AuthDialog
        view={authView}
        onChange={setAuthView}
        onAuthenticated={onAuthenticated}
        onNotice={setNotice}
      />
      {notice && <div className="toast success" role="status">{notice}<button onClick={() => setNotice(null)}>×</button></div>}
    </main>
  );
}

function AuthDialog({
  view,
  onChange,
  onAuthenticated,
  onNotice,
}: {
  view: AuthView;
  onChange(view: AuthView): void;
  onAuthenticated(session: Session | null): void;
  onNotice(text: string): void;
}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const title: Record<AuthView, string> = {
    'sign-in': 'Bienvenido de vuelta.',
    'sign-up': 'Crea tu Polaris.',
    recover: 'Recupera tu acceso.',
    'update-password': 'Elige una contraseña nueva.',
  };

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      if (view === 'sign-in') {
        onAuthenticated(await signIn(email, password));
      } else if (view === 'sign-up') {
        const result = await register({ email, password, displayName });
        onAuthenticated(result.session);
        onNotice(result.emailConfirmationRequired ? 'Revisa tu correo para confirmar la cuenta.' : 'Cuenta creada correctamente.');
      } else if (view === 'recover') {
        await requestPasswordRecovery(email);
        onNotice('Si existe una cuenta para ese correo, recibirás las instrucciones de recuperación.');
        onChange('sign-in');
      } else {
        await updatePassword(newPassword);
        window.location.hash = '';
        onNotice('Contraseña actualizada. Ya puedes entrar.');
        onChange('sign-in');
      }
    } catch (cause) {
      setError(errorText(cause));
    } finally {
      setSubmitting(false);
    }
  }

  const passwordInput = view === 'update-password'
    ? <label>Contraseña nueva<input type="password" minLength={8} autoComplete="new-password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} required /></label>
    : <label>Contraseña<input type="password" minLength={8} autoComplete={view === 'sign-in' ? 'current-password' : 'new-password'} value={password} onChange={(event) => setPassword(event.target.value)} required /></label>;

  return (
    <section className="auth-dialog" aria-label="Acceso a Polaris">
      <div className="auth-tabs">
        <button type="button" className={view === 'sign-in' ? 'active' : ''} onClick={() => onChange('sign-in')}>Entrar</button>
        <button type="button" className={view === 'sign-up' ? 'active' : ''} onClick={() => onChange('sign-up')}>Registrarme</button>
      </div>
      <span className="eyebrow">ACCESO SEGURO</span>
      <h2>{title[view]}</h2>
      <form onSubmit={(event) => void submit(event)}>
        {view === 'sign-up' && <label>Nombre<input autoComplete="name" value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="Cómo te llama Polaris" required /></label>}
        {view !== 'update-password' && <label>Correo<input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>}
        {view !== 'recover' && passwordInput}
        {error && <p className="form-error">{error}</p>}
        <button className="primary-button full" type="submit" disabled={submitting}>
          {submitting ? 'Procesando…' : view === 'sign-in' ? 'Entrar a Polaris' : view === 'sign-up' ? 'Crear cuenta' : view === 'recover' ? 'Enviar recuperación' : 'Actualizar contraseña'}
        </button>
      </form>
      {view !== 'update-password' && (
        <button type="button" className="link-button" onClick={() => onChange(view === 'recover' ? 'sign-in' : 'recover')}>
          {view === 'recover' ? 'Volver a entrar' : 'Olvidé mi contraseña'}
        </button>
      )}
    </section>
  );
}

function Workspace({
  session,
  view,
  setView,
  onSignOut,
}: {
  session: Session;
  view: View;
  setView(view: View): void;
  onSignOut(): void;
}) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [memories, setMemories] = useState<Memory[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [preferences, setPreferences] = useState<Preferences | null>(null);
  const [webDeviceId, setWebDeviceId] = useState<string | null>(null);
  const relayBusy = useRef(false);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [problem, setProblem] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const selected = useMemo(
    () => conversations.find((conversation) => conversation.id === selectedConversationId) ?? null,
    [conversations, selectedConversationId],
  );

  const refresh = async () => {
    setLoading(true);
    setProblem(null);
    try {
      const [nextConversations, nextMemories, nextDevices, nextProfile, nextPreferences] = await Promise.all([
        polarisApi.listConversations(session),
        polarisApi.listMemories(session),
        polarisApi.listDevices(session),
        polarisApi.getProfile(session),
        polarisApi.getPreferences(session),
      ]);
      setConversations(nextConversations);
      setMemories(nextMemories);
      setDevices(nextDevices);
      setProfile(nextProfile);
      setPreferences(nextPreferences);
      const registered = await polarisApi.registerDevice(session, {
        clientId: getOrCreateWebClientId(),
        name: 'Polaris Web',
        type: 'WEB',
        platform: navigator.userAgent.slice(0, 110),
        status: 'ONLINE',
        metadata: { client: 'web', version: '0.1.0' },
      });
      setDevices((current) => [
        registered,
        ...current.filter((device) => device.id !== registered.id),
      ]);
      setWebDeviceId(registered.id);
    } catch (cause) {
      setProblem(errorText(cause));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void refresh(); }, [session.access_token]);

  useEffect(() => {
    if (!webDeviceId) return;

    let disposed = false;

    const executeRelayCommand = async (command: RelayCommand) => {
      if (command.requires_confirmation) {
        setNotice(`Polaris Web recibió una orden que requiere confirmación: ${command.action}`);
        return;
      }

      await polarisApi.updateRelayCommand(session, command.id, 'RUNNING');

      try {
        if (command.action === 'web.open_url') {
          const rawUrl = command.payload.url;
          if (typeof rawUrl !== 'string' || !/^https?:\/\//i.test(rawUrl)) {
            throw new Error('La orden web.open_url no contiene una URL HTTP/HTTPS válida.');
          }
          const opened = window.open(rawUrl, '_blank', 'noopener,noreferrer');
          if (!opened) {
            window.location.assign(rawUrl);
          }
          await polarisApi.updateRelayCommand(session, command.id, 'SUCCEEDED', {
            opened: true,
            url: rawUrl,
            fallbackNavigation: !opened,
          });
          setNotice(`Polaris abrió ${rawUrl}`);
        } else if (command.action === 'web.copy_text') {
          const text = command.payload.text;
          if (typeof text !== 'string' || text.length > 20_000) {
            throw new Error('El texto para copiar no es válido.');
          }
          if (!navigator.clipboard?.writeText) {
            throw new Error('El navegador no ofrece Clipboard API en esta sesión.');
          }
          await navigator.clipboard.writeText(text);
          await polarisApi.updateRelayCommand(session, command.id, 'SUCCEEDED', {
            copied: true,
            length: text.length,
          });
          setNotice('Polaris copió texto al portapapeles Web.');
        } else if (command.action === 'web.scroll_top') {
          window.scrollTo({ top: 0, behavior: 'smooth' });
          await polarisApi.updateRelayCommand(session, command.id, 'SUCCEEDED', { position: 'top' });
        } else if (command.action === 'web.scroll_bottom') {
          window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' });
          await polarisApi.updateRelayCommand(session, command.id, 'SUCCEEDED', { position: 'bottom' });
        } else if (command.action === 'web.focus_chat') {
          const target = document.querySelector<HTMLTextAreaElement>('textarea[aria-label="Mensaje para Polaris"]');
          if (!target) throw new Error('No hay un campo de chat disponible en la vista actual.');
          target.focus();
          await polarisApi.updateRelayCommand(session, command.id, 'SUCCEEDED', { focused: true });
        } else if (command.action === 'web.run_skill') {
          const program = command.payload.program;
          if (!program || typeof program !== 'object' || Array.isArray(program)) {
            throw new Error('La orden web.run_skill no contiene un programa válido.');
          }
          const root = program as { version?: unknown; steps?: unknown };
          if (root.version !== 1 || !Array.isArray(root.steps) || root.steps.length > 12) {
            throw new Error('Skill Web fuera de los límites permitidos.');
          }
          let completed = 0;
          for (const rawStep of root.steps) {
            if (!rawStep || typeof rawStep !== 'object' || Array.isArray(rawStep)) {
              throw new Error('Paso Web inválido.');
            }
            const step = rawStep as { action?: unknown; ms?: unknown };
            if (step.action !== 'wait') {
              throw new Error(`Acción web.run_skill no permitida: ${String(step.action)}`);
            }
            const ms = typeof step.ms === 'number' && Number.isFinite(step.ms) ? step.ms : 0;
            if (ms < 0 || ms > 10_000) throw new Error('La espera Web está fuera del límite.');
            await new Promise<void>((resolve) => window.setTimeout(resolve, ms));
            completed += 1;
          }
          await polarisApi.updateRelayCommand(session, command.id, 'SUCCEEDED', { skill: { completed } });
          setNotice(`Skill Web ejecutada: ${completed} paso(s).`);
        } else {
          throw new Error(`Acción Web no implementada en este cliente: ${command.action}`);
        }
      } catch (cause) {
        const message = cause instanceof Error ? cause.message : 'La acción Web falló.';
        await polarisApi.updateRelayCommand(session, command.id, 'FAILED', {}, message);
        setProblem(message);
      }
    };

    const poll = async () => {
      if (disposed || relayBusy.current) return;
      relayBusy.current = true;
      try {
        const commands = await polarisApi.listRelayCommands(session, webDeviceId);
        for (const command of commands.slice(0, 3)) {
          if (disposed) break;
          try {
            const claimed = await polarisApi.claimRelayCommand(session, command.id, webDeviceId);
            await executeRelayCommand(claimed);
          } catch {
            // Otro cliente Polaris puede haber reclamado la orden.
          }
        }
      } catch {
        // Relay is optional; chat remains usable.
      } finally {
        relayBusy.current = false;
      }
    };

    void poll();
    const timer = window.setInterval(() => void poll(), 2500);
    return () => {
      disposed = true;
      window.clearInterval(timer);
    };
  }, [session, webDeviceId]);

  useEffect(() => {
    const client = getSupabaseClient();
    const userId = session.user.id;
    const channel = client
      .channel(`polaris-sync:${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversations', filter: `user_id=eq.${userId}` }, () => {
        void refresh();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'memories', filter: `user_id=eq.${userId}` }, () => {
        void refresh();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'devices', filter: `user_id=eq.${userId}` }, () => {
        void refresh();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles', filter: `id=eq.${userId}` }, () => {
        void refresh();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_preferences', filter: `user_id=eq.${userId}` }, () => {
        void refresh();
      })
      .subscribe();

    return () => {
      void client.removeChannel(channel);
    };
  }, [session.user.id]);

  const openConversation = async (id: string) => {
    setSelectedConversationId(id);
    setView('chat');
    setProblem(null);
    try {
      setMessages(await polarisApi.listMessages(session, id));
    } catch (cause) {
      setProblem(errorText(cause));
    }
  };

  const createConversation = async (): Promise<Conversation | null> => {
    try {
      const conversation = await polarisApi.createConversation(session);
      setConversations((current) => [conversation, ...current]);
      setSelectedConversationId(conversation.id);
      setMessages([]);
      setView('chat');
      return conversation;
    } catch (cause) {
      setProblem(errorText(cause));
      return null;
    }
  };

  return (
    <main className="workspace">
      <Sidebar view={view} onView={setView} onNew={() => void createConversation()} onSignOut={onSignOut} email={session.user.email ?? 'Cuenta Polaris'} />
      <section className="workspace-content">
        {!isApiConfigured && <div className="inline-alert warning">La interfaz está autenticada, pero falta VITE_POLARIS_API_URL. Las funciones de Polaris Core permanecen deshabilitadas.</div>}
        {problem && <div className="inline-alert error" role="alert">{problem}<button type="button" onClick={() => setProblem(null)}>×</button></div>}
        {notice && <div className="inline-alert success" role="status">{notice}<button type="button" onClick={() => setNotice(null)}>×</button></div>}
        {view === 'home' && <Dashboard conversations={conversations} memories={memories} devices={devices} loading={loading} onChat={() => setView('chat')} onMemories={() => setView('memories')} />}
        {view === 'chat' && <ChatView session={session} conversations={conversations} selected={selected} messages={messages} setMessages={setMessages} onNew={() => void createConversation()} onOpen={openConversation} onRefreshConversations={() => {
          void polarisApi.listConversations(session)
            .then(setConversations)
            .catch((cause) => setProblem(errorText(cause)));
        }} onProblem={setProblem} onNotice={setNotice} />}
        {view === 'history' && <History conversations={conversations} onOpen={openConversation} onNew={() => void createConversation()} />}
        {view === 'memories' && <MemoriesView session={session} memories={memories} setMemories={setMemories} onProblem={setProblem} onNotice={setNotice} />}
        {view === 'profile' && <ProfileView session={session} profile={profile} setProfile={setProfile} onProblem={setProblem} onNotice={setNotice} />}
        {view === 'settings' && <SettingsView session={session} preferences={preferences} setPreferences={setPreferences} onProblem={setProblem} onNotice={setNotice} />}
        {view === 'devices' && <DevicesView devices={devices} onRefresh={() => void refresh()} />}
        {view === 'capabilities' && <CapabilitiesView session={session} onProblem={setProblem} onNotice={setNotice} />}
      </section>
    </main>
  );
}

function Sidebar({
  view,
  onView,
  onNew,
  onSignOut,
  email,
}: {
  view: View;
  onView(view: View): void;
  onNew(): void;
  onSignOut(): void;
  email: string;
}) {
  const items: Array<[View, string, string]> = [
    ['home', 'Inicio', '✦'], ['chat', 'Conversar', '◌'], ['history', 'Historial', '◫'],
    ['memories', 'Memorias', '◇'], ['devices', 'Dispositivos', '⌘'], ['capabilities', 'Capacidades', '✦'], ['profile', 'Perfil', '○'], ['settings', 'Ajustes', '⚙'],
  ];
  return (
    <aside className="workspace-sidebar">
      {brand()}
      <button className="new-chat" type="button" onClick={onNew}>+ Nueva conversación <kbd>Ctrl/Cmd + K</kbd></button>
      <nav aria-label="Navegación de Polaris">
        {items.map(([key, label, icon]) => <button key={key} type="button" className={view === key ? 'selected' : ''} onClick={() => onView(key)}><span>{icon}</span>{label}</button>)}
      </nav>
      <div className="sidebar-bottom">
        <p><span className="online-dot" />Núcleo conectado</p>
        <strong>{email}</strong>
        <button type="button" className="link-button" onClick={onSignOut}>Cerrar sesión</button>
      </div>
    </aside>
  );
}

function Dashboard({
  conversations,
  memories,
  devices,
  loading,
  onChat,
  onMemories,
}: {
  conversations: Conversation[];
  memories: Memory[];
  devices: Device[];
  loading: boolean;
  onChat(): void;
  onMemories(): void;
}) {
  return (
    <div className="page dashboard">
      <header className="dashboard-hero">
        <span className="eyebrow">POLARIS · ASISTENTE PERSONAL</span>
        <h1>Encuentra claridad.<br /><i>Sigue tu norte.</i></h1>
        <p>Polaris conserva lo importante sin ocultarlo: chat, memoria y dispositivos bajo tu control.</p>
        <div><button type="button" className="primary-button" onClick={onChat}>Hablar con Polaris <span>→</span></button><button type="button" className="secondary-button" onClick={onMemories}>Ver memorias</button></div>
      </header>
      <div className="dashboard-orbit-shell">
        <PolarisOrbit mode="companion" state="idle" />
        <div className="dashboard-orbit-copy">
          <span className="eyebrow">POLARIS CORE</span>
          <strong>Un núcleo, muchos mundos.</strong>
          <span>Memoria · Skills · dispositivos · continuidad</span>
        </div>
      </div>
      <section className="summary-grid">
        <Summary title="Conversaciones" value={loading ? '—' : String(conversations.length)} hint="Historial privado" />
        <Summary title="Memorias" value={loading ? '—' : String(memories.length)} hint="Explícitas y controlables" />
        <Summary title="Dispositivos" value={loading ? '—' : String(devices.length)} hint="Misma identidad" />
      </section>
      <section className="transparency">
        <div><span className="eyebrow">TRANSPARENCIA</span><h2>Capacidades que existen, no promesas vacías.</h2><p>Las respuestas llegan en streaming si el proveedor está configurado. Cuando no lo está, Polaris conserva tu mensaje y explica el límite.</p></div>
        <ul><li>✓ Contexto y memoria controlables</li><li>✓ Skill Runtime con allowlist</li><li>✓ Relay entre Web, Android y PC</li><li>✓ Brain unificado y políticas de seguridad</li><li>✓ Capability Fabric con catálogo navegable</li><li>✓ Identidad visual 3D por estado</li></ul>
      </section>
    </div>
  );
}

function Summary({ title, value, hint }: { title: string; value: string; hint: string }) {
  return <article className="summary-card"><span>{title}</span><strong>{value}</strong><small>{hint}</small></article>;
}

function ChatView({
  session,
  conversations,
  selected,
  messages,
  setMessages,
  onNew,
  onOpen,
  onRefreshConversations,
  onProblem,
  onNotice,
}: {
  session: Session;
  conversations: Conversation[];
  selected: Conversation | null;
  messages: Message[];
  setMessages(next: Message[] | ((current: Message[]) => Message[])): void;
  onNew(): void;
  onOpen(id: string): void;
  onRefreshConversations(): void;
  onProblem(message: string): void;
  onNotice(message: string): void;
}) {
  const [draft, setDraft] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [activeTool, setActiveTool] = useState<string | null>(null);
  const [activeId, setActiveId] = useState(selected?.id ?? null);
  const controller = useRef<AbortController | null>(null);
  const pane = useRef<HTMLDivElement>(null);

  useEffect(() => { setActiveId(selected?.id ?? null); }, [selected?.id]);
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const element = pane.current;
      if (!element) return;
      const distanceFromBottom = element.scrollHeight - element.scrollTop - element.clientHeight;
      if (distanceFromBottom < 180) {
        element.scrollTo({ top: element.scrollHeight, behavior: 'auto' });
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, [messages]);

  const currentId = activeId ?? selected?.id ?? null;

  function onKey(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void send();
    }
  }

  async function ensureConversation(): Promise<string | null> {
    if (currentId) return currentId;
    try {
      const conversation = await polarisApi.createConversation(session);
      setActiveId(conversation.id);
      onRefreshConversations();
      return conversation.id;
    } catch (cause) {
      onProblem(errorText(cause));
      return null;
    }
  }

  async function send(retryMessage?: string) {
    const content = (retryMessage ?? draft).trim();
    if (!content || streaming) return;

    const directWebUrl =
      content.match(/^(?:abre|abrir|open)(?:\s+en\s+(?:web|esta\s+pestaña|el\s+navegador))?\s+(https?:\/\/\S+?)(?:\s+en\s+(?:otra\s+)?pestaña)?$/iu)?.[1]
      ?? content.match(/^(?:abre|abrir|open)\s+(https?:\/\/\S+)$/iu)?.[1];

    if (directWebUrl) {
      const url = directWebUrl.replace(/[),.;!?]+$/u, '');
      if (!/^https?:\/\//i.test(url)) return;
      const opened = window.open(url, '_blank', 'noopener,noreferrer');
      if (!opened) window.location.assign(url);
      onNotice(opened ? `Polaris abrió ${url} en otra pestaña.` : `Polaris navegó a ${url} en esta pestaña.`);
      setDraft('');
      return;
    }
    if (!navigator.onLine) {
      onProblem('Estás sin conexión. Polaris no enviará ni inventará una respuesta.');
      return;
    }
    if (!isApiConfigured) {
      onProblem('Polaris API no está configurada en esta web.');
      return;
    }
    const conversationId = await ensureConversation();
    if (!conversationId) return;

    const now = new Date().toISOString();
    const user: Message = { id: `local-user-${crypto.randomUUID()}`, conversation_id: conversationId, role: 'user', content, status: 'completed', created_at: now };
    const assistantId = `local-assistant-${crypto.randomUUID()}`;
    const assistant: Message = { id: assistantId, conversation_id: conversationId, role: 'assistant', content: '', status: 'streaming', created_at: now };
    setMessages((current) => [...current, user, assistant]);
    setDraft('');
    setStreaming(true);
    const nextController = new AbortController();
    controller.current = nextController;

    const onEvent = (event: SseEvent) => {
      const data = event.data as Record<string, unknown>;
      if (event.event === 'message.accepted' && typeof data.conversationId === 'string') {
        setActiveId(data.conversationId);
      }
      if (event.event === 'message.delta' && typeof data.delta === 'string') {
        setMessages((current) => current.map((message) => message.id === assistantId ? { ...message, content: message.content + data.delta } : message));
      }
      if (event.event === 'tool.started' && typeof data.name === 'string') setActiveTool(data.name);
      if (event.event === 'tool.completed') setActiveTool(null);
      if (event.event === 'message.done') {
        setMessages((current) => current.map((message) => message.id === assistantId ? { ...message, status: 'completed' } : message));
      }
      if (event.event === 'error') {
        setMessages((current) => current.map((message) => message.id === assistantId ? { ...message, status: 'failed' } : message));
      }
    };

    try {
      await polarisApi.streamChat(session, { conversationId, message: content }, nextController.signal, onEvent);
      onRefreshConversations();
    } catch (cause) {
      if ((cause as Error).name !== 'AbortError') {
        onProblem(errorText(cause));
        setMessages((current) => current.map((message) => message.id === assistantId ? { ...message, status: 'failed' } : message));
      }
    } finally {
      controller.current = null;
      setStreaming(false);
      setActiveTool(null);
    }
  }

  function stop() {
    controller.current?.abort();
    controller.current = null;
    setStreaming(false);
    setActiveTool(null);
    setMessages((current) => current.map((message) => message.status === 'streaming' ? { ...message, status: 'cancelled' } : message));
    onNotice('Generación detenida.');
  }

  const retry = () => {
    const lastUser = [...messages].reverse().find((message) => message.role === 'user');
    if (lastUser) void send(lastUser.content);
  };

  return (
    <div className="chat-page">
      <aside className="chat-history">
        <div><span className="eyebrow">CONVERSACIONES</span><button type="button" onClick={onNew} aria-label="Nueva conversación">+</button></div>
        {conversations.length === 0 && <p>Inicia tu primera conversación.</p>}
        {conversations.map((conversation) => <button type="button" key={conversation.id} className={conversation.id === currentId ? 'current' : ''} onClick={() => onOpen(conversation.id)}><strong>{conversation.title}</strong><small>{dateTime(conversation.updated_at)}</small></button>)}
      </aside>
      <section className="chat-room">
        <header><div><span className="eyebrow">CONVERSAR</span><h1>{selected?.title ?? 'Nueva conversación'}</h1></div>{activeTool && <span className="tool-status">Ejecutando: {activeTool}</span>}</header>
        <div className="message-feed" ref={pane} aria-live="polite">
          {messages.length === 0 && <div className="chat-empty"><span>✦</span><h2>¿Qué exploramos hoy?</h2><p>Escribe un mensaje. Usa “Recuerda que…” para guardar una memoria explícita.</p><button type="button" onClick={() => setDraft('Hola Polaris.')}>Hola Polaris.</button><button type="button" onClick={() => setDraft('Recuerda que Polaris es mi proyecto.')}>Recuerda que Polaris es mi proyecto.</button></div>}
          {messages.map((message) => <MessageBubble message={message} key={message.id} />)}
        </div>
        <div className="web-composer">
          <textarea aria-label="Mensaje para Polaris" value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={onKey} disabled={streaming} placeholder="Escribe a Polaris…" rows={3} />
          <footer><span>Enter para enviar · Shift + Enter para nueva línea</span>{streaming ? <button className="stop-button" type="button" onClick={stop}>Detener</button> : <button className="send-button" type="button" disabled={!draft.trim()} onClick={() => void send()}>Enviar <span>↑</span></button>}</footer>
        </div>
        {messages.some((message) => message.status === 'failed') && <button className="retry" type="button" onClick={retry}>Reintentar el último mensaje</button>}
      </section>
    </div>
  );
}

function MessageBubble({ message }: { message: Message }) {
  return (
    <article className={`message-bubble ${message.role} ${message.status}`}>
      <span className="message-origin">{message.role === 'user' ? 'TÚ' : 'P'}</span>
      <div><header><strong>{message.role === 'user' ? 'Tú' : 'Polaris'}</strong><time>{dateTime(message.created_at)}</time></header>
        {message.content ? <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>{message.content}</ReactMarkdown> : message.status === 'streaming' ? <span className="typing-dots"><i /><i /><i /></span> : message.status === 'failed' ? <p className="failed">No se pudo generar una respuesta verificable.</p> : message.status === 'cancelled' ? <p className="failed">Generación detenida.</p> : null}
        {message.role === 'assistant' && message.content && <button type="button" className="copy-message" onClick={() => {
          void navigator.clipboard.writeText(message.content).catch(() => undefined);
        }}>Copiar</button>}
      </div>
    </article>
  );
}

function History({ conversations, onOpen, onNew }: { conversations: Conversation[]; onOpen(id: string): void; onNew(): void }) {
  return <div className="page"><header className="section-heading"><div><span className="eyebrow">TRAYECTORIA</span><h1>Historial de conversaciones</h1><p>El historial de tu cuenta se mantiene separado de tus memorias.</p></div><button className="primary-button" type="button" onClick={onNew}>Nueva conversación</button></header><div className="history-list">{conversations.length === 0 ? <Empty title="Aún no hay conversaciones" description="Tus conversaciones reales aparecerán aquí." /> : conversations.map((conversation) => <button type="button" className="history-entry" key={conversation.id} onClick={() => onOpen(conversation.id)}><span>✦</span><div><strong>{conversation.title}</strong><small>Actualizada {dateTime(conversation.updated_at)}</small></div><b>→</b></button>)}</div></div>;
}

function MemoriesView({
  session,
  memories,
  setMemories,
  onProblem,
  onNotice,
}: {
  session: Session;
  memories: Memory[];
  setMemories(next: Memory[] | ((current: Memory[]) => Memory[])): void;
  onProblem(message: string): void;
  onNotice(message: string): void;
}) {
  const [content, setContent] = useState('');
  const [category, setCategory] = useState<MemoryCategory>('PROJECT');
  const [query, setQuery] = useState('');
  const [edit, setEdit] = useState<Memory | null>(null);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      if (edit) {
        const updated = await polarisApi.updateMemory(session, edit.id, { content, category });
        setMemories((current) => current.map((memory) => memory.id === updated.id ? updated : memory));
        setEdit(null);
        onNotice('Memoria actualizada.');
      } else {
        const memory = await polarisApi.createMemory(session, { content, category, importance: 3 });
        setMemories((current) => [memory, ...current]);
        onNotice('Memoria guardada.');
      }
      setContent('');
    } catch (cause) {
      onProblem(errorText(cause));
    }
  }

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const next = await polarisApi.listMemories(session, query);
          if (!cancelled) setMemories(next);
        } catch (cause) {
          if (!cancelled) onProblem(errorText(cause));
        }
      })();
    }, query ? 220 : 0);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [session.access_token, query]);

  function search(value: string) {
    setQuery(value);
  }

  async function remove(id: string) {
    if (!window.confirm('¿Eliminar esta memoria?')) return;
    try {
      await polarisApi.deleteMemory(session, id);
      setMemories((current) => current.filter((memory) => memory.id !== id));
      onNotice('Memoria eliminada.');
    } catch (cause) {
      onProblem(errorText(cause));
    }
  }

  function beginEdit(memory: Memory) {
    setEdit(memory);
    setContent(memory.content);
    setCategory(memory.category);
  }

  return <div className="page"><header className="section-heading"><div><span className="eyebrow">MEMORIA CONTROLABLE</span><h1>Lo que Polaris recuerda</h1><p>Tu historial no se convierte automáticamente en memoria. Tú decides qué queda y puedes borrarlo.</p></div></header><div className="memory-grid"><form className="memory-editor" onSubmit={(event) => void save(event)}><h2>{edit ? 'Editar memoria' : 'Guardar una memoria'}</h2><label>Contenido<textarea value={content} onChange={(event) => setContent(event.target.value)} required rows={6} placeholder="Ej.: Polaris es mi proyecto principal." /></label><label>Categoría<select value={category} onChange={(event) => setCategory(event.target.value as MemoryCategory)}>{memoryCategories.map((item) => <option key={item}>{item}</option>)}</select></label><button className="primary-button full" type="submit" disabled={!content.trim()}>{edit ? 'Guardar cambios' : 'Guardar memoria'}</button>{edit && <button className="link-button" type="button" onClick={() => { setEdit(null); setContent(''); }}>Cancelar edición</button>}</form><section className="memory-library"><header><div><h2>Biblioteca</h2><span>{memories.length} resultados</span></div><input aria-label="Buscar memorias" value={query} onChange={(event) => void search(event.target.value)} placeholder="Buscar…" /></header>{memories.length === 0 ? <Empty title="No hay memorias" description="Guarda solo la información que quieras que Polaris conserve." /> : <div className="memory-cards">{memories.map((memory) => <article key={memory.id}><div><span>{memoryCategoryName(memory.category)}</span><time>{dateTime(memory.updated_at)}</time></div><p>{memory.content}</p><footer><small>Importancia {memory.importance}/5</small><div><button type="button" onClick={() => beginEdit(memory)}>Editar</button><button type="button" className="danger-link" onClick={() => void remove(memory.id)}>Eliminar</button></div></footer></article>)}</div>}</section></div></div>;
}

function ProfileView({
  session,
  profile,
  setProfile,
  onProblem,
  onNotice,
}: {
  session: Session;
  profile: Profile | null;
  setProfile(profile: Profile): void;
  onProblem(message: string): void;
  onNotice(message: string): void;
}) {
  const [name, setName] = useState(profile?.display_name ?? '');
  const [timezone, setTimezone] = useState(profile?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone);
  const [language, setLanguage] = useState<Profile['language']>(profile?.language ?? 'es');
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url ?? '');

  useEffect(() => {
    if (profile) {
      setName(profile.display_name);
      setTimezone(profile.timezone);
      setLanguage(profile.language);
      setAvatarUrl(profile.avatar_url ?? '');
    }
  }, [profile]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      const updated = await polarisApi.updateProfile(session, {
        display_name: name.trim(),
        timezone: timezone.trim(),
        language,
        avatar_url: avatarUrl.trim() || null,
      });
      setProfile(updated);
      onNotice('Perfil actualizado.');
    } catch (cause) { onProblem(errorText(cause)); }
  }

  return (
    <div className="page narrow">
      <header className="section-heading">
        <div><span className="eyebrow">IDENTIDAD</span><h1>Perfil</h1><p>La misma identidad viaja contigo en web, Android y PC.</p></div>
      </header>
      <form className="detail-card" onSubmit={(event) => void save(event)}>
        <div className="profile-top"><span>{(name || session.user.email || '?').slice(0, 1).toUpperCase()}</span><div><h2>{name || 'Usuario Polaris'}</h2><p>{session.user.email}</p></div></div>
        <label>Nombre<input value={name} onChange={(event) => setName(event.target.value)} minLength={1} maxLength={120} required /></label>
        <label>Idioma<select value={language} onChange={(event) => setLanguage(event.target.value as Profile['language'])}><option value="es">Español</option><option value="en">English</option></select></label>
        <label>Zona horaria<input value={timezone} onChange={(event) => setTimezone(event.target.value)} maxLength={100} required /></label>
        <label>Avatar (URL)<input type="url" value={avatarUrl} onChange={(event) => setAvatarUrl(event.target.value)} placeholder="https://…" maxLength={2048} /></label>
        <button className="primary-button" type="submit" disabled={!name.trim() || !timezone.trim()}>Guardar perfil</button>
      </form>
    </div>
  );
}


function CapabilitiesView({
  session,
  onProblem,
  onNotice,
}: {
  session: Session;
  onProblem(message: string): void;
  onNotice(message: string): void;
}) {
  type FabricItem = {
    id: string;
    name: string;
    platform: 'CORE' | 'WEB' | 'DESKTOP' | 'ANDROID';
    domain: string;
    description: string;
    mode: 'CORE' | 'RELAY';
    risk: 'LOW' | 'MEDIUM' | 'HIGH';
    requiresConfirmation: boolean;
    input: 'none' | 'text' | 'number' | 'json';
  };

  type CatalogResponse = {
    count?: number;
    byPlatform?: Partial<Record<FabricItem['platform'], number>>;
    returned?: number;
    matchedCount?: number;
    offset?: number;
    limit?: number;
    nextOffset?: number | null;
    functions?: FabricItem[];
  };

  const [query, setQuery] = useState('');
  const [platform, setPlatform] = useState<'ALL' | FabricItem['platform']>('ALL');
  const [catalog, setCatalog] = useState<CatalogResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [previewing, setPreviewing] = useState<string | null>(null);

  async function load(offset = 0): Promise<void> {
    setLoading(true);
    try {
      const data = await polarisApi.getFabricCatalog(session, {
        q: query.trim() || undefined,
        platform: platform === 'ALL' ? undefined : platform,
        offset,
      });
      setCatalog(data as CatalogResponse);
    } catch (cause) {
      onProblem(errorText(cause));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => void load(0), query ? 220 : 0);
    return () => window.clearTimeout(timer);
  }, [session.access_token, query, platform]);

  async function preview(item: FabricItem): Promise<void> {
    setPreviewing(item.id);
    try {
      const input = item.input === 'number' ? 5 : item.input === 'json' ? {} : item.input === 'text' ? 'Polaris' : undefined;
      const result = await polarisApi.previewFabricFunction(session, item.id, input);
      onNotice(item.name + ': vista previa generada. ' + JSON.stringify(result.result ?? result.payload ?? result));
    } catch (cause) {
      onProblem(errorText(cause));
    } finally {
      setPreviewing(null);
    }
  }

  const items = catalog?.functions ?? [];
  const pageStart = catalog?.offset ?? 0;
  const pageEnd = pageStart + items.length;
  const hasPrevious = pageStart > 0;
  const hasNext = catalog?.nextOffset != null;

  return (
    <div className="page">
      <header className="section-heading">
        <div>
          <span className="eyebrow">CAPABILITY FABRIC</span>
          <h1>Todas las capacidades reales</h1>
          <p>Catálogo del núcleo con operaciones ejecutables o enroutables. No se muestran funciones de relleno ni estados futuros.</p>
        </div>
        <button type="button" className="secondary-button" onClick={() => void load(pageStart)}>Actualizar</button>
      </header>

      <section className="summary-grid">
        <Summary title="Total" value={String(catalog?.count ?? '—')} hint="Funciones registradas" />
        <Summary title="CORE" value={String(catalog?.byPlatform?.CORE ?? '—')} hint="Determinísticas" />
        <Summary title="Web / PC / Android" value={catalog ? String(catalog.byPlatform?.WEB ?? 0) + ' / ' + String(catalog.byPlatform?.DESKTOP ?? 0) + ' / ' + String(catalog.byPlatform?.ANDROID ?? 0) : '—'} hint="Handles de cliente" />
      </section>

      <section className="detail-card">
        <div className="setting-row">
          <div>
            <h2>Explorar y probar</h2>
            <p>La vista previa ejecuta funciones CORE en el servidor de forma determinista y compila relays sin activar hardware por sorpresa.</p>
          </div>
        </div>
        <div className="theme-picker" style={{ marginTop: 16, flexWrap: 'wrap' }}>
          {(['ALL', 'CORE', 'WEB', 'DESKTOP', 'ANDROID'] as const).map((item) => (
            <button key={item} type="button" className={platform === item ? 'active' : ''} onClick={() => setPlatform(item)}>
              {item === 'ALL' ? 'Todo' : item}
            </button>
          ))}
        </div>
        <input
          aria-label="Buscar capacidades"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Buscar por nombre, dominio o función…"
          style={{ marginTop: 16, width: '100%' }}
        />
      </section>

      <section className="memory-library">
        <header>
          <div><h2>Funciones {catalog ? String(pageStart + 1) + '–' + String(pageEnd) : ''}</h2><span>{loading ? 'Cargando…' : String(items.length) + ' en esta página'}</span></div>
        </header>
        {items.length === 0 && !loading ? (
          <Empty title="No hay coincidencias" description="Prueba otro término o cambia la plataforma." />
        ) : (
          <div className="memory-cards">
            {items.map((item) => (
              <article key={item.id}>
                <div><span>{item.platform} · {item.domain}</span><strong>{item.risk}</strong></div>
                <h3>{item.name}</h3>
                <p>{item.description}</p>
                <footer>
                  <small>{item.mode === 'CORE' ? 'Ejecutable en Core' : 'Relay ' + item.platform} · entrada: {item.input}{item.requiresConfirmation ? ' · confirma antes de ejecutar' : ''}</small>
                  <button type="button" onClick={() => void preview(item)} disabled={previewing === item.id}>
                    {previewing === item.id ? 'Probando…' : 'Vista previa'}
                  </button>
                </footer>
              </article>
            ))}
          </div>
        )}
        <div className="detail-card" style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginTop: 16 }}>
          <button type="button" className="secondary-button" disabled={!hasPrevious || loading} onClick={() => void load(Math.max(0, pageStart - (catalog?.limit ?? 200)))}>← Anterior</button>
          <span style={{ alignSelf: 'center' }}>{catalog ? String(pageStart + 1) + '–' + String(pageEnd) + ' / ' + String(catalog.matchedCount ?? pageEnd) : '—'}</span>
          <button type="button" className="secondary-button" disabled={!hasNext || loading} onClick={() => void load(catalog?.nextOffset ?? pageEnd)}>Siguiente →</button>
        </div>
      </section>
    </div>
  );
}

function SettingsView({
  session,
  preferences,
  setPreferences,
  onProblem,
  onNotice,
}: {
  session: Session;
  preferences: Preferences | null;
  setPreferences(preferences: Preferences): void;
  onProblem(message: string): void;
  onNotice(message: string): void;
}) {
  async function update(theme: Preferences['theme']) {
    try {
      const next = await polarisApi.updatePreferences(session, { theme });
      setPreferences(next);
      onNotice('Preferencia sincronizada.');
    } catch (cause) { onProblem(errorText(cause)); }
  }

  return <div className="page narrow"><header className="section-heading"><div><span className="eyebrow">CONTROL</span><h1>Ajustes</h1><p>Preferencias guardadas con tu cuenta, no con un dispositivo aislado.</p></div></header><section className="detail-card setting-row"><div><h2>Tema</h2><p>La experiencia prioriza oscuro, pero tu elección se sincroniza.</p></div><div className="theme-picker">{(['dark', 'light', 'system'] as const).map((theme) => <button type="button" className={preferences?.theme === theme ? 'active' : ''} onClick={() => void update(theme)} key={theme}>{theme === 'dark' ? 'Oscuro' : theme === 'light' ? 'Claro' : 'Sistema'}</button>)}</div></section><section className="detail-card"><h2>Privacidad</h2><p>Las claves privadas de IA no se incluyen en la web. Tus permisos y datos se restringen mediante identidad y RLS.</p></section><section className="detail-card"><h2>Capacidades conectadas</h2><div className="summary-grid"><Summary title="Voz Android" value="ACTIVA" hint="VoiceInteractionService" /><Summary title="Automatización" value="ACTIVA" hint="Skills + Scenes seguras" /><Summary title="Control doméstico" value="CONFIGURABLE" hint="Home Assistant REST" /></div><p style={{ marginTop: 16 }}>Los límites de hardware, permisos y gateways se muestran de forma explícita. Polaris no presenta integraciones desconectadas como si estuvieran activas.</p></section></div>;
}

function DevicesView({ devices, onRefresh }: { devices: Device[]; onRefresh(): void }) {
  return <div className="page"><header className="section-heading"><div><span className="eyebrow">PRESENCIA</span><h1>Dispositivos</h1><p>Tu identidad se sincroniza solo con dispositivos que se registran de forma real.</p></div><button type="button" className="secondary-button" onClick={onRefresh}>Actualizar</button></header><div className="device-list">{devices.length === 0 ? <Empty title="Aún no hay dispositivos" description="Esta web se registrará cuando Polaris API esté conectada." /> : devices.map((device) => <article key={device.id}><span className="device-symbol">{device.type === 'WEB' ? '◫' : device.type === 'ANDROID' ? '▥' : '▣'}</span><div><span className="memory-type">{device.type}</span><h2>{device.name}</h2><p>{device.platform}</p><small>Última actividad: {dateTime(device.last_seen)}</small></div><strong className={device.status === 'ONLINE' ? 'online-status' : ''}>{device.status}</strong></article>)}</div></div>;
}


function Empty({ title, description }: { title: string; description: string }) {
  return <div className="empty"><span>✦</span><h2>{title}</h2><p>{description}</p></div>;
}
