import ActivityKit
import ExpoModulesCore
import WidgetKit
import CoreSpotlight
import UniformTypeIdentifiers

public class PartfitSharedModule: Module {
  // App Group 约定为 "group." + 主 App bundle id；扩展的 bundle id 多一个 ".widget" 后缀，去掉后同源。
  private var appGroup: String {
    var id = Bundle.main.bundleIdentifier ?? ""
    if id.hasSuffix(".widget") { id = String(id.dropLast(".widget".count)) }
    return "group." + id
  }

  private static let spotlightDomain = "appliances"

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


    // 实时活动：临期（含逾期）才占用锁屏，由 JS 侧判断后调用。
    Function("liveActivityEnabled") { () -> Bool in
      if #available(iOS 16.1, *) {
        return ActivityAuthorizationInfo().areActivitiesEnabled
      }
      return false
    }

    AsyncFunction("startFilterActivity") { (part: String, headline: String, detail: String, days: Int) -> Bool in
      guard #available(iOS 16.2, *) else { return false }
      guard ActivityAuthorizationInfo().areActivitiesEnabled else { return false }
      for activity in Activity<FilterActivityAttributes>.activities {
        await activity.end(nil, dismissalPolicy: .immediate)
      }
      let attributes = FilterActivityAttributes(part: part)
      let state = FilterActivityAttributes.ContentState(headline: headline, detail: detail, days: days)
      do {
        _ = try Activity.request(
          attributes: attributes,
          content: ActivityContent(state: state, staleDate: nil)
        )
        return true
      } catch {
        return false
      }
    }

    AsyncFunction("endFilterActivity") { () -> Bool in
      guard #available(iOS 16.2, *) else { return false }
      for activity in Activity<FilterActivityAttributes>.activities {
        await activity.end(nil, dismissalPolicy: .immediate)
      }
      return true
    }

    // 把 App 内的电器注册到系统聚焦索引，Spotlight 可直接搜到昵称 / 品牌 / 型号 / 滤芯型号。
    // 入参是与本机 SQLite 一致的 JSON 数组：[{id,title,description,keywords}]，不上传任何数据。
    Function("indexItems") { (json: String) in
      guard let data = json.data(using: .utf8),
            let rows = try? JSONSerialization.jsonObject(with: data) as? [[String: Any]] else {
        return false
      }
      let index = CSSearchableIndex.default()
      index.deleteSearchableItems(withDomainIdentifiers: [Self.spotlightDomain]) { _ in }
      guard !rows.isEmpty else { return true }
      var items: [CSSearchableItem] = []
      for row in rows {
        guard let uid = row["id"] as? String, !uid.isEmpty else { continue }
        let attrs = CSSearchableItemAttributeSet(contentType: UTType.text)
        attrs.title = row["title"] as? String ?? ""
        attrs.contentDescription = row["description"] as? String ?? ""
        attrs.keywords = row["keywords"] as? [String] ?? []
        items.append(CSSearchableItem(uniqueIdentifier: uid,
                                      domainIdentifier: Self.spotlightDomain,
                                      attributeSet: attrs))
      }
      index.indexSearchableItems(items) { err in
        if let err = err {
          NSLog("PartFit spotlight index failed: %@", err.localizedDescription)
        }
      }
      return true
    }

    Function("clearIndex") {
      CSSearchableIndex.default().deleteSearchableItems(withDomainIdentifiers: [Self.spotlightDomain]) { _ in }
      return true
    }
  }
}
