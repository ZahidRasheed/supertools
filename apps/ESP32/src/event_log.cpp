#include "event_log.h"

#include <time.h>

static const size_t kLogCap = 48;

struct LogEntry {
  uint32_t uptimeMs;
  char when[24];  // "2026-07-23 21:40:01" or "t+12.3s"
  char area[12];
  char message[100];
};

static LogEntry gLog[kLogCap];
static size_t gHead = 0;  // next write
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

void logEvent(const char *area, const char *message) {
  LogEntry &e = gLog[gHead];
  e.uptimeMs = millis();
  formatWhen(e.when, sizeof(e.when), e.uptimeMs);
  strncpy(e.area, area ? area : "sys", sizeof(e.area) - 1);
  e.area[sizeof(e.area) - 1] = 0;
  strncpy(e.message, message ? message : "", sizeof(e.message) - 1);
  e.message[sizeof(e.message) - 1] = 0;

  gHead = (gHead + 1) % kLogCap;
  if (gCount < kLogCap) {
    ++gCount;
  }

  Serial.printf("[%s] %s | %s\n", e.area, e.when, e.message);
}

void logClear() {
  gHead = 0;
  gCount = 0;
}

static void forEachNewest(size_t maxRows, void (*fn)(const LogEntry &, void *), void *ctx) {
  const size_t n = gCount < maxRows ? gCount : maxRows;
  for (size_t i = 0; i < n; ++i) {
    // newest first
    const size_t idx = (gHead + kLogCap - 1 - i) % kLogCap;
    fn(gLog[idx], ctx);
  }
}

struct HtmlCtx {
  String *out;
};

static void appendHtmlRow(const LogEntry &e, void *ctx) {
  HtmlCtx *h = static_cast<HtmlCtx *>(ctx);
  *h->out += "<tr><td>";
  *h->out += e.when;
  *h->out += "</td><td>";
  *h->out += e.area;
  *h->out += "</td><td>";
  // minimal escape
  for (const char *p = e.message; *p; ++p) {
    if (*p == '<') *h->out += "&lt;";
    else if (*p == '&') *h->out += "&amp;";
    else *h->out += *p;
  }
  *h->out += "</td></tr>";
}

String logHtmlTable(size_t maxRows) {
  String out;
  out.reserve(gCount * 80 + 200);
  out += "<table class=log><thead><tr><th>When</th><th>Area</th><th>Event</th></tr></thead><tbody>";
  if (gCount == 0) {
    out += "<tr><td colspan=3>No events yet</td></tr>";
  } else {
    HtmlCtx ctx{&out};
    forEachNewest(maxRows, appendHtmlRow, &ctx);
  }
  out += "</tbody></table>";
  return out;
}

struct JsonCtx {
  String *out;
  bool first;
};

static void appendJsonRow(const LogEntry &e, void *ctx) {
  JsonCtx *j = static_cast<JsonCtx *>(ctx);
  if (!j->first) {
    *j->out += ',';
  }
  j->first = false;
  *j->out += "{\"when\":\"";
  *j->out += e.when;
  *j->out += "\",\"uptime_ms\":";
  *j->out += String(e.uptimeMs);
  *j->out += ",\"area\":\"";
  *j->out += e.area;
  *j->out += "\",\"message\":\"";
  for (const char *p = e.message; *p; ++p) {
    if (*p == '"' || *p == '\\') *j->out += '\\';
    *j->out += *p;
  }
  *j->out += "\"}";
}

String logJson(size_t maxRows) {
  String out;
  out.reserve(gCount * 100 + 32);
  out += "{\"items\":[";
  JsonCtx ctx{&out, true};
  forEachNewest(maxRows, appendJsonRow, &ctx);
  out += "]}";
  return out;
}
