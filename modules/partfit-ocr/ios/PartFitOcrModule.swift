import ExpoModulesCore
import Vision
import UIKit

public class PartFitOcrModule: Module {
  public func definition() -> ModuleDefinition {
    Name("PartFitOcr")

    /// 读取图片中的文字，返回按置信度排序的文本行。
    /// 设计约束：只在设备上运行，不上传图片；识别失败返回空数组，由 JS 层退回手输。
    AsyncFunction("recognize") { (uri: String) -> [String] in
      guard let image = PartFitOcrModule.loadImage(uri) else { return [] }
      guard let cgImage = image.cgImage else { return [] }

      let request = VNRecognizeTextRequest()
      request.recognitionLevel = .accurate
      request.usesLanguageCorrection = false
      request.recognitionLanguages = ["en-US"]

      let handler = VNImageRequestHandler(cgImage: cgImage, options: [:])
      do {
        try handler.perform([request])
      } catch {
        return []
      }

      let observations = (request.results ?? [])
      return observations
        .compactMap { $0.topCandidates(1).first }
        .filter { $0.confidence > 0.3 }
        .sorted { $0.confidence > $1.confidence }
        .map { $0.string }
    }
  }

  static func loadImage(_ uri: String) -> UIImage? {
    let cleaned = uri.replacingOccurrences(of: "file://", with: "")
    if let data = try? Data(contentsOf: URL(fileURLWithPath: cleaned)), let img = UIImage(data: data) {
      return img
    }
    return UIImage(contentsOfFile: cleaned)
  }
}
