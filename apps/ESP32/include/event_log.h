#pragma once

#include <Arduino.h>

// Ring-buffer activity log (state, received, pushed).
void logEvent(const char *area, const char *message);
String logHtmlTable(size_t maxRows = 40);
String logJson(size_t maxRows = 40);
void logClear();
