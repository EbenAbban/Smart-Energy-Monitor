#ifndef DISPLAY_MANAGER_H
#define DISPLAY_MANAGER_H

#include "config.h"

void initDisplay();
void updateDisplay(float voltage, float current, float power, float freq, float pf);

#endif // DISPLAY_MANAGER_H
