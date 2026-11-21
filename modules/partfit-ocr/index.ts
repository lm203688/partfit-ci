import { requireNativeModule } from 'expo-modules-core';

/** 端侧文字识别（Vision）。返回识别到的文本行，按置信度从高到低。 */
export default requireNativeModule('PartFitOcr');
