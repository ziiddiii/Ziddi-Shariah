import { describe, expect, it } from "vitest";
import {
  supportAttachmentPath,
  supportFileType,
  SUPPORT_FILE_MAX_BYTES,
} from "./support-attachments";

describe("support attachment validation", () => {
  it("allows files at 10 MB but rejects anything larger", () => {
    expect(
      supportFileType({ name: "proof.pdf", type: "application/pdf", size: SUPPORT_FILE_MAX_BYTES }),
    ).toBe("application/pdf");
    expect(() =>
      supportFileType({ name: "proof.pdf", type: "application/pdf", size: 10485761 }),
    ).toThrow();
  });
  it("rejects empty files and active web content", () => {
    expect(() => supportFileType({ name: "empty.txt", type: "text/plain", size: 0 })).toThrow();
    expect(() => supportFileType({ name: "page.svg", type: "image/svg+xml", size: 123 })).toThrow();
    expect(() => supportFileType({ name: "page.html", type: "text/html", size: 123 })).toThrow();
  });
  it("rejects mismatched file types and resolves missing browser MIME types", () => {
    expect(() => supportFileType({ name: "photo.png", type: "text/html", size: 123 })).toThrow();
    expect(supportFileType({ name: "proof.PDF", type: "", size: 123 })).toBe("application/pdf");
  });
  it("keeps upload paths scoped to the conversation and actual sender", () => {
    const path = supportAttachmentPath("thread", "sender", "../../proof.pdf");
    expect(path.split("/")).toHaveLength(3);
    expect(path.startsWith("thread/sender/")).toBe(true);
    expect(path.endsWith("proof.pdf")).toBe(true);
    expect(supportAttachmentPath("thread", "sender", "proof.pdf")).not.toBe(path);
  });
});
