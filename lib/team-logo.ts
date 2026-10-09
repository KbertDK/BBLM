import { getRaceLogo } from './race-logo'

export function getTeamLogo(logoUrl: string | null | undefined, raceName: string): string | null {
  return logoUrl ?? getRaceLogo(raceName)
}
