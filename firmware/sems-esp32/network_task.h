#ifndef NETWORK_TASK_H
#define NETWORK_TASK_H

#include "config.h"
#include "wifi_manager_helper.h"
#include "hardware_controls.h"

void discoverBackendIP();
void handleUdpDiscovery();
void seedEnergyFromBackend();
void fetchBudget();
void syncRelayStates();
void postRelayStatusToBackend(int relayNumber, bool status);
void postToBackend(float voltage, float current, float power, float freq, float pf, bool alert);
void networkTask(void *pvParameters);

#endif // NETWORK_TASK_H
