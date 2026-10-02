'use client';
import {
  Button,
  Column,
  Dialog,
  Grid,
  Heading,
  Icon,
  ListItem,
  Loading,
  Modal,
  Row,
  Select,
  Text,
} from '@umami/react-zen';
import { Laptop, Monitor, Smartphone, Tablet } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ControlledDialog } from '@/components/common/ControlledDialog';
import { IconLabel } from '@/components/common/IconLabel';
import { LoadingPanel } from '@/components/common/LoadingPanel';
import { useHeatmapQuery, useMobile } from '@/components/hooks';
import { ListCheck } from '@/components/icons';
import { formatLongNumber } from '@/lib/format';
import {
  getLayoutWidth,
  getSnapshotForViewport,
  getSnapshotFrame,
  getViewportOptions,
  getViewportPoints,
  type SnapshotFrame,
  type ViewportOption,
} from '@/lib/heatmap-preview';
import type { HeatmapMode, HeatmapPoint, HeatmapResult, HeatmapSnapshot } from '@/queries/sql';
import styles from './Heatmap.module.css';

const SCROLL_BUCKET_SIZE = 10;
interface HeatmapProps {
  websiteId: string;
  urlPath: string;
  onUrlPathChange: (urlPath: string) => void;
  mode: HeatmapMode;
  search: string;
}

export function Heatmap({ websiteId, urlPath, onUrlPathChange, mode, search }: HeatmapProps) {
  const { isPhone } = useMobile();
  const [isPagePickerOpen, setIsPagePickerOpen] = useState(false);
  const {
    data: pagesData,
    error,
    isLoading,
  } = useHeatmapQuery({
    websiteId,
    mode,
  });

  const {
    data: detailData,
    isLoading: isDetailLoading,
    isFetching: isDetailFetching,
  } = useHeatmapQuery(
    {
      websiteId,
      urlPath: urlPath || undefined,
      mode,
    },
    {
      enabled: Boolean(urlPath),
    },
  );

  const pages = pagesData?.pages ?? [];
  const filteredPages = useMemo(() => {
    if (!search) {
      return pages;
    }

    const value = search.toLowerCase();

    return pages.filter(page => page.urlPath.toLowerCase().includes(value));
  }, [pages, search]);
  const selectedPage = filteredPages.find(page => page.urlPath === urlPath) ?? null;
  const points = detailData?.points ?? [];
  const scroll = detailData?.scroll;
  const snapshot = detailData?.snapshot ?? null;
  const detailLoading = Boolean(urlPath) && (isDetailLoading || isDetailFetching);

  useEffect(() => {
    if (isLoading) {
      return;
    }

    if (filteredPages.length === 0) {
      if (urlPath) {
        onUrlPathChange('');
      }
      return;
    }

    if (!urlPath || filteredPages.some(page => page.urlPath === urlPath)) {
      return;
    }

    onUrlPathChange(filteredPages[0].urlPath);
  }, [filteredPages, isLoading, onUrlPathChange, urlPath]);

  if (!isLoading && pages.length === 0) {
    return (
      <LoadingPanel data={pagesData} isLoading={isLoading} error={error} minHeight="900px">
        <EmptyState message="No data available." />
      </LoadingPanel>
    );
  }

  return (
    <LoadingPanel data={pagesData} isLoading={isLoading} error={error} minHeight="900px">
      {isPhone ? (
        <Column gap="4" minHeight="900px">
          <Column gap="2" className={styles.mobilePageSection}>
            <Row
              alignItems="center"
              justifyContent="space-between"
              gap
              className={styles.mobilePageHeader}
            >
              <Text color="muted" className={styles.mobileSectionLabel}>
                Selected page
              </Text>
              <Button variant="outline" onPress={() => setIsPagePickerOpen(true)}>
                <IconLabel icon={<ListCheck />} label="Pages" />
              </Button>
            </Row>
            {selectedPage && (
              <button
                type="button"
                className={styles.mobileSelectedPageButton}
                onClick={() => setIsPagePickerOpen(true)}
              >
                <Row alignItems="center" justifyContent="space-between" gap="3">
                  <Text truncate>{selectedPage.urlPath}</Text>
                  <Text color="muted" className={styles.pageMetric}>
                    {formatLongNumber(selectedPage.sessions)}
                  </Text>
                </Row>
              </button>
            )}
          </Column>

          {urlPath ? (
            mode === 'scroll' ? (
              <ScrollHeatmapView
                urlPath={urlPath}
                scroll={scroll}
                snapshot={snapshot}
                isLoading={detailLoading}
              />
            ) : (
              <ClickHeatmapView
                urlPath={urlPath}
                points={points}
                snapshot={snapshot}
                isLoading={detailLoading}
              />
            )
          ) : (
            <EmptyState />
          )}

          <ControlledDialog>
            <Modal
              isOpen={isPagePickerOpen}
              onOpenChange={isOpen => setIsPagePickerOpen(isOpen)}
              placement="fullscreen"
            >
              <Dialog
                title="Pages"
                style={{
                  width: '100%',
                  height: '100%',
                  maxHeight: '100%',
                  overflowY: 'auto',
                  padding: '24px',
                }}
              >
                {({ close }) => (
                  <PageList
                    pages={filteredPages}
                    selected={urlPath}
                    onSelect={nextUrlPath => {
                      onUrlPathChange(nextUrlPath);
                      setIsPagePickerOpen(false);
                      close();
                    }}
                    mode={mode}
                    hasSearch={Boolean(search)}
                    showHeading={false}
                  />
                )}
              </Dialog>
            </Modal>
          </ControlledDialog>
        </Column>
      ) : (
        <Grid columns="320px 12px 1fr" minHeight="900px" className={styles.layoutGrid}>
          <PageList
            pages={filteredPages}
            selected={urlPath}
            onSelect={onUrlPathChange}
            mode={mode}
            hasSearch={Boolean(search)}
          />
          <div className={styles.railDivider} aria-hidden="true" />
          <Column className={styles.contentColumn} gap>
            {urlPath ? (
              mode === 'scroll' ? (
                <ScrollHeatmapView
                  urlPath={urlPath}
                  scroll={scroll}
                  snapshot={snapshot}
                  isLoading={detailLoading}
                />
              ) : (
                <ClickHeatmapView
                  urlPath={urlPath}
                  points={points}
                  snapshot={snapshot}
                  isLoading={detailLoading}
                />
              )
            ) : (
              <EmptyState />
            )}
          </Column>
        </Grid>
      )}
    </LoadingPanel>
  );
}

