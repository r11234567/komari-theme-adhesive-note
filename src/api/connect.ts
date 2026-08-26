/**
 * Komari Connect 传输层。
 *
 * 公开大屏的数据全部来自两个 Connect 服务：BrowserService（站点信息、节点列表、
 * 状态推送）与 MetricsService（历史指标、延迟统计）。旧的 JSON-RPC 2.0 通道已不
 * 再使用。
 *
 * 历史曲线由指标查询重建：服务端按 metric 名 + 标签分组返回序列，这里按时间戳
 * 归并成主题沿用的扁平记录，避免上层图表逻辑随传输层改动。
 */
import { createClient } from "@connectrpc/connect";
import { createConnectTransport } from "@connectrpc/connect-web";
import { timestampDate, timestampFromDate } from "@bufbuild/protobuf/wkt";
import type { Timestamp } from "@bufbuild/protobuf/wkt";
import {
  AgentStatus,
  BrowserService,
} from "@komari/proto/komari/browser/v1/browser_pb";
import type {
  AgentSummary,
  GetPublicInfoResponse,
} from "@komari/proto/komari/browser/v1/browser_pb";
import { MetricsService } from "@komari/proto/komari/metrics/v1/metrics_pb";
import type { AgentReport } from "@komari/proto/komari/report/v1/report_pb";
import type {
  KomariNode,
  LoadRecord,
  LoadRecordsResp,
  NodeStatus,
  PingRecord,
  PingRecordTask,
  PingRecordsResp,
  PublicSettings,
  RecentReport,
} from "./types";

const transport = createConnectTransport({
  baseUrl:
    typeof window === "undefined" ? "http://localhost" : window.location.origin,
  useBinaryFormat: true,
  // 站点可能开启私有访问，凭据必须随请求发出，否则会被判为访客。
  fetch: (input, init) => fetch(input, { ...init, credentials: "same-origin" }),
});

export const browserClient = createClient(BrowserService, transport);
export const metricsClient = createClient(MetricsService, transport);

/** protobuf 的 uint64 在 TS 里是 bigint，主题各处按 number 计算。 */
const asNumber = (value?: bigint) => Number(value ?? 0n);

const isoOf = (value?: Timestamp) =>
  value ? timestampDate(value).toISOString() : "";

/** 服务端与 loadRecordMetricNames 对齐的指标集合，用于重建历史负载记录。 */
const LOAD_RECORD_METRICS = [
  "cpu.usage",
  "gpu.usage",
  "memory.used",
  "swap.used",
  "load.average",
  "disk.used",
  "net.in.rate",
  "net.out.rate",
  "net.total.up",
  "net.total.down",
  "traffic.up",
  "traffic.down",
  "process.count",
  "connections.tcp",
  "connections.udp",
] as const;

const PING_LATENCY_METRIC = "ping.latency_ms";

const emptyLoadRecord = (client: string, time: string): LoadRecord => ({
  client,
  time,
  cpu: 0,
  gpu: 0,
  ram: 0,
  ram_total: 0,
  swap: 0,
  swap_total: 0,
  load: 0,
  temp: 0,
  disk: 0,
  disk_total: 0,
  net_in: 0,
  net_out: 0,
  net_total_up: 0,
  net_total_down: 0,
  process: 0,
  connections: 0,
  connections_udp: 0,
});

const publicSettingsOf = (info: GetPublicInfoResponse): PublicSettings => ({
  sitename: info.siteName,
  description: info.siteDescription,
  theme: info.defaultTheme,
  theme_settings: (info.themeSettings ?? null) as PublicSettings["theme_settings"],
  private_site: info.privateSite,
  // 记录开关不在公开契约里；保留期为 0 时上层按“未限制”处理。
  record_enabled: true,
  record_preserve_time: info.metricRetentionDays * 24,
  ping_record_preserve_time: info.metricRetentionDays * 24,
  custom_head: info.customHead,
  custom_body: info.customBody,
  oauth_enable: info.oauthEnabled,
  oauth_provider: info.oauthProvider,
  disable_password_login: info.disablePasswordLogin,
  cors_origin_check_enabled: info.corsOriginCheckEnabled,
  visitor_audit_enabled: info.visitorAuditEnabled,
});

