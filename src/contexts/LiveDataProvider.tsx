import { isMockEnabled, MOCK_LIVE_STATUS } from "@/api/mockData";
import { startTransition, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { NodeStatusMap } from "@/api/types";
import { browserClient, nodeStatusOf } from "@/api/connect";
import {
  LIVE_POLL_INTERVAL,
  LiveDataContext,
  mergeStatus,
} from "./live-data";

/** 大批节点同时变化时每帧最多提交的卡片数。 */
const STATUS_BATCH_SIZE = 10;

/** 流断开后的重连间隔。 */
const RECONNECT_DELAY = 2_000;

/**
 * 实时状态订阅。
 *
 * 走 Connect 的 WatchAgentStatus：服务端按事件推送变化的节点，不再轮询。
 * 推送的粒度是单个节点，而 LIVE_POLL_INTERVAL 在这里改为约束**渲染**节奏——
 * 节点多时逐条事件都提交一次会让整面卡片墙持续重排。
 *
 * 沿用原有两项优化：逐字段 diff 后复用旧引用、页面隐藏时停止订阅。
 */
export function LiveDataProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<NodeStatusMap>(() => isMockEnabled() ? MOCK_LIVE_STATUS : {});
  const [updatedAt, setUpdatedAt] = useState(() => isMockEnabled() ? Date.now() : 0);
  const [loading, setLoading] = useState(() => !isMockEnabled());
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (isMockEnabled()) return;
    let stopped = false;
    let controller: AbortController | null = null;
    let flushTimer: ReturnType<typeof setTimeout> | null = null;
    let batchFrame: number | null = null;
    let batchGeneration = 0;
    let statusSnapshot: NodeStatusMap = {};
    // 流是增量的，这里累积出完整快照再交给 diff。
    let incoming: NodeStatusMap = {};
    let pending = false;
    let afterEventId = "";

    const clearStatusBatch = () => {
      batchGeneration++;
      if (batchFrame !== null) {
        cancelAnimationFrame(batchFrame);
        batchFrame = null;
      }
    };

    const clearFlushTimer = () => {
      if (flushTimer !== null) {
        clearTimeout(flushTimer);
        flushTimer = null;
      }
    };

    const commitStatus = (next: NodeStatusMap, sampledAt: number) => {
      clearStatusBatch();
      const generation = batchGeneration;
      const merged = mergeStatus(statusSnapshot, next);
      const statusKeys = new Set([
        ...Object.keys(statusSnapshot),
        ...Object.keys(merged),
      ]);
      const changedKeys = [...statusKeys].filter(
        (uuid) => statusSnapshot[uuid] !== merged[uuid],
      );

      // 首屏必须一次完整出现；小批更新也不值得引入跨帧调度。
      const isInitial = Object.keys(statusSnapshot).length === 0;
      if (isInitial || changedKeys.length <= STATUS_BATCH_SIZE) {
        statusSnapshot = merged;
        const update = () => {
          setStatus(merged);
          setUpdatedAt(sampledAt);
        };
        // 首屏与 loading 状态同步提交；后续小更新可以作为非紧急更新让路给交互。
        if (isInitial) update();
        else startTransition(update);
        return;
      }

      let offset = 0;
      let working = statusSnapshot;
      const commitNextBatch = () => {
        batchFrame = null;
        if (stopped || generation !== batchGeneration) return;

        const nextMap = { ...working };
        for (const uuid of changedKeys.slice(offset, offset + STATUS_BATCH_SIZE)) {
          const nextStatus = merged[uuid];
          if (nextStatus) nextMap[uuid] = nextStatus;
          else delete nextMap[uuid];
        }
        offset += STATUS_BATCH_SIZE;
        working = nextMap;
        statusSnapshot = nextMap;

        const complete = offset >= changedKeys.length;
        setStatus(nextMap);
        if (complete) {
          setUpdatedAt(sampledAt);
        } else {
          batchFrame = requestAnimationFrame(commitNextBatch);
        }
      };

      // 与推送节奏错开，再按帧提交；不改变数据，只避免一次性协调整面卡片墙。
      batchFrame = requestAnimationFrame(commitNextBatch);
    };

    const flush = () => {
      flushTimer = null;
      if (stopped || !pending) return;
      pending = false;
      commitStatus(incoming, Date.now());
      setLoading(false);
    };

    const scheduleFlush = () => {
      pending = true;
      if (flushTimer === null) flushTimer = setTimeout(flush, LIVE_POLL_INTERVAL);
    };

    const wait = (ms: number) =>
      new Promise<void>((resolve) => {
        setTimeout(resolve, ms);
      });

    // 页面不可见时不订阅：既省服务端推送，也省客户端电量。
    const waitUntilVisible = () =>
      document.hidden
        ? new Promise<void>((resolve) => {
            const onVisible = () => {
              if (document.hidden && !stopped) return;
              document.removeEventListener("visibilitychange", onVisible);
              resolve();
            };
            document.addEventListener("visibilitychange", onVisible);
          })
        : Promise.resolve();

    const watch = async () => {
      while (!stopped) {
        await waitUntilVisible();
        if (stopped) return;
        controller = new AbortController();
        try {
          for await (const event of browserClient.watchAgentStatus(
            { agentIds: [], afterEventId },
            { signal: controller.signal, timeoutMs: 0 },
          )) {
            if (stopped) return;
            const agent = event.agent;
            if (!agent) continue;
            // 记住事件位点，重连时不必从头重放。
            afterEventId = agent.eventId || afterEventId;
            incoming = {
              ...incoming,
              [agent.agentId]: nodeStatusOf(agent, event.latestReport),
            };
            setError(null);
            scheduleFlush();
          }
        } catch (err) {
          if (stopped) return;
          // 主动断开（切到后台、卸载）不是故障。
          if (!(err instanceof DOMException && err.name === "AbortError")) {
            setError(err instanceof Error ? err : new Error(String(err)));
          }
          setLoading(false);
        }
        if (stopped) return;
        await wait(RECONNECT_DELAY);
      }
    };

    const onVisibilityChange = () => {
      if (document.hidden) {
        clearFlushTimer();
        clearStatusBatch();
        controller?.abort(new DOMException("Hidden", "AbortError"));
      }
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    void watch();

    return () => {
      stopped = true;
      clearFlushTimer();
      clearStatusBatch();
      controller?.abort(new DOMException("Unmounted", "AbortError"));
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);

  const value = useMemo(
    () => ({ status, updatedAt, loading, error }),
    [status, updatedAt, loading, error],
  );

  return (
    <LiveDataContext.Provider value={value}>{children}</LiveDataContext.Provider>
  );
}
