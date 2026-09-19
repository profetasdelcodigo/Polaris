import { describe, expect, it } from 'vitest';

import { parseSseFrames } from './api';

describe('parseSseFrames', () => {
  it('parses named JSON events and preserves an incomplete tail', () => {
    const parsed = parseSseFrames(
      'event: message.delta\ndata: {"delta":"Hola"}\n\nevent: message.done\ndata: {"id":"m1"}\n\nevent: err',
    );

    expect(parsed.events).toEqual([
      { event: 'message.delta', data: { delta: 'Hola' } },
      { event: 'message.done', data: { id: 'm1' } },
    ]);
    expect(parsed.remainder).toBe('event: err');
  });

  it('uses a typed payload when a server omits the event line', () => {
    const parsed = parseSseFrames('data: {"type":"tool.started","name":"calculator"}\n\n');

    expect(parsed.events).toEqual([
      { event: 'tool.started', data: { type: 'tool.started', name: 'calculator' } },
    ]);
  });
});
