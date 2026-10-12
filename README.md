# Halo Cards

Home Assistant dashboard cards. Built for the Sections view on a phone.

Each card is standalone: its own element, options and editor. Use any of them without the others. They all load from the one `halo-cards.js` resource.

| Card | Type | Size (columns × rows) |
| --- | --- | --- |
| Energy (EcoFlow Stream) | `custom:halo-energy-card` | 12 × 8 (works from 12 × 5 up) |
| Media (Sonos) | `custom:halo-media-card` | 12 × 6 and up: picture, transport, now playing and volume, with a star button that opens favourites; 12 × 3 to 12 × 4 is one card; 12 × 2 is a single row (layout follows the height) |
| Vehicle | `custom:halo-vehicle-card` | 12 × 4, 12 × 3 |
| Thermostat | `custom:halo-thermostat-card` | 12 × 7 dial, 12 × 2 compact bar |
| Weather | `custom:halo-weather-card` | 12 × 7 today or week, 12 × 2 compact |
| Solar forecast | `custom:halo-solar-card` | 12 × 6 chart, 12 × 2 compact |
| Lights | `custom:halo-light-card` | any width, height follows the number of lights |

## Install (HACS)

1. HACS → ⋮ → **Custom repositories** → add this repository, category **Dashboard**.
2. Install **Halo Cards**, then reload the browser.

Manual: copy `halo-cards.js` from a release to `/config/www/` and add it as a dashboard resource (`/local/halo-cards.js`, type JavaScript module).

## Halo Energy card (`custom:halo-energy-card`)

EcoFlow Stream card: product image with an LED strip filled to the battery level, four tiles (Solar, Battery, Grid, House) with today's history graph (tap a tile, or the LED strip, to open that entity's history in Home Assistant; the battery tile shows power with the charge % beneath), a background that blooms in proportion to where the power is coming from, a backup reserve slider and a Self-powered / AI mode pill. Default size is 12 × 8 in the Sections view; it also works down to 12 × 5. Short slots lose the picture first, then the tiles tighten, and each tile's graph only uses the space under its text.

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
| `battery_soc` | no light bar and no charge % on the battery tile |
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
players:                       # optional: one card for the whole house
  - media_player.kitchen
  - media_player.bedroom
```

- **Background:** two blooms in colours read from the album art, growing with volume (smaller when paused). Idle or off, or artwork with no colour in it (most radio logos), gives a grey bloom. Colours can only be read from artwork Home Assistant serves itself (the usual case); artwork blocked by its host also falls back to grey.
- **Speaker picture:** chosen from the device model (Beam, Arc, Ray, Era 300, One), or set `speaker: beam-sub-mini | era-300 | one | none`, or give your own `image` URL.
- **Shows only what the player supports:** shuffle, repeat, previous, next, mute and volume follow the player's features. With `players` set, the title becomes a dropdown to switch player (your choice is remembered per browser) and the other players appear top right as scrollable chips; tap to join or leave the group. `speakers` can limit the chips to a subset. Favourites come from `sensor.sonos_favorites` (enable it under Settings → Devices → Sonos → Entities), narrowed by `favourites_include` or added to with `favourites`.
- **Favourites:** the star in the transport row slides the favourites open and shrinks and zooms the speaker picture to make room. It is remembered per browser.
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
tank_size: 52             # litres; lets a % sensor show as litres. Petrol is always shown in L when it can be
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

## Halo Lights card (`custom:halo-light-card`)

Several lights as tiles. Each tile can show a fitting (downlight, pendant, horizontal or vertical light bar) whose opening glows in the light's own colour and brightness, and is dark when the light is off. Tap toggles, drag sideways dims, hold opens the light's more-info.

```yaml
type: custom:halo-light-card
name: Living room
lights:
  - entity: light.pendant
    type: pendant        # downlight | pendant | strip (horizontal bar) | pole (vertical bar) | none
  - entity: light.shelf
    name: Shelf
    type: strip
  - light.lamp           # plain entity id: icon only
show_all_off: true       # "All off" button (default on)
colour: "#ffe3bd"        # glow for lights that report no colour (default warm white)
shadow: true
```

## Halo Thermostat card (`custom:halo-thermostat-card`)

Nest-style thermostat for any `climate` entity. Tall, it is a dial of fine ticks with the target in the middle and − / + below; short (under about 230px), it becomes a compact bar with the target in the middle, − / + either side, "Now" and humidity under it, and the tick bar along the bottom. The background glows orange while heating and blue while cooling, so there is no status text. Temperatures are shown to the nearest 0.5 degrees and the target moves in 0.5 steps (or the thermostat's own step if larger). Presses are sent once you stop tapping. In heat/cool range mode, − / + move both ends of the range together.

```yaml
type: custom:halo-thermostat-card
entity: climate.hallway
name: Hallway           # optional
hvac_modes: [heat, cool, heat_cool, off]   # modes to show as buttons; leave out for everything the thermostat supports
humidity: sensor.hallway_humidity          # only if the thermostat doesn't report humidity
shadow: true
```

## Halo Weather card (`custom:halo-weather-card`)

Weather for any `weather` entity (built against Met.no). Tick any of **Current** (temperature, condition, details), **Hourly** (the next hours) and **Weekly** (a row per day with a low-to-high bar); each one makes the card taller, and the weekly list trims days to fit a short card. Short (under about two rows, with Current ticked) it becomes a compact card with the next few hours beside it. The background glows amber for sun, blue for rain, indigo at night, grey for cloud. Tap for the entity's more-info.

The forecast is not in the entity any more, so the card subscribes to Home Assistant's hourly and daily forecasts itself and hides whatever the entity doesn't offer. "Feels like" only shows if the entity has `apparent_temperature` (Met.no doesn't).

```yaml
type: custom:halo-weather-card
entity: weather.home
name: Swindon           # optional, defaults to the entity's name
sections: [current, hourly]   # any of current, hourly, weekly
details: [humidity, wind, pressure]   # under Current; up to four of: humidity, wind, pressure, cloud, dew_point, visibility
shadow: true
```

## Halo Solar Forecast card (`custom:halo-solar-card`)

Forecast.Solar for today and tomorrow (chips at the top), with your actual generation drawn over today's forecast. It shows the forecast total, what has been generated so far and how that compares with the forecast up to now, and the peak. Short (under about 230px) it becomes a compact card with a small chart.

The forecast comes from the same data as the Energy dashboard, so **Forecast.Solar must be added to the solar panels in the Energy dashboard** (Settings, Dashboards, Energy, Solar panels, "Add forecast"). With several arrays they are added together unless you name one with `forecast_entry` (its config entry id).

`actual` is your total PV power sensor (W or kW); its history since midnight is drawn as the line, and the kWh generated is worked out from it. Leave it out for a forecast-only card.

```yaml
type: custom:halo-solar-card
actual: sensor.pv_total_power     # optional
name: Solar forecast              # optional
forecast_entry: 01J...            # optional
shadow: true
```

## Development

```sh
npm install
npm run dev      # mock Home Assistant at /dev/index.html
npm test
npm run build    # dist/halo-cards.js
```

Tag `vX.Y.Z` to publish a release; the workflow attaches `halo-cards.js`.
