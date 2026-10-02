import { describe, expect, it } from 'vitest';
import {
  buildSnapshotUrl,
  getLayoutWidth,
  getSnapshotForViewport,
  getSnapshotFrame,
  getSnapshotFrameHeight,
  getViewportOptions,
  getViewportPoints,
} from './heatmap-preview';

const snapshot = {
  kind: 'iframe' as const,
  id: 'snap',
  url: 'https://example.com/page',
  pageW: 1920,
  pageH: 5000,
  viewportW: 1920,
  viewportH: 1080,
};

const point = {
  x: 10,
  y: 20,
  pageX: 10.4,
  pageY: 520.2,
  pageW: 1512,
  pageH: 4000,
  viewportW: 1512,
  viewportH: 900,
  count: 1,
};

describe('getViewportOptions', () => {
  it('returns an empty list without usable metrics', () => {
    expect(getViewportOptions([])).toEqual([]);
    expect(
      getViewportOptions([{ viewportW: 0, viewportH: 0, pageW: 1, pageH: 1, count: 3 }]),
    ).toEqual([]);
  });

  it('lists real windows by count, keeping width and height apart', () => {
    const options = getViewportOptions([
      { viewportW: 1512, viewportH: 900, pageW: 1497, pageH: 4000, count: 2 },
      { viewportW: 1512, viewportH: 800, pageW: 1497, pageH: 4100, count: 1 },
      { viewportW: 2764, viewportH: 1331, pageW: 2749, pageH: 9000, count: 5 },
      { viewportW: 1512, viewportH: 900, pageW: 1497, pageH: 4200, count: 2 },
    ]);

    expect(options.map(option => [option.key, option.count])).toEqual([
      ['2764x1331', 5],
      ['1512x900', 4],
      ['1512x800', 1],
    ]);
    expect(options[1].pageH).toBe(4200);
  });
});

describe('getViewportPoints', () => {
  it('keeps only the points of the exact window and merges equal positions', () => {
    const result = getViewportPoints(
      [point, { ...point, count: 2 }, { ...point, viewportH: 800 }, { ...point, viewportW: 1920 }],
      { viewportW: 1512, viewportH: 900 },
    );

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ pageX: 10, pageY: 520, count: 3, viewportW: 1512 });
  });
});

describe('getSnapshotForViewport', () => {
  it('applies the window to the snapshot and keeps the url', () => {
    const result = getSnapshotForViewport(snapshot, {
      viewportW: 414,
      viewportH: 800,
      pageW: 414,
      pageH: 4000,
      count: 5,
    });

    expect(result).toMatchObject({
      url: snapshot.url,
      viewportW: 414,
      viewportH: 800,
      pageW: 414,
      pageH: 4000,
    });
    expect(result.id).not.toBe(snapshot.id);
  });
});

describe('getSnapshotFrameHeight', () => {
  it('uses the viewport height for near-single-screen pages', () => {
    expect(getSnapshotFrameHeight({ pageH: 1200, viewportH: 1000 })).toBe(1000);
    expect(getSnapshotFrameHeight({ pageH: 3000, viewportH: 1000 })).toBe(3000);
  });
});

describe('getLayoutWidth', () => {
  it('uses the page width unless missing or larger than the viewport', () => {
    expect(getLayoutWidth({ pageW: 2749, viewportW: 2764 })).toBe(2749);
    expect(getLayoutWidth({ pageW: 0, viewportW: 1920 })).toBe(1920);
    expect(getLayoutWidth({ pageW: 2500, viewportW: 1920 })).toBe(1920);
  });
});

describe('buildSnapshotUrl', () => {
  it('appends the viewport fragment', () => {
    expect(buildSnapshotUrl('https://example.com/a?x=1', 414, 800)).toBe(
      'https://example.com/a?x=1#umami-viewport=414x800',
    );
  });

  it('replaces an existing fragment', () => {
    expect(buildSnapshotUrl('https://example.com/a#section', 1920.4, 1080)).toBe(
      'https://example.com/a#umami-viewport=1920x1080',
    );
  });
});

describe('getSnapshotFrame', () => {
  it('renders at the visitor layout size without scaling', () => {
    const frame = getSnapshotFrame({
      ...snapshot,
      viewportW: 2764,
      viewportH: 1331,
      pageW: 2749,
      pageH: 10000,
    });

    expect(frame).toEqual({
      url: 'https://example.com/page#umami-viewport=2764x1331',
      width: 2749,
      height: 10000,
    });
  });

  it('keeps a single screen page at the viewport height', () => {
    expect(getSnapshotFrame({ ...snapshot, pageH: 1100 }).height).toBe(1080);
  });
});
