// The greeting library: for each trigger, lines in three tones. {name} and the other placeholders are filled in from what's going on.

export type Tone = "polite" | "cheeky" | "rude";
export const TONES: Tone[] = ["polite", "cheeky", "rude"];

export type TriggerId =
  | "binsTonight" | "binsTomorrow" | "binsToday" | "rainSoon" | "rainNow" | "dryLater" | "cold" | "hot" | "windy" | "sunny"
  | "busy" | "nothing" | "eventSoon" | "eventNow" | "birthday" | "cheapSoon" | "plunge" | "peak" | "evLow" | "fuelLow"
  | "music" | "repeat" | "late" | "early" | "monday" | "friday" | "weekend" | "morning" | "afternoon" | "evening";

/** The time-of-day lines: always true, used when little else is going on. */
export const FALLBACK: TriggerId[] = ["morning", "afternoon", "evening"];

type Lines = [polite: string[], cheeky: string[], rude: string[]];

export const LIBRARY: Record<TriggerId, { when: string; lines: Lines }> = {
  binsTonight: { when: "Bins go out tonight", lines: [
    ["{bin} goes out tonight, {name}.", "Don't forget, {bin} goes out tonight.", "Bin night: {bin}.", "A reminder that {bin} is collected in the morning."],
    ["Bins tonight. Don't make it a whole thing.", "{bin} night. The highlight of your week.", "Bins out tonight. Yes, you.", "It's bin night. Try to contain your excitement.", "The {bin} won't walk itself to the kerb."],
    ["Bins. Tonight. Don't be a lazy sod.", "Get the bloody {bin} out.", "{bin} out tonight or live in your own filth for a fortnight.", "Bin night. Shift your arse.", "Forget the {bin} again and I'm telling everyone."]] },
  binsTomorrow: { when: "Bins collected tomorrow", lines: [
    ["{bin} is collected tomorrow.", "Bin day tomorrow: {bin}.", "{bin} goes out tomorrow evening."],
    ["Bin day tomorrow. Brace yourself.", "{bin} tomorrow. Set a reminder for your reminder.", "Big day tomorrow. Bin day.", "Tomorrow's main event: {bin}."],
    ["Bins tomorrow. You'll forget. You always forget.", "{bin} tomorrow. Miss it and the drive becomes a tip.", "Bin day tomorrow, you forgetful sod.", "{bin} tomorrow. Don't cock it up."]] },
  binsToday: { when: "Collection this morning", lines: [
    ["{bin} is collected today.", "The bin lorry is due this morning."],
    ["Lorry's coming. Did the {bin} make it out?", "Bin day. Moment of truth.", "Hear that rumble? Hope the {bin}'s out."],
    ["Bin day. If it's not out, run, you muppet.", "Lorry's on its way. Arse in gear.", "Bins not out? Pyjamas on the drive it is, then."]] },
  rainSoon: { when: "Rain on the way", lines: [
    ["Rain from {time}, take a coat.", "Showers expected from {time}.", "Rain later. Umbrella by the door.", "It turns wet around {time}."],
    ["Coat weather later. You've been warned.", "Rain at {time}. Plan accordingly, or get soaked.", "Rain at {time}. Classic.", "Bring the washing in before {time}, hero."],
    ["It's going to piss down at {time}. Dress accordingly.", "Rain from {time}. Leave the washing out if you enjoy being an idiot.", "Wet as an otter's pocket from {time}.", "Rain at {time}. No, your hair won't survive it."]] },
  rainNow: { when: "Raining now", lines: [
    ["It's raining. Take care out there.", "A wet one right now.", "Rain at the moment."],
    ["Raining. Shock, horror.", "It's raining. Very British of it.", "Raining. Perfect excuse to stay in."],
    ["It's pissing down.", "Raining again. Bloody typical.", "Raining sideways. Lovely."]] },
  dryLater: { when: "Rain clearing", lines: [
    ["Dry from {time}.", "The rain clears by {time}."],
    ["Hang on till {time} and it'll stop.", "Dry by {time}. Allegedly."],
    ["Rain buggers off at {time}.", "Dry by {time}. Until then, tough."]] },
  cold: { when: "Below 3°", lines: [
    ["A cold one today, {temp}°.", "Wrap up warm.", "Frosty start."],
    ["It's baltic out there.", "{temp}°. Find the big coat.", "Cold enough to see your breath. Lovely.", "Scrape the car. Again."],
    ["It's bloody freezing. Hat.", "{temp}°. Brass monkeys.", "Colder than a penguin's arse.", "Freezing. Don't even think about touching the thermostat."]] },
  hot: { when: "Above 25°", lines: [
    ["A warm one today, {temp}°.", "Stay cool.", "Plenty of water today."],
    ["Scorchio.", "{temp}°. Suncream, not optimism.", "Close the curtains, open a Calippo.", "Hot one. The cat has the right idea."],
    ["Hot as hell. Close the blinds, you fool.", "{temp}°. Sweaty bits weather.", "Roasting. Don't you dare put the heating on.", "{temp}°. Put some bloody suncream on."]] },
  windy: { when: "Windy", lines: [
    ["Windy today.", "Gusty out there."],
    ["Windy. Hold onto your bins.", "Good hair day cancelled."],
    ["Blowing a bloody gale.", "Windy. The bins will be in next door's garden by teatime."]] },
  sunny: { when: "Sunny and dry", lines: [
    ["Lovely day for it.", "Sunshine all day.", "A bright one today."],
    ["Sun's out. Act surprised.", "Rare sighting: the sun.", "Glorious. Shame about the to-do list."],
    ["Sun's out. Get your pasty legs out.", "Glorious. Shame you'll spend it indoors, you hermit.", "Sunny. No excuse to sit inside like a mole."]] },
  busy: { when: "Busy day (5+ events)", lines: [
    ["A busy one today, {name}.", "{n} things on today.", "Full day ahead."],
    ["{n} things today. Pace yourself.", "Busy day. Coffee first.", "{n} events. Who booked all this?", "Today's a marathon. Stretch."],
    ["{n} things today. Bloody hell.", "Busy day. Brace yourself, you poor sod.", "{n} things on. Whose stupid idea was that?", "Full diary. Cancel something, you lunatic."]] },
  nothing: { when: "Nothing booked", lines: [
    ["A free day, {name}.", "Nothing in the diary today.", "A clear day ahead."],
    ["Nothing on. Dangerous.", "Empty diary. Don't tell anyone.", "No plans. The sofa's waiting.", "Nothing booked. Suspicious."],
    ["Not one thing on. Living the dream, you layabout.", "Nothing booked. Get off your arse anyway.", "Empty diary. Don't waste it scrolling, you slug."]] },
  eventSoon: { when: "Event within the hour", lines: [
    ["{event} in {mins} minutes.", "Next up: {event}.", "{event} soon."],
    ["{event} in {mins}. Shoes on.", "{mins} minutes to {event}. Tick tock.", "{event} in {mins}. Where are your keys?"],
    ["{event} in {mins} minutes. Move your arse.", "{mins} minutes till {event}. Don't be late again, you plank.", "{event}. {mins} minutes. Stop faffing."]] },
  eventNow: { when: "Event on now", lines: [
    ["{event} is on now.", "Hope {event} is going well."],
    ["You're meant to be at {event}.", "{event} is happening. Are you?"],
    ["{event} started. Why are you looking at the wall?", "{event}'s on. Stop gawping at the dashboard."]] },
  birthday: { when: "Someone's birthday", lines: [
    ["It's {who}'s birthday today.", "Don't forget {who}'s birthday.", "Happy birthday to {who}."],
    ["{who}'s birthday. Got a card?", "Cake o'clock: it's {who}'s birthday.", "{who}'s birthday. Ring them. Don't text."],
    ["{who}'s birthday. Forgot the card? You're on your own.", "{who}'s birthday. Ring them, you ungrateful sod.", "{who}'s birthday. A petrol station card won't cut it."]] },
  cheapSoon: { when: "Cheap Agile slot soon", lines: [
    ["Cheapest power of the day from {cheap}.", "Cheap electricity at {cheap}."],
    ["Cheap power at {cheap}. Load the dishwasher.", "Hold the wash till {cheap}. Your wallet says thanks.", "Cheap slot at {cheap}. Plan your laundry like a pro."],
    ["Cheap power at {cheap}. Stick the wash on, you tight git.", "Don't you dare run the dryer before {cheap}.", "{cheap}. Cheap power. Even you can manage that."]] },
  plunge: { when: "Agile below zero", lines: [
    ["Electricity is free from {cheap}.", "Negative prices from {cheap}."],
    ["They're paying you to use power at {cheap}.", "Free power at {cheap}. Run everything.", "Octopus is paying you at {cheap}. Charge all the things."],
    ["Negative prices at {cheap}. Plug in every bloody thing.", "Octopus is paying you. Boil the kettle for fun.", "Power's below zero at {cheap}. Waste it like a rock star."]] },
  peak: { when: "Peak price now", lines: [
    ["Electricity is expensive right now.", "Peak rate at the moment."],
    ["Peak rate. Touch nothing.", "Peak pricing. The oven can wait.", "Peak rate: the kettle is a luxury item."],
    ["Peak rate. Put the bloody kettle down.", "Peak rate. Turn that dryer off, you lunatic.", "Peak rate. Every light on? Seriously?"]] },
  evLow: { when: "Battery under the low level", lines: [
    ["The {car} is on {pct}%.", "Time to charge the {car}."],
    ["{car}'s on {pct}%. Plug it in, genius.", "{pct}% in the {car}. The charger's right there.", "The {car} is hungry. Feed it."],
    ["{pct}% in the {car}. Enjoy pushing it.", "Plug the bloody {car} in.", "{pct}%. You'll be begging for a tow, you numpty."]] },
  fuelLow: { when: "Fuel under the low level", lines: [
    ["The {car} needs fuel.", "The {car} is on {pct}% fuel."],
    ["{car}'s thirsty. Again.", "{pct}% fuel. The {car} has expensive tastes.", "The {car} would like a drink."],
    ["The {car}'s running on fumes and good intentions.", "Fill the bloody {car} up before it strands you.", "{pct}% fuel. The forecourt misses you, big spender."]] },
  music: { when: "Music playing", lines: [
    ["Enjoy {artist}, {name}.", "Nice choice."],
    ["{artist}? Bold.", "Kitchen disco in progress.", "Good taste. For once."],
    ["{artist}. The neighbours love you.", "Turn it down, you menace.", "Is that singing? Stop it."]] },
  repeat: { when: "Same song three times in an hour", lines: [
    ["Still enjoying {track}?", "{track} again. It's a good one."],
    ["{track}, third time this hour.", "We get it, you like {track}."],
    ["Third time this hour. Change the bloody record.", "{track} again? Get help."]] },
  late: { when: "After 23:30", lines: [
    ["Getting late, {name}.", "Time for bed soon.", "Sleep well when you get there."],
    ["Still up?", "Bed. Now. Go on.", "The house is asleep. Why aren't you?", "Midnight snack? Saw that."],
    ["Go to bed, you absolute owl.", "It's gone half eleven. Bed, you night goblin.", "Phone down, eyes shut, sod off to bed.", "Close the fridge and go to bed."]] },
  early: { when: "Before 06:00", lines: [
    ["You're up early.", "Early start, {name}.", "Morning, early bird."],
    ["Bit keen, aren't we?", "Even the birds aren't up yet.", "It's still dark. Respect."],
    ["Who gets up at this hour? Weirdo.", "It's still dark, you lunatic.", "Up before the milkman. Get a life."]] },
  monday: { when: "Monday morning", lines: [
    ["New week, {name}.", "Monday. Fresh start.", "Good luck this week."],
    ["Monday. Sorry, {name}.", "Monday again. Who keeps booking these?", "Monday. Pretend to be keen."],
    ["Monday. Bollocks.", "Monday. Bloody hell, already?", "Monday. Weekend's dead and you killed it."]] },
  friday: { when: "Friday afternoon", lines: [
    ["Nearly the weekend.", "Happy Friday, {name}.", "Well done this week."],
    ["It's Friday. Close the laptop.", "Friday. Mentally you've already left.", "Friday. Out of office, in spirit."],
    ["Friday. Laptop shut, beer open.", "Friday. Work can piss off.", "Friday. If you're still working, you're a mug."]] },
  weekend: { when: "Weekend morning", lines: [
    ["Morning, {name}. Easy one today.", "Enjoy the weekend.", "No rush today."],
    ["Weekend. Nobody expects anything of you.", "Weekend mode: on.", "Pyjamas are acceptable until noon."],
    ["Weekend. Stay in your pants.", "Weekend. Do sod all, guilt-free.", "Weekend. Lie-in earned. Probably."]] },
  morning: { when: "Any morning", lines: [
    ["Good morning, {name}.", "Morning, {name}.", "Hope you slept well.", "Morning. Kettle's waiting.", "Good morning. Here's your day."],
    ["Alright, {name}?", "Morning, sunshine.", "Rise and whine.", "Morning. Coffee before conversation.", "Ah, you're awake."],
    ["Oh. It's you again.", "Morning, you crusty-eyed gremlin.", "Up at last, lazy arse.", "Morning. You look rough. Coffee.", "Brush your teeth before you talk to anyone."]] },
  afternoon: { when: "Any afternoon", lines: [
    ["Good afternoon, {name}.", "Afternoon, {name}.", "Hope the day's going well.", "Afternoon. Halfway there."],
    ["Afternoon slump? Same.", "Back again?", "Still standing, then.", "Biscuit o'clock."],
    ["Afternoon, you idle sod.", "Stop staring at the wall and do something.", "Done anything useful yet? Thought not.", "You again. Brilliant."]] },
  evening: { when: "Any evening", lines: [
    ["Good evening, {name}.", "Evening, {name}.", "Hope today was a good one.", "Time to wind down."],
    ["Evening. Feet up?", "Dinner sorted? Didn't think so.", "You made it through another one.", "Evening, legend."],
    ["Evening, you lazy git.", "Wine o'clock, apparently.", "Another day survived. Barely.", "What do you want now?"]] },
};