function PageList({
  pages,
  selected,
  onSelect,
  mode,
  hasSearch,
  showHeading = true,
}: {
  pages: HeatmapResult['pages'];
  selected: string;
  onSelect: (urlPath: string) => void;
  mode: HeatmapMode;
  hasSearch: boolean;
  showHeading?: boolean;
}) {
  const getPageMetricTitle = (page: HeatmapResult['pages'][number]) => {
    const metricLabel = mode === 'scroll' ? 'scroll events' : 'clicks';

    return `${formatLongNumber(page.sessions)} visitors - ${formatLongNumber(page.count)} ${metricLabel}`;
  };

  return (
    <Column className={styles.pageList} gap="1">
      {showHeading && <Heading size="lg">Pages</Heading>}
      <Column className={styles.pageListItems} gap="2">
        {pages.length === 0 && hasSearch && <Text color="muted">No matching pages</Text>}
        {pages.map(page => (
          <button
            key={page.urlPath}
            type="button"
            onClick={() => onSelect(page.urlPath)}
            title={page.urlPath}
            className={`${styles.pageButton} ${selected === page.urlPath ? styles.pageButtonSelected : ''}`}
          >
            <Row alignItems="center" justifyContent="space-between" gap="2">
              <Text truncate>{page.urlPath}</Text>
              <Text color="muted" className={styles.pageMetric} title={getPageMetricTitle(page)}>
                {formatLongNumber(page.sessions)}
              </Text>
            </Row>
          </button>
        ))}
      </Column>
    </Column>
  );
}

function useSelectedViewport(options: ViewportOption[]) {
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  // Options are sorted by usage, so the first one is the most frequent window.
  const viewport = useMemo(
    () => options.find(option => option.key === selectedKey) ?? options[0] ?? null,
    [options, selectedKey],
  );

  return { viewport, setSelectedKey };
}

function getScrollViewportMetrics(scroll: HeatmapResult['scroll'] | undefined) {
  return (
    scroll?.buckets.map(bucket => ({
      pageW: bucket.pageW,
      pageH: bucket.pageH,
      viewportW: bucket.viewportW,
      viewportH: bucket.viewportH,
      count: bucket.sessions,
    })) ?? []
  );
}

