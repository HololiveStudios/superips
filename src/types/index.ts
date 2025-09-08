import { Page } from "../store/navigation";

export type DeviceStatus = 0 | 1;
export type DeviceType = 'Computador' | 'Impressora' | 'Roteador' | 'Balança' | 'Switch' | 'Access Point' | 'Servidor' | 'Firewall' | 'NAS' | 'Camera IP' | 'Telefone IP' | 'Outro';

export interface NetworkDevice {
  id: number;
  ip: string;
  hostname: string | null;
  mac_address: string | null;
  vendor: string | null;
  os_info: string | null;
  device_type: DeviceType | null;
  response_time: number | null;
  last_seen: string;
  status: DeviceStatus;
  open_ports?: number[];
  services?: string[];
  open_ports_count?: number;
  services_count?: number;
  created_at: string;
  updated_at: string;
}

export interface NetworkDeviceDetails {
  device: NetworkDevice;
  ports: DevicePort[];
  services: DeviceService[];
  shares: NetworkShare[];
  history: MonitoringHistory[];
}

export interface DevicePort {
  id: number;
  device_id: number;
  port: number;
  service_name: string;
  protocol: 'TCP' | 'UDP';
  status: 'open' | 'closed' | 'filtered';
  created_at: string;
}

export interface DeviceService {
  id: number;
  device_id: number;
  service_name: string;
  port: number;
  protocol: 'TCP' | 'UDP';
  version: string | null;
  status: 'active' | 'inactive' | 'unknown';
  created_at: string;
}

export interface NetworkShare {
  id: number;
  device_id: number;
  share_name: string;
  share_type: string;
  path: string | null;
  permissions: string | null;
  status: 'active' | 'inactive';
  created_at: string;
}

export interface MonitoringHistory {
  id: number;
  device_id: number;
  response_time: number;
  status: DeviceStatus;
  cpu_usage: number | null;
  memory_usage: number | null;
  disk_usage: number | null;
  network_in: number | null;
  network_out: number | null;
  timestamp: string;
}

export interface PingResult {
  ip: string;
  alive: boolean;
  time: number;
  min: number;
  max: number;
  avg: number;
  packetLoss: string;
}

export interface PortScanResult {
  ip: string;
  scanned_ports: number[];
  open_ports: number[];
  services: ServiceInfo[];
}

export interface ServiceInfo {
  port: number;
  service: string;
  protocol: 'TCP' | 'UDP';
}

export interface NetworkStats {
  overview: {
    total_devices: number;
    online_devices: number;
    offline_devices: number;
    different_os: number;
    different_vendors: number;
  };
  top_services: {
    service_name: string;
    count: number;
  }[];
  os_distribution: {
    os_info: string;
    count: number;
  }[];
  vendor_distribution: {
    vendor: string;
    count: number;
  }[];
}

export interface NetworkAlerts {
  offline_devices: NetworkDevice[];
  slow_devices: NetworkDevice[];
  suspicious_ports: {
    ip: string;
    hostname: string;
    port: number;
    service_name: string;
  }[];
  timestamp: string;
}

export interface DiscoveryResult {
  success: boolean;
  discovered: number;
  devices: NetworkDevice[];
}

export interface MonitoringStatus {
  monitoring_active: boolean;
  last_scan: string;
}

export interface SharesResult {
  ip: string;
  shares: {
    name: string;
    type: string;
    comment: string;
  }[];
}

export interface TracerouteResult {
  target_ip: string;
  hops: {
    hop: number;
    ip: string;
    rtt1: string;
    rtt2: string;
    rtt3: string;
  }[];
  total_hops: number;
}

export interface BandwidthResult {
  interfaces: {
    interface: string;
    bytes_received: number;
    packets_received: number;
    bytes_sent: number;
    packets_sent: number;
    timestamp: string;
  }[];
  timestamp: string;
}

export interface RemoteCommandResult {
  ip: string;
  command: string;
  output?: string;
  error?: string;
  success: boolean;
  executed_at: string;
}

export interface SnmpResult {
  ip: string;
  community: string;
  oid: string;
  results: {
    oid: string;
    value: string;
  }[];
  success: boolean;
}

export interface Device {
  id: number;
  ip: string;
  name: string;
  type: string;
  user: string;
  sector: string;
  status: DeviceStatus;
  online?: DeviceStatus;
  created_at?: string;
  updated_at?: string;
  [key: string]: any;
}

export interface Router extends Device {
  login_username: string;
  login_password: string;
  wifi_ssid: string;
  wifi_password: string;
  hidden: number;
}

export interface Printer extends Device {
  device_id: number;
  model: string;
  npat: number;
  status: DeviceStatus; 
}

export interface Box extends Device {
  power_status: number;
  device_id: number;
  ip: string;
  name: string;
}

export interface User {
  id: number;
  username: string;
  token?: string;
}

export interface RDPCheckResult {
  ip: string;
  rdp_available: boolean;
  port: number;
  checked_at: string;
}

export interface ShareInfo {
  name: string;
  type: string;
  comment: string;
}

export interface TracerouteHop {
  hop: number;
  ip: string;
  rtt1: string;
  rtt2: string;
  rtt3: string;
}

export interface NetworkOverview {
  total_devices: number;
  online_devices: number;
  offline_devices: number;
  different_os: number;
  different_vendors: number;
}

export interface ServiceStats {
  service_name: string;
  count: number;
}

export interface OSStats {
  os_info: string;
  count: number;
}

