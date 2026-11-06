import { setHap } from '../shared/hap.ts'
import { HatchBabyRestPlatform, platformName, pluginName } from './platform.ts'

export default function (homebridge: any) {
  setHap(homebridge.hap)

  homebridge.registerPlatform(
    pluginName,
    platformName,
    HatchBabyRestPlatform,
    true,
  )
}
