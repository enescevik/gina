import CoreImage
import Foundation

for path in CommandLine.arguments.dropFirst() {
    guard let image = CIImage(contentsOf: URL(fileURLWithPath: path)) else { print(path, "LOAD_FAIL"); continue }
    let detector = CIDetector(ofType: CIDetectorTypeQRCode, context: nil, options: [CIDetectorAccuracy: CIDetectorAccuracyHigh])
    let features = detector?.features(in: image) as? [CIQRCodeFeature] ?? []
    print((path as NSString).lastPathComponent, features.first?.messageString ?? "NO_QR")
}
