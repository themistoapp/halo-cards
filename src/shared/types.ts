export interface HassEntity {
  entity_id: string;
  state: string;
  attributes: Record<string, any>;
  last_updated: string;
  last_changed: string;
}

export interface HomeAssistant {
  states: Record<string, HassEntity>;
  themes?: { darkMode?: boolean };
  locale?: { language?: string };
  connection: {
    subscribeMessage<T>(cb: (msg: T) => void, msg: Record<string, unknown>): Promise<() => void>;
  };
  callService(domain: string, service: string, data?: Record<string, unknown>): Promise<unknown>;
  callWS<T>(msg: Record<string, unknown>): Promise<T>;
  entities?: Record<string, { device_id?: string }>;
  devices?: Record<string, { model?: string; name?: string }>;
}

export interface HaloEnergyConfig {
  type: string;
  name?: string;
  solar_power?: string;
  solar_energy?: string;
  solar_forecast?: string;
  battery_soc?: string;
  battery_power?: string;
  grid_power?: string;
  grid_cost?: string;
  home_power?: string;
  reserve_entity?: string;
  mode_entity?: string;
  updated_entity?: string;
  /** Option names on mode_entity. Defaults match EcoFlow's "Self-powered" and "AI". */
  mode_self?: string;
  mode_ai?: string;
  /** Flip the sign convention if your sensors report battery + = charging / grid + = export. */
  battery_invert?: boolean;
  grid_invert?: boolean;
  /** Below this many watts a flow counts as idle. */
  idle_watts?: number;
  /** Hour of day (0-23) the history graphs start from. */
  history_start_hour?: number;
}
