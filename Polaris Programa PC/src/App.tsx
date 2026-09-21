import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Session } from "@supabase/supabase-js";
import { ApiError, api, streamChat } from "./lib/api";
import { configurationIssues } from "./lib/config";
import type {
  Conversation,
  Device,
  Memory,
  MemoryCategory,
  PolarisMessage,
  PolarisState,
  Preferences,
  Profile as PolarisProfile
} from "./lib/models";
import { clearSecureSession, loadSecureSession, saveSecureSession } from "./lib/secureSession";
import { desktopNative, type DesktopSystemInfo } from "./lib/native";
import { supabase } from "./lib/supabase";

type Screen = "home" | "chat" | "history" | "memories" | "profile" | "settings" | "devices";
type AuthMode = "signIn" | "signUp" | "recover";

const categories: MemoryCategory[] = ["PERSONAL", "PREFERENCE", "PROJECT", "CONTEXT", "FACT", "GOAL"];

const stateLabels: Record<PolarisState, string> = {
  IDLE: "En línea",
  LISTENING: "Escuchando",
  THINKING: "Pensando",
  EXECUTING: "Ejecutando",
  SPEAKING: "Hablando",
  SUCCESS: "Completado",
  WARNING: "Atención",
  ERROR: "Error",
  OFFLINE: "Sin conexión"
};

