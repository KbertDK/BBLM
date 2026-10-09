import { PrismaClient } from '@prisma/client'
import { deckDataPart1 } from './seed-special-play-cards-part1'
import { deckDataPart2 } from './seed-special-play-cards-part2'

const prisma = new PrismaClient()

const deckData = [...deckDataPart1, ...deckDataPart2]

async function main() {
  const totalCards = deckData.reduce((s, d) => s + d.cards.length, 0)
  console.log(`Seeding ${deckData.length} Special Play Card decks (${totalCards} cards)...`)
  for (const deck of deckData) {
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

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
