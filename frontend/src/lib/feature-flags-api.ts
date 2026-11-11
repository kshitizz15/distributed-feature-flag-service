
export type Environment = "development" | "staging" | "production";

export type TargetingRule = {
  attribute: string;
  operator: "equals" | "contains" | "starts_with";
  value: string;
};

export type FeatureFlag = {
  key: string;
  name: string;
  description: string;
  enabled: boolean;
  percentage: number;
  environment: Environment;
  targetingRules: TargetingRule[];
  updatedAt: string;
};

export type EvaluationRequest = {
  flag_key: string;
  user_id: string;
  environment: Environment;
};

export type EvaluationResponse = {
  enabled?: boolean;
  reason?: string;
  region?: string;
  [key: string]: unknown;
};

export function isValidRolloutPercentage(value: number): boolean {
  return Number.isInteger(value) && value >= 0 && value <= 100;
}

// Main API through Nginx
const API_BASE_URL = (
  import.meta.env.VITE_FEATURE_FLAGS_API_URL ||
  "http://localhost:8080"
).replace(/\/+$/, "");

// Direct Region A backend
const REGION_A_URL = (
  import.meta.env.VITE_FEATURE_FLAGS_REGION_A_URL ||
  "http://localhost:8001"
).replace(/\/+$/, "");

// Direct Region B backend
const REGION_B_URL = (
  import.meta.env.VITE_FEATURE_FLAGS_REGION_B_URL ||
  "http://localhost:8002"
).replace(/\/+$/, "");

async function request<T>(
  path: string,
  init?: RequestInit,
  baseUrl = API_BASE_URL
): Promise<T> {
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(
      detail || `Request failed with status ${response.status}`
    );
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const text = await response.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

// Convert backend snake_case response into frontend camelCase.
function fromApiFlag(flag: any): FeatureFlag {
  return {
    key: flag.key,
    name: flag.name,
    description: flag.description ?? "",
    enabled: flag.enabled,
    percentage: flag.percentage ?? flag.rollout_percentage ?? 100,
    environment: flag.environment ?? "development",
    targetingRules: flag.targeting_rules ?? flag.targetingRules ?? [],
    updatedAt: flag.updated_at ?? flag.updatedAt ?? "Recently",
  };
}

// Convert frontend camelCase into backend snake_case.
function toApiFlag(flag: Partial<FeatureFlag>) {
  const result: Record<string, unknown> = {};

  if (flag.key !== undefined) result.key = flag.key;
  if (flag.name !== undefined) result.name = flag.name;
  if (flag.description !== undefined) result.description = flag.description;
  if (flag.enabled !== undefined) result.enabled = flag.enabled;
  if (flag.percentage !== undefined) result.percentage = flag.percentage;
  if (flag.environment !== undefined) result.environment = flag.environment;

  if (flag.targetingRules !== undefined) {
    result.targeting_rules = flag.targetingRules;
  }

  return result;
}

export const featureFlagsApi = {
  baseUrl: API_BASE_URL,

  health: (baseUrl = API_BASE_URL) =>
    request<Record<string, unknown>>("/health", undefined, baseUrl),

  // GET all feature flags
  list: async (environment?: Environment): Promise<FeatureFlag[]> => {
    const query = environment
      ? `?environment=${encodeURIComponent(environment)}`
      : "";

    const data = await request<any>(
      `/api/v1/feature-flags${query}`
    );

    const flags = Array.isArray(data)
      ? data
      : data.flags ?? data.feature_flags ?? data.items ?? [];

    return flags.map(fromApiFlag);
  },

  // POST create a feature flag
  create: async (flag: Omit<FeatureFlag, "updatedAt">) => {
    const data = await request<any>("/api/v1/feature-flags", {
      method: "POST",
      body: JSON.stringify(toApiFlag(flag)),
    });

    return fromApiFlag(data);
  },

  // GET one feature flag
  get: async (flagKey: string) => {
    const data = await request<any>(
      `/api/v1/feature-flags/${encodeURIComponent(flagKey)}`
    );

    return fromApiFlag(data);
  },

  // PATCH update a feature flag
  update: async (flagKey: string, updates: Partial<FeatureFlag>) => {
    const data = await request<any>(
      `/api/v1/feature-flags/${encodeURIComponent(flagKey)}`,
      {
        method: "PATCH",
        body: JSON.stringify(toApiFlag(updates)),
      }
    );

    return fromApiFlag(data);
  },

  // DELETE a feature flag
  delete: (flagKey: string) =>
    request<void>(
      `/api/v1/feature-flags/${encodeURIComponent(flagKey)}`,
      { method: "DELETE" }
    ),

  // POST evaluate a feature flag
  evaluate: (input: EvaluationRequest) =>
    request<EvaluationResponse>("/api/v1/evaluate", {
      method: "POST",
      body: JSON.stringify(input),
    }),
};

// Direct endpoints for region health checks
export const regionEndpoints = {
  regionA: REGION_A_URL,
  regionB: REGION_B_URL,
};
