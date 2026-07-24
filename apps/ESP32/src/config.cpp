#include "config.h"

#include <Preferences.h>
#include <WiFi.h>

static Preferences prefs;

void configBegin() { prefs.begin("atoms3r", false); }

DeviceConfig configLoad() {
  DeviceConfig cfg;
  cfg.deviceName = prefs.getString("deviceName", "atom");
  cfg.mode = prefs.getString("mode", "idle");

  cfg.mqttHost = prefs.getString("mqttHost", "");
  if (cfg.mqttHost.isEmpty()) {
    cfg.mqttHost = prefs.getString("ingestHost", "");
  }
  cfg.mqttPort = prefs.getUShort("mqttPort", 0);
  if (cfg.mqttPort == 0) {
    const uint16_t legacy = prefs.getUShort("ingestPort", 0);
    cfg.mqttPort = legacy == 0 || legacy == 8765 ? 1883 : legacy;
  }
  cfg.mqttUser = prefs.getString("mqttUser", "");
  cfg.mqttPassword = prefs.getString("mqttPass", "");
  cfg.mqttBaseTopic = prefs.getString("mqttTopic", "atoms3r");

  cfg.scaleNamePrefix = prefs.getString("scalePrefix", "Runstar-");
  cfg.userSex = prefs.getUChar("userSex", 1);
  cfg.userAge = prefs.getUChar("userAge", 35);
  cfg.userHeightCm = prefs.getUChar("userHeight", 175);
  return cfg;
}

void configSave(const DeviceConfig &cfg) {
  prefs.putString("deviceName", cfg.deviceName);
  prefs.putString("mode", cfg.mode);
  prefs.putString("mqttHost", cfg.mqttHost);
  prefs.putUShort("mqttPort", cfg.mqttPort);
  prefs.putString("mqttUser", cfg.mqttUser);
  prefs.putString("mqttPass", cfg.mqttPassword);
  prefs.putString("mqttTopic", cfg.mqttBaseTopic);
  prefs.putString("scalePrefix", cfg.scaleNamePrefix);
  prefs.putUChar("userSex", cfg.userSex);
  prefs.putUChar("userAge", cfg.userAge);
  prefs.putUChar("userHeight", cfg.userHeightCm);
}

void configClearWifi() {
  Preferences wm;
  wm.begin("wifi", false);
  wm.clear();
  wm.end();
  WiFi.disconnect(true, true);
}
