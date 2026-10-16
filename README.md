# Halo Cards

Home Assistant dashboard cards. Built for the Sections view on a phone.

Each card is standalone: its own element, options and editor. Use any of them without the others. They all load from the one `halo-cards.js` resource.

Numbers, times and dates follow your Home Assistant profile: language, number format (decimal comma or point) and 12- or 24-hour clock.

| Card | Type | Size (columns × rows) |
| --- | --- | --- |
| Energy (EcoFlow Stream) | `custom:halo-energy-card` | 12 × 8 (works from 12 × 5 up) |
| Media (Sonos) | `custom:halo-media-card` | 12 × 6 and up: picture, transport, now playing and volume, with a star button that opens favourites; 12 × 3 to 12 × 4 is one card; 12 × 2 is a single row (layout follows the height) |
| Vehicle | `custom:halo-vehicle-card` | 12 × 4, 12 × 3 |
| Thermostat | `custom:halo-thermostat-card` | 12 × 7 dial, 12 × 2 compact bar |
| Weather | `custom:halo-weather-card` | 12 × 7 today or week, 12 × 2 compact |
| Graph (solar forecast, Agile rates and more) | `custom:halo-graph-card` | 12 × 6 chart, 12 × 2 compact |
| Lights | `custom:halo-light-card` | any width, height follows the number of lights |
| Entity | `custom:halo-entity-card` | 3 × 2 small, 6 × 3 large (with a graph or gauge) |
| Today | `custom:halo-today-card` | 12 wide; height follows what is showing. 4 boxes across from 640 px wide (wall panel) |
| Title | `custom:halo-title-card` | 12 × 2 greeting or date, 12 × 1 heading |

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
| `mode_self_entity` / `mode_ai_entity` | none | Use these instead of `mode_entity` when each mode is its own switch. Tapping a mode turns its switch on (and the other off) |
| `battery_invert` | `false` | Set if positive battery power means charging |
| `grid_invert` | `false` | Set if positive grid power means export |
| `idle_watts` | `10` | Below this a flow reads Idle |
| `history_start_hour` | `7` | Graphs run from this hour to now (last six hours early in the day) |

Power entities may report W or kW (read from `unit_of_measurement`; no unit means W). Hero figures are always shown in W.

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
- **Shows only what the player supports:** shuffle, previous, next, mute and volume follow the player's features. With `players` set, the title becomes a dropdown to switch player (your choice is remembered per browser) and the other players appear top right as scrollable chips; tap to join or leave the group. `speakers` can limit the chips to a subset. Favourites come from `sensor.sonos_favorites` (enable it under Settings → Devices → Sonos → Entities), narrowed by `favourites_include` or added to with `favourites`.
- **Favourites:** the star in the transport row slides the favourites up as a translucent panel over the bottom of the speaker picture, just above the transport. It is remembered per browser.
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

## Halo Entity card (`custom:halo-entity-card`)

One reading as a tile, laid out like the tiles on the Energy card: a chip with the icon and name, the figure, a line below, and under it a history graph (large tiles), a gauge (any size) or nothing. Each tile is its own card, so you place, reorder and resize tiles in the Sections view like any other card, and Home Assistant's visibility conditions work per tile.

