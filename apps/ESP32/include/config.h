#pragma once

#include <Arduino.h>

struct DeviceConfig {
  String deviceName;
  String mode;  // idle | scale

  String mqttHost;
  uint16_t mqttPort;
  String mqttUser;
  String mqttPassword;
  String mqttBaseTopic;

  String scaleNamePrefix;

  // Needed for body-composition / BIA (sex: 1=male, 2=female).
  uint8_t userSex;
  uint8_t userAge;
  uint8_t userHeightCm;
};

void configBegin();
DeviceConfig configLoad();
void configSave(const DeviceConfig &cfg);
void configClearWifi();
