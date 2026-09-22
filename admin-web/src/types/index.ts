// ── Shared type definitions ───────────────────────────────────────────────────

export type Severity =
  | 'Low' | 'Medium' | 'High' | 'Critical';

export type DisasterType =
  | 'Flood' | 'FlashFlood' | 'HeavyRainfall' | 'UrbanWaterlogging'
  | 'Earthquake' | 'Cyclone' | 'Landslide'
  | 'Fire' | 'Tsunami' | 'Drought' | 'Heatwave' | 'Coldwave'
  | 'ChemicalSpill' | 'Other';

export type ZoneType = 'polygon' | 'radius';

export type EventStatus =
  | 'active' | 'published' | 'pending_approval' | 'draft'
  | 'approved' | 'retracted' | 'expired' | 'cancelled';

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

export interface ApprovalWorkflow {
  submittedBy?: { _id: string; name: string; email: string };
  submittedAt?: string;
  approvedBy?: { _id: string; name: string; email: string };
  approvedAt?: string;
  reviewNotes?: string;
}

export interface DisasterEvent {
  _id: string;
  title: string;
  type: DisasterType;
  severity: Severity;
  description?: string;
  state?: string;
  district?: string;
  translations?: {
    hi?: { title: string; description: string };
  };
  zoneType: ZoneType;
  polygon?: GeoPolygon;
  centre?: GeoPoint;
  radiusKm?: number;
  bufferRadiusKm: number;
  safetyGuideId?: string | SafetyGuide;
  status: EventStatus;
  approvalWorkflow?: ApprovalWorkflow;
  capIdentifier?: string;
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
  role: 'super_admin' | 'admin' | 'sdma_operator' | 'researcher' | 'viewer';
  assignedState?: string;
  assignedDistricts?: string[];
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

// ── AI Anomaly & Early Warning Types ──────────────────────────────────────────

export interface AnomalyFeature {
  indicator: string;
  currentValue: number;
  baselineMean: number;
  baselineStd: number;
  deviationScore: number;
  unit: string;
}

export interface AiAlert {
  _id: string;
  state: string;
  district: string;
  hazardType: DisasterType;
  score: number;
  threshold: number;
  recommendedSeverity: Severity;
  anomalyFeatures: AnomalyFeature[];
  explanation: string;
  suggestedActions?: string[];
  suggestedCentre?: [number, number];
  suggestedRadiusKm?: number;
  status: 'pending_review' | 'approved_into_event' | 'dismissed' | 'escalated';
  reviewedBy?: { _id: string; name: string; email: string };
  reviewedAt?: string;
  reviewNotes?: string;
  linkedEventId?: { _id: string; title: string; status: string };
  createdAt: string;
  updatedAt: string;
}

export interface HazardReading {
  _id: string;
  timestamp: string;
  state: string;
  district: string;
  stationId?: string;
  stationName?: string;
  indicator: string;
  value: number;
  unit: string;
  source: string;
  warningLevel?: number;
  dangerLevel?: number;
  isAnomaly: boolean;
  anomalyScore?: number;
}

export interface DistrictSummary {
  district: string;
  state: string;
  rainfall?: { value: number; unit: string; timestamp: string; isAnomaly: boolean } | null;
  riverLevel?: { value: number; unit: string; warningLevel?: number; dangerLevel?: number; timestamp: string; isAnomaly: boolean } | null;
  temperature?: { value: number; unit: string; timestamp: string; isAnomaly: boolean } | null;
}

// ── Situational Awareness & Citizen Check-In Types ───────────────────────────

export interface CitizenCheckIn {
  _id: string;
  userId: string;
  phone?: string;
  citizenName: string;
  status: 'safe' | 'need_help' | 'family_safe';
  location: { type: 'Point'; coordinates: [number, number] };
  district: string;
  state: string;
  eventId?: string;
  message?: string;
  peopleCount: number;
  isAcknowledgedByResponders: boolean;
  createdAt: string;
}

export interface SituationalAwarenessSummary {
  safe: number;
  need_help: number;
  family_safe: number;
  totalReports: number;
}