function PolarisMark({ compact = false }: { compact?: boolean }) {
  return (
    <div className="brand" aria-label="Polaris">
      <svg className="brand-mark" viewBox="0 0 64 64" aria-hidden="true">
        <path d="M32 5l4.4 19.3L59 32l-22.6 7.7L32 59l-4.4-19.3L5 32l22.6-7.7L32 5z" />
        <circle cx="32" cy="32" r="5.8" />
      </svg>
      {!compact && <span>POLARIS</span>}
    </div>
  );
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "Sin actividad";
  return new Intl.DateTimeFormat("es-PE", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function displayCategory(category: MemoryCategory): string {
  return {
    PERSONAL: "Personal",
    PREFERENCE: "Preferencia",
    PROJECT: "Proyecto",
    CONTEXT: "Contexto",
    FACT: "Hecho",
    GOAL: "Meta"
  }[category];
}

function App() {
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [screen, setScreen] = useState<Screen>("home");
  const [online, setOnline] = useState(navigator.onLine);
  const [polarisState, setPolarisState] = useState<PolarisState>(navigator.onLine ? "IDLE" : "OFFLINE");
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<PolarisMessage[]>([]);
  const [memories, setMemories] = useState<Memory[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [desktopDeviceId, setDesktopDeviceId] = useState<string | null>(null);
  const [preferences, setPreferences] = useState<Preferences | null>(null);
  const [profile, setProfile] = useState<PolarisProfile | null>(null);
  const [composer, setComposer] = useState("");
  const [memoryDraft, setMemoryDraft] = useState("");
  const [memoryCategory, setMemoryCategory] = useState<MemoryCategory>("PROJECT");
  const [memoryQuery, setMemoryQuery] = useState("");
  const [loadingWorkspace, setLoadingWorkspace] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [activeTool, setActiveTool] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const streamController = useRef<AbortController | null>(null);
  const relayBusy = useRef(false);

  const selectedConversation = useMemo(
    () => conversations.find((conversation) => conversation.id === selectedConversationId) ?? null,
    [conversations, selectedConversationId]
  );

  useEffect(() => {
    const updateConnection = () => {
      const isOnline = navigator.onLine;
      setOnline(isOnline);
      if (!isOnline) setPolarisState("OFFLINE");
      if (isOnline && !streaming) setPolarisState("IDLE");
    };
    window.addEventListener("online", updateConnection);
    window.addEventListener("offline", updateConnection);
    return () => {
      window.removeEventListener("online", updateConnection);
      window.removeEventListener("offline", updateConnection);
    };
  }, [streaming]);

  useEffect(() => {
    let active = true;
    void (async () => {
      const persisted = await loadSecureSession();
      if (persisted) {
        const { data } = await supabase.auth.setSession(persisted);
        if (active) setSession(data.session);
      } else {
        const {
          data: { session: current }
        } = await supabase.auth.getSession();
        if (active) setSession(current);
      }
      if (active) setReady(true);
    })();

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      window.setTimeout(() => {
        if (nextSession) {
          void saveSecureSession(nextSession).catch(() =>
            setNotice("La sesión está activa, pero Windows no permitió guardarla de forma segura.")
          );
        } else {
          void clearSecureSession().catch(() => undefined);
        }
      }, 0);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!session) {
      setConversations([]);
      setMemories([]);
      setMessages([]);
      setDevices([]);
      setPreferences(null);
      setProfile(null);
      return;
    }
    void refreshWorkspace();
  }, [session]);

  useEffect(() => {
    const onShortcut = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey)) return;
      const key = event.key.toLowerCase();
      if (key === "k") {
        event.preventDefault();
        setScreen("chat");
      } else if (key >= "1" && key <= "7") {
        event.preventDefault();
        const screens: Screen[] = ["home", "chat", "history", "memories", "profile", "settings", "devices"];
        setScreen(screens[Number(key) - 1]);
      }
    };
    window.addEventListener("keydown", onShortcut);
    return () => window.removeEventListener("keydown", onShortcut);
  }, []);

  async function refreshWorkspace(): Promise<void> {
    if (!session) return;
    setLoadingWorkspace(true);
    setError(null);
    try {
      const [nextConversations, nextMemories, nextDevices, nextPreferences, nextProfile, registered] = await Promise.all([
        api.listConversations(),
        api.listMemories(),
        api.listDevices(),
        api.getPreferences(),
        api.getProfile(),
        api.registerDesktop().catch(() => null)
      ]);
      setConversations(nextConversations);
      setMemories(nextMemories);
      setDevices(
        registered
          ? [registered, ...nextDevices.filter((device) => device.id !== registered.id)]
          : nextDevices
      );
      setPreferences(nextPreferences);
      setProfile(nextProfile);
    } catch (cause) {
      setError(toUserMessage(cause));
      setPolarisState(online ? "WARNING" : "OFFLINE");
    } finally {
      setLoadingWorkspace(false);
    }
  }

  async function openConversation(conversationId: string): Promise<void> {
    setSelectedConversationId(conversationId);
    setScreen("chat");
    setLoadingMessages(true);
    setError(null);
    try {
      setMessages(await api.listMessages(conversationId));
    } catch (cause) {
      setError(toUserMessage(cause));
    } finally {
      setLoadingMessages(false);
    }
  }

  async function createConversation(): Promise<Conversation | null> {
    try {
      const conversation = await api.createConversation("Nueva conversación");
      setConversations((current) => [conversation, ...current]);
      setSelectedConversationId(conversation.id);
      setMessages([]);
      setScreen("chat");
      return conversation;
    } catch (cause) {
      setError(toUserMessage(cause));
      return null;
    }
  }

  async function executeRelayCommand(command: import("./lib/models").RelayCommand): Promise<void> {
    setPolarisState("EXECUTING");
    try {
      if (command.requires_confirmation) {
        setNotice("Polaris recibió una orden remota que requiere confirmación local; no se ejecutará automáticamente.");
        return;
      }

      await api.updateRelayCommand(command.id, "RUNNING");

      if (command.action === "desktop.open_url") {
        const url = command.payload.url;
        if (typeof url !== "string") throw new Error("Falta payload.url.");
        await desktopNative.openUrl(url);
        await api.updateRelayCommand(command.id, "SUCCEEDED", { opened: true, url });
      } else if (command.action === "desktop.reveal_path") {
        const path = command.payload.path;
        if (typeof path !== "string") throw new Error("Falta payload.path.");
        await desktopNative.revealPath(path);
        await api.updateRelayCommand(command.id, "SUCCEEDED", { revealed: true, path });
      } else if (command.action === "desktop.system_info") {
        const info = await desktopNative.systemInfo();
        await api.updateRelayCommand(command.id, "SUCCEEDED", { system: info });
      } else {
        throw new Error(`Acción remota no implementada en este cliente: ${command.action}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "La ejecución nativa falló.";
      await api.updateRelayCommand(command.id, "FAILED", {}, message).catch(() => undefined);
      setError(message);
      setPolarisState("ERROR");
    } finally {
      if (polarisState !== "ERROR") setPolarisState("IDLE");
    }
  }

  useEffect(() => {
    if (!session || !desktopDeviceId) return;

    let disposed = false;
    const poll = async () => {
      if (disposed || relayBusy.current) return;
      relayBusy.current = true;
      try {
        const commands = await api.listRelayCommands(desktopDeviceId);
        for (const command of commands.slice(0, 3)) {
          if (disposed || command.requires_confirmation) continue;
          try {
            const claimed = await api.claimRelayCommand(command.id, desktopDeviceId);
            await executeRelayCommand(claimed);
          } catch {
            // Another Polaris client may have claimed the command first.
          }
        }
      } catch {
        // Relay is an enhancement; ordinary chat remains usable when it is unavailable.
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
  }, [session, desktopDeviceId]);

  async function sendMessage(override?: string): Promise<void> {
    const content = (override ?? composer).trim();
    if (!content || streaming) return;

    if (!online) {
      setError("Estás sin conexión. Polaris no enviará ni inventará una respuesta.");
      setPolarisState("OFFLINE");
      return;
    }

    setError(null);
    let conversationId = selectedConversationId;
    if (!conversationId) {
      const created = await createConversation();
      if (!created) return;
      conversationId = created.id;
    }

    const now = new Date().toISOString();
    const localUser: PolarisMessage = {
      id: `local-user-${crypto.randomUUID()}`,
      conversation_id: conversationId,
      role: "user",
      content,
      created_at: now,
      status: "completed"
    };
    const localAssistantId = `local-assistant-${crypto.randomUUID()}`;
    const localAssistant: PolarisMessage = {
      id: localAssistantId,
      conversation_id: conversationId,
      role: "assistant",
      content: "",
      created_at: now,
      status: "streaming"
    };

    setMessages((current) => [...current, localUser, localAssistant]);
    setComposer("");
    setStreaming(true);
    setPolarisState("THINKING");
    const controller = new AbortController();
    streamController.current = controller;

    try {
      await streamChat(
        conversationId,
        content,
        {
          onDelta: (delta) => {
            setPolarisState("SPEAKING");
            setMessages((current) =>
              current.map((message) =>
                message.id === localAssistantId
                  ? { ...message, content: message.content + delta, status: "streaming" }
                  : message
              )
            );
          },
          onToolStarted: (name) => {
            setActiveTool(name);
            setPolarisState("EXECUTING");
          },
          onToolCompleted: () => {
            setActiveTool(null);
            setPolarisState("THINKING");
          },
          onDone: () => {
            setMessages((current) =>
              current.map((message) =>
                message.id === localAssistantId ? { ...message, status: "completed" } : message
              )
            );
          },
          onError: (streamError) => {
            setError(streamError.message);
            setMessages((current) =>
              current.map((message) =>
                message.id === localAssistantId ? { ...message, status: "failed" } : message
              )
            );
          }
        },
        controller.signal
      );
      setPolarisState("SUCCESS");
      window.setTimeout(() => setPolarisState("IDLE"), 900);
      setConversations(await api.listConversations());
    } catch (cause) {
      if ((cause as Error).name !== "AbortError") {
        setError(toUserMessage(cause));
        setMessages((current) =>
          current.map((message) =>
            message.id === localAssistantId ? { ...message, status: "failed" } : message
          )
        );
        setPolarisState("ERROR");
      }
    } finally {
      setStreaming(false);
      setActiveTool(null);
      streamController.current = null;
    }
  }

  function stopGeneration(): void {
    streamController.current?.abort();
    streamController.current = null;
    setStreaming(false);
    setActiveTool(null);
    setMessages((current) =>
      current.map((message) =>
        message.status === "streaming" ? { ...message, status: "cancelled" } : message
      )
    );
    setPolarisState("IDLE");
    setNotice("Generación detenida.");
  }

  async function saveMemory(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const content = memoryDraft.trim();
    if (!content) return;
    try {
      const memory = await api.createMemory({ content, category: memoryCategory, importance: 3 });
      setMemories((current) => [memory, ...current]);
      setMemoryDraft("");
      setNotice("Memoria guardada.");
    } catch (cause) {
      setError(toUserMessage(cause));
    }
  }

  async function deleteMemory(id: string): Promise<void> {
    if (!window.confirm("¿Eliminar esta memoria? Esta acción no se puede deshacer desde el cliente.")) return;
    try {
      await api.deleteMemory(id);
      setMemories((current) => current.filter((memory) => memory.id !== id));
      setNotice("Memoria eliminada.");
    } catch (cause) {
      setError(toUserMessage(cause));
    }
  }

  function searchMemories(query: string): void {
    setMemoryQuery(query);
  }

  useEffect(() => {
    let cancelled = false;
    if (!session) return () => undefined;
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const next = await api.listMemories(memoryQuery);
          if (!cancelled) setMemories(next);
        } catch (cause) {
          if (!cancelled) setError(toUserMessage(cause));
        }
      })();
    }, memoryQuery ? 220 : 0);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [memoryQuery, session]);

  async function deleteSelectedConversation(): Promise<void> {
    if (!selectedConversation || !window.confirm("¿Eliminar esta conversación y su historial?")) return;
    try {
      await api.deleteConversation(selectedConversation.id);
      setConversations((current) => current.filter((item) => item.id !== selectedConversation.id));
      setSelectedConversationId(null);
      setMessages([]);
      setScreen("history");
      setNotice("Conversación eliminada.");
    } catch (cause) {
      setError(toUserMessage(cause));
    }
  }

  async function updateTheme(theme: Preferences["theme"]): Promise<void> {
    try {
      const updated = await api.updatePreferences({ theme });
      setPreferences(updated);
      setNotice("Preferencias sincronizadas.");
    } catch (cause) {
      setError(toUserMessage(cause));
    }
  }

  async function logout(): Promise<void> {
    streamController.current?.abort();
    await supabase.auth.signOut();
    await clearSecureSession().catch(() => undefined);
    setScreen("home");
    setNotice(null);
    setError(null);
  }

  if (!ready) {
    return (
      <main className="boot-screen" aria-label="Iniciando Polaris">
        <PolarisMark />
        <p>Iniciando una sesión segura…</p>
      </main>
    );
  }

  if (!session) {
    return <AuthScreen onSession={setSession} />;
  }

  return (
    <main className="desktop-shell">
      <aside className="sidebar">
        <PolarisMark />
        <div className="identity-card">
          <span className={`connection-dot ${online ? "online" : "offline"}`} aria-hidden="true" />
          <div>
            <strong>{stateLabels[polarisState]}</strong>
            <small>{activeTool ? `Herramienta: ${activeTool}` : online ? "Núcleo conectado" : "Sin red"}</small>
          </div>
        </div>
        <nav aria-label="Navegación principal">
          <NavigationItem active={screen === "home"} label="Inicio" onClick={() => setScreen("home")} icon="✦" />
          <NavigationItem active={screen === "chat"} label="Conversar" onClick={() => setScreen("chat")} icon="◌" />
          <NavigationItem active={screen === "history"} label="Historial" onClick={() => setScreen("history")} icon="◫" />
          <NavigationItem active={screen === "memories"} label="Memorias" onClick={() => setScreen("memories")} icon="◇" />
          <NavigationItem active={screen === "devices"} label="Dispositivos" onClick={() => setScreen("devices")} icon="⌘" />
        </nav>
        <div className="sidebar-spacer" />
        <nav aria-label="Cuenta">
          <NavigationItem active={screen === "profile"} label="Perfil" onClick={() => setScreen("profile")} icon="○" />
          <NavigationItem active={screen === "settings"} label="Ajustes" onClick={() => setScreen("settings")} icon="⚙" />
        </nav>
        <div className="account-row">
          <span className="avatar">{(session.user.email ?? "?").slice(0, 1).toUpperCase()}</span>
          <div className="account-copy">
            <strong>{session.user.email ?? "Cuenta Polaris"}</strong>
            <button type="button" onClick={() => void logout()}>Cerrar sesión</button>
          </div>
        </div>
      </aside>

      <section className="content">
        {(error || notice || configurationIssues.length > 0) && (
          <div className="notifications" aria-live="polite">
            {configurationIssues.map((issue) => <p className="notice warning" key={issue}>{issue}</p>)}
            {error && <p className="notice error">{error}<button type="button" onClick={() => setError(null)}>Cerrar</button></p>}
            {notice && <p className="notice success">{notice}<button type="button" onClick={() => setNotice(null)}>Cerrar</button></p>}
          </div>
        )}

        {screen === "home" && (
          <Home
            onStart={() => setScreen("chat")}
            onMemory={() => setScreen("memories")}
            conversations={conversations}
            memories={memories}
            devices={devices}
            loading={loadingWorkspace}
            polarisState={polarisState}
          />
        )}
        {screen === "chat" && (
          <Chat
            conversations={conversations}
            selectedConversationId={selectedConversationId}
            messages={messages}
            selectedConversation={selectedConversation}
            loadingMessages={loadingMessages}
            composer={composer}
            streaming={streaming}
            onComposerChange={setComposer}
            onSend={() => void sendMessage()}
            onStop={stopGeneration}
            onNew={() => void createConversation()}
            onSelect={(id) => void openConversation(id)}
            onDelete={deleteSelectedConversation}
            onRetry={() => {
              const lastUser = [...messages].reverse().find((message) => message.role === "user");
              if (lastUser) void sendMessage(lastUser.content);
            }}
          />
        )}
        {screen === "history" && (
          <History
            conversations={conversations}
            onOpen={(id) => void openConversation(id)}
            onNew={() => void createConversation()}
          />
        )}
        {screen === "memories" && (
          <Memories
            memories={memories}
            draft={memoryDraft}
            category={memoryCategory}
            query={memoryQuery}
            onDraftChange={setMemoryDraft}
            onCategoryChange={setMemoryCategory}
            onSearch={(value) => void searchMemories(value)}
            onSave={(event) => void saveMemory(event)}
            onDelete={(id) => void deleteMemory(id)}
          />
        )}
        {screen === "profile" && (
          <Profile
            profile={profile}
            email={session.user.email ?? ""}
            onSaved={(next) => setProfile(next)}
          />
        )}
        {screen === "settings" && (
          <Settings preferences={preferences} onTheme={(theme) => void updateTheme(theme)} />
        )}
        {screen === "devices" && <Devices devices={devices} onRefresh={() => {
          void refreshWorkspace();
        }} />}
      </section>
    </main>
  );
}

function NavigationItem({
  active,
  label,
  onClick,
  icon
}: {
  active: boolean;
  label: string;
  onClick(): void;
  icon: string;
}) {
  return (
    <button type="button" className={`nav-item ${active ? "active" : ""}`} onClick={onClick}>
      <span aria-hidden="true">{icon}</span>{label}
    </button>
  );
}

function PolarisMascot3D({ state }: { state: PolarisState }) {
  return (
    <div className={`polaris-mascot-stage mascot-state-${state.toLowerCase()}`} aria-label={`Mascota Polaris: ${stateLabels[state]}`}>
      <div className="polaris-mascot-aura" />
      <div className={`polaris-mascot state-${state.toLowerCase()}`} aria-hidden="true">
        <div className="mascot-antenna"><span /></div>
        <div className="mascot-head">
          <div className="mascot-screen">
            <i />
            <i />
          </div>
          <div className="mascot-smile" />
        </div>
        <div className="mascot-neck" />
        <div className="mascot-body">
          <div className="mascot-core" />
          <span className="mascot-core-dot" />
        </div>
        <div className="mascot-arm left" />
        <div className="mascot-arm right" />
      </div>
    </div>
  );
}

function Home({
  onStart,
  onMemory,
  conversations,
  memories,
  devices,
  loading,
  polarisState
}: {
  onStart(): void;
  onMemory(): void;
  conversations: Conversation[];
  memories: Memory[];
  devices: Device[];
  loading: boolean;
  polarisState: PolarisState;
}) {
  return (
    <div className="page home-page">
      <header className="page-header">
        <PolarisMascot3D state={polarisState} />
        <span className="eyebrow">ASISTENTE PERSONAL · 0.1.0</span>
        <h1>Una sola brújula para tu mundo digital.</h1>
        <p>Polaris conserva la misma identidad, contexto y memoria donde sea que lo abras.</p>
        <div className="hero-actions">
          <button className="button primary" type="button" onClick={onStart}>Iniciar conversación <span>→</span></button>
          <button className="button secondary" type="button" onClick={onMemory}>Explorar memorias</button>
          <small className="shortcut-note">Ctrl/Cmd + K abre Conversar · Ctrl/Cmd + 1–7 cambia de sección.</small>
        </div>
      </header>
      <div className="metric-grid" aria-label="Resumen de Polaris">
        <Metric label="Conversaciones" value={loading ? "…" : String(conversations.length)} detail="Historial privado" />
        <Metric label="Memorias" value={loading ? "…" : String(memories.length)} detail="Controladas por ti" />
        <Metric label="Dispositivos" value={loading ? "…" : String(devices.length)} detail="Identidad compartida" />
      </div>
      <section className="capability-panel">
        <div>
          <span className="eyebrow">NÚCLEO ACTIVO</span>
          <h2>Claro sobre lo que puede hacer.</h2>
          <p>Chat con streaming, historial, memoria y sincronización están disponibles cuando el API y tus credenciales están configurados.</p>
        </div>
        <ul>
          <li><span>✓</span> Chat y streaming</li>
          <li><span>✓</span> Memoria controlable</li>
          <li><span>✓</span> Sesión segura en Windows</li>
          <li className="muted"><span>○</span> Voz · Próximamente</li>
          <li className="muted"><span>○</span> Visión · Próximamente</li>
        </ul>
      </section>
    </div>
  );
}

function Metric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <article className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </article>
  );
}

function Chat({
  conversations,
  selectedConversationId,
  messages,
  selectedConversation,
  loadingMessages,
  composer,
  streaming,
  onComposerChange,
  onSend,
  onStop,
  onNew,
  onSelect,
  onDelete,
  onRetry
}: {
  conversations: Conversation[];
  selectedConversationId: string | null;
  messages: PolarisMessage[];
  selectedConversation: Conversation | null;
  loadingMessages: boolean;
  composer: string;
  streaming: boolean;
  onComposerChange(value: string): void;
  onSend(): void;
  onStop(): void;
  onNew(): void;
  onSelect(id: string): void;
  onDelete(): void;
  onRetry(): void;
}) {
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const messagePaneRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const element = messagePaneRef.current;
      if (!element) return;
      const distanceFromBottom = element.scrollHeight - element.scrollTop - element.clientHeight;
      if (distanceFromBottom < 180) {
        element.scrollTo({ top: element.scrollHeight, behavior: "auto" });
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, [messages]);

  function keyboardSubmit(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      onSend();
    }
  }

  return (
    <div className="chat-layout">
      <aside className="conversation-rail">
        <div className="rail-heading">
          <div><span className="eyebrow">ESPACIO</span><h2>Conversaciones</h2></div>
          <button type="button" className="icon-button" aria-label="Nueva conversación" onClick={onNew}>+</button>
        </div>
        <div className="conversation-list">
          {conversations.length === 0 && <p className="empty-rail">Aún no hay conversaciones.</p>}
          {conversations.map((conversation) => (
            <button
              className={`conversation-item ${conversation.id === selectedConversationId ? "selected" : ""}`}
              key={conversation.id}
              type="button"
              onClick={() => onSelect(conversation.id)}
            >
              <strong>{conversation.title || "Sin título"}</strong>
              <small>{formatDate(conversation.updated_at)}</small>
            </button>
          ))}
        </div>
      </aside>
      <section className="chat-panel">
        <header className="chat-header">
          <div>
            <span className="eyebrow">CONVERSACIÓN</span>
            <h1>{selectedConversation?.title || "Nueva conversación"}</h1>
          </div>
          <button type="button" className="text-button danger" onClick={onDelete} disabled={!selectedConversation}>
            Eliminar
          </button>
        </header>
        <div className="message-pane" ref={messagePaneRef} aria-live="polite">
          {loadingMessages && <p className="center-status">Cargando historial…</p>}
          {!loadingMessages && messages.length === 0 && (
            <div className="empty-chat">
              <PolarisMark compact />
              <h2>¿Hacia dónde vamos?</h2>
              <p>Escribe una idea, una pregunta o una meta. Polaris mostrará con honestidad cualquier límite real.</p>
              <button type="button" className="suggestion" onClick={() => onComposerChange("Hola Polaris.")}>Hola Polaris.</button>
              <button type="button" className="suggestion" onClick={() => onComposerChange("Recuerda que Polaris es mi proyecto.")}>Recuerda que Polaris es mi proyecto.</button>
            </div>
          )}
          {messages.map((message) => (
            <article className={`message ${message.role} ${message.status ?? ""}`} key={message.id}>
              <div className="message-avatar">{message.role === "user" ? "TÚ" : "P"}</div>
              <div className="message-body">
                <div className="message-meta"><strong>{message.role === "user" ? "Tú" : "Polaris"}</strong><time>{formatDate(message.created_at)}</time></div>
                {message.content ? (
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
                ) : message.status === "streaming" ? (
                  <span className="typing" aria-label="Polaris está escribiendo"><i /><i /><i /></span>
                ) : message.status === "failed" ? (
                  <p className="failed-copy">Respuesta no disponible. Revisa el estado de conexión o proveedor y vuelve a intentar.</p>
                ) : message.status === "cancelled" ? (
                  <p className="failed-copy">Generación detenida por ti.</p>
                ) : null}
                {message.role === "assistant" && message.content && (
                  <button type="button" className="copy-button" onClick={() => {
                    void navigator.clipboard.writeText(message.content).catch(() => undefined);
                  }}>Copiar</button>
                )}
              </div>
            </article>
          ))}
        </div>
        <div className="composer-wrap">
          <textarea
            ref={inputRef}
            aria-label="Mensaje para Polaris"
            value={composer}
            onChange={(event) => onComposerChange(event.target.value)}
            onKeyDown={keyboardSubmit}
            placeholder="Escribe a Polaris…"
            rows={3}
            disabled={streaming}
          />
          <div className="composer-footer">
            <span>Enter para enviar · Shift + Enter para nueva línea</span>
            {streaming ? (
              <button type="button" className="button stop" onClick={onStop}>Detener</button>
            ) : (
              <button type="button" className="button primary" onClick={onSend} disabled={!composer.trim()}>Enviar <span>↑</span></button>
            )}
          </div>
        </div>
        {messages.some((message) => message.status === "failed") && (
          <button type="button" className="retry-button" onClick={onRetry}>Reintentar el último mensaje</button>
        )}
      </section>
    </div>
  );
}

function History({
  conversations,
  onOpen,
  onNew
}: {
  conversations: Conversation[];
  onOpen(id: string): void;
  onNew(): void;
}) {
  return (
    <div className="page">
      <header className="section-header">
        <div><span className="eyebrow">TRAYECTORIA</span><h1>Historial</h1><p>Solo tú puedes acceder a tus conversaciones.</p></div>
        <button type="button" className="button primary" onClick={onNew}>Nueva conversación</button>
      </header>
      <div className="history-list">
        {conversations.length === 0 ? <EmptyState title="Todavía no hay historial" detail="Tus conversaciones aparecerán aquí cuando inicies una." /> : conversations.map((conversation) => (
          <button type="button" className="history-row" key={conversation.id} onClick={() => onOpen(conversation.id)}>
            <span className="history-star">✦</span>
            <span><strong>{conversation.title || "Sin título"}</strong><small>Actualizada {formatDate(conversation.updated_at)}</small></span>
            <span aria-hidden="true">→</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function Memories({
  memories,
  draft,
  category,
  query,
  onDraftChange,
  onCategoryChange,
  onSearch,
  onSave,
  onDelete
}: {
  memories: Memory[];
  draft: string;
  category: MemoryCategory;
  query: string;
  onDraftChange(value: string): void;
  onCategoryChange(value: MemoryCategory): void;
  onSearch(value: string): void;
  onSave(event: FormEvent<HTMLFormElement>): void;
  onDelete(id: string): void;
}) {
  return (
    <div className="page">
      <header className="section-header">
        <div><span className="eyebrow">MEMORIA EXPLÍCITA</span><h1>Lo que Polaris recuerda</h1><p>La memoria no es una caja negra: puedes verla y eliminarla cuando quieras.</p></div>
      </header>
      <div className="memory-layout">
        <form className="memory-form" onSubmit={onSave}>
          <h2>Guardar un recuerdo</h2>
          <label htmlFor="memory-content">Información que deseas conservar</label>
          <textarea id="memory-content" value={draft} onChange={(event) => onDraftChange(event.target.value)} placeholder="Ej.: Polaris es mi proyecto principal." rows={5} />
          <label htmlFor="memory-category">Categoría</label>
          <select id="memory-category" value={category} onChange={(event) => onCategoryChange(event.target.value as MemoryCategory)}>
            {categories.map((item) => <option value={item} key={item}>{displayCategory(item)}</option>)}
          </select>
          <button className="button primary" type="submit" disabled={!draft.trim()}>Guardar memoria</button>
        </form>
        <section className="memory-library">
          <div className="library-heading">
            <div><h2>Biblioteca</h2><span>{memories.length} resultado{memories.length === 1 ? "" : "s"}</span></div>
            <label className="search">
              <span className="sr-only">Buscar memorias</span>
              <input value={query} onChange={(event) => onSearch(event.target.value)} placeholder="Buscar memoria…" />
            </label>
          </div>
          <div className="memory-list">
            {memories.length === 0 ? <EmptyState title="No hay memorias todavía" detail="Polaris solo guarda lo que tú decides conservar." /> : memories.map((memory) => (
              <article className="memory-card" key={memory.id}>
                <div><span className="tag">{displayCategory(memory.category)}</span><time>{formatDate(memory.updated_at)}</time></div>
                <p>{memory.content}</p>
                <footer><small>Importancia {memory.importance}/5</small><button type="button" className="text-button danger" onClick={() => onDelete(memory.id)}>Eliminar</button></footer>
              </article>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function Profile({
  profile,
  email,
  onSaved
}: {
  profile: PolarisProfile | null;
  email: string;
  onSaved(next: PolarisProfile): void;
}) {
  const [name, setName] = useState(profile?.display_name ?? "");
  const [timezone, setTimezone] = useState(profile?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone);
  const [language, setLanguage] = useState<PolarisProfile["language"]>(profile?.language ?? "es");
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (profile) {
      setName(profile.display_name);
      setTimezone(profile.timezone);
      setLanguage(profile.language);
      setAvatarUrl(profile.avatar_url ?? "");
    }
  }, [profile]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const next = await api.updateProfile({
        display_name: name.trim(),
        timezone: timezone.trim(),
        language,
        avatar_url: avatarUrl.trim() || null
      });
      onSaved(next);
      setNotice("Perfil sincronizado con tu cuenta Polaris.");
    } catch (cause) {
      setError(toUserMessage(cause));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page narrow">
      <header className="section-header">
        <div>
          <span className="eyebrow">IDENTIDAD</span>
          <h1>Perfil</h1>
          <p>Un solo nombre y una sola configuración de identidad para Web, Android y PC.</p>
        </div>
      </header>
      <form className="profile-card profile-form" onSubmit={(event) => void save(event)}>
        <div className="profile-summary">
          <span className="profile-avatar">{(name || email || "?").slice(0, 1).toUpperCase()}</span>
          <div><h2>{name || "Usuario Polaris"}</h2><p>{email}</p></div>
        </div>
        <label>Nombre para Polaris<input value={name} onChange={(event) => setName(event.target.value)} minLength={1} maxLength={120} required /></label>
        <label>Idioma
          <select value={language} onChange={(event) => setLanguage(event.target.value as PolarisProfile["language"])}>
            <option value="es">Español</option>
            <option value="en">English</option>
          </select>
        </label>
        <label>Zona horaria<input value={timezone} onChange={(event) => setTimezone(event.target.value)} minLength={1} maxLength={120} required /></label>
        <label>Avatar (URL)<input type="url" value={avatarUrl} onChange={(event) => setAvatarUrl(event.target.value)} maxLength={2048} placeholder="https://…" /></label>
        {error && <p className="form-error">{error}</p>}
        {notice && <p className="form-success">{notice}</p>}
        <button className="button primary" type="submit" disabled={busy || !name.trim() || !timezone.trim()}>{busy ? "Guardando…" : "Guardar perfil"}</button>
      </form>
    </div>
  );
}

function Settings({
  preferences,
  onTheme
}: {
  preferences: Preferences | null;
  onTheme(theme: Preferences["theme"]): void;
}) {
  const [systemInfo, setSystemInfo] = useState<DesktopSystemInfo | null>(null);
  const [nativeError, setNativeError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void desktopNative.systemInfo()
      .then((info) => {
        if (active) setSystemInfo(info);
      })
      .catch((error: unknown) => {
        if (active) setNativeError(error instanceof Error ? error.message : "El bridge nativo no está disponible.");
      });
    return () => {
      active = false;
    };
  }, []);

  async function openRepository(): Promise<void> {
    setNativeError(null);
    try {
      await desktopNative.openUrl("https://github.com/profetasdelcodigo/Polaris");
    } catch (error) {
      setNativeError(error instanceof Error ? error.message : "No se pudo abrir el enlace.");
    }
  }

  async function revealCurrentDirectory(): Promise<void> {
    setNativeError(null);
    const path = systemInfo?.current_dir;
    if (!path) {
      setNativeError("No se conoce la carpeta de trabajo del proceso.");
      return;
    }
    try {
      await desktopNative.revealPath(path);
    } catch (error) {
      setNativeError(error instanceof Error ? error.message : "No se pudo abrir el explorador.");
    }
  }

  return (
    <div className="page narrow">
      <header className="section-header"><div><span className="eyebrow">CONTROL</span><h1>Ajustes</h1><p>Preferencias sincronizadas con tu identidad Polaris.</p></div></header>
      <section className="settings-card">
        <div><h2>Tema</h2><p>El escritorio prioriza el modo oscuro; puedes guardar tu preferencia.</p></div>
        <div className="segment-control" role="group" aria-label="Tema">
          {(["dark", "light", "system"] as const).map((theme) => (
            <button type="button" className={preferences?.theme === theme ? "selected" : ""} key={theme} onClick={() => onTheme(theme)}>
              {theme === "dark" ? "Oscuro" : theme === "light" ? "Claro" : "Sistema"}
            </button>
          ))}
        </div>
      </section>
      <section className="info-card">
        <h2>Privacidad</h2>
        <p>Las sesiones de escritorio se almacenan en el administrador de credenciales de Windows. Las claves privadas de IA nunca viven en este cliente.</p>
      </section>
      <section className="info-card">
        <h2>Bridge nativo</h2>
        <p>
          Polaris ya puede comunicarse con acciones locales verificables del programa de PC.
          {systemInfo ? ` Sistema: ${systemInfo.os} · ${systemInfo.arch} · ${systemInfo.family}.` : " Detectando el entorno…"}
        </p>
        <div className="button-row">
          <button type="button" className="button secondary" onClick={() => void openRepository()}>Abrir repositorio</button>
          <button type="button" className="button secondary" onClick={() => void revealCurrentDirectory()} disabled={!systemInfo?.current_dir}>Mostrar carpeta</button>
        </div>
        {nativeError && <p className="form-error">{nativeError}</p>}
      </section>
    </div>
  );
}

function Devices({ devices, onRefresh }: { devices: Device[]; onRefresh(): void }) {
  return (
    <div className="page">
      <header className="section-header">
        <div><span className="eyebrow">PRESENCIA</span><h1>Dispositivos</h1><p>Polaris registra dispositivos reales asociados a tu cuenta.</p></div>
        <button type="button" className="button secondary" onClick={onRefresh}>Actualizar</button>
      </header>
      <div className="device-grid">
        {devices.length === 0 ? <EmptyState title="Aún no hay dispositivos" detail="Este escritorio se registrará al conectar Polaris API." /> : devices.map((device) => (
          <article className="device-card" key={device.id}>
            <span className="device-icon">{device.type === "DESKTOP" ? "▣" : device.type === "ANDROID" ? "▥" : "◫"}</span>
            <div><span className="tag">{device.type}</span><h2>{device.name}</h2><p>{device.platform}</p><small>Última actividad: {formatDate(device.last_seen)}</small></div>
            <span className={`device-status ${device.status.toLowerCase()}`}>{device.status}</span>
          </article>
        ))}
      </div>
    </div>
  );
}

function EmptyState({ title, detail }: { title: string; detail: string }) {
  return <div className="empty-state"><span>✦</span><h2>{title}</h2><p>{detail}</p></div>;
}

function AuthScreen({ onSession }: { onSession(session: Session | null): void }) {
  const [mode, setMode] = useState<AuthMode>("signIn");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      if (mode === "signIn") {
        const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password });
        if (authError) throw authError;
        onSession(data.session);
      } else if (mode === "signUp") {
        const { data, error: authError } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { display_name: displayName.trim() || undefined } }
        });
        if (authError) throw authError;
        onSession(data.session);
        setMessage(data.session ? "Cuenta creada." : "Cuenta creada. Revisa tu correo para confirmar el acceso.");
      } else {
        const { error: authError } = await supabase.auth.resetPasswordForEmail(email);
        if (authError) throw authError;
        setMessage("Si existe una cuenta para ese correo, Supabase enviará instrucciones de recuperación.");
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No fue posible completar la autenticación.");
    } finally {
      setBusy(false);
    }
  }

  const labels: Record<AuthMode, { title: string; detail: string; submit: string }> = {
    signIn: { title: "Tu Polaris, en cualquier lugar.", detail: "Inicia sesión para recuperar tu identidad, conversaciones y memoria.", submit: "Entrar a Polaris" },
    signUp: { title: "Empieza con una sola identidad.", detail: "Crea una cuenta segura que podrás usar en web, Android y escritorio.", submit: "Crear cuenta" },
    recover: { title: "Recupera tu acceso.", detail: "Te enviaremos el flujo configurado en Supabase sin revelar si existe una cuenta.", submit: "Enviar recuperación" }
  };

  return (
    <main className="auth-shell">
      <section className="auth-visual">
        <PolarisMark />
        <div className="constellation"><span /><span /><span /><span /><span /></div>
        <div><span className="eyebrow">ORIENTACIÓN · CLARIDAD · CONTINUIDAD</span><h1>Un asistente.<br />Una memoria.<br />Un norte.</h1><p>Polaris conecta tus plataformas sin dividir tu identidad.</p></div>
      </section>
      <section className="auth-panel">
        <div className="auth-card">
          <div className="auth-tabs" role="tablist">
            <button type="button" className={mode === "signIn" ? "selected" : ""} onClick={() => setMode("signIn")}>Entrar</button>
            <button type="button" className={mode === "signUp" ? "selected" : ""} onClick={() => setMode("signUp")}>Crear cuenta</button>
          </div>
          <span className="eyebrow">ACCESO SEGURO</span>
          <h2>{labels[mode].title}</h2><p>{labels[mode].detail}</p>
          <form onSubmit={(event) => void submit(event)}>
            {mode === "signUp" && <label>Nombre para Polaris<input autoComplete="name" value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="Tu nombre" /></label>}
            <label>Correo electrónico<input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="tu@correo.com" required /></label>
            {mode !== "recover" && <label>Contraseña<input type="password" autoComplete={mode === "signIn" ? "current-password" : "new-password"} value={password} onChange={(event) => setPassword(event.target.value)} minLength={8} required placeholder="Mínimo 8 caracteres" /></label>}
            {error && <p className="form-error">{error}</p>}
            {message && <p className="form-success">{message}</p>}
            <button className="button primary wide" type="submit" disabled={busy}>{busy ? "Procesando…" : labels[mode].submit}</button>
          </form>
          <button type="button" className="text-button" onClick={() => setMode(mode === "recover" ? "signIn" : "recover")}>{mode === "recover" ? "Volver a entrar" : "Olvidé mi contraseña"}</button>
        </div>
      </section>
    </main>
  );
}

function toUserMessage(cause: unknown): string {
  if (cause instanceof ApiError) return cause.message;
  if (cause instanceof Error) return cause.message;
  return "Ocurrió un error inesperado. No se completó ninguna acción.";
}

export default App;
