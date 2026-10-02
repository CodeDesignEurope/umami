import type { HeatmapPoint, HeatmapSnapshot } from '@/queries/sql';

export const SNAPSHOT_VIEWPORT_HASH_KEY = 'umami-viewport';

export interface ViewportMetric {
  viewportW: number;
  viewportH: number;
  pageW: number;
  pageH: number;
  count: number;
}

export interface ViewportOption extends ViewportMetric {
  key: string;
}

export interface SnapshotFrame {
  url: string;
  width: number;
  height: number;
}

export function getViewportKey(viewportW: number, viewportH: number) {
  return `${viewportW}x${viewportH}`;
}

/**
 * Lists the real browser windows (width x height) found in the metrics, most used first.
 * Page size is the largest one recorded for that window.
 */
export function getViewportOptions(metrics: ViewportMetric[]): ViewportOption[] {
  const options = new Map<string, ViewportOption>();

  for (const metric of metrics) {
    if (!(metric.viewportW > 0) || !(metric.viewportH > 0)) {
      continue;
    }

    const key = getViewportKey(metric.viewportW, metric.viewportH);
    const existing = options.get(key);

    if (existing) {
      existing.count += metric.count;
      existing.pageW = Math.max(existing.pageW, metric.pageW);
      existing.pageH = Math.max(existing.pageH, metric.pageH);
    } else {
      options.set(key, { ...metric, key });
    }
  }

  return Array.from(options.values()).sort(
    (a, b) => b.count - a.count || b.viewportW - a.viewportW || b.viewportH - a.viewportH,
  );
}

/**
 * Keeps the clicks recorded in the given window, merging the ones on the same page position.
 */
export function getViewportPoints(
  points: HeatmapPoint[],
  viewport: Pick<ViewportMetric, 'viewportW' | 'viewportH'>,
) {
  const grouped = new Map<string, HeatmapPoint>();

  for (const point of points) {
    if (point.viewportW !== viewport.viewportW || point.viewportH !== viewport.viewportH) {
      continue;
    }

    const pageX = Math.round(point.pageX);
    const pageY = Math.round(point.pageY);
    const key = `${pageX}:${pageY}`;
    const existing = grouped.get(key);

    if (existing) {
      existing.count += point.count;
      existing.pageW = Math.max(existing.pageW, point.pageW);
      existing.pageH = Math.max(existing.pageH, point.pageH);
    } else {
      grouped.set(key, {
        ...point,
        x: Math.round(point.x),
        y: Math.round(point.y),
        pageX,
        pageY,
      });
    }
  }

  return Array.from(grouped.values());
}

/**
 * Returns the snapshot as seen by the selected window, keeping the url chosen by the server.
 */
export function getSnapshotForViewport(
  snapshot: HeatmapSnapshot,
  viewport: ViewportMetric,
): HeatmapSnapshot {
  const { viewportW, viewportH, pageW, pageH } = viewport;

  return {
    ...snapshot,
    id: `${snapshot.id}:${getViewportKey(viewportW, viewportH)}`,
    viewportW,
    viewportH,
    pageW,
    pageH,
  };
}

export function getSnapshotFrameHeight({
  pageH,
  viewportH,
}: Pick<HeatmapSnapshot, 'pageH' | 'viewportH'>) {
  // Use the recorded viewport height for near-single-screen pages so `100vh` matches the visitor's screen.
  if (pageH <= viewportH * 1.25) {
    return viewportH;
  }

  return pageH;
}

/**
 * `pageW` excludes the scrollbar, so it is the real layout width when available.
 */
export function getLayoutWidth({ pageW, viewportW }: Pick<ViewportMetric, 'pageW' | 'viewportW'>) {
  return Math.max(1, pageW > 0 && pageW <= viewportW ? pageW : viewportW);
}

/**
 * The preview page can read the visitor's window size from the URL fragment
 * (`#umami-viewport=<width>x<height>`, CSS pixels) to rebuild viewport based layouts.
 */
export function buildSnapshotUrl(url: string, viewportW: number, viewportH: number) {
  const [base] = url.split('#');

  return `${base}#${SNAPSHOT_VIEWPORT_HASH_KEY}=${Math.round(viewportW)}x${Math.round(viewportH)}`;
}

/**
 * Describes the preview frame, rendered at the visitor's real layout size (scale 1,
 * the same pixels as the recorded coordinates).
 */
export function getSnapshotFrame(snapshot: HeatmapSnapshot): SnapshotFrame {
  return {
    url: buildSnapshotUrl(snapshot.url, snapshot.viewportW, snapshot.viewportH),
    width: getLayoutWidth(snapshot),
    height: Math.max(1, getSnapshotFrameHeight(snapshot)),
  };
}