const komariNodeOf = (agent: AgentSummary): KomariNode => {
  const basic = agent.basicInfo;
  return {
    uuid: agent.agentId,
    name: agent.name,
    cpu_name: basic?.cpuName ?? "",
    virtualization: basic?.virtualization ?? "",
    arch: basic?.architecture ?? "",
    cpu_cores: basic?.cpuCores ?? 0,
    // 物理核心数不在公开契约里；逻辑核心数是唯一可用值。
    cpu_physical_cores: basic?.cpuCores ?? 0,
    os: basic?.os ?? "",
    kernel_version: basic?.kernelVersion ?? "",
    gpu_name: basic?.gpuName ?? "",
    region: basic?.region ?? "",
    mem_total: asNumber(basic?.memoryTotalBytes),
    swap_total: asNumber(basic?.swapTotalBytes),
    disk_total: asNumber(basic?.diskTotalBytes),
    weight: basic?.weight ?? 0,
    price: basic?.price ?? 0,
    // 一次性付费在数据模型里是负周期，无符号的 billing_cycle_days 装不下，
    // 服务端改用独立标志下发，这里还原成主题沿用的 -1。
    billing_cycle: basic?.billingOneTime ? -1 : (basic?.billingCycleDays ?? 0),
    auto_renewal: basic?.autoRenewal ?? false,
    currency: basic?.currency ?? "",
    expired_at: isoOf(basic?.expiresAt),
    group: basic?.group ?? "",
    tags: basic?.tags ?? "",
    // 隐藏节点由服务端对访客直接过滤，能取到的一律是可见节点。
    hidden: false,
    traffic_limit: asNumber(basic?.trafficLimitBytes),
    traffic_limit_type: basic?.trafficLimitType ?? "",
    created_at: isoOf(basic?.createdAt),
    updated_at: isoOf(basic?.updatedAt),
    public_remark: basic?.publicRemark || undefined,
  };
};

/** Agent 会额外上报一条名为 aggregate 的汇总项；没有时退回第一块网卡/磁盘。 */
const aggregateNetwork = (report?: AgentReport) =>
  report?.networkInterfaces.find((item) => item.name === "aggregate") ??
  report?.networkInterfaces[0];

const aggregateDisk = (report?: AgentReport) =>
  report?.disks.find((item) => item.mountPoint === "aggregate") ??
  report?.disks[0];

const gpuAverage = (report?: AgentReport) => {
  const gpus = report?.resources?.gpus ?? [];
  if (!gpus.length) return 0;
  const total = gpus.reduce((sum, gpu) => sum + (gpu.utilizationPercent ?? 0), 0);
  return total / gpus.length;
};

/**
 * 状态推送转主题的扁平结构。
 *
 * `temp` 恒为 0：类型化上报里没有主机温度字段，Agent 也不采集它——旧接口的同名
 * 字段同样从未被填充过，因此这里不是丢数据。
 */
export const nodeStatusOf = (
  agent: AgentSummary,
  report?: AgentReport,
): NodeStatus => {
  const resources = report?.resources;
  const network = aggregateNetwork(report);
  const disk = aggregateDisk(report);
  return {
    client: agent.agentId,
    time: isoOf(report?.observedAt),
    cpu: resources?.cpuPercent ?? 0,
    gpu: gpuAverage(report),
    ram: asNumber(resources?.memoryUsedBytes),
    ram_total: asNumber(report?.system?.memoryTotalBytes),
    swap: asNumber(resources?.swapUsedBytes),
    swap_total: asNumber(resources?.swapTotalBytes),
    load: resources?.loadAverage[0] ?? 0,
    load5: resources?.loadAverage[1] ?? 0,
    load15: resources?.loadAverage[2] ?? 0,
    temp: 0,
    disk: asNumber(disk?.usedBytes),
    disk_total: asNumber(disk?.totalBytes),
    net_in: asNumber(network?.bytesReceivedPerSecond),
    net_out: asNumber(network?.bytesSentPerSecond),
    net_total_up: asNumber(network?.bytesSent),
    net_total_down: asNumber(network?.bytesReceived),
    process: asNumber(resources?.processCount),
    connections: asNumber(resources?.tcpConnectionCount),
    connections_udp: asNumber(resources?.udpConnectionCount),
    online: agent.status === AgentStatus.ONLINE,
    uptime: report?.system?.uptime ? Number(report.system.uptime.seconds) : 0,
  };
};

