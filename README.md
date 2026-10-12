# Halo Cards

Home Assistant dashboard cards. Built for the Sections view on a phone.

## Install (HACS)

1. HACS → ⋮ → **Custom repositories** → add this repository, category **Dashboard**.
2. Install **Halo Cards**, then reload the browser.

Manual: copy `halo-cards.js` from a release to `/config/www/` and add it as a dashboard resource (`/local/halo-cards.js`, type JavaScript module).

## Halo Energy card (`custom:halo-energy-card`)

EcoFlow Stream card: product image with an LED strip filled to the battery level, four tiles (Solar, Battery, Grid, House) with today's history graph, a background that blooms in proportion to where the power is coming from, a backup reserve slider and a Self-powered / AI mode pill. Default size is 12 × 12 in the Sections view.

```yaml
type: custom:halo-energy-card
name: EcoFlow Stream
solar_power: sensor.solar_power
solar_energy: sensor.solar_energy_today
solar_forecast: sensor.solar_forecast_today
battery_soc: sensor.stream_battery_level
battery_power: sensor.stream_battery_power
grid_power: sensor.grid_power
grid_cost: sensor.grid_cost_today
home_power: sensor.home_power
reserve_entity: number.stream_backup_reserve
mode_entity: select.stream_operating_mode
```

Every entity is optional. Anything missing or unavailable is hidden:

| Missing | Effect |
| --- | --- |
| a tile's power entity | that tile is hidden and the grid re-flows (4 → 2×2, 3 → last tile spans, 2 → stacked, 1 → one tall tile) |
| `battery_soc` | no light bar; the battery tile shows power instead |
| `reserve_entity` / `mode_entity` | slider / pill hidden; the control tile goes when both are gone |
| `solar_energy`, `solar_forecast`, `grid_cost` | the detail line drops that part |
| no history | graph hidden |
| no power entity for a source | no bloom for it |

| Option | Default | |
| --- | --- | --- |
| `name` | `EcoFlow Stream` | Header title |
| `updated_entity` | newest of the above | Entity whose `last_updated` drives the "Updated" chip |
| `mode_self` / `mode_ai` | `Self-powered` / `AI` | Option names on the select. If they don't match, the first two options are used |
| `battery_invert` | `false` | Set if positive battery power means charging |
| `grid_invert` | `false` | Set if positive grid power means export |
| `idle_watts` | `10` | Below this a flow reads Idle |
| `history_start_hour` | `7` | Graphs run from this hour to now (last six hours early in the day) |

Power entities may report W or kW (read from `unit_of_measurement`; no unit means W).

## Development

```sh
npm install
npm run dev      # mock Home Assistant at /dev/index.html
npm test
npm run build    # dist/halo-cards.js
```

Tag `vX.Y.Z` to publish a release; the workflow attaches `halo-cards.js`.
