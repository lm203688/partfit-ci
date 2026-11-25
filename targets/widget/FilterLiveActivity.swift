import ActivityKit
import SwiftUI
import WidgetKit

// 锁屏与灵动岛共用的实时活动：下一个滤芯的倒计时。
@available(iOS 16.2, *)
struct FilterLiveActivityWidget: Widget {
  var body: some WidgetConfiguration {
    ActivityConfiguration(for: FilterActivityAttributes.self) { context in
      HStack(spacing: 12) {
        Image(systemName: "line.3.horizontal.decrease.circle.fill")
          .font(.title3)
        VStack(alignment: .leading, spacing: 2) {
          Text(context.attributes.part)
            .font(.caption)
            .foregroundStyle(.secondary)
          Text(context.state.headline)
            .font(.headline)
          Text(context.state.detail)
            .font(.caption2)
            .foregroundStyle(.secondary)
        }
        Spacer(minLength: 0)
        Text(daysLabel(context.state.days))
          .font(.system(.title3, design: .rounded).weight(.bold))
      }
      .padding()
      .activityBackgroundTint(Color(red: 0.07, green: 0.09, blue: 0.11))
      .activitySystemActionForegroundColor(.white)
    } dynamicIsland: { context in
      DynamicIsland {
        DynamicIslandExpandedRegion(.leading) {
          Text(context.attributes.part).font(.caption)
        }
        DynamicIslandExpandedRegion(.trailing) {
          Text(daysLabel(context.state.days)).font(.caption.bold())
        }
        DynamicIslandExpandedRegion(.center) {
          Text(context.state.headline).font(.subheadline.bold())
        }
      } compactLeading: {
        Image(systemName: "line.3.horizontal.decrease.circle")
      } compactTrailing: {
        Text(daysLabel(context.state.days)).font(.caption2.bold())
      } minimal: {
        Text(daysLabel(context.state.days)).font(.caption2.bold())
      }
    }
  }

  private func daysLabel(_ days: Int) -> String {
    if days < 0 { return "\(-days)d late" }
    return "\(days)d"
  }
}
