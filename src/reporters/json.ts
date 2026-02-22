import type { ScanResult } from "../parsers/schema.js";

// ---------------------------------------------------------------------------
// JsonReporter
// ---------------------------------------------------------------------------

/**
 * Serialize a ScanResult as formatted JSON.
 *
 * The output is a self-contained JSON string suitable for piping into jq,
 * saving to a file, or passing to downstream tooling.
 */
export class JsonReporter {
  /**
   * Convert the scan result into a pretty-printed JSON string.
   *
   * Map objects (e.g. DependencyTree.nodes) are converted to plain
   * objects so that they survive JSON serialization.
   */
  report(result: ScanResult): string {
    return JSON.stringify(this.toSerializable(result), null, 2);
  }

  // -------------------------------------------------------------------------
  // Internals
  // -------------------------------------------------------------------------

  /**
   * Walk the value recursively and convert Map instances into plain objects
   * so JSON.stringify can handle them.
   */
  private toSerializable(value: unknown): unknown {
    if (value === null || value === undefined) {
      return value;
    }

    if (value instanceof Map) {
      const obj: Record<string, unknown> = {};
      for (const [k, v] of value.entries()) {
        obj[String(k)] = this.toSerializable(v);
      }
      return obj;
    }

    if (Array.isArray(value)) {
      return value.map((item) => this.toSerializable(item));
    }

    if (typeof value === "object") {
      const result: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(value)) {
        result[k] = this.toSerializable(v);
      }
      return result;
    }

    return value;
  }
}
