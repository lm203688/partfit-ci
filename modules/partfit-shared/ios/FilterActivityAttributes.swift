import ActivityKit
import Foundation

// 主 App 与 widget 扩展各编译一份同名同构的类型：ActivityKit 按类型名跨进程匹配。
@available(iOS 16.2, *)
struct FilterActivityAttributes: ActivityAttributes {
  public struct ContentState: Codable, Hashable {
    var headline: String
    var detail: String
    var days: Int
  }
  var part: String
}