export const TRIGGER_IDS = Object.keys(LIBRARY) as TriggerId[];

/** A true trigger and the words its lines need ({bin}, {time} and so on). */
export interface Fired { id: TriggerId; vars?: Record<string, string | number> }

/** Your own line: for one trigger, in one tone or all of them. */
export interface CustomGreeting { trigger: TriggerId; tone?: Tone | "any"; text: string }

export const fill = (line: string, vars: Record<string, string | number | undefined>) =>
  line.replace(/\{(\w+)\}/g, (m, k: string) => (vars[k] === undefined || vars[k] === "" ? m : String(vars[k])));

/** Rude only after the watershed (and before 06:00); cheeky in the daytime. */
export function toneAt(tone: Tone, watershed: boolean, fromMinutes: number, now: Date): Tone {
  if (tone !== "rude" || !watershed) return tone;
  const m = now.getHours() * 60 + now.getMinutes();
  return m >= fromMinutes || m < 360 ? "rude" : "cheeky";
}

/** Small seeded generator so the order is stable for a day and differs between days. */
function seeded(seed: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  return () => { h = Math.imul(h ^ (h >>> 15), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); h ^= h >>> 16; return (h >>> 0) / 4294967296; };
}

/** Every line that fits right now, filled in. The time-of-day lines join only when little else is going on. */
export function linesFor(fired: Fired[], tone: Tone, name: string, custom: CustomGreeting[] = []): string[] {
  const main = fired.filter((f) => !FALLBACK.includes(f.id));
  const use = main.length >= 2 ? main : fired;
  const out: string[] = [];
  for (const f of use) {
    const vars = { name, ...f.vars };
    const own = custom.filter((c) => c.trigger === f.id && c.text?.trim() && (!c.tone || c.tone === "any" || c.tone === tone)).map((c) => c.text.trim());
    for (const l of [...LIBRARY[f.id].lines[TONES.indexOf(tone)], ...own]) {
      const s = fill(l, vars);
      if (!/\{\w+\}/.test(s)) out.push(s);
    }
  }
  return out;
}

/**
 * The greeting to show: the lines are shuffled once per day, and a new one comes up each hour. `offset` moves on when
 * the greeting is tapped. Within a day the same line doesn't come round again until the rest have been shown.
 */
export function pickGreeting(lines: string[], now: Date, offset = 0, salt = ""): string {
  if (!lines.length) return "";
  const day = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`;
  const rand = seeded(`${day}|${salt}|${lines.length}`);
  const order = lines.map((l, i) => [rand(), i] as const).sort((a, b) => a[0] - b[0]).map(([, i]) => i);
  return lines[order[(now.getHours() + offset) % order.length]];
}
