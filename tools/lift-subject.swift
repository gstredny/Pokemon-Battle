// Lift the monster out of a finished picture (sky, ruins, frame and all) with
// macOS Vision, the same feature as "Copy Subject" in Photos. For drawings on
// paper, use cutout.py instead.
//
//   swift tools/lift-subject.swift PICTURE OUT.png
import CoreImage
import Foundation
import ImageIO
import UniformTypeIdentifiers
import Vision

let args = CommandLine.arguments
guard args.count == 3 else { print("usage: swift tools/lift-subject.swift PICTURE OUT.png"); exit(2) }
guard let input = CIImage(contentsOf: URL(fileURLWithPath: args[1])) else { print("cannot open \(args[1])"); exit(1) }

let request = VNGenerateForegroundInstanceMaskRequest()
let handler = VNImageRequestHandler(ciImage: input)
try handler.perform([request])
guard let result = request.results?.first else { print("no monster found in \(args[1])"); exit(1) }

let masked = try result.generateMaskedImage(ofInstances: result.allInstances, from: handler, croppedToInstancesExtent: true)
let image = CIImage(cvPixelBuffer: masked)
let cg = CIContext().createCGImage(image, from: image.extent)!
let out = CGImageDestinationCreateWithURL(URL(fileURLWithPath: args[2]) as CFURL, UTType.png.identifier as CFString, 1, nil)!
CGImageDestinationAddImage(out, cg, nil)
CGImageDestinationFinalize(out)
print("saved \(cg.width) x \(cg.height) to \(args[2])")
