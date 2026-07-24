#include "core.h"
#include "config.h"
#include "event_log.h"
#include "ble_capture.h"

#include <ArduinoJson.h>
#include <ElegantOTA.h>
#include <WebServer.h>

static String htmlEscape(const String &in) {
  String out;
  out.reserve(in.length());
  for (size_t i = 0; i < in.length(); ++i) {
    const char c = in[i];
    if (c == '&')
      out += "&amp;";
    else if (c == '<')
      out += "&lt;";
    else if (c == '>')
      out += "&gt;";
    else if (c == '"')
      out += "&quot;";
    else
      out += c;
  }
  return out;
}

static String pageHtml(const DeviceConfig &cfg) {
  const String name = htmlEscape(cfg.deviceName);
  const String mode = htmlEscape(cfg.mode);
  const String host = htmlEscape(cfg.mqttHost);
  const String user = htmlEscape(cfg.mqttUser);
  const String pass = htmlEscape(cfg.mqttPassword);
  const String topic = htmlEscape(cfg.mqttBaseTopic);
  const String prefix = htmlEscape(cfg.scaleNamePrefix);
  const String ip = htmlEscape(wifiIp());
  const String ssid = htmlEscape(wifiSsid());
  const uint8_t sex = cfg.userSex ? cfg.userSex : 1;

  String html;
  html.reserve(14000);
  html += F("<!doctype html><html><head><meta charset=utf-8>"
            "<meta name=viewport content=\"width=device-width,initial-scale=1\">"
            "<meta http-equiv=refresh content=15>"
            "<title>AtomS3R</title><style>"
            "body{font-family:system-ui,sans-serif;max-width:40rem;margin:1.5rem auto;"
            "padding:0 1rem;background:#111;color:#eee}"
            "h1{font-size:1.4rem}h2{font-size:1.1rem;margin:0 0 .5rem}"
            "label{display:block;margin:.8rem 0 .2rem;color:#aaa}"
            "input,select{width:100%;padding:.55rem;border-radius:8px;border:1px solid #333;"
            "background:#1a1a1a;color:#eee;box-sizing:border-box}"
            "button,.btn{display:inline-block;margin:.4rem .4rem 0 0;padding:.6rem 1rem;"
            "border-radius:8px;border:0;background:#3b82f6;color:#fff;text-decoration:none;"
            "font-weight:600;cursor:pointer}"
            ".secondary{background:#333}"
            ".card{background:#1a1a1a;border:1px solid #2a2a2a;border-radius:12px;"
            "padding:1rem;margin:1rem 0}"
            ".ok{color:#4ade80}.muted{color:#888;font-size:.9rem}"
            "table.log{width:100%;border-collapse:collapse;font-size:.85rem}"
            "table.log th,table.log td{text-align:left;padding:.35rem .4rem;"
            "border-bottom:1px solid #2a2a2a;vertical-align:top}"
            "table.log th{color:#888;font-weight:600}"
            "table.log td:first-child{white-space:nowrap;color:#aaa}"
            "table.log td:nth-child(2){color:#93c5fd;white-space:nowrap}"
            "</style></head><body>");
  html += F("<h1>AtomS3R</h1>");
  html += F("<div class=card><p class=ok>Online</p>");
  html += "<p>Wi‑Fi: <b>" + ssid + "</b><br>IP: <b>" + ip +
          "</b><br>MQTT: <b>" + htmlEscape(mqttStatusText()) +
          "</b><br>Scale: <b>" + htmlEscape(scaleStatusText()) +
          "</b><br>Also try: <b>http://atoms3r.local/</b></p></div>";

  html += F("<div class=card><h2>This device</h2><form method=POST action=/save>");
  html += "<label>Name (unique in the house)</label>"
          "<input name=deviceName value=\"" +
          name + "\" placeholder=\"bath\">";
  html += "<label>Mode</label><select name=mode>"
          "<option value=idle" +
          String(mode == "idle" ? " selected" : "") +
          ">Idle (basics only)</option>"
          "<option value=scale" +
          String(mode == "scale" ? " selected" : "") +
          ">Scale bridge (Runstar → MQTT)</option></select>";

  html += F("<h2 style=\"margin-top:1.2rem\">Home Assistant MQTT</h2>"
            "<p class=muted>Mac&nbsp;mini broker — same place as Zigbee / HA. "
            "All Atoms publish here.</p>");
  html += "<label>MQTT broker</label>"
          "<input name=mqttHost value=\"" +
          host + "\" placeholder=\"homeassistant.local or mini IP\">";
  html += "<label>Port</label><input name=mqttPort type=number value=" +
          String(cfg.mqttPort) + ">";
  html += "<label>Username (optional)</label><input name=mqttUser value=\"" + user + "\">";
  html += "<label>Password (optional)</label>"
          "<input name=mqttPassword type=password value=\"" +
          pass + "\">";
  html += "<label>Base topic</label><input name=mqttTopic value=\"" + topic +
          "\" placeholder=\"atoms3r\">";
  html += "<label>Scale Bluetooth name prefix</label><input name=scalePrefix value=\"" +
          prefix + "\">";
  html += "<label>Sex (sent to scale)</label><select name=userSex>"
          "<option value=1" +
          String(sex == 1 ? " selected" : "") +
          ">Male</option>"
          "<option value=2" +
          String(sex == 2 ? " selected" : "") +
          ">Female</option></select>";
  html += "<label>Age</label><input name=userAge type=number min=5 max=120 value=" +
          String(cfg.userAge ? cfg.userAge : 35) + ">";
  html += "<label>Height (cm)</label><input name=userHeight type=number min=80 max=250 value=" +
          String(cfg.userHeightCm ? cfg.userHeightCm : 175) + ">";
  html += F("<p class=muted>MQTT publishes only raw <b>weight</b> and <b>impedance</b> "
            "(no BMI/fat math — do that in your app). Profile is still sent to the scale "
            "for its own BIA. Disconnect Starfit, step on barefoot, wait for impedance.</p>"
            "<button type=submit>Save</button></form>");
  html += "<p class=muted style=\"margin-top:.8rem\">Last stored reading: <b>" +
          htmlEscape(scaleLastPayloadSummary()) + "</b></p>";
  html += F("<form method=POST action=/replay-payload>"
            "<button class=secondary type=submit>Replay last payload</button>"
            "<p class=muted>Re-sends last weight + impedance to MQTT. "
            "If none yet this boot, sends dummy 93.70&nbsp;kg + 597&nbsp;Ω.</p>"
            "</form></div>");

  html += F("<div class=card><h2>Updates &amp; Wi‑Fi</h2>"
            "<a class=\"btn secondary\" href=/update>Upload new firmware (OTA)</a>"
            "<form method=POST action=/wifi-portal style=\"display:inline\">"
            "<button class=secondary type=submit>Change Wi‑Fi</button></form>"
            "<form method=POST action=/reboot style=\"display:inline\">"
            "<button class=secondary type=submit>Restart</button></form>"
            "<p class=muted>Hold the Atom button for 3 seconds to reopen "
            "<b>AtomS3R-Setup</b>.</p></div>");

  html += F("<div class=card><h2>BLE capture</h2>"
            "<p class=muted>Last frames on-device (debug). "
            "<a href=/api/ble style=\"color:#93c5fd\">/api/ble</a> — not sent to MQTT.</p>");
  html += bleCaptureHtml(20);
  html += F("<form method=POST action=/ble-clear style=\"margin-top:.8rem\">"
            "<button class=secondary type=submit>Clear BLE capture</button></form></div>");

  html += F("<div class=card><h2>Activity log</h2>"
            "<p class=muted>Newest first · auto-refresh every 15s · also "
            "<a href=/api/log style=\"color:#93c5fd\">/api/log</a></p>");
  html += logHtmlTable(40);
  html += F("<form method=POST action=/log-clear style=\"margin-top:.8rem\">"
            "<button class=secondary type=submit>Clear log</button></form></div>");
  html += F("</body></html>");
  return html;
}

