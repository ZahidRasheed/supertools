#include "core.h"
#include "config.h"

#include <ESPmDNS.h>
#include <WiFi.h>
#include <WiFiManager.h>

static WiFiManager wm;
static bool portalRunning = false;

void wifiBegin() {
  WiFi.mode(WIFI_STA);

  wm.setConfigPortalBlocking(true);
  wm.setConfigPortalTimeout(0);  // wait until user finishes first setup
  wm.setTitle("AtomS3R Setup");
  wm.setHostname("atoms3r");

  // First boot / no credentials: creates WiFi "AtomS3R-Setup"
  // After that: joins your home WiFi automatically.
  const bool ok = wm.autoConnect("AtomS3R-Setup");
  if (!ok) {
    Serial.println("[wifi] portal failed / timed out — restarting");
    delay(2000);
    ESP.restart();
  }

  Serial.printf("[wifi] connected to %s  ip=%s\n", WiFi.SSID().c_str(),
                WiFi.localIP().toString().c_str());

  if (MDNS.begin("atoms3r")) {
    MDNS.addService("http", "tcp", 80);
    Serial.println("[wifi] open http://atoms3r.local/");
  } else {
    Serial.println("[wifi] mDNS failed — use the IP address instead");
  }
}

void wifiLoop() {
  if (portalRunning) {
    wm.process();
  }
}

bool wifiIsConnected() { return WiFi.status() == WL_CONNECTED; }

String wifiIp() { return WiFi.localIP().toString(); }

String wifiSsid() { return WiFi.SSID(); }

void wifiOpenPortal() {
  Serial.println("[wifi] opening setup portal (AtomS3R-Setup)");
  portalRunning = true;
  wm.setConfigPortalBlocking(false);
  wm.startConfigPortal("AtomS3R-Setup");
}
