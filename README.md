# Halo Cards

Home Assistant dashboard cards. Built for the Sections view on a phone.

Each card is standalone: its own element, options and editor. Use any of them without the others. They all load from the one `halo-cards.js` resource.

| Card | Type | Size (columns × rows) |
| --- | --- | --- |
| Energy (EcoFlow Stream) | `custom:halo-energy-card` | 12 × 12 |
| Media (Sonos) | `custom:halo-media-card` | 12 × 12, 12 × 4, 12 × 2 (picks the layout from the height you drag it to) |
| Vehicle | `custom:halo-vehicle-card` | 12 × 4, 12 × 3 |

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

## Halo Media card (`custom:halo-media-card`)

Sonos or any media player. Only `entity` is required.

```yaml
type: custom:halo-media-card
entity: media_player.living_room
speakers: [media_player.kitchen, media_player.bedroom]   # optional: group chips
```

- **Background:** two blooms in colours read from the album art, growing with volume (smaller when paused). Idle or off, or artwork with no colour in it (most radio logos), gives a grey bloom. Colours can only be read from artwork Home Assistant serves itself (the usual case); artwork blocked by its host also falls back to grey.
- **Speaker picture:** chosen from the device model (Beam, Arc, Ray, Era 300, One), or set `speaker: beam-sub-mini | era-300 | one | none`, or give your own `image` URL.
- **Shows only what the player supports:** shuffle, repeat, previous, next, mute and volume follow the player's features. Group chips show only if you list `speakers`; tap to join or leave. Favourites come from `sensor.sonos_favorites` (enable it under Settings → Devices → Sonos → Entities), narrowed by `favourites_include` or added to with `favourites`.
- Streams with no duration show "Live". Grouped speakers follow the member that is playing.

## Halo Vehicle card (`custom:halo-vehicle-card`)

Compact car card with a level bar. Every entity is optional.

```yaml
type: custom:halo-vehicle-card
name: M140i
fuel_type: ice            # ice or ev
image_preset: m140i       # none, m140i, e-vivaro (or image: URL)
colour: "#b3262f"         # the background is built from this
level: sensor.m140i_fuel
tank_size: 52             # only if the sensor reports litres, not %
range: sensor.m140i_range
odometer: sensor.m140i_odometer
lock: lock.m140i
location: device_tracker.m140i
```

For an electric vehicle use `fuel_type: ev` and `charging: binary_sensor.van_charging` instead of `lock` / `tank_size`.

- **Chip:** the location's zone name (Home, Depot), or Away. Hidden with no location.
- **Bar:** petrol is a red gradient (the figure turns orange at `low_level`, default 20, and red at `critical_level`, default 10). Electric is black or white, orange or red when low, and green and flowing while charging.
- **Status pill:** Locked or Unlocked for petrol, Charging or Not charging for electric. Tap it for the entity's more-info.
- **Layout:** 12 × 4 puts the car above the figures; 12 × 3 puts it on the left.

All cards accept `shadow: false` to turn off the Halo drop shadow (default on).

## Development

```sh
npm install
npm run dev      # mock Home Assistant at /dev/index.html
npm test
npm run build    # dist/halo-cards.js
```

Tag `vX.Y.Z` to publish a release; the workflow attaches `halo-cards.js`.
