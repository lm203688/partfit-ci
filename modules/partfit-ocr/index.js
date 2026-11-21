const { requireNativeModule } = require('expo-modules-core');

/** On-device text recognition (Vision). Returns recognized lines sorted by confidence. */
module.exports = requireNativeModule('PartFitOcr');
