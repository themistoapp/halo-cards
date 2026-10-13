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
  config?: { unit_system?: { temperature?: string } };
  connection: {
    subscribeMessage<T>(cb: (msg: T) => void, msg: Record<string, unknown>): Promise<() => void>;
  };
  callService(domain: string, service: string, data?: Record<string, unknown>): Promise<unknown>;
  callWS<T>(msg: Record<string, unknown>): Promise<T>;
  /** Home Assistant's own formatting (translated states and attribute names); absent in older versions. */
  formatEntityState?(stateObj: HassEntity, state?: string): string;
  formatEntityAttributeValue?(stateObj: HassEntity, attribute: string, value?: unknown): string;
  formatEntityAttributeName?(stateObj: HassEntity, attribute: string): string;
  entities?: Record<string, { device_id?: string; display_precision?: number }>;
  devices?: Record<string, { model?: string; name?: string }>;
}

export interface HaloEnergyConfig {
  type: string;
  /** Drop shadow behind the card (default on). */
  shadow?: boolean;
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
  /** Alternative to mode_entity: one switch per mode (turning one on turns the other off). */
  mode_self_entity?: string;
  mode_ai_entity?: string;
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
