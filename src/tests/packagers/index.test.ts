import { getPackager } from '../../packagers';

import type EsbuildServerlessPlugin from '../../index';

describe('getPackager()', () => {
  const mockPlugin = {
    log: {
      debug: jest.fn(),
    },
  } as unknown as EsbuildServerlessPlugin;

  it('Returns a Packager instance', async () => {
    const npm = await getPackager.call(mockPlugin, 'npm', {});

    expect(npm).toEqual(expect.any(Object));
  });
});
