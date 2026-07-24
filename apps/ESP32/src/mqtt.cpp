#include "core.h"
#include "config.h"
#include "event_log.h"

#include <PubSubClient.h>
#include <WiFi.h>

static WiFiClient wifiClient;
static PubSubClient mqtt(wifiClient);
static DeviceConfig mqttCfg;
static uint32_t lastAttemptMs = 0;
static bool discoverySent = false;
static String statusTopic;
static String weightTopic;
static String impedanceTopic;
static String discoveryTopic;

static String deviceJson(const String &uniq) {
  String d = "{";
  d += "\"ids\":[\"" + uniq + "\"],";
  d += "\"name\":\"Atom " + mqttCfg.deviceName + "\",";
  d += "\"mf\":\"M5Stack\",";
  d += "\"mdl\":\"AtomS3R Ext\"";
  d += "}";
  return d;
}

static void buildTopics() {
  statusTopic = mqttCfg.mqttBaseTopic + "/" + mqttCfg.deviceName + "/status";
  weightTopic = mqttCfg.mqttBaseTopic + "/" + mqttCfg.deviceName + "/weight";
  impedanceTopic = mqttCfg.mqttBaseTopic + "/" + mqttCfg.deviceName + "/impedance";
  const String id = mqttCfg.mqttBaseTopic + "_" + mqttCfg.deviceName;
  discoveryTopic = "homeassistant/binary_sensor/" + id + "_status/config";
}

static bool publishSensorDiscovery(const String &suffix, const String &name, const String &statT,
                                   const String &valTpl, const String &unit, const String &devCla,
                                   const String &uniq, const String &dev) {
  const String topic = "homeassistant/sensor/" + uniq + "_" + suffix + "/config";
  String body = "{";
  body += "\"name\":\"" + name + "\",";
  body += "\"uniq_id\":\"" + uniq + "_" + suffix + "\",";
  body += "\"stat_t\":\"" + statT + "\",";
  body += "\"val_tpl\":\"" + valTpl + "\",";
  if (unit.length()) {
    body += "\"unit_of_meas\":\"" + unit + "\",";
  }
  if (devCla.length()) {
    body += "\"dev_cla\":\"" + devCla + "\",";
  }
  body += "\"stat_cla\":\"measurement\",";
  body += "\"avty_t\":\"" + statusTopic + "\",";
  body += "\"pl_avail\":\"online\",";
  body += "\"pl_not_avail\":\"offline\",";
  body += "\"dev\":" + dev + "}";
  return mqtt.publish(topic.c_str(), body.c_str(), true);
}

static void publishDiscovery() {
  if (discoverySent || !mqtt.connected()) {
    return;
  }
  const String uniq = mqttCfg.mqttBaseTopic + "_" + mqttCfg.deviceName;
  const String dev = deviceJson(uniq);

  String online = "{";
  online += "\"name\":\"Online\",";
  online += "\"uniq_id\":\"" + uniq + "_status\",";
  online += "\"stat_t\":\"" + statusTopic + "\",";
  online += "\"pl_on\":\"online\",";
  online += "\"pl_off\":\"offline\",";
  online += "\"dev_cla\":\"connectivity\",";
  online += "\"avty_t\":\"" + statusTopic + "\",";
  online += "\"pl_avail\":\"online\",";
  online += "\"pl_not_avail\":\"offline\",";
  online += "\"dev\":" + dev + "}";

  const bool a = mqtt.publish(discoveryTopic.c_str(), online.c_str(), true);
  const bool b = publishSensorDiscovery("weight", "Weight", weightTopic,
                                        "{{ value_json.weight_kg }}", "kg", "weight", uniq, dev);
  const bool c =
      publishSensorDiscovery("impedance", "Impedance", impedanceTopic,
                             "{{ value_json.impedance_ohm }}", "Ω", "", uniq, dev);
  if (a && b && c) {
    discoverySent = true;
    logEvent("mqtt", "HA discovery: Online + Weight + Impedance");
  }
}

