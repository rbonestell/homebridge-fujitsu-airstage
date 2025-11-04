'use strict';

const Accessory = require('./accessory');
const airstage = require('./../airstage');

class OutdoorTemperatureSensorAccessory extends Accessory {

    constructor(platform, accessory) {
        super(platform, accessory);

        this.service = (
            this.accessory.getService(this.Service.TemperatureSensor) ||
            this.accessory.addService(this.Service.TemperatureSensor)
        );

        // Set properties for temperature range (support negative temperatures)
        this.service.getCharacteristic(this.Characteristic.CurrentTemperature)
            .setProps({
                minValue: -50,
                maxValue: 100,
                minStep: 0.1
            })
            .on('get', this.getCurrentTemperature.bind(this));

        this.service.getCharacteristic(this.Characteristic.StatusFault)
            .on('get', this.getStatusFault.bind(this));

        this.service.getCharacteristic(this.Characteristic.Name)
            .on('get', this.getName.bind(this));

        // Track sensor fault state
        this.sensorFault = this.Characteristic.StatusFault.NO_FAULT;
    }

    getCurrentTemperature(callback) {
        const methodName = this.getCurrentTemperature.name;

        this._logMethodCall(methodName);

        this.platform.log.debug(`[OutdoorTemperatureSensor] Requesting outdoor temperature with scale: ${airstage.constants.TEMPERATURE_SCALE_CELSIUS}`);

        this.airstageClient.getOutdoorTemperature(
            this.deviceId,
            airstage.constants.TEMPERATURE_SCALE_CELSIUS,
            (function (error, outdoorTemperature) {
                if (error) {
                    // Check if this is a sensor unavailability error (not a network/device error)
                    if (error.message && error.message.includes('sensor not available')) {
                        // Sensor is not available - set fault state and return fallback value
                        this.platform.log.warn(`[OutdoorTemperatureSensor] Sensor unavailable, setting StatusFault`);
                        this.sensorFault = this.Characteristic.StatusFault.GENERAL_FAULT;

                        // Update the StatusFault characteristic
                        this.service.getCharacteristic(this.Characteristic.StatusFault)
                            .updateValue(this.sensorFault);

                        // HomeKit requires a valid temperature value, return a neutral fallback
                        const fallbackTemp = 0; // 0°C as neutral fallback
                        this._logMethodCallResult(methodName, null, `${fallbackTemp} (sensor fault)`);

                        return callback(null, fallbackTemp);
                    }

                    // For other errors (network, device unreachable, etc.), use standard error handling
                    return this._handleError(methodName, error, callback);
                }

                // Sensor is working - clear fault state
                if (this.sensorFault !== this.Characteristic.StatusFault.NO_FAULT) {
                    this.platform.log.info(`[OutdoorTemperatureSensor] Sensor now available, clearing StatusFault`);
                    this.sensorFault = this.Characteristic.StatusFault.NO_FAULT;
                    this.service.getCharacteristic(this.Characteristic.StatusFault)
                        .updateValue(this.sensorFault);
                }

                this.platform.log.debug(`[OutdoorTemperatureSensor] Received outdoor temperature from client: ${outdoorTemperature}°C`);
                this._logMethodCallResult(methodName, null, outdoorTemperature);

                callback(null, outdoorTemperature);
            }).bind(this)
        );
    }

    getStatusFault(callback) {
        const methodName = this.getStatusFault.name;

        this._logMethodCall(methodName);
        this._logMethodCallResult(methodName, null, this.sensorFault);

        callback(null, this.sensorFault);
    }

    getName(callback) {
        const methodName = this.getName.name;

        this._logMethodCall(methodName);

        this.airstageClient.getName(
            this.deviceId,
            (function(error, name) {
                if (error) {
                    return this._handleError(methodName, error, callback);
                }

                const value = name + ' Outdoor Temperature';

                this._logMethodCallResult(methodName, null, value);

                callback(null, value);
            }).bind(this)
        );
    }
}

module.exports = OutdoorTemperatureSensorAccessory;
