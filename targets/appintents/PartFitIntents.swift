import AppIntents
import Foundation
import WidgetKit

// Siri / Spotlight answers read from the App Group so they do not have to boot React Native.
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

// The published fitment table flattened at build time (tools/build_intent_index.py).
// App Intents cannot reach the runtime SQLite database, so the same data ships as JSON.
private struct PFIndex {
  struct Part: Decodable {
    let no: String
    let title: String
    let brand: String
    let cat: String
    let months: Int
    let aliases: [String]
  }
  struct ModelRow: Decodable { let model: String; let part: String }
  struct PrefixRow: Decodable { let prefix: String; let part: String }
  struct Payload: Decodable {
    let parts: [Part]
    let models: [ModelRow]
    let prefixes: [PrefixRow]
  }

  static let payload: Payload? = {
    guard let url = Bundle.main.url(forResource: "fitment-index", withExtension: "json"),
          let data = try? Data(contentsOf: url) else { return nil }
    return try? JSONDecoder().decode(Payload.self, from: data)
  }()

  static func norm(_ s: String) -> String {
    s.uppercased()
      .replacingOccurrences(of: " ", with: "")
      .replacingOccurrences(of: "-", with: "")
  }

  static func part(byNo raw: String) -> Part? {
    guard let payload else { return nil }
    let q = norm(raw)
    guard !q.isEmpty else { return nil }
    for item in payload.parts {
      if norm(item.no) == q { return item }
      for alias in item.aliases where norm(alias) == q { return item }
    }
    return nil
  }

  static func part(forModel raw: String) -> Part? {
    guard let payload else { return nil }
    var q = norm(raw)
    guard q.count >= 4 else { return nil }
    if let slash = q.firstIndex(of: "/") { q = String(q[..<slash]) }
    guard q.count >= 4 else { return nil }

    // Exact serial first, then the published family row (model numbers carry an /AA suffix).
    for row in payload.models where norm(row.model) == q {
      if let hit = part(byNo: row.part) { return hit }
    }
    for row in payload.models where norm(row.model).hasPrefix(q + "/") {
      if let hit = part(byNo: row.part) { return hit }
    }
    // Family prefixes published as "starts with" evidence.
    for row in payload.prefixes where norm(row.prefix).hasPrefix(q) {
      if let hit = part(byNo: row.part) { return hit }
    }
    return nil
  }

  static func models(forPart no: String) -> [String] {
    guard let payload else { return [] }
    return payload.models.filter { norm($0.part) == norm(no) }.map { $0.model }
  }
}

struct FilterPartEntity: AppEntity, IndexedEntity {
  static var typeDisplayRepresentation: TypeDisplayRepresentation = TypeDisplayRepresentation(name: "Filter")
  static var defaultQuery = FilterPartQuery()

  let id: String

  // Spotlight indexes the human-readable title, so typing "everydrop 3" in system
  // search surfaces the part itself instead of only the app.
  @Property(indexingKey: \.displayName)
  var summary: String

  var displayRepresentation: DisplayRepresentation {
    DisplayRepresentation(title: "\(id)", subtitle: "\(summary)")
  }
}

struct FilterPartQuery: EntityQuery {
  func entities(for identifiers: [String]) async throws -> [FilterPartEntity] {
    identifiers.compactMap { no in
      PFIndex.part(byNo: no).map { FilterPartEntity(id: $0.no, summary: $0.title) }
    }
  }

  func suggestedEntities() async throws -> [FilterPartEntity] {
    guard let payload = PFIndex.payload else { return [] }
    return payload.parts.prefix(12).map { FilterPartEntity(id: $0.no, summary: $0.title) }
  }

  func defaultResult() async -> FilterPartEntity? { nil }
}

@available(iOS 16.0, *)
struct LookupFilterFitmentIntent: AppIntent {
  static var title: LocalizedStringResource = "Which appliances use this filter"
  static var description: IntentDescription? = IntentDescription(
    "Lists the appliance models the published fitment table maps to a filter part number."
  )
  static var openAppWhenRun: Bool = false

  @Parameter(title: "Filter")
  var filter: FilterPartEntity

  static var parameterSummary: some ParameterSummary {
    Summary("Which appliances fit \(\.$filter)")
  }

  func perform() async throws -> some IntentResult & ProvidesDialog {
    guard let part = PFIndex.part(byNo: filter.id) else {
      return .result(dialog: "I could not find \(filter.id) in the published fitment table.")
    }
    let models = PFIndex.models(forPart: part.no)
    let cadence = "replace every \(part.months) months"
    if models.isEmpty {
      return .result(dialog: "\(part.no) is a \(part.brand) filter (\(cadence)). No model list is published for it yet.")
    }
    let head = models.prefix(4).joined(separator: ", ")
    let more = models.count > 4 ? " and \(models.count - 4) more" : ""
    return .result(dialog: "\(part.no) fits \(models.count) models: \(head)\(more). \(cadence).")
  }
}

@available(iOS 16.0, *)
struct LookupModelIntent: AppIntent {
  static var title: LocalizedStringResource = "Which filter fits this appliance"
  static var description: IntentDescription? = IntentDescription(
    "Finds the replacement filter for an appliance model number using the published fitment table."
  )
  static var openAppWhenRun: Bool = false

  @Parameter(title: "Appliance model", requestValueDialog: "Which appliance model?")
  var model: String

  static var parameterSummary: some ParameterSummary {
    Summary("Which filter fits \(\.$model)")
  }

  func perform() async throws -> some IntentResult & ProvidesDialog {
    guard let part = PFIndex.part(forModel: model) else {
      return .result(dialog: "No published match for \(model). Open PartFit and scan the nameplate to check.")
    }
    return .result(dialog: "\(model) takes \(part.no) — \(part.title). Replace it every \(part.months) months.")
  }
}

@available(iOS 16.0, *)
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

@available(iOS 16.0, *)
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

@available(iOS 16.0, *)
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
      intent: LookupModelIntent(),
      phrases: [
        "Which filter fits my appliance in \(.applicationName)",
        "Look up a filter in \(.applicationName)",
      ],
      shortTitle: "Find a filter",
      systemImageName: "magnifyingglass"
    )
    AppShortcut(
      intent: LookupFilterFitmentIntent(),
      phrases: [
        "Which appliances use this filter in \(.applicationName)",
      ],
      shortTitle: "Filter fitment",
      systemImageName: "checklist"
    )
  }
}
