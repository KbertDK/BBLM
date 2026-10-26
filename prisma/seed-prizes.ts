import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const STANDARD_PRIZES = [
  { name: '1st Place',       type: 'TEAM'   as const, icon: '/prizes/horned-skull.svg' },
  { name: '2nd Place',       type: 'TEAM'   as const, icon: '/prizes/silver-medal.svg' },
  { name: '3rd Place',       type: 'TEAM'   as const, icon: '/prizes/bronze-medal.svg' },
  { name: 'Team Spirit',     type: 'TEAM'   as const, icon: '/prizes/spiked-chalice.svg' },
  { name: 'Top Scorer',      type: 'PLAYER' as const, icon: '/prizes/golden-elf-spiked-ball.svg' },
  { name: 'Top Passer',      type: 'PLAYER' as const, icon: '/prizes/golden-quarterback.svg' },
  { name: 'Top Bone Breaker',type: 'PLAYER' as const, icon: '/prizes/gauntlet-dagger.svg' },
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
