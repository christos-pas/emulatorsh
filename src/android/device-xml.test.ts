import assert from "node:assert/strict";
import { test } from "node:test";

import { parseDevicesXml, specSupportedByDevice } from "./device-xml.js";

test("parseDevicesXml reads id, API range, and Play Store from sdklib XML", () => {
  const devices = parseDevicesXml(`
    <d:device>
      <d:id>pixel_9</d:id>
      <d:name>Pixel 9</d:name>
      <d:api-level>30-36</d:api-level>
      <d:playstore-enabled>true</d:playstore-enabled>
      <d:tag-id>google</d:tag-id>
    </d:device>
    <d:device>
      <d:id>old_phone</d:id>
      <d:name>Old Phone</d:name>
      <d:api-level>21-28</d:api-level>
      <d:playstore-enabled>false</d:playstore-enabled>
    </d:device>
  `);
  assert.equal(devices.length, 2);
  assert.deepEqual(devices[0], {
    id: "pixel_9",
    name: "Pixel 9",
    tagId: "google",
    apiMin: 30,
    apiMax: 36,
    hasPlayStore: true,
  });
  assert.equal(specSupportedByDevice("36", "google_apis_playstore", devices[0]!), true);
  assert.equal(specSupportedByDevice("36", "google_apis_playstore", devices[1]!), false);
  assert.equal(specSupportedByDevice("24", "google_apis", devices[1]!), true);
});
