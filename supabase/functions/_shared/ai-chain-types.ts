import type { AiConfig } from "./prova.ts";
export interface AiChain {
  id: string;
  usage_key: string;
  plan: string;
  updated_at: string;
  on_rate_limit: boolean;
  on_server_error: boolean;
  on_timeout: boolean;
  attempt_seconds: number;
  total_seconds: number;
  steps: {
    position: number;
    active: boolean;
    paused: boolean;
    config: AiConfig;
  }[];
}