void webBegin(WebServer &server) {
  server.on("/", HTTP_GET, [&server]() {
    server.send(200, "text/html", pageHtml(configLoad()));
  });

  server.on("/api/status", HTTP_GET, [&server]() {
    DeviceConfig cfg = configLoad();
    JsonDocument doc;
    doc["ok"] = true;
    doc["device"] = cfg.deviceName;
    doc["ssid"] = wifiSsid();
    doc["ip"] = wifiIp();
    doc["mode"] = cfg.mode;
    doc["mqtt_host"] = cfg.mqttHost;
    doc["uptime_ms"] = millis();
    String body;
    serializeJson(doc, body);
    server.send(200, "application/json", body);
  });

  server.on("/save", HTTP_POST, [&server]() {
    DeviceConfig cfg = configLoad();
    if (server.hasArg("deviceName")) {
      cfg.deviceName = server.arg("deviceName");
      cfg.deviceName.trim();
    }
    if (server.hasArg("mode")) cfg.mode = server.arg("mode");
    if (server.hasArg("mqttHost")) {
      cfg.mqttHost = server.arg("mqttHost");
      cfg.mqttHost.trim();
    }
    if (server.hasArg("mqttPort")) cfg.mqttPort = server.arg("mqttPort").toInt();
    if (server.hasArg("mqttUser")) {
      cfg.mqttUser = server.arg("mqttUser");
      cfg.mqttUser.trim();
    }
    if (server.hasArg("mqttPassword")) cfg.mqttPassword = server.arg("mqttPassword");
    if (server.hasArg("mqttTopic")) {
      cfg.mqttBaseTopic = server.arg("mqttTopic");
      cfg.mqttBaseTopic.trim();
    }
    if (server.hasArg("scalePrefix")) cfg.scaleNamePrefix = server.arg("scalePrefix");
    if (server.hasArg("userSex")) cfg.userSex = server.arg("userSex").toInt();
    if (server.hasArg("userAge")) cfg.userAge = server.arg("userAge").toInt();
    if (server.hasArg("userHeight")) cfg.userHeightCm = server.arg("userHeight").toInt();
    if (cfg.mqttPort == 0) cfg.mqttPort = 1883;
    configSave(cfg);
    server.send(200, "text/html",
                "<html><body style=\"font-family:system-ui;background:#111;color:#eee;"
                "padding:2rem\"><p>Saved. Rebooting so MQTT reconnects…</p>"
                "<p>Refresh this page in a few seconds.</p></body></html>");
    delay(500);
    ESP.restart();
  });

  server.on("/api/log", HTTP_GET, [&server]() {
    server.send(200, "application/json", logJson(40));
  });

  server.on("/api/ble", HTTP_GET, [&server]() {
    server.send(200, "application/json", bleCaptureJson(32));
  });

  server.on("/log-clear", HTTP_POST, [&server]() {
    logClear();
    logEvent("sys", "log cleared");
    server.sendHeader("Location", "/");
    server.send(303);
  });

  server.on("/ble-clear", HTTP_POST, [&server]() {
    bleCaptureClear();
    logEvent("sys", "BLE capture cleared");
    server.sendHeader("Location", "/");
    server.send(303);
  });

  server.on("/replay-payload", HTTP_POST, [&server]() {
    const bool had = scaleLastPayloadSummary().indexOf("none") < 0;
    const bool ok = scaleReplayLastPayload();
    String body =
        "<html><body style=\"font-family:system-ui;background:#111;color:#eee;padding:2rem\"><p>";
    if (!ok) {
      body += "Failed — is MQTT connected?";
    } else if (had) {
      body += "Replayed: <b>" + htmlEscape(scaleLastPayloadSummary()) + "</b>";
    } else {
      body += "No last payload — sent <b>dummy</b> 93.70 kg + 597 Ω.";
    }
    body += "</p><p><a href=\"/\" style=\"color:#93c5fd\">Back</a></p></body></html>";
    server.send(200, "text/html", body);
  });

  server.on("/test-weight", HTTP_POST, [&server]() {
    // Keep old URL working → same as replay (dummy if empty).
    server.sendHeader("Location", "/");
    scaleReplayLastPayload();
    server.send(303);
  });

  server.on("/wifi-portal", HTTP_POST, [&server]() {
    server.send(200, "text/plain",
                "Opening WiFi setup network AtomS3R-Setup. Connect to it, "
                "then open http://192.168.4.1/");
    delay(300);
    wifiOpenPortal();
  });

  server.on("/reboot", HTTP_POST, [&server]() {
    server.send(200, "text/plain", "Restarting...");
    delay(300);
    ESP.restart();
  });

  server.begin();
  Serial.println("[web] http://atoms3r.local/  or  http://" + wifiIp() + "/");
}

void otaBegin(WebServer &server) {
  ElegantOTA.begin(&server);
  ElegantOTA.setAutoReboot(true);
  Serial.println("[ota] upload page at /update");
}

void otaLoop() { ElegantOTA.loop(); }
