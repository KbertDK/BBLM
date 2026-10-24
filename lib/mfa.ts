import { generateSecret, verifySync, generateURI } from 'otplib'
import QRCode from 'qrcode'

export function generateMfaSecret(): string {
  return generateSecret()
}

export function verifyMfaToken(token: string, secret: string): boolean {
  const result = verifySync({ secret, token, epochTolerance: 30 })
  return result.valid
}

export async function generateQrDataUrl(email: string, secret: string): Promise<string> {
  const otpauth = generateURI({ issuer: 'BBLM', label: email, secret })
  return QRCode.toDataURL(otpauth)
}
