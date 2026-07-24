import Foundation

public enum ClipFormatter {
    private static let trackingExact: Set<String> = [
        "fbclid", "gclid", "gbraid", "wbraid", "gclsrc", "dclid", "msclkid",
        "mc_cid", "mc_eid", "mkt_tok", "igshid", "ref", "ref_src", "ref_url",
        "_hsenc", "_hsmi", "spm", "ncid", "ocid",
    ]

    public static func cleanUrl(_ url: String) -> String {
        guard let parsed = URL(string: url), var components = URLComponents(url: parsed, resolvingAgainstBaseURL: false) else {
            return url
        }
        components.fragment = nil
        if var items = components.queryItems {
            items.removeAll { item in
                let name = item.name.lowercased()
                if trackingExact.contains(name) { return true }
                if name.hasPrefix("utm_") { return true }
                if name.hasPrefix("pk_") { return true }
                return false
            }
            components.queryItems = items.isEmpty ? nil : items
        }
        var path = components.path
        if path.count > 1, path.hasSuffix("/") {
            path.removeLast()
            components.path = path
        }
        guard let out = components.url?.absoluteString else { return url }
        return out.hasSuffix("?") ? String(out.dropLast()) : out
    }

    public static func todayFilename(date: Date = Date()) -> String {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "yyyy-MM-dd"
        return "\(formatter.string(from: date)).md"
    }

    public static func dailyFileHeader(date: Date = Date()) -> String {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US")
        formatter.dateStyle = .full
        return "# Clippings — \(formatter.string(from: date))\n"
    }

    public static func formatClipping(
        text: String,
        pageTitle: String,
        pageUrl: String,
        clippedAt: Date = Date(),
        locale: Locale = Locale(identifier: "en_US")
    ) -> String {
        let timeFormatter = DateFormatter()
        timeFormatter.locale = locale
        timeFormatter.dateStyle = .medium
        timeFormatter.timeStyle = .short

        let title = pageTitle.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
            ? "Untitled page"
            : pageTitle.trimmingCharacters(in: .whitespacesAndNewlines)
        let url = cleanUrl(pageUrl.trimmingCharacters(in: .whitespacesAndNewlines))
        let body = text.trimmingCharacters(in: .whitespacesAndNewlines)
        let time = timeFormatter.string(from: clippedAt)

        var lines = ["", "## \(title)", ""]
        if !url.isEmpty {
            lines.append(url)
            lines.append("")
        }
        lines.append("*Clipped \(time)*")
        lines.append("")
        for line in body.split(separator: "\n", omittingEmptySubsequences: false) {
            lines.append("> \(line)")
        }
        lines.append("")
        lines.append("---")
        lines.append("")
        return lines.joined(separator: "\n")
    }
}
