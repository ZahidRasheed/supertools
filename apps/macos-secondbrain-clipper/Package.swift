// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "AssistantClipper",
    platforms: [.macOS(.v13)],
    products: [
        .executable(name: "AssistantClipper", targets: ["AssistantClipper"]),
        .library(name: "ClipCore", targets: ["ClipCore"]),
    ],
    targets: [
        .target(
            name: "ClipCore",
            path: "Sources/ClipCore",
            linkerSettings: [
                .linkedFramework("AppKit"),
                .linkedFramework("CoreGraphics"),
            ]
        ),
        .executableTarget(
            name: "AssistantClipper",
            dependencies: ["ClipCore"],
            path: "Sources/AssistantClipper",
            exclude: ["Resources/Info.plist"],
            linkerSettings: [
                .linkedFramework("Carbon"),
            ]
        ),
        .testTarget(
            name: "ClipCoreTests",
            dependencies: ["ClipCore"],
            path: "Tests/ClipCoreTests"
        ),
    ]
)
