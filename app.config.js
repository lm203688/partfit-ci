/**
 * 真实标识不入库：bundle id / Team ID 由 CI 仓库变量注入（PARTFIT_BUNDLE_ID / PARTFIT_TEAM_ID）。
 * 本地不设变量时回落到 app.json 里的占位值，模拟器构建仍可跑通。
 */
module.exports = ({ config }) => {
  const bundleId =
    process.env.PARTFIT_BUNDLE_ID || process.env.BUNDLE_ID || (config.ios && config.ios.bundleIdentifier);
  const teamId = process.env.PARTFIT_TEAM_ID || process.env.TEAM_ID || (config.ios && config.ios.appleTeamId);
  return {
    ...config,
    ios: {
      ...config.ios,
      bundleIdentifier: bundleId,
      ...(teamId ? { appleTeamId: teamId } : {}),
    },
    android: {
      ...config.android,
      package:
        process.env.PARTFIT_BUNDLE_ID || process.env.BUNDLE_ID || (config.android && config.android.package),
    },
  };
};
