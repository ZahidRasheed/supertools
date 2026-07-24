#include <Arduino.h>
#include <M5Unified.h>
#include <WebServer.h>

#include "config.h"
#include "core.h"
#include "event_log.h"

static WebServer server(80);
static uint32_t buttonDownMs = 0;
static bool portalHintShown = false;

void setup() {
  auto cfg = M5.config();
  M5.begin(cfg);
  Serial.begin(115200);
  delay(400);

  Serial.println();
  Serial.println("=================================");
  Serial.println(" AtomS3R Ext — MQTT + Scale");
  Serial.println("=================================");
  logEvent("sys", "boot");

  configBegin();
  wifiBegin();
  logEvent("wifi", (String("connected ") + wifiSsid() + " " + wifiIp()).c_str());
  configTime(0, 0, "pool.ntp.org", "time.nist.gov");
  webBegin(server);
  otaBegin(server);
  mqttBegin();
  scaleBegin();

  DeviceConfig conf = configLoad();
  char msg[64];
  snprintf(msg, sizeof(msg), "mode=%s mqtt=%s", conf.mode.c_str(), mqttStatusText().c_str());
  logEvent("sys", msg);
}

void loop() {
  M5.update();
  server.handleClient();
  otaLoop();
  wifiLoop();
  mqttLoop();
  scaleLoop();

  if (M5.BtnA.isPressed()) {
    if (buttonDownMs == 0) {
      buttonDownMs = millis();
      portalHintShown = false;
    } else if (!portalHintShown && millis() - buttonDownMs > 3000) {
      portalHintShown = true;
      logEvent("wifi", "button — opening setup portal");
      wifiOpenPortal();
    }
  } else {
    buttonDownMs = 0;
  }

  delay(5);
}
