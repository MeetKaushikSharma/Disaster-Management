import api from './client';
import type {
  DisasterEvent, AlertLog, SafetyGuide, AdminUser, AlertStats,
  AiAlert, HazardReading, DistrictSummary, CitizenCheckIn, SituationalAwarenessSummary,
} from '../types';

// ── Auth ──────────────────────────────────────────────────────────────────────
export const login = (email: string, password: string) =>
  api.post<{ success: boolean; token: string; admin: AdminUser }>('/auth/login', { email, password });

export const getMe = () =>
  api.get<{ success: boolean; admin: AdminUser }>('/auth/me');

export const changePassword = (currentPassword: string, newPassword: string) =>
  api.post('/auth/change-password', { currentPassword, newPassword });

// ── Events ────────────────────────────────────────────────────────────────────
export const getEvents = (params?: { status?: string; district?: string; page?: number; limit?: number }) =>
  api.get<{ success: boolean; total: number; page: number; pages: number; events: DisasterEvent[] }>(
    '/events', { params }
  );

export const getEvent = (id: string) =>
  api.get<{ success: boolean; event: DisasterEvent }>(`/events/${id}`);

export const createEvent = (data: Partial<DisasterEvent>) =>
  api.post<{ success: boolean; event: DisasterEvent }>('/events', data);

export const updateEvent = (id: string, data: Partial<DisasterEvent>) =>
  api.put<{ success: boolean; event: DisasterEvent }>(`/events/${id}`, data);

export const retractEvent = (id: string, correctionMessage: string, action: 'retract' | 'cancel' = 'retract') =>
  api.patch<{ success: boolean; event: DisasterEvent }>(`/events/${id}/retract`, { correctionMessage, action });

export const deleteEvent = (id: string) =>
  api.delete(`/events/${id}`);

export const triggerAlert = (id: string) =>
  api.post<{ success: boolean; usersTargeted: number; alertsSent: number; duplicatesSkipped: number }>(
    `/events/${id}/trigger`
  );

// ── SDMA Approval Workflow ────────────────────────────────────────────────────
export const submitEventForApproval = (id: string) =>
  api.post<{ success: boolean; message: string; event: DisasterEvent }>(`/events/${id}/submit-approval`);

export const approveEvent = (id: string, reviewNotes?: string) =>
  api.post<{ success: boolean; message: string; event: DisasterEvent }>(`/events/${id}/approve`, { reviewNotes });

export const rejectEvent = (id: string, reviewNotes: string) =>
  api.post<{ success: boolean; message: string; event: DisasterEvent }>(`/events/${id}/reject`, { reviewNotes });

// ── AI Anomaly Alerts ─────────────────────────────────────────────────────────
export const getAiAlerts = (params?: { status?: string; district?: string; limit?: number }) =>
  api.get<{ success: boolean; count: number; alerts: AiAlert[] }>('/ai-alerts', { params });

export const promoteAiAlert = (id: string, data: {
  targetStatus?: string;
  customTitle?: string;
  customDescription?: string;
  hindiTitle?: string;
  hindiDescription?: string;
  radiusKm?: number;
}) =>
  api.post<{ success: boolean; message: string; event: DisasterEvent; aiAlert: AiAlert }>(
    `/ai-alerts/${id}/promote`, data
  );

export const dismissAiAlert = (id: string, notes?: string) =>
  api.patch<{ success: boolean; message: string; aiAlert: AiAlert }>(
    `/ai-alerts/${id}/dismiss`, { notes }
  );

// ── Environmental Hazard Telemetry ───────────────────────────────────────────
export const getDistrictSummaries = (district?: string) =>
  api.get<{ success: boolean; data: DistrictSummary[] }>('/hazard-readings/district-summary', {
    params: { district },
  });

export const getHazardReadings = (params: { district?: string; indicator?: string; days?: number; limit?: number }) =>
  api.get<{ success: boolean; count: number; readings: HazardReading[] }>('/hazard-readings', { params });

// ── Situational Awareness & Citizen Check-Ins ─────────────────────────────────
export const getSituationalAwareness = (params?: { district?: string; eventId?: string }) =>
  api.get<{
    success: boolean;
    summary: SituationalAwarenessSummary;
    distressedCount: number;
    distressedList: CitizenCheckIn[];
  }>('/citizens/situational-awareness', { params });

export const acknowledgeCheckIn = (id: string) =>
  api.patch<{ success: boolean; message: string; checkIn: CitizenCheckIn }>(`/citizens/${id}/acknowledge`);

// ── Safety Guides ─────────────────────────────────────────────────────────────
export const getGuides = (params?: { disasterType?: string; language?: string }) =>
  api.get<{ success: boolean; total: number; guides: SafetyGuide[] }>('/guides', { params });

export const createGuide = (data: Partial<SafetyGuide>) =>
  api.post<{ success: boolean; guide: SafetyGuide }>('/guides', data);

export const updateGuide = (id: string, data: Partial<SafetyGuide>) =>
  api.put<{ success: boolean; guide: SafetyGuide }>(`/guides/${id}`, data);

export const deleteGuide = (id: string) =>
  api.delete(`/guides/${id}`);

// ── Alert Logs ────────────────────────────────────────────────────────────────
export const getLogs = (params?: { page?: number; limit?: number; status?: string }) =>
  api.get<{ success: boolean; total: number; page: number; pages: number; logs: AlertLog[] }>(
    '/logs', { params }
  );

export const getLogStats = () =>
  api.get<{ success: boolean; stats: AlertStats }>('/logs/stats');

export const getEventLogs = (eventId: string) =>
  api.get<{ success: boolean; stats: object; logs: AlertLog[] }>(`/logs/event/${eventId}`);