bool mqttPublishWeight(float kg, const char *phase, uint32_t raw, const char *source) {
  if (!mqtt.connected()) {
    logEvent("mqtt", "push weight failed — not connected");
    return false;
  }
  publishDiscovery();
  String payload = "{";
  payload += "\"source\":\"";
  payload += source ? source : "runstar";
  payload += "\",";
  payload += "\"phase\":\"";
  payload += phase ? phase : "final";
  payload += "\",";
  payload += "\"weight_kg\":";
  payload += String(kg, 2);
  payload += ",\"raw\":";
  payload += String(raw);
  payload += "}";
  const bool ok = mqtt.publish(weightTopic.c_str(), payload.c_str(), false);
  char msg[80];
  snprintf(msg, sizeof(msg), "pushed %s %.2f kg → %s", phase ? phase : "weight", kg,
           ok ? "ok" : "fail");
  logEvent("mqtt", msg);
  return ok;
}

bool mqttPublishTestWeight(float kg) {
  return mqttPublishWeight(kg, "final", 0, "runstar-test");
}

bool mqttPublishImpedance(float weightKg, float ohm) {
  if (!mqtt.connected()) {
    return false;
  }
  publishDiscovery();
  String payload = "{";
  payload += "\"source\":\"runstar\",";
  payload += "\"weight_kg\":" + String(weightKg, 2) + ",";
  payload += "\"impedance_ohm\":" + String(ohm, 0);
  payload += "}";
  const bool ok = mqtt.publish(impedanceTopic.c_str(), payload.c_str(), false);
  char msg[72];
  snprintf(msg, sizeof(msg), "pushed impedance %.0f Ω (%s)", ohm, ok ? "ok" : "fail");
  logEvent("mqtt", msg);
  return ok;
}

static int lastMqttState = -1;

static const char *stateName(int s) {
  switch (s) {
    case -1: return "idle";
    case 0: return "connected";
    case 1: return "bad protocol";
    case 2: return "bad client id";
    case 3: return "broker unavailable";
    case 4: return "bad username/password";
    case 5: return "not authorized";
    default: return "error";
  }
}

static bool tryConnect() {
  if (mqttCfg.mqttHost.isEmpty()) {
    return false;
  }
  if (!wifiIsConnected()) {
    return false;
  }

  mqtt.setServer(mqttCfg.mqttHost.c_str(), mqttCfg.mqttPort ? mqttCfg.mqttPort : 1883);
  mqtt.setKeepAlive(30);
  mqtt.setBufferSize(1024);
  wifiClient.setTimeout(8);

  const String clientId =
      "atoms3r-" + mqttCfg.deviceName + "-" + String((uint32_t)ESP.getEfuseMac(), HEX);
  Serial.printf("[mqtt] connecting to %s:%u user=%s ...\n", mqttCfg.mqttHost.c_str(),
                mqttCfg.mqttPort ? mqttCfg.mqttPort : 1883,
                mqttCfg.mqttUser.length() ? mqttCfg.mqttUser.c_str() : "(none)");
  logEvent("mqtt", "connecting to broker…");

  bool ok;
  if (mqttCfg.mqttUser.length() > 0) {
    ok = mqtt.connect(clientId.c_str(), mqttCfg.mqttUser.c_str(), mqttCfg.mqttPassword.c_str(),
                      statusTopic.c_str(), 0, true, "offline");
  } else {
    ok = mqtt.connect(clientId.c_str(), statusTopic.c_str(), 0, true, "offline");
  }

  lastMqttState = mqtt.state();
  if (!ok) {
    char msg[64];
    snprintf(msg, sizeof(msg), "connect failed (%s)", stateName(lastMqttState));
    logEvent("mqtt", msg);
    return false;
  }

  mqtt.publish(statusTopic.c_str(), "online", true);
  logEvent("mqtt", "connected — status=online");
  publishDiscovery();
  return true;
}

void mqttBegin() {
  mqttCfg = configLoad();
  buildTopics();
  discoverySent = false;
  lastAttemptMs = 0;
  if (mqttCfg.mqttHost.isEmpty()) {
    logEvent("mqtt", "no broker configured — skip");
    return;
  }
  tryConnect();
}

void mqttLoop() {
  if (mqttCfg.mqttHost.isEmpty()) {
    return;
  }
  if (mqtt.connected()) {
    mqtt.loop();
    return;
  }
  if (millis() - lastAttemptMs < 5000) {
    return;
  }
  lastAttemptMs = millis();
  discoverySent = false;
  tryConnect();
}

bool mqttIsConnected() { return mqtt.connected(); }

String mqttStatusText() {
  if (mqttCfg.mqttHost.isEmpty()) {
    return "not configured";
  }
  if (mqtt.connected()) {
    return "connected";
  }
  return String("disconnected (") + stateName(lastMqttState) + ")";
}
