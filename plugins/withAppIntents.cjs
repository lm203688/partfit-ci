/**
 * 把 targets/appintents/*.swift 与 *.json 注入「主 App target」，让 App Intent 走主 App 的
 * AppShortcutsProvider —— 出现在 Spotlight / 聚焦搜索 / Siri 建议里，不需要单独扩展。
 *
 * 与 withWidget.cjs 的区别：widget 是独立 app_extension target；App Intent 必须住在主 App
 * target 里，才能产出主 Bundle 的 Intent 元数据（Metadata.appintents）。
 *
 * .json 是给 Swift 侧读的数据资源（如 PartFit 的 fitment-index.json），会作为
 * Copy Bundle Resources 打进主 App bundle。
 *
 * 前提：targets/appintents/ 下只放纯 AppIntents/Foundation 代码与数据，不引 UIKit 视图。
 */
const fs = require('fs');
const path = require('path');
const { withXcodeProject, withDangerousMod } = require('expo/config-plugins');

const SRC_SUBDIR = path.join('targets', 'appintents');
const DST_DIR_NAME = 'AppIntents';
const SWIFT = (f) => f.endsWith('.swift');
const RESOURCE = (f) => f.endsWith('.json');

function copySources(config) {
  return withDangerousMod(config, [
    'ios',
    async (cfg) => {
      const root = cfg.modRequest.projectRoot;
      const srcDir = path.join(root, SRC_SUBDIR);
      if (!fs.existsSync(srcDir)) {
        console.warn('[withAppIntents] no targets/appintents dir, skipping');
        return cfg;
      }
      const iosDir = path.join(root, 'ios');
      const dstDir = path.join(iosDir, DST_DIR_NAME);
      fs.mkdirSync(dstDir, { recursive: true });
      const swift = fs.readdirSync(srcDir).filter(SWIFT);
      const resources = fs.readdirSync(srcDir).filter(RESOURCE);
      if (!swift.length) throw new Error('[withAppIntents] targets/appintents has no .swift file');
      for (const f of [...swift, ...resources]) {
        fs.copyFileSync(path.join(srcDir, f), path.join(dstDir, f));
      }
      console.log(`[withAppIntents] copied ${swift.length} swift file(s), ${resources.length} resource(s)`);
      return cfg;
    },
  ]);
}

module.exports = function withAppIntents(config) {
  config = copySources(config);
  return withXcodeProject(config, (cfg) => {
    const proj = cfg.modResults;
    const appTarget = proj.getFirstTarget();
    const dstDir = path.join(cfg.modRequest.projectRoot, 'ios', DST_DIR_NAME);
    if (!fs.existsSync(dstDir)) return cfg;

    const files = fs.readdirSync(dstDir).filter(SWIFT);
    const resources = fs.readdirSync(dstDir).filter(RESOURCE);
    if (proj.pbxGroupByName(DST_DIR_NAME)) {
      // 幂等：已经注入过
      return cfg;
    }
    const relPaths = [...files, ...resources].map((f) => `${DST_DIR_NAME}/${f}`);
    const group = proj.addPbxGroup(relPaths, DST_DIR_NAME, DST_DIR_NAME);
    const mainGroup = proj.getFirstProject().firstProject.mainGroup;
    proj.addToPbxGroup(group.uuid, mainGroup);
    for (const f of files) {
      proj.addSourceFile(path.join(dstDir, f), { target: appTarget.uuid }, group.uuid);
    }
    for (const f of resources) {
      proj.addResourceFile(path.join(dstDir, f), { target: appTarget.uuid }, group.uuid);
    }
    console.log(`[withAppIntents] injected ${files.length} source + ${resources.length} resource file(s)`);

    // App Intents 需要 iOS 16+，低于 16 就抬到 16
    const listId = proj.pbxNativeTargetSection()[appTarget.uuid].buildConfigurationList;
    const list = proj.pbxXCConfigurationList()[listId];
    const configs = proj.pbxXCBuildConfigurationSection();
    for (const c of (list.buildConfigurations || []).map((x) => x.value)) {
      const bs = configs[c] && configs[c].buildSettings;
      if (!bs) continue;
      const cur = Number((bs.IPHONEOS_DEPLOYMENT_TARGET || '17.0').replace(/"/g, ''));
      if (cur && cur < 16) bs.IPHONEOS_DEPLOYMENT_TARGET = '"16.0"';
    }
    return cfg;
  });
};
