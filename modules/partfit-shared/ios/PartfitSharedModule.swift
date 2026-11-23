import ExpoModulesCore
import WidgetKit

public class PartfitSharedModule: Module {
  // App Group 约定为 "group." + 主 App bundle id；扩展的 bundle id 多一个 ".widget" 后缀，去掉后同源。
  private var appGroup: String {
    var id = Bundle.main.bundleIdentifier ?? ""
    if id.hasSuffix(".widget") { id = String(id.dropLast(".widget".count)) }
    return "group." + id
  }

  public func definition() -> ModuleDefinition {
    Name("PartfitShared")

    Function("setWidgetData") { (part: String, title: String, days: Int) in
      let d = UserDefaults(suiteName: self.appGroup)
      d?.set(part, forKey: "part")
      d?.set(title, forKey: "title")
      d?.set(days, forKey: "days")
      d?.synchronize()
      if #available(iOS 14.0, *) {
        WidgetCenter.shared.reloadAllTimelines()
      }
      return true
    }

    Function("clearWidgetData") {
      let d = UserDefaults(suiteName: self.appGroup)
      d?.removeObject(forKey: "part")
      d?.removeObject(forKey: "title")
      d?.removeObject(forKey: "days")
      d?.synchronize()
      if #available(iOS 14.0, *) {
        WidgetCenter.shared.reloadAllTimelines()
      }
      return true
    }
  }
}
