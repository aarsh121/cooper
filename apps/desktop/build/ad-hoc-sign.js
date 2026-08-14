const { execFileSync } = require('child_process')
const { join } = require('path')

// Apple Silicon refuses to run a bundle with no signature at all: Gatekeeper reports
// "TARS is damaged and can't be opened" and there is no right-click bypass. An ad-hoc
// signature needs no Developer ID and turns that dead end into the normal
// "unidentified developer" prompt.
exports.default = async function adHocSign(context) {
  if (context.electronPlatformName !== 'darwin') return
  if (process.env.CSC_LINK || process.env.CSC_NAME) return

  const appPath = join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`)

  execFileSync('codesign', ['--force', '--deep', '--sign', '-', '--timestamp=none', appPath], {
    stdio: 'inherit'
  })
  execFileSync('codesign', ['--verify', '--deep', '--strict', appPath], { stdio: 'inherit' })
}
