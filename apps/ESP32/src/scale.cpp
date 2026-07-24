#include "core.h"
#include "config.h"
#include "event_log.h"
#include "ble_capture.h"

#include <NimBLEDevice.h>

// Runstar / ICOMON family: service FFB0, write FFB1, notify FFB2 (+ FFB3 for BIA).
static NimBLEUUID kServiceUUID((uint16_t)0xFFB0);
static NimBLEUUID kWriteUUID((uint16_t)0xFFB1);
static NimBLEUUID kNotifyUUID((uint16_t)0xFFB2);
static NimBLEUUID kIndicateUUID((uint16_t)0xFFB3);

static bool scaleEnabled = false;
static NimBLEClient *gClient = nullptr;
static NimBLERemoteCharacteristic *gWriteChar = nullptr;
static NimBLEAddress gTargetAddress;
static bool gHaveTarget = false;
static bool gConnected = false;
static int32_t gLastPublishedRaw = -1;
static float gLastPreviewKg = -1.0f;
static uint32_t gLastScanMs = 0;
static String gStatus = "off";
static String gNamePrefix = "Runstar-";
static uint8_t gSex = 1;
static uint8_t gAge = 35;
static uint8_t gHeight = 175;
static uint8_t gLastCaptureMode = 0xFF;
static uint32_t gLastCaptureGrams = 0;
static bool gLoggedBiaProgress = false;

// Last successful measurement (for web "Replay" button). MQTT gets weight + impedance only.
struct LastPayload {
  bool valid = false;
  bool hasZ = false;
  float kg = 0;
  float ohm = 0;
  uint32_t grams = 0;
};
static LastPayload gLast;

static void storeLastWeight(float kg, uint32_t grams) {
  gLast.valid = true;
  gLast.kg = kg;
  gLast.grams = grams;
  gLast.hasZ = false;
  gLast.ohm = 0;
}

static void storeLastImpedance(float ohm) {
  if (!gLast.valid || ohm <= 0) {
    return;
  }
  gLast.hasZ = true;
  gLast.ohm = ohm;
}

// ICOMON / Crénot / Runstar: bytes 6..8 BE, low 18 bits = weight in grams.
static uint32_t u24be(const uint8_t *data, size_t offset) {
  return (static_cast<uint32_t>(data[offset]) << 16) |
         (static_cast<uint32_t>(data[offset + 1]) << 8) |
         static_cast<uint32_t>(data[offset + 2]);
}

static uint32_t weightGrams18(uint32_t raw24) { return raw24 & 0x3FFFFu; }

static float decodeWeightKg(uint32_t raw24) { return weightGrams18(raw24) / 1000.0f; }

static bool plausibleKg(float kg) { return kg >= 5.0f && kg <= 300.0f; }

// R6 A3: impedance uint16 LE at bytes 8..9 (e.g. 55 02 → 597 Ω).
static bool readImpedanceOhm(const uint8_t *data, size_t len, float *outOhm) {
  if (!data || len < 10 || !outOhm) {
    return false;
  }
  const uint16_t z = data[8] | (static_cast<uint16_t>(data[9]) << 8);
  if (z < 150 || z > 1600) {
    return false;
  }
  *outOhm = static_cast<float>(z);
  return true;
}

static bool writeConfig(uint8_t b2, uint8_t b3, uint8_t b4, uint8_t b5) {
  if (!gWriteChar) {
    return false;
  }
  uint8_t payload[8] = {0xAC, 0x02, b2, b3, b4, b5, 0xCC, 0x00};
  payload[7] =
      static_cast<uint8_t>((payload[2] + payload[3] + payload[4] + payload[5] + payload[6]) & 0xFF);
  return gWriteChar->writeValue(payload, sizeof(payload), true);
}