export async function fetchNodes(): Promise<KomariNode[]> {
  const response = await browserClient.listAgents({});
  return response.agents.map(komariNodeOf);
}

export async function fetchPublicSettings(): Promise<PublicSettings> {
  return publicSettingsOf(await browserClient.getPublicInfo({}));
}

const windowFor = (hours: number) => {
  const end = new Date();
  return { start: new Date(end.getTime() - hours * 3_600_000), end };
};

const queryMetrics = async (input: {
  uuid: string;
  metrics: readonly string[];
  hours: number;
  maxPoints: number;
}) => {
  const { start, end } = windowFor(input.hours);
  const response = await metricsClient.queryMetrics({
    agentIds: [input.uuid],
    metrics: [...input.metrics],
    startTime: timestampFromDate(start),
    endTime: timestampFromDate(end),
    maxPoints: input.maxPoints,
    aggregation: "avg",
  });
  return response.series;
};

/** 短时原始采样，用于「实时」视图补齐打开页面之前的一小段曲线。 */
export async function fetchRecentRecords(uuid: string): Promise<RecentReport[]> {
  const series = await queryMetrics({
    uuid,
    metrics: LOAD_RECORD_METRICS,
    hours: 0.5,
    maxPoints: 150,
  });
  const byTime = new Map<string, RecentReport>();
  const reportAt = (time: string) => {
    const existing = byTime.get(time);
    if (existing) return existing;
    const report: RecentReport = {
      uuid,
      cpu: { usage: 0 },
      ram: { total: 0, used: 0 },
      swap: { total: 0, used: 0 },
      load: { load1: 0, load5: 0, load15: 0 },
      disk: { total: 0, used: 0 },
      network: { up: 0, down: 0, totalUp: 0, totalDown: 0 },
      connections: { tcp: 0, udp: 0 },
      uptime: 0,
      process: 0,
      updated_at: time,
    };
    byTime.set(time, report);
    return report;
  };

  for (const item of series) {
    for (const point of item.queryPoints) {
      if (point.value == null || !point.observedAt) continue;
      const report = reportAt(timestampDate(point.observedAt).toISOString());
      const value = point.value;
      switch (item.metric) {
        case "cpu.usage": report.cpu = { usage: value }; break;
        case "memory.used": report.ram = { ...report.ram, used: value }; break;
        case "swap.used": report.swap = { ...report.swap, used: value }; break;
        case "load.average": report.load = { ...report.load, load1: value }; break;
        case "disk.used": report.disk = { ...report.disk, used: value }; break;
        case "net.in.rate": report.network = { ...report.network, down: value }; break;
        case "net.out.rate": report.network = { ...report.network, up: value }; break;
        case "net.total.up": report.network = { ...report.network, totalUp: value }; break;
        case "net.total.down": report.network = { ...report.network, totalDown: value }; break;
        case "process.count": report.process = value; break;
        case "connections.tcp": report.connections = { ...report.connections, tcp: value }; break;
        case "connections.udp": report.connections = { ...report.connections, udp: value }; break;
      }
    }
  }

  return [...byTime.values()].sort((left, right) =>
    left.updated_at.localeCompare(right.updated_at),
  );
}

/**
 * 历史负载记录。
 *
 * 与旧接口一致：`ram_total` / `disk_total` 不随历史点返回，百分比要用节点静态
 * 信息里的 `mem_total` / `disk_total` 换算。
 */
