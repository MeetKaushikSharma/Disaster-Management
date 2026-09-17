// ── Shared type definitions ───────────────────────────────────────────────────

export type Severity = 'Low' | 'Medium' | 'High' | 'Critical';
export type DisasterType =
  | 'Flood' | 'Earthquake' | 'Cyclone' | 'Landslide'
  | 'Fire' | 'Tsunami' | 'Drought' | 'Heatwave'
  | 'ChemicalSpill' | 'Other';
export type ZoneType = 'polygon' | 'radius';
export type EventStatus = 'active' | 'retracted' | 'expired' | 'cancelled';

export interface GeoPoint {
  type: 'Point';
  coordinates: [number, number]; // [lng, lat]
}

export interface GeoPolygon {
  type: 'Polygon';
  coordinates: [number, number][][];
}

export interface SafetyStep {
  order: number;
  instruction: string;
  iconSlug?: string;
}

export interface SafetyGuide {
  _id: string;
  disasterType: DisasterType;
  language: string;
  title: string;
  summary?: string;
  steps: SafetyStep[];
  version: number;
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DisasterEvent {
  _id: string;
  title: string;
  type: DisasterType;
  severity: Severity;
  description?: string;
  zoneType: ZoneType;
  polygon?: GeoPolygon;
  centre?: GeoPoint;
  radiusKm?: number;
  bufferRadiusKm: number;
  safetyGuideId?: string | SafetyGuide;
  status: EventStatus;
  expiresAt?: string;
  retractedAt?: string;
  correctionMessage?: string;
  alertsSentCount: number;
  createdBy: { _id: string; name: string; email: string };
  createdAt: string;
  updatedAt: string;
  isLive?: boolean;
}

export interface AlertLog {
  _id: string;
  eventId: { _id: string; title: string; type: string; severity: Severity; status: EventStatus };
  userId: { _id: string; name: string; phone: string; preferredLanguage: string };
  deduplicationKey: string;
  sentAt: string;
  deliveryStatus: 'pending' | 'sent' | 'failed';
  acknowledgedAt?: string;
  isRetraction: boolean;
  severityAtSend: Severity;
}

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: 'super_admin' | 'admin' | 'viewer';
}

export interface PaginatedResponse<T> {
  success: boolean;
  total: number;
  page: number;
  pages: number;
  data: T[];
}

export interface AlertStats {
  delivery: { pending: number; sent: number; failed: number };
  bySeverity: { _id: Severity; count: number; acknowledged: number }[];
  last24hAlerts: number;
}