static void sendInitSequence() {
  writeConfig(0xF7, 0x00, 0x00, 0x00);
  delay(30);
  writeConfig(0xFA, 0x00, 0x00, 0x00);
  delay(30);
  writeConfig(0xFB, gSex, gAge, gHeight);
  delay(30);

  struct tm timeinfo = {};
  if (getLocalTime(&timeinfo, 200)) {
    writeConfig(0xFD, static_cast<uint8_t>(timeinfo.tm_year % 100),
                static_cast<uint8_t>(timeinfo.tm_mon + 1),
                static_cast<uint8_t>(timeinfo.tm_mday));
    delay(30);
    writeConfig(0xFC, static_cast<uint8_t>(timeinfo.tm_hour),
                static_cast<uint8_t>(timeinfo.tm_min),
                static_cast<uint8_t>(timeinfo.tm_sec));
    delay(30);
  } else {
    writeConfig(0xFD, 26, 7, 23);
    delay(30);
    writeConfig(0xFC, 12, 0, 0);
    delay(30);
  }
  writeConfig(0xFE, 0x06, 0x00, 0x00);
  gStatus = "ready — bare feet, hold still";
  char msg[80];
  snprintf(msg, sizeof(msg), "init sent (sex=%u age=%u height=%u cm)", gSex, gAge, gHeight);
  logEvent("scale", msg);
}

static void publishWeightOnce(float kg, uint32_t grams, const char *source) {
  if (static_cast<int32_t>(grams) == gLastPublishedRaw) {
    return;
  }
  gLastPublishedRaw = static_cast<int32_t>(grams);
  char msg[56];
  snprintf(msg, sizeof(msg), "final %.2f kg", kg);
  logEvent("scale", msg);
  mqttPublishWeight(kg, "final", grams, source);
  storeLastWeight(kg, grams);
}

static void handleRunstarWeight(const uint8_t *data) {
  const uint8_t mode = data[4];
  const uint32_t raw24 = u24be(data, 6);
  const uint32_t grams = weightGrams18(raw24);
  const float kg = decodeWeightKg(raw24);

  if (!plausibleKg(kg)) {
    char msg[72];
    snprintf(msg, sizeof(msg), "ignored weight raw=%06lX (out of range)", (unsigned long)raw24);
    logEvent("scale", msg);
    return;
  }

  if (mode == 0x01) {
    if (fabsf(kg - gLastPreviewKg) >= 0.05f) {
      gLastPreviewKg = kg;
      gStatus = String("measuring ") + String(kg, 2) + " kg";
      char msg[48];
      snprintf(msg, sizeof(msg), "measuring %.2f kg", kg);
      logEvent("scale", msg);
    }
    return;
  }

  // 0x02 = weight locked; 0x04 = BIA in progress (wait for A3 impedance).
  if (mode == 0x04) {
    publishWeightOnce(kg, grams, "runstar");
    gStatus = String("BIA running… ") + String(kg, 2) + " kg";
    if (!gLoggedBiaProgress) {
      gLoggedBiaProgress = true;
      logEvent("scale", "BIA in progress — hold still barefoot");
    }
    return;
  }
  if (mode == 0x02) {
    gLoggedBiaProgress = false;
    publishWeightOnce(kg, grams, "runstar");
    gStatus = String("weight ") + String(kg, 2) + " kg — waiting impedance…";
  }
}

