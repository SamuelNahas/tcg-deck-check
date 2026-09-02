import assert from "node:assert/strict";
import test from "node:test";

import {
  limitlessArtworkUrls,
  normalizeLimitlessSetCode,
} from "../server/card-catalog.mjs";

test("maps Brazilian Scarlet & Violet promo codes to the Limitless set", () => {
  assert.equal(normalizeLimitlessSetCode("PR-SV"), "SVP");
  assert.equal(normalizeLimitlessSetCode("pr_sv"), "SVP");
});

test("builds Portuguese and English Limitless artwork fallbacks", () => {
  assert.deepEqual(limitlessArtworkUrls("PR-SV", "181"), [
    "https://limitlesstcg.nyc3.cdn.digitaloceanspaces.com/tpci/SVP/SVP_181_R_PT.png",
    "https://limitlesstcg.nyc3.cdn.digitaloceanspaces.com/tpci/SVP/SVP_181_R_EN.png",
  ]);
  assert.equal(
    limitlessArtworkUrls("MEG", "54")[0],
    "https://limitlesstcg.nyc3.cdn.digitaloceanspaces.com/tpci/MEG/MEG_054_R_PT.png",
  );
});
