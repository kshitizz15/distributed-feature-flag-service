
export type Environment = "development" | "staging" | "production";

export type TargetingRule = {
  id?: string;
  attribute: string;
  operator: "equals" | "contains" | "starts_with";
  value: string;
  rolloutPercentage?: number | null;
  priority?: number;
};

export type FeatureFlag = {
  id?: string;
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
  default_value?: boolean;
};

export type EvaluationResponse = {
  flag_key: string;
  user_id: string;
  environment: string;
  enabled: boolean;
  percentage: number;
  reason: string;
};

const API_BASE_URL = (
  import.meta.env["VITE_FEATURE_FLAGS_API_URL"] ||
  import.meta.env["VITE_API_BASE_URL"] ||
  "http://localhost:8080"
).replace(/\/$/, "");

const REGION_B_URL = (
  import.meta.env["VITE_FEATURE_FLAGS_REGION_B_URL"] ||
  "http://localhost:8002"
).replace(/\/$/, "");

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
    throw new Error(detail || `Request failed: ${response.status}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

// Convert backend snake_case response into frontend camelCase.
function fromApiFlag(data: any): FeatureFlag {
  return {
    id: data.id,
    key: data.key,
    name: data.name,
    description: data.description ?? "",
    enabled: data.enabled,
    percentage: data.percentage,
    environment: data.environment,
    targetingRules: (data.targeting_rules ?? []).map((rule: any) => ({
      id: rule.id,
      attribute: rule.attribute,
      operator: rule.operator,
      value: rule.value,
      rolloutPercentage: rule.rollout_percentage,
      priority: rule.priority,
    })),
    updatedAt: data.updated_at ?? data.created_at ?? "",
  };
}

// Convert frontend camelCase fields into backend snake_case.
function toApiFlag(flag: Partial<FeatureFlag>) {
  const payload: Record<string, unknown> = {};

  if (flag.key !== undefined) payload.key = flag.key;
  if (flag.name !== undefined) payload.name = flag.name;
  if (flag.description !== undefined) payload.description = flag.description;
  if (flag.enabled !== undefined) payload.enabled = flag.enabled;
  if (flag.percentage !== undefined) payload.percentage = flag.percentage;
  if (flag.environment !== undefined) payload.environment = flag.environment;

  if (flag.targetingRules !== undefined) {
    payload.targeting_rules = flag.targetingRules.map((rule) => ({
      attribute: rule.attribute,
      operator: rule.operator,
      value: rule.value,
      rollout_percentage: rule.rolloutPercentage ?? null,
      priority: rule.priority ?? 0,
    }));
  }

  return payload;
}

export function isValidRolloutPercentage(value: number): boolean {
  return Number.isInteger(value) && value >= 0 && value <= 100;
}

export const featureFlagsApi = {
  baseUrl: API_BASE_URL,

  health: (baseUrl = API_BASE_URL) =>
    request<Record<string, unknown>>("/health", undefined, baseUrl),

  list: async (environment?: Environment) => {
    const query = environment
      ? `?environment=${encodeURIComponent(environment)}`
      : "";

    const data = await request<any[]>(`/api/v1/feature-flags${query}`);
    return data.map(fromApiFlag);
  },

  create: async (flag: Omit<FeatureFlag, "updatedAt" | "id">) => {
    const data = await request<any>("/api/v1/feature-flags", {
      method: "POST",
      body: JSON.stringify(toApiFlag(flag)),
    });

    return fromApiFlag(data);
  },

  get: async (flagKey: string) => {
    const data = await request<any>(
      `/api/v1/feature-flags/${encodeURIComponent(flagKey)}`
    );

    return fromApiFlag(data);
  },

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

  delete: (flagKey: string) =>
    request<void>(
      `/api/v1/feature-flags/${encodeURIComponent(flagKey)}`,
      { method: "DELETE" }
    ),

  evaluate: (input: EvaluationRequest) =>
    request<EvaluationResponse>("/api/v1/evaluate", {
      method: "POST",
      body: JSON.stringify(input),
    }),
};

export const regionEndpoints = {
  regionA: API_BASE_URL,
  regionB: REGION_B_URL,
};
