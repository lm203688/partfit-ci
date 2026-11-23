import SwiftUI
import WidgetKit

// App Group 约定为 "group." + 主 App bundle id；本扩展的 bundle id 带 ".widget" 后缀，去掉后同源。
private var appGroup: String {
  var id = Bundle.main.bundleIdentifier ?? ""
  if id.hasSuffix(".widget") { id = String(id.dropLast(".widget".count)) }
  return "group." + id
}

struct FilterEntry: TimelineEntry {
  let date: Date
  let part: String
  let title: String
  let days: Int
  let hasData: Bool
}

struct FilterProvider: TimelineProvider {
  private func defaults() -> UserDefaults? { UserDefaults(suiteName: appGroup) }

  func placeholder(in context: Context) -> FilterEntry {
    FilterEntry(date: Date(), part: "EDR1RXD1", title: "Kitchen fridge", days: 9, hasData: true)
  }

  func getSnapshot(in context: Context, completion: @escaping (FilterEntry) -> Void) {
    completion(read())
  }

  func getTimeline(in context: Context, completion: @escaping (Timeline<FilterEntry>) -> Void) {
    let entry = read()
    // 每天零点后刷新一次；App 内改动会主动 reloadTimelines。
    let cal = Calendar.current
    let startOfTomorrow = cal.startOfDay(for: Date()).addingTimeInterval(86400)
    completion(Timeline(entries: [entry], policy: .after(startOfTomorrow)))
  }

  private func read() -> FilterEntry {
    let d = defaults()
    let part = d?.string(forKey: "part") ?? ""
    let title = d?.string(forKey: "title") ?? ""
    let days = d?.integer(forKey: "days") ?? 0
    let hasData = d != nil && !part.isEmpty
    return FilterEntry(date: Date(), part: part, title: title, days: days, hasData: hasData)
  }
}

struct FilterView: View {
  var entry: FilterEntry

  private var ink: Color { Color(red: 0.078, green: 0.125, blue: 0.110) }      // #14201C
  private var sub: Color { Color(red: 0.361, green: 0.420, blue: 0.396) }      // #5C6B65
  private var accent: Color { Color(red: 0.059, green: 0.420, blue: 0.329) }   // #0F6B54
  private var danger: Color { Color(red: 0.639, green: 0.169, blue: 0.129) }   // #A32B21
  private var warn: Color { Color(red: 0.706, green: 0.376, blue: 0.039) }     // #B4600A
  private var bg: Color { Color(red: 0.969, green: 0.973, blue: 0.969) }       // #F7F8F7

  private var daysValue: String {
    if entry.days > 0 { return "\(entry.days)" }
    if entry.days == 0 { return "0" }
    return "\(-entry.days)"
  }

  private var daysCaption: String {
    if entry.days > 0 { return "days left" }
    if entry.days == 0 { return "due today" }
    return "days overdue"
  }

  private var daysColor: Color {
    if entry.days <= 0 { return danger }
    if entry.days <= 14 { return warn }
    return accent
  }

  var body: some View {
    VStack(alignment: .leading, spacing: 3) {
      Text("NEXT FILTER")
        .font(.system(size: 9, weight: .semibold))
        .tracking(0.8)
        .foregroundStyle(sub)

      if entry.hasData {
        HStack(alignment: .firstTextBaseline, spacing: 4) {
          Text(daysValue)
            .font(.system(size: 30, weight: .bold, design: .rounded))
            .foregroundStyle(daysColor)
          Text(daysCaption)
            .font(.system(size: 10, weight: .medium))
            .foregroundStyle(sub)
        }
        Text(entry.part)
          .font(.system(size: 15, weight: .bold, design: .monospaced))
          .lineLimit(1)
          .minimumScaleFactor(0.7)
          .foregroundStyle(ink)
        if !entry.title.isEmpty {
          Text(entry.title)
            .font(.system(size: 10))
            .lineLimit(1)
            .foregroundStyle(sub)
        }
      } else {
        Text("Open PartFit")
          .font(.system(size: 22, weight: .bold, design: .rounded))
          .foregroundStyle(ink)
        Text("Find the exact filter for your appliance")
          .font(.system(size: 10))
          .lineLimit(2)
          .foregroundStyle(sub)
      }
      Spacer(minLength: 0)
    }
    .frame(maxWidth: .infinity, alignment: .leading)
    .padding(12)
    .containerBackground(bg, for: .widget)
  }
}

@main
struct PartFitWidget: Widget {
  let kind = "PartFitNextFilter"

  var body: some WidgetConfiguration {
    StaticConfiguration(kind: kind, provider: FilterProvider()) { entry in
      FilterView(entry: entry)
    }
    .configurationDisplayName("Next filter")
    .description("Shows the appliance that needs a new filter next and the exact replacement part number.")
    .supportedFamilies([.systemSmall])
  }
}
