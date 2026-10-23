import { ESLint } from "eslint";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Meta-check for the import-boundary rules in `eslint.boundaries.mjs`: lints small virtual files
 * with the real project config, so a config edit that silently disables a rule fails here.
 */
const eslint = new ESLint({ cwd: path.resolve(__dirname, "..") });

async function boundaryMessages(filePath: string, code: string): Promise<string[]> {
  const [result] = await eslint.lintText(code, { filePath: path.resolve(__dirname, "..", filePath) });
  return result.messages.filter((message) => message.ruleId === "eventtz/import-boundary").map((message) => message.message);
}

describe("web import boundaries", () => {
  it("rejects lib/ importing components/, features/ and app/", async () => {
    for (const target of ["@/components/ui/Button", "@/features/chat/ChatDrawer", "@/app/api/v1/[...path]/route"]) {
      expect(await boundaryMessages("lib/virtual.ts", `import x from "${target}"; export { x };`)).toHaveLength(1);
    }
  }, 60_000);

  it("rejects components/ importing features/ except for the shell allow-list", async () => {
    const code = `import x from "@/features/help/HelpWidget"; export { x };`;
    expect(await boundaryMessages("components/ui/Virtual.tsx", code)).toHaveLength(1);
    expect(await boundaryMessages("components/portal-shell/PortalShell.tsx", code)).toHaveLength(0);
  }, 60_000);

  it("rejects a feature area importing another area, but allows shared feature modules", async () => {
    const other = `import x from "@/features/admin/components/AdminTable"; export { x };`;
    const shared = `import x from "@/features/bookings/bookingTerms"; export { x };`;
    const sharedSubPath = `import x from "@/features/vendors/display/PortfolioLightbox"; export { x };`;
    const sharedFile = `import x from "@/features/vendor/onboarding/serializeVendorPayload"; export { x };`;
    const unsharedSubPath = `import x from "@/features/vendor/onboarding/VendorOnboarding"; export { x };`;
    expect(await boundaryMessages("features/client/virtual.ts", other)).toHaveLength(1);
    expect(await boundaryMessages("features/client/virtual.ts", shared)).toHaveLength(0);
    expect(await boundaryMessages("features/client/virtual.ts", sharedSubPath)).toHaveLength(0);
    expect(await boundaryMessages("features/client/virtual.ts", sharedFile)).toHaveLength(0);
    expect(await boundaryMessages("features/client/virtual.ts", unsharedSubPath)).toHaveLength(1);
  }, 60_000);

  it("rejects relative imports that cross a boundary, and allows ones that stay inside", async () => {
    const importing = (target: string) => `import x from "${target}"; export { x };`;
    expect(await boundaryMessages("lib/virtual.ts", importing("../features/chat/ChatDrawer"))).toHaveLength(1);
    expect(await boundaryMessages("lib/virtual.ts", importing("./format"))).toHaveLength(0);
    expect(await boundaryMessages("components/ui/Virtual.tsx", importing("../../features/help/HelpWidget"))).toHaveLength(1);
    expect(await boundaryMessages("components/ui/Virtual.tsx", importing("../../lib/format"))).toHaveLength(0);
    expect(await boundaryMessages("features/client/virtual.ts", importing("../admin/components/AdminTable"))).toHaveLength(1);
    expect(await boundaryMessages("features/client/virtual.ts", importing("../bookings/bookingTerms"))).toHaveLength(0);
    // A folder named like a top-level one but inside the feature's own area is not a boundary crossing.
    expect(await boundaryMessages("features/admin/virtual.ts", importing("./components/AdminTable"))).toHaveLength(0);
  }, 60_000);

  it("rejects dynamic import() and re-exports across a boundary", async () => {
    const dynamic = `export const load = () => import("@/features/chat/ChatDrawer");`;
    const dynamicRelative = `export const load = () => import("../features/chat/ChatDrawer");`;
    const reExport = `export { ChatDrawer } from "../features/chat/ChatDrawer";`;
    expect(await boundaryMessages("lib/virtual.ts", dynamic)).toHaveLength(1);
    expect(await boundaryMessages("lib/virtual.ts", dynamicRelative)).toHaveLength(1);
    expect(await boundaryMessages("lib/virtual.ts", reExport)).toHaveLength(1);
    expect(await boundaryMessages("lib/virtual.ts", `export const load = () => import("./format");`)).toHaveLength(0);
  }, 60_000);

  it("rejects motion/react outside components/ui", async () => {
    const code = `import { motion } from "motion/react"; export { motion };`;
    expect(await boundaryMessages("features/marketplace/virtual.tsx", code)).toHaveLength(1);
    expect(await boundaryMessages("app/virtual.tsx", code)).toHaveLength(1);
    expect(await boundaryMessages("components/portal-shell/virtual.tsx", code)).toHaveLength(1);
    expect(await boundaryMessages("components/ui/Virtual.tsx", code)).toHaveLength(0);
  }, 60_000);
});
