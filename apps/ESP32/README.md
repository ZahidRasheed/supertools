# AtomS3R house fleet

Same firmware on every [M5Stack AtomS3R Ext](https://docs.m5stack.com/en/core/AtomS3R%20Ext) (`C126-Ext`, 8 MB PSRAM). Devices talk to **Home Assistant on the Mac mini** over MQTT. One Atom near the bathroom runs **scale bridge** mode (RunSTAR R6 → BLE → MQTT).

**Language:** C++ (Arduino / ESP32-S3) via **PlatformIO**.  
**Device UI:** HTML served by the firmware (not a separate web app).

---

## Architecture

```
  Zigbee sensors ──► Zigbee stick ──┐
                                    ├──► Mac mini · Home Assistant · Mosquitto
  Atom ×N (Wi‑Fi) ── MQTT publish ──┘              ▲
       │                                           │
       └─ BLE (scale, future jobs)                 dashboards / your app
```

| Piece | Role |
|--------|------|
| **Zigbee** | Existing HA devices |
| **AtomS3R ×N** | Same image; Wi‑Fi + BLE for jobs Zigbee doesn’t cover |
| **MQTT** | How Atoms publish to HA |
| **Mac mini (UTM HA)** | Always-on broker + automations |
| **Your app (planned)** | Body-composition math from raw weight + impedance |

**Not a BLE MITM:** the scale allows one client. The Atom **replaces Starfit** while measuring.

---

## What we have built

### Device base
- [x] Wi‑Fi portal (`AtomS3R-Setup`) + mDNS `atoms3r.local`
- [x] Web settings UI (name, mode, MQTT, scale profile)
- [x] OTA updates (`/update` → upload `firmware.bin`)
- [x] NVS config per device
- [x] Activity log + BLE capture on-device (`/api/log`, `/api/ble`)

### MQTT → Home Assistant
- [x] Connect to Mosquitto (user/password)
- [x] HA MQTT discovery: **Online**, **Weight**, **Impedance**
- [x] Device naming: `Atom <name>` (e.g. `Atom bath`)
- [x] Replay last payload (or dummy) from the web UI

### RunSTAR R6 scale bridge
- [x] Mode `scale` — scan `Runstar-` / `RUNSTAR-`, connect FFB0/FFB1/FFB2/FFB3
- [x] Send user profile to scale (sex / age / height) for BIA
- [x] Decode weight (18-bit grams) and impedance Ω from A3
- [x] Publish **only raw** data (no BMI/fat math in firmware):

| Topic | Payload (example) |
|--------|-------------------|
| `atoms3r/<name>/weight` | `{ "weight_kg": 93.70, "raw": 93700, "phase": "final", "source": "runstar" }` |
| `atoms3r/<name>/impedance` | `{ "weight_kg": 93.70, "impedance_ohm": 597 }` |
| `atoms3r/<name>/status` | `online` / `offline` (retained) |

BLE frames stay on the Atom page for debug; they are **not** flooded to MQTT.

---

## What we want to build

### Near term
- [ ] Flash / configure remaining Atoms (`hall`, `office`, …)
- [ ] Downstream app (or HA templates) that turns **weight + Ω + profile** into fat/water/muscle (Starfit-style math lives there, not on the Atom)
- [ ] Persist last weigh-in across reboot (optional)
- [ ] More firmware **modes** on the same image (env sensor, BLE presence, button, IR, …)

### Kitchen Thermex hood (separate track)
- [x] Confirmed: hood on Wi‑Fi; app = Thermex Remote; software **v1.28 / v1.05**
- [ ] **Blocked:** local API needs **≥ v1.30 / v1.10** — no API toggle in app yet
- [ ] Contact Thermex for firmware update (service tools; not user OTA)
- [ ] After update: enable API → [HA Thermex integration](https://github.com/hsk-dk/home-assistant-thermex)
- [ ] Google via HA (native VoiceLink flaky on current FW)
- [ ] Atom BLE control for Thermex — **only if** API stays unavailable and BLE control is proven

---

## Tasks done (high level)

1. Scaffold AtomS3R Ext firmware (PlatformIO, OTA partitions)
2. Wi‑Fi portal, web UI, OTA workflow (USB once, then Wi‑Fi)
3. Point fleet at Mac mini MQTT / Home Assistant
4. MQTT client + HA discovery + status
5. Runstar BLE scale mode → weight on MQTT
6. Fix R6 weight decode (18-bit grams, not openScale `0x680000` base)
7. Capture A3 impedance; drop on-device fat/BMI estimates
8. Replay / dummy payload button
9. Document Thermex path (Wi‑Fi API preferred; FW gate)

---

## Todo

| Priority | Item |
|----------|------|
| High | Thermex → ask support for FW ≥ 1.30/1.10 |
| High | App/HA layer: compute composition from weight + impedance |
| Medium | Deploy 2nd/3rd Atom with same firmware |
| Medium | Extra modes (env / presence / IR) behind `mode` setting |
| Parked | Thermex via Atom BLE (wait for FW / API decision) |

---

## Hardware

| Item | Notes |
|------|--------|
| M5Stack AtomS3R Ext Proto Kit | `C126-Ext`, no screen, 8 MB PSRAM |
| RunSTAR R6 | Starfit BLE scale; prefix `Runstar-` |
| Mac mini + UTM | Home Assistant + Mosquitto (`192.168.0.38:1883` in current setup) |
| Thermex hood | Wi‑Fi connected; API blocked until FW update |

---

## Setup (each Atom)

1. **USB once:** `pio run -e atoms3r-ext -t upload`
2. Join Wi‑Fi AP **`AtomS3R-Setup`** → your home network
3. Open `http://atoms3r.local/` or device IP
4. Set **Name**, **MQTT** host/user/pass, **Mode**. Setting an MQTT password also locks the web UI and OTA (HTTP Basic; username = MQTT user or `admin`). Password field is never echoed back.
5. For scale Atom: Mode = **Scale bridge**, prefix `Runstar-`, sex/age/height → Save
6. Later updates: OTA at `/update` (disabled until MQTT password is set). Upload `firmware.bin` from project root.

### Scale weigh-in
1. Disconnect Starfit from the scale  
2. Step on barefoot; wait until BIA finishes (~20 s)  
3. Check HA **Weight** / **Impedance**, or Atom activity log  
4. Optional: **Replay last payload** on the web UI  

---

## Build

```bash
cd /Users/zahidrasheed/Documents/Personal/super-tools/apps/ESP32
pio run -e atoms3r-ext
cp .pio/build/atoms3r-ext/firmware.bin ./firmware.bin   # for OTA
```

`firmware.bin` is gitignored (local OTA artifact).

---

## Repo layout

```
include/     config, core APIs, BLE capture, event log
src/         main, wifi, web UI, mqtt, scale, logs
partitions_ota_8MB.csv
platformio.ini
```

---

## Notes

- **Composition:** Starfit calculates fat/water/etc. from impedance + profile. Firmware publishes raw **kg** and **Ω** only so your end app owns the math.
- **Fleet rule:** one firmware image; enable scale mode only on the Atom next to the scale.
- **Thermex:** Bluetooth on the box is mainly for pairing; day-to-day control is Wi‑Fi. Local HA API needs newer hood firmware.
