import type {
  KomariNode,
  LoadRecord,
  LoadRecordsResp,
  NodeStatusMap,
  PingRecord,
  PingRecordsResp,
  PublicSettings,
  RecentReport,
} from "./types";

export function isMockEnabled(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.location.search.includes("mock=1") ||
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__MOCK_KOMARI__ === true
  );
}

export const MOCK_GPU_NODE_UUID = "tokyo-gpu-node-01";
export const MOCK_NO_GPU_NODE_UUID = "sv-vps-no-gpu-02";

// Reset time 5 days and 14 hours into the future
const nextResetDate = new Date(Date.now() + (5 * 24 + 14) * 3600 * 1000);

export const MOCK_NODES: KomariNode[] = [
  {
    uuid: MOCK_GPU_NODE_UUID,
    name: "Tokyo-GPU-Node-01",
    cpu_name: "AMD EPYC 7763 64-Core Processor",
    virtualization: "kvm",
    arch: "x86_64",
    cpu_cores: 32,
    cpu_physical_cores: 16,
    os: "Ubuntu 24.04 LTS",
    kernel_version: "6.8.0-40-generic",
    gpu_name: "NVIDIA GeForce RTX 4090",
    region: "🇯🇵",
    mem_total: 64 * 1024 * 1024 * 1024,
    swap_total: 16 * 1024 * 1024 * 1024,
    disk_total: 2048 * 1024 * 1024 * 1024,
    weight: 10,
    price: 199,
    billing_cycle: 30,
    auto_renewal: true,
    currency: "$",
    expired_at: "2027-12-31T23:59:59Z",
    group: "GPU",
    tags: "gpu,rtx4090,ai",
    hidden: false,
    traffic_limit: 10_000 * 1_000_000_000, // 10,000 GB (10 TB 十进制)
    traffic_limit_type: "sum",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-11-09T00:00:00Z",
    traffic_next_reset: nextResetDate.toISOString(),
    traffic_reset_cycle: "month",
    traffic_reset_day: 15,
  },
  {
    uuid: MOCK_NO_GPU_NODE_UUID,
    name: "SiliconValley-VPS-02",
    cpu_name: "Intel Xeon Platinum 8370C",
    virtualization: "kvm",
    arch: "x86_64",
    cpu_cores: 4,
    cpu_physical_cores: 2,
    os: "Debian GNU/Linux 12 (bookworm)",
    kernel_version: "6.1.0-21-amd64",
    gpu_name: "",
    region: "🇺🇸",
    mem_total: 8 * 1024 * 1024 * 1024,
    swap_total: 4 * 1024 * 1024 * 1024,
    disk_total: 100 * 1024 * 1024 * 1024,
    weight: 20,
    price: 15,
    billing_cycle: 30,
    auto_renewal: true,
    currency: "$",
    expired_at: "2028-06-30T00:00:00Z",
    group: "Standard",
    tags: "vps,general",
    hidden: false,
    traffic_limit: 0,
    traffic_limit_type: "",
    created_at: "2026-02-01T00:00:00Z",
    updated_at: "2026-11-09T00:00:00Z",
  },
];

export const MOCK_SETTINGS: PublicSettings = {
  sitename: "Komari Monitor",
  description: "A simple server monitor tool.",
  theme: "adhesive-note",
  theme_settings: null,
  private_site: false,
  record_enabled: true,
  record_preserve_time: 168,
  ping_record_preserve_time: 168,
  custom_head: "",
  custom_body: "",
  oauth_enable: false,
  oauth_provider: "",
  disable_password_login: false,
  cors_origin_check_enabled: false,
  visitor_audit_enabled: false,
};