- **Size:** `small` (3 × 2, a quarter of a section) or `large` (6 × 3, half). The card reads the space it is given, so dragging a small tile to six columns wide makes it large. Small tiles never show a graph.
- **Value:** any entity's state, or one of its attributes (a thermostat's humidity, a weather entity's wind speed): the editor lists each with its current reading. Attributes get a unit where one can be told; `unit` and `decimals` override.
- **Icon:** the entity's own, any `mdi:` icon, or your own SVG in `icon_svg` (pasted `<svg>` markup, a 24 × 24 path, or a URL such as `/local/icons/boiler.svg`; black follows the text colour and white follows the card; scripts, event handlers and outside links are removed). `icon_colour` tints it.
- **Look (`theme`):** `plain` (the card background), `light` (black on white) and `dark` (white on black), which stay as they are at night, and fifteen grainy gradients that go a little deeper at night: `dusk`, `slate`, `ember`, `solar`, `battery`, `grid`, `ocean`, `glacier`, `aurora`, `forest`, `rose`, `plum`, `sunset`, `sand`, `graphite`.
- **Line below:** your own text (`secondary_text`) or another entity (`secondary_entity`, shown as its name then its value).
- **Below the figure (`display`):** `graph`, `gauge` or `none` (the default). Configs from before 0.21 with `graph: true` keep their graph.
- **Gauge (any size):** `gauge_style` is `ring` (the figure inside it; the default), `line` (a bar under the figure) or `semicircle` (the figure in its bowl). It runs from `gauge_min` to `gauge_max`; leave them out and percentages run 0 to 100, number and input_number entities use their own min and max, and anything else uses 0 to 100, so set both for power, temperature and the like. Readings outside the range pin the gauge at the end. `gauge_colour` is a palette name or any CSS colour (default: the icon colour); the fill goes light to deep by day and dark to bright at night, and white on gradients. `gauge_labels: false` hides the min and max under the line and semicircle; `gauge_bands: true` draws each colour rule's stretch faintly along the track. Gauges work on attributes as well as states. Short, wide tiles (6 × 2) put the ring or semicircle beside the figure.
- **Graph (large tiles):** `display: graph` draws the state's history along the bottom, over `graph_hours` (1 to 168, default 24). Up to a day it uses full history; longer periods use Home Assistant's hourly statistics, for sensors that have them. Power, energy and money start from zero, percentages run 0 to 100, and anything else fits its own range; `graph_scale` (`zero` or `range`), `graph_min` and `graph_max` override that. Only numeric states, not attributes.
- **Colours:** `icon_colour` and `graph_colour` are separate. Pick `grey`, `red`, `orange`, `yellow`, `green`, `teal`, `blue`, `purple` or `pink` (each has a day and a night shade), or give any CSS colour. On gradients the graph is white.
- **Colour by value:** `colour_rules` recolour the icon and the graph or gauge. The first rule the value meets wins; give `above`, `below`, or both for a band.
- **Actions:** `tap_action` (default: more-info), `hold_action` and `double_tap_action` (default: nothing), in Home Assistant's usual format: `more-info`, `toggle`, `navigate`, `url`, `perform-action` or `none`, with optional `confirmation`.

```yaml
type: custom:halo-entity-card
entity: sensor.office_co2
name: Office
size: large
display: graph
graph_hours: 24
graph_colour: teal
icon_colour: teal
colour_rules:
  - { above: 1000, colour: red }
  - { above: 800, colour: orange }
secondary_text: Window closed
hold_action: { action: navigate, navigation_path: /dashboard-home/office }
```

```yaml
type: custom:halo-entity-card
entity: sensor.solar_power
name: Solar
size: large
display: gauge
gauge_style: semicircle
gauge_min: 0
gauge_max: 4000
gauge_colour: yellow
secondary_entity: sensor.solar_energy_today
secondary_name: Today
```

```yaml
type: custom:halo-entity-card
entity: climate.hallway
attribute: current_humidity   # an attribute instead of the state
name: Humidity
theme: ocean
icon: mdi:water-percent
```

## Halo Today card (`custom:halo-today-card`)