function getSelectedScrollBuckets(
  scroll: HeatmapResult['scroll'] | undefined,
  viewport: ViewportOption | null,
) {
  if (!scroll || !viewport) {
    return [];
  }

  const sessionsByDepth = new Map<number, number>();

  for (const row of scroll.buckets) {
    if (row.viewportW !== viewport.viewportW || row.viewportH !== viewport.viewportH) {
      continue;
    }

    sessionsByDepth.set(row.depth, (sessionsByDepth.get(row.depth) ?? 0) + row.sessions);
  }

  return Array.from(sessionsByDepth.entries())
    .map(([depth, sessions]) => ({ depth, sessions }))
    .sort((a, b) => a.depth - b.depth);
}

function useCanvasFit(renderWidth: number, renderHeight: number) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [availableWidth, setAvailableWidth] = useState(0);

  useEffect(() => {
    const updateAvailableSize = () => {
      const width = wrapperRef.current?.clientWidth ?? 0;

      setAvailableWidth(current => (current === width ? current : width));
    };

    updateAvailableSize();

    const resizeObserver =
      typeof ResizeObserver !== 'undefined' ? new ResizeObserver(updateAvailableSize) : null;

    if (wrapperRef.current && resizeObserver) {
      resizeObserver.observe(wrapperRef.current);
    }

    window.addEventListener('resize', updateAvailableSize);

    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener('resize', updateAvailableSize);
    };
  }, []);

  const safeWidth = Math.max(1, renderWidth);
  const safeHeight = Math.max(1, renderHeight);
  const scale = availableWidth ? Math.min(1, availableWidth / safeWidth) : 1;

  return {
    wrapperRef,
    scale,
    width: Math.max(1, Math.round(safeWidth * scale)),
    height: Math.max(1, Math.round(safeHeight * scale)),
  };
}

function ScreenWidthSelect({
  options,
  value,
  onChange,
}: {
  options: ViewportOption[];
  value: string | null;
  onChange: (value: string) => void;
}) {
  const selected = options.find(option => option.key === value);

  if (!selected) {
    return null;
  }

  return (
    <Row alignItems="center" gap="2" className={styles.screenWidthControl}>
      <Text color="muted" className={styles.screenWidthLabel}>
        Screen size:
      </Text>
      <Select
        aria-label="Screen size"
        value={selected.key}
        onChange={nextValue => onChange(String(nextValue))}
        maxHeight={420}
        renderValue={() => <ScreenWidthValue option={selected} />}
        buttonProps={{
          style: {
            minHeight: 36,
            minWidth: 132,
          },
        }}
        listProps={{
          style: {
            width: 200,
          },
        }}
      >
        {options.map(option => (
          <ListItem key={option.key} id={option.key}>
            <Row alignItems="center" justifyContent="space-between" gap="2">
              <ScreenWidthValue option={option} />
              <Text color="muted" className={styles.screenWidthCount}>
                {formatLongNumber(option.count)}
              </Text>
            </Row>
          </ListItem>
        ))}
      </Select>
    </Row>
  );
}

function ScreenWidthValue({ option }: { option: ViewportOption }) {
  return (
    <Row alignItems="center" gap="2" className={styles.screenWidthValue}>
      <ScreenWidthIcon width={option.viewportW} />
      <Text>
        {option.viewportW} × {option.viewportH}
      </Text>
    </Row>
  );
}

function ScreenWidthIcon({ width }: { width: number }) {
  const DeviceIcon =
    width < 768 ? Smartphone : width < 1200 ? Tablet : width < 1600 ? Laptop : Monitor;

  return (
    <Icon size="sm">
      <DeviceIcon />
    </Icon>
  );
}