export const MOCK_LIVE_STATUS: NodeStatusMap = {
  [MOCK_GPU_NODE_UUID]: {
    client: MOCK_GPU_NODE_UUID,
    time: new Date().toISOString(),
    cpu: 34.5,
    gpu: 68.2,
    gpu_mem: 16.4 * 1024 * 1024 * 1024,
    gpu_mem_total: 24 * 1024 * 1024 * 1024,
    gpu_mem_percent: 68.3,
    gpu_name: "NVIDIA GeForce RTX 4090",
    has_gpu: true,
    ram: 22.5 * 1024 * 1024 * 1024,
    ram_total: 64 * 1024 * 1024 * 1024,
    swap: 1.2 * 1024 * 1024 * 1024,
    swap_total: 16 * 1024 * 1024 * 1024,
    load: 1.85,
    load5: 2.15,
    load15: 1.95,
    temp: 45,
    disk: 512 * 1024 * 1024 * 1024,
    disk_total: 2048 * 1024 * 1024 * 1024,
    net_in: 45.2 * 1024 * 1024,
    net_out: 12.8 * 1024 * 1024,
    net_total_up: 3800 * 1_000_000_000,
    net_total_down: 1200 * 1_000_000_000,
    process: 184,
    connections: 342,
    connections_udp: 89,
    online: true,
    uptime: 14 * 86400 + 6 * 3600,
    traffic_next_reset: nextResetDate.toISOString(),
    traffic_used: 5000 * 1_000_000_000,
  },
  [MOCK_NO_GPU_NODE_UUID]: {
    client: MOCK_NO_GPU_NODE_UUID,
    time: new Date().toISOString(),
    cpu: 12.0,
    gpu: 0,
    has_gpu: false,
    ram: 2.1 * 1024 * 1024 * 1024,
    ram_total: 8 * 1024 * 1024 * 1024,
    swap: 0.1 * 1024 * 1024 * 1024,
    swap_total: 4 * 1024 * 1024 * 1024,
    load: 0.42,
    load5: 0.38,
    load15: 0.35,
    temp: 0,
    disk: 28 * 1024 * 1024 * 1024,
    disk_total: 100 * 1024 * 1024 * 1024,
    net_in: 1.5 * 1024 * 1024,
    net_out: 3.2 * 1024 * 1024,
    net_total_up: 850 * 1_000_000_000,
    net_total_down: 420 * 1_000_000_000,
    process: 92,
    connections: 58,
    connections_udp: 14,
    online: true,
    uptime: 45 * 86400,
  },
};

export function getMockRecentReports(uuid: string): RecentReport[] {
  const isGpu = uuid === MOCK_GPU_NODE_UUID;
  const reports: RecentReport[] = [];
  const now = Date.now();
  for (let i = 60; i >= 0; i--) {
    const time = new Date(now - i * 5000).toISOString();
    const t = i / 10;
    reports.push({
      uuid,
      updated_at: time,
      cpu: { usage: 25 + Math.sin(t) * 10 },
      gpu: isGpu ? { usage: 60 + Math.cos(t) * 15 } : undefined,
      gpu_mem: isGpu
        ? {
            used: 16.4 * 1024 * 1024 * 1024 + Math.sin(t) * 500 * 1024 * 1024,
            total: 24 * 1024 * 1024 * 1024,
          }
        : undefined,
      ram: {
        used: (isGpu ? 22 : 2) * 1024 * 1024 * 1024,
        total: (isGpu ? 64 : 8) * 1024 * 1024 * 1024,
      },
      swap: { used: 0, total: 4 * 1024 * 1024 * 1024 },
      load: { load1: 1.5, load5: 1.2, load15: 1.0 },
      disk: {
        used: (isGpu ? 512 : 28) * 1024 * 1024 * 1024,
        total: (isGpu ? 2048 : 100) * 1024 * 1024 * 1024,
      },
      network: {
        up: 10 * 1024 * 1024,
        down: 30 * 1024 * 1024,
        totalUp: 3.8 * 1024 * 1024 * 1024 * 1024,
        totalDown: 1.2 * 1024 * 1024 * 1024 * 1024,
      },
      connections: { tcp: 120, udp: 40 },
      uptime: 86400,
      process: 120,
    });
  }
  return reports;
}

export function getMockLoadRecords(uuid: string, hours: number): LoadRecordsResp {
  const isGpu = uuid === MOCK_GPU_NODE_UUID;
  const records: LoadRecord[] = [];
  const now = Date.now();
  const points = Math.min(120, hours * 30);
  const stepMs = (hours * 3600 * 1000) / points;

  for (let i = points; i >= 0; i--) {
    const time = new Date(now - i * stepMs).toISOString();
    const t = i / 5;
    records.push({
      client: uuid,
      time,
      cpu: 20 + Math.sin(t) * 15,
      gpu: isGpu ? 55 + Math.cos(t) * 20 : 0,
      gpu_mem: isGpu ? 16 * 1024 * 1024 * 1024 + Math.sin(t) * 1024 * 1024 * 1024 : 0,
      gpu_mem_total: isGpu ? 24 * 1024 * 1024 * 1024 : 0,
      ram: (isGpu ? 20 : 2) * 1024 * 1024 * 1024,
      ram_total: (isGpu ? 64 : 8) * 1024 * 1024 * 1024,
      swap: 0,
      swap_total: 4 * 1024 * 1024 * 1024,
      load: 1.2 + Math.sin(t) * 0.5,
      temp: 0,
      disk: (isGpu ? 500 : 28) * 1024 * 1024 * 1024,
      disk_total: (isGpu ? 2048 : 100) * 1024 * 1024 * 1024,
      net_in: (20 + Math.sin(t) * 10) * 1024 * 1024,
      net_out: (10 + Math.cos(t) * 5) * 1024 * 1024,
      net_total_up: 3800 * 1_000_000_000,
      net_total_down: 1200 * 1_000_000_000,
      process: 150,
      connections: 200,
      connections_udp: 50,
    });
  }

  return {
    count: records.length,
    records,
    has_gpu_data: isGpu,
  };
}