export async function fetchLoadRecords(
  uuid: string,
  hours: number,
): Promise<LoadRecordsResp> {
  const series = await queryMetrics({
    uuid,
    metrics: LOAD_RECORD_METRICS,
    hours,
    maxPoints: 1000,
  });
  const byTime = new Map<string, LoadRecord>();
  const recordAt = (time: string) => {
    const existing = byTime.get(time);
    if (existing) return existing;
    const record = emptyLoadRecord(uuid, time);
    byTime.set(time, record);
    return record;
  };

  let hasGpuData = false;
  for (const item of series) {
    for (const point of item.queryPoints) {
      if (point.value == null || !point.observedAt) continue;
      const record = recordAt(timestampDate(point.observedAt).toISOString());
      const value = point.value;
      switch (item.metric) {
        case "cpu.usage": record.cpu = value; break;
        case "gpu.usage": record.gpu = value; hasGpuData = true; break;
        case "memory.used": record.ram = value; break;
        case "swap.used": record.swap = value; break;
        case "load.average": record.load = value; break;
        case "disk.used": record.disk = value; break;
        case "net.in.rate": record.net_in = value; break;
        case "net.out.rate": record.net_out = value; break;
        case "net.total.up": record.net_total_up = value; break;
        case "net.total.down": record.net_total_down = value; break;
        case "traffic.up": record.traffic_up = value; break;
        case "traffic.down": record.traffic_down = value; break;
        case "process.count": record.process = value; break;
        case "connections.tcp": record.connections = value; break;
        case "connections.udp": record.connections_udp = value; break;
      }
    }
  }

  const records = [...byTime.values()].sort((left, right) =>
    left.time.localeCompare(right.time),
  );
  return { count: records.length, records, has_gpu_data: hasGpuData };
}

/**
 * 延迟历史。
 *
 * 逐点序列来自指标查询（按 task_id 标签分组），任务摘要来自服务端已算好的
 * 延迟统计，比在浏览器里重算 min/max/avg/丢包更省，也与后台口径一致。
 */
export async function fetchPingRecords(
  uuid: string,
  hours: number,
): Promise<PingRecordsResp> {
  const { start, end } = windowFor(hours);
  const [seriesResponse, statsResponse, taskResponse] = await Promise.all([
    metricsClient.queryMetrics({
      agentIds: [uuid],
      metrics: [PING_LATENCY_METRIC],
      startTime: timestampFromDate(start),
      endTime: timestampFromDate(end),
      maxPoints: 1000,
      aggregation: "avg",
    }),
    metricsClient.getPingStats({
      agentIds: [uuid],
      startTime: timestampFromDate(start),
      endTime: timestampFromDate(end),
    }),
    metricsClient.listPingTasks({}),
  ]);

  const records: PingRecord[] = [];
  for (const item of seriesResponse.series) {
    const taskId = Number(item.labels.task_id ?? 0);
    if (!Number.isFinite(taskId) || taskId <= 0) continue;
    for (const point of item.queryPoints) {
      if (point.value == null || !point.observedAt) continue;
      records.push({
        task_id: taskId,
        time: timestampDate(point.observedAt).toISOString(),
        value: point.value,
        client: uuid,
      });
    }
  }
  records.sort((left, right) => left.time.localeCompare(right.time));

  const definitions = new Map(
    taskResponse.tasks.map((task) => [Number(task.taskId), task]),
  );
  const tasks = statsResponse.stats.map<PingRecordTask>((stat) => {
    const id = Number(stat.taskId);
    const definition = definitions.get(id);
    return {
      id,
      name: stat.name || definition?.name || "",
      type: stat.type || definition?.type || "",
      interval: stat.probeInterval
        ? Number(stat.probeInterval.seconds)
        : definition?.interval
          ? Number(definition.interval.seconds)
          : 0,
      // 「新节点默认开启」是后台配置项，不在公开契约里。
      default_on: false,
      total: stat.total,
      loss: stat.lossPercent,
      min: stat.minimum ?? 0,
      max: stat.maximum ?? 0,
      avg: stat.average ?? 0,
    };
  });

  return { count: records.length, records, tasks };
}