function ClickHeatmapView({
  urlPath,
  points,
  snapshot,
  isLoading,
}: {
  urlPath: string;
  points: HeatmapPoint[];
  snapshot: HeatmapSnapshot | null;
  isLoading: boolean;
}) {
  const { isPhone } = useMobile();
  const [snapshotReady, setSnapshotReady] = useState(false);
  const viewportOptions = useMemo(() => getViewportOptions(points), [points]);
  const { viewport, setSelectedKey } = useSelectedViewport(viewportOptions);

  const visible = useMemo(
    () => (viewport ? getViewportPoints(points, viewport) : []),
    [points, viewport],
  );

  const maxCount = useMemo(
    () => visible.reduce((max, point) => (point.count > max ? point.count : max), 1),
    [visible],
  );

  const previewSnapshot = useMemo(
    () => (snapshot && viewport ? getSnapshotForViewport(snapshot, viewport) : null),
    [snapshot, viewport],
  );
  const handleSnapshotReady = useCallback(() => setSnapshotReady(true), []);
  const hasSnapshot = Boolean(previewSnapshot);
  const snapshotFrame = useMemo(
    () => (previewSnapshot ? getSnapshotFrame(previewSnapshot) : null),
    [previewSnapshot],
  );

  useEffect(() => {
    setSnapshotReady(!hasSnapshot);
  }, [hasSnapshot, previewSnapshot?.id]);
  // Coordinates are already in the visitor's page pixels: the canvas uses the real layout size.
  const renderWidth = snapshotFrame?.width ?? (viewport ? getLayoutWidth(viewport) : 1);
  // Match the canvas height to the snapshot height we actually render.
  const contentHeight = snapshotFrame?.height ?? viewport?.pageH ?? 0;
  const renderHeight = Math.max(contentHeight, 640);
  const hasMeasuredWidth = Boolean(viewport);
  const fit = useCanvasFit(renderWidth, renderHeight);
  const canvasWidth = hasMeasuredWidth ? `${fit.width}px` : '100%';
  const canvasHeight = hasMeasuredWidth ? `${fit.height}px` : undefined;
  const overlayPageW = renderWidth;
  const shouldRenderSnapshot = renderWidth > 0 && hasSnapshot;
  const showOverlay = !shouldRenderSnapshot || snapshotReady;
  const totalClicks = visible.reduce((sum, point) => sum + point.count, 0);
  const showLoading = isLoading;

  return (
    <Column gap>
      <Column gap="2" className={styles.summaryHeader}>
        {!isPhone && (
          <Row alignItems="center" justifyContent="space-between" gap>
            <Text color="muted" title={urlPath} className={styles.summaryPath}>
              {urlPath}
            </Text>
          </Row>
        )}
        {showLoading ? (
          <Row alignItems="center" gap className={styles.summaryStats}>
            <Text color="muted" className={styles.summaryStat}>
              Loading Heatmap...
            </Text>
          </Row>
        ) : isPhone ? (
          <Column gap="2" className={styles.mobileSummaryControls}>
            <ScreenWidthSelect
              options={viewportOptions}
              value={viewport?.key ?? null}
              onChange={setSelectedKey}
            />
          </Column>
        ) : (
          <Row
            alignItems="center"
            justifyContent="space-between"
            gap
            className={styles.summaryStats}
          >
            <Text color="muted" className={styles.summaryStat}>
              {viewport
                ? `${visible.length} positions - ${formatLongNumber(totalClicks)} clicks`
                : 'No click data for this page yet.'}
            </Text>
            <ScreenWidthSelect
              options={viewportOptions}
              value={viewport?.key ?? null}
              onChange={setSelectedKey}
            />
          </Row>
        )}
      </Column>

      <div ref={fit.wrapperRef} className={styles.canvasWrapper}>
        <div
          className={styles.canvas}
          style={{
            width: canvasWidth,
            height: canvasHeight,
            aspectRatio: `${Math.max(1, renderWidth)} / ${Math.max(1, renderHeight)}`,
          }}
        >
          {showLoading ? (
            <CanvasLoading />
          ) : !viewport || visible.length === 0 ? (
            <EmptyState message="No click data for this page yet." />
          ) : (
            <div
              className={styles.canvasSurface}
              style={{
                width: Math.max(1, renderWidth),
                height: Math.max(1, renderHeight),
                transform: `scale(${fit.scale})`,
              }}
            >
              <div className={styles.snapshotClip}>
                {shouldRenderSnapshot && !snapshotReady && <CanvasLoading />}
                {shouldRenderSnapshot && snapshotFrame && (
                  <SnapshotPreview
                    id={previewSnapshot?.id ?? ''}
                    frame={snapshotFrame}
                    onReady={handleSnapshotReady}
                  />
                )}
              </div>
              {showOverlay && (
                <div className={styles.overlay}>
                  {visible.map((point, index) => {
                    const intensity = Math.min(1, point.count / maxCount);
                    const desiredSize = 24 + intensity * 36;
                    const size = desiredSize;
                    const centerX = Math.max(0, Math.min(overlayPageW, point.pageX));
                    // Don't clamp to the canvas height: points below the real
                    // content overflow and are clipped by the canvas instead of
                    // piling up on the bottom edge.
                    const centerY = Math.max(0, point.pageY);

                    return (
                      <div
                        key={`${point.pageX}-${point.pageY}-${index}`}
                        className={styles.dot}
                        style={{
                          left: centerX,
                          top: centerY,
                          width: size,
                          height: size,
                          transform: 'translate(-50%, -50%)',
                          opacity: 0.25 + intensity * 0.55,
                        }}
                        title={`${point.count} click${point.count === 1 ? '' : 's'}`}
                      />
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </Column>
  );
}

function ScrollHeatmapView({
  urlPath,
  scroll,
  snapshot,
  isLoading,
}: {
  urlPath: string;
  scroll: HeatmapResult['scroll'] | undefined;
  snapshot: HeatmapSnapshot | null;
  isLoading: boolean;
}) {
  const { isPhone } = useMobile();
  const [snapshotReady, setSnapshotReady] = useState(false);
  const handleSnapshotReady = useCallback(() => setSnapshotReady(true), []);
  const viewportOptions = useMemo(
    () => getViewportOptions(getScrollViewportMetrics(scroll)),
    [scroll],
  );
  const { viewport, setSelectedKey } = useSelectedViewport(viewportOptions);
  const selectedBuckets = useMemo(
    () => getSelectedScrollBuckets(scroll, viewport),
    [scroll, viewport],
  );
  const previewSnapshot = useMemo(
    () => (snapshot && viewport ? getSnapshotForViewport(snapshot, viewport) : null),
    [snapshot, viewport],
  );
  const hasSnapshot = Boolean(previewSnapshot);
  const snapshotFrame = useMemo(
    () => (previewSnapshot ? getSnapshotFrame(previewSnapshot) : null),
    [previewSnapshot],
  );

  useEffect(() => {
    setSnapshotReady(!hasSnapshot);
  }, [hasSnapshot, previewSnapshot?.id]);
  const totalSessions = viewport?.count ?? 0;
  const pageW = viewport?.pageW ?? 0;
  const pageH = viewport?.pageH ?? 0;
  const viewportW = viewport?.viewportW ?? 0;
  const viewportH = viewport?.viewportH ?? 0;
  const renderWidth = snapshotFrame?.width ?? (viewport ? getLayoutWidth(viewport) : 1);
  const renderHeight = Math.max(snapshotFrame?.height ?? pageH, 640);
  const hasMeasuredWidth = Boolean(viewport);
  const fit = useCanvasFit(renderWidth, renderHeight);
  const canvasWidth = hasMeasuredWidth ? `${fit.width}px` : '100%';
  const canvasHeight = hasMeasuredWidth ? `${fit.height}px` : undefined;
  const shouldRenderSnapshot = renderWidth > 0 && hasSnapshot;
  const showOverlay = !shouldRenderSnapshot || snapshotReady;
  const hasScrollData = Boolean(
    viewport && selectedBuckets.length > 0 && totalSessions > 0 && pageW && pageH && viewportW,
  );
  const showLoading = isLoading;

  type Band = { fromPct: number; toPct: number; reached: number; ratio: number };
  const bands: Band[] = [];
  const sessionsByDepth = new Map(selectedBuckets.map(bucket => [bucket.depth, bucket.sessions]));
  let dropped = 0;

  for (let depth = 0; depth < 100; depth += SCROLL_BUCKET_SIZE) {
    const reached = Math.max(0, totalSessions - dropped);
    dropped += sessionsByDepth.get(depth) ?? 0;
    const nextReached = Math.max(0, totalSessions - dropped);
    const ratio = totalSessions ? nextReached / totalSessions : 0;

    if (reached > 0) {
      bands.push({
        fromPct: depth,
        toPct: Math.min(100, depth + SCROLL_BUCKET_SIZE),
        reached: nextReached,
        ratio,
      });
    }
  }

  return (
    <Column gap>
      {!isPhone && (
        <Text color="muted" title={urlPath} className={styles.summaryPath}>
          {urlPath}
        </Text>
      )}
      {showLoading ? (
        <Row alignItems="center" gap className={styles.summaryStats}>
          <Text color="muted" className={styles.summaryStat}>
            Loading Heatmap...
          </Text>
        </Row>
      ) : isPhone ? (
        <Column gap="2" className={styles.mobileSummaryControls}>
          <ScreenWidthSelect
            options={viewportOptions}
            value={viewport?.key ?? null}
            onChange={setSelectedKey}
          />
        </Column>
      ) : (
        <Row
          alignItems="center"
          justifyContent="space-between"
          gap
          className={styles.summaryHeader}
        >
          <Text color="muted" className={styles.summaryStat}>
            {hasScrollData
              ? `${formatLongNumber(totalSessions)} sessions - page ${pageW}x${pageH}${viewportH ? ` - viewport ${viewportW}x${viewportH}` : ''}`
              : 'No scroll data for this page yet.'}
          </Text>
          <ScreenWidthSelect
            options={viewportOptions}
            value={viewport?.key ?? null}
            onChange={setSelectedKey}
          />
        </Row>
      )}

      <div ref={fit.wrapperRef} className={styles.canvasWrapper}>
        <div
          className={styles.canvas}
          style={{
            width: canvasWidth,
            height: canvasHeight,
            aspectRatio: `${Math.max(1, renderWidth)} / ${Math.max(1, renderHeight)}`,
          }}
        >
          {showLoading ? (
            <CanvasLoading />
          ) : !hasScrollData ? (
            <EmptyState message="No scroll data for this page yet." />
          ) : (
            <div
              className={styles.canvasSurface}
              style={{
                width: Math.max(1, renderWidth),
                height: Math.max(1, renderHeight),
                transform: `scale(${fit.scale})`,
              }}
            >
              {shouldRenderSnapshot && !snapshotReady && <CanvasLoading />}
              {shouldRenderSnapshot && snapshotFrame && (
                <SnapshotPreview
                  id={previewSnapshot?.id ?? ''}
                  frame={snapshotFrame}
                  onReady={handleSnapshotReady}
                />
              )}
              {showOverlay && (
                <div className={styles.overlay}>
                  {bands.map(band => {
                    const intensity = band.ratio;
                    const hue = Math.round(60 - intensity * 60);

                    return (
                      <div
                        key={band.fromPct}
                        className={styles.scrollBand}
                        style={{
                          top: `${band.fromPct}%`,
                          height: `${Math.max(0, band.toPct - band.fromPct)}%`,
                          background:
                            intensity > 0
                              ? `hsla(${hue}, 90%, 55%, ${0.12 + intensity * 0.45})`
                              : 'none',
                        }}
                        title={`${band.toPct}% depth - ${formatLongNumber(band.reached)} sessions reached`}
                      >
                        <span
                          className={styles.scrollBandLabel}
                          // Counter-scale the label by the inverse of the canvas
                          // scale so its on-screen size stays constant while the
                          // bands resize with the rest of the overlay.
                          style={{ transform: `scale(${1 / fit.scale})` }}
                        >
                          {band.toPct}% depth - {Math.round(intensity * 100)}% reached
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </Column>
  );
}

function SnapshotPreview({
  id,
  frame,
  onReady,
}: {
  id: string;
  frame: SnapshotFrame;
  onReady: () => void;
}) {
  return <IframeSnapshot id={id} frame={frame} onReady={onReady} />;
}

function IframeSnapshot({
  id,
  frame,
  onReady,
}: {
  id: string;
  frame: SnapshotFrame;
  onReady: () => void;
}) {
  const [available, setAvailable] = useState(true);
  const iframeUrl = frame.url;

  useEffect(() => {
    setAvailable(true);

    const readyTimer = window.setTimeout(() => onReady(), 1500);

    return () => window.clearTimeout(readyTimer);
  }, [onReady, id]);

  const handleLoad = useCallback(() => onReady(), [onReady]);
  const handleError = useCallback(() => {
    setAvailable(false);
    onReady();
  }, [onReady]);

  if (!available) {
    return null;
  }

  // The page is laid out at the visitor's real size: same pixels as the recorded
  // coordinates (the canvas is scaled to the panel by useCanvasFit).
  return (
    <div
      className={styles.snapshot}
      style={{
        width: frame.width,
        height: frame.height,
      }}
    >
      <iframe
        key={iframeUrl}
        className={`${styles.snapshotIframe} rr-block`}
        src={iframeUrl}
        title={iframeUrl}
        tabIndex={-1}
        loading="lazy"
        scrolling="no"
        referrerPolicy="no-referrer"
        onLoad={handleLoad}
        onError={handleError}
      />
    </div>
  );
}

function CanvasLoading() {
  return (
    <div className={styles.canvasLoading}>
      <Loading icon="dots" placement="center" />
    </div>
  );
}

function EmptyState({ message }: { message?: string } = {}) {
  return (
    <Column alignItems="center" justifyContent="center" minHeight="360px" gap>
      {!message && <Heading size="lg">Select a page</Heading>}
      <Text color="muted">{message ?? 'Choose a page from the list to view its heatmap.'}</Text>
    </Column>
  );
}