static void onNotify(NimBLERemoteCharacteristic *characteristic, uint8_t *data, size_t length,
                     bool /*isNotify*/) {
  if (!data || length == 0) {
    return;
  }

  const char *cid = "FFB2";
  if (characteristic && characteristic->getUUID().equals(kIndicateUUID)) {
    cid = "FFB3";
  }

  char note[28] = "frame";
  bool toCapture = true;
  if (length >= 5 && data[3] == 0xA2) {
    const uint32_t grams = weightGrams18(u24be(data, 6));
    if (data[4] == 0x01) {
      snprintf(note, sizeof(note), "A2 measuring");
    } else if (data[4] == 0x02) {
      snprintf(note, sizeof(note), "A2 final weight");
    } else if (data[4] == 0x04) {
      snprintf(note, sizeof(note), "A2 BIA progress");
      if (gLastCaptureMode == 0x04 && gLastCaptureGrams == grams) {
        toCapture = false;
      }
    } else {
      snprintf(note, sizeof(note), "A2 mode=%02X", data[4]);
    }
    if (toCapture) {
      gLastCaptureMode = data[4];
      gLastCaptureGrams = grams;
    }
  } else if (length >= 4 && data[3] == 0xA3) {
    snprintf(note, sizeof(note), "A3 impedance");
    gLastCaptureMode = 0xA3;
  } else if (characteristic && characteristic->getUUID().equals(kIndicateUUID)) {
    snprintf(note, sizeof(note), "FFB3 len=%u", (unsigned)length);
  } else {
    snprintf(note, sizeof(note), "other len=%u", (unsigned)length);
  }

  if (toCapture) {
    bleCaptureAdd(cid, data, length, note);
  }

  if (length != 20) {
    return;
  }

  if (data[3] == 0xA2) {
    handleRunstarWeight(data);
    return;
  }

  // A3: weight @ 5..7 + impedance Ω @ 8..9 LE — raw values only (no fat/BMI math).
  if (data[3] == 0xA3) {
    const uint32_t raw24 = u24be(data, 5);
    const uint32_t grams = weightGrams18(raw24);
    const float kg = decodeWeightKg(raw24);
    float ohm = 0;
    const bool haveZ = readImpedanceOhm(data, length, &ohm);

    if (!plausibleKg(kg)) {
      logEvent("scale", "A3 frame ignored (bad weight)");
      return;
    }

    publishWeightOnce(kg, grams, "runstar");
    if (haveZ) {
      char msg[56];
      snprintf(msg, sizeof(msg), "impedance %.0f Ω (%.2f kg)", ohm, kg);
      logEvent("scale", msg);
      mqttPublishImpedance(kg, ohm);
      // Weight may already be stored; attach Z to the same reading.
      if (!gLast.valid || gLast.grams != grams) {
        storeLastWeight(kg, grams);
      }
      storeLastImpedance(ohm);
      gStatus = String(kg, 2) + " kg · " + String(ohm, 0) + " Ω";
    } else {
      logEvent("scale", "A3 weight ok but impedance out of range");
      if (!gLast.valid || gLast.grams != grams) {
        storeLastWeight(kg, grams);
      }
      gStatus = String(kg, 2) + " kg (no Z)";
    }
  }
}

class ClientCallbacks : public NimBLEClientCallbacks {
  void onConnect(NimBLEClient * /*pClient*/) override {
    gConnected = true;
    gStatus = "BLE connected";
    logEvent("scale", "BLE connected to scale");
  }
  void onDisconnect(NimBLEClient * /*pClient*/) override {
    gConnected = false;
    gWriteChar = nullptr;
    gStatus = "BLE disconnected — scanning";
    logEvent("scale", "BLE disconnected");
  }
};

class ScanCallbacks : public NimBLEAdvertisedDeviceCallbacks {
  void onResult(NimBLEAdvertisedDevice *advertisedDevice) override {
    if (!advertisedDevice->haveName()) {
      return;
    }
    const String n(advertisedDevice->getName().c_str());
    if (!n.startsWith(gNamePrefix) && !n.startsWith("RUNSTAR-") && !n.startsWith("Runstar-")) {
      return;
    }
    gTargetAddress = advertisedDevice->getAddress();
    gHaveTarget = true;
    gStatus = String("found ") + n;
    logEvent("scale", (String("found ") + n).c_str());
    NimBLEDevice::getScan()->stop();
  }
};

static ClientCallbacks gClientCallbacks;
static ScanCallbacks gScanCallbacks;

static void startScan() {
  NimBLEScan *scan = NimBLEDevice::getScan();
  scan->setAdvertisedDeviceCallbacks(&gScanCallbacks, false);
  scan->setActiveScan(true);
  scan->setInterval(80);
  scan->setWindow(40);
  scan->start(6, false);
  gLastScanMs = millis();
  gStatus = "scanning for scale";
}

