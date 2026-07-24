#pragma once

#include <Arduino.h>

// Keeps the last BLE notify/indicate frames on-device so we can reverse-engineer
// composition fields even when MQTT Explorer isn't handy.
void bleCaptureAdd(const char *charId, const uint8_t *data, size_t len, const char *note);
String bleCaptureHtml(size_t maxRows = 24);
String bleCaptureJson(size_t maxRows = 24);
void bleCaptureClear();
