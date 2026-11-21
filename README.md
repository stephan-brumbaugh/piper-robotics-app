# Piper Robotics app

One website for the Piper Robotics program:

| Folder | What it is |
| --- | --- |
| `live/` | **Piper Robotics Live**, for families: schedules, results, rankings, live streams and match videos for the teams they follow. Public information only. |
| `setup/` | **Team setup**: makes the `config.json` settings file. Families never need it. |
| `config.json` | The settings both apps read: teams, names, colours, stream links, YouTube channel and API keys. |
| `index.html` | A simple home page linking to the apps. |

The scouting app (Hive Scout) moves into a `scout/` folder here during the December break.

## 1. Put it on GitHub Pages (once)

1. On github.com, create a new **public** repository named `piper-robotics-app`.
2. **Add file → Upload files**, then drag in everything from this folder, keeping the folders (`live`, `setup`), and **Commit**.
3. **Settings → Pages**: Source **Deploy from a branch**, branch **main**, folder **/ (root)**, **Save**.
4. After a minute or two the site is at `https://YOUR-GITHUB-NAME.github.io/piper-robotics-app/`.
   The families' link is `https://YOUR-GITHUB-NAME.github.io/piper-robotics-app/live/`.

## 2. Share it with families

Send them the `…/live/` link. To get an icon on their phone:
- **iPhone (Safari):** Share button → **Add to Home Screen**.
- **Android (Chrome):** menu ⋮ → **Install app** (or **Add to Home screen**).

The first time it opens, they pick which teams to follow: FTC 21536 Team Stealth, FTC 14213 Nighthawks and/or FRC 1802 Team Stealth. **Change teams** at the top changes that any time, and **Follow another team** adds any FTC or FRC team.

## 3. What families see

- **Today** (when a followed team is at an event): a **Watch live** button (the event's own stream, otherwise twitch.tv/firstmoks) with **Play here** to watch inside the app; each team's rank and record at the event and its next match; and the schedule with alliance colour and position, times, scores, W/L, the next match highlighted, and a video link for finished matches. It updates every minute while open.
- **No event today:** what's coming up, with **Add to calendar** (Apple/Outlook file or Google Calendar) and where to watch.
- **How our teams are doing**, for each team: season record, events played, league standing, world and Kansas–Missouri rank by Total NP (with Auto, TeleOp and Endgame), awards, and the next event. **Show all events** lists every event; tap one for its full schedule, results and videos.
- Phones keep the last download, so it still opens with no signal.

FRC 1802 shows the 2026 season until the 2027 schedule is posted.

## 4. Match videos

**From our YouTube channel.** The app reads video titles like these:

- `FTC Team Stealth Meet 2 Match 11 FTC Nighthawks Meet 1 Match 11` (one video, both teams)
- `FTC Team Stealth Missouri Kansas State Tournament Playoff Match 9`
- `FTC Team Stealth Worlds Qualification Match 12`
- `FRC Team Stealth Heartland Regional Qual 43`

How it reads them:
- **FTC** or **FRC**, then the team's name as written on the setup page (**Names in video titles**). One title can name several teams.
- **Meet N** is that team's Nth league meet of the season. Otherwise the event comes from words in the title: *State* or *Championship*, *Worlds*, *League Tournament*, *Regional*, plus place names like *Heartland*.
- **Match / Qual N** is the event's match number. If that team didn't play in that match number, it's taken as the team's own Nth match and the link shows **Video?** to say it's a best guess. **Playoff Match N** is playoff match N.
- Only videos posted on or after the event's first day count, so last season's videos never land on this season's events.

Finding the videos needs a **YouTube API key** (free). Until one is added, each finished match shows **Find video**, which searches the channel.

**From FIRST.** FRC match videos that The Blue Alliance links appear as **▶ FIRST**. FTC has no official per-match videos; after an event, **Past broadcasts on Twitch** opens the stream's recordings.

### Getting a YouTube API key

1. Go to **console.cloud.google.com** and sign in (a personal Google account works if the school account blocks it).
2. Project picker at the top → **New project** → name it `Piper Robotics App` → **Create**, and make sure it's selected.
3. Menu ☰ → **APIs & Services → Library** → **YouTube Data API v3** → **Enable**.
4. Menu ☰ → **APIs & Services → Credentials** → **Create credentials → API key**. Copy it.
5. **Edit API key**: **Application restrictions → Websites → Add** `https://YOUR-GITHUB-NAME.github.io/*`; **API restrictions → Restrict key → YouTube Data API v3**; **Save**.
6. Open the setup page, paste it under **YouTube API key**, **Download config.json**, and upload it (section 5).

## 5. Changing settings (setup page)

Open `…/piper-robotics-app/setup/`. Change anything (teams, names in video titles, colours, stream links, YouTube channel, API keys, seasons), use **Test the keys**, then **Download config.json**. On GitHub, **Add file → Upload files**, drop in `config.json` (it replaces the old one), **Commit**. Phones use the new settings the next time the app opens.

**Everything in `config.json` is public.** Only website keys belong there: a Blue Alliance read key and a YouTube key locked to your site. Never put the FIRST API key or the scouting app's team key in it.

## 6. Giving it to another team

They copy this repository into their own GitHub account (any name), turn on Pages (section 1), and use the setup page for their teams, streams, channel and keys. To change the name under the phone icon, they edit `name` and `short_name` in `live/manifest.webmanifest` and `apple-mobile-web-app-title` in `live/index.html`.

## 7. Updating the app

After changing files in `live/`, change `VERSION` at the top of `live/sw.js` and `APP_VERSION` at the top of `live/js/app.js` to match (for example `1.0.1`). Phones then show *A new version is ready → Reload*.

## Where the data comes from

- **FTC:** FTCScout (ftcscout.org), a free public copy of FIRST's official results. Results appear there about a minute after FIRST posts them. League standings and region ranks come from FTCScout too; if FTCScout ever stops providing them, those lines simply don't show.
- **FRC:** The Blue Alliance (thebluealliance.com), using the read key in `config.json`.
- **Videos:** YouTube; streams: Twitch.

## Files

```
index.html                 home page
config.json                settings (made by the setup page)
setup/index.html           team setup page
live/index.html            Piper Robotics Live
live/js/app.js             screens
live/js/data.js            followed teams, saved data, refresh timing
live/js/ftc.js             FTC results from FTCScout
live/js/frc.js             FRC results from The Blue Alliance
live/js/videos.js          YouTube uploads and title matching
live/js/calendar.js        Add to calendar
live/js/util.js, regions.js   helpers, region names
live/sw.js                 offline cache
```

Unofficial; not affiliated with FIRST®, FTCScout, The Blue Alliance, YouTube or Twitch.
