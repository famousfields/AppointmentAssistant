const fs = require('node:fs')
const path = require('node:path')

const projectRoot = path.resolve(__dirname, '..')
const appConfigPath = path.join(projectRoot, 'app.json')
const easConfigPath = path.join(projectRoot, 'eas.json')

const readJson = (filePath) => JSON.parse(fs.readFileSync(filePath, 'utf8'))

const assert = (condition, message) => {
  if (!condition) {
    throw new Error(message)
  }
}

const appConfig = readJson(appConfigPath)
const easConfig = readJson(easConfigPath)
const expo = appConfig.expo || {}

assert(expo.name, 'Expo config must define a name')
assert(expo.slug, 'Expo config must define a slug')
assert(expo.scheme, 'Expo config must define a scheme')
assert(expo.icon, 'Expo config must define an icon path')
assert(expo.splash?.image, 'Expo config must define a splash image')
assert(expo.ios?.bundleIdentifier, 'Expo config must define ios.bundleIdentifier')
assert(expo.android?.package, 'Expo config must define android.package')
assert(expo.android?.adaptiveIcon?.foregroundImage, 'Expo config must define android.adaptiveIcon.foregroundImage')
assert(expo.extra?.eas?.projectId, 'Expo config must define extra.eas.projectId')
assert(easConfig.build?.production, 'EAS config must define a production build profile')

const assetPaths = [
  expo.icon,
  expo.splash?.image,
  expo.android?.adaptiveIcon?.foregroundImage
].filter(Boolean)

assetPaths.forEach((assetPath) => {
  const absoluteAssetPath = path.resolve(projectRoot, assetPath)
  assert(fs.existsSync(absoluteAssetPath), `Missing required asset: ${assetPath}`)
})

console.log('Mobile release config looks valid.')
