import { PrismaClient } from '@prisma/client'
import { deckDataPart1 } from './seed-special-play-cards-part1'
import { deckDataPart2 } from './seed-special-play-cards-part2'

export const specialPlayDeckData = [...deckDataPart1, ...deckDataPart2]

export async function seedSpecialPlayCards(prisma: PrismaClient) {
  const existing = await prisma.mdSpecialPlayDeck.count()
  if (existing > 0) {
    console.log(`MdSpecialPlayDeck already has ${existing} rows — skipping.`)
    return
  }
  const totalCards = specialPlayDeckData.reduce((s, d) => s + d.cards.length, 0)
  console.log(`Seeding ${specialPlayDeckData.length} Special Play Card decks (${totalCards} cards)...`)
  for (const deck of specialPlayDeckData) {
    const created = await prisma.mdSpecialPlayDeck.create({
      data: { name: deck.name, price: deck.price },
    })
    await prisma.mdSpecialPlayCard.createMany({
      data: deck.cards.map((c) => ({ ...c, deckId: created.id })),
    })
    console.log(`  ${deck.name}: ${deck.cards.length} cards @ ${deck.price.toLocaleString()}gp`)
  }
  console.log('Done.')
}

// Still runnable standalone: `npx ts-node prisma/seed-special-play-cards.ts`
if (require.main === module) {
  const prisma = new PrismaClient()
  seedSpecialPlayCards(prisma)
    .catch((e) => { console.error(e); process.exit(1) })
    .finally(() => prisma.$disconnect())
}
