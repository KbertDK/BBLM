import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const STANDARD_PRIZES = [
  { name: '1st Place',       type: 'TEAM'   as const, icon: 'horned-skull' },
  { name: '2nd Place',       type: 'TEAM'   as const, icon: 'silver-medal' },
  { name: '3rd Place',       type: 'TEAM'   as const, icon: 'bronze-medal' },
  { name: 'Team Spirit',     type: 'TEAM'   as const, icon: 'spiked-chalice' },
  { name: 'Top Scorer',      type: 'PLAYER' as const, icon: 'golden-elf-spiked-ball' },
  { name: 'Top Passer',      type: 'PLAYER' as const, icon: 'golden-quarterback' },
  { name: 'Top Bone Breaker',type: 'PLAYER' as const, icon: 'gauntlet-dagger' },
]

async function main() {
  for (const prize of STANDARD_PRIZES) {
    const existing = await prisma.prizeType.findFirst({ where: { name: prize.name } })
    if (!existing) {
      await prisma.prizeType.create({ data: prize })
      console.log(`Created: ${prize.name}`)
    } else {
      console.log(`Skipped (already exists): ${prize.name}`)
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