/**
 * 构造与用户原图完全一致的高保真延迟测试数据：
 * 1. 多个任务（例如 8 个探针节点：辽宁电信、辽宁移动、重庆电信、广东电信等）
 * 2. Section 1 (13:40 - 14:40): 异步交错采样，每任务 30-60s。
 *    测试：点与点之间正常连线，不再碎成点断裂。
 * 3. Section 2 (14:40 - 16:15): 约 1.5 小时大停机断网断线空白期（Gap > 600s）。
 *    测试：严禁连线，必须保持真实空白断开。
 * 4. Section 3 (16:15 - 17:35): 恢复连线，且在 17:30 出现探测超时/丢包（value: 0 和 -1）。
 *    测试：由于 value <= 0 转为 null，绝不接地（不再跌落至 0ms 轴）！
 */
export function getMockPingRecords(uuid: string, hours: number): PingRecordsResp {
  const taskDefs = [
    { id: 1, name: "辽宁电信" },
    { id: 2, name: "辽宁移动" },
    { id: 3, name: "辽宁联通" },
    { id: 4, name: "重庆电信" },
    { id: 5, name: "重庆移动" },
    { id: 6, name: "广东电信" },
    { id: 7, name: "广东移动" },
    { id: 8, name: "北京联通" },
  ];

  const records: PingRecord[] = [];
  const now = Date.now();
  const totalDuration = hours * 3600 * 1000;
  const startTime = now - totalDuration;

  // 4 小时窗口中的各阶段划分
  // Section 1: startTime 到 startTime + 25% (正常异步采样)
  const sec1End = startTime + totalDuration * 0.25;
  // Section 2: startTime + 25% 到 startTime + 60% (1.5h 大断网断线)
  const sec2End = startTime + totalDuration * 0.60;
  // Section 3: startTime + 60% 到 now (恢复采样，并在 90% 处有 <= 0 的丢包点)
  const lossPointTime = startTime + totalDuration * 0.90;

  for (const task of taskDefs) {
    const baseLatency = 135 + task.id * 6; // 140ms - 180ms
    const jitter = () => (Math.random() - 0.5) * 14;

    // Section 1
    let t = startTime + (task.id * 15 * 1000); // 异步交错
    while (t < sec1End) {
      records.push({
        task_id: task.id,
        client: uuid,
        time: new Date(t).toISOString(),
        value: baseLatency + jitter(),
      });
      t += 45 * 1000 + Math.floor(Math.random() * 20) * 1000;
    }

    // Section 2: 无采样点（模拟大掉线）

    // Section 3
    t = sec2End + (task.id * 15 * 1000);
    while (t < now) {
      let val = baseLatency + jitter();
      // 在 lossPointTime 附近产生一个 0 值或负值错误点
      if (Math.abs(t - lossPointTime) < 40 * 1000 && task.id === 1) {
        val = 0; // 0ms / 超时，验证绝不接地跌至 0
      } else if (Math.abs(t - lossPointTime) < 40 * 1000 && task.id === 2) {
        val = -1; // -1 错误
      }

      records.push({
        task_id: task.id,
        client: uuid,
        time: new Date(t).toISOString(),
        value: val,
      });
      t += 45 * 1000 + Math.floor(Math.random() * 20) * 1000;
    }
  }

  records.sort((a, b) => a.time.localeCompare(b.time));

  const tasks = taskDefs.map((t) => ({
    id: t.id,
    name: t.name,
    type: "icmp",
    interval: 60,
    default_on: true,
    total: 200,
    loss: 0.5,
    min: 130 + t.id * 5,
    max: 180 + t.id * 5,
    avg: 150 + t.id * 5,
  }));

  return {
    count: records.length,
    records,
    tasks,
  };
}
