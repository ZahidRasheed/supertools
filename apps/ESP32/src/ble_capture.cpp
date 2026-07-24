#include "ble_capture.h"

#include <time.h>

static const size_t kCap = 32;
static const size_t kHexMax = 96;  // enough for 20 bytes with spaces

struct BleFrame {
  uint32_t uptimeMs;
  char when[24];
  char charId[8];
  char note[28];
  char hex[kHexMax];
  uint8_t len;
};

static BleFrame gFrames[kCap];
static size_t gHead = 0;
static size_t gCount = 0;

static void formatWhen(char *out, size_t outLen, uint32_t uptimeMs) {
  struct tm ti = {};
  if (getLocalTime(&ti, 20)) {
    snprintf(out, outLen, "%04d-%02d-%02d %02d:%02d:%02d", ti.tm_year + 1900, ti.tm_mon + 1,
             ti.tm_mday, ti.tm_hour, ti.tm_min, ti.tm_sec);
  } else {
    snprintf(out, outLen, "t+%.1fs", uptimeMs / 1000.0f);
  }
}

void bleCaptureAdd(const char *charId, const uint8_t *data, size_t len, const char *note) {
  if (!data || len == 0) {
    return;
  }
  BleFrame &f = gFrames[gHead];
  f.uptimeMs = millis();
  formatWhen(f.when, sizeof(f.when), f.uptimeMs);
  strncpy(f.charId, charId ? charId : "?", sizeof(f.charId) - 1);
  f.charId[sizeof(f.charId) - 1] = 0;
  strncpy(f.note, note ? note : "", sizeof(f.note) - 1);
  f.note[sizeof(f.note) - 1] = 0;
  f.len = static_cast<uint8_t>(len > 255 ? 255 : len);

  size_t pos = 0;
  const size_t n = len > 32 ? 32 : len;
  for (size_t i = 0; i < n && pos + 3 < kHexMax; ++i) {
    if (i) {
      f.hex[pos++] = ' ';
    }
    pos += snprintf(f.hex + pos, kHexMax - pos, "%02X", data[i]);
  }
  f.hex[pos < kHexMax ? pos : kHexMax - 1] = 0;

  gHead = (gHead + 1) % kCap;
  if (gCount < kCap) {
    ++gCount;
  }
}

void bleCaptureClear() {
  gHead = 0;
  gCount = 0;
}

String bleCaptureHtml(size_t maxRows) {
  String out;
  out.reserve(gCount * 120 + 200);
  out += "<table class=log><thead><tr><th>When</th><th>Char</th><th>Note</th><th>Hex</th>"
         "</tr></thead><tbody>";
  if (gCount == 0) {
    out += "<tr><td colspan=4>No BLE frames yet — step on the scale after OTA</td></tr>";
  } else {
    const size_t n = gCount < maxRows ? gCount : maxRows;
    for (size_t i = 0; i < n; ++i) {
      const size_t idx = (gHead + kCap - 1 - i) % kCap;
      const BleFrame &f = gFrames[idx];
      out += "<tr><td>";
      out += f.when;
      out += "</td><td>";
      out += f.charId;
      out += "</td><td>";
      out += f.note;
      out += "</td><td style=\"font-family:ui-monospace,monospace;font-size:.75rem;"
             "word-break:break-all\">";
      out += f.hex;
      out += "</td></tr>";
    }
  }
  out += "</tbody></table>";
  return out;
}

String bleCaptureJson(size_t maxRows) {
  String out;
  out.reserve(gCount * 140 + 32);
  out += "{\"items\":[";
  const size_t n = gCount < maxRows ? gCount : maxRows;
  for (size_t i = 0; i < n; ++i) {
    if (i) {
      out += ',';
    }
    const size_t idx = (gHead + kCap - 1 - i) % kCap;
    const BleFrame &f = gFrames[idx];
    out += "{\"when\":\"";
    out += f.when;
    out += "\",\"char\":\"";
    out += f.charId;
    out += "\",\"note\":\"";
    out += f.note;
    out += "\",\"len\":";
    out += String(f.len);
    out += ",\"hex\":\"";
    out += f.hex;
    out += "\"}";
  }
  out += "]}";
  return out;
}
