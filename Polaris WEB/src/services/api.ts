import { apiUrl } from './config';

export type ApiProblem = {
  type?: string;
  title?: string;
  status?: number;
  code?: string;
  detail?: string;
  requestId?: string;
};

export class PolarisApiError extends Error {
  public readonly problem: ApiProblem;
  public readonly status: number;

  public constructor(problem: ApiProblem, fallbackStatus: number) {
    super(problem.detail ?? problem.title ?? 'Polaris no pudo completar la solicitud.');
    this.name = 'PolarisApiError';
    this.problem = problem;
    this.status = problem.status ?? fallbackStatus;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

async function parseProblem(response: Response): Promise<ApiProblem> {
  const contentType = response.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    const payload: unknown = await response.json().catch(() => ({}));
    if (isRecord(payload)) {
      const candidate = isRecord(payload.problem) ? payload.problem : payload;
      return {
        type: typeof candidate.type === 'string' ? candidate.type : undefined,
        title: typeof candidate.title === 'string' ? candidate.title : undefined,
        status: typeof candidate.status === 'number' ? candidate.status : response.status,
        code: typeof candidate.code === 'string' ? candidate.code : undefined,
        detail: typeof candidate.detail === 'string'
          ? candidate.detail
          : typeof candidate.message === 'string'
            ? candidate.message
            : undefined,
        requestId: typeof candidate.requestId === 'string' ? candidate.requestId : undefined,
      };
    }
  }

  const text = await response.text().catch(() => '');
  return {
    title: response.statusText || 'Solicitud rechazada',
    detail: text || undefined,
    status: response.status,
  };
}

export async function apiRequest<T>(
  path: string,
  accessToken: string,
  init: RequestInit = {},
): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('authorization', `Bearer ${accessToken}`);
  headers.set('accept', 'application/json');
  headers.set('x-polaris-client', 'web');

  const response = await fetch(apiUrl(path), {
    ...init,
    headers,
  });

  if (!response.ok) {
    throw new PolarisApiError(await parseProblem(response), response.status);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export type SseEvent = {
  event: string;
  data: unknown;
};

type ParsedFrames = {
  events: SseEvent[];
  remainder: string;
};

function parseData(data: string): unknown {
  if (!data) {
    return {};
  }

  try {
    return JSON.parse(data) as unknown;
  } catch {
    return data;
  }
}

export function parseSseFrames(buffer: string): ParsedFrames {
  const events: SseEvent[] = [];
  let cursor = 0;
  const boundary = /\r?\n\r?\n/g;
  let match = boundary.exec(buffer);

  while (match) {
    const frame = buffer.slice(cursor, match.index);
    cursor = match.index + match[0].length;
    const eventLines = frame.split(/\r?\n/);
    let name = 'message';
    const dataLines: string[] = [];

    for (const line of eventLines) {
      if (line.startsWith(':') || line.length === 0) {
        continue;
      }
      const separator = line.indexOf(':');
      const field = separator < 0 ? line : line.slice(0, separator);
      const value = separator < 0 ? '' : line.slice(separator + 1).replace(/^ /, '');
      if (field === 'event') {
        name = value;
      }
      if (field === 'data') {
        dataLines.push(value);
      }
    }

    if (dataLines.length > 0 || name !== 'message') {
      const data = parseData(dataLines.join('\n'));
      const typedData = isRecord(data) && typeof data.type === 'string' ? data.type : undefined;
      events.push({ event: name === 'message' && typedData ? typedData : name, data });
    }

    match = boundary.exec(buffer);
  }

  return { events, remainder: buffer.slice(cursor) };
}

export type ChatStreamRequest = {
  conversationId?: string;
  message: string;
  client: {
    platform: 'WEB';
    timezone?: string;
  };
};

export async function streamChat(
  request: ChatStreamRequest,
  accessToken: string,
  signal: AbortSignal,
  onEvent: (event: SseEvent) => void,
): Promise<void> {
  const response = await fetch(apiUrl('/chat/stream'), {
    method: 'POST',
    signal,
    headers: {
      accept: 'text/event-stream',
      authorization: `Bearer ${accessToken}`,
      'content-type': 'application/json',
      'x-polaris-client': 'web',
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    throw new PolarisApiError(await parseProblem(response), response.status);
  }
  if (!response.body) {
    throw new Error('El servidor no inició un flujo de respuesta.');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let streamError: PolarisApiError | null = null;
  let sawMessageDone = false;

  const emit = (event: SseEvent) => {
    onEvent(event);
    if (event.event === 'message.done') {
      sawMessageDone = true;
    }
    if (event.event === 'error') {
      const data = isRecord(event.data) ? event.data : {};
      streamError = new PolarisApiError(
        {
          detail: typeof data.message === 'string' ? data.message : undefined,
          code: typeof data.code === 'string' ? data.code : undefined,
          status: 502,
          requestId: typeof data.requestId === 'string' ? data.requestId : undefined,
        },
        502,
      );
    }
  };

  try {
    while (true) {
      const { value, done } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });
      const parsed = parseSseFrames(buffer);
      buffer = parsed.remainder;
      parsed.events.forEach(emit);
      if (streamError) throw streamError;
      if (done) {
        break;
      }
    }

    const tail = decoder.decode();
    if (tail) {
      const parsed = parseSseFrames(buffer + tail + '\n\n');
      parsed.events.forEach(emit);
      if (streamError) throw streamError;
    }

    if (!sawMessageDone) {
      throw new PolarisApiError(
        {
          code: 'STREAM_PROTOCOL_ERROR',
          title: 'Flujo incompleto',
          detail: 'El servidor cerró el flujo antes de confirmar la finalización de la respuesta.',
          status: 502,
        },
        502,
      );
    }
  } finally {
    reader.releaseLock();
  }
}
