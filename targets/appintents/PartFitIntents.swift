import AppIntents
import Foundation
import WidgetKit

// 数据来自主 App 与 widget 共用的 App Group，因此 Siri / 聚焦搜索里回答不需要拉起 RN。
private enum PFStore {
  static var appGroup: String {
    var id = Bundle.main.bundleIdentifier ?? ""
    if id.hasSuffix(".widget") { id = String(id.dropLast(".widget".count)) }
    return "group." + id
  }

  static func read() -> (part: String, title: String, days: Int)? {
    guard let d = UserDefaults(suiteName: appGroup),
          let part = d.string(forKey: "part"), !part.isEmpty else { return nil }
    return (part, d.string(forKey: "title") ?? "", d.integer(forKey: "days"))
  }
}

struct NextFilterIntent: AppIntent {
  static var title: LocalizedStringResource = "Next filter"
  static var description: IntentDescription? = IntentDescription(
    "Shows which appliance needs a new filter next, with the exact replacement part number."
  )
  static var openAppWhenRun: Bool = false

  func perform() async throws -> some IntentResult & ProvidesDialog {
    guard let s = PFStore.read() else {
      return .result(dialog: "Nothing saved yet. Open PartFit and add your first appliance.")
    }
    let who = s.title.isEmpty ? "Your appliance" : s.title
    let when: String
    if s.days > 0 {
      when = "\(s.days) days left"
    } else if s.days == 0 {
      when = "due today"
    } else {
      when = "\(-s.days) days overdue"
    }
    return .result(dialog: "\(who): \(s.part), \(when).")
  }
}

struct OpenPartFitIntent: AppIntent {
  static var title: LocalizedStringResource = "Open PartFit"
  static var description: IntentDescription? = IntentDescription(
    "Opens PartFit to find the exact replacement filter for your appliance."
  )
  static var openAppWhenRun: Bool = true

  func perform() async throws -> some IntentResult {
    return .result()
  }
}

struct PartFitShortcuts: AppShortcutsProvider {
  static var appShortcuts: [AppShortcut] {
    AppShortcut(
      intent: NextFilterIntent(),
      phrases: [
        "Check my next filter in \(.applicationName)",
        "Next filter in \(.applicationName)",
      ],
      shortTitle: "Next filter",
      systemImageName: "air.purifier"
    )
    AppShortcut(
      intent: OpenPartFitIntent(),
      phrases: ["Open \(.applicationName)"],
      shortTitle: "Open PartFit",
      systemImageName: "magnifyingglass"
    )
  }
}