Today at a glance: a greeting, then boxes for whatever matters right now. Boxes sort themselves: anything **happening now** first (music playing, an event in progress, a cheap Agile slot you're in), then anything that **needs doing** (bins going out tonight, a vehicle running low), then what's **soon** (an event within the hour, bins within 48 hours, rain or a cheap slot within two hours), then the rest in the order you choose. Half-width boxes pair up; one left on its own goes full width. Boxes slide to their new place when the order changes.

| Box | Shows | When |
| --- | --- | --- |
| Calendar | Your next two events, with time left on one that's on now or a countdown to the next, and the rest of the day underneath | Whenever there's something in the next week. Looks ahead to tomorrow once today is done |
| Weather | Now, high and low, and the next 8 hours with the chance of rain | Always, when set |
| Bins | Each bin with days to go. "Out tonight" from 17:00 the day before | Only within 48 hours of a collection |
| Vehicles | Picture, level and range, with Fill up or Plug in | Only below 30%, and not while charging |
| Cheapest Agile slots | The three cheapest half-hours still to come (tonight's in the evening, once tomorrow's rates are out), marked Now, Next or Plunge | Whenever rates are set |
| Now playing | Artwork, track, room and pause | Only while one of your speakers is playing; the one that started last if several are |

Calendars: any calendar in Home Assistant works. Google Calendar and CalDAV (iCloud, Fastmail, Nextcloud) have built-in integrations; for Outlook or any calendar you can share as a link, add the built-in **Remote Calendar** integration and paste its `.ics` address; **Local Calendar** keeps a household calendar in Home Assistant itself.

Bins: a sensor whose state or attributes give the next date works, including [UK Bin Collection Data](https://github.com/robbrad/UKBinCollectionData) (`next_collection`, `days`) and [Waste Collection Schedule](https://github.com/mampfes/hacs_waste_collection_schedule) (`daysTo`), a date helper, or a bin calendar (each bin matches events by `match`, or by its name).

The greeting: 282 lines across 30 situations (bin night, rain on the way, a busy or empty day, a birthday, cheap or negative Agile prices, a low battery, the same song on repeat, Monday mornings, late nights…) in three tones: `polite`, `cheeky` or `rude`. The card collects everything that's true right now, keeps one line for the hour, and shows another when tapped. `watershed: true` keeps Rude for after 21:00 (Cheeky before). Add your own lines per situation in the editor; they can use `{name}`, `{bin}`, `{time}`, `{temp}`, `{event}`, `{mins}`, `{who}`, `{car}`, `{pct}`, `{cheap}`, `{artist}`, `{track}` and `{n}`.

Everything is set in the visual editor: title style, tone, watershed, which boxes and their order, calendars and colours, bins, vehicles, Agile, speakers and your own greetings.

```yaml
type: custom:halo-today-card
header: greeting               # greeting | date | none
greeting: cheeky               # polite | cheeky | rude
watershed: true                # rude only after watershed_from (21:00)
name: Sam                      # optional; defaults to whoever is signed in
boxes: [calendar, weather, bins, vehicles, agile, media]   # which, and their order within a tier
calendars:
  - { entity: calendar.family, colour: "#e0568a" }
  - { entity: calendar.work, colour: "#2f7bff" }
weather: weather.home
bins:
  - { name: Recycling, colour: blue, entity: sensor.recycling_next }
  - { name: Waste, colour: black, entity: sensor.waste_next }
bins_within: 48                # hours before a collection the box appears
bins_out_from: "17:00"
vehicles:
  - { name: M140i, kind: ice, image_preset: m140i, level: sensor.m140i_fuel, range: sensor.m140i_range }
  - { name: e-Vivaro, kind: ev, image_preset: e-vivaro, level: sensor.van_battery, range: sensor.van_range, charging: binary_sensor.van_charging }
low_below: 30
rates_today: event.octopus_energy_electricity_xxx_current_day_rates
rates_tomorrow: event.octopus_energy_electricity_xxx_next_day_rates
agile_slots: 3
media: [media_player.kitchen, media_player.living_room]
greetings:
  - { trigger: binsTonight, tone: any, text: "The bins won't walk themselves, {name}." }
```

## Halo Title card (`custom:halo-title-card`)

The Today card's title on its own. **Greeting**: the date and a greeting that follows the time of day and, with a weather entity, rain, cold, heat and wind, in the same three tones. **Big date**: the day as a big number with the weekday and month. **Section heading**: no card behind it, for labelling a part of the dashboard: a title, a subtitle (plain text or a template) and chips for a few entities.

```yaml
type: custom:halo-title-card
style: heading                 # greeting | date | heading
title: Downstairs
subtitle: "{{ states.light | selectattr('state','eq','on') | list | count }} lights on"
chips: [lock.front_door, { entity: sensor.living_room_temperature, name: Living room }]
```

## Halo Thermostat card (`custom:halo-thermostat-card`)

Nest-style thermostat for any `climate` entity. Tall, it is a dial of fine ticks with the target in the middle and − / + below; short (under about 230px), it becomes a compact bar with the target in the middle, − / + either side, "Now" and humidity under it, and the tick bar along the bottom. The background glows orange while heating and blue while cooling, rising up the card while it works; when the thermostat is on but already at its target the glow lies wide and low along the bottom, so there is no status text. The compact bar has an on/off button in the top right that turns the thermostat off, and back on to the last mode it was in. Temperatures are shown to the nearest 0.5 degrees and the target moves in 0.5 steps (or the thermostat's own step if larger). Presses are sent once you stop tapping. You can also press anywhere on the dial ring, or along the compact tick bar, and drag: the target follows your finger and is sent once when you let go. In heat/cool range mode, − / + move both ends of the range together, and dragging moves whichever end is nearer.

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

## Halo Graph card (`custom:halo-graph-card`)

Up to four figures across the top, a chart underneath, and a readout along the bottom that appears only while you point at or tap the chart: the time (or the half-hour slot, for bars) and every series' value in its colour. It replaces the Solar Forecast and Agile cards: the editor's **Start from** buttons set it up as either, finding your Agile rate entities and solar power sensor.

- **Series:** each is drawn as a `line` (history, live sensors), a shaded `area` (forecasts) or `bars` (rates). Where the data comes from is found automatically:
  - **History** of any numeric sensor, from midnight (or the start of the chart). Charts longer than a day use Home Assistant's hourly statistics for sensors that keep them.
  - **Lists in an entity's attributes:** Octopus Energy rates (`rates`, in £, shown as pence), Nordpool (`raw_today` and `raw_tomorrow`), Solcast (`detailedForecast`, kW) and Amber (`forecasts`). For anything else set `attribute` and its `start_key`, `end_key` and `value_key`.
  - **The Energy dashboard's solar forecast** (Forecast.Solar and the like): a series with no entity. Add Forecast.Solar to the solar panels in the Energy dashboard first.
- Several entities in one series are joined end to end (Agile's today and tomorrow). Power is shown in kW and energy in kWh, so a forecast and a sensor share an axis. A second unit (pence and kW, say) gets a scale on the right.
- **Colours:** `colour` is one of `grey`, `red`, `orange`, `yellow`, `green`, `teal`, `blue`, `purple`, `pink`, or any CSS colour. Lines without one use the text colour. Bars take `colour_rules` (the first one the value meets wins), so Agile can be green under 15p and red over 30p. History can be drawn as bars too, averaged over `slot_minutes`.
- **Period:** `day` (midnight to midnight, with a Today / Tomorrow pill once there is data for tomorrow), or `last`, `next` or `around` (either side of now) a number of `hours`, 1 to 168. `fit: true` trims the hours at either end where everything is zero, such as night time for solar. A dashed line marks now.
- **Figures:** up to four, as many as fit. Each is a `calc` on a series over a `window`: `now` (with "until 17:00" for a slot), `next` slot, `lowest` and `highest` (with "at 03:00"), `average`, `total` (power becomes energy) and `remaining` (now to the end of the window). Windows: `period` (the chart's), `today`, `tomorrow`, or `next` `hours`. `compare` shows a total as a percentage of another series so far (generated against forecast), green from 90%. A figure can instead show an `entity`'s state. Each can have an `icon` or `icon_svg` with an `icon_colour`.
- **Compact (12 × 2):** the first figure large, the second beneath it, and a small chart.

```yaml
type: custom:halo-graph-card
name: Agile rates
period: day
series:
  - name: Rate
    entities:
      - event.octopus_energy_electricity_xxx_current_day_rates
      - event.octopus_energy_electricity_xxx_next_day_rates
    style: bars
    colour: yellow
    colour_rules:
      - { below: 15, colour: green }
      - { above: 30, colour: red }
figures:
  - { label: Current, calc: now }
  - { label: Next, calc: next }
  - { label: Lowest, calc: lowest, window: today, icon: mdi:arrow-down, icon_colour: green }
  - { label: Highest, calc: highest, window: today, icon: mdi:arrow-up, icon_colour: red }
```

```yaml
type: custom:halo-graph-card
name: Solar forecast
period: day
fit: true
series:
  - { name: Forecast, source: energy_forecast, style: area, colour: yellow }
  - { name: Actual, entity: sensor.pv_power, style: line }
figures:
  - { label: Generated, series: Actual, calc: total, window: today, compare: Forecast }
  - { label: Remaining, series: Forecast, calc: remaining, window: today }
  - { label: Today, series: Forecast, calc: total, window: today }
  - { label: Tomorrow, series: Forecast, calc: total, window: tomorrow }
```

## Development

```sh
npm install
npm run dev      # mock Home Assistant at /dev/index.html
npm test
npm run build    # dist/halo-cards.js
```

Tag `vX.Y.Z` to publish a release; the workflow attaches `halo-cards.js`.
