import type { Device } from '../db/schema';

export function isFieldEmpty(field: unknown): boolean {
  if (!field) return true;
  if (typeof field !== 'string') return false;
  
  const cleaned = field.trim().toLowerCase();
  return cleaned === '' || cleaned === 'desconhecido' || cleaned === 'reservado' || cleaned === 'null';
}

export function isDeviceReallyFree(device: Device): boolean {
  const nameEmpty = isFieldEmpty(device.name);
  const typeEmpty = isFieldEmpty(device.type);
  const userEmpty = isFieldEmpty(device.user);
  const sectorEmpty = isFieldEmpty(device.sector);
  
  return nameEmpty && typeEmpty && userEmpty && sectorEmpty;
}