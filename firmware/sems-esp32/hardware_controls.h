#ifndef HARDWARE_CONTROLS_H
#define HARDWARE_CONTROLS_H

#include "config.h"

void triggerShortBeep(uint16_t freq = 2000, uint16_t durationMs = 80);
void triggerDoubleBeep();
void maybeSaveEnergyToNVS();
void handleButtons();

#endif // HARDWARE_CONTROLS_H
