export interface AvailableIP {
  ip: string;
  status: 'não_cadastrado' | 'livre';
  reason: string;
  device_status?: 'offline' | 'online';
}

export interface NetworkStats {
  available_count: number;
  total_devices: number;
  usage_percentage: string;
}

export interface AvailableIPsResponse {
  available: AvailableIP[];
  stats: Record<string, NetworkStats>;
  total_available: number;
  networks: string[];
}

export interface ImportSummary {
  inserted: number;
  updated: number;
  skipped: number;
  errors: { row: any; error: string }[];
}