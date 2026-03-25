export type { User, Organization, Exposure, Trade, Provider } from "@/generated/prisma/client"
export {
  Direction,
  UploadSource,
  ExposureStatus,
  HedgingStatus,
  TradeType,
  TradeDirection,
  TradeStatus,
  UserRole,
  OrgRole,
  ProviderEnv,
} from "@/generated/prisma/client"

// Session user type
export interface SessionUser {
  id: string
  email: string
  name?: string | null
  role: string
}

// Market data snapshot
export interface MarketData {
  fixSpot: number
  fixDate: string
  tiie28: number
  tiie28Date: string
  tiie91: number
  tiie91Date: string
  sofr: number
  sofrDate: string
}

// Simulation inputs
export interface SimulationInputs {
  direction: "pay" | "receive"
  foreignCurrency: string
  localCurrency: string
  settlementDate: Date
  notional: number
  hedgeRatios: number[]
}

// Simulation result per scenario
export interface SimulationScenario {
  startDate: string
  historicalStartSpot: number
  historicalEndSpot: number
  pctMove: number
  demeanedMove: number
  simulatedSpot: number
  unhedgedLocal: number
  [key: string]: number | string // hedged_XX columns
}

// Simulation summary per strategy
export interface StrategySummary {
  strategy: string
  worstCase: number
  bestCase: number
  average: number
}

// Pricing details
export interface PricingDetails {
  spotReference: number
  syntheticForward: number
  forwardPoints: number
  calendarDays: number
  impliedMxnRate: number
  usdRateProxy: number
  pairLabel: string
}
