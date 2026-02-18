// ============================================================
// Lexia Estratega – TypeScript types
// ============================================================

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical'
export type ScenarioType = 'conservative' | 'moderate' | 'aggressive'
export type TimelinePhase = 'preparation' | 'negotiation' | 'litigation' | 'resolution'

// ── Risk Analysis ────────────────────────────────────────────

export interface RiskFactor {
  id: string
  name: string
  description: string
  score: number          // 0–10
  level: RiskLevel
  category: string       // e.g. "probatorio", "procesal", "económico"
  mitigation: string
}

export interface RiskMatrix {
  factors: RiskFactor[]
  overallScore: number
  riskLevel: RiskLevel
  summary: string
  recommendations: string[]
}

// ── Jurisprudence ────────────────────────────────────────────

export interface Jurisprudence {
  title: string
  court: string
  date: string
  summary: string
  relevance: string
  keyArguments: string[]
  url?: string
  indemnizationAmount?: string
}

// ── Scenarios ────────────────────────────────────────────────

export interface ScenarioAction {
  action: string
  timeframe: string
  priority: 'high' | 'medium' | 'low'
}

export interface StrategicScenario {
  type: ScenarioType
  name: string
  successProbability: number  // 0–100
  estimatedDurationMonths: number
  estimatedCostRange: { min: number; max: number }
  pros: string[]
  cons: string[]
  recommendedActions: ScenarioAction[]
  description: string
}

// ── Timeline ─────────────────────────────────────────────────

export interface TimelineMilestone {
  id: string
  title: string
  description: string
  phase: TimelinePhase
  estimatedDate: string    // ISO date string
  isCritical: boolean
  dependencies: string[]   // milestone ids
  alerts: string[]
}

export interface StrategicTimeline {
  phases: {
    phase: TimelinePhase
    name: string
    startDate: string
    endDate: string
    milestones: TimelineMilestone[]
  }[]
  criticalPath: string[]   // milestone ids on critical path
  totalEstimatedMonths: number
  alerts: string[]
}

// ── Recommendations ──────────────────────────────────────────

export interface StrategicRecommendations {
  primaryStrategy: ScenarioType
  reasoning: string
  nextSteps: string[]
}

// ── Full Analysis ────────────────────────────────────────────

export interface StrategicAnalysis {
  caseId: string
  caseNumber: string
  caseTitle: string
  analyzedAt: string
  riskMatrix: RiskMatrix
  scenarios: StrategicScenario[]
  jurisprudence: Jurisprudence[]
  timeline: StrategicTimeline
  recommendations: StrategicRecommendations
  metadata: {
    analysisVersion: string
    tokensUsed: number
    durationMs: number
  }
}

// ── API ──────────────────────────────────────────────────────

export interface AnalyzeParams {
  caseId: string
  caseNumber: string
  caseTitle: string
  caseType: string
  description: string
  filingDate?: string | null
  jurisdiction?: string | null
  courtName?: string | null
  estimatedValue?: number | null
}

export interface AnalysisRecord {
  id: string
  caseId: string | null
  analysis: StrategicAnalysis
  createdAt: string
  updatedAt: string
}
