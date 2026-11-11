
export interface TemperatureData {
  inside: number;
  outside: number;
  timestamp: string;
}

export interface Recommendation {
  action: string;
  explanation: string;
}

export enum DeviceStatus {
  ONLINE = 'ONLINE',
  OFFLINE = 'OFFLINE',
}
