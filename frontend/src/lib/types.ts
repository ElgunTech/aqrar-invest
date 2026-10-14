// Mirrors the Spring Boot DTOs (az.agro.portal.dto.*)

export interface Label {
  code: string;
  label: string;
}

export interface CompetitionRef {
  id: number;
  code: string;
  title: string;
  deadline: string;
  daysLeft: number;
}

export interface CropRef {
  code: string;
  name: string;
  probability: number;
}

export interface Plot {
  id: number;
  code: string;
  cadastreNumber: string | null;
  title: string;
  district: string;
  village: string | null;
  latitude: number;
  longitude: number;
  areaHa: number;
  activityType: Label;
  soilType: string | null;
  nitrogen: number;
  phosphorus: number;
  potassium: number;
  ph: number;
  avgTemperature: number;
  humidity: number;
  rainfall: number;
  waterSourceKm: number;
  roadKm: number;
  irrigationAvailable: boolean;
  electricityAvailable: boolean;
  mineClearance: Label;
  mineClearanceDate: string | null;
  leaseYears: number;
  minInvestment: number;
  usageTerms: string | null;
  description: string | null;
  status: Label;
  openCompetition: CompetitionRef | null;
  applicationCount: number;
  aiTopCrop: CropRef | null;
}

export interface CropScore {
  code: string;
  name: string;
  probability: number;
  regionSuitable: boolean;
}

export interface CropRecommendation {
  modelLoaded: boolean;
  engine: string;
  modelName: string;
  modelVersion: string;
  testAccuracy: number | null;
  recommendations: CropScore[];
  rawTop: CropScore[];
  outOfRange: string[];
  explanation: string;
}

export interface SoilClimate {
  nitrogen: number;
  phosphorus: number;
  potassium: number;
  temperature: number;
  humidity: number;
  ph: number;
  rainfall: number;
}

export interface MatchReason {
  text: string;
  positive: boolean;
}

export interface MatchResult {
  plot: Plot;
  score: number;
  reasons: MatchReason[];
}

export interface PlotRef {
  id: number;
  code: string;
  title: string;
  district: string;
  areaHa: number;
  activityLabel: string;
}

export interface Competition {
  id: number;
  code: string;
  title: string;
  description: string | null;
  requirements: string | null;
  startDate: string | null;
  deadline: string;
  daysLeft: number;
  open: boolean;
  status: Label;
  plots: PlotRef[];
  createdBy: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
  reviewNote: string | null;
  applicationCount: number;
  createdAt: string;
}

export interface User {
  id: number;
  email: string;
  fullName: string;
  role: "INVESTOR" | "EVALUATOR" | "ADMIN";
  roleLabel: string;
  phone: string | null;
  taxId: string | null;
  unreadNotifications: number;
}

export interface DocumentInfo {
  id: number;
  type: Label;
  originalName: string;
  contentType: string;
  sizeBytes: number;
  uploadedAt: string;
}

export interface HistoryEntry {
  fromStatus: Label | null;
  toStatus: Label | null;
  comment: string | null;
  changedBy: string;
  changedAt: string;
}

export interface ScoreItem {
  criterion: string;
  points: number;
  max: number;
  note: string;
}

export interface Application {
  id: number;
  applicationNumber: string;
  status: Label;
  competitionId: number;
  competitionCode: string;
  competitionTitle: string;
  plotId: number;
  plotCode: string;
  plotTitle: string;
  district: string;
  applicantType: Label;
  applicantName: string;
  taxId: string;
  phone: string;
  email: string;
  address: string | null;
  activityType: Label;
  plannedCrop: string | null;
  plannedCropName: string | null;
  plannedInvestment: number;
  ownFundsPercent: number;
  jobsCreated: number;
  projectMonths: number;
  experienceYears: number;
  businessPlan: string;
  score: { total: number; items: ScoreItem[] };
  decisionNote: string | null;
  ektisStatus: Label;
  ektisReference: string | null;
  createdAt: string;
  updatedAt: string;
  documents: DocumentInfo[];
  history: HistoryEntry[];
  allowedNext: Label[];
}

export interface ApplicationListItem {
  id: number;
  applicationNumber: string;
  applicantName: string;
  taxIdMasked: string;
  competitionTitle: string;
  plotCode: string;
  plotTitle: string;
  district: string;
  activityType: Label;
  plannedInvestment: number;
  autoScore: number;
  status: Label;
  ektisStatus: Label;
  createdAt: string;
  updatedAt: string;
}

export interface Notification {
  id: number;
  title: string;
  message: string;
  link: string;
  read: boolean;
  createdAt: string;
}

export interface Meta {
  activityTypes: Label[];
  mineClearance: Label[];
  plotStatuses: Label[];
  applicationStatuses: Label[];
  applicantTypes: Label[];
  documentTypes: Label[];
  districts: string[];
  crops: Label[];
}

export interface PublicStats {
  plotCount: number;
  totalAreaHa: number;
  openCompetitions: number;
  applicationCount: number;
  plannedInvestment: number;
  plannedJobs: number;
  approvedCount: number;
  decidedCount: number;
  clearedPlots: number;
  byDistrict: Record<string, number>;
  byActivity: Record<string, number>;
  applicationsByStatus: Record<string, number>;
  investmentByDistrict: Record<string, number>;
}

export interface Dashboard extends PublicStats {
  applicationsPerDay: Record<string, number>;
  statusCounts: Record<string, number>;
  pendingApprovalCompetitions: number;
  averageAutoScore: number;
  ektisVerified: number;
}

export interface IntegrationEvent {
  id: number;
  direction: "OUTBOUND" | "INBOUND";
  eventType: string;
  aggregateId: string;
  status: Label;
  attempts: number;
  lastError: string | null;
  externalReference: string | null;
  payload: string;
  createdAt: string;
  processedAt: string | null;
}

export interface AuditEntry {
  id: number;
  actor: string;
  action: string;
  entityType: string | null;
  entityId: string | null;
  details: string | null;
  ipAddress: string | null;
  createdAt: string;
}

export interface ModelInfo {
  modelLoaded: boolean;
  engine: string;
  modelName?: string;
  version?: string;
  classes?: number;
  metrics?: { cv_accuracy: number; test_accuracy: number; test_macro_f1: number };
  featureImportance?: Record<string, number>;
  modelComparison?: Record<string, number>;
  dataset?: string;
  trainedAt?: string;
}
