#pragma once

#include <Arduino.h>
#include <WebServer.h>

void wifiBegin();
void wifiLoop();
bool wifiIsConnected();
String wifiIp();
String wifiSsid();
void wifiOpenPortal();

void webBegin(WebServer &server);
void otaBegin(WebServer &server);
void otaLoop();

void mqttBegin();
void mqttLoop();
bool mqttIsConnected();
String mqttStatusText();
bool mqttPublishWeight(float kg, const char *phase, uint32_t raw, const char *source);
bool mqttPublishTestWeight(float kg = 72.35f);
bool mqttPublishImpedance(float weightKg, float ohm);

void scaleBegin();
void scaleLoop();
String scaleStatusText();
String scaleLastPayloadSummary();  // e.g. "93.70 kg · 597Ω" or "none"
bool scaleReplayLastPayload();     // last reading, or dummy if none