static bool connectToScale() {
  if (!gHaveTarget) {
    return false;
  }
  if (!gClient) {
    gClient = NimBLEDevice::createClient();
    gClient->setClientCallbacks(&gClientCallbacks, false);
  }
  if (gClient->isConnected()) {
    return true;
  }
  if (!gClient->connect(gTargetAddress)) {
    gStatus = "connect failed";
    return false;
  }

  NimBLERemoteService *service = gClient->getService(kServiceUUID);
  if (!service) {
    gClient->disconnect();
    gStatus = "no FFB0 service";
    return false;
  }

  gWriteChar = service->getCharacteristic(kWriteUUID);
  NimBLERemoteCharacteristic *ffb2 = service->getCharacteristic(kNotifyUUID);
  NimBLERemoteCharacteristic *ffb3 = service->getCharacteristic(kIndicateUUID);
  if (!gWriteChar || !ffb2) {
    gClient->disconnect();
    gStatus = "missing FFB1/FFB2";
    return false;
  }
  if (!ffb2->subscribe(true, onNotify)) {
    gClient->disconnect();
    gStatus = "FFB2 subscribe failed";
    return false;
  }
  if (ffb3) {
    if (ffb3->canIndicate()) {
      ffb3->subscribe(false, onNotify);
    } else if (ffb3->canNotify()) {
      ffb3->subscribe(true, onNotify);
    }
    logEvent("scale", "subscribed FFB2+FFB3");
  } else {
    logEvent("scale", "subscribed FFB2 only (no FFB3)");
  }

  sendInitSequence();
  return true;
}

void scaleBegin() {
  DeviceConfig cfg = configLoad();
  scaleEnabled = (cfg.mode == "scale");
  gNamePrefix = cfg.scaleNamePrefix.length() ? cfg.scaleNamePrefix : "Runstar-";
  gSex = cfg.userSex ? cfg.userSex : 1;
  gAge = cfg.userAge ? cfg.userAge : 35;
  gHeight = cfg.userHeightCm ? cfg.userHeightCm : 175;
  if (!scaleEnabled) {
    gStatus = "off (mode≠scale)";
    logEvent("scale", "mode idle — scale off");
    return;
  }
  logEvent("scale", "scale mode on — starting BLE scan");
  NimBLEDevice::init("AtomS3R-Scale");
  NimBLEDevice::setPower(ESP_PWR_LVL_P9);
  gHaveTarget = false;
  gLastPublishedRaw = -1;
  gLastCaptureMode = 0xFF;
  gLastCaptureGrams = 0;
  gLoggedBiaProgress = false;
  bleCaptureClear();
  startScan();
}

void scaleLoop() {
  if (!scaleEnabled) {
    return;
  }
  if (gConnected) {
    return;
  }
  if (gHaveTarget) {
    if (!connectToScale()) {
      gHaveTarget = false;
      delay(500);
      startScan();
    }
    return;
  }
  if (!NimBLEDevice::getScan()->isScanning() && millis() - gLastScanMs > 2500) {
    startScan();
  }
}

String scaleStatusText() { return gStatus; }

String scaleLastPayloadSummary() {
  if (!gLast.valid) {
    return "none (will send dummy)";
  }
  String s = String(gLast.kg, 2) + " kg";
  if (gLast.hasZ) {
    s += " · " + String(gLast.ohm, 0) + " Ω";
  }
  return s;
}

bool scaleReplayLastPayload() {
  LastPayload p = gLast;
  const char *src = "replay";
  if (!p.valid) {
    p.valid = true;
    p.hasZ = true;
    p.kg = 93.70f;
    p.grams = 93700;
    p.ohm = 597.0f;
    src = "dummy";
    gLast = p;
    logEvent("scale", "no last payload — sending dummy 93.70 kg + 597 Ω");
  } else {
    char msg[64];
    snprintf(msg, sizeof(msg), "replaying last %.2f kg%s", p.kg, p.hasZ ? " + Z" : "");
    logEvent("scale", msg);
  }

  bool ok = mqttPublishWeight(p.kg, "final", p.grams, src);
  if (p.hasZ) {
    ok = mqttPublishImpedance(p.kg, p.ohm) && ok;
  }
  return ok;
}
