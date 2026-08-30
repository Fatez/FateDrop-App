const fs = require("node:fs");
const path = require("node:path");
const { withDangerousMod } = require("@expo/config-plugins");

const ICONS = {
  fatedrop_oru: `<?xml version="1.0" encoding="utf-8"?>
<vector xmlns:android="http://schemas.android.com/apk/res/android" android:width="24dp" android:height="24dp" android:viewportWidth="24" android:viewportHeight="24">
  <path android:fillColor="#FFFFFFFF" android:pathData="M12,2C7.6,2 4,5.6 4,10v6.8L7.2,22v-4.5C8.5,18.5 10.1,19 12,19s3.5,-0.5 4.8,-1.5V22L20,16.8V10c0,-4.4 -3.6,-8 -8,-8zM8.4,10.2c0.8,-1.9 2,-3.2 3.6,-4.1 1.6,0.9 2.8,2.2 3.6,4.1 -1.1,-0.7 -2.3,-1 -3.6,-1s-2.5,0.3 -3.6,1zM9,13h2v2H9v-2zM13,13h2v2h-2v-2z"/>
</vector>
`,
  fatedrop_fenn: `<?xml version="1.0" encoding="utf-8"?>
<vector xmlns:android="http://schemas.android.com/apk/res/android" android:width="24dp" android:height="24dp" android:viewportWidth="24" android:viewportHeight="24">
  <path android:fillColor="#FFFFFFFF" android:pathData="M3,3l6,3 3,-2 3,2 6,-3 -2,7v4c0,4.4 -3.1,8 -7,8s-7,-3.6 -7,-8v-4L3,3zM8,11h2v2H8v-2zM14,11h2v2h-2v-2zM9.2,16c0.9,1 1.8,1.5 2.8,1.5s1.9,-0.5 2.8,-1.5L12,14.7 9.2,16z"/>
</vector>
`,
  fatedrop_koru: `<?xml version="1.0" encoding="utf-8"?>
<vector xmlns:android="http://schemas.android.com/apk/res/android" android:width="24dp" android:height="24dp" android:viewportWidth="24" android:viewportHeight="24">
  <path android:fillColor="#FFFFFFFF" android:pathData="M12,1l7,7 -2,10 -5,5 -5,-5L5,8l7,-7zM12,5L8.5,9 10,16l2,2 2,-2 1.5,-7L12,5zM12,8l2,3 -2,4 -2,-4 2,-3z"/>
</vector>
`,
  fatedrop_nyxen: `<?xml version="1.0" encoding="utf-8"?>
<vector xmlns:android="http://schemas.android.com/apk/res/android" android:width="24dp" android:height="24dp" android:viewportWidth="24" android:viewportHeight="24">
  <path android:fillColor="#FFFFFFFF" android:pathData="M13,1L5,10l4,2 -3,8 6,-4 3,7 4,-11 -4,-2 3,-7 -5,3V1zM12,8l3,-2 -1.5,4 2.5,1 -2,5 -1.5,-3 -3,2 1.5,-4 -2,-1 3,-2z"/>
</vector>
`,
  fatedrop_radar: `<?xml version="1.0" encoding="utf-8"?>
<vector xmlns:android="http://schemas.android.com/apk/res/android" android:width="24dp" android:height="24dp" android:viewportWidth="24" android:viewportHeight="24">
  <path android:fillColor="#FFFFFFFF" android:pathData="M12,2C7.6,2 4,5.6 4,10c0,5.8 8,12 8,12s8,-6.2 8,-12c0,-4.4 -3.6,-8 -8,-8zM12,6c2.2,0 4,1.8 4,4h-2c0,-1.1 -0.9,-2 -2,-2V6zM12,9c0.6,0 1,0.4 1,1s-0.4,1 -1,1 -1,-0.4 -1,-1 0.4,-1 1,-1zM8,10H6c0,-3.3 2.7,-6 6,-6v2c-2.2,0 -4,1.8 -4,4zM12,14c2.2,0 4,-1.8 4,-4h2c0,3.3 -2.7,6 -6,6v-2z"/>
</vector>
`,
};

function withFateDropNotificationIcons(config) {
  return withDangerousMod(config, ["android", async (modConfig) => {
    const drawableDir = path.join(modConfig.modRequest.platformProjectRoot, "app", "src", "main", "res", "drawable");
    fs.mkdirSync(drawableDir, { recursive: true });
    for (const [name, xml] of Object.entries(ICONS)) {
      fs.writeFileSync(path.join(drawableDir, `${name}.xml`), xml, "utf8");
    }
    return modConfig;
  }]);
}

module.exports = withFateDropNotificationIcons;
module.exports.ICONS = ICONS;