export interface VendorStats {
  vendor: string;
  count: number;
}

export interface SuspiciousPortAlert {
  ip: string;
  hostname: string;
  port: number;
  service_name: string;
}

export interface SnmpValue {
  oid: string;
  value: string;
}

export interface NetworkInterface {
  interface: string;
  bytes_received: number;
  packets_received: number;
  bytes_sent: number;
  packets_sent: number;
  timestamp: string;
}

export interface ScanOptions {
  ports?: number[];
  timeout?: number;
  include_closed?: boolean;
}

export interface MonitoringConfig {
  interval_minutes: number;
  ping_timeout: number;
  port_scan_timeout: number;
  max_concurrent_scans: number;
  retry_attempts: number;
}

export interface DeviceCardProps {
  device: NetworkDevice;
  onPing?: (ip: string) => void;
  onScan?: (ip: string) => void;
  onViewDetails?: (device: NetworkDevice) => void;
  onEdit?: (device: NetworkDevice) => void;
  onDelete?: (id: number) => void;
}

export interface AlertItemProps {
  alert: NetworkDevice | SuspiciousPortAlert;
  type: 'offline' | 'slow' | 'security';
  onResolve?: () => void;
  onIgnore?: () => void;
}

export interface StatCardProps {
  title: string;
  value: number;
  icon: React.ComponentType<any>;
  color: string;
  subtitle?: string;
  isLoading?: boolean;
  trend?: 'up' | 'down' | 'stable';
  trendValue?: number;
}

export interface DeviceFilter {
  status?: DeviceStatus;
  device_type?: DeviceType;
  vendor?: string;
  os_info?: string;
  has_open_ports?: boolean;
  response_time_max?: number;
  last_seen_hours?: number;
}

export interface SearchOptions {
  query: string;
  type: 'all' | 'ip' | 'hostname' | 'mac';
  filters?: DeviceFilter;
  sort_by?: keyof NetworkDevice;
  sort_order?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

export interface DashboardData {
  stats: NetworkStats;
  recent_devices: NetworkDevice[];
  alerts: NetworkAlerts;
  monitoring_status: MonitoringStatus;
  network_timeline: TimelineEntry[];
}

export interface TimelineEntry {
  timestamp: string;
  type: 'discovery' | 'alert' | 'status_change' | 'scan_complete';
  device_ip?: string;
  device_hostname?: string;
  description: string;
  severity: 'info' | 'warning' | 'error' | 'success';
}

export interface ExportOptions {
  format: 'json' | 'csv' | 'xlsx';
  include_history?: boolean;
  include_ports?: boolean;
  include_services?: boolean;
  date_range?: {
    start: string;
    end: string;
  };
  filters?: DeviceFilter;
}

export interface ExportResult {
  filename: string;
  format: string;
  total_records: number;
  export_date: string;
  filters_applied?: DeviceFilter;
}

export interface NetworkConfig {
  subnets: string[];
  excluded_ips: string[];
  scan_ports: number[];
  monitoring_interval: number;
  alert_thresholds: {
    response_time_warning: number;
    response_time_critical: number;
    offline_duration_alert: number;
  };
  notifications: {
    email_enabled: boolean;
    email_recipients: string[];
    slack_enabled: boolean;
    slack_webhook: string;
  };
}

export interface LDAPConfig {
  server: string;
  port: number;
  base_dn: string;
  bind_dn: string;
  bind_password: string;
  user_filter: string;
  group_filter: string;
}

export interface SNMPConfig {
  community: string;
  version: '1' | '2c' | '3';
  timeout: number;
  retries: number;
  port: number;
}

export interface WebhookPayload {
  event_type: 'device_discovered' | 'device_offline' | 'device_online' | 'port_opened' | 'port_closed';
  timestamp: string;
  device: NetworkDevice;
  previous_state?: any;
  additional_data?: any;
}

export interface APIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  timestamp: string;
}

export type NetworkDeviceField = keyof NetworkDevice;
export type DeviceServiceField = keyof DeviceService;
export type DevicePortField = keyof DevicePort;

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings?: string[];
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
  has_next: boolean;
  has_previous: boolean;
}

export interface WebSocketMessage {
  type: 'device_update' | 'new_device' | 'alert' | 'scan_progress' | 'monitoring_status';
  payload: any;
  timestamp: string;
}

export enum AlertSeverity {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  CRITICAL = 'critical'
}

export enum DeviceCategory {
  NETWORK_INFRASTRUCTURE = 'network_infrastructure',
  ENDPOINT = 'endpoint',
  SERVER = 'server',
  IOT = 'iot',
  SECURITY = 'security',
  STORAGE = 'storage',
  UNKNOWN = 'unknown'
}

export interface Switch {
  id: number;
  name: string;
  model: string;
  sector: string;
  rack_position: number;
  total_ports: number;
  used_ports: number;
  is_poe: boolean;
  status: 'active' | 'inactive';
  ip_address?: string;
  ports_status: boolean[]; // Array de status das portas (true = ativa, false = inativa)
  created_at: string;
}

export interface Rack {
  id: number;
  name: string;
  sector: string;
  total_units: number;
  used_units: number;
  location: string;
  status: 'active' | 'inactive';
}

export interface ApiResponse<T> {
  data: T;
  message: string;
  success: boolean;
}

// Types
export interface NavigationItem {
  name: string
  href: Page
  icon: React.ComponentType<any>
}

export interface NavLinkProps {
  item: NavigationItem
  mobile?: boolean
  onClick?: () => void
}