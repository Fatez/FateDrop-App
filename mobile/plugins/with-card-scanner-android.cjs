const { withProjectBuildGradle } = require('expo/config-plugins');
// The OCR package predates AGP's required namespace. Scope this to that module.
module.exports = function withCardScannerAndroid(config) {
  return withProjectBuildGradle(config, (result) => {
    const marker = '// FateDrop card scanner namespace';
    if (!result.modResults.contents.includes(marker)) result.modResults.contents += `
\n${marker}
subprojects { project ->
    project.plugins.withId("com.android.library") {
        if (project.projectDir.path.replace('\\\\', '/').endsWith("/@react-native-ml-kit/text-recognition/android")) {
            project.android.namespace = "com.rnmlkit.textrecognition"
        }
    }
}
`;
    return result;
  });
};
