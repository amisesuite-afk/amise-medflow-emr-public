import { describe, expect, it } from 'vitest';
import { withPathwayDataLock } from '../pathway-data-lock';

describe('withPathwayDataLock', () => {
  it('runs read-modify-write saves for one patient one after another', async () => {
    let blob: Record<string, string> = {};
    const tick = () => new Promise(r => setTimeout(r, 5));
    const save = (key: string) => withPathwayDataLock('p1', async () => {
      const read = { ...blob };
      await tick();
      blob = { ...read, [key]: 'x' };
    });
    await Promise.all([save('supplements'), save('lifestyle')]);
    expect(Object.keys(blob).sort()).toEqual(['lifestyle', 'supplements']);
  });

  it('carries on after a failed save', async () => {
    const failed = withPathwayDataLock('p2', async () => { throw new Error('boom'); });
    await expect(failed).rejects.toThrow('boom');
    await expect(withPathwayDataLock('p2', async () => 'ok')).resolves.toBe('ok');
  });
});
