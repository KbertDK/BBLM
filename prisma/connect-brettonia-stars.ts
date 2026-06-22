import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const BRETTONIA_STARS = [
  'Galandriel',
  'Dolfar Longstride',
  'Willow Rosebark',
  'Karla von Kill',
  'Mighty Zug',
  'Griff Oberwald',
  "Morg 'n' Thorg",
]

async function main() {
  const race = await prisma.race.findFirst({ where: { name: { contains: 'Brettonia', mode: 'insensitive' } }, select: { id: true, name: true } })
  if (!race) { console.error('Race "Brettonia" not found in DB.'); process.exit(1) }
  console.log(`Found race: ${race.name} (${race.id})`)

  for (const name of BRETTONIA_STARS) {
    const sp = await prisma.mdStarPlayer.findFirst({ where: { name: { contains: name, mode: 'insensitive' } }, select: { id: true, name: true } })
    if (!sp) {
      console.log(`  ✗ NOT FOUND: "${name}"`)
      continue
    }
    await prisma.mdStarPlayer.update({
      where: { id: sp.id },
      data:  { races: { connect: { id: race.id } } },
    })
    console.log(`  ✓ Connected: ${sp.name}`)
  }

  console.log('Done.')
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
